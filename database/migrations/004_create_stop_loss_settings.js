const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始创建止盈止损设置表...');

    // 创建止盈止损设置表
    db.exec(`
        CREATE TABLE IF NOT EXISTS stop_loss_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stock_code TEXT NOT NULL,
            stock_name TEXT NOT NULL,
            cost_price REAL NOT NULL,
            stop_loss_price REAL,
            stop_loss_percent REAL DEFAULT -5.0,
            stop_profit_price REAL,
            stop_profit_percent REAL DEFAULT 10.0,
            enable_trailing_stop INTEGER DEFAULT 0,
            trailing_stop_trigger REAL DEFAULT 5.0,
            alert_enabled INTEGER DEFAULT 1,
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, stock_code)
        )
    `);

    console.log('✅ stop_loss_settings表创建成功');

    // 创建索引
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_stop_loss_user_id
        ON stop_loss_settings(user_id)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_stop_loss_stock_code
        ON stop_loss_settings(stock_code)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_stop_loss_status
        ON stop_loss_settings(status)
    `);

    console.log('✅ 索引创建成功');

} catch (error) {
    console.error('❌ 创建止盈止损设置表失败:', error);
    throw error;
} finally {
    db.close();
}
