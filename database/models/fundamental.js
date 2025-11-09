const { db } = require('../connection');

// 基本面分析相关数据库操作
const fundamentalAnalysisModel = {
    // 保存基本面分析记录
    save: (userId, stockCode, stockName, fundamentalData, analysisContent, analysisType = 'manual') => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const dataJson = JSON.stringify(fundamentalData);

                const info = db.prepare(`INSERT INTO fundamental_analysis
                    (user_id, stock_code, stock_name, fundamental_data, analysis_content, analysis_type, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`)
                    .run(userId, stockCode, stockName, dataJson, analysisContent, analysisType, currentTime);

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户的基本面分析记录列表
    findByUserId: (userId, limit = 30, offset = 0) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT id, stock_code, stock_name, analysis_type, created_at
                    FROM fundamental_analysis
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?`).all(userId, limit, offset);

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取完整的基本面分析记录
    findById: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM fundamental_analysis WHERE id = ?`).get(id);

                if (row) {
                    // 将JSON字符串转换为对象
                    if (row.fundamental_data) {
                        row.fundamental_data = JSON.parse(row.fundamental_data);
                    }
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户对特定股票的最新分析记录
    findLatestByStock: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM fundamental_analysis
                    WHERE user_id = ? AND stock_code = ?
                    ORDER BY created_at DESC
                    LIMIT 1`).get(userId, stockCode);

                if (row && row.fundamental_data) {
                    row.fundamental_data = JSON.parse(row.fundamental_data);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除基本面分析记录
    delete: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM fundamental_analysis WHERE id = ?`).run(id);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取记录总数
    getCount: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT COUNT(*) as count FROM fundamental_analysis WHERE user_id = ?`).get(userId);
                resolve(row.count);
            } catch (err) {
                reject(err);
            }
        });
    }
};

module.exports = {
    fundamentalAnalysisModel
};
