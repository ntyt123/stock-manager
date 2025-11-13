/**
 * 检查股票价格数据
 */

const { db } = require('./database');

console.log('=== 检查股票价格数据 ===\n');

try {
    const today = new Date().toISOString().split('T')[0];

    const recap = db.prepare(`
        SELECT position_data, today_profit
        FROM daily_recap
        WHERE recap_date = ?
    `).get(today);

    if (!recap) {
        console.log('❌ 没有找到复盘数据');
        process.exit(1);
    }

    const positions = JSON.parse(recap.position_data);

    console.log('股票价格详情:\n');

    positions.forEach((pos, i) => {
        console.log(`[${i + 1}] ${pos.code} ${pos.name}`);
        console.log(`    持仓数量: ${pos.quantity}股`);
        console.log(`    成本价: ¥${pos.cost_price}`);
        console.log(`    当前价: ¥${pos.current_price}`);
        console.log(`    昨收价: ¥${pos.yesterday_close || 'N/A'}`);

        if (pos.yesterday_close) {
            const todayChange = pos.current_price - pos.yesterday_close;
            const todayChangePercent = (todayChange / pos.yesterday_close * 100).toFixed(2);
            const calculatedTodayProfit = todayChange * pos.quantity;

            console.log(`    今日涨跌: ¥${todayChange.toFixed(2)} (${todayChangePercent}%)`);
            console.log(`    计算今日盈亏: ${todayChange.toFixed(2)} × ${pos.quantity} = ¥${calculatedTodayProfit.toFixed(2)}`);
            console.log(`    数据中today_profit: ¥${(pos.today_profit || 0).toFixed(2)}`);

            if (Math.abs(calculatedTodayProfit - (pos.today_profit || 0)) > 0.01) {
                console.log(`    ⚠️ 不一致！差异: ¥${(calculatedTodayProfit - (pos.today_profit || 0)).toFixed(2)}`);
            }
        } else {
            console.log(`    ⚠️ 没有昨收价数据`);
        }
        console.log();
    });

    const totalTodayProfit = positions.reduce((sum, pos) => sum + (pos.today_profit || 0), 0);
    console.log(`今日盈亏总计: ¥${totalTodayProfit.toFixed(2)}`);
    console.log(`数据库记录: ¥${recap.today_profit}\n`);

    // 计算正确的今日盈亏率
    const totalMarketValue = positions.reduce((sum, pos) => sum + (pos.market_value || pos.current_price * pos.quantity), 0);
    const yesterdayMarketValue = totalMarketValue - totalTodayProfit;

    console.log('市值计算:');
    console.log(`  当前市值: ¥${totalMarketValue.toFixed(2)}`);
    console.log(`  昨日市值: ¥${yesterdayMarketValue.toFixed(2)}`);
    console.log(`  今日盈亏率: ${totalTodayProfit.toFixed(2)} / ${yesterdayMarketValue.toFixed(2)} × 100 = ${(totalTodayProfit / yesterdayMarketValue * 100).toFixed(2)}%\n`);

    console.log('=== 检查完成 ===');

} catch (error) {
    console.error('❌ 检查过程出错:', error);
    console.error('错误详情:', error.message);
}
