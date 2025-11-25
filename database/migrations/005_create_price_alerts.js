const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始创建价格告警表...');

    // 创建价格告警历史表
    db.exec(`
        CREATE TABLE IF NOT EXISTS price_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stock_code TEXT NOT NULL,
            stock_name TEXT NOT NULL,
            alert_type TEXT NOT NULL,
            trigger_price REAL NOT NULL,
            target_price REAL NOT NULL,
            cost_price REAL NOT NULL,
            alert_message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    console.log('✅ price_alerts表创建成功');

    // 创建索引
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id
        ON price_alerts(user_id)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_price_alerts_stock_code
        ON price_alerts(stock_code)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_price_alerts_is_read
        ON price_alerts(is_read)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_price_alerts_created_at
        ON price_alerts(created_at)
    `);

    console.log('✅ 索引创建成功');

} catch (error) {
    console.error('❌ 创建价格告警表失败:', error);
    throw error;
} finally {
    db.close();
}
