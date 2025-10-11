const axios = require('axios');
const stockCache = require('../stockCache');

/**
 * 从腾讯财经API获取分时数据
 */
async function fetchIntradayFromTencent(fullCode, stockCode, period, limit) {
    // 腾讯财经分时数据API
    // 周期映射：1分钟=m1, 5分钟=m5, 15分钟=m15, 30分钟=m30, 60分钟=m60
    const periodMapTencent = {
        '1': 'm1',
        '5': 'm5',
        '15': 'm15',
        '30': 'm30',
        '60': 'm60'
    };
    const tencentPeriod = periodMapTencent[period] || 'm5';

    const tencentUrl = `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${fullCode}&_var=m${tencentPeriod}_data`;

    const response = await axios.get(tencentUrl, {
        headers: {
            'Referer': 'https://gu.qq.com',
            'User-Agent': 'Mozilla/5.0'
        },
        timeout: 8000
    });

    // 腾讯API返回的是JSONP格式，需要解析
    let jsonData = response.data;
    if (typeof jsonData === 'string') {
        // 提取JSON部分：m5_data={...}
        const match = jsonData.match(/=({.+})/);
        if (match && match[1]) {
            jsonData = JSON.parse(match[1]);
        }
    }

    if (!jsonData || !jsonData.data || !jsonData.data[fullCode]) {
        throw new Error('腾讯API返回数据格式错误或无数据');
    }

    const stockData = jsonData.data[fullCode];

    // 检查是否有分时数据
    const timeKey = `${tencentPeriod}`;  // m5, m15, m30, m60
    if (!stockData[timeKey] || stockData[timeKey].length === 0) {
        throw new Error('腾讯API无分时数据');
    }

    // 解析分时数据
    // 格式: ["时间", "开盘", "收盘", "最高", "最低", "成交量"]
    const intradayData = stockData[timeKey].slice(-limit).map(item => ({
        time: item[0],                      // 时间
        open: parseFloat(item[1]),          // 开盘价
        close: parseFloat(item[2]),         // 收盘价
        high: parseFloat(item[3]),          // 最高价
        low: parseFloat(item[4]),           // 最低价
        volume: parseInt(item[5] || 0)      // 成交量
    }));

    return {
        stockCode: stockCode,
        stockName: stockData.qt ? stockData.qt[fullCode][1] : '',
        period: period,
        count: intradayData.length,
        intraday: intradayData
    };
}

/**
 * 从新浪财经API获取分时数据（原方案）
 */
async function fetchIntradayFromSina(fullCode, stockCode, period, scale, limit) {
    const sinaUrl = `http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${fullCode}&scale=${scale}&datalen=${limit}`;

    const response = await axios.get(sinaUrl, {
        headers: {
            'Referer': 'https://finance.sina.com.cn'
        },
        timeout: 8000
    });

    // 检查响应
    if (!response.data || response.data === 'null' || (Array.isArray(response.data) && response.data.length === 0)) {
        throw new Error('新浪API返回数据为空');
    }

    // 解析并格式化数据
    const intradayData = response.data.map(item => ({
        time: item.day,                    // 时间
        open: parseFloat(item.open),       // 开盘价
        high: parseFloat(item.high),       // 最高价
        low: parseFloat(item.low),         // 最低价
        close: parseFloat(item.close),     // 收盘价
        volume: parseInt(item.volume)      // 成交量
    }));

    // 获取股票名称（从实时行情缓存）
    let stockName = '';
    try {
        const cached = stockCache.getQuote(stockCode);
        if (cached) {
            stockName = cached.stockName;
        }
    } catch (e) {
        // 忽略错误
    }

    return {
        stockCode: stockCode,
        stockName: stockName,
        period: period,
        scale: scale,
        count: intradayData.length,
        intraday: intradayData
    };
}

/**
 * 从网易财经API获取分时数据
 */
async function fetchIntradayFromNetease(stockCode, period, limit) {
    // 网易财经暂不支持分钟级K线，抛出错误让其尝试其他源
    throw new Error('网易财经API暂不支持分钟级分时数据');

    // 备注：网易财经主要提供日线数据，分时数据需要其他API
    // 如果未来网易支持，可以在这里实现
}

module.exports = {
    fetchIntradayFromTencent,
    fetchIntradayFromSina,
    fetchIntradayFromNetease
};
