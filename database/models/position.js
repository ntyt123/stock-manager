const { db } = require('../connection');

// 持仓数据相关数据库操作
const positionModel = {
    // 获取用户的所有持仓数据
    findByUserId: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM user_positions WHERE user_id = ? ORDER BY updated_at DESC`).all(userId);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 批量保存或更新用户持仓数据（使用事务）
    saveOrUpdatePositions: (userId, positions) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();

                // 使用事务
                const insertOrUpdate = db.transaction((positions) => {
                    const stmt = db.prepare(`INSERT OR REPLACE INTO user_positions
                        (user_id, stockCode, stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                    positions.forEach(position => {
                        const { stockCode, stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate } = position;

                        stmt.run(
                            userId, stockCode, stockName, quantity, costPrice, currentPrice,
                            marketValue, profitLoss, profitLossRate, currentTime, currentTime
                        );
                    });
                });

                // 执行事务
                insertOrUpdate(positions);

                resolve({ success: true, totalRecords: positions.length });
            } catch (err) {
                console.error('保存持仓数据错误:', err);
                reject(err);
            }
        });
    },

    // 删除用户的所有持仓数据
    deleteByUserId: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare("DELETE FROM user_positions WHERE user_id = ?").run(userId);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据股票代码查询单个持仓
    findByStockCode: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM user_positions WHERE user_id = ? AND stockCode = ?`).get(userId, stockCode);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 添加单个持仓
    addPosition: (userId, positionData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const { stockCode, stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate } = positionData;

                const info = db.prepare(`INSERT INTO user_positions
                    (user_id, stockCode, stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                    .run(userId, stockCode, stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate, currentTime, currentTime);

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新单个持仓
    updatePosition: (userId, stockCode, positionData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const { stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate } = positionData;

                const info = db.prepare(`UPDATE user_positions SET
                    stockName = ?, quantity = ?, costPrice = ?, currentPrice = ?,
                    marketValue = ?, profitLoss = ?, profitLossRate = ?, updated_at = ?
                    WHERE user_id = ? AND stockCode = ?`)
                    .run(stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate, currentTime, userId, stockCode);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除单个持仓
    deletePosition: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM user_positions WHERE user_id = ? AND stockCode = ?`).run(userId, stockCode);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    }
};

// 持仓更新记录相关数据库操作
const positionUpdateModel = {
    // 记录持仓更新时间
    recordUpdate: (userId, fileName, status, errorMessage, totalRecords, successRecords) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();

                const info = db.prepare(`INSERT INTO user_position_updates
                    (user_id, updateTime, fileName, status, errorMessage, totalRecords, successRecords)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`)
                    .run(userId, currentTime, fileName || null, status, errorMessage || null, totalRecords || 0, successRecords || 0);

                resolve({ id: info.lastInsertRowid });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户的最新更新时间
    getLatestUpdate: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM user_position_updates
                    WHERE user_id = ?
                    ORDER BY updateTime DESC
                    LIMIT 1`).get(userId);

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户的更新历史
    getUpdateHistory: (userId, limit = 10) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM user_position_updates
                    WHERE user_id = ?
                    ORDER BY updateTime DESC
                    LIMIT ?`).all(userId, limit);

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    }
};

module.exports = {
    positionModel,
    positionUpdateModel
};
