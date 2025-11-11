/**
 * 清理 manual_positions 表中多余的持仓
 */

const Database = require('better-sqlite3');
const db = new Database('./stock_manager.db');

console.log('==================== 清理多余持仓 ====================\n');

// 要删除的股票代码
const stocksToDelete = ['600159', '600150', '600143'];

console.log('准备删除以下股票:');
stocksToDelete.forEach(code => {
    const stock = db.prepare(`
        SELECT stock_code, stock_name, quantity FROM manual_positions
        WHERE user_id = 4 AND stock_code = ?
    `).get(code);

    if (stock) {
        console.log(`  - ${stock.stock_code} ${stock.stock_name} (${stock.quantity}股)`);
    }
});

console.log('\n确认删除...');

stocksToDelete.forEach(code => {
    db.prepare(`
        DELETE FROM manual_positions WHERE user_id = 4 AND stock_code = ?
    `).run(code);
});

console.log('✅ 删除完成\n');

// 检查剩余持仓
const remaining = db.prepare(`
    SELECT stock_code, stock_name, quantity FROM manual_positions
    WHERE user_id = 4 AND quantity > 0
    ORDER BY stock_code
`).all();

console.log(`📋 剩余持仓 (${remaining.length} 支):`);
remaining.forEach((pos, idx) => {
    console.log(`  ${idx + 1}. ${pos.stock_code} ${pos.stock_name} (${pos.quantity}股)`);
});

db.close();
console.log('\n✅ 清理完成');
