const Database = require('better-sqlite3');
const db = new Database('./stock_manager.db');

const users = db.prepare('SELECT id, username FROM users').all();
console.log('用户列表:', users);

db.close();
