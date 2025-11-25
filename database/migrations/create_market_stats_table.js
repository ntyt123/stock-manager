/**
 * 创建市场统计表
 * 用于存储每日收盘时的市场涨跌统计数据
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始创建market_stats表...');

    // 创建市场统计表
    db.exec(`
        CREATE TABLE IF NOT EXISTS market_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trade_date TEXT NOT NULL UNIQUE,
            up_count INTEGER NOT NULL DEFAULT 0,
            down_count INTEGER NOT NULL DEFAULT 0,
            flat_count INTEGER NOT NULL DEFAULT 0,
            total_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);

    console.log('✅ market_stats表创建成功');

    // 创建索引
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_market_stats_trade_date
        ON market_stats(trade_date DESC)
    `);

    console.log('✅ 索引创建成功');

} catch (error) {
    console.error('❌ 创建market_stats表失败:', error);
    throw error;
} finally {
    db.close();
}
