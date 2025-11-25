const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始修改 short_term_pool 表的唯一约束...');

    // SQLite 不支持直接修改约束，需要重建表
    db.exec(`
        -- 创建临时表，使用新的唯一约束 (user_id, stock_code, selection_method)
        CREATE TABLE short_term_pool_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stock_code TEXT NOT NULL,
            stock_name TEXT,
            entry_price REAL,
            target_price REAL,
            stop_loss_price REAL,
            tags TEXT,
            reason TEXT,
            priority INTEGER,
            status TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            stock_type TEXT,
            hot_money_name TEXT,
            board_shape TEXT,
            selection_method TEXT DEFAULT 'manual',
            day_status INTEGER DEFAULT 1,
            first_day_date TEXT,
            first_day_price REAL,
            second_day_date TEXT,
            second_day_price REAL,
            third_day_date TEXT,
            third_day_price REAL,
            selection_notes TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, stock_code, selection_method)
        );
    `);
    console.log('✅ 创建新表 short_term_pool_new');

    // 复制数据到新表
    db.exec(`
        INSERT INTO short_term_pool_new
        SELECT * FROM short_term_pool;
    `);
    console.log('✅ 复制数据到新表');

    // 删除旧表
    db.exec(`
        DROP TABLE short_term_pool;
    `);
    console.log('✅ 删除旧表');

    // 重命名新表为原表名
    db.exec(`
        ALTER TABLE short_term_pool_new RENAME TO short_term_pool;
    `);
    console.log('✅ 重命名新表');

    console.log('✅ 唯一约束修改成功！现在每种选股方法可以独立存储相同的股票');

} catch (error) {
    console.error('❌ 修改唯一约束失败:', error);
    throw error;
} finally {
    db.close();
}
