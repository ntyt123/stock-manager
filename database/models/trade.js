const { db } = require('../connection');

// 手动持仓相关数据库操作
const manualPositionModel = {
    // 获取用户的所有手动持仓
    findByUserId: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM manual_positions WHERE user_id = ? ORDER BY created_at DESC`).all(userId);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 添加手动持仓
    add: (userId, positionData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const { stockCode, stockName, quantity, costPrice, buyDate, currentPrice, notes } = positionData;

                const info = db.prepare(`INSERT INTO manual_positions
                    (user_id, stock_code, stock_name, quantity, cost_price, buy_date, current_price, notes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                    .run(userId, stockCode, stockName, quantity, costPrice, buyDate, currentPrice || null, notes || null, currentTime, currentTime);

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新手动持仓
    update: (id, positionData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const { stockCode, stockName, quantity, costPrice, buyDate, currentPrice, notes } = positionData;

                const info = db.prepare(`UPDATE manual_positions SET
                    stock_code = ?, stock_name = ?, quantity = ?, cost_price = ?,
                    buy_date = ?, current_price = ?, notes = ?, updated_at = ?
                    WHERE id = ?`)
                    .run(stockCode, stockName, quantity, costPrice, buyDate, currentPrice || null, notes || null, currentTime, id);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除手动持仓
    delete: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM manual_positions WHERE id = ?`).run(id);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取持仓
    findById: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM manual_positions WHERE id = ?`).get(id);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据股票代码获取持仓
    findByStockCode: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM manual_positions WHERE user_id = ? AND stock_code = ?`).get(userId, stockCode);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    }
};

// 交易操作记录相关数据库操作
const tradeOperationModel = {
    // 获取用户的所有交易记录
    findByUserId: (userId, limit = 100, offset = 0) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM trade_operations WHERE user_id = ? ORDER BY trade_date DESC, created_at DESC LIMIT ? OFFSET ?`).all(userId, limit, offset);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 添加交易记录
    add: (userId, tradeData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const { tradeType, tradeDate, stockCode, stockName, quantity, price, fee, amount, notes } = tradeData;

                const info = db.prepare(`INSERT INTO trade_operations
                    (user_id, trade_type, trade_date, stock_code, stock_name, quantity, price, fee, amount, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                    .run(userId, tradeType, tradeDate, stockCode, stockName, quantity, price, fee || 0, amount, notes || null, currentTime);

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据股票代码获取交易记录
    findByStockCode: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM trade_operations WHERE user_id = ? AND stock_code = ? ORDER BY trade_date DESC`).all(userId, stockCode);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除交易记录
    delete: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM trade_operations WHERE id = ?`).run(id);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取交易记录
    findById: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM trade_operations WHERE id = ?`).get(id);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取交易统计（按交易类型）
    getStatsByType: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT trade_type, COUNT(*) as count, SUM(amount) as total_amount FROM trade_operations WHERE user_id = ? GROUP BY trade_type`).all(userId);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    }
};

module.exports = {
    manualPositionModel,
    tradeOperationModel
};
