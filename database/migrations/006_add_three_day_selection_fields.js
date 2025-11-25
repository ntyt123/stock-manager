const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始添加三日选股法字段...');

    // 添加选股方法字段
    db.exec(`
        ALTER TABLE short_term_pool
        ADD COLUMN selection_method TEXT DEFAULT 'manual';
    `);
    console.log('✅ 添加 selection_method 字段');

    // 添加第几天状态
    db.exec(`
        ALTER TABLE short_term_pool
        ADD COLUMN day_status INTEGER DEFAULT 1;
    `);
    console.log('✅ 添加 day_status 字段');

    // 添加第一天数据
    db.exec(`
        ALTER TABLE short_term_pool
        ADD COLUMN first_day_date TEXT;
    `);
    console.log('✅ 添加 first_day_date 字段');

    db.exec(`
        ALTER TABLE short_term_pool
        ADD COLUMN first_day_price REAL;
    `);
    console.log('✅ 添加 first_day_price 字段');

    // 添加第二天数据
    db.exec(`
        ALTER TABLE short_term_pool
        ADD COLUMN second_day_date TEXT;
    `);
    console.log('✅ 添加 second_day_date 字段');

    db.exec(`
        ALTER TABLE short_term_pool
        ADD COLUMN second_day_price REAL;
    `);
    console.log('✅ 添加 second_day_price 字段');

    // 添加第三天数据
    db.exec(`
        ALTER TABLE short_term_pool
        ADD COLUMN third_day_date TEXT;
    `);
    console.log('✅ 添加 third_day_date 字段');

    db.exec(`
        ALTER TABLE short_term_pool
        ADD COLUMN third_day_price REAL;
    `);
    console.log('✅ 添加 third_day_price 字段');

    // 添加选股备注
    db.exec(`
        ALTER TABLE short_term_pool
        ADD COLUMN selection_notes TEXT;
    `);
    console.log('✅ 添加 selection_notes 字段');

    console.log('✅ 三日选股法字段添加成功');

} catch (error) {
    console.error('❌ 添加三日选股法字段失败:', error);
    throw error;
} finally {
    db.close();
}
