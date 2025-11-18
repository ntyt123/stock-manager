/**
 * 重新计算11月13日的今日盈亏（考虑印花税和过户费）
 */

const { db } = require('./database');

console.log('=== 重新计算11月13日今日盈亏（考虑印花税和过户费） ===\n');

const trades = db.prepare(`
    SELECT * FROM trade_operations
    WHERE DATE(trade_date) = '2025-11-13'
    ORDER BY created_at ASC
`).all();

console.log(`找到 ${trades.length} 条交易记录\n`);

// 构建交易映射
const tradeMap = {};
let totalStampTax = 0;
let totalTransferFee = 0;

trades.forEach(trade => {
    if (!tradeMap[trade.stock_code]) {
        tradeMap[trade.stock_code] = {
            name: trade.stock_name,
            buyQty: 0,
            sellQty: 0,
            buyAmount: 0,
            sellAmount: 0,
            stampTax: 0,
            transferFee: 0
        };
    }

    const amount = trade.quantity * trade.price;

    // 过户费：上海股票（6开头）万分之0.2
    const transferFee = trade.stock_code.startsWith('6') ? amount * 0.00002 : 0;

    if (trade.trade_type === 'buy' || trade.trade_type === 'add') {
        tradeMap[trade.stock_code].buyQty += trade.quantity;
        // 买入金额扣除过户费
        tradeMap[trade.stock_code].buyAmount += amount - transferFee;
        tradeMap[trade.stock_code].transferFee += transferFee;
        totalTransferFee += transferFee;
    } else if (trade.trade_type === 'sell' || trade.trade_type === 'reduce') {
        // 印花税：卖出收取千分之一
        const stampTax = amount * 0.001;
        tradeMap[trade.stock_code].sellQty += trade.quantity;
        // 卖出金额扣除印花税和过户费
        tradeMap[trade.stock_code].sellAmount += amount - stampTax - transferFee;
        tradeMap[trade.stock_code].stampTax += stampTax;
        tradeMap[trade.stock_code].transferFee += transferFee;
        totalStampTax += stampTax;
        totalTransferFee += transferFee;
    }
});

console.log(`总印花税: ¥${totalStampTax.toFixed(2)}`);
console.log(`总过户费: ¥${totalTransferFee.toFixed(2)}`);
console.log(`总费用: ¥${(totalStampTax + totalTransferFee).toFixed(2)}\n`);

// 11月13日的收盘价和昨收价
const prices = {
    '000572': { current: 10.04, yesterday: 9.13 },
    '600408': { current: 5.69, yesterday: 5.17 },
    '603122': { current: 22.1, yesterday: 20.09 },
    '601012': { current: 20.80, yesterday: 20.79 },
    '601929': { current: 4.11, yesterday: 4.15 }
};

// 11月13日的持仓
const positions = [
    { code: '000572', name: '海马汽车', quantity: 200 },
    { code: '600408', name: '安泰集团', quantity: 500 },
    { code: '603122', name: '合富中国', quantity: 100 }
];

let totalTodayProfit = 0;

console.log('持仓股票今日盈亏：\n');

positions.forEach(pos => {
    const trade = tradeMap[pos.code];
    const price = prices[pos.code];
    let todayProfit = 0;

    if (trade) {
        const yesterdayQty = pos.quantity - trade.buyQty + trade.sellQty;
        const yesterdayQtyStillHeld = Math.max(0, yesterdayQty - trade.sellQty);

        console.log(`${pos.code} ${pos.name}:`);
        console.log(`  昨持${yesterdayQty}股, 今买${trade.buyQty}股, 今卖${trade.sellQty}股, 现持${pos.quantity}股`);
        if (trade.stampTax > 0 || trade.transferFee > 0) {
            console.log(`  印花税: ¥${trade.stampTax.toFixed(2)}, 过户费: ¥${trade.transferFee.toFixed(2)}`);
        }

        // 1. 昨日持仓仍持有的部分
        if (yesterdayQtyStillHeld > 0) {
            const oldProfit = (price.current - price.yesterday) * yesterdayQtyStillHeld;
            todayProfit += oldProfit;
            console.log(`  昨日持仓盈亏: (${price.current} - ${price.yesterday}) × ${yesterdayQtyStillHeld} = ¥${oldProfit.toFixed(2)}`);
        }

        // 2. 今天新买入的部分（已扣除过户费）
        if (trade.buyQty > 0) {
            const avgBuyPrice = trade.buyAmount / trade.buyQty;
            const newBuyProfit = (price.current - avgBuyPrice) * trade.buyQty;
            todayProfit += newBuyProfit;
            console.log(`  新买入盈亏(扣过户费): (${price.current} - ${avgBuyPrice.toFixed(2)}) × ${trade.buyQty} = ¥${newBuyProfit.toFixed(2)}`);
        }

        // 3. 今天卖出的部分（已扣除印花税和过户费）
        if (trade.sellQty > 0) {
            const avgSellPrice = trade.sellAmount / trade.sellQty;
            const sellProfit = (avgSellPrice - price.yesterday) * trade.sellQty;
            todayProfit += sellProfit;
            console.log(`  卖出盈亏(扣印花税+过户费): (${avgSellPrice.toFixed(2)} - ${price.yesterday}) × ${trade.sellQty} = ¥${sellProfit.toFixed(2)}`);
        }

        console.log(`  总今日盈亏: ¥${todayProfit.toFixed(2)}\n`);
    }

    totalTodayProfit += todayProfit;
});

console.log('清仓股票今日盈亏：\n');

// 清仓的股票
const clearedStocks = ['601012', '601929'];
clearedStocks.forEach(code => {
    const trade = tradeMap[code];
    const price = prices[code];

    if (trade && trade.sellQty > 0) {
        const avgSellPrice = trade.sellAmount / trade.sellQty;
        const clearProfit = (avgSellPrice - price.yesterday) * trade.sellQty;
        totalTodayProfit += clearProfit;
        console.log(`${code}: (${avgSellPrice.toFixed(2)} - ${price.yesterday}) × ${trade.sellQty} = ¥${clearProfit.toFixed(2)} (印花税¥${trade.stampTax.toFixed(2)}, 过户费¥${trade.transferFee.toFixed(2)})`);
    }
});

console.log(`\n=== 今日盈亏总计: ¥${totalTodayProfit.toFixed(2)} ===`);
console.log(`=== 用户期望: ¥320.97 ===`);
console.log(`=== 差距: ¥${(totalTodayProfit - 320.97).toFixed(2)} ===`);
