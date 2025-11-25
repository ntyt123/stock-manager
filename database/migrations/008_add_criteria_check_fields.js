const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始添加选股标准检测字段...');

    // 添加检测结果字段（JSON格式，存储详细的检测结果）
    db.exec(`
        ALTER TABLE short_term_pool
        ADD COLUMN criteria_check_result TEXT;
    `);
    console.log('✅ 添加 criteria_check_result 字段');

    // 添加警告信息字段（存储不符合的条件列表）
    db.exec(`
        ALTER TABLE short_term_pool
        ADD COLUMN criteria_warnings TEXT;
    `);
    console.log('✅ 添加 criteria_warnings 字段');

    console.log('✅ 选股标准检测字段添加成功');

} catch (error) {
    console.error('❌ 添加选股标准检测字段失败:', error);
    throw error;
} finally {
    db.close();
}
