/**
 * 检查 positions 表中是否有重复记录
 */

const { db } = require('./database');

console.log('=== 检查 positions 表重复记录 ===\n');

try {
    const userId = 4; // 你的用户ID

    // 1. 查询所有持仓
    console.log('1️⃣ 查询所有持仓记录...');
    const allPositions = db.prepare(`
        SELECT id, user_id, stock_code, stock_name, quantity, cost_price, current_price, source
        FROM positions
        WHERE user_id = ?
        ORDER BY stock_code, id
    `).all(userId);

    console.log(`   总记录数: ${allPositions.length}`);
    console.log();

    // 2. 查找重复的股票代码
    console.log('2️⃣ 检查是否有重复的股票代码...');
    const duplicates = db.prepare(`
        SELECT stock_code, COUNT(*) as count
        FROM positions
        WHERE user_id = ?
        GROUP BY stock_code
        HAVING COUNT(*) > 1
    `).all(userId);

    if (duplicates.length > 0) {
        console.log(`   ❌ 发现 ${duplicates.length} 个股票有重复记录：`);
        duplicates.forEach(dup => {
            console.log(`      ${dup.stock_code}: ${dup.count} 条记录`);

            // 显示该股票的所有记录
            const records = allPositions.filter(p => p.stock_code === dup.stock_code);
            records.forEach(r => {
                console.log(`         - ID: ${r.id}, 数量: ${r.quantity}, 成本: ${r.cost_price}, 来源: ${r.source}`);
            });
        });
        console.log();
    } else {
        console.log('   ✅ 没有发现重复记录');
        console.log();
    }

    // 3. 显示所有持仓
    console.log('3️⃣ 当前所有持仓:');
    allPositions.forEach((pos, i) => {
        console.log(`   [${i + 1}] ${pos.stock_code} ${pos.stock_name}`);
        console.log(`       数量: ${pos.quantity}, 成本: ${pos.cost_price}, 来源: ${pos.source}, ID: ${pos.id}`);
    });
    console.log();

    console.log('=== 检查完成 ===');

} catch (error) {
    console.error('❌ 检查过程出错:', error);
    console.error('错误详情:', error.message);
}
