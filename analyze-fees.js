/**
 * 分析交易费用（包括印花税和过户费）
 */

const { db } = require('./database');

console.log('=== 今日交易详情及费用分析 ===\n');

const trades = db.prepare(`
    SELECT * FROM trade_operations
    WHERE DATE(trade_date) = ?
    ORDER BY created_at ASC
`).all('2025-11-13');

let totalStampTax = 0;
let totalTransferFee = 0;
let totalRecordedFee = 0;

trades.forEach((t, i) => {
    console.log(`[${i+1}] ${t.trade_type} ${t.stock_code} ${t.stock_name}`);
    console.log(`    数量: ${t.quantity}股, 价格: ¥${t.price}`);

    const amount = t.quantity * t.price;
    console.log(`    成交额: ¥${amount.toFixed(2)}`);
    console.log(`    记录的fee: ¥${t.fee || 0}`);

    // 计算应收费用
    let stampTax = 0;
    let transferFee = 0;

    // 印花税：仅卖出收取，千分之一（0.1%）
    if (t.trade_type === 'sell' || t.trade_type === 'reduce') {
        stampTax = amount * 0.001;
    }

    // 过户费：上海股票（60开头）收取，万分之0.2（0.002%）
    if (t.stock_code.startsWith('6')) {
        transferFee = amount * 0.00002;
    }

    console.log(`    印花税（仅卖出）: ¥${stampTax.toFixed(2)}`);
    console.log(`    过户费（仅沪市）: ¥${transferFee.toFixed(2)}`);
    console.log(`    佣金（从fee中推算）: ¥${((t.fee || 0) - stampTax - transferFee).toFixed(2)}`);
    console.log(`    费用合计估算: ¥${(stampTax + transferFee + (t.fee || 0)).toFixed(2)}`);
    console.log();

    totalStampTax += stampTax;
    totalTransferFee += transferFee;
    totalRecordedFee += (t.fee || 0);
});

console.log('\n=== 总费用汇总 ===');
console.log(`  记录的fee总计: ¥${totalRecordedFee.toFixed(2)}`);
console.log(`  印花税总计: ¥${totalStampTax.toFixed(2)}`);
console.log(`  过户费总计: ¥${totalTransferFee.toFixed(2)}`);
console.log(`  实际总费用: ¥${(totalRecordedFee + totalStampTax + totalTransferFee).toFixed(2)}`);
console.log();

// 检查fee字段是否已经包含了印花税和过户费
console.log('=== 费用包含情况分析 ===');
console.log('如果记录的fee只包含佣金，那么：');
console.log(`  总费用应为: ¥${(totalRecordedFee + totalStampTax + totalTransferFee).toFixed(2)}`);
console.log('如果记录的fee已包含所有费用，那么：');
console.log(`  总费用应为: ¥${totalRecordedFee.toFixed(2)}`);
