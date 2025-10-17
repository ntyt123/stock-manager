const { db } = require('../connection');

// ==================== 风险控制规则模型 ====================
const riskControlRuleModel = {
    // 获取用户的风险控制规则
    getByUserId(userId) {
        const sql = `SELECT * FROM risk_control_rules WHERE user_id = ? LIMIT 1`;
        return db.prepare(sql).get(userId);
    },

    // 创建或更新风险控制规则
    saveOrUpdate(userId, rules) {
        const existing = this.getByUserId(userId);
        const now = new Date().toISOString();

        if (existing) {
            const sql = `
                UPDATE risk_control_rules
                SET rules_config = ?,
                    updated_at = ?
                WHERE user_id = ?
            `;
            db.prepare(sql).run(
                JSON.stringify(rules),
                now,
                userId
            );
            return { id: existing.id, userId };
        } else {
            const sql = `
                INSERT INTO risk_control_rules (user_id, rules_config, created_at, updated_at)
                VALUES (?, ?, ?, ?)
            `;
            const result = db.prepare(sql).run(
                userId,
                JSON.stringify(rules),
                now,
                now
            );
            return { id: result.lastInsertRowid, userId };
        }
    },

    // 获取规则配置（JSON格式）
    getRulesConfig(userId) {
        const record = this.getByUserId(userId);
        if (!record) {
            // 返回默认规则配置
            return this.getDefaultRules();
        }
        try {
            return JSON.parse(record.rules_config);
        } catch (error) {
            console.error('解析风险控制规则失败:', error);
            return this.getDefaultRules();
        }
    },

    // 获取默认风险控制规则
    getDefaultRules() {
        return {
            // 仓位风险控制
            position: {
                enabled: true,
                maxTotalPosition: 80,        // 最大总仓位比例 (%)
                maxSingleStockPosition: 20,  // 单只股票最大仓位 (%)
                maxIndustryConcentration: 40 // 行业最大集中度 (%)
            },
            // 止损止盈规则
            stopLoss: {
                enabled: true,
                globalStopLoss: -10,         // 账户总止损线 (%)
                singleStockStopLoss: -15,    // 单只股票止损线 (%)
                singleStockStopProfit: 30,   // 单只股票止盈线 (%)
                trailingStopLoss: false,     // 是否启用移动止损
                trailingStopLossRate: 5      // 移动止损回撤比例 (%)
            },
            // 交易限制
            tradingLimits: {
                enabled: true,
                maxSingleTradeAmount: 50000,  // 单笔最大交易金额
                maxDailyTrades: 10,           // 日内最大交易次数
                blacklist: []                 // 禁止交易的股票代码列表
            }
        };
    }
};

// ==================== 风险预警记录模型 ====================
const riskWarningModel = {
    // 创建风险预警
    create(userId, warningData) {
        const now = new Date().toISOString();
        const sql = `
            INSERT INTO risk_warnings (
                user_id,
                warning_type,
                warning_level,
                title,
                message,
                related_stock_code,
                related_stock_name,
                trigger_value,
                threshold_value,
                is_read,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = db.prepare(sql).run(
            userId,
            warningData.warningType,
            warningData.warningLevel,
            warningData.title,
            warningData.message,
            warningData.relatedStockCode || null,
            warningData.relatedStockName || null,
            warningData.triggerValue || null,
            warningData.thresholdValue || null,
            0,
            now
        );

        return {
            id: result.lastInsertRowid,
            ...warningData,
            isRead: false,
            createdAt: now
        };
    },

    // 获取用户的风险预警列表
    getByUserId(userId, options = {}) {
        const {
            limit = 50,
            offset = 0,
            isRead = null,
            warningLevel = null
        } = options;

        let sql = `SELECT * FROM risk_warnings WHERE user_id = ?`;
        const params = [userId];

        if (isRead !== null) {
            sql += ` AND is_read = ?`;
            params.push(isRead ? 1 : 0);
        }

        if (warningLevel) {
            sql += ` AND warning_level = ?`;
            params.push(warningLevel);
        }

        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return db.prepare(sql).all(...params);
    },

    // 获取未读预警数量
    getUnreadCount(userId) {
        const sql = `SELECT COUNT(*) as count FROM risk_warnings WHERE user_id = ? AND is_read = 0`;
        const result = db.prepare(sql).get(userId);
        return result.count;
    },

    // 标记预警为已读
    markAsRead(warningId, userId) {
        const sql = `UPDATE risk_warnings SET is_read = 1 WHERE id = ? AND user_id = ?`;
        return db.prepare(sql).run(warningId, userId);
    },

    // 标记所有预警为已读
    markAllAsRead(userId) {
        const sql = `UPDATE risk_warnings SET is_read = 1 WHERE user_id = ? AND is_read = 0`;
        return db.prepare(sql).run(userId);
    },

    // 删除预警
    delete(warningId, userId) {
        const sql = `DELETE FROM risk_warnings WHERE id = ? AND user_id = ?`;
        return db.prepare(sql).run(warningId, userId);
    },

    // 删除所有已读预警
    deleteAllRead(userId) {
        const sql = `DELETE FROM risk_warnings WHERE user_id = ? AND is_read = 1`;
        return db.prepare(sql).run(userId);
    }
};

// ==================== 风险事件记录模型 ====================
const riskEventModel = {
    // 记录风险事件
    create(userId, eventData) {
        const now = new Date().toISOString();
        const sql = `
            INSERT INTO risk_events (
                user_id,
                event_type,
                event_level,
                title,
                description,
                related_stock_code,
                related_stock_name,
                event_data,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = db.prepare(sql).run(
            userId,
            eventData.eventType,
            eventData.eventLevel,
            eventData.title,
            eventData.description,
            eventData.relatedStockCode || null,
            eventData.relatedStockName || null,
            JSON.stringify(eventData.eventData || {}),
            now
        );

        return {
            id: result.lastInsertRowid,
            ...eventData,
            createdAt: now
        };
    },

    // 获取用户的风险事件列表
    getByUserId(userId, options = {}) {
        const {
            limit = 50,
            offset = 0,
            eventLevel = null,
            startDate = null,
            endDate = null
        } = options;

        let sql = `SELECT * FROM risk_events WHERE user_id = ?`;
        const params = [userId];

        if (eventLevel) {
            sql += ` AND event_level = ?`;
            params.push(eventLevel);
        }

        if (startDate) {
            sql += ` AND created_at >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            sql += ` AND created_at <= ?`;
            params.push(endDate);
        }

        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const events = db.prepare(sql).all(...params);

        // 解析 event_data JSON
        return events.map(event => ({
            ...event,
            eventData: JSON.parse(event.event_data)
        }));
    },

    // 获取风险事件统计
    getStatistics(userId, days = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceDate = since.toISOString();

        const sql = `
            SELECT
                event_level,
                COUNT(*) as count
            FROM risk_events
            WHERE user_id = ? AND created_at >= ?
            GROUP BY event_level
        `;

        const results = db.prepare(sql).all(userId, sinceDate);

        const stats = {
            high: 0,
            medium: 0,
            low: 0,
            total: 0
        };

        results.forEach(row => {
            stats[row.event_level] = row.count;
            stats.total += row.count;
        });

        return stats;
    },

    // 删除风险事件
    delete(eventId, userId) {
        const sql = `DELETE FROM risk_events WHERE id = ? AND user_id = ?`;
        return db.prepare(sql).run(eventId, userId);
    }
};

module.exports = {
    riskControlRuleModel,
    riskWarningModel,
    riskEventModel
};
