/**
 * 检查 positions 表是否存在和结构
 */

const { db } = require('./database');

console.log('=== 检查数据库表结构 ===\n');

try {
    // 1. 检查表是否存在
    console.log('1️⃣ 检查表是否存在...');
    const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table'
        AND name IN ('positions', 'user_positions', 'manual_positions')
        ORDER BY name
    `).all();

    console.log('   现有表:', tables.map(t => t.name).join(', ') || '无');
    console.log();

    // 2. 检查 positions 表结构
    if (tables.some(t => t.name === 'positions')) {
        console.log('2️⃣ 检查 positions 表结构...');
        const columns = db.prepare(`PRAGMA table_info(positions)`).all();
        console.log('   字段列表:');
        columns.forEach(col => {
            console.log(`     - ${col.name} (${col.type})`);
        });
        console.log();

        // 3. 检查数据
        console.log('3️⃣ 检查 positions 表数据...');
        const count = db.prepare(`SELECT COUNT(*) as count FROM positions`).get();
        console.log(`   总记录数: ${count.count}`);

        if (count.count > 0) {
            const sample = db.prepare(`SELECT * FROM positions LIMIT 3`).all();
            console.log('   示例数据:');
            sample.forEach((row, i) => {
                console.log(`   [${i + 1}] ${row.stock_code} ${row.stock_name}, 数量: ${row.quantity}`);
            });
        }
        console.log();
    } else {
        console.log('❌ positions 表不存在！需要运行迁移脚本。\n');
    }

    // 4. 测试查询
    console.log('4️⃣ 测试查询语句...');
    try {
        const rows = db.prepare(`
            SELECT
                id,
                user_id,
                stock_code as stockCode,
                stock_name as stockName,
                quantity,
                cost_price as costPrice,
                current_price as currentPrice,
                market_value as marketValue,
                profit_loss as profitLoss,
                profit_loss_rate as profitLossRate,
                created_at,
                updated_at
            FROM positions
            WHERE user_id = ? AND quantity > 0
            ORDER BY updated_at DESC
        `).all(4);

        console.log(`   查询成功，返回 ${rows.length} 条记录`);
        console.log();
    } catch (queryError) {
        console.log(`   ❌ 查询失败: ${queryError.message}\n`);
    }

    // 5. 检查旧表
    if (tables.some(t => t.name === 'user_positions')) {
        console.log('5️⃣ 检查旧表 user_positions...');
        const oldCount = db.prepare(`SELECT COUNT(*) as count FROM user_positions`).get();
        console.log(`   记录数: ${oldCount.count}`);
        console.log('   ⚠️ 旧表仍然存在，迁移可能未完成\n');
    }

    if (tables.some(t => t.name === 'manual_positions')) {
        console.log('6️⃣ 检查旧表 manual_positions...');
        const oldCount = db.prepare(`SELECT COUNT(*) as count FROM manual_positions`).get();
        console.log(`   记录数: ${oldCount.count}`);
        console.log('   ⚠️ 旧表仍然存在，迁移可能未完成\n');
    }

    console.log('=== 检查完成 ===');

} catch (error) {
    console.error('❌ 检查过程出错:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
}
