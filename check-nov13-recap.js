/**
 * 查看11月13日的复盘数据
 */

const { db } = require('./database');

const recap = db.prepare('SELECT * FROM daily_recap WHERE recap_date = ?').get('2025-11-13');

if (recap) {
    console.log('=== 2025-11-13 复盘数据 ===\n');
    console.log(`今日盈亏: ¥${recap.today_profit}`);
    console.log(`今日盈亏率: ${recap.today_profit_rate}%`);
    console.log(`总盈亏: ¥${recap.total_profit}`);
    console.log(`总盈亏率: ${recap.total_profit_rate}%`);

    console.log('\n持仓详情:');
    const positions = JSON.parse(recap.position_data);
    positions.forEach(p => {
        console.log(`  ${p.code} ${p.name}: 今日盈亏 ¥${p.today_profit || 0}`);
    });

    const totalTodayProfit = positions.reduce((sum, p) => sum + (p.today_profit || 0), 0);
    console.log(`\n持仓今日盈亏合计: ¥${totalTodayProfit.toFixed(2)}`);
} else {
    console.log('❌ 未找到11月13日的复盘数据');
}
