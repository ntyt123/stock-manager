/**
 * 检查今天的交易记录
 */

const { db } = require('./database');

console.log('=== 检查今天的交易记录 ===\n');

try {
    const userId = 4;
    const today = new Date().toISOString().split('T')[0];

    // 1. 查询今天的所有交易
    console.log(`1️⃣ 查询 ${today} 的交易记录...`);
    const todayTrades = db.prepare(`
        SELECT id, trade_type, trade_date, stock_code, stock_name, quantity, price, created_at
        FROM trade_operations
        WHERE user_id = ? AND DATE(trade_date) = ?
        ORDER BY created_at ASC
    `).all(userId, today);

    if (todayTrades.length === 0) {
        console.log('   ✅ 今天没有交易记录\n');
    } else {
        console.log(`   ❌ 今天有 ${todayTrades.length} 条交易记录:\n`);
        todayTrades.forEach((trade, i) => {
            console.log(`   [${i + 1}] ${trade.stock_code} ${trade.stock_name}`);
            console.log(`       操作: ${trade.trade_type === 'buy' ? '买入' : trade.trade_type === 'sell' ? '卖出' : trade.trade_type}`);
            console.log(`       数量: ${trade.quantity}股`);
            console.log(`       价格: ¥${trade.price}`);
            console.log(`       时间: ${trade.created_at}`);
            console.log();
        });
    }

    // 2. 查询所有交易，计算每只股票今天开盘前的持仓
    console.log('2️⃣ 计算今天开盘前的持仓数量...\n');

    const allTrades = db.prepare(`
        SELECT stock_code, stock_name, trade_type, quantity, trade_date, created_at
        FROM trade_operations
        WHERE user_id = ?
        ORDER BY created_at ASC
    `).all(userId);

    const stockPositions = {};

    allTrades.forEach(trade => {
        if (!stockPositions[trade.stock_code]) {
            stockPositions[trade.stock_code] = {
                name: trade.stock_name,
                quantityBeforeToday: 0,
                quantityNow: 0,
                todayTrades: []
            };
        }

        const isToday = trade.trade_date.startsWith(today);
        const qty = trade.quantity;

        if (trade.trade_type === 'buy' || trade.trade_type === 'add') {
            stockPositions[trade.stock_code].quantityNow += qty;
            if (!isToday) {
                stockPositions[trade.stock_code].quantityBeforeToday += qty;
            }
        } else if (trade.trade_type === 'sell' || trade.trade_type === 'reduce') {
            stockPositions[trade.stock_code].quantityNow -= qty;
            if (!isToday) {
                stockPositions[trade.stock_code].quantityBeforeToday -= qty;
            }
        }

        if (isToday) {
            stockPositions[trade.stock_code].todayTrades.push({
                type: trade.trade_type,
                quantity: qty,
                time: trade.created_at
            });
        }
    });

    console.log('   持仓变化情况:\n');
    for (const [code, data] of Object.entries(stockPositions)) {
        if (data.quantityNow > 0 || data.quantityBeforeToday > 0) {
            console.log(`   ${code} ${data.name}:`);
            console.log(`      昨日收盘持仓: ${data.quantityBeforeToday}股`);
            console.log(`      当前持仓: ${data.quantityNow}股`);

            if (data.todayTrades.length > 0) {
                console.log(`      今日操作:`);
                data.todayTrades.forEach(t => {
                    console.log(`        - ${t.type} ${t.quantity}股 (${t.time})`);
                });
            }
            console.log();
        }
    }

    // 3. 对比复盘表中的数量
    console.log('3️⃣ 对比复盘表中的持仓数量...\n');
    const recap = db.prepare(`
        SELECT position_data
        FROM daily_recap
        WHERE recap_date = ?
    `).get(today);

    if (recap) {
        const recapPositions = JSON.parse(recap.position_data);
        recapPositions.forEach(pos => {
            const actual = stockPositions[pos.code];
            if (actual) {
                console.log(`   ${pos.code} ${pos.name}:`);
                console.log(`      复盘表数量: ${pos.quantity}股`);
                console.log(`      昨日持仓: ${actual.quantityBeforeToday}股`);
                console.log(`      当前持仓: ${actual.quantityNow}股`);

                if (pos.quantity !== actual.quantityBeforeToday && pos.quantity === actual.quantityNow) {
                    console.log(`      ⚠️ 今日盈亏应使用昨日持仓 ${actual.quantityBeforeToday}股，而不是当前 ${pos.quantity}股！`);
                }
                console.log();
            }
        });
    }

    console.log('=== 检查完成 ===');

} catch (error) {
    console.error('❌ 检查过程出错:', error);
    console.error('错误详情:', error.message);
}
