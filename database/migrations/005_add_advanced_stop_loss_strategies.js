const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始添加高级止盈止损策略字段...');

    // 添加新的策略字段
    db.exec(`
        ALTER TABLE stop_loss_settings
        ADD COLUMN strategy_type TEXT DEFAULT 'basic';
    `);
    console.log('✅ 添加 strategy_type 字段');

    db.exec(`
        ALTER TABLE stop_loss_settings
        ADD COLUMN enable_breakeven_stop INTEGER DEFAULT 0;
    `);
    console.log('✅ 添加 enable_breakeven_stop 字段');

    db.exec(`
        ALTER TABLE stop_loss_settings
        ADD COLUMN breakeven_trigger_percent REAL DEFAULT 3.0;
    `);
    console.log('✅ 添加 breakeven_trigger_percent 字段');

    db.exec(`
        ALTER TABLE stop_loss_settings
        ADD COLUMN time_based_stop_days INTEGER DEFAULT 0;
    `);
    console.log('✅ 添加 time_based_stop_days 字段');

    db.exec(`
        ALTER TABLE stop_loss_settings
        ADD COLUMN tiered_profit_taking TEXT;
    `);
    console.log('✅ 添加 tiered_profit_taking 字段');

    db.exec(`
        ALTER TABLE stop_loss_settings
        ADD COLUMN max_loss_amount REAL DEFAULT 0;
    `);
    console.log('✅ 添加 max_loss_amount 字段');

    db.exec(`
        ALTER TABLE stop_loss_settings
        ADD COLUMN target_profit_amount REAL DEFAULT 0;
    `);
    console.log('✅ 添加 target_profit_amount 字段');

    console.log('✅ 高级止盈止损策略字段添加成功');

} catch (error) {
    console.error('❌ 添加高级策略字段失败:', error);
    throw error;
} finally {
    db.close();
}
