/**
 * 添加测试数据到本地数据库
 */

const { db } = require('./database');

console.log('=== 添加测试数据 ===\n');

try {
    const userId = 4;

    // 1. 清空现有数据
    console.log('1️⃣ 清空现有数据...');
    db.prepare('DELETE FROM positions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM trade_operations WHERE user_id = ?').run(userId);
    console.log('   ✅ 已清空\n');

    // 2. 添加测试持仓（模拟你的实际持仓）
    console.log('2️⃣ 添加测试持仓...');

    const testPositions = [
        { code: '000572', name: '海马汽车', quantity: 200, costPrice: 9.295 },
        { code: '600408', name: '安泰集团', quantity: 500, costPrice: 5.69 },
        { code: '603122', name: '合富中国', quantity: 100, costPrice: 21.9 }
    ];

    for (const pos of testPositions) {
        db.prepare(`
            INSERT INTO positions
            (user_id, stock_code, stock_name, quantity, cost_price, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'manual', datetime('now', 'localtime'), datetime('now', 'localtime'))
        `).run(userId, pos.code, pos.name, pos.quantity, pos.costPrice);

        console.log(`   ✅ ${pos.code} ${pos.name}: ${pos.quantity}股, 成本¥${pos.costPrice}`);
    }
    console.log();

    // 3. 验证数据
    console.log('3️⃣ 验证插入的数据...');
    const positions = db.prepare(`
        SELECT stock_code, stock_name, quantity, cost_price
        FROM positions
        WHERE user_id = ?
    `).all(userId);

    console.log(`   共 ${positions.length} 条持仓记录:`);
    positions.forEach(p => {
        console.log(`      ${p.stock_code} ${p.stock_name}: ${p.quantity}股`);
    });
    console.log();

    console.log('=== 测试数据添加完成 ===');
    console.log('\n📍 请在浏览器中访问: http://localhost:3000');
    console.log('📍 使用用户ID 4 登录即可看到测试数据\n');

} catch (error) {
    console.error('❌ 添加数据出错:', error);
    console.error('错误详情:', error.message);
}
