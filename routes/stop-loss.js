// ==================== 止盈止损管理路由 ====================
const express = require('express');
const { db } = require('../database/connection');

module.exports = function(authenticateToken) {
    const router = express.Router();

    // ==================== 获取用户所有止盈止损设置 ====================
    router.get('/', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;

            const settings = db.prepare(`
                SELECT * FROM stop_loss_settings
                WHERE user_id = ? AND status = 'active'
                ORDER BY created_at DESC
            `).all(userId);

            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('❌ 获取止盈止损设置失败:', error);
            res.status(500).json({
                success: false,
                error: '获取止盈止损设置失败',
                message: error.message
            });
        }
    });

    // ==================== 获取单个股票的止盈止损设置 ====================
    router.get('/:stockCode', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const { stockCode } = req.params;

            const setting = db.prepare(`
                SELECT * FROM stop_loss_settings
                WHERE user_id = ? AND stock_code = ? AND status = 'active'
            `).get(userId, stockCode);

            if (!setting) {
                return res.json({
                    success: true,
                    data: null
                });
            }

            res.json({
                success: true,
                data: setting
            });
        } catch (error) {
            console.error('❌ 获取止盈止损设置失败:', error);
            res.status(500).json({
                success: false,
                error: '获取止盈止损设置失败',
                message: error.message
            });
        }
    });

    // ==================== 创建或更新止盈止损设置 ====================
    router.post('/', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const {
                stock_code,
                stock_name,
                cost_price,
                strategy_type,
                stop_loss_percent,
                stop_profit_percent,
                enable_trailing_stop,
                trailing_stop_trigger,
                enable_breakeven_stop,
                breakeven_trigger_percent,
                time_based_stop_days,
                tiered_profit_taking,
                max_loss_amount,
                target_profit_amount,
                alert_enabled
            } = req.body;

            // 验证必填字段
            if (!stock_code || !stock_name || !cost_price) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必填字段'
                });
            }

            const now = new Date().toISOString();

            // 计算止损价和止盈价
            const stopLossPrice = cost_price * (1 + stop_loss_percent / 100);
            const stopProfitPrice = cost_price * (1 + stop_profit_percent / 100);

            // 检查是否已存在
            const existing = db.prepare(`
                SELECT id FROM stop_loss_settings
                WHERE user_id = ? AND stock_code = ?
            `).get(userId, stock_code);

            if (existing) {
                // 更新现有设置
                db.prepare(`
                    UPDATE stop_loss_settings
                    SET stock_name = ?,
                        cost_price = ?,
                        strategy_type = ?,
                        stop_loss_price = ?,
                        stop_loss_percent = ?,
                        stop_profit_price = ?,
                        stop_profit_percent = ?,
                        enable_trailing_stop = ?,
                        trailing_stop_trigger = ?,
                        enable_breakeven_stop = ?,
                        breakeven_trigger_percent = ?,
                        time_based_stop_days = ?,
                        tiered_profit_taking = ?,
                        max_loss_amount = ?,
                        target_profit_amount = ?,
                        alert_enabled = ?,
                        updated_at = ?
                    WHERE user_id = ? AND stock_code = ?
                `).run(
                    stock_name,
                    cost_price,
                    strategy_type || 'basic',
                    stopLossPrice,
                    stop_loss_percent,
                    stopProfitPrice,
                    stop_profit_percent,
                    enable_trailing_stop ? 1 : 0,
                    trailing_stop_trigger || 5.0,
                    enable_breakeven_stop ? 1 : 0,
                    breakeven_trigger_percent || 3.0,
                    time_based_stop_days || 0,
                    tiered_profit_taking,
                    max_loss_amount || 0,
                    target_profit_amount || 0,
                    alert_enabled ? 1 : 0,
                    now,
                    userId,
                    stock_code
                );

                console.log(`✅ 更新止盈止损设置: ${stock_code} (${strategy_type || 'basic'})`);
            } else {
                // 创建新设置
                db.prepare(`
                    INSERT INTO stop_loss_settings (
                        user_id, stock_code, stock_name, cost_price,
                        strategy_type,
                        stop_loss_price, stop_loss_percent,
                        stop_profit_price, stop_profit_percent,
                        enable_trailing_stop, trailing_stop_trigger,
                        enable_breakeven_stop, breakeven_trigger_percent,
                        time_based_stop_days, tiered_profit_taking,
                        max_loss_amount, target_profit_amount,
                        alert_enabled, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
                `).run(
                    userId,
                    stock_code,
                    stock_name,
                    cost_price,
                    strategy_type || 'basic',
                    stopLossPrice,
                    stop_loss_percent || -5.0,
                    stopProfitPrice,
                    stop_profit_percent || 10.0,
                    enable_trailing_stop ? 1 : 0,
                    trailing_stop_trigger || 5.0,
                    enable_breakeven_stop ? 1 : 0,
                    breakeven_trigger_percent || 3.0,
                    time_based_stop_days || 0,
                    tiered_profit_taking,
                    max_loss_amount || 0,
                    target_profit_amount || 0,
                    alert_enabled !== false ? 1 : 0,
                    now,
                    now
                );

                console.log(`✅ 创建止盈止损设置: ${stock_code} (${strategy_type || 'basic'})`);
            }

            res.json({
                success: true,
                message: '止盈止损设置已保存'
            });
        } catch (error) {
            console.error('❌ 保存止盈止损设置失败:', error);
            res.status(500).json({
                success: false,
                error: '保存止盈止损设置失败',
                message: error.message
            });
        }
    });

    // ==================== 删除止盈止损设置 ====================
    router.delete('/:stockCode', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const { stockCode } = req.params;

            db.prepare(`
                UPDATE stop_loss_settings
                SET status = 'deleted', updated_at = ?
                WHERE user_id = ? AND stock_code = ?
            `).run(new Date().toISOString(), userId, stockCode);

            console.log(`✅ 删除止盈止损设置: ${stockCode}`);

            res.json({
                success: true,
                message: '止盈止损设置已删除'
            });
        } catch (error) {
            console.error('❌ 删除止盈止损设置失败:', error);
            res.status(500).json({
                success: false,
                error: '删除止盈止损设置失败',
                message: error.message
            });
        }
    });

    // ==================== 批量创建止盈止损设置（基于当前持仓） ====================
    router.post('/batch/from-positions', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                stop_loss_percent = -5.0,
                stop_profit_percent = 10.0,
                enable_trailing_stop = false,
                alert_enabled = true
            } = req.body;

            // 获取用户当前持仓
            const positions = db.prepare(`
                SELECT stock_code, stock_name, cost_price
                FROM positions
                WHERE user_id = ?
            `).all(userId);

            if (positions.length === 0) {
                return res.json({
                    success: true,
                    message: '当前没有持仓',
                    count: 0
                });
            }

            const now = new Date().toISOString();
            let created = 0;
            let updated = 0;

            for (const position of positions) {
                const stopLossPrice = position.cost_price * (1 + stop_loss_percent / 100);
                const stopProfitPrice = position.cost_price * (1 + stop_profit_percent / 100);

                // 检查是否已存在
                const existing = db.prepare(`
                    SELECT id FROM stop_loss_settings
                    WHERE user_id = ? AND stock_code = ?
                `).get(userId, position.stock_code);

                if (existing) {
                    // 更新
                    db.prepare(`
                        UPDATE stop_loss_settings
                        SET cost_price = ?,
                            stop_loss_price = ?,
                            stop_loss_percent = ?,
                            stop_profit_price = ?,
                            stop_profit_percent = ?,
                            enable_trailing_stop = ?,
                            alert_enabled = ?,
                            status = 'active',
                            updated_at = ?
                        WHERE user_id = ? AND stock_code = ?
                    `).run(
                        position.cost_price,
                        stopLossPrice,
                        stop_loss_percent,
                        stopProfitPrice,
                        stop_profit_percent,
                        enable_trailing_stop ? 1 : 0,
                        alert_enabled ? 1 : 0,
                        now,
                        userId,
                        position.stock_code
                    );
                    updated++;
                } else {
                    // 创建
                    db.prepare(`
                        INSERT INTO stop_loss_settings (
                            user_id, stock_code, stock_name, cost_price,
                            stop_loss_price, stop_loss_percent,
                            stop_profit_price, stop_profit_percent,
                            enable_trailing_stop, trailing_stop_trigger,
                            alert_enabled, status, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 5.0, ?, 'active', ?, ?)
                    `).run(
                        userId,
                        position.stock_code,
                        position.stock_name,
                        position.cost_price,
                        stopLossPrice,
                        stop_loss_percent,
                        stopProfitPrice,
                        stop_profit_percent,
                        enable_trailing_stop ? 1 : 0,
                        alert_enabled ? 1 : 0,
                        now,
                        now
                    );
                    created++;
                }
            }

            console.log(`✅ 批量创建止盈止损设置: 新增${created}个, 更新${updated}个`);

            res.json({
                success: true,
                message: `已为${positions.length}个持仓设置止盈止损`,
                count: positions.length,
                created,
                updated
            });
        } catch (error) {
            console.error('❌ 批量创建止盈止损设置失败:', error);
            res.status(500).json({
                success: false,
                error: '批量创建止盈止损设置失败',
                message: error.message
            });
        }
    });

    return router;
};
