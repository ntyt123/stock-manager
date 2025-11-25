const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始创建选股标准配置表...');

    // 创建选股标准配置表
    db.exec(`
        CREATE TABLE IF NOT EXISTS stock_criteria_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            criteria_name TEXT NOT NULL DEFAULT 'default',
            volume_ratio_min REAL DEFAULT 1.5,
            volume_ratio_max REAL DEFAULT 999,
            turnover_rate_min REAL DEFAULT 3.0,
            turnover_rate_max REAL DEFAULT 8.0,
            change_percent_min REAL DEFAULT 3.0,
            change_percent_max REAL DEFAULT 7.0,
            amplitude_min REAL DEFAULT 0,
            amplitude_max REAL DEFAULT 999,
            price_min REAL DEFAULT 0,
            price_max REAL DEFAULT 999999,
            enable_check INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, criteria_name)
        );
    `);
    console.log('✅ 创建 stock_criteria_settings 表');

    // 为每个现有用户创建默认配置
    const users = db.prepare('SELECT id FROM users').all();
    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO stock_criteria_settings (
            user_id, criteria_name,
            volume_ratio_min, turnover_rate_min, turnover_rate_max,
            change_percent_min, change_percent_max
        ) VALUES (?, 'default', 1.5, 3.0, 8.0, 3.0, 7.0)
    `);

    for (const user of users) {
        insertStmt.run(user.id);
    }
    console.log(`✅ 为 ${users.length} 个用户创建默认配置`);

    console.log('✅ 选股标准配置表创建成功');

} catch (error) {
    console.error('❌ 创建选股标准配置表失败:', error);
    throw error;
} finally {
    db.close();
}
