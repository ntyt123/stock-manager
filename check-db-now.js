/**
 * 实时检查数据库中的持仓数据
 */

const Database = require('better-sqlite3');
const db = new Database('./stock_manager.db');

console.log('==================== 实时数据库检查 ====================\n');

// 查询 manual_positions
const manualCount = db.prepare(`
    SELECT COUNT(*) as count FROM manual_positions WHERE user_id = 1 AND quantity > 0
`).get();

console.log(`📋 manual_positions 表（quantity > 0）: ${manualCount.count} 条`);

const manualAll = db.prepare(`
    SELECT stock_code, stock_name, quantity FROM manual_positions WHERE user_id = 1 AND quantity > 0
`).all();

if (manualAll.length > 0) {
    manualAll.forEach((pos, idx) => {
        console.log(`  ${idx + 1}. ${pos.stock_code} ${pos.stock_name} - 数量: ${pos.quantity}`);
    });
}

// 查询 user_positions
const userCount = db.prepare(`
    SELECT COUNT(*) as count FROM user_positions WHERE user_id = 1 AND quantity > 0
`).get();

console.log(`\n📊 user_positions 表（quantity > 0）: ${userCount.count} 条`);

const userAll = db.prepare(`
    SELECT stockCode, stockName, quantity FROM user_positions WHERE user_id = 1 AND quantity > 0
`).all();

if (userAll.length > 0) {
    userAll.forEach((pos, idx) => {
        console.log(`  ${idx + 1}. ${pos.stockCode} ${pos.stockName} - 数量: ${pos.quantity}`);
    });
}

// 查询今天的复盘数据
const today = new Date().toISOString().split('T')[0];
const recap = db.prepare(`
    SELECT position_count, position_data FROM daily_recap WHERE recap_date = ? AND user_id = 1
`).get(today);

if (recap) {
    console.log(`\n📅 今日复盘数据（${today}）:`);
    console.log(`  持仓数量: ${recap.position_count}`);

    if (recap.position_data) {
        const positions = JSON.parse(recap.position_data);
        console.log(`  持仓明细: ${positions.length} 支`);
        positions.forEach((pos, idx) => {
            console.log(`    ${idx + 1}. ${pos.code} ${pos.name}`);
        });
    }
}

db.close();
console.log('\n✅ 检查完成');
