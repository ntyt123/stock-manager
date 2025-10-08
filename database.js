const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, 'stock_manager.db');

// 创建数据库连接
let db;
try {
    db = new Database(dbPath);
    console.log('✅ 成功连接到SQLite数据库');
} catch (err) {
    console.error('数据库连接错误:', err.message);
    throw err;
}

// 初始化数据库表
function initDatabase() {
    return new Promise((resolve, reject) => {
        try {
            // 创建用户表
            db.prepare(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                account TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                avatar TEXT,
                role TEXT NOT NULL DEFAULT 'user',
                registerTime TEXT NOT NULL,
                lastLogin TEXT NOT NULL
            )`).run();

            // 创建用户持仓数据表
            db.prepare(`CREATE TABLE IF NOT EXISTS user_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stockCode TEXT NOT NULL,
                stockName TEXT NOT NULL,
                quantity REAL NOT NULL,
                costPrice REAL NOT NULL,
                currentPrice REAL NOT NULL,
                marketValue REAL NOT NULL,
                profitLoss REAL NOT NULL,
                profitLossRate REAL NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, stockCode)
            )`).run();

            // 创建用户持仓更新时间记录表
            db.prepare(`CREATE TABLE IF NOT EXISTS user_position_updates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                updateTime TEXT NOT NULL,
                fileName TEXT,
                status TEXT NOT NULL DEFAULT 'success',
                errorMessage TEXT,
                totalRecords INTEGER DEFAULT 0,
                successRecords INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建用户自选股表
            db.prepare(`CREATE TABLE IF NOT EXISTS user_watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stock_code TEXT NOT NULL,
                stock_name TEXT NOT NULL,
                added_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, stock_code)
            )`).run();

            // 创建持仓分析报告表
            db.prepare(`CREATE TABLE IF NOT EXISTS analysis_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                analysis_content TEXT NOT NULL,
                portfolio_summary TEXT NOT NULL,
                report_type TEXT NOT NULL DEFAULT 'manual',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 检查是否需要插入默认用户
            const row = db.prepare("SELECT COUNT(*) as count FROM users").get();

            if (row.count === 0) {
                // 插入默认管理员用户
                const defaultUsers = [
                    {
                        username: 'admin',
                        account: 'admin',
                        password: '$2a$10$8K1p/a0dRTJ5q0ZbQ8z8e.3J9WgZ8X8Z8X8X8X8X8X8X8X8X8X8X', // admin
                        email: 'admin@stock.com',
                        avatar: '/assets/avatars/admin.png',
                        role: 'super_admin',
                        registerTime: new Date('2024-01-01').toISOString(),
                        lastLogin: new Date().toISOString()
                    },
                    {
                        username: '测试管理员',
                        account: 'manager',
                        password: '$2a$10$8K1p/a0dRTJ5q0ZbQ8z8e.3J9WgZ8X8Z8X8X8X8X8X8X8X8X8X8X', // 默认密码
                        email: 'manager@stock.com',
                        avatar: '/assets/avatars/user2.png',
                        role: 'admin',
                        registerTime: new Date('2024-01-02').toISOString(),
                        lastLogin: new Date().toISOString()
                    }
                ];

                const stmt = db.prepare(`INSERT INTO users
                    (username, account, password, email, avatar, role, registerTime, lastLogin)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

                defaultUsers.forEach(user => {
                    stmt.run(
                        user.username,
                        user.account,
                        user.password,
                        user.email,
                        user.avatar,
                        user.role,
                        user.registerTime,
                        user.lastLogin
                    );
                });

                console.log('✅ 默认用户数据初始化完成');
            } else {
                console.log('✅ 数据库已存在用户数据');
            }

            resolve();
        } catch (err) {
            reject(err);
        }
    });
}

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
    }
};

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

// 持仓分析报告相关数据库操作
const analysisReportModel = {
    // 保存分析报告
    save: (userId, analysisContent, portfolioSummary, reportType = 'manual') => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const summaryJson = JSON.stringify(portfolioSummary);

                const info = db.prepare(`INSERT INTO analysis_reports
                    (user_id, analysis_content, portfolio_summary, report_type, created_at)
                    VALUES (?, ?, ?, ?, ?)`)
                    .run(userId, analysisContent, summaryJson, reportType, currentTime);

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户的分析报告列表（按日期倒序）
    findByUserId: (userId, limit = 30, offset = 0) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT id, report_type, created_at FROM analysis_reports
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?`).all(userId, limit, offset);

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取完整的分析报告
    findById: (reportId) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM analysis_reports WHERE id = ?`).get(reportId);

                if (row && row.portfolio_summary) {
                    // 将JSON字符串转换为对象
                    row.portfolio_summary = JSON.parse(row.portfolio_summary);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户最新的分析报告
    getLatest: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM analysis_reports
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT 1`).get(userId);

                if (row && row.portfolio_summary) {
                    row.portfolio_summary = JSON.parse(row.portfolio_summary);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除分析报告
    delete: (reportId) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM analysis_reports WHERE id = ?`).run(reportId);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取报告总数
    getCount: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT COUNT(*) as count FROM analysis_reports WHERE user_id = ?`).get(userId);
                resolve(row.count);
            } catch (err) {
                reject(err);
            }
        });
    }
};

// 关闭数据库连接
function closeDatabase() {
    try {
        db.close();
        console.log('✅ 数据库连接已关闭');
    } catch (err) {
        console.error('数据库关闭错误:', err.message);
    }
}

module.exports = {
    db,
    initDatabase,
    userModel,
    positionModel,
    positionUpdateModel,
    watchlistModel,
    analysisReportModel,
    closeDatabase
};