/**
 * 测试交易日历工具
 */

const { isTradingDay, getTodayString, getNextTradingDay } = require('../utils/tradingCalendar');

console.log('========== A股交易日历测试 ==========\n');

// 测试今天是否为交易日
console.log(`今天: ${getTodayString()}`);
console.log(`是否交易日: ${isTradingDay() ? '✅ 是' : '❌ 否'}\n`);

// 测试一些已知的日期
const testDates = [
    '2025-01-01',  // 元旦（假期）
    '2025-01-02',  // 元旦后工作日
    '2025-01-04',  // 周六
    '2025-01-05',  // 周日
    '2025-01-06',  // 周一（工作日）
    '2025-01-28',  // 春节第一天
    '2025-02-05',  // 春节后工作日
    '2025-04-04',  // 清明节
    '2025-05-01',  // 劳动节
    '2025-10-01',  // 国庆节
    '2025-10-08',  // 国庆后工作日
    '2025-12-25',  // 圣诞节（西方节日，A股正常交易）
    '2025-12-27',  // 周六
    '2025-12-29',  // 周一（工作日）
];

console.log('========== 日期测试结果 ==========\n');

testDates.forEach(dateStr => {
    const date = new Date(dateStr);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[date.getDay()];
    const isTrading = isTradingDay(date);
    const status = isTrading ? '✅ 交易日' : '❌ 非交易日';

    console.log(`${dateStr} (星期${weekday}): ${status}`);
});

// 测试获取下一个交易日
console.log('\n========== 下一个交易日测试 ==========\n');

const testFromDates = [
    '2025-01-03',  // 周五
    '2025-01-27',  // 春节前一天（周一）
    '2025-10-07',  // 国庆最后一天
];

testFromDates.forEach(dateStr => {
    const date = new Date(dateStr);
    const nextTradingDay = getNextTradingDay(date);
    const nextDateStr = nextTradingDay.toISOString().split('T')[0];
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const nextWeekday = weekdays[nextTradingDay.getDay()];

    console.log(`从 ${dateStr} 开始，下一个交易日: ${nextDateStr} (星期${nextWeekday})`);
});

console.log('\n========== 测试完成 ==========\n');
