/**
 * 检查持仓数量是否正确
 */

const { db } = require('./database');

console.log('=== 检查持仓数量 ===\n');

try {
    const userId = 4; // 你的用户ID

    // 1. 查看 positions 表中的所有持仓
    console.log('1️⃣ 查看 positions 表的持仓...');
    const positions = db.prepare(`
        SELECT id, stock_code, stock_name, quantity, cost_price, source, created_at
        FROM positions
        WHERE user_id = ?
        ORDER BY stock_code, id
    `).all(userId);

    console.log(`   共 ${positions.length} 条记录:\n`);
    positions.forEach((pos, i) => {
        console.log(`   [${i + 1}] ${pos.stock_code} ${pos.stock_name}`);
        console.log(`       ID: ${pos.id}`);
        console.log(`       数量: ${pos.quantity} 股`);
        console.log(`       成本: ¥${pos.cost_price}`);
        console.log(`       来源: ${pos.source}`);
        console.log(`       创建时间: ${pos.created_at}`);
        console.log();
    });

    // 2. 检查是否有重复的股票代码
    console.log('2️⃣ 检查重复记录...');
    const duplicates = db.prepare(`
        SELECT stock_code, COUNT(*) as count, GROUP_CONCAT(id) as ids
        FROM positions
        WHERE user_id = ?
        GROUP BY stock_code
        HAVING COUNT(*) > 1
    `).all(userId);

    if (duplicates.length > 0) {
        console.log(`   ❌ 发现 ${duplicates.length} 个股票有重复记录:`);
        duplicates.forEach(dup => {
            console.log(`      ${dup.stock_code}: ${dup.count} 条 (IDs: ${dup.ids})`);
        });
    } else {
        console.log('   ✅ 没有重复记录');
    }
    console.log();

    // 3. 查看交易历史，计算理论持仓数量
    console.log('3️⃣ 根据交易历史计算理论持仓...');
    const trades = db.prepare(`
        SELECT stock_code, stock_name, trade_type, quantity, price, trade_date
        FROM trade_operations
        WHERE user_id = ?
        ORDER BY stock_code, trade_date
    `).all(userId);

    const stockQuantities = {};

    trades.forEach(trade => {
        if (!stockQuantities[trade.stock_code]) {
            stockQuantities[trade.stock_code] = {
                name: trade.stock_name,
                quantity: 0,
                trades: []
            };
        }

        if (trade.trade_type === 'buy' || trade.trade_type === 'add') {
            stockQuantities[trade.stock_code].quantity += trade.quantity;
        } else if (trade.trade_type === 'sell' || trade.trade_type === 'reduce') {
            stockQuantities[trade.stock_code].quantity -= trade.quantity;
        }

        stockQuantities[trade.stock_code].trades.push({
            type: trade.trade_type,
            quantity: trade.quantity,
            date: trade.trade_date
        });
    });

    console.log('   根据交易历史计算的理论持仓:\n');
    for (const [code, data] of Object.entries(stockQuantities)) {
        if (data.quantity > 0) {
            console.log(`   ${code} ${data.name}: ${data.quantity} 股`);
            console.log(`      交易历史:`);
            data.trades.forEach(t => {
                console.log(`        - ${t.date}: ${t.type} ${t.quantity}股`);
            });
            console.log();
        }
    }

    // 4. 对比实际持仓和理论持仓
    console.log('4️⃣ 对比实际持仓 vs 理论持仓...\n');
    positions.forEach(pos => {
        const theoretical = stockQuantities[pos.stock_code];
        if (theoretical) {
            const diff = pos.quantity - theoretical.quantity;
            if (Math.abs(diff) > 0.01) {
                console.log(`   ❌ ${pos.stock_code} ${pos.stock_name}`);
                console.log(`      实际持仓: ${pos.quantity} 股`);
                console.log(`      理论持仓: ${theoretical.quantity} 股`);
                console.log(`      差异: ${diff > 0 ? '+' : ''}${diff} 股`);
                console.log();
            } else {
                console.log(`   ✅ ${pos.stock_code} ${pos.stock_name}: 数量一致 (${pos.quantity}股)`);
            }
        } else {
            console.log(`   ⚠️ ${pos.stock_code} ${pos.stock_name}: 没有交易历史`);
        }
    });

    console.log('\n=== 检查完成 ===');

} catch (error) {
    console.error('❌ 检查过程出错:', error);
    console.error('错误详情:', error.message);
}
