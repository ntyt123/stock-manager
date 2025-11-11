const Database = require('better-sqlite3');
const db = new Database('./stock_manager.db');

console.log('==================== 检查所有用户的持仓数据 ====================\n');

const users = db.prepare('SELECT id, username FROM users').all();

users.forEach(user => {
    console.log(`👤 用户: ${user.username} (ID: ${user.id})`);

    // 检查 manual_positions
    const manualCount = db.prepare(`
        SELECT COUNT(*) as count FROM manual_positions WHERE user_id = ? AND quantity > 0
    `).get(user.id);
    console.log(`   📋 manual_positions: ${manualCount.count} 条`);

    const manualPos = db.prepare(`
        SELECT stock_code, stock_name, quantity FROM manual_positions WHERE user_id = ? AND quantity > 0
    `).all(user.id);
    if (manualPos.length > 0) {
        manualPos.forEach(p => console.log(`      - ${p.stock_code} ${p.stock_name} (${p.quantity}股)`));
    }

    // 检查 user_positions
    const userCount = db.prepare(`
        SELECT COUNT(*) as count FROM user_positions WHERE user_id = ? AND quantity > 0
    `).get(user.id);
    console.log(`   📊 user_positions: ${userCount.count} 条`);

    const userPos = db.prepare(`
        SELECT stockCode, stockName, quantity FROM user_positions WHERE user_id = ? AND quantity > 0
    `).all(user.id);
    if (userPos.length > 0) {
        userPos.forEach(p => console.log(`      - ${p.stockCode} ${p.stockName} (${p.quantity}股)`));
    }

    // 检查今日复盘
    const today = new Date().toISOString().split('T')[0];
    const recap = db.prepare(`
        SELECT position_count FROM daily_recap WHERE recap_date = ? AND user_id = ?
    `).get(today, user.id);

    if (recap) {
        console.log(`   📅 今日复盘: ${recap.position_count} 支`);
    } else {
        console.log(`   📅 今日复盘: 无`);
    }

    console.log('');
});

db.close();
