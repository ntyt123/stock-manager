const { positionCostRecordModel, positionCostAdjustmentModel } = require('../database');

// 费用计算配置
const FEE_CONFIG = {
    // 佣金费率（默认万2.5，最低5元）
    COMMISSION_RATE: 0.00025,
    COMMISSION_MIN: 5,

    // 印花税率（仅卖出收取，千分之一）
    STAMP_DUTY_RATE: 0.001,

    // 过户费率（双向收取，万0.2）
    TRANSFER_FEE_RATE: 0.00002
};

// 计算交易费用
function calculateTradeFees(operationType, amount) {
    const fees = {
        commissionFee: 0,
        stampDuty: 0,
        transferFee: 0,
        totalFee: 0
    };

    // 计算佣金（双向收取）
    fees.commissionFee = Math.max(amount * FEE_CONFIG.COMMISSION_RATE, FEE_CONFIG.COMMISSION_MIN);

    // 计算印花税（仅卖出收取）
    if (operationType === 'sell') {
        fees.stampDuty = amount * FEE_CONFIG.STAMP_DUTY_RATE;
    }

    // 计算过户费（双向收取）
    fees.transferFee = amount * FEE_CONFIG.TRANSFER_FEE_RATE;

    // 总费用
    fees.totalFee = fees.commissionFee + fees.stampDuty + fees.transferFee;

    // 保留2位小数
    fees.commissionFee = Math.round(fees.commissionFee * 100) / 100;
    fees.stampDuty = Math.round(fees.stampDuty * 100) / 100;
    fees.transferFee = Math.round(fees.transferFee * 100) / 100;
    fees.totalFee = Math.round(fees.totalFee * 100) / 100;

    return fees;
}

// 计算T+N日期（A股T+1交易制度）
function calculateTPlusNDate(operationDate, n = 1) {
    const date = new Date(operationDate);
    let tradingDays = 0;

    while (tradingDays < n) {
        date.setDate(date.getDate() + 1);
        const dayOfWeek = date.getDay();

        // 跳过周末
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            tradingDays++;
        }
    }

    return date.toISOString().split('T')[0];
}

// 添加成本记录内部函数（供内部调用）
async function addCostRecordInternal(userId, data) {
    const {
        stockCode,
        stockName,
        operationType,  // 'buy' or 'sell'
        operationDate,
        quantity,
        price,
        notes
    } = data;

    // 验证必填字段
    if (!stockCode || !stockName || !operationType || !operationDate || !quantity || !price) {
        throw new Error('缺少必填字段');
    }

    // 验证数量和价格
    if (parseFloat(quantity) <= 0 || parseFloat(price) <= 0) {
        throw new Error('数量和价格必须大于0');
    }

    // 计算金额
    const amount = parseFloat(quantity) * parseFloat(price);

    // 计算费用
    const fees = calculateTradeFees(operationType, amount);

    // 计算T+N日期
    const tPlusNDate = calculateTPlusNDate(operationDate);
    const today = new Date().toISOString().split('T')[0];
    const isSellable = tPlusNDate <= today;

    // 准备记录数据
    const recordData = {
        stockCode,
        stockName,
        operationType,
        operationDate,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        amount,
        commissionFee: fees.commissionFee,
        stampDuty: fees.stampDuty,
        transferFee: fees.transferFee,
        totalFee: fees.totalFee,
        remainingQuantity: parseFloat(quantity),  // 初始剩余数量等于买入数量
        tPlusNDate,
        isSellable,
        notes: notes || null
    };

    // 如果是卖出操作，需要更新对应的买入记录
    if (operationType === 'sell') {
        const buyRecords = await positionCostRecordModel.findByStockCode(userId, stockCode);
        let sellQuantity = parseFloat(quantity);

        // 按照FIFO原则（先进先出）匹配买入记录
        for (const buyRecord of buyRecords) {
            if (sellQuantity <= 0) break;
            if (buyRecord.remaining_quantity <= 0) continue;
            if (buyRecord.operation_type !== 'buy') continue;

            const deductQuantity = Math.min(buyRecord.remaining_quantity, sellQuantity);
            const newRemainingQuantity = buyRecord.remaining_quantity - deductQuantity;

            await positionCostRecordModel.updateRemainingQuantity(
                buyRecord.id,
                newRemainingQuantity,
                false
            );

            sellQuantity -= deductQuantity;
        }

        if (sellQuantity > 0) {
            throw new Error(`卖出数量超过可用持仓，超出 ${sellQuantity} 股`);
        }

        // 卖出记录的剩余数量为0
        recordData.remainingQuantity = 0;
    }

    // 保存记录
    const result = await positionCostRecordModel.add(userId, recordData);

    console.log(`✅ 成本记录添加成功: ${operationType} ${stockCode} ${quantity}股 @${price}`);

    return {
        id: result.id,
        ...recordData,
        created_at: result.created_at
    };
}

// 添加成本记录（买入/卖出）- HTTP API 端点
async function addCostRecord(req, res) {
    try {
        const userId = req.user.id;
        const data = {
            stockCode: req.body.stockCode,
            stockName: req.body.stockName,
            operationType: req.body.operationType,
            operationDate: req.body.operationDate,
            quantity: req.body.quantity,
            price: req.body.price,
            notes: req.body.notes
        };

        const result = await addCostRecordInternal(userId, data);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('添加成本记录错误:', error);

        // 根据错误类型返回不同的状态码
        if (error.message.includes('缺少必填字段') ||
            error.message.includes('数量和价格必须大于0') ||
            error.message.includes('卖出数量超过可用持仓')) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                error: error.message || '添加成本记录失败'
            });
        }
    }
}

// 获取持仓成本记录
async function getCostRecords(req, res) {
    try {
        const userId = req.user.id;
        const { stockCode } = req.query;

        let records;
        if (stockCode) {
            records = await positionCostRecordModel.findByStockCode(userId, stockCode);
        } else {
            records = await positionCostRecordModel.findByUserId(userId);
        }

        res.json({
            success: true,
            data: records
        });

    } catch (error) {
        console.error('获取成本记录错误:', error);
        res.status(500).json({
            success: false,
            error: error.message || '获取成本记录失败'
        });
    }
}

// 获取持仓成本汇总
async function getCostSummary(req, res) {
    try {
        const userId = req.user.id;
        const { stockCode } = req.query;

        if (!stockCode) {
            return res.status(400).json({
                success: false,
                error: '缺少股票代码'
            });
        }

        // 获取所有买入记录
        const records = await positionCostRecordModel.findByStockCode(userId, stockCode);
        const buyRecords = records.filter(r => r.operation_type === 'buy' && r.remaining_quantity > 0);

        // 计算加权平均成本
        let totalQuantity = 0;
        let totalCost = 0;
        let totalFees = 0;
        let sellableQuantity = 0;
        let unsellableQuantity = 0;

        const today = new Date().toISOString().split('T')[0];

        for (const record of buyRecords) {
            const quantity = record.remaining_quantity;
            totalQuantity += quantity;
            totalCost += record.price * quantity;
            totalFees += record.total_fee * (quantity / record.quantity);  // 按比例分配费用

            // T+N判断
            if (record.t_plus_n_date <= today) {
                sellableQuantity += quantity;
            } else {
                unsellableQuantity += quantity;
            }
        }

        const avgCost = totalQuantity > 0 ? (totalCost + totalFees) / totalQuantity : 0;

        // 获取历史所有记录（包括已卖出的）
        const allRecords = await positionCostRecordModel.findByStockCode(userId, stockCode);
        const sellRecords = allRecords.filter(r => r.operation_type === 'sell');

        // 计算已实现盈亏
        let realizedProfitLoss = 0;
        for (const sellRecord of sellRecords) {
            realizedProfitLoss += (sellRecord.price * sellRecord.quantity - sellRecord.total_fee);
        }

        // 减去卖出股票的成本
        const soldCost = allRecords
            .filter(r => r.operation_type === 'buy')
            .reduce((sum, r) => sum + (r.price * (r.quantity - r.remaining_quantity)), 0);
        realizedProfitLoss -= soldCost;

        res.json({
            success: true,
            data: {
                stockCode,
                totalQuantity,
                avgCost: Math.round(avgCost * 100) / 100,
                totalCost: Math.round(totalCost * 100) / 100,
                totalFees: Math.round(totalFees * 100) / 100,
                sellableQuantity,
                unsellableQuantity,
                realizedProfitLoss: Math.round(realizedProfitLoss * 100) / 100,
                records: buyRecords
            }
        });

    } catch (error) {
        console.error('获取成本汇总错误:', error);
        res.status(500).json({
            success: false,
            error: error.message || '获取成本汇总失败'
        });
    }
}

// 添加成本调整记录
async function addCostAdjustment(req, res) {
    try {
        const userId = req.user.id;
        const {
            stockCode,
            stockName,
            adjustmentType,  // 'dividend', 'bonus', 'rights'
            adjustmentDate,
            dividendAmount,  // 每股分红金额
            bonusShares,     // 每10股送X股
            rightsShares,    // 每10股配X股
            rightsPrice      // 配股价格
        } = req.body;

        // 验证必填字段
        if (!stockCode || !stockName || !adjustmentType || !adjustmentDate) {
            return res.status(400).json({
                success: false,
                error: '缺少必填字段'
            });
        }

        // 获取当前持仓
        const costAverage = await positionCostRecordModel.calculateWeightedAverage(userId, stockCode);
        const quantityBefore = costAverage.total_quantity || 0;
        const costBefore = costAverage.avg_cost || 0;

        if (quantityBefore <= 0) {
            return res.status(400).json({
                success: false,
                error: '该股票无持仓，无法进行调整'
            });
        }

        let quantityAfter = quantityBefore;
        let costAfter = costBefore;
        let description = '';

        // 根据调整类型计算新的数量和成本
        switch (adjustmentType) {
            case 'dividend':
                // 分红：减少成本
                const totalDividend = quantityBefore * (parseFloat(dividendAmount) || 0);
                costAfter = costBefore - (totalDividend / quantityBefore);
                description = `每股分红 ¥${dividendAmount}，共分红 ¥${totalDividend.toFixed(2)}`;
                break;

            case 'bonus':
                // 送股：增加数量，降低成本
                const bonusRatio = (parseFloat(bonusShares) || 0) / 10;
                const bonusQuantity = quantityBefore * bonusRatio;
                quantityAfter = quantityBefore + bonusQuantity;
                costAfter = (costBefore * quantityBefore) / quantityAfter;
                description = `每10股送${bonusShares}股，增加 ${bonusQuantity.toFixed(0)} 股`;
                break;

            case 'rights':
                // 配股：增加数量，增加成本
                const rightsRatio = (parseFloat(rightsShares) || 0) / 10;
                const rightsQuantity = quantityBefore * rightsRatio;
                const rightsCost = rightsQuantity * (parseFloat(rightsPrice) || 0);
                quantityAfter = quantityBefore + rightsQuantity;
                costAfter = ((costBefore * quantityBefore) + rightsCost) / quantityAfter;
                description = `每10股配${rightsShares}股，配股价 ¥${rightsPrice}，增加 ${rightsQuantity.toFixed(0)} 股`;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: '不支持的调整类型'
                });
        }

        // 保存调整记录
        const adjustmentData = {
            stockCode,
            stockName,
            adjustmentType,
            adjustmentDate,
            quantityBefore,
            quantityAfter,
            costBefore,
            costAfter,
            dividendAmount: parseFloat(dividendAmount) || 0,
            bonusShares: parseFloat(bonusShares) || 0,
            rightsShares: parseFloat(rightsShares) || 0,
            rightsPrice: parseFloat(rightsPrice) || 0,
            description
        };

        const result = await positionCostAdjustmentModel.add(userId, adjustmentData);

        console.log(`✅ 成本调整记录添加成功: ${adjustmentType} ${stockCode}`);

        res.json({
            success: true,
            data: {
                id: result.id,
                ...adjustmentData,
                created_at: result.created_at
            }
        });

    } catch (error) {
        console.error('添加成本调整记录错误:', error);
        res.status(500).json({
            success: false,
            error: error.message || '添加成本调整记录失败'
        });
    }
}

// 获取成本调整记录
async function getCostAdjustments(req, res) {
    try {
        const userId = req.user.id;
        const { stockCode } = req.query;

        let adjustments;
        if (stockCode) {
            adjustments = await positionCostAdjustmentModel.findByStockCode(userId, stockCode);
        } else {
            adjustments = await positionCostAdjustmentModel.findByUserId(userId);
        }

        res.json({
            success: true,
            data: adjustments
        });

    } catch (error) {
        console.error('获取成本调整记录错误:', error);
        res.status(500).json({
            success: false,
            error: error.message || '获取成本调整记录失败'
        });
    }
}

// 删除成本记录
async function deleteCostRecord(req, res) {
    try {
        const { recordId } = req.params;

        await positionCostRecordModel.delete(recordId);

        console.log(`✅ 成本记录删除成功: ${recordId}`);

        res.json({
            success: true,
            message: '成本记录删除成功'
        });

    } catch (error) {
        console.error('删除成本记录错误:', error);
        res.status(500).json({
            success: false,
            error: error.message || '删除成本记录失败'
        });
    }
}

// 删除成本调整记录
async function deleteCostAdjustment(req, res) {
    try {
        const { adjustmentId } = req.params;

        await positionCostAdjustmentModel.delete(adjustmentId);

        console.log(`✅ 成本调整记录删除成功: ${adjustmentId}`);

        res.json({
            success: true,
            message: '成本调整记录删除成功'
        });

    } catch (error) {
        console.error('删除成本调整记录错误:', error);
        res.status(500).json({
            success: false,
            error: error.message || '删除成本调整记录失败'
        });
    }
}

// 获取所有持仓的成本汇总列表
async function getAllPositionsCostSummary(req, res) {
    try {
        const userId = req.user.id;

        // 获取用户所有成本记录
        const allRecords = await positionCostRecordModel.findByUserId(userId);

        // 按股票代码分组
        const stockGroups = {};
        for (const record of allRecords) {
            if (!stockGroups[record.stock_code]) {
                stockGroups[record.stock_code] = {
                    stockCode: record.stock_code,
                    stockName: record.stock_name,
                    records: []
                };
            }
            stockGroups[record.stock_code].records.push(record);
        }

        // 计算每个股票的成本汇总
        const summaries = [];
        const today = new Date().toISOString().split('T')[0];

        for (const stockCode in stockGroups) {
            const group = stockGroups[stockCode];
            const buyRecords = group.records.filter(r => r.operation_type === 'buy' && r.remaining_quantity > 0);

            let totalQuantity = 0;
            let totalCost = 0;
            let totalFees = 0;
            let sellableQuantity = 0;
            let unsellableQuantity = 0;

            for (const record of buyRecords) {
                const quantity = record.remaining_quantity;
                totalQuantity += quantity;
                totalCost += record.price * quantity;
                totalFees += record.total_fee * (quantity / record.quantity);

                if (record.t_plus_n_date <= today) {
                    sellableQuantity += quantity;
                } else {
                    unsellableQuantity += quantity;
                }
            }

            const avgCost = totalQuantity > 0 ? (totalCost + totalFees) / totalQuantity : 0;

            if (totalQuantity > 0) {
                summaries.push({
                    stockCode: group.stockCode,
                    stockName: group.stockName,
                    totalQuantity,
                    avgCost: Math.round(avgCost * 100) / 100,
                    totalCost: Math.round(totalCost * 100) / 100,
                    totalFees: Math.round(totalFees * 100) / 100,
                    sellableQuantity,
                    unsellableQuantity
                });
            }
        }

        res.json({
            success: true,
            data: summaries
        });

    } catch (error) {
        console.error('获取持仓成本汇总列表错误:', error);
        res.status(500).json({
            success: false,
            error: error.message || '获取持仓成本汇总列表失败'
        });
    }
}

module.exports = {
    addCostRecord,
    addCostRecordInternal,  // 导出内部函数供其他模块使用
    getCostRecords,
    getCostSummary,
    addCostAdjustment,
    getCostAdjustments,
    deleteCostRecord,
    deleteCostAdjustment,
    getAllPositionsCostSummary,
    calculateTradeFees,
    calculateTPlusNDate
};
