const { db } = require('../connection');

// 自选股相关数据库操作
const watchlistModel = {
    // 获取用户的自选股列表
    findByUserId: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM user_watchlist WHERE user_id = ? ORDER BY added_at DESC`).all(userId);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 添加自选股
    add: (userId, stockCode, stockName) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();

                const info = db.prepare(`INSERT INTO user_watchlist (user_id, stock_code, stock_name, added_at)
                    VALUES (?, ?, ?, ?)`)
                    .run(userId, stockCode, stockName, currentTime);

                resolve({ id: info.lastInsertRowid });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除自选股
    remove: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM user_watchlist WHERE user_id = ? AND stock_code = ?`)
                    .run(userId, stockCode);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 检查自选股是否存在
    exists: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT COUNT(*) as count FROM user_watchlist WHERE user_id = ? AND stock_code = ?`)
                    .get(userId, stockCode);

                resolve(row.count > 0);
            } catch (err) {
                reject(err);
            }
        });
    }
};

module.exports = { watchlistModel };
