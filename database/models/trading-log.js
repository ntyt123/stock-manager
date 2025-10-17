const { db } = require('../connection');

// 交易日志相关数据库操作
const tradingLogModel = {
    // 获取用户的所有交易日志
    findByUserId: (userId, limit = 50, offset = 0) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`
                    SELECT * FROM trading_logs
                    WHERE user_id = ?
                    ORDER BY log_date DESC, created_at DESC
                    LIMIT ? OFFSET ?
                `).all(userId, limit, offset);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取单个日志
    findById: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM trading_logs WHERE id = ?`).get(id);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据日期获取日志
    findByDate: (userId, logDate) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`
                    SELECT * FROM trading_logs
                    WHERE user_id = ? AND log_date = ?
                    ORDER BY created_at DESC
                `).all(userId, logDate);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据类型获取日志
    findByType: (userId, logType) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`
                    SELECT * FROM trading_logs
                    WHERE user_id = ? AND log_type = ?
                    ORDER BY log_date DESC
                `).all(userId, logType);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据标签搜索日志
    searchByTag: (userId, tag) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`
                    SELECT * FROM trading_logs
                    WHERE user_id = ? AND tags LIKE ?
                    ORDER BY log_date DESC
                `).all(userId, `%${tag}%`);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 搜索日志 (标题或内容)
    search: (userId, keyword) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`
                    SELECT * FROM trading_logs
                    WHERE user_id = ?
                    AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)
                    ORDER BY log_date DESC
                `).all(userId, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取重要标记的日志
    findImportant: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`
                    SELECT * FROM trading_logs
                    WHERE user_id = ? AND is_important = 1
                    ORDER BY log_date DESC
                `).all(userId);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 添加交易日志
    add: (userId, logData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
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
                } = logData;

                const info = db.prepare(`
                    INSERT INTO trading_logs
                    (user_id, log_date, log_type, title, content, tags,
                     related_stock_codes, sentiment, profit_loss, is_important,
                     created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    userId,
                    logDate,
                    logType,
                    title,
                    content,
                    tags || null,
                    relatedStockCodes || null,
                    sentiment || 'neutral',
                    profitLoss || null,
                    isImportant || 0,
                    currentTime,
                    currentTime
                );

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新交易日志
    update: (id, logData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
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
                } = logData;

                const info = db.prepare(`
                    UPDATE trading_logs SET
                        log_date = ?,
                        log_type = ?,
                        title = ?,
                        content = ?,
                        tags = ?,
                        related_stock_codes = ?,
                        sentiment = ?,
                        profit_loss = ?,
                        is_important = ?,
                        updated_at = ?
                    WHERE id = ?
                `).run(
                    logDate,
                    logType,
                    title,
                    content,
                    tags || null,
                    relatedStockCodes || null,
                    sentiment || 'neutral',
                    profitLoss || null,
                    isImportant || 0,
                    currentTime,
                    id
                );

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除交易日志
    delete: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM trading_logs WHERE id = ?`).run(id);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取日志统计信息
    getStatistics: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                // 总数统计
                const totalCount = db.prepare(`
                    SELECT COUNT(*) as count FROM trading_logs WHERE user_id = ?
                `).get(userId);

                // 按类型统计
                const typeStats = db.prepare(`
                    SELECT log_type, COUNT(*) as count
                    FROM trading_logs
                    WHERE user_id = ?
                    GROUP BY log_type
                `).all(userId);

                // 按情绪统计
                const sentimentStats = db.prepare(`
                    SELECT sentiment, COUNT(*) as count
                    FROM trading_logs
                    WHERE user_id = ?
                    GROUP BY sentiment
                `).all(userId);

                // 重要日志数
                const importantCount = db.prepare(`
                    SELECT COUNT(*) as count
                    FROM trading_logs
                    WHERE user_id = ? AND is_important = 1
                `).get(userId);

                resolve({
                    total: totalCount.count,
                    byType: typeStats,
                    bySentiment: sentimentStats,
                    important: importantCount.count
                });
            } catch (err) {
                reject(err);
            }
        });
    }
};

module.exports = {
    tradingLogModel
};
