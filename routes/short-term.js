const express = require('express');
const router = express.Router();
const { db } = require('../database/connection');

module.exports = (authenticateToken) => {
    // ==================== 复盘笔记 ====================

    // 获取复盘笔记
    router.get('/reviews', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const { date } = req.query;

            if (date) {
                const review = db.prepare(`
                    SELECT * FROM review_notes WHERE user_id = ? AND review_date = ?
                `).get(userId, date);
                res.json({ success: true, data: review });
            } else {
                const reviews = db.prepare(`
                    SELECT * FROM review_notes WHERE user_id = ?
                    ORDER BY review_date DESC LIMIT 30
                `).all(userId);
                res.json({ success: true, data: reviews });
            }
        } catch (error) {
            console.error('获取复盘笔记失败:', error);
            res.status(500).json({ success: false, error: '获取复盘笔记失败' });
        }
    });

    // 保存复盘笔记
    router.post('/reviews', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const {
                review_date, market_summary, today_operations,
                profit_loss, lessons_learned, tomorrow_plan, mood_score
            } = req.body;

            const now = new Date().toISOString();

            db.prepare(`
                INSERT OR REPLACE INTO review_notes
                (user_id, review_date, market_summary, today_operations, profit_loss, lessons_learned, tomorrow_plan, mood_score, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                    COALESCE((SELECT created_at FROM review_notes WHERE user_id = ? AND review_date = ?), ?),
                    ?)
            `).run(userId, review_date, market_summary, today_operations, profit_loss, lessons_learned, tomorrow_plan, mood_score, userId, review_date, now, now);

            res.json({ success: true });
        } catch (error) {
            console.error('保存复盘笔记失败:', error);
            res.status(500).json({ success: false, error: '保存复盘笔记失败' });
        }
    });

    // ==================== 数据看板 ====================

    // 获取短线交易统计数据
    router.get('/dashboard', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const { days = 30 } = req.query;

            // 获取交易日志统计
            const logStats = db.prepare(`
                SELECT
                    COUNT(*) as total_logs,
                    SUM(CASE WHEN log_type = '买入' THEN 1 ELSE 0 END) as buy_logs,
                    SUM(CASE WHEN log_type = '卖出' THEN 1 ELSE 0 END) as sell_logs,
                    COALESCE(SUM(profit_loss), 0) as total_profit
                FROM trading_logs
                WHERE user_id = ? AND created_at >= DATE('now', '-' || ? || ' days')
            `).get(userId, days);

            // 计划执行率
            const planStats = db.prepare(`
                SELECT
                    COUNT(*) as total_plans,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_plans,
                    SUM(CASE WHEN result = 'success' THEN 1 ELSE 0 END) as success_plans
                FROM trading_plans_short
                WHERE user_id = ? AND plan_date >= DATE('now', '-' || ? || ' days')
            `).get(userId, days);

            // 最近盈亏趋势
            const profitTrend = db.prepare(`
                SELECT
                    DATE(created_at) as date,
                    COALESCE(SUM(profit_loss), 0) as daily_profit
                FROM trading_logs
                WHERE user_id = ? AND created_at >= DATE('now', '-' || ? || ' days')
                GROUP BY DATE(created_at)
                ORDER BY date
            `).all(userId, days);

            // 股票池统计
            const poolStats = db.prepare(`
                SELECT
                    COUNT(*) as total_stocks,
                    SUM(CASE WHEN status = 'watching' THEN 1 ELSE 0 END) as watching_stocks
                FROM short_term_pool
                WHERE user_id = ?
            `).get(userId);

            // 复盘笔记统计
            const reviewStats = db.prepare(`
                SELECT
                    COUNT(*) as total_reviews,
                    AVG(mood_score) as avg_mood_score
                FROM review_notes
                WHERE user_id = ? AND review_date >= DATE('now', '-' || ? || ' days')
            `).get(userId, days);

            res.json({
                success: true,
                data: {
                    logStats,
                    planStats,
                    profitTrend,
                    poolStats,
                    reviewStats,
                    planExecuteRate: planStats.total_plans > 0 ? (planStats.completed_plans / planStats.total_plans * 100).toFixed(1) : 0
                }
            });
        } catch (error) {
            console.error('获取数据看板失败:', error);
            res.status(500).json({ success: false, error: '获取数据看板失败' });
        }
    });

    // ==================== 三日选股法 ====================

    // 检测股票是否符合选股标准
    function checkCriteria(stockData, criteria) {
        const warnings = [];
        const checkResult = {};

        if (!criteria.enable_check) {
            return { passed: true, warnings: [], checkResult: {} };
        }

        const volumeRatio = parseFloat(stockData.volumeRatio) || 0;
        const turnoverRate = parseFloat(stockData.turnoverRate) || 0;
        const changePercent = parseFloat(stockData.changePercent) || 0;
        const amplitude = parseFloat(stockData.amplitude) || 0;
        const currentPrice = parseFloat(stockData.currentPrice) || 0;

        // 检查量比
        if (volumeRatio < criteria.volume_ratio_min || volumeRatio > criteria.volume_ratio_max) {
            warnings.push(`量比${volumeRatio.toFixed(2)}不在范围[${criteria.volume_ratio_min}, ${criteria.volume_ratio_max}]`);
            checkResult.volumeRatio = false;
        } else {
            checkResult.volumeRatio = true;
        }

        // 检查换手率
        if (turnoverRate < criteria.turnover_rate_min || turnoverRate > criteria.turnover_rate_max) {
            warnings.push(`换手率${turnoverRate.toFixed(2)}%不在范围[${criteria.turnover_rate_min}%, ${criteria.turnover_rate_max}%]`);
            checkResult.turnoverRate = false;
        } else {
            checkResult.turnoverRate = true;
        }

        // 检查涨跌幅
        if (changePercent < criteria.change_percent_min || changePercent > criteria.change_percent_max) {
            warnings.push(`涨跌幅${changePercent.toFixed(2)}%不在范围[${criteria.change_percent_min}%, ${criteria.change_percent_max}%]`);
            checkResult.changePercent = false;
        } else {
            checkResult.changePercent = true;
        }

        // 检查振幅（如果设置了）
        if (criteria.amplitude_min > 0 || criteria.amplitude_max < 100) {
            if (amplitude < criteria.amplitude_min || amplitude > criteria.amplitude_max) {
                warnings.push(`振幅${amplitude.toFixed(2)}%不在范围[${criteria.amplitude_min}%, ${criteria.amplitude_max}%]`);
                checkResult.amplitude = false;
            } else {
                checkResult.amplitude = true;
            }
        }

        // 检查价格（如果设置了）
        if (criteria.price_min > 0 || criteria.price_max < 999999) {
            if (currentPrice < criteria.price_min || currentPrice > criteria.price_max) {
                warnings.push(`价格¥${currentPrice.toFixed(2)}不在范围[¥${criteria.price_min}, ¥${criteria.price_max}]`);
                checkResult.price = false;
            } else {
                checkResult.price = true;
            }
        }

        return {
            passed: warnings.length === 0,
            warnings: warnings,
            checkResult: checkResult
        };
    }

    // 批量添加股票（三日选股法）
    router.post('/three-day/batch', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { stockCodes, notes } = req.body; // stockCodes 是字符串，可能包含逗号、空格、换行

            // 获取用户的选股标准配置
            let criteria = db.prepare(`
                SELECT * FROM stock_criteria_settings
                WHERE user_id = ? AND criteria_name = 'default'
            `).get(userId);

            // 如果没有配置，使用默认值
            if (!criteria) {
                criteria = {
                    volume_ratio_min: 1.5,
                    volume_ratio_max: 999,
                    turnover_rate_min: 3.0,
                    turnover_rate_max: 8.0,
                    change_percent_min: 3.0,
                    change_percent_max: 7.0,
                    amplitude_min: 0,
                    amplitude_max: 100,
                    price_min: 0,
                    price_max: 999999,
                    enable_check: 1
                };
            }

            // 解析股票代码（支持逗号、空格、换行分隔）
            const codes = stockCodes
                .replace(/[,\s\n\r]+/g, ',') // 统一替换为逗号
                .split(',')
                .map(code => code.trim())
                .filter(code => code.length > 0);

            if (codes.length === 0) {
                return res.status(400).json({ success: false, error: '请输入股票代码' });
            }

            const now = new Date().toISOString();
            const today = new Date().toISOString().split('T')[0];
            const addedStocks = [];
            const errors = [];

            // 获取股票信息并添加
            const axios = require('axios');
            for (const stockCode of codes) {
                try {
                    // 检查是否已存在（仅检查三日选股法）
                    const existing = db.prepare(`
                        SELECT id FROM short_term_pool
                        WHERE user_id = ? AND stock_code = ? AND selection_method = 'three_day'
                    `).get(userId, stockCode);

                    if (existing) {
                        errors.push({ code: stockCode, error: '已存在于三日选股法' });
                        continue;
                    }

                    // 获取股票信息和实时行情
                    let stockName = stockCode;
                    let currentPrice = 0;
                    let stockData = null;
                    let criteriaCheck = { passed: true, warnings: [], checkResult: {} };

                    try {
                        const response = await axios.get(`http://localhost:3000/api/stock/quote/${stockCode}`, {
                            headers: { 'Authorization': req.headers.authorization }
                        });
                        if (response.data.success) {
                            stockData = response.data.data;
                            stockName = stockData.stockName || stockCode;
                            currentPrice = stockData.currentPrice || 0;

                            // 检测是否符合选股标准
                            criteriaCheck = checkCriteria(stockData, criteria);
                        }
                    } catch (e) {
                        console.log(`无法获取 ${stockCode} 的信息，使用默认值`);
                    }

                    // 添加到数据库
                    const result = db.prepare(`
                        INSERT INTO short_term_pool (
                            user_id, stock_code, stock_name, status,
                            selection_method, day_status,
                            first_day_date, first_day_price,
                            selection_notes,
                            criteria_check_result, criteria_warnings,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, 'watching', 'three_day', 1, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        userId, stockCode, stockName, today, currentPrice,
                        notes || '',
                        JSON.stringify(criteriaCheck.checkResult),
                        criteriaCheck.warnings.join('; '),
                        now, now
                    );

                    addedStocks.push({
                        id: result.lastInsertRowid,
                        stockCode,
                        stockName,
                        firstDayPrice: currentPrice,
                        criteriaPassed: criteriaCheck.passed,
                        warnings: criteriaCheck.warnings
                    });
                } catch (error) {
                    console.error(`添加股票 ${stockCode} 失败:`, error);
                    errors.push({ code: stockCode, error: error.message });
                }
            }

            res.json({
                success: true,
                data: {
                    added: addedStocks,
                    errors: errors
                }
            });
        } catch (error) {
            console.error('批量添加股票失败:', error);
            res.status(500).json({ success: false, error: '批量添加股票失败' });
        }
    });

    // 获取三日选股法股票列表
    router.get('/three-day', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;

            const stocks = db.prepare(`
                SELECT * FROM short_term_pool
                WHERE user_id = ? AND selection_method = 'three_day'
                ORDER BY day_status ASC, created_at DESC
            `).all(userId);

            res.json({ success: true, data: stocks });
        } catch (error) {
            console.error('获取三日选股法股票失败:', error);
            res.status(500).json({ success: false, error: '获取股票列表失败' });
        }
    });

    // 更新股票状态（推进到下一天）
    router.put('/three-day/:id', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const stockId = req.params.id;
            const { action, price, notes } = req.body; // action: 'next_day' | 'archive' | 'delete'

            const stock = db.prepare(`
                SELECT * FROM short_term_pool
                WHERE id = ? AND user_id = ? AND selection_method = 'three_day'
            `).get(stockId, userId);

            if (!stock) {
                return res.status(404).json({ success: false, error: '股票不存在' });
            }

            const now = new Date().toISOString();
            const today = new Date().toISOString().split('T')[0];

            if (action === 'next_day') {
                // 推进到下一天
                if (stock.day_status === 1) {
                    db.prepare(`
                        UPDATE short_term_pool
                        SET day_status = 2,
                            second_day_date = ?,
                            second_day_price = ?,
                            selection_notes = ?,
                            updated_at = ?
                        WHERE id = ?
                    `).run(today, price || 0, notes || stock.selection_notes, now, stockId);
                } else if (stock.day_status === 2) {
                    db.prepare(`
                        UPDATE short_term_pool
                        SET day_status = 3,
                            third_day_date = ?,
                            third_day_price = ?,
                            selection_notes = ?,
                            updated_at = ?
                        WHERE id = ?
                    `).run(today, price || 0, notes || stock.selection_notes, now, stockId);
                }
            } else if (action === 'archive') {
                // 归档（标记为已完成）
                db.prepare(`
                    UPDATE short_term_pool
                    SET status = 'archived',
                        selection_notes = ?,
                        updated_at = ?
                    WHERE id = ?
                `).run(notes || stock.selection_notes, now, stockId);
            } else if (action === 'delete') {
                // 删除
                db.prepare(`
                    DELETE FROM short_term_pool WHERE id = ?
                `).run(stockId);
            }

            res.json({ success: true });
        } catch (error) {
            console.error('更新股票状态失败:', error);
            res.status(500).json({ success: false, error: '更新失败' });
        }
    });

    // 删除股票
    router.delete('/three-day/:id', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const stockId = req.params.id;

            db.prepare(`
                DELETE FROM short_term_pool
                WHERE id = ? AND user_id = ? AND selection_method = 'three_day'
            `).run(stockId, userId);

            res.json({ success: true });
        } catch (error) {
            console.error('删除股票失败:', error);
            res.status(500).json({ success: false, error: '删除失败' });
        }
    });

    // ==================== 选股标准配置 ====================

    // 获取选股标准配置
    router.get('/criteria-settings', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;

            let settings = db.prepare(`
                SELECT * FROM stock_criteria_settings
                WHERE user_id = ? AND criteria_name = 'default'
            `).get(userId);

            // 如果没有配置，创建默认配置
            if (!settings) {
                const now = new Date().toISOString();
                db.prepare(`
                    INSERT INTO stock_criteria_settings (
                        user_id, criteria_name,
                        volume_ratio_min, turnover_rate_min, turnover_rate_max,
                        change_percent_min, change_percent_max,
                        created_at, updated_at
                    ) VALUES (?, 'default', 1.5, 3.0, 8.0, 3.0, 7.0, ?, ?)
                `).run(userId, now, now);

                settings = db.prepare(`
                    SELECT * FROM stock_criteria_settings
                    WHERE user_id = ? AND criteria_name = 'default'
                `).get(userId);
            }

            res.json({ success: true, data: settings });
        } catch (error) {
            console.error('获取选股标准配置失败:', error);
            res.status(500).json({ success: false, error: '获取配置失败' });
        }
    });

    // 保存选股标准配置
    router.post('/criteria-settings', authenticateToken, (req, res) => {
        try {
            const userId = req.user.id;
            const {
                volume_ratio_min, volume_ratio_max,
                turnover_rate_min, turnover_rate_max,
                change_percent_min, change_percent_max,
                amplitude_min, amplitude_max,
                price_min, price_max,
                enable_check
            } = req.body;

            const now = new Date().toISOString();

            db.prepare(`
                INSERT OR REPLACE INTO stock_criteria_settings (
                    user_id, criteria_name,
                    volume_ratio_min, volume_ratio_max,
                    turnover_rate_min, turnover_rate_max,
                    change_percent_min, change_percent_max,
                    amplitude_min, amplitude_max,
                    price_min, price_max,
                    enable_check,
                    created_at, updated_at
                ) VALUES (
                    ?, 'default',
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    COALESCE((SELECT created_at FROM stock_criteria_settings WHERE user_id = ? AND criteria_name = 'default'), ?),
                    ?
                )
            `).run(
                userId,
                volume_ratio_min || 0, volume_ratio_max || 999,
                turnover_rate_min || 0, turnover_rate_max || 100,
                change_percent_min || -100, change_percent_max || 100,
                amplitude_min || 0, amplitude_max || 100,
                price_min || 0, price_max || 999999,
                enable_check !== undefined ? enable_check : 1,
                userId, now, now
            );

            res.json({ success: true });
        } catch (error) {
            console.error('保存选股标准配置失败:', error);
            res.status(500).json({ success: false, error: '保存配置失败' });
        }
    });

    return router;
};
