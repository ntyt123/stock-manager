/**
 * 创建每日收盘价历史表
 */

const { db } = require('../connection');

console.log('=== 创建每日收盘价历史表 ===\n');

try {
    console.log('创建 daily_closing_prices 表...');

    db.exec(`
        CREATE TABLE IF NOT EXISTS daily_closing_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stock_code TEXT NOT NULL,
            stock_name TEXT NOT NULL,
            trading_date TEXT NOT NULL,
            closing_price REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            UNIQUE(stock_code, trading_date)
        )
    `);

    // 创建索引
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_closing_stock_code ON daily_closing_prices(stock_code);
        CREATE INDEX IF NOT EXISTS idx_closing_trading_date ON daily_closing_prices(trading_date);
    `);

    console.log('✅ daily_closing_prices 表创建成功\n');
    console.log('表结构:');
    console.log('  - stock_code: 股票代码');
    console.log('  - stock_name: 股票名称');
    console.log('  - trading_date: 交易日期');
    console.log('  - closing_price: 收盘价');
    console.log('  - UNIQUE 约束: (stock_code, trading_date)\n');

    console.log('=== 创建完成 ===');

} catch (error) {
    console.error('❌ 创建表失败:', error);
    console.error('错误详情:', error.message);
}
