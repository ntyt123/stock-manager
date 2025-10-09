const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'stock_manager.db');
const db = new Database(dbPath);

// 获取所有用户
const users = db.prepare(`
    SELECT id, username, account, email, role
    FROM users
    LIMIT 10
`).all();

console.log('========== 用户列表 ==========');
users.forEach(user => {
    console.log(`ID: ${user.id}`);
    console.log(`用户名: ${user.username}`);
    console.log(`账号: ${user.account}`);
    console.log(`邮箱: ${user.email}`);
    console.log(`角色: ${user.role}`);
    console.log('---');
});

db.close();
