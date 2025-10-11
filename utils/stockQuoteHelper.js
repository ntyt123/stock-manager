/**
 * 股票行情获取辅助函数
 * 优先从缓存获取，缓存没有则调用新浪API
 */

const axios = require('axios');
const iconv = require('iconv-lite');
const stockCache = require('../stockCache');

/**
 * 获取股票实时行情
 * @param {string} stockCode - 股票代码
 * @returns {Promise<Object|null>} - 行情数据对象，如果获取失败返回null
 */
async function getStockQuote(stockCode) {
    try {
        // 1. 先检查缓存
        const cached = stockCache.getQuote(stockCode);
        if (cached) {
            return cached;
        }

        // 2. 缓存没有，从API获取
        // 判断股票市场（沪市或深市）
        let market;
        if (stockCode === '000001') {
            market = 'sh';  // 上证指数
        } else if (stockCode.startsWith('6')) {
            market = 'sh';  // 沪市股票
        } else {
            market = 'sz';  // 深市股票和指数
        }
        const fullCode = `${market}${stockCode}`;

        // 使用新浪财经API获取实时行情
        const sinaUrl = `https://hq.sinajs.cn/list=${fullCode}`;
        const response = await axios.get(sinaUrl, {
            headers: { 'Referer': 'https://finance.sina.com.cn' },
            timeout: 5000,
            responseType: 'arraybuffer'
        });

        // 将GBK编码转换为UTF-8
        const data = iconv.decode(Buffer.from(response.data), 'gbk');

        // 解析返回的数据
        const match = data.match(/="(.+)"/);
        if (!match || !match[1]) {
            console.log(`未找到股票 ${stockCode} 的数据`);
            return null;
        }

        const values = match[1].split(',');
        if (values.length < 32) {
            console.log(`股票 ${stockCode} 数据格式错误`);
            return null;
        }

        // 解析股票数据
        const stockData = {
            stockCode: stockCode,
            stockName: values[0],
            todayOpen: parseFloat(values[1]),
            yesterdayClose: parseFloat(values[2]),
            currentPrice: parseFloat(values[3]),
            todayHigh: parseFloat(values[4]),
            todayLow: parseFloat(values[5]),
            buyPrice: parseFloat(values[6]),
            sellPrice: parseFloat(values[7]),
            volume: parseInt(values[8]),
            amount: parseFloat(values[9]),
            change: parseFloat(values[3]) - parseFloat(values[2]),
            changePercent: ((parseFloat(values[3]) - parseFloat(values[2])) / parseFloat(values[2]) * 100).toFixed(2),
            date: values[30],
            time: values[31]
        };

        // 3. 缓存数据
        stockCache.setQuote(stockCode, stockData);

        return stockData;

    } catch (error) {
        console.log(`获取股票 ${stockCode} 实时价格失败:`, error.message);
        return null;
    }
}

module.exports = {
    getStockQuote
};
