const { db } = require('../connection');

// 资金账户相关数据库操作
const fundAccountModel = {
    // 获取或创建用户资金账户
    getOrCreate: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                let account = db.prepare(`SELECT * FROM fund_accounts WHERE user_id = ?`).get(userId);

                if (!account) {
                    const currentTime = new Date().toISOString();
                    const info = db.prepare(`INSERT INTO fund_accounts
                        (user_id, total_assets, cash_balance, position_value, frozen_funds, available_funds, updated_at)
                        VALUES (?, 0, 0, 0, 0, 0, ?)`).run(userId, currentTime);

                    account = {
                        id: info.lastInsertRowid,
                        user_id: userId,
                        total_assets: 0,
                        cash_balance: 0,
                        position_value: 0,
                        frozen_funds: 0,
                        available_funds: 0,
                        updated_at: currentTime
                    };
                }

                resolve(account);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新账户资金
    update: (userId, accountData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const { cash_balance, position_value, frozen_funds } = accountData;

                const total_assets = cash_balance + position_value;
                const available_funds = cash_balance - frozen_funds;

                const info = db.prepare(`UPDATE fund_accounts SET
                    total_assets = ?, cash_balance = ?, position_value = ?,
                    frozen_funds = ?, available_funds = ?, updated_at = ?
                    WHERE user_id = ?`).run(
                    total_assets, cash_balance, position_value, frozen_funds, available_funds,
                    currentTime, userId
                );

                resolve({ changes: info.changes, updated_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取账户统计信息
    getStatistics: (userId, days = 30) => {
        return new Promise((resolve, reject) => {
            try {
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                const startDateStr = startDate.toISOString().split('T')[0];

                // 获取资金流水统计
                const deposits = db.prepare(`SELECT SUM(amount) as total
                    FROM fund_transactions
                    WHERE user_id = ? AND transaction_type = 'deposit'
                    AND transaction_date >= ?`).get(userId, startDateStr);

                const withdrawals = db.prepare(`SELECT SUM(amount) as total
                    FROM fund_transactions
                    WHERE user_id = ? AND transaction_type = 'withdrawal'
                    AND transaction_date >= ?`).get(userId, startDateStr);

                const dividends = db.prepare(`SELECT SUM(amount) as total
                    FROM fund_transactions
                    WHERE user_id = ? AND transaction_type = 'dividend'
                    AND transaction_date >= ?`).get(userId, startDateStr);

                resolve({
                    total_deposits: deposits.total || 0,
                    total_withdrawals: withdrawals.total || 0,
                    total_dividends: dividends.total || 0
                });
            } catch (err) {
                reject(err);
            }
        });
    }
};

// 资金流水相关数据库操作
const fundTransactionModel = {
    // 添加资金流水记录
    add: (userId, transactionData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const {
                    transaction_type, amount, balance_before, balance_after,
                    transaction_date, stock_code, stock_name, notes
                } = transactionData;

                const info = db.prepare(`INSERT INTO fund_transactions
                    (user_id, transaction_type, amount, balance_before, balance_after,
                     transaction_date, stock_code, stock_name, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                    userId, transaction_type, amount, balance_before, balance_after,
                    transaction_date, stock_code || null, stock_name || null,
                    notes || null, currentTime
                );

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户的资金流水记录
    findByUserId: (userId, filters = {}) => {
        return new Promise((resolve, reject) => {
            try {
                const { transaction_type, start_date, end_date, limit = 100, offset = 0 } = filters;

                let query = 'SELECT * FROM fund_transactions WHERE user_id = ?';
                const params = [userId];

                if (transaction_type) {
                    query += ' AND transaction_type = ?';
                    params.push(transaction_type);
                }
                if (start_date) {
                    query += ' AND transaction_date >= ?';
                    params.push(start_date);
                }
                if (end_date) {
                    query += ' AND transaction_date <= ?';
                    params.push(end_date);
                }

                query += ' ORDER BY transaction_date DESC, created_at DESC LIMIT ? OFFSET ?';
                params.push(limit, offset);

                const rows = db.prepare(query).all(...params);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取资金流水统计（按类型）
    getStatsByType: (userId, days = 30) => {
        return new Promise((resolve, reject) => {
            try {
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                const startDateStr = startDate.toISOString().split('T')[0];

                const rows = db.prepare(`SELECT transaction_type,
                    COUNT(*) as count,
                    SUM(amount) as total_amount
                    FROM fund_transactions
                    WHERE user_id = ? AND transaction_date >= ?
                    GROUP BY transaction_type`).all(userId, startDateStr);

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取资金变化趋势（按日期）
    getTrend: (userId, days = 30) => {
        return new Promise((resolve, reject) => {
            try {
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                const startDateStr = startDate.toISOString().split('T')[0];

                const rows = db.prepare(`SELECT
                    transaction_date,
                    balance_after,
                    transaction_type
                    FROM fund_transactions
                    WHERE user_id = ? AND transaction_date >= ?
                    ORDER BY transaction_date ASC, created_at ASC`).all(userId, startDateStr);

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除资金流水记录
    delete: (transactionId) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM fund_transactions WHERE id = ?`).run(transactionId);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    }
};

module.exports = {
    fundAccountModel,
    fundTransactionModel
};
