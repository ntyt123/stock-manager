// ==================== 交易计划控制器 ====================
const { tradingPlanModel, planExecutionModel, manualPositionModel, tradeOperationModel, positionModel } = require('../database');
const { getStockQuote } = require('../utils/stockQuoteHelper');

// 创建交易计划
async function createPlan(req, res) {
    try {
        const userId = req.user.id;
        const planData = req.body;

        // 验证必填字段
        if (!planData.stock_code || !planData.stock_name || !planData.plan_type ||
            !planData.plan_date || !planData.target_price) {
            return res.status(400).json({
                success: false,
                error: '缺少必填字段：股票代码、股票名称、计划类型、计划日期、目标价格'
            });
        }

        // 验证计划类型
        const validTypes = ['buy', 'sell', 'add', 'reduce'];
        if (!validTypes.includes(planData.plan_type)) {
            return res.status(400).json({
                success: false,
                error: '无效的计划类型，只能是: buy, sell, add, reduce'
            });
        }

        // 如果没有提供当前价格，尝试获取实时价格
        if (!planData.current_price) {
            try {
                const quote = await getStockQuote(planData.stock_code);
                if (quote && quote.currentPrice) {
                    planData.current_price = quote.currentPrice;
                }
            } catch (err) {
                console.log('获取实时价格失败:', err.message);
            }
        }

        // 如果提供了数量和价格，计算预估金额
        if (planData.quantity && planData.target_price && !planData.estimated_amount) {
            planData.estimated_amount = planData.quantity * planData.target_price;
        }

        // 创建计划
        const result = await tradingPlanModel.create(userId, planData);

        res.json({
            success: true,
            data: {
                id: result.id,
                planDate: planData.planDate,
                created_at: result.created_at
            },
            message: '交易计划创建成功'
        });
    } catch (error) {
        console.error('创建交易计划失败:', error);
        res.status(500).json({
            success: false,
            error: '创建交易计划失败: ' + error.message
        });
    }
}

// 获取今日计划列表（含实时价格）
async function getTodayPlans(req, res) {
    try {
        const userId = req.user.id;
        const plans = await tradingPlanModel.getTodayPlans(userId);

        // 获取所有股票的实时价格
        const stockCodes = [...new Set(plans.map(p => p.stock_code))];
        const quotesMap = {};

        for (const code of stockCodes) {
            try {
                const quote = await getStockQuote(code);
                if (quote && quote.currentPrice) {
                    quotesMap[code] = quote.currentPrice;
                }
            } catch (err) {
                console.log(`获取股票 ${code} 实时价格失败:`, err.message);
            }
        }

        // 处理每个计划
        const processedPlans = plans.map(plan => {
            const currentPrice = quotesMap[plan.stock_code] || plan.current_price;
            const priceGap = currentPrice && plan.target_price
                ? ((currentPrice - plan.target_price) / plan.target_price * 100).toFixed(2)
                : null;

            const alertRange = plan.alert_range || 0.02;
            const isNearTarget = priceGap !== null && Math.abs(priceGap) <= (alertRange * 100);

            return {
                ...plan,
                currentPrice: currentPrice,
                priceGap: priceGap ? parseFloat(priceGap) : null,
                isNearTarget: isNearTarget
            };
        });

        // 分组：高优先级(4-5星) vs 普通优先级
        const highPriority = processedPlans.filter(p => p.priority >= 4);
        const normalPriority = processedPlans.filter(p => p.priority < 4);

        // 统计
        const summary = {
            total: plans.length,
            pending: plans.filter(p => p.plan_status === 'pending').length,
            nearTarget: processedPlans.filter(p => p.isNearTarget).length,
            buyPlans: plans.filter(p => p.plan_type === 'buy').length,
            sellPlans: plans.filter(p => p.plan_type === 'sell').length
        };

        // 获取目标日期（如果有计划，使用计划日期；否则返回今天）
        const targetDate = plans.length > 0 ? plans[0].plan_date : new Date().toISOString().split('T')[0];

        res.json({
            success: true,
            data: {
                date: targetDate,
                highPriority: highPriority,
                normalPriority: normalPriority,
                allPlans: processedPlans,
                summary: summary
            }
        });
    } catch (error) {
        console.error('获取今日计划失败:', error);
        res.status(500).json({
            success: false,
            error: '获取今日计划失败: ' + error.message
        });
    }
}

// 获取计划列表（带筛选和分页）
async function getPlans(req, res) {
    try {
        const userId = req.user.id;
        const filters = {
            status: req.query.status,
            planType: req.query.planType,
            stockCode: req.query.stockCode,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        };

        const plans = await tradingPlanModel.findByUserId(userId, filters);

        res.json({
            success: true,
            data: {
                plans: plans,
                total: plans.length,
                filters: filters
            }
        });
    } catch (error) {
        console.error('获取计划列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取计划列表失败: ' + error.message
        });
    }
}

// 获取单个计划详情
async function getPlanById(req, res) {
    try {
        const planId = req.params.id;
        const plan = await tradingPlanModel.findById(planId);

        if (!plan) {
            return res.status(404).json({
                success: false,
                error: '计划不存在'
            });
        }

        // 检查权限
        if (plan.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: '无权访问此计划'
            });
        }

        // 获取实时价格
        try {
            const quote = await getStockQuote(plan.stock_code);
            if (quote && quote.currentPrice) {
                plan.currentPrice = quote.currentPrice;
                plan.priceGap = ((quote.currentPrice - plan.target_price) / plan.target_price * 100).toFixed(2);
            }
        } catch (err) {
            console.log('获取实时价格失败:', err.message);
        }

        // 获取执行记录
        const executions = await planExecutionModel.findByPlanId(planId);

        res.json({
            success: true,
            data: {
                plan: plan,
                executions: executions
            }
        });
    } catch (error) {
        console.error('获取计划详情失败:', error);
        res.status(500).json({
            success: false,
            error: '获取计划详情失败: ' + error.message
        });
    }
}

// 更新计划
async function updatePlan(req, res) {
    try {
        const planId = req.params.id;
        const updateData = req.body;

        // 检查计划是否存在和权限
        const plan = await tradingPlanModel.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                error: '计划不存在'
            });
        }

        if (plan.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: '无权修改此计划'
            });
        }

        // 如果计划已执行，不允许修改
        if (plan.plan_status === 'executed') {
            return res.status(400).json({
                success: false,
                error: '已执行的计划不能修改'
            });
        }

        // 重新计算预估金额
        if (updateData.quantity && updateData.target_price) {
            updateData.estimated_amount = updateData.quantity * updateData.target_price;
        }

        const result = await tradingPlanModel.update(planId, updateData);

        res.json({
            success: true,
            data: {
                changes: result.changes
            },
            message: '计划更新成功'
        });
    } catch (error) {
        console.error('更新计划失败:', error);
        res.status(500).json({
            success: false,
            error: '更新计划失败: ' + error.message
        });
    }
}

// 执行计划
async function executePlan(req, res) {
    try {
        const planId = req.params.id;
        const userId = req.user.id;
        const { executionType, executionPrice, executionQuantity, notes } = req.body;

        // 验证必填字段
        if (!executionPrice || !executionQuantity) {
            return res.status(400).json({
                success: false,
                error: '缺少必填字段：执行价格、执行数量'
            });
        }

        // 检查计划是否存在和权限
        const plan = await tradingPlanModel.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                error: '计划不存在'
            });
        }

        if (plan.user_id !== userId) {
            return res.status(403).json({
                success: false,
                error: '无权执行此计划'
            });
        }

        // 检查计划状态
        if (plan.plan_status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: `该计划状态为${plan.plan_status}，不能执行`
            });
        }

        // 执行计划
        const executionData = {
            executionType: executionType || 'manual',
            executionPrice: parseFloat(executionPrice),
            executionQuantity: parseFloat(executionQuantity),
            notes: notes
        };

        const result = await tradingPlanModel.execute(planId, userId, executionData);

        // ==================== 自动录入持仓信息和交易记录 ====================
        try {
            const executedPlan = result.plan;
            const execution = result.execution;

            // 1. 记录交易操作
            await tradeOperationModel.add(userId, {
                tradeType: executedPlan.plan_type,
                tradeDate: new Date().toISOString().split('T')[0],
                stockCode: executedPlan.stock_code,
                stockName: executedPlan.stock_name,
                quantity: execution.execution_quantity,
                price: execution.execution_price,
                fee: 0, // 默认手续费为0，如果需要可以从计划中获取
                amount: execution.execution_amount,
                notes: `交易计划执行 #${planId}` + (notes ? ` - ${notes}` : '')
            });

            console.log(`✅ 已记录交易操作: ${executedPlan.plan_type} ${executedPlan.stock_name}(${executedPlan.stock_code}) x${execution.execution_quantity}`);

            // 2. 更新持仓信息（同步到 manual_positions 和 user_positions 两个表）
            const existingManualPosition = await manualPositionModel.findByStockCode(userId, executedPlan.stock_code);
            const existingUserPosition = await positionModel.findByStockCode(userId, executedPlan.stock_code);

            if (executedPlan.plan_type === 'buy' || executedPlan.plan_type === 'add') {
                // 买入或加仓逻辑
                if (existingManualPosition) {
                    // 已有持仓，计算新的平均成本
                    const oldQuantity = existingManualPosition.quantity;
                    const oldCostPrice = existingManualPosition.cost_price;
                    const newQuantity = oldQuantity + execution.execution_quantity;
                    const newCostPrice = (oldQuantity * oldCostPrice + execution.execution_amount) / newQuantity;

                    // 更新 manual_positions 表
                    await manualPositionModel.update(existingManualPosition.id, {
                        stockCode: executedPlan.stock_code,
                        stockName: executedPlan.stock_name,
                        quantity: newQuantity,
                        costPrice: newCostPrice,
                        buyDate: existingManualPosition.buy_date,
                        currentPrice: execution.execution_price,
                        notes: existingManualPosition.notes || ''
                    });

                    // 同步到 user_positions 表
                    const syncPositionData = {
                        stockName: executedPlan.stock_name,
                        quantity: newQuantity,
                        costPrice: newCostPrice,
                        currentPrice: execution.execution_price,
                        marketValue: execution.execution_price * newQuantity,
                        profitLoss: (execution.execution_price - newCostPrice) * newQuantity,
                        profitLossRate: ((execution.execution_price - newCostPrice) / newCostPrice * 100)
                    };

                    if (existingUserPosition) {
                        await positionModel.updatePosition(userId, executedPlan.stock_code, syncPositionData);
                    } else {
                        await positionModel.addPosition(userId, {
                            stockCode: executedPlan.stock_code,
                            ...syncPositionData
                        });
                    }

                    console.log(`✅ 已更新持仓: ${executedPlan.stock_name} 数量=${newQuantity} 平均成本=${newCostPrice.toFixed(2)}`);
                } else {
                    // 新建持仓
                    await manualPositionModel.add(userId, {
                        stockCode: executedPlan.stock_code,
                        stockName: executedPlan.stock_name,
                        quantity: execution.execution_quantity,
                        costPrice: execution.execution_price,
                        buyDate: new Date().toISOString().split('T')[0],
                        currentPrice: execution.execution_price,
                        notes: `交易计划 #${planId} 买入`
                    });

                    // 同步到 user_positions 表
                    await positionModel.addPosition(userId, {
                        stockCode: executedPlan.stock_code,
                        stockName: executedPlan.stock_name,
                        quantity: execution.execution_quantity,
                        costPrice: execution.execution_price,
                        currentPrice: execution.execution_price,
                        marketValue: execution.execution_amount,
                        profitLoss: 0,
                        profitLossRate: 0
                    });

                    console.log(`✅ 已创建持仓: ${executedPlan.stock_name} 数量=${execution.execution_quantity} 成本=${execution.execution_price}`);
                }
            } else if (executedPlan.plan_type === 'sell' || executedPlan.plan_type === 'reduce') {
                // 卖出或减仓逻辑
                if (existingManualPosition) {
                    const newQuantity = existingManualPosition.quantity - execution.execution_quantity;

                    if (newQuantity <= 0) {
                        // 清仓，删除持仓记录
                        await manualPositionModel.delete(existingManualPosition.id);

                        // 同步删除 user_positions 表
                        if (existingUserPosition) {
                            await positionModel.deletePosition(userId, executedPlan.stock_code);
                        }

                        console.log(`✅ 已清仓: ${executedPlan.stock_name}`);
                    } else {
                        // 减仓，更新数量
                        await manualPositionModel.update(existingManualPosition.id, {
                            stockCode: executedPlan.stock_code,
                            stockName: executedPlan.stock_name,
                            quantity: newQuantity,
                            costPrice: existingManualPosition.cost_price,
                            buyDate: existingManualPosition.buy_date,
                            currentPrice: execution.execution_price,
                            notes: existingManualPosition.notes || ''
                        });

                        // 同步更新 user_positions 表
                        if (existingUserPosition) {
                            await positionModel.updatePosition(userId, executedPlan.stock_code, {
                                stockName: executedPlan.stock_name,
                                quantity: newQuantity,
                                costPrice: existingManualPosition.cost_price,
                                currentPrice: execution.execution_price,
                                marketValue: execution.execution_price * newQuantity,
                                profitLoss: (execution.execution_price - existingManualPosition.cost_price) * newQuantity,
                                profitLossRate: ((execution.execution_price - existingManualPosition.cost_price) / existingManualPosition.cost_price * 100)
                            });
                        }

                        console.log(`✅ 已减仓: ${executedPlan.stock_name} 剩余数量=${newQuantity}`);
                    }
                } else {
                    console.warn(`⚠️ 卖出/减仓但未找到持仓记录: ${executedPlan.stock_code}`);
                }
            }
        } catch (positionError) {
            console.error('❌ 自动录入持仓信息失败:', positionError);
            // 持仓录入失败不影响计划执行，只记录错误
        }

        res.json({
            success: true,
            data: result,
            message: '计划执行成功，已自动录入持仓信息和交易记录'
        });
    } catch (error) {
        console.error('执行计划失败:', error);
        res.status(500).json({
            success: false,
            error: '执行计划失败: ' + error.message
        });
    }
}

// 取消计划
async function cancelPlan(req, res) {
    try {
        const planId = req.params.id;
        const { reason } = req.body;

        // 检查计划是否存在和权限
        const plan = await tradingPlanModel.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                error: '计划不存在'
            });
        }

        if (plan.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: '无权取消此计划'
            });
        }

        // 检查计划状态
        if (plan.plan_status === 'executed') {
            return res.status(400).json({
                success: false,
                error: '已执行的计划不能取消'
            });
        }

        const result = await tradingPlanModel.cancel(planId, reason);

        res.json({
            success: true,
            data: {
                changes: result.changes
            },
            message: '计划已取消'
        });
    } catch (error) {
        console.error('取消计划失败:', error);
        res.status(500).json({
            success: false,
            error: '取消计划失败: ' + error.message
        });
    }
}

// 删除计划
async function deletePlan(req, res) {
    try {
        const planId = req.params.id;

        // 检查计划是否存在和权限
        const plan = await tradingPlanModel.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                error: '计划不存在'
            });
        }

        if (plan.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: '无权删除此计划'
            });
        }

        const result = await tradingPlanModel.delete(planId);

        res.json({
            success: true,
            data: {
                changes: result.changes
            },
            message: '计划已删除'
        });
    } catch (error) {
        console.error('删除计划失败:', error);
        res.status(500).json({
            success: false,
            error: '删除计划失败: ' + error.message
        });
    }
}

// 批量操作计划
async function batchOperate(req, res) {
    try {
        const { action, planIds, reason } = req.body;

        if (!action || !planIds || !Array.isArray(planIds) || planIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: '缺少必填字段：action, planIds'
            });
        }

        // 验证操作类型
        const validActions = ['cancel', 'delete'];
        if (!validActions.includes(action)) {
            return res.status(400).json({
                success: false,
                error: '无效的操作类型，只能是: cancel, delete'
            });
        }

        // TODO: 验证所有计划的权限
        // 为了简化，这里假设用户只能操作自己的计划

        const result = await tradingPlanModel.batchOperate(planIds, action, reason);

        res.json({
            success: true,
            data: result,
            message: `批量${action === 'cancel' ? '取消' : '删除'}操作完成`
        });
    } catch (error) {
        console.error('批量操作失败:', error);
        res.status(500).json({
            success: false,
            error: '批量操作失败: ' + error.message
        });
    }
}

// 获取计划统计
async function getStatistics(req, res) {
    try {
        const userId = req.user.id;
        const days = parseInt(req.query.days) || 30;

        const stats = await tradingPlanModel.getStatistics(userId, days);

        // 计算执行率、胜率等
        const totalPlans = stats.statusStats.reduce((sum, item) => sum + item.count, 0);
        const executedPlans = stats.statusStats.find(s => s.plan_status === 'executed')?.count || 0;
        const cancelledPlans = stats.statusStats.find(s => s.plan_status === 'cancelled')?.count || 0;
        const expiredPlans = stats.statusStats.find(s => s.plan_status === 'expired')?.count || 0;

        const executionRate = totalPlans > 0 ? (executedPlans / totalPlans * 100).toFixed(1) : 0;

        res.json({
            success: true,
            data: {
                days: days,
                summary: {
                    totalPlans: totalPlans,
                    executedPlans: executedPlans,
                    cancelledPlans: cancelledPlans,
                    expiredPlans: expiredPlans,
                    executionRate: parseFloat(executionRate)
                },
                statusStats: stats.statusStats,
                typeStats: stats.typeStats,
                executionStats: stats.executionStats
            }
        });
    } catch (error) {
        console.error('获取统计数据失败:', error);
        res.status(500).json({
            success: false,
            error: '获取统计数据失败: ' + error.message
        });
    }
}

// 标记过期计划（定时任务调用）
async function markExpiredPlans() {
    try {
        const result = await tradingPlanModel.markExpiredPlans();
        console.log(`✅ 标记了 ${result.changes} 个过期计划`);
        return result;
    } catch (error) {
        console.error('标记过期计划失败:', error);
        throw error;
    }
}

module.exports = {
    createPlan,
    getTodayPlans,
    getPlans,
    getPlanById,
    updatePlan,
    executePlan,
    cancelPlan,
    deletePlan,
    batchOperate,
    getStatistics,
    markExpiredPlans
};
