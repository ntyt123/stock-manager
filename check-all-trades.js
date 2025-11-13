/**
 * 检查所有交易记录
 */

const { db } = require('./database');

console.log('=== 检查所有交易记录 ===\n');

try {
    // 1. 检查所有用户的交易
    console.log('1️⃣ 查询所有交易记录...');
    const allTrades = db.prepare(`
        SELECT user_id, COUNT(*) as count
        FROM trade_operations
        GROUP BY user_id
    `).all();

    if (allTrades.length === 0) {
        console.log('   ❌ trade_operations 表为空\n');
    } else {
        console.log(`   找到 ${allTrades.length} 个用户的交易记录:`);
        allTrades.forEach(u => {
            console.log(`      用户ID ${u.user_id}: ${u.count} 条交易`);
        });
        console.log();
    }

    // 2. 查询最近的交易
    console.log('2️⃣ 查询最近10条交易...');
    const recentTrades = db.prepare(`
        SELECT id, user_id, trade_type, trade_date, stock_code, stock_name, quantity, price, created_at
        FROM trade_operations
        ORDER BY created_at DESC
        LIMIT 10
    `).all();

    if (recentTrades.length === 0) {
        console.log('   ❌ 没有任何交易记录\n');
    } else {
        recentTrades.forEach((t, i) => {
            console.log(`   [${i + 1}] ${t.trade_date} ${t.stock_code} ${t.stock_name}`);
            console.log(`       用户ID: ${t.user_id}, 操作: ${t.trade_type}, 数量: ${t.quantity}股`);
        });
        console.log();
    }

    // 3. 检查今天的交易（所有用户）
    const today = new Date().toISOString().split('T')[0];
    console.log(`3️⃣ 查询 ${today} 的所有交易...`);
    const todayTrades = db.prepare(`
        SELECT user_id, stock_code, stock_name, trade_type, quantity, trade_date
        FROM trade_operations
        WHERE DATE(trade_date) = ?
        ORDER BY created_at DESC
    `).all(today);

    if (todayTrades.length === 0) {
        console.log(`   ❌ 今天没有任何交易记录\n`);
    } else {
        console.log(`   找到 ${todayTrades.length} 条交易:`);
        todayTrades.forEach((t, i) => {
            console.log(`   [${i + 1}] 用户${t.user_id}: ${t.trade_type} ${t.stock_code} ${t.stock_name} ${t.quantity}股`);
        });
        console.log();
    }

    // 4. 检查表结构
    console.log('4️⃣ 检查 trade_operations 表结构...');
    const tableInfo = db.prepare(`PRAGMA table_info(trade_operations)`).all();
    console.log('   字段列表:');
    tableInfo.forEach(col => {
        console.log(`      - ${col.name} (${col.type})`);
    });
    console.log();

    console.log('=== 检查完成 ===');

} catch (error) {
    console.error('❌ 检查过程出错:', error);
    console.error('错误详情:', error.message);
}
