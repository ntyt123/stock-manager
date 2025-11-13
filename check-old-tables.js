/**
 * 检查旧表（user_positions 和 manual_positions）中的数据
 */

const { db } = require('./database');

console.log('=== 检查旧表数据 ===\n');

try {
    const userId = 4; // 你的用户ID

    // 1. 检查所有表
    console.log('1️⃣ 检查数据库中的所有表...');
    const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table'
        ORDER BY name
    `).all();

    console.log('   现有表:');
    tables.forEach(t => console.log(`      - ${t.name}`));
    console.log();

    // 2. 检查 user_positions 表
    if (tables.some(t => t.name === 'user_positions')) {
        console.log('2️⃣ 检查 user_positions 表...');
        const userPositions = db.prepare(`
            SELECT id, user_id, stock_code, stock_name, quantity, cost_price, current_price
            FROM user_positions
            WHERE user_id = ?
        `).all(userId);

        console.log(`   记录数: ${userPositions.length}`);
        if (userPositions.length > 0) {
            userPositions.forEach(p => {
                console.log(`      ${p.stock_code} ${p.stock_name}: 数量=${p.quantity}, 成本=${p.cost_price}`);
            });
        }
        console.log();
    }

    // 3. 检查 manual_positions 表
    if (tables.some(t => t.name === 'manual_positions')) {
        console.log('3️⃣ 检查 manual_positions 表...');
        const manualPositions = db.prepare(`
            SELECT id, user_id, stock_code, stock_name, quantity, cost_price, current_price
            FROM manual_positions
            WHERE user_id = ?
        `).all(userId);

        console.log(`   记录数: ${manualPositions.length}`);
        if (manualPositions.length > 0) {
            manualPositions.forEach(p => {
                console.log(`      ${p.stock_code} ${p.stock_name}: 数量=${p.quantity}, 成本=${p.cost_price}`);
            });
        }
        console.log();
    }

    // 4. 检查 positions 表
    if (tables.some(t => t.name === 'positions')) {
        console.log('4️⃣ 检查 positions 表...');
        const positions = db.prepare(`
            SELECT id, user_id, stock_code, stock_name, quantity, cost_price, current_price, source
            FROM positions
            WHERE user_id = ?
        `).all(userId);

        console.log(`   记录数: ${positions.length}`);
        if (positions.length > 0) {
            positions.forEach(p => {
                console.log(`      ${p.stock_code} ${p.stock_name}: 数量=${p.quantity}, 成本=${p.cost_price}, 来源=${p.source}`);
            });
        }
        console.log();
    }

    console.log('=== 检查完成 ===');

} catch (error) {
    console.error('❌ 检查过程出错:', error);
    console.error('错误详情:', error.message);
}
