const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, 'stock_manager.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库连接错误:', err.message);
    } else {
        console.log('✅ 成功连接到SQLite数据库');
    }
});

// 初始化数据库表
function initDatabase() {
    return new Promise((resolve, reject) => {
        // 创建用户表
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            account TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            avatar TEXT,
            role TEXT NOT NULL DEFAULT 'user',
            registerTime TEXT NOT NULL,
            lastLogin TEXT NOT NULL
        )`, (err) => {
            if (err) {
                reject(err);
                return;
            }
            
            // 创建用户持仓数据表
            db.run(`CREATE TABLE IF NOT EXISTS user_positions (
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
            )`, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // 创建用户持仓更新时间记录表
                db.run(`CREATE TABLE IF NOT EXISTS user_position_updates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    updateTime TEXT NOT NULL,
                    fileName TEXT,
                    status TEXT NOT NULL DEFAULT 'success',
                    errorMessage TEXT,
                    totalRecords INTEGER DEFAULT 0,
                    successRecords INTEGER DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )`, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // 创建用户自选股表
                    db.run(`CREATE TABLE IF NOT EXISTS user_watchlist (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        stock_code TEXT NOT NULL,
                        stock_name TEXT NOT NULL,
                        added_at TEXT NOT NULL,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                        UNIQUE(user_id, stock_code)
                    )`, (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        // 检查是否需要插入默认用户
                    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
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
                                stmt.run([
                                    user.username,
                                    user.account,
                                    user.password,
                                    user.email,
                                    user.avatar,
                                    user.role,
                                    user.registerTime,
                                    user.lastLogin
                                ]);
                            });
                            
                            stmt.finalize((err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    console.log('✅ 默认用户数据初始化完成');
                                    resolve();
                                }
                            });
                        } else {
                            console.log('✅ 数据库已存在用户数据');
                            resolve();
                        }
                    });
                });
            });
        });
    });
})};

// 用户相关数据库操作
const userModel = {
    // 根据账号查找用户
    findByAccount: (account) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM users WHERE account = ?", [account], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },
    
    // 根据ID查找用户
    findById: (id) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },
    
    // 根据邮箱查找用户
    findByEmail: (email) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },
    
    // 获取所有用户
    findAll: () => {
        return new Promise((resolve, reject) => {
            db.all("SELECT * FROM users ORDER BY registerTime DESC", (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },
    
    // 创建新用户
    create: (userData) => {
        return new Promise((resolve, reject) => {
            const { username, account, password, email, avatar, role, registerTime, lastLogin } = userData;
            
            db.run(`INSERT INTO users 
                (username, account, password, email, avatar, role, registerTime, lastLogin) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [username, account, password, email, avatar, role, registerTime, lastLogin],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, ...userData });
                    }
                }
            );
        });
    },
    
    // 更新用户信息
    update: (id, userData) => {
        return new Promise((resolve, reject) => {
            const { username, email, role } = userData;
            
            db.run(`UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?`,
                [username, email, role, id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    },
    
    // 更新用户最后登录时间
    updateLastLogin: (id) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE users SET lastLogin = ? WHERE id = ?`,
                [new Date().toISOString(), id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    },
    
    // 删除用户
    delete: (id) => {
        return new Promise((resolve, reject) => {
            db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }
};

// 持仓数据相关数据库操作
const positionModel = {
    // 获取用户的所有持仓数据
    findByUserId: (userId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM user_positions WHERE user_id = ? ORDER BY updated_at DESC`, [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },
    
    // 批量保存或更新用户持仓数据（使用事务）
    saveOrUpdatePositions: (userId, positions) => {
        return new Promise((resolve, reject) => {
            const currentTime = new Date().toISOString();
            
            db.serialize(() => {
                // 开始事务
                db.run('BEGIN TRANSACTION', (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                });
                
                // 准备插入或更新的SQL语句
                const stmt = db.prepare(`INSERT OR REPLACE INTO user_positions 
                    (user_id, stockCode, stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                
                let processedCount = 0;
                const totalCount = positions.length;
                
                // 批量处理持仓数据
                positions.forEach(position => {
                    const { stockCode, stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate } = position;
                    
                    stmt.run([
                        userId, stockCode, stockName, quantity, costPrice, currentPrice, 
                        marketValue, profitLoss, profitLossRate, currentTime, currentTime
                    ], function(err) {
                        if (err) {
                            console.error('保存持仓数据错误:', err);
                            db.run('ROLLBACK');
                            reject(err);
                            return;
                        }
                        
                        processedCount++;
                        
                        // 所有数据处理完成
                        if (processedCount === totalCount) {
                            stmt.finalize((err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    reject(err);
                                    return;
                                }
                                
                                // 提交事务
                                db.run('COMMIT', (err) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve({ success: true, totalRecords: totalCount });
                                    }
                                });
                            });
                        }
                    });
                });
            });
        });
    },
    
    // 删除用户的所有持仓数据
    deleteByUserId: (userId) => {
        return new Promise((resolve, reject) => {
            db.run("DELETE FROM user_positions WHERE user_id = ?", [userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }
};

// 持仓更新记录相关数据库操作
const positionUpdateModel = {
    // 记录持仓更新时间
    recordUpdate: (userId, fileName, status, errorMessage, totalRecords, successRecords) => {
        return new Promise((resolve, reject) => {
            const currentTime = new Date().toISOString();
            
            db.run(`INSERT INTO user_position_updates 
                (user_id, updateTime, fileName, status, errorMessage, totalRecords, successRecords) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, currentTime, fileName || null, status, errorMessage || null, totalRecords || 0, successRecords || 0],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID });
                    }
                }
            );
        });
    },
    
    // 获取用户的最新更新时间
    getLatestUpdate: (userId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM user_position_updates 
                WHERE user_id = ? 
                ORDER BY updateTime DESC 
                LIMIT 1`, [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },
    
    // 获取用户的更新历史
    getUpdateHistory: (userId, limit = 10) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM user_position_updates 
                WHERE user_id = ? 
                ORDER BY updateTime DESC 
                LIMIT ?`, [userId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
};

// 自选股相关数据库操作
const watchlistModel = {
    // 获取用户的自选股列表
    findByUserId: (userId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM user_watchlist WHERE user_id = ? ORDER BY added_at DESC`, [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },
    
    // 添加自选股
    add: (userId, stockCode, stockName) => {
        return new Promise((resolve, reject) => {
            const currentTime = new Date().toISOString();
            
            db.run(`INSERT INTO user_watchlist (user_id, stock_code, stock_name, added_at) 
                VALUES (?, ?, ?, ?)`, 
                [userId, stockCode, stockName, currentTime], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID });
                    }
                }
            );
        });
    },
    
    // 删除自选股
    remove: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            db.run(`DELETE FROM user_watchlist WHERE user_id = ? AND stock_code = ?`, 
                [userId, stockCode], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    },
    
    // 检查自选股是否存在
    exists: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM user_watchlist WHERE user_id = ? AND stock_code = ?`, 
                [userId, stockCode], 
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row.count > 0);
                    }
                }
            );
        });
    }
};

// 关闭数据库连接
function closeDatabase() {
    db.close((err) => {
        if (err) {
            console.error('数据库关闭错误:', err.message);
        } else {
            console.log('✅ 数据库连接已关闭');
        }
    });
}

module.exports = {
    db,
    initDatabase,
    userModel,
    positionModel,
    positionUpdateModel,
    watchlistModel,
    closeDatabase
};