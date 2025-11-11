/**
 * 检查复盘数据详情
 */

const Database = require('better-sqlite3');
const db = new Database('./stock_manager.db');

console.log('==================== 检查复盘数据详情 ====================\n');

const today = new Date().toISOString().split('T')[0];
const recap = db.prepare(`
    SELECT *
    FROM daily_recap
    WHERE recap_date = ? AND user_id = 1
`).get(today);

if (!recap) {
    console.log('❌ 今天还没有复盘数据');
    process.exit(0);
}

console.log(`📅 日期: ${recap.recap_date}`);
console.log(`📊 持仓数量: ${recap.position_count}支`);
console.log(`💰 今日盈亏: ¥${recap.today_profit}`);
console.log(`💵 总盈亏: ¥${recap.total_profit}`);
console.log(`🔖 今日无操作: ${recap.no_trading_today === 1 ? '是' : '否'}`);

// 解析持仓数据
if (recap.position_data) {
    try {
        const positions = JSON.parse(recap.position_data);
        console.log(`\n📋 持仓明细 (${positions.length}支):`);
        positions.forEach((pos, index) => {
            console.log(`  ${index + 1}. ${pos.code} ${pos.name}`);
            console.log(`     数量: ${pos.quantity}, 成本: ¥${pos.cost_price?.toFixed(2)}, 当前价: ¥${pos.current_price?.toFixed(2)}`);
            console.log(`     今日盈亏: ¥${pos.today_profit?.toFixed(2)}, 总盈亏: ¥${pos.total_profit?.toFixed(2)}`);
        });
    } catch (e) {
        console.log('\n❌ 解析持仓数据失败:', e.message);
    }
}

// 解析交易日志数据
if (recap.trading_logs_data) {
    try {
        const logs = JSON.parse(recap.trading_logs_data);
        console.log(`\n📝 交易日志 (${logs.length}条):`);
        if (logs.length === 0) {
            console.log('  无交易日志');
        } else {
            logs.forEach((log, index) => {
                console.log(`  ${index + 1}. ${log.log_type} - ${log.stock_code} ${log.stock_name}`);
                console.log(`     ${log.log_content}`);
            });
        }
    } catch (e) {
        console.log('\n❌ 解析交易日志失败:', e.message);
    }
}

db.close();
console.log('\n✅ 检查完成');
