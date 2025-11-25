const express = require('express');
const router = express.Router();
const { db } = require('../database/connection');

module.exports = (authenticateToken) => {
    // 获取用户的短线池股票
    router.get('/', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const {
                status = null,
                sort_by = 'priority',
                sort_order = 'DESC'
            } = req.query;

            let whereConditions = ['user_id = ?'];
            let params = [userId];

            if (status) {
                whereConditions.push('status = ?');
                params.push(status);
            }

            const whereClause = whereConditions.join(' AND ');
            const validSortColumns = ['priority', 'created_at', 'updated_at', 'stock_code'];
            const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'priority';
            const sortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            const stocks = db.prepare(`
                SELECT * FROM short_term_pool
                WHERE ${whereClause}
                ORDER BY ${sortColumn} ${sortOrder}
            `).all(...params);

            res.json({
                success: true,
                data: stocks
            });
        } catch (error) {
            console.error('获取短线池失败:', error);
            res.status(500).json({
                success: false,
                error: '获取短线池失败'
            });
        }
    });

    // 添加股票到短线池
    router.post('/', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const {
                stock_code,
                stock_name,
                entry_price = null,
                target_price = null,
                stop_loss_price = null,
                tags = null,
                reason = null,
                priority = 0,
                stock_type = null,
                hot_money_name = null,
                board_shape = null
            } = req.body;

            if (!stock_code || !stock_name) {
                return res.status(400).json({
                    success: false,
                    error: '股票代码和名称不能为空'
                });
            }

            if (!tags || !tags.trim()) {
                return res.status(400).json({
                    success: false,
                    error: '请填写相关概念或行业'
                });
            }

            if (!reason || !reason.trim()) {
                return res.status(400).json({
                    success: false,
                    error: '请填写加入短线池的理由'
                });
            }

            const now = new Date().toISOString();

            const result = db.prepare(`
                INSERT OR REPLACE INTO short_term_pool
                (user_id, stock_code, stock_name, entry_price, target_price, stop_loss_price, tags, reason, priority, stock_type, hot_money_name, board_shape, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    COALESCE((SELECT status FROM short_term_pool WHERE user_id = ? AND stock_code = ?), 'watching'),
                    COALESCE((SELECT created_at FROM short_term_pool WHERE user_id = ? AND stock_code = ?), ?),
                    ?)
            `).run(
                userId, stock_code, stock_name, entry_price, target_price, stop_loss_price,
                tags, reason, priority, stock_type, hot_money_name, board_shape,
                userId, stock_code,
                userId, stock_code, now,
                now
            );

            res.json({
                success: true,
                id: result.lastInsertRowid
            });
        } catch (error) {
            console.error('添加到短线池失败:', error);
            res.status(500).json({
                success: false,
                error: '添加到短线池失败'
            });
        }
    });

    // 更新短线池股票信息
    router.patch('/:stockCode', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const stockCode = req.params.stockCode;
            const {
                entry_price,
                target_price,
                stop_loss_price,
                tags,
                reason,
                priority,
                status,
                stock_type,
                hot_money_name,
                board_shape
            } = req.body;

            // 验证必填字段
            if (tags !== undefined && (!tags || !tags.trim())) {
                return res.status(400).json({
                    success: false,
                    error: '相关概念或行业不能为空'
                });
            }

            if (reason !== undefined && (!reason || !reason.trim())) {
                return res.status(400).json({
                    success: false,
                    error: '加入理由不能为空'
                });
            }

            const now = new Date().toISOString();
            const updates = [];
            const values = [];

            if (entry_price !== undefined) {
                updates.push('entry_price = ?');
                values.push(entry_price);
            }
            if (target_price !== undefined) {
                updates.push('target_price = ?');
                values.push(target_price);
            }
            if (stop_loss_price !== undefined) {
                updates.push('stop_loss_price = ?');
                values.push(stop_loss_price);
            }
            if (tags !== undefined) {
                updates.push('tags = ?');
                values.push(tags);
            }
            if (reason !== undefined) {
                updates.push('reason = ?');
                values.push(reason);
            }
            if (priority !== undefined) {
                updates.push('priority = ?');
                values.push(priority);
            }
            if (status !== undefined) {
                updates.push('status = ?');
                values.push(status);
            }
            if (stock_type !== undefined) {
                updates.push('stock_type = ?');
                values.push(stock_type);
            }
            if (hot_money_name !== undefined) {
                updates.push('hot_money_name = ?');
                values.push(hot_money_name);
            }
            if (board_shape !== undefined) {
                updates.push('board_shape = ?');
                values.push(board_shape);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '没有需要更新的字段'
                });
            }

            updates.push('updated_at = ?');
            values.push(now);

            values.push(userId, stockCode);

            const result = db.prepare(`
                UPDATE short_term_pool
                SET ${updates.join(', ')}
                WHERE user_id = ? AND stock_code = ?
            `).run(...values);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '股票不存在'
                });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('更新短线池股票失败:', error);
            res.status(500).json({
                success: false,
                error: '更新短线池股票失败'
            });
        }
    });

    // 从短线池删除股票
    router.delete('/:stockCode', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const stockCode = req.params.stockCode;

            const result = db.prepare(`
                DELETE FROM short_term_pool
                WHERE user_id = ? AND stock_code = ?
            `).run(userId, stockCode);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '股票不存在'
                });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('删除短线池股票失败:', error);
            res.status(500).json({
                success: false,
                error: '删除短线池股票失败'
            });
        }
    });

    // 批量更新状态
    router.patch('/batch/status', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const { stock_codes, status } = req.body;

            if (!Array.isArray(stock_codes) || stock_codes.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '股票代码列表不能为空'
                });
            }

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: '状态不能为空'
                });
            }

            const now = new Date().toISOString();
            const placeholders = stock_codes.map(() => '?').join(',');

            const result = db.prepare(`
                UPDATE short_term_pool
                SET status = ?, updated_at = ?
                WHERE user_id = ? AND stock_code IN (${placeholders})
            `).run(status, now, userId, ...stock_codes);

            res.json({
                success: true,
                updated: result.changes
            });
        } catch (error) {
            console.error('批量更新状态失败:', error);
            res.status(500).json({
                success: false,
                error: '批量更新状态失败'
            });
        }
    });

    return router;
};
