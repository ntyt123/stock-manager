// 数据库迁移脚本：为users表添加total_capital字段

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'stock_manager.db');

console.log('📦 开始数据库迁移...');
console.log(`数据库路径: ${dbPath}`);

try {
    const db = new Database(dbPath);

    // 检查字段是否已存在
    const columns = db.pragma('table_info(users)');
    const hasCapitalField = columns.some(col => col.name === 'total_capital');

    if (hasCapitalField) {
        console.log('✅ total_capital字段已存在，无需迁移');
    } else {
        console.log('🔧 添加total_capital字段...');

        // 添加字段
        db.prepare('ALTER TABLE users ADD COLUMN total_capital REAL DEFAULT 0').run();

        console.log('✅ total_capital字段添加成功');

        // 验证
        const newColumns = db.pragma('table_info(users)');
        const verification = newColumns.find(col => col.name === 'total_capital');

        if (verification) {
            console.log('✅ 验证成功:', verification);
        } else {
            console.error('❌ 验证失败：字段未找到');
        }
    }

    db.close();
    console.log('✅ 数据库迁移完成');

} catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
}
