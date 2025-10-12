const Database = require('better-sqlite3');
const path = require('path');
const { getNextTradingDay, isTradingDay } = require('./utils/tradingCalendar');

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
                total_capital REAL DEFAULT 0,
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

            // 创建集合竞价分析表
            db.prepare(`CREATE TABLE IF NOT EXISTS call_auction_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_date TEXT NOT NULL UNIQUE,
                analysis_content TEXT NOT NULL,
                market_summary TEXT NOT NULL,
                analysis_type TEXT NOT NULL DEFAULT 'manual',
                created_at TEXT NOT NULL
            )`).run();

            // 创建股票推荐表
            db.prepare(`CREATE TABLE IF NOT EXISTS stock_recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recommendation_date TEXT NOT NULL UNIQUE,
                recommendation_content TEXT NOT NULL,
                market_data TEXT NOT NULL,
                recommendation_type TEXT NOT NULL DEFAULT 'manual',
                created_at TEXT NOT NULL
            )`).run();

            // 创建手动持仓表
            db.prepare(`CREATE TABLE IF NOT EXISTS manual_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stock_code TEXT NOT NULL,
                stock_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                cost_price REAL NOT NULL,
                buy_date TEXT NOT NULL,
                current_price REAL,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建交易操作记录表
            db.prepare(`CREATE TABLE IF NOT EXISTS trade_operations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                trade_type TEXT NOT NULL,
                trade_date TEXT NOT NULL,
                stock_code TEXT NOT NULL,
                stock_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                price REAL NOT NULL,
                fee REAL DEFAULT 0,
                amount REAL NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建交易计划表
            db.prepare(`CREATE TABLE IF NOT EXISTS trading_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stock_code TEXT NOT NULL,
                stock_name TEXT NOT NULL,
                plan_type TEXT NOT NULL,
                plan_status TEXT NOT NULL DEFAULT 'pending',
                target_price REAL NOT NULL,
                current_price REAL,
                stop_profit_price REAL,
                stop_loss_price REAL,
                quantity REAL,
                estimated_amount REAL,
                plan_date TEXT NOT NULL,
                created_at TEXT NOT NULL,
                executed_at TEXT,
                reason TEXT,
                notes TEXT,
                priority INTEGER DEFAULT 3,
                alert_enabled INTEGER DEFAULT 1,
                alert_range REAL DEFAULT 0.02,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建计划执行记录表
            db.prepare(`CREATE TABLE IF NOT EXISTS plan_executions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                execution_type TEXT NOT NULL,
                execution_price REAL NOT NULL,
                execution_quantity REAL NOT NULL,
                execution_amount REAL NOT NULL,
                execution_time TEXT NOT NULL,
                price_deviation REAL,
                notes TEXT,
                FOREIGN KEY (plan_id) REFERENCES trading_plans (id) ON DELETE CASCADE,
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
    // 保存分析报告（自动删除同一天的旧报告）
    save: (userId, analysisContent, portfolioSummary, reportType = 'manual') => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const summaryJson = JSON.stringify(portfolioSummary);
                const today = currentTime.split('T')[0]; // 获取日期部分 YYYY-MM-DD

                // 使用事务：先删除当天的旧报告，再插入新报告
                const saveWithDeduplication = db.transaction(() => {
                    // 删除当天该用户的所有报告
                    const deleteStmt = db.prepare(`DELETE FROM analysis_reports
                        WHERE user_id = ? AND DATE(created_at) = ?`);
                    const deleteResult = deleteStmt.run(userId, today);

                    if (deleteResult.changes > 0) {
                        console.log(`🗑️ 删除了用户 ${userId} 在 ${today} 的 ${deleteResult.changes} 份旧报告`);
                    }

                    // 插入新报告
                    const insertStmt = db.prepare(`INSERT INTO analysis_reports
                        (user_id, analysis_content, portfolio_summary, report_type, created_at)
                        VALUES (?, ?, ?, ?, ?)`);
                    const info = insertStmt.run(userId, analysisContent, summaryJson, reportType, currentTime);

                    return { id: info.lastInsertRowid, created_at: currentTime, deletedCount: deleteResult.changes };
                });

                const result = saveWithDeduplication();
                resolve(result);
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

// 集合竞价分析相关数据库操作
const callAuctionAnalysisModel = {
    // 保存集合竞价分析
    save: (analysisDate, analysisContent, marketSummary, analysisType = 'manual') => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const summaryJson = JSON.stringify(marketSummary);

                const info = db.prepare(`INSERT OR REPLACE INTO call_auction_analysis
                    (analysis_date, analysis_content, market_summary, analysis_type, created_at)
                    VALUES (?, ?, ?, ?, ?)`)
                    .run(analysisDate, analysisContent, summaryJson, analysisType, currentTime);

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取所有分析记录列表（按日期倒序）
    findAll: (limit = 30, offset = 0) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT id, analysis_date, analysis_type, created_at FROM call_auction_analysis
                    ORDER BY analysis_date DESC
                    LIMIT ? OFFSET ?`).all(limit, offset);

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据日期获取分析记录
    findByDate: (analysisDate) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM call_auction_analysis WHERE analysis_date = ?`).get(analysisDate);

                if (row && row.market_summary) {
                    // 将JSON字符串转换为对象
                    row.market_summary = JSON.parse(row.market_summary);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取完整的分析记录
    findById: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM call_auction_analysis WHERE id = ?`).get(id);

                if (row && row.market_summary) {
                    row.market_summary = JSON.parse(row.market_summary);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取最新的分析记录
    getLatest: () => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM call_auction_analysis
                    ORDER BY analysis_date DESC
                    LIMIT 1`).get();

                if (row && row.market_summary) {
                    row.market_summary = JSON.parse(row.market_summary);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除分析记录
    delete: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM call_auction_analysis WHERE id = ?`).run(id);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取记录总数
    getCount: () => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT COUNT(*) as count FROM call_auction_analysis`).get();
                resolve(row.count);
            } catch (err) {
                reject(err);
            }
        });
    }
};

// 股票推荐相关数据库操作
const stockRecommendationModel = {
    // 保存股票推荐
    save: (recommendationDate, recommendationContent, marketData, recommendationType = 'manual') => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const dataJson = JSON.stringify(marketData);

                const info = db.prepare(`INSERT OR REPLACE INTO stock_recommendations
                    (recommendation_date, recommendation_content, market_data, recommendation_type, created_at)
                    VALUES (?, ?, ?, ?, ?)`)
                    .run(recommendationDate, recommendationContent, dataJson, recommendationType, currentTime);

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取所有推荐记录列表（按日期倒序）
    findAll: (limit = 30, offset = 0) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT id, recommendation_date, recommendation_type, created_at FROM stock_recommendations
                    ORDER BY recommendation_date DESC
                    LIMIT ? OFFSET ?`).all(limit, offset);

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据日期获取推荐记录
    findByDate: (recommendationDate) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM stock_recommendations WHERE recommendation_date = ?`).get(recommendationDate);

                if (row && row.market_data) {
                    // 将JSON字符串转换为对象
                    row.market_data = JSON.parse(row.market_data);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取完整的推荐记录
    findById: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM stock_recommendations WHERE id = ?`).get(id);

                if (row && row.market_data) {
                    row.market_data = JSON.parse(row.market_data);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取最新的推荐记录
    getLatest: () => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM stock_recommendations
                    ORDER BY recommendation_date DESC
                    LIMIT 1`).get();

                if (row && row.market_data) {
                    row.market_data = JSON.parse(row.market_data);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除推荐记录
    delete: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM stock_recommendations WHERE id = ?`).run(id);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取记录总数
    getCount: () => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT COUNT(*) as count FROM stock_recommendations`).get();
                resolve(row.count);
            } catch (err) {
                reject(err);
            }
        });
    }
};

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

// 交易计划相关数据库操作
const tradingPlanModel = {
    // 创建交易计划
    create: (userId, planData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const {
                    stock_code, stock_name, plan_type, plan_date,
                    target_price, current_price, stop_profit_price, stop_loss_price,
                    quantity, estimated_amount, reason, notes, priority,
                    alert_enabled, alert_range
                } = planData;

                const info = db.prepare(`INSERT INTO trading_plans
                    (user_id, stock_code, stock_name, plan_type, plan_status, target_price, current_price,
                     stop_profit_price, stop_loss_price, quantity, estimated_amount, plan_date, created_at,
                     reason, notes, priority, alert_enabled, alert_range)
                    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                    userId, stock_code, stock_name, plan_type, target_price, current_price || null,
                    stop_profit_price || null, stop_loss_price || null, quantity || null,
                    estimated_amount || null, plan_date, currentTime, reason || null, notes || null,
                    priority || 3, alert_enabled !== false ? 1 : 0, alert_range || 0.02
                );

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户的所有计划（带筛选和分页）
    findByUserId: (userId, filters = {}) => {
        return new Promise((resolve, reject) => {
            try {
                const { status, planType, stockCode, startDate, endDate, limit = 100, offset = 0 } = filters;

                let query = 'SELECT * FROM trading_plans WHERE user_id = ?';
                const params = [userId];

                if (status) {
                    query += ' AND plan_status = ?';
                    params.push(status);
                }
                if (planType) {
                    query += ' AND plan_type = ?';
                    params.push(planType);
                }
                if (stockCode) {
                    query += ' AND stock_code = ?';
                    params.push(stockCode);
                }
                if (startDate) {
                    query += ' AND plan_date >= ?';
                    params.push(startDate);
                }
                if (endDate) {
                    query += ' AND plan_date <= ?';
                    params.push(endDate);
                }

                query += ' ORDER BY plan_date DESC, priority DESC, created_at DESC LIMIT ? OFFSET ?';
                params.push(limit, offset);

                const rows = db.prepare(query).all(...params);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取今日计划（实际为下一个交易日的计划）
    getTodayPlans: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                // 判断今天是否为交易日
                const now = new Date();
                const today = now.toISOString().split('T')[0];
                let targetDate;

                if (isTradingDay(now)) {
                    // 如果今天是交易日，返回今天的计划
                    targetDate = today;
                } else {
                    // 如果今天不是交易日（周末或节假日），返回下一个交易日的计划
                    const nextTradingDay = getNextTradingDay(now);
                    targetDate = nextTradingDay.toISOString().split('T')[0];
                }

                console.log(`📅 获取交易计划 - 今天: ${today}, 目标日期: ${targetDate}`);

                const rows = db.prepare(`SELECT * FROM trading_plans
                    WHERE user_id = ? AND plan_date = ? AND plan_status = 'pending'
                    ORDER BY priority DESC, created_at ASC`).all(userId, targetDate);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取计划
    findById: (planId) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare('SELECT * FROM trading_plans WHERE id = ?').get(planId);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新计划
    update: (planId, planData) => {
        return new Promise((resolve, reject) => {
            try {
                const fields = [];
                const values = [];

                const allowedFields = [
                    'stock_code', 'stock_name', 'plan_type', 'plan_date', 'target_price',
                    'current_price', 'stop_profit_price', 'stop_loss_price', 'quantity',
                    'estimated_amount', 'reason', 'notes', 'priority', 'alert_enabled', 'alert_range'
                ];

                allowedFields.forEach(field => {
                    if (planData[field] !== undefined) {
                        fields.push(`${field} = ?`);
                        values.push(planData[field]);
                    }
                });

                if (fields.length === 0) {
                    resolve({ changes: 0 });
                    return;
                }

                values.push(planId);
                const query = `UPDATE trading_plans SET ${fields.join(', ')} WHERE id = ?`;
                const info = db.prepare(query).run(...values);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 执行计划
    execute: (planId, userId, executionData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const { executionType, executionPrice, executionQuantity, notes } = executionData;

                // 开始事务
                const executeTransaction = db.transaction(() => {
                    // 1. 更新计划状态为已执行
                    db.prepare(`UPDATE trading_plans SET plan_status = 'executed', executed_at = ? WHERE id = ?`)
                        .run(currentTime, planId);

                    // 2. 获取计划信息计算偏差
                    const plan = db.prepare('SELECT * FROM trading_plans WHERE id = ?').get(planId);
                    const executionAmount = executionPrice * executionQuantity;
                    const priceDeviation = ((executionPrice - plan.target_price) / plan.target_price * 100);

                    // 3. 插入执行记录
                    const info = db.prepare(`INSERT INTO plan_executions
                        (plan_id, user_id, execution_type, execution_price, execution_quantity,
                         execution_amount, execution_time, price_deviation, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                        planId, userId, executionType, executionPrice, executionQuantity,
                        executionAmount, currentTime, priceDeviation, notes || null
                    );

                    return {
                        executionId: info.lastInsertRowid,
                        plan: plan,
                        execution: {
                            id: info.lastInsertRowid,
                            execution_price: executionPrice,
                            execution_quantity: executionQuantity,
                            execution_amount: executionAmount,
                            price_deviation: priceDeviation,
                            execution_time: currentTime
                        }
                    };
                });

                const result = executeTransaction();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 取消计划
    cancel: (planId, reason) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`UPDATE trading_plans
                    SET plan_status = 'cancelled', notes = ?
                    WHERE id = ?`).run(reason || '用户取消', planId);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除计划
    delete: (planId) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare('DELETE FROM trading_plans WHERE id = ?').run(planId);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 批量操作
    batchOperate: (planIds, action, reason) => {
        return new Promise((resolve, reject) => {
            try {
                const batchTransaction = db.transaction(() => {
                    let processed = 0;
                    let failed = 0;

                    planIds.forEach(planId => {
                        try {
                            if (action === 'cancel') {
                                db.prepare(`UPDATE trading_plans SET plan_status = 'cancelled', notes = ? WHERE id = ?`)
                                    .run(reason || '批量取消', planId);
                            } else if (action === 'delete') {
                                db.prepare('DELETE FROM trading_plans WHERE id = ?').run(planId);
                            }
                            processed++;
                        } catch (err) {
                            failed++;
                        }
                    });

                    return { processed, failed };
                });

                const result = batchTransaction();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取计划统计
    getStatistics: (userId, days = 30) => {
        return new Promise((resolve, reject) => {
            try {
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                const startDateStr = startDate.toISOString().split('T')[0];

                // 总计划数和状态分布
                const statusStats = db.prepare(`SELECT plan_status, COUNT(*) as count
                    FROM trading_plans
                    WHERE user_id = ? AND created_at >= ?
                    GROUP BY plan_status`).all(userId, startDateStr);

                // 计划类型分布
                const typeStats = db.prepare(`SELECT plan_type, COUNT(*) as count
                    FROM trading_plans
                    WHERE user_id = ? AND created_at >= ?
                    GROUP BY plan_type`).all(userId, startDateStr);

                // 执行统计
                const executionStats = db.prepare(`SELECT
                    COUNT(*) as total_executions,
                    AVG(price_deviation) as avg_price_deviation,
                    MAX(price_deviation) as max_positive_deviation,
                    MIN(price_deviation) as max_negative_deviation
                    FROM plan_executions
                    WHERE user_id = ? AND execution_time >= ?`).get(userId, startDateStr);

                resolve({
                    statusStats,
                    typeStats,
                    executionStats
                });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 标记过期计划
    markExpiredPlans: () => {
        return new Promise((resolve, reject) => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const info = db.prepare(`UPDATE trading_plans
                    SET plan_status = 'expired'
                    WHERE plan_status = 'pending' AND plan_date < ?`).run(today);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    }
};

// 计划执行记录相关数据库操作
const planExecutionModel = {
    // 获取计划的所有执行记录
    findByPlanId: (planId) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM plan_executions
                    WHERE plan_id = ?
                    ORDER BY execution_time DESC`).all(planId);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户的所有执行记录
    findByUserId: (userId, limit = 50) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT pe.*, tp.stock_code, tp.stock_name, tp.plan_type
                    FROM plan_executions pe
                    JOIN trading_plans tp ON pe.plan_id = tp.id
                    WHERE pe.user_id = ?
                    ORDER BY pe.execution_time DESC
                    LIMIT ?`).all(userId, limit);
                resolve(rows);
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
    callAuctionAnalysisModel,
    stockRecommendationModel,
    manualPositionModel,
    tradeOperationModel,
    tradingPlanModel,
    planExecutionModel,
    closeDatabase
};