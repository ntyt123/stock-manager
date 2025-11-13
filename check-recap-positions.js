/**
 * 检查复盘表中的持仓数据
 */

const { db } = require('./database');

console.log('=== 检查复盘表中的持仓数据 ===\n');

try {
    const userId = 4; // 你的用户ID
    const today = new Date().toISOString().split('T')[0];

    // 1. 查询今天的复盘记录
    console.log(`1️⃣ 查询 ${today} 的复盘记录...`);
    const recap = db.prepare(`
        SELECT id, recap_date, user_id, position_data, today_profit, total_profit, position_count
        FROM daily_recap
        WHERE user_id = ? AND recap_date = ?
    `).get(userId, today);

    if (recap) {
        console.log(`   找到复盘记录 ID: ${recap.id}`);
        console.log(`   今日盈利: ${recap.today_profit}`);
        console.log(`   总盈利: ${recap.total_profit}`);
        console.log(`   持仓数量: ${recap.position_count}`);
        console.log();

        // 2. 解析持仓数据
        if (recap.position_data) {
            console.log('2️⃣ 解析持仓数据...');
            try {
                const positions = JSON.parse(recap.position_data);
                console.log(`   持仓数量: ${positions.length}只`);
                console.log();

                console.log('3️⃣ 持仓列表:');
                positions.forEach((pos, i) => {
                    console.log(`   [${i + 1}] ${pos.code} ${pos.name}`);
                    console.log(`       数量: ${pos.quantity}, 成本: ${pos.cost_price}`);
                    console.log(`       当前价: ${pos.current_price}, 今日盈亏: ${pos.today_profit || 0}`);
                    console.log(`       昨收价: ${pos.yesterday_close || 'N/A'}`);
                });
                console.log();

                // 4. 计算今日盈利
                const totalTodayProfit = positions.reduce((sum, pos) => sum + (pos.today_profit || 0), 0);
                console.log(`4️⃣ 计算今日盈利总和: ${totalTodayProfit.toFixed(2)}`);
                console.log(`   数据库中的today_profit: ${recap.today_profit}`);
                if (Math.abs(totalTodayProfit - recap.today_profit) > 0.01) {
                    console.log(`   ⚠️ 警告: 计算值与数据库值不一致！`);
                }
            } catch (e) {
                console.log(`   ❌ 解析失败: ${e.message}`);
            }
        } else {
            console.log('   ⚠️ 没有持仓数据');
        }
    } else {
        console.log(`   ❌ 未找到今天的复盘记录`);
        console.log();

        // 查找最近的复盘记录
        console.log('2️⃣ 查找最近的复盘记录...');
        const latestRecap = db.prepare(`
            SELECT id, recap_date, user_id, position_data, today_profit, total_profit, position_count
            FROM daily_recap
            WHERE user_id = ?
            ORDER BY recap_date DESC
            LIMIT 1
        `).get(userId);

        if (latestRecap) {
            console.log(`   找到最近的复盘记录 (日期: ${latestRecap.recap_date})`);
            console.log(`   今日盈利: ${latestRecap.today_profit}`);
            console.log(`   总盈利: ${latestRecap.total_profit}`);
            console.log(`   持仓数量: ${latestRecap.position_count}`);
        } else {
            console.log(`   ❌ 没有任何复盘记录`);
        }
    }

    console.log();
    console.log('=== 检查完成 ===');

} catch (error) {
    console.error('❌ 检查过程出错:', error);
    console.error('错误详情:', error.message);
}
