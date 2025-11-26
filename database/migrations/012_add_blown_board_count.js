const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 添加炸板数字段...');

    // 检查字段是否存在
    const columns = db.prepare('PRAGMA table_info(daily_recap)').all();
    const columnNames = columns.map(col => col.name);

    if (!columnNames.includes('blown_board_count')) {
        console.log('  ➕ 添加字段: blown_board_count');
        db.prepare(`ALTER TABLE daily_recap ADD COLUMN blown_board_count INTEGER DEFAULT 0`).run();
        console.log('✅ 炸板数字段添加成功');
    } else {
        console.log('  ✓ 字段已存在: blown_board_count');
    }

    db.close();
    console.log('✅ 迁移完成！');

} catch (error) {
    console.error('❌ 迁移失败:', error);
    db.close();
    throw error;
}
