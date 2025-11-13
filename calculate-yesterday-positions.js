/**
 * 根据今天的交易计算昨日持仓
 */

const { db } = require('./database');

console.log('=== 计算昨日持仓数量 ===\n');

try {
    const userId = 1; // 正确的用户ID
    const today = new Date().toISOString().split('T')[0];

    // 1. 查询当前复盘数据中的持仓
    console.log('1️⃣ 当前复盘数据中的持仓（交易后）...\n');
    const recap = db.prepare(`
        SELECT position_data
        FROM daily_recap
        WHERE recap_date = ?
    `).get(today);

    const currentPositions = recap ? JSON.parse(recap.position_data) : [];

    const positionMap = {};
    currentPositions.forEach(pos => {
        positionMap[pos.code] = {
            name: pos.name,
            currentQty: pos.quantity,
            yesterdayQty: pos.quantity, // 默认和当前一样
            currentPrice: pos.current_price,
            yesterdayClose: pos.yesterday_close,
            todayProfit: pos.today_profit
        };
        console.log(`   ${pos.code} ${pos.name}: ${pos.quantity}股`);
    });
    console.log();

    // 2. 查询今天的交易，计算净变化
    console.log('2️⃣ 今天的交易记录...\n');
    const todayTrades = db.prepare(`
        SELECT stock_code, stock_name, trade_type, quantity, price, created_at
        FROM trade_operations
        WHERE user_id = ? AND DATE(trade_date) = ?
        ORDER BY created_at ASC
    `).all(userId, today);

    const tradeChanges = {};

    todayTrades.forEach(trade => {
        if (!tradeChanges[trade.stock_code]) {
            tradeChanges[trade.stock_code] = {
                name: trade.stock_name,
                netChange: 0,
                trades: []
            };
        }

        const qty = trade.quantity;
        if (trade.trade_type === 'buy' || trade.trade_type === 'add') {
            tradeChanges[trade.stock_code].netChange += qty;
        } else if (trade.trade_type === 'sell' || trade.trade_type === 'reduce') {
            tradeChanges[trade.stock_code].netChange -= qty;
        }

        tradeChanges[trade.stock_code].trades.push({
            type: trade.trade_type,
            quantity: qty,
            time: trade.created_at
        });
    });

    for (const [code, data] of Object.entries(tradeChanges)) {
        console.log(`   ${code} ${data.name}:`);
        data.trades.forEach(t => {
            console.log(`      ${t.time}: ${t.type} ${t.quantity}股`);
        });
        console.log(`      净变化: ${data.netChange > 0 ? '+' : ''}${data.netChange}股`);
        console.log();
    }

    // 3. 计算昨日持仓
    console.log('3️⃣ 计算昨日持仓（今日持仓 - 今日净变化）...\n');

    for (const [code, change] of Object.entries(tradeChanges)) {
        if (positionMap[code]) {
            // 当前仍持有的股票
            positionMap[code].yesterdayQty = positionMap[code].currentQty - change.netChange;
            console.log(`   ${code} ${change.name}:`);
            console.log(`      今日持仓: ${positionMap[code].currentQty}股`);
            console.log(`      今日净变化: ${change.netChange > 0 ? '+' : ''}${change.netChange}股`);
            console.log(`      昨日持仓: ${positionMap[code].yesterdayQty}股`);
        } else {
            // 今天清仓的股票
            console.log(`   ${code} ${change.name}:`);
            console.log(`      今日持仓: 0股（已清仓）`);
            console.log(`      今日净变化: ${change.netChange}股`);
            console.log(`      昨日持仓: ${-change.netChange}股`);

            positionMap[code] = {
                name: change.name,
                currentQty: 0,
                yesterdayQty: -change.netChange,
                currentPrice: 0,
                yesterdayClose: 0,
                todayProfit: 0
            };
        }
        console.log();
    }

    // 4. 重新计算正确的今日盈亏
    console.log('4️⃣ 重新计算正确的今日盈亏...\n');

    let totalTodayProfit = 0;

    for (const [code, pos] of Object.entries(positionMap)) {
        if (pos.yesterdayClose && pos.yesterdayClose > 0 && pos.yesterdayQty > 0) {
            // 使用昨日持仓数量计算今日盈亏
            const correctTodayProfit = (pos.currentPrice - pos.yesterdayClose) * pos.yesterdayQty;
            totalTodayProfit += correctTodayProfit;

            console.log(`   ${code} ${pos.name}:`);
            console.log(`      昨日持仓: ${pos.yesterdayQty}股`);
            console.log(`      昨收价: ¥${pos.yesterdayClose}`);
            console.log(`      今收价: ¥${pos.currentPrice}`);
            console.log(`      正确今日盈亏: (${pos.currentPrice} - ${pos.yesterdayClose}) × ${pos.yesterdayQty} = ¥${correctTodayProfit.toFixed(2)}`);
            console.log(`      原today_profit: ¥${(pos.todayProfit || 0).toFixed(2)}`);
            console.log();
        }
    }

    console.log(`正确的今日盈亏总计: ¥${totalTodayProfit.toFixed(2)}`);
    console.log(`当前数据库记录: ¥${recap ? JSON.parse(recap.position_data).reduce((sum, p) => sum + (p.today_profit || 0), 0).toFixed(2) : '0.00'}\n`);

    console.log('=== 计算完成 ===');

} catch (error) {
    console.error('❌ 计算过程出错:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
}
