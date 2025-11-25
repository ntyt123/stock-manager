const express = require('express');
const axios = require('axios');
const iconv = require('iconv-lite');
const stockCache = require('../stockCache');
const { fetchIntradayFromTencent, fetchIntradayFromSina, fetchIntradayFromNetease } = require('../controllers/stockController');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 股票搜索API
    router.get('/search', async (req, res) => {
        try {
            const { keyword } = req.query;

            if (!keyword || keyword.trim().length < 2) {
                return res.json({
                    success: true,
                    data: []
                });
            }

            // 使用新浪财经搜索API
            const searchUrl = `https://suggest3.sinajs.cn/suggest/type=11,12&key=${encodeURIComponent(keyword)}&name=suggestdata`;
            const response = await axios.get(searchUrl, {
                headers: { 'Referer': 'https://finance.sina.com.cn' },
                timeout: 5000,
                responseType: 'arraybuffer'
            });

            // 转换编码
            const data = iconv.decode(Buffer.from(response.data), 'gbk');

            // 解析返回数据
            // 格式: var suggestdata="code1,name1,code2,name2,..."
            const match = data.match(/="(.*)"/);
            if (!match || !match[1]) {
                return res.json({
                    success: true,
                    data: []
                });
            }

            const items = match[1].split(';').filter(item => item);
            const results = items.map(item => {
                const parts = item.split(',');
                if (parts.length >= 4) {
                    // parts[3]是完整代码（如sh600000），parts[4]是名称
                    const fullCode = parts[3];
                    const name = parts[4];
                    // 提取6位股票代码
                    const code = fullCode.substring(2);

                    return {
                        code: code,
                        name: name
                    };
                }
                return null;
            }).filter(item => item !== null);

            res.json({
                success: true,
                data: results
            });

        } catch (error) {
            console.error('股票搜索错误:', error.message);
            res.json({
                success: true,
                data: []
            });
        }
    });

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
            // 东方财富API格式：secid=市场代码.股票代码
            // 市场代码：0=深市，1=沪市
            let marketCode;
            if (stockCode === '000001') {
                marketCode = '1';  // 上证指数
            } else if (stockCode.startsWith('6')) {
                marketCode = '1';  // 沪市股票
            } else if (stockCode.startsWith('0') || stockCode.startsWith('3')) {
                marketCode = '0';  // 深市股票（包括创业板）
            } else {
                marketCode = '0';  // 默认深市
            }
            const secid = `${marketCode}.${stockCode}`;

            // 优先使用东方财富API获取实时行情（包含完整的量比、换手率等数据）
            try {
                const eastmoneyUrl = `http://push2.eastmoney.com/api/qt/stock/get`;
                const params = {
                    secid: secid,
                    fields: 'f43,f44,f45,f46,f47,f48,f49,f50,f51,f52,f57,f58,f59,f60,f107,f152,f161,f162,f168,f169,f170,f171',
                    // f43=最新价 f44=最高 f45=最低 f46=今开 f47=成交量(手) f48=成交额
                    // f49=涨跌幅% f50=量比 f51=换手率 f52=市盈率动态
                    // f57=代码 f58=名称 f59=昨收 f60=涨跌额
                    // f107=流通市值 f152=市净率 f161=均价
                    // f162=市盈率动态 f168=换手率% f169=涨跌额 f170=涨跌幅% f171=振幅%
                };

                const response = await axios.get(eastmoneyUrl, {
                    params: params,
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'http://quote.eastmoney.com/'
                    }
                });

                // 解析东方财富API返回的数据
                if (response.data && response.data.data) {
                    const apiData = response.data.data;

                    // 解析数据（东方财富API返回的数据是整数*100形式，需要除以100）
                    const currentPrice = (parseFloat(apiData.f43) || 0) / 100;  // 最新价
                    const yesterdayClose = (parseFloat(apiData.f59) || 0) / 100;  // 昨收
                    const todayOpen = (parseFloat(apiData.f46) || 0) / 100;  // 今开
                    const todayHigh = (parseFloat(apiData.f44) || 0) / 100;  // 最高
                    const todayLow = (parseFloat(apiData.f45) || 0) / 100;  // 最低
                    const volume = parseInt(apiData.f47) || 0;  // 成交量（手）- 不需要除以100
                    const amount = parseFloat(apiData.f48) || 0;  // 成交额（元）- 不需要除以100
                    const changePercent = (parseFloat(apiData.f170) || 0) / 100;  // 涨跌幅%
                    const change = (parseFloat(apiData.f169) || 0) / 100;  // 涨跌额
                    const amplitude = (parseFloat(apiData.f171) || 0) / 100;  // 振幅%
                    const turnoverRate = (parseFloat(apiData.f168) || parseFloat(apiData.f51) || 0) / 100;  // 换手率%
                    const volumeRatio = (parseFloat(apiData.f50) || 0) / 100;  // 量比
                    const avgPrice = (parseFloat(apiData.f161) || 0) / 100;  // 均价

                    const stockData = {
                        stockCode: stockCode,
                        stockName: apiData.f58 || '',  // 股票名称
                        todayOpen: todayOpen,
                        yesterdayClose: yesterdayClose,
                        currentPrice: currentPrice,
                        todayHigh: todayHigh,
                        todayLow: todayLow,
                        avgPrice: avgPrice,
                        buyPrice: currentPrice,  // 东方财富API不提供买一价，用最新价代替
                        sellPrice: currentPrice,  // 东方财富API不提供卖一价，用最新价代替
                        volume: volume,
                        amount: amount,
                        change: change,
                        changePercent: changePercent.toFixed(2),
                        amplitude: amplitude.toFixed(2),
                        turnoverRate: turnoverRate.toFixed(2),
                        volumeRatio: volumeRatio.toFixed(2),
                        high: todayHigh,
                        low: todayLow,
                        pe: parseFloat(apiData.f162) || parseFloat(apiData.f52) || 0,  // 市盈率
                        pb: parseFloat(apiData.f152) || 0,  // 市净率
                        circulationMarketValue: parseFloat(apiData.f107) || 0,  // 流通市值
                        date: new Date().toISOString().split('T')[0],
                        time: new Date().toTimeString().split(' ')[0],
                        dataSource: 'eastmoney'
                    };

                    // 缓存数据
                    stockCache.setQuote(stockCode, stockData);

                    return res.json({
                        success: true,
                        data: stockData,
                        cached: false
                    });
                }
            } catch (eastmoneyError) {
                console.log('东方财富API失败，回退到新浪财经API:', eastmoneyError.message);
            }

            // 如果东方财富API失败，回退到新浪财经API
            const market = marketCode === '1' ? 'sh' : 'sz';
            const fullCode = `${market}${stockCode}`;

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
            const todayOpen = parseFloat(values[1]);
            const yesterdayClose = parseFloat(values[2]);
            const currentPrice = parseFloat(values[3]);
            const todayHigh = parseFloat(values[4]);
            const todayLow = parseFloat(values[5]);
            const volume = parseInt(values[8]);
            const amount = parseFloat(values[9]);

            // 计算涨跌幅
            const change = currentPrice - yesterdayClose;
            const changePercent = yesterdayClose !== 0 ? (change / yesterdayClose * 100).toFixed(2) : '0.00';

            // 计算振幅
            const amplitude = yesterdayClose !== 0
                ? (((todayHigh - todayLow) / yesterdayClose) * 100).toFixed(2)
                : '0.00';

            // 新浪API没有量比和换手率，使用估算值
            const turnoverRate = '0.00';  // 无法准确计算
            const volumeRatio = '1.00';  // 无法准确计算

            const stockData = {
                stockCode: stockCode,
                stockName: values[0],
                todayOpen: todayOpen,
                yesterdayClose: yesterdayClose,
                currentPrice: currentPrice,
                todayHigh: todayHigh,
                todayLow: todayLow,
                buyPrice: parseFloat(values[6]),
                sellPrice: parseFloat(values[7]),
                volume: volume,
                amount: amount,
                change: change,
                changePercent: changePercent,
                amplitude: amplitude,
                turnoverRate: turnoverRate,
                volumeRatio: volumeRatio,
                high: todayHigh,
                low: todayLow,
                date: values[30],
                time: values[31],
                dataSource: 'sina'
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
            console.error('❌ 批量获取股票行情错误:');
            console.error('  错误类型:', error.name);
            console.error('  错误信息:', error.message);
            console.error('  堆栈:', error.stack);

            // 根据不同的错误类型返回更详细的错误信息
            let errorMessage = '批量获取股票行情失败';
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                errorMessage = '获取行情数据超时，请检查网络连接';
            } else if (error.response) {
                errorMessage = `行情API返回错误: ${error.response.status}`;
            } else if (error.request) {
                errorMessage = '无法连接到行情数据源，请检查网络';
            } else {
                errorMessage = error.message || '未知错误';
            }

            res.status(500).json({
                success: false,
                error: errorMessage
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

    // 独立行情分析 - 获取股票、指数、板块、概念的分时数据
    router.get('/independent-analysis/:stockCode', async (req, res) => {
        try {
            const { stockCode } = req.params;

            console.log(`📊 开始独立行情分析: ${stockCode}`);

            // 1. 获取股票信息
            const stockInfo = await getStockBasicInfo(stockCode);

            // 2. 获取股票所属的板块和概念
            const { sectors, concepts } = await getStockSectorsAndConcepts(stockCode);
            console.log(`📂 股票板块: ${sectors.join(', ')}`);
            console.log(`💡 股票概念: ${concepts.join(', ')}`);

            // 3. 获取板块和概念对应的指数代码
            const indices = await getSectorConceptIndex(stockCode, sectors, concepts);

            // 4. 获取分时数据（使用1分钟数据）
            const stockMinute = await getMinuteData(stockCode);
            const indexMinute = await getMinuteData('000001'); // 上证指数

            // 5. 获取板块和概念的分时数据
            let sectorMinute = null;
            let sectorInfo = null;
            try {
                sectorMinute = await getMinuteData(indices.sector.code);
                sectorInfo = indices.sector;
                console.log(`✅ 板块 ${sectorInfo.name} (${sectorInfo.code}) 数据获取成功`);
            } catch (error) {
                console.warn('获取板块数据失败:', error.message);
            }

            let conceptMinute = null;
            let conceptInfo = null;
            try {
                conceptMinute = await getMinuteData(indices.concept.code);
                conceptInfo = indices.concept;
                console.log(`✅ 概念 ${conceptInfo.name} (${conceptInfo.code}) 数据获取成功`);
            } catch (error) {
                console.warn('获取概念数据失败:', error.message);
            }

            // 6. 组织返回数据
            const result = {
                stock: {
                    name: stockInfo.name,
                    code: stockCode,
                    sectors: sectors,
                    concepts: concepts,
                    minuteData: stockMinute
                },
                index: {
                    name: '上证指数',
                    code: '000001',
                    minuteData: indexMinute
                },
                sector: sectorInfo ? {
                    name: sectorInfo.name,
                    code: sectorInfo.code,
                    minuteData: sectorMinute
                } : null,
                concept: conceptInfo ? {
                    name: conceptInfo.name,
                    code: conceptInfo.code,
                    minuteData: conceptMinute
                } : null
            };

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('独立行情分析错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取数据失败: ' + error.message
            });
        }
    });

    // 获取股票行业信息
    router.get('/industry/:stockCode', async (req, res) => {
        try {
            const { stockCode } = req.params;

            // 使用东方财富网API获取股票基本信息
            const secid = getEastmoneySecid(stockCode);
            const url = 'https://push2.eastmoney.com/api/qt/stock/get';

            const params = {
                secid: secid,
                fields: 'f12,f13,f14,f127,f128,f129', // f127:板块,f128:概念,f129:行业
                _: Date.now()
            };

            const response = await axios.get(url, {
                params,
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://quote.eastmoney.com/'
                },
                httpsAgent: new (require('https')).Agent({
                    rejectUnauthorized: false
                })
            });

            if (!response.data || !response.data.data) {
                return res.json({
                    success: true,
                    data: {
                        industries: [],
                        concepts: []
                    }
                });
            }

            const data = response.data.data;
            const industries = [];
            const concepts = [];

            // f129是行业
            if (data.f129) {
                industries.push(data.f129);
            }

            // f127是板块
            if (data.f127) {
                industries.push(data.f127);
            }

            // f128是概念，可能是逗号分隔的多个概念
            if (data.f128) {
                const conceptList = data.f128.split(',').map(c => c.trim()).filter(c => c);
                concepts.push(...conceptList);
            }

            // 组合所有标签
            const allTags = [...new Set([...industries, ...concepts])];

            res.json({
                success: true,
                data: {
                    industries: industries,
                    concepts: concepts,
                    allTags: allTags.join(',')
                }
            });

        } catch (error) {
            console.error('获取股票行业信息失败:', error.message);
            res.json({
                success: true,
                data: {
                    industries: [],
                    concepts: [],
                    allTags: ''
                }
            });
        }
    });

    return router;
};

/**
 * 获取股票基本信息
 */
async function getStockBasicInfo(stockCode) {
    // 判断市场
    let market;
    if (stockCode === '000001') {
        market = 'sh';
    } else if (stockCode.startsWith('6')) {
        market = 'sh';
    } else {
        market = 'sz';
    }
    const fullCode = `${market}${stockCode}`;

    // 使用新浪API获取基本信息
    const sinaUrl = `https://hq.sinajs.cn/list=${fullCode}`;
    const response = await axios.get(sinaUrl, {
        headers: { 'Referer': 'https://finance.sina.com.cn' },
        timeout: 5000,
        responseType: 'arraybuffer'
    });

    const data = iconv.decode(Buffer.from(response.data), 'gbk');
    const match = data.match(/="(.+)"/);

    if (!match || !match[1]) {
        throw new Error('股票不存在');
    }

    const parts = match[1].split(',');
    return {
        name: parts[0],
        code: stockCode
    };
}

/**
 * 获取分时数据
 */
async function getMinuteData(stockCode) {
    // 判断市场
    let market;
    if (stockCode === '000001') {
        market = 'sh';
    } else if (stockCode.startsWith('6')) {
        market = 'sh';
    } else {
        market = 'sz';
    }
    const fullCode = `${market}${stockCode}`;

    // 1. 先获取股票的实时行情以获得昨收价
    let yesterdayClose = 0;
    try {
        const sinaUrl = `https://hq.sinajs.cn/list=${fullCode}`;
        const quoteResponse = await axios.get(sinaUrl, {
            headers: { 'Referer': 'https://finance.sina.com.cn' },
            timeout: 5000
        });

        const quoteData = quoteResponse.data;
        const match = quoteData.match(/="([^"]+)"/);
        if (match && match[1]) {
            const fields = match[1].split(',');
            yesterdayClose = parseFloat(fields[2]) || 0; // 昨收价在第3个字段
        }
    } catch (error) {
        console.warn('获取昨收价失败，使用默认值:', error.message);
    }

    // 2. 获取分时K线数据（使用多数据源备份）
    // 优先使用5分钟数据（更容易获取，尤其在非交易时间）
    let result = null;
    let dataSource = '';
    const period = '5';  // 使用5分钟数据
    const limit = 48;    // 5分钟 * 48 = 4小时的数据

    // 尝试方案1: 腾讯财经API
    try {
        result = await fetchIntradayFromTencent(fullCode, stockCode, period, limit);
        dataSource = 'tencent';
    } catch (tencentError) {
        console.warn(`腾讯API失败: ${tencentError.message}`);

        // 尝试方案2: 新浪财经API
        try {
            result = await fetchIntradayFromSina(fullCode, stockCode, period, '5', limit);
            dataSource = 'sina';
        } catch (sinaError) {
            console.warn(`新浪API失败: ${sinaError.message}`);
            throw new Error('所有数据源均获取失败');
        }
    }

    if (!result || !result.intraday || result.intraday.length === 0) {
        throw new Error('获取分时数据失败');
    }

    console.log(`✅ 分时数据来源: ${dataSource}, 数据条数: ${result.intraday.length}`);

    // 3. 转换为前端需要的格式
    // 使用收盘价作为当前价格，计算移动平均作为均价
    const minuteData = result.intraday.map((item, index, array) => {
        const price = item.close || item.price || 0;

        // 计算均价：使用前N个数据点的平均值
        let avgPrice = price;
        if (index > 0) {
            const lookback = Math.min(index + 1, 10); // 使用最近10个数据点
            let sum = 0;
            for (let i = 0; i < lookback; i++) {
                sum += array[index - i].close || array[index - i].price || 0;
            }
            avgPrice = sum / lookback;
        }

        return {
            time: item.time,
            price: price,
            avgPrice: avgPrice,
            yesterdayClose: yesterdayClose || price // 如果没有昨收价，使用当前价
        };
    });

    return minuteData;
}

/**
 * 获取股票所属的板块和概念
 */
async function getStockSectorsAndConcepts(stockCode) {
    const sectors = [];
    const concepts = [];

    try {
        // 方法1: 使用东方财富API获取板块和概念
        const secid = getEastmoneySecid(stockCode);

        // 获取所属板块和概念列表
        const url = `http://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f12,f13,f14,f62,f184,f86,f100,f127,f116,f117,f85`;
        console.log(`🔍 请求东方财富API: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'Referer': 'http://quote.eastmoney.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 8000
        });

        console.log(`📊 东方财富API返回状态: ${response.status}`);

        if (response.data && response.data.data) {
            const stockData = response.data.data;
            console.log('📦 股票基本信息:', JSON.stringify(stockData).substring(0, 200));

            // 解析行业信息（f127字段）
            if (stockData.f127) {
                sectors.push(stockData.f127);
                console.log(`✅ 从东方财富获取到行业: ${stockData.f127}`);
            }

            // 解析板块信息（f100字段通常包含板块代码）
            if (stockData.f100) {
                console.log(`📌 板块代码: ${stockData.f100}`);
            }
        }

        // 方法2: 使用东方财富的概念板块API
        try {
            // 使用东方财富的概念板块查询接口
            const conceptUrl = `http://emweb.securities.eastmoney.com/PC_HSF10/CoreConception/CoreConceptionAjax?code=${secid}`;
            console.log(`🔍 尝试东方财富概念API: ${conceptUrl}`);

            const conceptResponse = await axios.get(conceptUrl, {
                headers: {
                    'Referer': 'http://emweb.securities.eastmoney.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 8000
            });

            // 打印返回数据以便调试
            if (conceptResponse.data) {
                console.log(`📦 东方财富概念API返回数据: ${JSON.stringify(conceptResponse.data).substring(0, 500)}`);

                // 尝试多个可能的数据结构
                let conceptData = null;

                // 尝试不同的数据路径
                if (Array.isArray(conceptResponse.data)) {
                    conceptData = conceptResponse.data;
                } else if (conceptResponse.data.gngd) {
                    conceptData = conceptResponse.data.gngd;
                } else if (conceptResponse.data.data && Array.isArray(conceptResponse.data.data)) {
                    conceptData = conceptResponse.data.data;
                } else if (conceptResponse.data.Result) {
                    conceptData = conceptResponse.data.Result;
                }

                if (Array.isArray(conceptData) && conceptData.length > 0) {
                    conceptData.forEach(item => {
                        // 尝试多个可能的字段名
                        const name = item.GDMC || item.NAME || item.name || item.ConceptionName || item.板块名称;
                        if (name && name !== '未分类概念') {
                            concepts.push(name);
                        }
                    });
                    if (concepts.length > 0) {
                        console.log(`✅ 从东方财富获取到 ${concepts.length} 个概念: ${concepts.join(', ')}`);
                    }
                }
            }

        } catch (emError) {
            console.warn('东方财富概念API失败:', emError.message);
        }

        // 方法2.2: 如果上面的API失败，尝试另一个东方财富板块概念API
        if (concepts.length === 0) {
            try {
                const plateUrl = `http://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f12,f13,f14,f127,f128`;
                console.log(`🔍 尝试东方财富板块分类API`);

                const plateResponse = await axios.get(plateUrl, {
                    headers: {
                        'Referer': 'http://quote.eastmoney.com/',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 8000
                });

                if (plateResponse.data && plateResponse.data.data) {
                    const data = plateResponse.data.data;
                    console.log(`📦 板块分类API返回: ${JSON.stringify(data).substring(0, 300)}`);

                    // f128 可能包含概念信息
                    if (data.f128) {
                        concepts.push(data.f128);
                        console.log(`✅ 从板块分类API获取到概念: ${data.f128}`);
                    }
                }
            } catch (plateError) {
                console.warn('东方财富板块分类API失败:', plateError.message);
            }
        }

        // 方法3: 备用 - 尝试同花顺概念板块API
        if (concepts.length === 0) {
            try {
                const thsUrl = `http://basic.10jqka.com.cn/mobile/stock/plate.html?code=${stockCode}`;
                console.log(`🔍 尝试同花顺API: ${thsUrl}`);

                const thsResponse = await axios.get(thsUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'http://www.10jqka.com.cn/'
                    },
                    timeout: 8000
                });

                // 解析HTML内容获取板块概念
                const htmlContent = thsResponse.data;

                // 查找行业板块
                const sectorMatch = htmlContent.match(/行业板块[^>]*>([^<]+)</);
                if (sectorMatch && sectorMatch[1] && sectors.length === 0) {
                    sectors.push(sectorMatch[1].trim());
                }

                // 查找概念板块（可能有多个）
                const conceptRegex = /概念板块.*?<div[^>]*>([^<]+)<\/div>/g;
                let match;
                while ((match = conceptRegex.exec(htmlContent)) !== null) {
                    if (match[1] && match[1].trim()) {
                        concepts.push(match[1].trim());
                    }
                }

            } catch (thsError) {
                console.warn('同花顺API失败:', thsError.message);
            }
        }

        // 方法3: 使用新浪财经的板块信息（备用）
        if (sectors.length === 0 && concepts.length === 0) {
            try {
                // 判断市场
                const market = stockCode.startsWith('6') ? 'sh' : 'sz';
                const sinaUrl = `http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page=1&num=1&sort=symbol&asc=1&node=hy_${market}&symbol=${market}${stockCode}`;

                console.log(`🔍 尝试新浪财经API: ${sinaUrl}`);

                const sinaResponse = await axios.get(sinaUrl, {
                    headers: {
                        'Referer': 'http://finance.sina.com.cn',
                        'User-Agent': 'Mozilla/5.0'
                    },
                    timeout: 5000
                });

                if (Array.isArray(sinaResponse.data) && sinaResponse.data.length > 0) {
                    const stockInfo = sinaResponse.data[0];
                    if (stockInfo.trade) {
                        sectors.push(stockInfo.trade);
                    }
                }
            } catch (sinaError) {
                console.warn('新浪财经API失败:', sinaError.message);
            }
        }

        console.log(`✅ 最终获取到板块: ${sectors.join(', ') || '无'}`);
        console.log(`✅ 最终获取到概念: ${concepts.join(', ') || '无'}`);

    } catch (error) {
        console.warn('获取板块概念失败:', error.message);
    }

    return {
        sectors: sectors.length > 0 ? sectors : ['未分类板块'],
        concepts: concepts.length > 0 ? concepts : ['未分类概念']
    };
}

/**
 * 获取东方财富的secid
 */
function getEastmoneySecid(stockCode) {
    // 沪市: 1.xxxxxx, 深市: 0.xxxxxx
    if (stockCode.startsWith('6')) {
        return `1.${stockCode}`;
    } else {
        return `0.${stockCode}`;
    }
}

/**
 * 获取板块或概念指数的代码
 * 这里简化处理，根据股票所属市场返回对应的指数
 */
async function getSectorConceptIndex(stockCode, sectors, concepts) {
    // 简化处理：根据股票所在市场返回相应指数
    // 沪市股票 -> 上证50 (000016)
    // 深市股票 -> 深证成指 (399001)
    // 创业板 -> 创业板指 (399006)

    let sectorCode = null;
    let sectorName = null;
    let conceptCode = null;
    let conceptName = null;

    if (stockCode.startsWith('6')) {
        // 沪市
        sectorCode = '000016'; // 上证50
        sectorName = '上证50';
    } else if (stockCode.startsWith('300')) {
        // 创业板
        sectorCode = '399006'; // 创业板指
        sectorName = '创业板指';
    } else {
        // 其他深市
        sectorCode = '399001'; // 深证成指
        sectorName = '深证成指';
    }

    // 概念使用中小板指数作为示例
    conceptCode = '399005'; // 中小板指
    conceptName = '中小板指';

    return {
        sector: {
            code: sectorCode,
            name: sectors[0] || sectorName // 使用真实板块名称，如果有的话
        },
        concept: {
            code: conceptCode,
            name: concepts[0] || conceptName // 使用真实概念名称，如果有的话
        }
    };
}
