const express = require('express');
const axios = require('axios');
const iconv = require('iconv-lite');
const stockCache = require('../stockCache');
const { fetchIntradayFromTencent, fetchIntradayFromSina, fetchIntradayFromNetease } = require('../controllers/stockController');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 获取股票实时行情
    router.get('/quote/:stockCode', async (req, res) => {
        try {
            const { stockCode } = req.params;

            // 检查缓存
            const cached = stockCache.getQuote(stockCode);
            if (cached) {
                return res.json({
                    success: true,
                    data: cached,
                    cached: true
                });
            }

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
                return res.status(404).json({
                    success: false,
                    error: '未找到该股票数据'
                });
            }

            const values = match[1].split(',');
            if (values.length < 32) {
                return res.status(404).json({
                    success: false,
                    error: '股票数据格式错误'
                });
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

            // 缓存数据
            stockCache.setQuote(stockCode, stockData);

            res.json({
                success: true,
                data: stockData,
                cached: false
            });

        } catch (error) {
            console.error('获取股票行情错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取股票行情失败: ' + error.message
            });
        }
    });

    // 批量获取股票行情
    router.post('/quotes', async (req, res) => {
        try {
            const { stockCodes } = req.body;

            if (!stockCodes || !Array.isArray(stockCodes) || stockCodes.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '请提供股票代码列表'
                });
            }

            // 检查缓存，分离缓存命中和未命中的股票
            const cacheResult = stockCache.getQuotes(stockCodes);
            const quotes = cacheResult.cached.map(item => item.data);
            const missingCodes = cacheResult.missing;

            console.log(`📊 批量行情请求: 总数 ${stockCodes.length}, 缓存命中 ${cacheResult.cached.length}, 需要获取 ${missingCodes.length}`);

            // 如果所有数据都在缓存中，直接返回
            if (missingCodes.length === 0) {
                return res.json({
                    success: true,
                    data: quotes,
                    cached: true,
                    cacheHitRate: '100%'
                });
            }

            // 构建需要获取的股票代码列表
            const fullCodes = missingCodes.map(code => {
                let market;
                if (code === '000001') {
                    market = 'sh';
                } else if (code.startsWith('6')) {
                    market = 'sh';
                } else {
                    market = 'sz';
                }
                return `${market}${code}`;
            }).join(',');

            // 使用新浪财经API批量获取行情
            const sinaUrl = `https://hq.sinajs.cn/list=${fullCodes}`;
            const response = await axios.get(sinaUrl, {
                headers: { 'Referer': 'https://finance.sina.com.cn' },
                timeout: 10000,
                responseType: 'arraybuffer'
            });

            const data = iconv.decode(Buffer.from(response.data), 'gbk');
            const lines = data.split('\n').filter(line => line.trim());

            const newQuotes = [];

            for (let i = 0; i < missingCodes.length; i++) {
                const line = lines[i];
                if (!line) continue;

                const match = line.match(/="(.+)"/);
                if (!match || !match[1]) continue;

                const values = match[1].split(',');
                if (values.length < 32) continue;

                const quote = {
                    stockCode: missingCodes[i],
                    stockName: values[0],
                    currentPrice: parseFloat(values[3]),
                    yesterdayClose: parseFloat(values[2]),
                    change: parseFloat(values[3]) - parseFloat(values[2]),
                    changePercent: ((parseFloat(values[3]) - parseFloat(values[2])) / parseFloat(values[2]) * 100).toFixed(2),
                    todayOpen: parseFloat(values[1]),
                    todayHigh: parseFloat(values[4]),
                    todayLow: parseFloat(values[5]),
                    volume: parseInt(values[8]),
                    amount: parseFloat(values[9]),
                    date: values[30],
                    time: values[31]
                };

                newQuotes.push(quote);
            }

            // 缓存新获取的数据
            stockCache.setQuotes(newQuotes);

            // 合并缓存数据和新数据
            const allQuotes = [...quotes, ...newQuotes];

            // 按原始顺序排序
            const sortedQuotes = stockCodes.map(code =>
                allQuotes.find(q => q.stockCode === code)
            ).filter(q => q !== undefined);

            const cacheHitRate = ((cacheResult.cached.length / stockCodes.length) * 100).toFixed(1);

            res.json({
                success: true,
                data: sortedQuotes,
                cached: false,
                cacheHitRate: `${cacheHitRate}%`,
                stats: {
                    total: stockCodes.length,
                    fromCache: cacheResult.cached.length,
                    fromAPI: newQuotes.length
                }
            });

        } catch (error) {
            console.error('批量获取股票行情错误:', error.message);
            res.status(500).json({
                success: false,
                error: '批量获取股票行情失败: ' + error.message
            });
        }
    });

    // 获取股票历史数据（用于绘制图表）
    router.get('/history/:stockCode', async (req, res) => {
        try {
            const { stockCode } = req.params;
            const { days = 30 } = req.query;

            // 检查缓存
            const cached = stockCache.getHistory(stockCode, days);
            if (cached) {
                return res.json({
                    success: true,
                    data: cached,
                    cached: true
                });
            }

            // 判断股票市场
            const market = stockCode.startsWith('6') ? 'sh' : 'sz';
            const fullCode = `${market}${stockCode}`;

            // 使用腾讯财经API获取历史数据
            const tencentUrl = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${fullCode},day,,,${days},qfq`;

            const response = await axios.get(tencentUrl, {
                headers: { 'Referer': 'https://gu.qq.com' },
                timeout: 10000
            });

            if (response.data.code !== 0 || !response.data.data || !response.data.data[fullCode]) {
                return res.status(404).json({
                    success: false,
                    error: '未找到历史数据'
                });
            }

            const historyData = response.data.data[fullCode];
            const qfqday = historyData.qfqday || historyData.day || [];

            console.log(`📊 股票/指数 ${stockCode} 请求 ${days} 天，实际返回 ${qfqday.length} 条数据`);

            // 格式化历史数据
            const formattedData = qfqday.map(item => ({
                date: item[0],
                open: parseFloat(item[1]),
                close: parseFloat(item[2]),
                high: parseFloat(item[3]),
                low: parseFloat(item[4]),
                volume: parseInt(item[5])
            }));

            const result = {
                stockCode: stockCode,
                stockName: historyData.qt ? historyData.qt[fullCode][1] : '',
                history: formattedData
            };

            // 缓存数据
            stockCache.setHistory(stockCode, days, result);

            res.json({
                success: true,
                data: result,
                cached: false
            });

        } catch (error) {
            console.error('获取股票历史数据错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取股票历史数据失败: ' + error.message
            });
        }
    });

    // 获取股票分时数据（分钟K线）- 支持多API源和缓存
    router.get('/intraday/:stockCode', async (req, res) => {
        try {
            const { stockCode } = req.params;
            const { period = '5', limit = 100 } = req.query;

            console.log(`📊 获取 ${stockCode} 的 ${period} 分钟分时数据`);

            // 1. 检查缓存
            const cached = stockCache.getIntraday(stockCode, period, limit);
            if (cached) {
                return res.json({
                    success: true,
                    data: cached,
                    cached: true,
                    source: 'cache'
                });
            }

            // 2. 从API获取数据（尝试多个数据源）
            let result = null;
            let dataSource = 'unknown';

            // 判断股票市场
            const market = stockCode.startsWith('6') ? 'sh' : 'sz';
            const fullCode = `${market}${stockCode}`;

            // 周期映射
            const periodMap = {
                '1': '1',
                '5': '5',
                '15': '15',
                '30': '30',
                '60': '60',
                '240': '240'
            };
            const scale = periodMap[period] || '5';

            // 尝试方案1: 腾讯财经API（首选，较稳定）
            try {
                console.log(`📡 尝试使用腾讯财经API获取分时数据...`);
                result = await fetchIntradayFromTencent(fullCode, stockCode, period, limit);
                dataSource = 'tencent';
                console.log(`✅ 腾讯财经API获取成功`);
            } catch (tencentError) {
                console.log(`⚠️ 腾讯财经API失败: ${tencentError.message}`);

                // 尝试方案2: 新浪财经API（备用）
                try {
                    console.log(`📡 尝试使用新浪财经API获取分时数据...`);
                    result = await fetchIntradayFromSina(fullCode, stockCode, period, scale, limit);
                    dataSource = 'sina';
                    console.log(`✅ 新浪财经API获取成功`);
                } catch (sinaError) {
                    console.log(`⚠️ 新浪财经API失败: ${sinaError.message}`);

                    // 尝试方案3: 网易财经API（最后备用）
                    try {
                        console.log(`📡 尝试使用网易财经API获取分时数据...`);
                        result = await fetchIntradayFromNetease(stockCode, period, limit);
                        dataSource = 'netease';
                        console.log(`✅ 网易财经API获取成功`);
                    } catch (neteaseError) {
                        console.log(`⚠️ 网易财经API失败: ${neteaseError.message}`);
                        throw new Error('所有数据源均获取失败');
                    }
                }
            }

            // 3. 缓存数据
            if (result && result.intraday && result.intraday.length > 0) {
                stockCache.setIntraday(stockCode, period, limit, result);
                console.log(`✅ 获取到 ${result.intraday.length} 条 ${period} 分钟数据 (来源: ${dataSource})`);
            }

            res.json({
                success: true,
                data: result,
                cached: false,
                source: dataSource
            });

        } catch (error) {
            console.error('获取分时数据错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取分时数据失败: ' + error.message
            });
        }
    });

    return router;
};
