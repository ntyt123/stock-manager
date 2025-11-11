/**
 * 检查持仓数据的脚本
 */

const Database = require('better-sqlite3');
const db = new Database('./stock_manager.db');

console.log('==================== 检查持仓数据 ====================\n');

// 查询手动录入的持仓
console.log('📋 manual_positions 表（手动录入）:');
const manualPositions = db.prepare(`
    SELECT stock_code, stock_name, quantity, cost_price
    FROM manual_positions
    WHERE user_id = 1 AND quantity > 0
    ORDER BY stock_code
`).all();

console.log(`总数: ${manualPositions.length}条`);
manualPositions.forEach((pos, index) => {
    console.log(`  ${index + 1}. ${pos.stock_code} ${pos.stock_name} - 数量: ${pos.quantity}, 成本: ¥${pos.cost_price}`);
});

console.log('\n📊 user_positions 表（系统计算）:');
const userPositions = db.prepare(`
    SELECT stockCode, stockName, quantity, costPrice
    FROM user_positions
    WHERE user_id = 1 AND quantity > 0
    ORDER BY stockCode
`).all();

console.log(`总数: ${userPositions.length}条`);
userPositions.forEach((pos, index) => {
    console.log(`  ${index + 1}. ${pos.stockCode} ${pos.stockName} - 数量: ${pos.quantity}, 成本: ¥${pos.costPrice}`);
});

// 合并去重后的股票代码
const allStockCodes = new Set();
manualPositions.forEach(pos => allStockCodes.add(pos.stock_code));
userPositions.forEach(pos => allStockCodes.add(pos.stockCode));

console.log('\n🔄 合并去重后:');
console.log(`总数: ${allStockCodes.size}支股票`);
console.log(`股票代码: ${Array.from(allStockCodes).join(', ')}`);

// 检查是否有重复
console.log('\n🔍 检查重复:');
const duplicates = [];
allStockCodes.forEach(code => {
    const inManual = manualPositions.some(pos => pos.stock_code === code);
    const inUser = userPositions.some(pos => pos.stockCode === code);
    if (inManual && inUser) {
        duplicates.push(code);
    }
});

if (duplicates.length > 0) {
    console.log(`⚠️ 发现 ${duplicates.length} 支股票在两个表中都存在:`);
    duplicates.forEach(code => console.log(`  - ${code}`));
} else {
    console.log('✅ 没有重复的股票');
}

// 检查今天的复盘数据
console.log('\n==================== 检查今日复盘数据 ====================\n');
const today = new Date().toISOString().split('T')[0];
const recap = db.prepare(`
    SELECT
        recap_date,
        position_count,
        today_profit,
        total_profit,
        no_trading_today
    FROM daily_recap
    WHERE recap_date = ? AND user_id = 1
`).get(today);

if (recap) {
    console.log(`📅 日期: ${recap.recap_date}`);
    console.log(`📊 持仓数量: ${recap.position_count}支`);
    console.log(`💰 今日盈亏: ¥${recap.today_profit}`);
    console.log(`💵 总盈亏: ¥${recap.total_profit}`);
    console.log(`🔖 今日无操作: ${recap.no_trading_today === 1 ? '是' : '否'}`);
} else {
    console.log('❌ 今天还没有复盘数据');
}

db.close();
console.log('\n✅ 检查完成');
