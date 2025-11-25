const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始为短线池添加板型字段...');

    // 检查字段是否已存在
    const tableInfo = db.prepare("PRAGMA table_info(short_term_pool)").all();
    const hasBoardShape = tableInfo.some(col => col.name === 'board_shape');

    if (!hasBoardShape) {
        db.exec(`
            ALTER TABLE short_term_pool
            ADD COLUMN board_shape TEXT
        `);
        console.log('✅ 已添加 board_shape 字段');
    } else {
        console.log('ℹ️  board_shape 字段已存在，跳过');
    }

    console.log('✅ 短线池板型字段添加完成');

} catch (error) {
    console.error('❌ 添加字段失败:', error);
    throw error;
} finally {
    db.close();
}
