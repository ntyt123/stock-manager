const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始创建短线池表...');

    // 创建短线池表
    db.exec(`
        CREATE TABLE IF NOT EXISTS short_term_pool (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stock_code TEXT NOT NULL,
            stock_name TEXT NOT NULL,
            entry_price REAL,
            target_price REAL,
            stop_loss_price REAL,
            tags TEXT,
            reason TEXT,
            priority INTEGER DEFAULT 0,
            status TEXT DEFAULT 'watching',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, stock_code),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    console.log('✅ short_term_pool表创建成功');

    // 创建索引
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_short_term_pool_user_id
        ON short_term_pool(user_id)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_short_term_pool_stock_code
        ON short_term_pool(stock_code)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_short_term_pool_status
        ON short_term_pool(status)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_short_term_pool_priority
        ON short_term_pool(priority)
    `);

    console.log('✅ 索引创建成功');

} catch (error) {
    console.error('❌ 创建短线池表失败:', error);
    throw error;
} finally {
    db.close();
}
