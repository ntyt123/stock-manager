const express = require('express');
const { tradeOperationModel, positionModel, watchlistModel } = require('../database');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 获取用户的交易历史
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 100;
            const offset = parseInt(req.query.offset) || 0;
            const stockCode = req.query.stockCode;

            let operations;
            if (stockCode) {
                operations = await tradeOperationModel.findByStockCode(userId, stockCode);
            } else {
                operations = await tradeOperationModel.findByUserId(userId, limit, offset);
            }

            res.json({
                success: true,
                data: operations,
                count: operations.length
            });

        } catch (error) {
            console.error('获取交易历史错误:', error);
            res.status(500).json({
                success: false,
                error: '获取交易历史失败'
            });
        }
    });

    // 添加交易记录
    router.post('/', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { tradeType, tradeDate, stockCode, stockName, quantity, price, fee, notes } = req.body;

            // 验证必填字段
            if (!tradeType || !tradeDate || !stockCode || !stockName || !quantity || !price) {
                return res.status(400).json({
                    success: false,
                    error: '交易类型、日期、股票代码、名称、数量和价格是必填的'
                });
            }

            // 验证交易类型
            if (!['buy', 'sell', 'add', 'reduce'].includes(tradeType)) {
                return res.status(400).json({
                    success: false,
                    error: '交易类型必须是buy、sell、add或reduce'
                });
            }

            // 验证数量和价格
            if (parseFloat(quantity) <= 0 || parseFloat(price) <= 0) {
                return res.status(400).json({
                    success: false,
                    error: '数量和价格必须大于0'
                });
            }

            // 计算交易金额
            const qty = parseFloat(quantity);
            const prc = parseFloat(price);
            const feeAmount = fee ? parseFloat(fee) : 0;

            let amount;
            if (tradeType === 'buy' || tradeType === 'add') {
                amount = (qty * prc) + feeAmount;
            } else {
                amount = (qty * prc) - feeAmount;
            }

            const tradeData = {
                tradeType,
                tradeDate,
                stockCode,
                stockName,
                quantity: qty,
                price: prc,
                fee: feeAmount,
                amount: amount,
                notes: notes || null
            };

            const result = await tradeOperationModel.add(userId, tradeData);

            console.log(`✅ 用户 ${userId} 添加交易记录: ${tradeType} ${stockName} (${stockCode})`);

            // 同步持仓数据
            try {
                // 查询当前持仓
                const existingPosition = await positionModel.findByStockCode(userId, stockCode);

                if (tradeType === 'buy' || tradeType === 'add') {
                    // 买入或加仓
                    if (existingPosition) {
                        // 更新现有持仓：计算新的成本价和数量
                        const oldQuantity = existingPosition.quantity || 0;
                        const oldCost = existingPosition.costPrice || 0;
                        const newQuantity = oldQuantity + qty;
                        const newCostPrice = ((oldCost * oldQuantity) + (prc * qty)) / newQuantity;

                        await positionModel.updatePosition(userId, stockCode, {
                            stockName,
                            quantity: newQuantity,
                            costPrice: newCostPrice,
                            currentPrice: prc,
                            marketValue: newQuantity * prc,
                            profitLoss: 0,
                            profitLossRate: 0
                        });

                        console.log(`📊 更新持仓: ${stockName} (${stockCode}) 数量: ${oldQuantity} -> ${newQuantity}, 成本: ¥${oldCost.toFixed(2)} -> ¥${newCostPrice.toFixed(2)}`);
                    } else {
                        // 新增持仓
                        await positionModel.addPosition(userId, {
                            stockCode,
                            stockName,
                            quantity: qty,
                            costPrice: prc,
                            currentPrice: prc,
                            marketValue: qty * prc,
                            profitLoss: 0,
                            profitLossRate: 0
                        });

                        console.log(`📊 新增持仓: ${stockName} (${stockCode}) 数量: ${qty}, 成本: ¥${prc.toFixed(2)}`);

                        // 新股票加入自选
                        const inWatchlist = await watchlistModel.exists(userId, stockCode);
                        if (!inWatchlist) {
                            await watchlistModel.add(userId, stockCode, stockName);
                            console.log(`⭐ 加入自选: ${stockName} (${stockCode})`);
                        }
                    }
                } else if (tradeType === 'sell' || tradeType === 'reduce') {
                    // 卖出或减仓
                    if (existingPosition) {
                        const oldQuantity = existingPosition.quantity || 0;
                        const newQuantity = oldQuantity - qty;

                        if (newQuantity <= 0) {
                            // 清仓：删除持仓
                            await positionModel.deletePosition(userId, stockCode);
                            console.log(`🗑️ 清仓删除持仓: ${stockName} (${stockCode})`);
                        } else {
                            // 部分卖出：更新数量
                            const costPrice = existingPosition.costPrice || 0;
                            await positionModel.updatePosition(userId, stockCode, {
                                stockName,
                                quantity: newQuantity,
                                costPrice: costPrice,
                                currentPrice: prc,
                                marketValue: newQuantity * prc,
                                profitLoss: (prc - costPrice) * newQuantity,
                                profitLossRate: ((prc - costPrice) / costPrice) * 100
                            });

                            console.log(`📊 减少持仓: ${stockName} (${stockCode}) 数量: ${oldQuantity} -> ${newQuantity}`);
                        }
                    } else {
                        console.log(`⚠️ 警告: 卖出股票但未找到持仓记录: ${stockName} (${stockCode})`);
                    }
                }
            } catch (syncError) {
                console.error('⚠️ 同步持仓数据失败:', syncError.message);
                // 不影响交易记录添加成功，只是记录错误
            }

            res.json({
                success: true,
                message: '交易记录添加成功',
                data: {
                    id: result.id,
                    ...tradeData,
                    created_at: result.created_at
                }
            });

        } catch (error) {
            console.error('添加交易记录错误:', error);
            res.status(500).json({
                success: false,
                error: '添加交易记录失败: ' + error.message
            });
        }
    });

    // 删除交易记录
    router.delete('/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const operationId = parseInt(req.params.id);

            // 验证记录所有权
            const operation = await tradeOperationModel.findById(operationId);
            if (!operation) {
                return res.status(404).json({
                    success: false,
                    error: '交易记录不存在'
                });
            }

            if (operation.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    error: '无权删除此交易记录'
                });
            }

            const result = await tradeOperationModel.delete(operationId);

            console.log(`✅ 用户 ${userId} 删除交易记录 ID: ${operationId}`);

            res.json({
                success: true,
                message: '交易记录删除成功',
                deletedCount: result.changes
            });

        } catch (error) {
            console.error('删除交易记录错误:', error);
            res.status(500).json({
                success: false,
                error: '删除交易记录失败'
            });
        }
    });

    // 获取交易统计
    router.get('/stats', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const stats = await tradeOperationModel.getStatsByType(userId);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('获取交易统计错误:', error);
            res.status(500).json({
                success: false,
                error: '获取交易统计失败'
            });
        }
    });

    return router;
};
