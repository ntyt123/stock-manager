// 预测历史记录数据模型

const { db } = require('../connection');

/**
 * 预测历史记录模型
 */
class PredictionHistoryModel {
    /**
     * 保存或更新预测历史记录
     * 同一用户、同一类型、同一股票、同一天只保留最新一条
     */
    static saveOrUpdate(data) {
        const {
            userId,
            predictionType,
            stockCode,
            stockName,
            predictionDate,
            predictionContent,
            paipanInfo
        } = data;

        try {
            // 检查是否存在相同记录
            const existing = db.prepare(`
                SELECT id FROM prediction_history
                WHERE user_id = ? AND prediction_type = ? AND stock_code = ? AND prediction_date = ?
            `).get(userId, predictionType, stockCode || null, predictionDate);

            if (existing) {
                // 更新现有记录
                const stmt = db.prepare(`
                    UPDATE prediction_history
                    SET stock_name = ?,
                        prediction_content = ?,
                        paipan_info = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `);

                stmt.run(
                    stockName,
                    predictionContent,
                    paipanInfo ? JSON.stringify(paipanInfo) : null,
                    existing.id
                );

                console.log(`✅ 更新预测历史记录: ${predictionType} - ${stockCode} - ${predictionDate}`);
                return existing.id;
            } else {
                // 插入新记录
                const stmt = db.prepare(`
                    INSERT INTO prediction_history (
                        user_id, prediction_type, stock_code, stock_name,
                        prediction_date, prediction_content, paipan_info
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                const result = stmt.run(
                    userId,
                    predictionType,
                    stockCode || null,
                    stockName,
                    predictionDate,
                    predictionContent,
                    paipanInfo ? JSON.stringify(paipanInfo) : null
                );

                console.log(`✅ 保存预测历史记录: ${predictionType} - ${stockCode} - ${predictionDate}`);
                return result.lastInsertRowid;
            }
        } catch (error) {
            console.error('❌ 保存预测历史记录失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取用户的预测历史记录列表
     */
    static findByUserId(userId, options = {}) {
        const {
            predictionType,
            stockCode,
            startDate,
            endDate,
            limit = 50,
            offset = 0
        } = options;

        try {
            let sql = `
                SELECT
                    id, prediction_type, stock_code, stock_name,
                    prediction_date, created_at, updated_at
                FROM prediction_history
                WHERE user_id = ?
            `;
            const params = [userId];

            if (predictionType) {
                sql += ` AND prediction_type = ?`;
                params.push(predictionType);
            }

            if (stockCode) {
                sql += ` AND stock_code = ?`;
                params.push(stockCode);
            }

            if (startDate) {
                sql += ` AND prediction_date >= ?`;
                params.push(startDate);
            }

            if (endDate) {
                sql += ` AND prediction_date <= ?`;
                params.push(endDate);
            }

            sql += ` ORDER BY prediction_date DESC, updated_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const records = db.prepare(sql).all(...params);
            return records;
        } catch (error) {
            console.error('❌ 查询预测历史记录失败:', error.message);
            throw error;
        }
    }

    /**
     * 根据ID获取预测历史记录详情
     */
    static findById(id, userId) {
        try {
            const record = db.prepare(`
                SELECT * FROM prediction_history
                WHERE id = ? AND user_id = ?
            `).get(id, userId);

            if (record && record.paipan_info) {
                record.paipan_info = JSON.parse(record.paipan_info);
            }

            return record;
        } catch (error) {
            console.error('❌ 查询预测历史记录详情失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取预测历史记录总数
     */
    static countByUserId(userId, options = {}) {
        const { predictionType, stockCode, startDate, endDate } = options;

        try {
            let sql = `SELECT COUNT(*) as count FROM prediction_history WHERE user_id = ?`;
            const params = [userId];

            if (predictionType) {
                sql += ` AND prediction_type = ?`;
                params.push(predictionType);
            }

            if (stockCode) {
                sql += ` AND stock_code = ?`;
                params.push(stockCode);
            }

            if (startDate) {
                sql += ` AND prediction_date >= ?`;
                params.push(startDate);
            }

            if (endDate) {
                sql += ` AND prediction_date <= ?`;
                params.push(endDate);
            }

            const result = db.prepare(sql).get(...params);
            return result.count;
        } catch (error) {
            console.error('❌ 统计预测历史记录失败:', error.message);
            throw error;
        }
    }

    /**
     * 删除预测历史记录
     */
    static deleteById(id, userId) {
        try {
            const stmt = db.prepare(`
                DELETE FROM prediction_history
                WHERE id = ? AND user_id = ?
            `);

            const result = stmt.run(id, userId);
            return result.changes > 0;
        } catch (error) {
            console.error('❌ 删除预测历史记录失败:', error.message);
            throw error;
        }
    }
}

module.exports = PredictionHistoryModel;
