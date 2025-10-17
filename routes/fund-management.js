const express = require('express');
const { fundAccountModel, fundTransactionModel, positionModel } = require('../database');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 获取用户资金账户信息
    router.get('/account', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const account = await fundAccountModel.getOrCreate(userId);

            res.json({
                success: true,
                data: account
            });

        } catch (error) {
            console.error('获取资金账户错误:', error);
            res.status(500).json({
                success: false,
                error: '获取资金账户失败'
            });
        }
    });

    // 更新资金账户（手动调整）
    router.put('/account', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { cash_balance, position_value, frozen_funds } = req.body;

            // 验证参数
            if (cash_balance === undefined || position_value === undefined) {
                return res.status(400).json({
                    success: false,
                    error: '现金余额和持仓市值是必填的'
                });
            }

            const result = await fundAccountModel.update(userId, {
                cash_balance: parseFloat(cash_balance),
                position_value: parseFloat(position_value),
                frozen_funds: frozen_funds ? parseFloat(frozen_funds) : 0
            });

            console.log(`✅ 用户 ${userId} 更新资金账户: 现金 ${cash_balance}, 持仓 ${position_value}`);

            res.json({
                success: true,
                message: '资金账户更新成功',
                updated_at: result.updated_at
            });

        } catch (error) {
            console.error('更新资金账户错误:', error);
            res.status(500).json({
                success: false,
                error: '更新资金账户失败: ' + error.message
            });
        }
    });

    // 添加资金流水记录
    router.post('/transactions', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                transaction_type, amount, transaction_date,
                stock_code, stock_name, notes
            } = req.body;

            // 验证必填字段
            if (!transaction_type || !amount || !transaction_date) {
                return res.status(400).json({
                    success: false,
                    error: '交易类型、金额和日期是必填的'
                });
            }

            // 验证交易类型
            const validTypes = ['deposit', 'withdrawal', 'dividend', 'buy', 'sell', 'fee'];
            if (!validTypes.includes(transaction_type)) {
                return res.status(400).json({
                    success: false,
                    error: '交易类型无效'
                });
            }

            // 获取当前账户余额
            const account = await fundAccountModel.getOrCreate(userId);
            const balance_before = account.cash_balance;

            // 计算新余额
            let balance_after = balance_before;
            const amt = parseFloat(amount);

            if (transaction_type === 'deposit' || transaction_type === 'dividend') {
                balance_after = balance_before + amt;
            } else if (transaction_type === 'withdrawal' || transaction_type === 'buy' || transaction_type === 'fee') {
                balance_after = balance_before - amt;
            } else if (transaction_type === 'sell') {
                balance_after = balance_before + amt;
            }

            // 添加流水记录
            const result = await fundTransactionModel.add(userId, {
                transaction_type,
                amount: amt,
                balance_before,
                balance_after,
                transaction_date,
                stock_code,
                stock_name,
                notes
            });

            // 更新账户余额
            await fundAccountModel.update(userId, {
                cash_balance: balance_after,
                position_value: account.position_value,
                frozen_funds: account.frozen_funds
            });

            console.log(`✅ 用户 ${userId} 添加资金流水: ${transaction_type} ${amt}`);

            res.json({
                success: true,
                message: '资金流水添加成功',
                data: {
                    id: result.id,
                    transaction_type,
                    amount: amt,
                    balance_after,
                    created_at: result.created_at
                }
            });

        } catch (error) {
            console.error('添加资金流水错误:', error);
            res.status(500).json({
                success: false,
                error: '添加资金流水失败: ' + error.message
            });
        }
    });

    // 获取资金流水记录
    router.get('/transactions', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                transaction_type,
                start_date,
                end_date,
                limit,
                offset
            } = req.query;

            const transactions = await fundTransactionModel.findByUserId(userId, {
                transaction_type,
                start_date,
                end_date,
                limit: limit ? parseInt(limit) : 100,
                offset: offset ? parseInt(offset) : 0
            });

            res.json({
                success: true,
                data: transactions,
                count: transactions.length
            });

        } catch (error) {
            console.error('获取资金流水错误:', error);
            res.status(500).json({
                success: false,
                error: '获取资金流水失败'
            });
        }
    });

    // 删除资金流水记录
    router.delete('/transactions/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const transactionId = parseInt(req.params.id);

            const result = await fundTransactionModel.delete(transactionId);

            console.log(`✅ 用户 ${userId} 删除资金流水 ID: ${transactionId}`);

            res.json({
                success: true,
                message: '资金流水删除成功',
                deletedCount: result.changes
            });

        } catch (error) {
            console.error('删除资金流水错误:', error);
            res.status(500).json({
                success: false,
                error: '删除资金流水失败'
            });
        }
    });

    // 获取资金流水统计
    router.get('/transactions/stats', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const days = req.query.days ? parseInt(req.query.days) : 30;

            const stats = await fundTransactionModel.getStatsByType(userId, days);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('获取资金流水统计错误:', error);
            res.status(500).json({
                success: false,
                error: '获取资金流水统计失败'
            });
        }
    });

    // 获取资金变化趋势
    router.get('/trend', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const days = req.query.days ? parseInt(req.query.days) : 30;

            const trend = await fundTransactionModel.getTrend(userId, days);

            res.json({
                success: true,
                data: trend
            });

        } catch (error) {
            console.error('获取资金变化趋势错误:', error);
            res.status(500).json({
                success: false,
                error: '获取资金变化趋势失败'
            });
        }
    });

    // 获取账户统计信息
    router.get('/account/statistics', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const days = req.query.days ? parseInt(req.query.days) : 30;

            const account = await fundAccountModel.getOrCreate(userId);
            const statistics = await fundAccountModel.getStatistics(userId, days);

            res.json({
                success: true,
                data: {
                    account,
                    statistics
                }
            });

        } catch (error) {
            console.error('获取账户统计信息错误:', error);
            res.status(500).json({
                success: false,
                error: '获取账户统计信息失败'
            });
        }
    });

    // 同步持仓市值到资金账户
    router.post('/sync-position-value', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;

            // 获取用户所有持仓
            const positions = await positionModel.findByUserId(userId);

            // 计算总持仓市值
            const position_value = positions.reduce((sum, pos) => {
                return sum + parseFloat(pos.marketValue || 0);
            }, 0);

            // 获取当前账户信息
            const account = await fundAccountModel.getOrCreate(userId);

            // 更新持仓市值
            await fundAccountModel.update(userId, {
                cash_balance: account.cash_balance,
                position_value: position_value,
                frozen_funds: account.frozen_funds
            });

            console.log(`✅ 用户 ${userId} 同步持仓市值: ${position_value}`);

            res.json({
                success: true,
                message: '持仓市值同步成功',
                position_value
            });

        } catch (error) {
            console.error('同步持仓市值错误:', error);
            res.status(500).json({
                success: false,
                error: '同步持仓市值失败: ' + error.message
            });
        }
    });

    return router;
};
