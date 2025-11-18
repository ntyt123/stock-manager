/**
 * 测试603122的不同计算方式
 */

console.log('=== 603122 合富中国 不同计算方式对比 ===\n');

const yesterdayClose = 20.09;
const todayClose = 22.1;
const buyPrice = 21.9;
const sellPrice = 21.63;

const yesterdayQty = 100;
const todayBuy = 100;
const todaySell = 100;
const currentQty = 100;

console.log('基本数据:');
console.log(`  昨收: ¥${yesterdayClose}`);
console.log(`  今收: ¥${todayClose}`);
console.log(`  买入价: ¥${buyPrice}`);
console.log(`  卖出价: ¥${sellPrice}`);
console.log(`  昨日持仓: ${yesterdayQty}股`);
console.log(`  今日买入: ${todayBuy}股`);
console.log(`  今日卖出: ${todaySell}股`);
console.log(`  当前持仓: ${currentQty}股\n`);

// 方法1：先进先出（FIFO）
console.log('方法1：先进先出（FIFO）');
console.log('  卖出的是昨天的100股，剩下的是今天买入的100股');
const method1_newBuy = (todayClose - buyPrice) * todayBuy;
const method1_sell = (sellPrice - yesterdayClose) * todaySell;
const method1_total = method1_newBuy + method1_sell;
console.log(`  新买入盈亏: (${todayClose} - ${buyPrice}) × ${todayBuy} = ¥${method1_newBuy.toFixed(2)}`);
console.log(`  卖出盈亏: (${sellPrice} - ${yesterdayClose}) × ${todaySell} = ¥${method1_sell.toFixed(2)}`);
console.log(`  总盈亏: ¥${method1_total.toFixed(2)}\n`);

// 方法2：当天买卖抵消
console.log('方法2：当天买卖抵消');
console.log('  今天买入100股和卖出100股抵消，只计算净盈亏');
const method2_tradeProfit = (sellPrice - buyPrice) * todayBuy;
const method2_hold = (todayClose - yesterdayClose) * yesterdayQty;
const method2_total = method2_tradeProfit + method2_hold;
console.log(`  买卖抵消盈亏: (${sellPrice} - ${buyPrice}) × ${todayBuy} = ¥${method2_tradeProfit.toFixed(2)}`);
console.log(`  昨日持仓盈亏: (${todayClose} - ${yesterdayClose}) × ${yesterdayQty} = ¥${method2_hold.toFixed(2)}`);
console.log(`  总盈亏: ¥${method2_total.toFixed(2)}\n`);

// 方法3：只计算昨日持仓的涨幅
console.log('方法3：只计算昨日持仓的涨幅');
console.log('  忽略今日买卖，只计算昨日100股的涨幅');
const method3_total = (todayClose - yesterdayClose) * yesterdayQty;
console.log(`  总盈亏: (${todayClose} - ${yesterdayClose}) × ${yesterdayQty} = ¥${method3_total.toFixed(2)}\n`);

console.log('========================================');
console.log(`方法1（FIFO）: ¥${method1_total.toFixed(2)}`);
console.log(`方法2（买卖抵消）: ¥${method2_total.toFixed(2)}`);
console.log(`方法3（只计昨日持仓）: ¥${method3_total.toFixed(2)}`);
console.log('========================================');

const total1 = 164 + 0 + method1_total + 1 - 8;
const total2 = 164 + 0 + method2_total + 1 - 8;
const total3 = 164 + 0 + method3_total + 1 - 8;

console.log('\n如果603122使用不同方法，全部股票今日盈亏：');
console.log(`  方法1: ¥${total1.toFixed(2)}`);
console.log(`  方法2: ¥${total2.toFixed(2)}`);
console.log(`  方法3: ¥${total3.toFixed(2)}`);
console.log(`\n  用户期望: ¥320.97`);
