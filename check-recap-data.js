/**
 * 检查复盘表中的数据
 */

const { db } = require('./database');

console.log('=== 检查复盘表数据 ===\n');

try {
    const userId = 4;
    const today = new Date().toISOString().split('T')[0];

    // 1. 查找今天的复盘记录
    console.log(`1️⃣ 查找 ${today} 的复盘记录...`);
    const recap = db.prepare(`
        SELECT id, recap_date, position_data, today_profit, total_profit, position_count
        FROM daily_recap
        WHERE recap_date = ?
        LIMIT 1
    `).get(today);

    if (recap) {
        console.log(`   ✅ 找到复盘记录 ID: ${recap.id}`);
        console.log(`      今日盈利: ${recap.today_profit}`);
        console.log(`      总盈利: ${recap.total_profit}`);
        console.log(`      持仓数量: ${recap.position_count}\n`);

        // 解析持仓数据
        if (recap.position_data) {
            const positions = JSON.parse(recap.position_data);
            console.log('2️⃣ 复盘表中的持仓数据:\n');
            positions.forEach((pos, i) => {
                console.log(`   [${i + 1}] ${pos.code} ${pos.name}`);
                console.log(`       数量: ${pos.quantity}股`);
                console.log(`       成本: ¥${pos.cost_price}`);
                console.log(`       当前价: ¥${pos.current_price}`);
                console.log(`       今日盈亏: ¥${pos.today_profit || 0}`);
                console.log();
            });

            // 计算今日盈亏总和
            const totalTodayProfit = positions.reduce((sum, pos) => sum + (pos.today_profit || 0), 0);
            console.log(`3️⃣ 计算今日盈亏总和: ¥${totalTodayProfit.toFixed(2)}`);
            console.log(`   数据库中记录: ¥${recap.today_profit}`);

            if (Math.abs(totalTodayProfit - recap.today_profit) > 0.01) {
                console.log(`   ⚠️ 不一致！差异: ¥${(totalTodayProfit - recap.today_profit).toFixed(2)}\n`);
            } else {
                console.log(`   ✅ 一致\n`);
            }
        }
    } else {
        console.log(`   ❌ 没有今天的复盘记录\n`);

        // 查找最近的复盘记录
        console.log('2️⃣ 查找最近的复盘记录...');
        const latestRecap = db.prepare(`
            SELECT id, recap_date, today_profit, position_count
            FROM daily_recap
            ORDER BY recap_date DESC
            LIMIT 1
        `).get();

        if (latestRecap) {
            console.log(`   最近的复盘: ${latestRecap.recap_date}`);
            console.log(`      今日盈利: ${latestRecap.today_profit}`);
            console.log(`      持仓数量: ${latestRecap.position_count}\n`);
        } else {
            console.log(`   ❌ 没有任何复盘记录\n`);
        }
    }

    console.log('=== 检查完成 ===');

} catch (error) {
    console.error('❌ 检查过程出错:', error);
    console.error('错误详情:', error.message);
}
