const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'stock_manager.db');

// 创建数据库连接
let db;
try {
    db = new Database(dbPath);
    console.log('✅ 成功连接到SQLite数据库');
} catch (err) {
    console.error('数据库连接错误:', err.message);
    throw err;
}

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
    closeDatabase
};
