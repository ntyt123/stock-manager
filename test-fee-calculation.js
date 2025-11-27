/**
 * 测试交易费用计算
 * 验证持仓盈亏计算是否正确考虑了交易手续费
 */

const { calculatePositionProfit, calculateBuyCost } = require('./utils/tradingFeeCalculator');

console.log('========================================');
console.log('测试场景：神奇制药 (600613)');
console.log('========================================\n');

// 测试数据（来自用户截图）
const stockCode = '600613';
const stockName = '神奇制药';
const quantity = 100;
const costPrice = 6.95;
const currentPrice = 6.95;

console.log('📊 持仓信息：');
console.log(`  股票代码：${stockCode}`);
console.log(`  股票名称：${stockName}`);
console.log(`  持仓数量：${quantity}股`);
console.log(`  买入价格：¥${costPrice.toFixed(2)}`);
console.log(`  当前价格：¥${currentPrice.toFixed(2)}`);
console.log('');

// 1. 计算买入成本（含手续费）
console.log('💰 买入成本计算：');
const buyCost = calculateBuyCost(costPrice, quantity);
console.log(`  买入金额：¥${buyCost.amount.toFixed(2)}`);
console.log(`  佣金：¥${buyCost.commission.toFixed(2)}`);
console.log(`  过户费：¥${buyCost.transferFee.toFixed(2)}`);
console.log(`  总手续费：¥${buyCost.totalFee.toFixed(2)}`);
console.log(`  买入总成本：¥${buyCost.totalCost.toFixed(2)}`);
console.log(`  实际成本价：¥${buyCost.costPerShare.toFixed(3)}/股`);
console.log('');

// 2. 计算持仓盈亏
console.log('📈 持仓盈亏计算：');
const profit = calculatePositionProfit(costPrice, currentPrice, quantity);
console.log(`  当前市值：¥${profit.currentValue.toFixed(2)}`);
console.log(`  买入总成本：¥${profit.buyCost.toFixed(2)}`);
console.log(`  盈亏金额：${profit.profitLoss >= 0 ? '+' : ''}¥${profit.profitLoss.toFixed(2)}`);
console.log(`  盈亏比例：${profit.profitLossRate >= 0 ? '+' : ''}${profit.profitLossRate.toFixed(2)}%`);
console.log('');

// 3. 结论
console.log('✅ 结论：');
if (costPrice === currentPrice) {
    console.log('  买入价和当前价相同时：');
    if (profit.profitLoss < 0) {
        console.log(`  ✓ 正确显示亏损 ¥${Math.abs(profit.profitLoss).toFixed(2)}（手续费成本）`);
    } else {
        console.log('  ✗ 错误：应该显示亏损，但显示盈亏为0');
    }
} else {
    console.log(`  当前价与买入价相差：${((currentPrice - costPrice) / costPrice * 100).toFixed(2)}%`);
}
console.log('');

// 4. 测试其他场景
console.log('========================================');
console.log('测试场景2：上涨1%的情况');
console.log('========================================\n');

const currentPrice2 = costPrice * 1.01;
const profit2 = calculatePositionProfit(costPrice, currentPrice2, quantity);
console.log(`  买入价：¥${costPrice.toFixed(2)}`);
console.log(`  当前价：¥${currentPrice2.toFixed(2)}`);
console.log(`  涨幅：+${((currentPrice2 - costPrice) / costPrice * 100).toFixed(2)}%`);
console.log(`  实际盈亏：${profit2.profitLoss >= 0 ? '+' : ''}¥${profit2.profitLoss.toFixed(2)}`);
console.log(`  实际收益率：${profit2.profitLossRate >= 0 ? '+' : ''}${profit2.profitLossRate.toFixed(2)}%`);
console.log('');

console.log('========================================');
console.log('测试场景3：下跌1%的情况');
console.log('========================================\n');

const currentPrice3 = costPrice * 0.99;
const profit3 = calculatePositionProfit(costPrice, currentPrice3, quantity);
console.log(`  买入价：¥${costPrice.toFixed(2)}`);
console.log(`  当前价：¥${currentPrice3.toFixed(2)}`);
console.log(`  跌幅：${((currentPrice3 - costPrice) / costPrice * 100).toFixed(2)}%`);
console.log(`  实际盈亏：${profit3.profitLoss >= 0 ? '+' : ''}¥${profit3.profitLoss.toFixed(2)}`);
console.log(`  实际收益率：${profit3.profitLossRate >= 0 ? '+' : ''}${profit3.profitLossRate.toFixed(2)}%`);
console.log('');

console.log('========================================');
console.log('✅ 测试完成！');
console.log('========================================');
