const { db } = require('./database/connection');

const userId = 6; // 使用你的用户ID

const testTrades = [
    {type: 'buy', date: '2025-10-15', code: '600143', name: '金发科技', qty: 100, price: 5.50, fee: 5.5},
    {type: 'sell', date: '2025-10-20', code: '600143', name: '金发科技', qty: 50, price: 5.80, fee: 2.9},
    {type: 'buy', date: '2025-10-25', code: '600150', name: '中国船舶', qty: 50, price: 25.00, fee: 12.5},
    {type: 'sell', date: '2025-11-01', code: '600150', name: '中国船舶', qty: 50, price: 26.50, fee: 13.25},
    {type: 'buy', date: '2025-11-02', code: '600159', name: '大龙地产', qty: 200, price: 3.20, fee: 6.4}
];

try {
    testTrades.forEach(t => {
        db.prepare(`
            INSERT INTO trade_operations
            (user_id, trade_type, trade_date, stock_code, stock_name, quantity, price, fee, amount, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(userId, t.type, t.date, t.code, t.name, t.qty, t.price, t.fee, t.qty * t.price);
    });

    console.log('✅ 已插入5条测试交易记录');

    // 验证插入
    const count = db.prepare('SELECT COUNT(*) as count FROM trade_operations WHERE user_id = ?').get(userId);
    console.log(`📊 用户 ${userId} 现有交易记录数: ${count.count}`);
} catch (error) {
    console.error('❌ 插入失败:', error.message);
}
