const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始创建短线交易相关表...');

    // 1. T+0操作记录表
    db.exec(`
        CREATE TABLE IF NOT EXISTS t0_operations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stock_code TEXT NOT NULL,
            stock_name TEXT NOT NULL,
            operation_type TEXT NOT NULL,
            price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            amount REAL NOT NULL,
            profit_loss REAL DEFAULT 0,
            notes TEXT,
            operation_time TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    console.log('✅ t0_operations表创建成功');

    // 2. 交易计划表
    db.exec(`
        CREATE TABLE IF NOT EXISTS trading_plans_short (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stock_code TEXT,
            stock_name TEXT,
            plan_type TEXT NOT NULL,
            plan_content TEXT NOT NULL,
            target_price REAL,
            stop_loss_price REAL,
            position_ratio REAL,
            status TEXT DEFAULT 'pending',
            result TEXT,
            result_notes TEXT,
            plan_date TEXT NOT NULL,
            execute_date TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    console.log('✅ trading_plans_short表创建成功');

    // 3. 复盘笔记表
    db.exec(`
        CREATE TABLE IF NOT EXISTS review_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            review_date TEXT NOT NULL,
            market_summary TEXT,
            today_operations TEXT,
            profit_loss REAL DEFAULT 0,
            lessons_learned TEXT,
            tomorrow_plan TEXT,
            mood_score INTEGER DEFAULT 3,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, review_date),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    console.log('✅ review_notes表创建成功');

    // 创建索引
    db.exec(`CREATE INDEX IF NOT EXISTS idx_t0_user_id ON t0_operations(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_t0_stock_code ON t0_operations(stock_code)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_t0_operation_time ON t0_operations(operation_time)`);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_trading_plans_short_user_id ON trading_plans_short(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_trading_plans_short_status ON trading_plans_short(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_trading_plans_short_plan_date ON trading_plans_short(plan_date)`);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_review_notes_user_id ON review_notes(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_review_notes_review_date ON review_notes(review_date)`);

    console.log('✅ 所有索引创建成功');

} catch (error) {
    console.error('❌ 创建短线交易表失败:', error);
    throw error;
} finally {
    db.close();
}
