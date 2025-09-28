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
}

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
    closeDatabase
};