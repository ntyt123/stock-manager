// 添加大盘预测提示词模板
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../stock_manager.db');
const sqlPath = path.join(__dirname, 'add-market-prediction-prompt.sql');

try {
    // 读取SQL文件
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('✅ SQL文件读取成功');

    // 连接数据库
    const db = new Database(dbPath);
    console.log('✅ 成功连接到数据库');

    // 执行SQL
    db.exec(sql);
    console.log('✅ 大盘预测提示词模板已成功添加到数据库');

    // 关闭数据库连接
    db.close();
    console.log('✅ 数据库连接已关闭');

} catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
}
