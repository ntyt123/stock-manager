const express = require('express');
const router = express.Router();
const { db } = require('../database/connection');

module.exports = (authenticateToken) => {
    // 获取用户的所有价格告警（支持分页和筛选）
    router.get('/', authenticateToken, (req, res) => {
        try {
            const userId = req.user.userId;
            const {
                page = 1,
                limit = 50,
                unread_only = 'false',
                stock_code = null,
                alert_type = null
            } = req.query;

            const offset = (page - 1) * limit;

            // 构建查询条件
            let whereConditions = ['user_id = ?'];
            let params = [userId];

            if (unread_only === 'true') {
                whereConditions.push('is_read = 0');
            }

            if (stock_code) {
                whereConditions.push('stock_code = ?');
                params.push(stock_code);
            }

            if (alert_type) {
                whereConditions.push('alert_type = ?');
                params.push(alert_type);
            }

            const whereClause = whereConditions.join(' AND ');

            // 获取总数
            const countResult = db.prepare(`
                SELECT COUNT(*) as total FROM price_alerts
                WHERE ${whereClause}
            `).get(...params);

            // 获取告警列表
            const alerts = db.prepare(`
                SELECT * FROM price_alerts
                WHERE ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `).all(...params, limit, offset);

            res.json({
                success: true,
                data: alerts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult.total,
                    pages: Math.ceil(countResult.total / limit)
                }
            });
        } catch (error) {
            console.error('获取价格告警失败:', error);
            res.status(500).json({
                success: false,
                error: '获取价格告警失败'
            });
        }
    });

    // 获取未读告警数量
    router.get('/unread-count', authenticateToken, (req, res) => {
        try {
            const userId = req.user.userId;

            const result = db.prepare(`
                SELECT COUNT(*) as count FROM price_alerts
                WHERE user_id = ? AND is_read = 0
            `).get(userId);

            res.json({
                success: true,
                count: result.count
            });
        } catch (error) {
            console.error('获取未读告警数量失败:', error);
            res.status(500).json({
                success: false,
                error: '获取未读告警数量失败'
            });
        }
    });

    // 标记告警为已读
    router.patch('/:id/read', authenticateToken, (req, res) => {
        try {
            const userId = req.user.userId;
            const alertId = req.params.id;

            const result = db.prepare(`
                UPDATE price_alerts
                SET is_read = 1
                WHERE id = ? AND user_id = ?
            `).run(alertId, userId);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '告警不存在'
                });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('标记告警已读失败:', error);
            res.status(500).json({
                success: false,
                error: '标记告警已读失败'
            });
        }
    });

    // 标记所有告警为已读
    router.patch('/read-all', authenticateToken, (req, res) => {
        try {
            const userId = req.user.userId;

            db.prepare(`
                UPDATE price_alerts
                SET is_read = 1
                WHERE user_id = ? AND is_read = 0
            `).run(userId);

            res.json({ success: true });
        } catch (error) {
            console.error('标记所有告警已读失败:', error);
            res.status(500).json({
                success: false,
                error: '标记所有告警已读失败'
            });
        }
    });

    // 删除告警
    router.delete('/:id', authenticateToken, (req, res) => {
        try {
            const userId = req.user.userId;
            const alertId = req.params.id;

            const result = db.prepare(`
                DELETE FROM price_alerts
                WHERE id = ? AND user_id = ?
            `).run(alertId, userId);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '告警不存在'
                });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('删除告警失败:', error);
            res.status(500).json({
                success: false,
                error: '删除告警失败'
            });
        }
    });

    // 清空所有已读告警
    router.delete('/clear-read', authenticateToken, (req, res) => {
        try {
            const userId = req.user.userId;

            db.prepare(`
                DELETE FROM price_alerts
                WHERE user_id = ? AND is_read = 1
            `).run(userId);

            res.json({ success: true });
        } catch (error) {
            console.error('清空已读告警失败:', error);
            res.status(500).json({
                success: false,
                error: '清空已读告警失败'
            });
        }
    });

    return router;
};
