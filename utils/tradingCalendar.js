/**
 * A股交易日历工具
 * 用于判断某个日期是否为A股交易日
 */

/**
 * 2025年A股市场休市日期（包括周末和节假日调休）
 * 数据来源：上交所和深交所发布的2025年休市安排
 */
const HOLIDAYS_2025 = [
    // 元旦：2025年1月1日放假1天
    '2025-01-01',

    // 春节：2025年1月28日至2月4日放假调休，共8天
    '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
    '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04',

    // 清明节：2025年4月4日至6日放假调休，共3天
    '2025-04-04', '2025-04-05', '2025-04-06',

    // 劳动节：2025年5月1日至5日放假调休，共5天
    '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05',

    // 端午节：2025年5月31日至6月2日放假调休，共3天
    '2025-05-31', '2025-06-01', '2025-06-02',

    // 中秋节：2025年10月6日放假1天
    '2025-10-06',

    // 国庆节：2025年10月1日至7日放假调休，共7天
    '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04',
    '2025-10-05', '2025-10-07'
];

/**
 * 2026年A股市场休市日期（预估，实际以交易所公告为准）
 */
const HOLIDAYS_2026 = [
    // 元旦：2026年1月1日至3日
    '2026-01-01', '2026-01-02', '2026-01-03',

    // 春节：2026年2月16日至22日（预估）
    '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
    '2026-02-20', '2026-02-21', '2026-02-22',

    // 清明节：2026年4月4日至6日（预估）
    '2026-04-04', '2026-04-05', '2026-04-06',

    // 劳动节：2026年5月1日至5日（预估）
    '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',

    // 端午节：2026年6月19日至21日（预估）
    '2026-06-19', '2026-06-20', '2026-06-21',

    // 中秋节+国庆节：2026年10月1日至8日（预估）
    '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'
];

// 合并所有节假日
const ALL_HOLIDAYS = new Set([...HOLIDAYS_2025, ...HOLIDAYS_2026]);

/**
 * 判断某个日期是否为周末
 * @param {Date} date - 要检查的日期
 * @returns {boolean} - 如果是周末返回true
 */
function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // 0=周日, 6=周六
}

/**
 * 判断某个日期是否为法定节假日
 * @param {Date} date - 要检查的日期
 * @returns {boolean} - 如果是节假日返回true
 */
function isHoliday(date) {
    const dateStr = date.toISOString().split('T')[0]; // 格式: YYYY-MM-DD
    return ALL_HOLIDAYS.has(dateStr);
}

/**
 * 判断某个日期是否为A股交易日
 * @param {Date} date - 要检查的日期，默认为当前日期
 * @returns {boolean} - 如果是交易日返回true
 */
function isTradingDay(date = new Date()) {
    // 确保输入是Date对象
    if (!(date instanceof Date)) {
        date = new Date(date);
    }

    // 周末不是交易日
    if (isWeekend(date)) {
        return false;
    }

    // 法定节假日不是交易日
    if (isHoliday(date)) {
        return false;
    }

    // 其他工作日都是交易日
    return true;
}

/**
 * 获取下一个交易日
 * @param {Date} date - 起始日期，默认为当前日期
 * @returns {Date} - 下一个交易日
 */
function getNextTradingDay(date = new Date()) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }

    let nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // 最多查找30天
    let attempts = 0;
    while (!isTradingDay(nextDay) && attempts < 30) {
        nextDay.setDate(nextDay.getDate() + 1);
        attempts++;
    }

    return nextDay;
}

/**
 * 获取今天的日期字符串（用于日志输出）
 * @returns {string} - 格式: YYYY-MM-DD (星期X)
 */
function getTodayString() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[today.getDay()];
    return `${dateStr} (星期${weekday})`;
}

module.exports = {
    isTradingDay,
    isWeekend,
    isHoliday,
    getNextTradingDay,
    getTodayString
};
