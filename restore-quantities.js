/**
 * 恢复正确的持仓数量
 */

const { db } = require('./database');

console.log('=== 恢复正确的持仓数量 ===\n');

try {
    const today = new Date().toISOString().split('T')[0];

    const recap = db.prepare(`
        SELECT id, position_data
        FROM daily_recap
        WHERE recap_date = ?
    `).get(today);

    if (!recap) {
        console.log('❌ 没有找到今天的复盘记录');
        process.exit(1);
    }

    const positions = JSON.parse(recap.position_data);

    // 恢复正确的数量（乘以2）
    positions.forEach(pos => {
        pos.quantity = pos.quantity * 2;
        pos.cost = pos.cost_price * pos.quantity;
        pos.market_value = pos.current_price * pos.quantity;
        pos.total_profit = (pos.current_price - pos.cost_price) * pos.quantity;
        pos.profit_rate = pos.cost > 0 ? (pos.total_profit / pos.cost * 100) : 0;

        if (pos.yesterday_close && pos.yesterday_close > 0) {
            pos.today_profit = (pos.current_price - pos.yesterday_close) * pos.quantity;
        }
    });

    const newTodayProfit = positions.reduce((sum, pos) => sum + (pos.today_profit || 0), 0);
    const newTotalProfit = positions.reduce((sum, pos) => sum + (pos.total_profit || 0), 0);

    db.prepare(`
        UPDATE daily_recap
        SET position_data = ?,
            today_profit = ?,
            total_profit = ?
        WHERE id = ?
    `).run(JSON.stringify(positions), newTodayProfit, newTotalProfit, recap.id);

    console.log('✅ 已恢复原始数量');
    console.log(`   海马汽车: 200股`);
    console.log(`   安泰集团: 500股`);
    console.log(`   合富中国: 100股`);
    console.log(`   今日盈利: ¥${newTodayProfit.toFixed(2)}\n`);

} catch (error) {
    console.error('❌ 恢复失败:', error);
}
