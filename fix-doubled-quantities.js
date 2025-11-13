/**
 * 修复复盘表中双倍的持仓数量
 */

const { db } = require('./database');

console.log('=== 修复双倍持仓数量 ===\n');

try {
    const today = new Date().toISOString().split('T')[0];

    // 1. 查找今天的复盘记录
    console.log(`1️⃣ 查找 ${today} 的复盘记录...`);
    const recap = db.prepare(`
        SELECT id, position_data, today_profit
        FROM daily_recap
        WHERE recap_date = ?
    `).get(today);

    if (!recap) {
        console.log('   ❌ 没有找到今天的复盘记录');
        process.exit(1);
    }

    console.log(`   ✅ 找到复盘记录 ID: ${recap.id}`);
    console.log(`   原今日盈利: ¥${recap.today_profit}\n`);

    // 2. 解析并修复持仓数据
    const positions = JSON.parse(recap.position_data);
    console.log('2️⃣ 修复持仓数量（除以2）...\n');

    positions.forEach(pos => {
        console.log(`   ${pos.code} ${pos.name}:`);
        console.log(`      数量: ${pos.quantity} -> ${pos.quantity / 2}`);
        console.log(`      今日盈亏: ¥${(pos.today_profit || 0).toFixed(2)} -> ¥${((pos.today_profit || 0) / 2).toFixed(2)}`);
        console.log(`      总盈亏: ¥${(pos.total_profit || 0).toFixed(2)} -> ¥${((pos.total_profit || 0) / 2).toFixed(2)}`);
        console.log();

        // 修正数量
        pos.quantity = pos.quantity / 2;

        // 重新计算相关字段
        pos.cost = pos.cost_price * pos.quantity;
        pos.market_value = pos.current_price * pos.quantity;
        pos.total_profit = (pos.current_price - pos.cost_price) * pos.quantity;
        pos.profit_rate = pos.cost > 0 ? (pos.total_profit / pos.cost * 100) : 0;

        // 重新计算今日盈亏（如果有昨收价）
        if (pos.yesterday_close && pos.yesterday_close > 0) {
            pos.today_profit = (pos.current_price - pos.yesterday_close) * pos.quantity;
        } else {
            pos.today_profit = (pos.today_profit || 0) / 2;
        }
    });

    // 3. 重新计算汇总数据
    let newTodayProfit = 0;
    let newTotalProfit = 0;

    positions.forEach(pos => {
        newTodayProfit += pos.today_profit || 0;
        newTotalProfit += pos.total_profit || 0;
    });

    console.log('3️⃣ 更新后的汇总数据:');
    console.log(`   新今日盈利: ¥${newTodayProfit.toFixed(2)}`);
    console.log(`   新总盈亏: ¥${newTotalProfit.toFixed(2)}\n`);

    // 4. 更新数据库
    console.log('4️⃣ 更新复盘记录...');
    db.prepare(`
        UPDATE daily_recap
        SET position_data = ?,
            today_profit = ?,
            total_profit = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(JSON.stringify(positions), newTodayProfit, newTotalProfit, recap.id);

    console.log('   ✅ 更新成功\n');

    // 5. 验证
    console.log('5️⃣ 验证更新结果...');
    const updatedRecap = db.prepare(`
        SELECT position_data, today_profit, total_profit
        FROM daily_recap
        WHERE id = ?
    `).get(recap.id);

    const updatedPositions = JSON.parse(updatedRecap.position_data);
    console.log(`   持仓数量: ${updatedPositions.length}只`);
    updatedPositions.forEach(pos => {
        console.log(`      ${pos.code}: ${pos.quantity}股`);
    });
    console.log(`   今日盈利: ¥${updatedRecap.today_profit.toFixed(2)}`);
    console.log(`   总盈亏: ¥${updatedRecap.total_profit.toFixed(2)}\n`);

    console.log('=== 修复完成 ===');
    console.log('\n📍 请刷新浏览器页面查看修复后的数据\n');

} catch (error) {
    console.error('❌ 修复过程出错:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
}
