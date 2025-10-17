const express = require('express');
const { tradingLogModel } = require('../database');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 获取用户的所有交易日志
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;

            const logs = await tradingLogModel.findByUserId(userId, limit, offset);

            res.json({
                success: true,
                data: logs,
                count: logs.length
            });

        } catch (error) {
            console.error('获取交易日志错误:', error);
            res.status(500).json({
                success: false,
                error: '获取交易日志失败'
            });
        }
    });

    // 根据ID获取单个日志
    router.get('/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const logId = parseInt(req.params.id);

            const log = await tradingLogModel.findById(logId);

            if (!log) {
                return res.status(404).json({
                    success: false,
                    error: '日志不存在'
                });
            }

            if (log.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    error: '无权访问此日志'
                });
            }

            res.json({
                success: true,
                data: log
            });

        } catch (error) {
            console.error('获取日志详情错误:', error);
            res.status(500).json({
                success: false,
                error: '获取日志详情失败'
            });
        }
    });

    // 根据日期获取日志
    router.get('/date/:date', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const logDate = req.params.date;

            const logs = await tradingLogModel.findByDate(userId, logDate);

            res.json({
                success: true,
                data: logs,
                count: logs.length
            });

        } catch (error) {
            console.error('获取日期日志错误:', error);
            res.status(500).json({
                success: false,
                error: '获取日期日志失败'
            });
        }
    });

    // 根据类型获取日志
    router.get('/type/:type', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const logType = req.params.type;

            const logs = await tradingLogModel.findByType(userId, logType);

            res.json({
                success: true,
                data: logs,
                count: logs.length
            });

        } catch (error) {
            console.error('获取类型日志错误:', error);
            res.status(500).json({
                success: false,
                error: '获取类型日志失败'
            });
        }
    });

    // 搜索日志
    router.get('/search/:keyword', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const keyword = req.params.keyword;

            const logs = await tradingLogModel.search(userId, keyword);

            res.json({
                success: true,
                data: logs,
                count: logs.length
            });

        } catch (error) {
            console.error('搜索日志错误:', error);
            res.status(500).json({
                success: false,
                error: '搜索日志失败'
            });
        }
    });

    // 获取重要日志
    router.get('/important/list', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const logs = await tradingLogModel.findImportant(userId);

            res.json({
                success: true,
                data: logs,
                count: logs.length
            });

        } catch (error) {
            console.error('获取重要日志错误:', error);
            res.status(500).json({
                success: false,
                error: '获取重要日志失败'
            });
        }
    });

    // 获取统计信息
    router.get('/statistics/summary', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const stats = await tradingLogModel.getStatistics(userId);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('获取统计信息错误:', error);
            res.status(500).json({
                success: false,
                error: '获取统计信息失败'
            });
        }
    });

    // 添加交易日志
    router.post('/', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                logDate,
                logType,
                title,
                content,
                tags,
                relatedStockCodes,
                sentiment,
                profitLoss,
                isImportant
            } = req.body;

            // 验证必填字段
            if (!logDate || !logType || !title || !content) {
                return res.status(400).json({
                    success: false,
                    error: '日期、类型、标题和内容是必填的'
                });
            }

            // 验证日志类型
            const validTypes = ['daily_recap', 'decision_note', 'insight', 'error_analysis', 'success_case'];
            if (!validTypes.includes(logType)) {
                return res.status(400).json({
                    success: false,
                    error: '无效的日志类型'
                });
            }

            // 验证情绪类型（如果提供）
            if (sentiment && !['good', 'neutral', 'bad'].includes(sentiment)) {
                return res.status(400).json({
                    success: false,
                    error: '无效的情绪类型'
                });
            }

            const logData = {
                logDate,
                logType,
                title,
                content,
                tags: tags || null,
                relatedStockCodes: relatedStockCodes || null,
                sentiment: sentiment || 'neutral',
                profitLoss: profitLoss || null,
                isImportant: isImportant ? 1 : 0
            };

            const result = await tradingLogModel.add(userId, logData);

            console.log(`✅ 用户 ${userId} 添加交易日志: ${title}`);

            res.json({
                success: true,
                message: '交易日志添加成功',
                data: {
                    id: result.id,
                    ...logData,
                    created_at: result.created_at
                }
            });

        } catch (error) {
            console.error('添加交易日志错误:', error);
            res.status(500).json({
                success: false,
                error: '添加交易日志失败: ' + error.message
            });
        }
    });

    // 更新交易日志
    router.put('/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const logId = parseInt(req.params.id);

            // 验证记录所有权
            const existingLog = await tradingLogModel.findById(logId);
            if (!existingLog) {
                return res.status(404).json({
                    success: false,
                    error: '日志不存在'
                });
            }

            if (existingLog.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    error: '无权修改此日志'
                });
            }

            const {
                logDate,
                logType,
                title,
                content,
                tags,
                relatedStockCodes,
                sentiment,
                profitLoss,
                isImportant
            } = req.body;

            // 验证必填字段
            if (!logDate || !logType || !title || !content) {
                return res.status(400).json({
                    success: false,
                    error: '日期、类型、标题和内容是必填的'
                });
            }

            const logData = {
                logDate,
                logType,
                title,
                content,
                tags: tags || null,
                relatedStockCodes: relatedStockCodes || null,
                sentiment: sentiment || 'neutral',
                profitLoss: profitLoss || null,
                isImportant: isImportant ? 1 : 0
            };

            const result = await tradingLogModel.update(logId, logData);

            console.log(`✅ 用户 ${userId} 更新交易日志 ID: ${logId}`);

            res.json({
                success: true,
                message: '交易日志更新成功',
                updatedCount: result.changes
            });

        } catch (error) {
            console.error('更新交易日志错误:', error);
            res.status(500).json({
                success: false,
                error: '更新交易日志失败'
            });
        }
    });

    // 删除交易日志
    router.delete('/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const logId = parseInt(req.params.id);

            // 验证记录所有权
            const log = await tradingLogModel.findById(logId);
            if (!log) {
                return res.status(404).json({
                    success: false,
                    error: '日志不存在'
                });
            }

            if (log.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    error: '无权删除此日志'
                });
            }

            const result = await tradingLogModel.delete(logId);

            console.log(`✅ 用户 ${userId} 删除交易日志 ID: ${logId}`);

            res.json({
                success: true,
                message: '交易日志删除成功',
                deletedCount: result.changes
            });

        } catch (error) {
            console.error('删除交易日志错误:', error);
            res.status(500).json({
                success: false,
                error: '删除交易日志失败'
            });
        }
    });

    return router;
};
