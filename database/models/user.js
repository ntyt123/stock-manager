const { db } = require('../connection');

// 用户相关数据库操作
const userModel = {
    // 根据账号查找用户
    findByAccount: (account) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare("SELECT * FROM users WHERE account = ?").get(account);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID查找用户
    findById: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据邮箱查找用户
    findByEmail: (email) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取所有用户
    findAll: () => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare("SELECT * FROM users ORDER BY registerTime DESC").all();
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 创建新用户
    create: (userData) => {
        return new Promise((resolve, reject) => {
            try {
                const { username, account, password, email, avatar, role, registerTime, lastLogin } = userData;

                const info = db.prepare(`INSERT INTO users
                    (username, account, password, email, avatar, role, registerTime, lastLogin)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
                    .run(username, account, password, email, avatar, role, registerTime, lastLogin);

                resolve({ id: info.lastInsertRowid, ...userData });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新用户信息
    update: (id, userData) => {
        return new Promise((resolve, reject) => {
            try {
                const { username, email, role } = userData;

                const info = db.prepare(`UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?`)
                    .run(username, email, role, id);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新用户最后登录时间
    updateLastLogin: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`UPDATE users SET lastLogin = ? WHERE id = ?`)
                    .run(new Date().toISOString(), id);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新用户总资金
    updateTotalCapital: (id, totalCapital) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`UPDATE users SET total_capital = ? WHERE id = ?`)
                    .run(totalCapital, id);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新用户密码
    updatePassword: (id, hashedPassword) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`UPDATE users SET password = ? WHERE id = ?`)
                    .run(hashedPassword, id);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除用户
    delete: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare("DELETE FROM users WHERE id = ?").run(id);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 清除用户的所有数据（保留用户账号）
    clearAllUserData: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                // 使用事务确保原子性
                const clearTransaction = db.transaction(() => {
                    const stats = {
                        positions: 0,
                        watchlist: 0,
                        analysisReports: 0,
                        manualPositions: 0,
                        tradeOperations: 0,
                        tradingPlans: 0,
                        planExecutions: 0,
                        costRecords: 0,
                        costAdjustments: 0,
                        positionUpdates: 0
                    };

                    // 1. 删除持仓数据
                    stats.positions = db.prepare("DELETE FROM user_positions WHERE user_id = ?").run(userId).changes;

                    // 2. 删除自选股
                    stats.watchlist = db.prepare("DELETE FROM user_watchlist WHERE user_id = ?").run(userId).changes;

                    // 3. 删除分析报告
                    stats.analysisReports = db.prepare("DELETE FROM analysis_reports WHERE user_id = ?").run(userId).changes;

                    // 4. 删除手动持仓
                    stats.manualPositions = db.prepare("DELETE FROM manual_positions WHERE user_id = ?").run(userId).changes;

                    // 5. 删除交易记录
                    stats.tradeOperations = db.prepare("DELETE FROM trade_operations WHERE user_id = ?").run(userId).changes;

                    // 6. 删除计划执行记录（需要先删除，因为外键依赖）
                    stats.planExecutions = db.prepare("DELETE FROM plan_executions WHERE user_id = ?").run(userId).changes;

                    // 7. 删除交易计划
                    stats.tradingPlans = db.prepare("DELETE FROM trading_plans WHERE user_id = ?").run(userId).changes;

                    // 8. 删除持仓成本记录
                    stats.costRecords = db.prepare("DELETE FROM position_cost_records WHERE user_id = ?").run(userId).changes;

                    // 9. 删除成本调整记录
                    stats.costAdjustments = db.prepare("DELETE FROM position_cost_adjustments WHERE user_id = ?").run(userId).changes;

                    // 10. 删除持仓更新记录
                    stats.positionUpdates = db.prepare("DELETE FROM user_position_updates WHERE user_id = ?").run(userId).changes;

                    // 11. 重置用户总资金
                    db.prepare("UPDATE users SET total_capital = 0 WHERE id = ?").run(userId);

                    return stats;
                });

                // 执行事务
                const result = clearTransaction();
                console.log(`✅ 用户 ${userId} 的数据已清除:`, result);
                resolve({ success: true, stats: result });
            } catch (err) {
                console.error('清除用户数据错误:', err);
                reject(err);
            }
        });
    }
};

module.exports = { userModel };
