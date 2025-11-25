const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始为短线池添加股票类型字段...');

    // 检查字段是否已存在
    const tableInfo = db.prepare("PRAGMA table_info(short_term_pool)").all();
    const hasStockType = tableInfo.some(col => col.name === 'stock_type');
    const hasHotMoneyName = tableInfo.some(col => col.name === 'hot_money_name');

    if (!hasStockType) {
        db.exec(`
            ALTER TABLE short_term_pool
            ADD COLUMN stock_type TEXT
        `);
        console.log('✅ 已添加 stock_type 字段');
    } else {
        console.log('ℹ️  stock_type 字段已存在，跳过');
    }

    if (!hasHotMoneyName) {
        db.exec(`
            ALTER TABLE short_term_pool
            ADD COLUMN hot_money_name TEXT
        `);
        console.log('✅ 已添加 hot_money_name 字段');
    } else {
        console.log('ℹ️  hot_money_name 字段已存在，跳过');
    }

    console.log('✅ 短线池股票类型字段添加完成');

} catch (error) {
    console.error('❌ 添加字段失败:', error);
    throw error;
} finally {
    db.close();
}
