const express = require('express');
const router = express.Router();
const axios = require('axios');

// Tushare Pro配置 - 请在环境变量中设置你的token
// 注册地址: https://tushare.pro/register
const TUSHARE_TOKEN = process.env.TUSHARE_TOKEN || '';
const TUSHARE_API_URL = 'http://api.tushare.pro';

module.exports = (authenticateToken) => {
    /**
     * 获取连板股票数据
     */
    router.get('/continuous-limit', authenticateToken, async (req, res) => {
        try {
            console.log('📊 开始获取连板股票数据...');

            // 从东方财富网获取真实涨停板数据
            const realData = await fetchRealContinuousLimitData();

            console.log(`✅ 成功获取 ${realData.length} 只连板股票`);

            res.json({
                success: true,
                data: realData,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ 获取连板数据失败:', error.message);
            console.error('错误详情:', error.stack);

            res.status(500).json({
                success: false,
                error: '获取连板数据失败',
                message: error.message,
                details: error.response?.data || null
            });
        }
    });

    /**
     * 获取概念板块数据
     */
    router.get('/concept', authenticateToken, async (req, res) => {
        try {
            console.log('📊 开始获取概念板块数据...');

            const conceptData = await fetchConceptSectorData();

            console.log(`✅ 成功获取 ${conceptData.length} 个概念板块`);

            res.json({
                success: true,
                data: conceptData,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ 获取概念板块失败:', error.message);
            console.error('错误详情:', error.stack);

            res.status(500).json({
                success: false,
                error: '获取概念板块失败',
                message: error.message
            });
        }
    });

    /**
     * 获取指定概念板块的成分股
     */
    router.get('/concept/:code/stocks', authenticateToken, async (req, res) => {
        try {
            const conceptCode = req.params.code;
            console.log(`📊 开始获取概念板块 ${conceptCode} 的成分股...`);

            const stocks = await fetchConceptStocks(conceptCode);

            console.log(`✅ 成功获取 ${stocks.length} 只成分股`);

            res.json({
                success: true,
                data: stocks,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ 获取概念成分股失败:', error.message);
            console.error('错误详情:', error.stack);

            res.status(500).json({
                success: false,
                error: '获取概念成分股失败',
                message: error.message
            });
        }
    });

    /**
     * 获取行业板块数据
     */
    router.get('/industry', authenticateToken, async (req, res) => {
        try {
            res.json({
                success: true,
                data: [],
                message: '行业板块功能开发中'
            });
        } catch (error) {
            console.error('获取行业板块失败:', error);
            res.status(500).json({
                success: false,
                error: '获取行业板块失败'
            });
        }
    });

    return router;
};

/**
 * 从新浪财经获取涨停板数据
 */
async function fetchRealContinuousLimitData() {
    try {
        // 新浪财经涨幅榜API - 获取涨幅前100的股票
        const url = 'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData';

        const params = {
            page: 1,
            num: 100,
            sort: 'changepercent',
            asc: 0,
            node: 'hs_a',  // 沪深A股
            symbol: '',
            _s_r_a: 'page'
        };

        console.log('正在请求新浪财经API...');

        const response = await axios.get(url, {
            params,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://finance.sina.com.cn/',
                'Accept': '*/*'
            }
        });

        if (!response.data || !Array.isArray(response.data)) {
            throw new Error('API返回数据格式错误');
        }

        const stocks = response.data;
        console.log(`获取到 ${stocks.length} 条股票数据`);

        // 过滤涨停股票（涨幅>=9.8%）
        const limitStocks = stocks
            .filter(stock => {
                const changePercent = parseFloat(stock.changepercent) || 0;
                // 涨幅>=9.8%视为涨停（考虑四舍五入）
                return changePercent >= 9.8;
            })
            .map(stock => {
                const changePercent = parseFloat(stock.changepercent) || 0;

                // 根据涨幅估算连板天数（简化逻辑）
                // 实际连板天数需要查询历史数据
                let continuousLimitDays = 1;

                return {
                    code: stock.symbol,                           // 股票代码
                    name: stock.name,                             // 股票名称
                    current_price: parseFloat(stock.trade) || 0,  // 最新价
                    change_percent: changePercent,                // 涨跌幅
                    volume: parseFloat(stock.volume) || 0,        // 成交量
                    amount: parseFloat(stock.amount) || 0,        // 成交额
                    turnover_rate: parseFloat(stock.turnoverratio) || 0, // 换手率
                    continuous_limit_days: continuousLimitDays,   // 连板天数
                    high: parseFloat(stock.high) || 0,            // 最高价
                    low: parseFloat(stock.low) || 0               // 最低价
                };
            })
            .sort((a, b) => {
                // 按涨幅降序排序
                return b.change_percent - a.change_percent;
            });

        console.log(`筛选出 ${limitStocks.length} 只涨停股票`);
        return limitStocks;

    } catch (error) {
        console.error('从新浪财经获取数据失败:', error.message);
        throw error;
    }
}

/**
 * 从各数据源获取概念板块数据
 */
async function fetchConceptSectorData() {
    // 优先使用腾讯财经（较稳定）
    try {
        return await fetchConceptFromTencent();
    } catch (error) {
        console.error('从腾讯财经获取概念板块失败:', error.message);

        // 回退到东方财富网
        try {
            return await fetchConceptFromEastmoney();
        } catch (eastmoneyError) {
            console.error('从东方财富网获取概念板块失败:', eastmoneyError.message);

            // 回退到Tushare Pro
            if (TUSHARE_TOKEN) {
                try {
                    return await fetchConceptFromTushare();
                } catch (tushareError) {
                    console.error('从Tushare Pro获取概念板块失败:', tushareError.message);
                }
            }

            // 最后尝试新浪财经
            return await fetchConceptFromSina();
        }
    }
}

/**
 * 从腾讯财经获取概念板块数据
 */
async function fetchConceptFromTencent() {
    try {
        console.log('正在从腾讯财经获取概念板块数据...');

        // 腾讯财经概念板块API
        const url = 'http://qt.gtimg.cn/q=s_pksz399006'; // 先获取概念板块列表

        // 使用腾讯行情中心API获取板块数据
        const listUrl = 'http://stock.gtimg.cn/data/index.php';

        const params = {
            appn: 'rank',
            t: 'ranka/chr',
            p: -1,
            o: 0,
            l: 500,
            v: 'list_data'
        };

        const response = await axios.get(listUrl, {
            params,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'http://stock.gtimg.cn/',
                'Accept': '*/*'
            }
        });

        if (!response.data) {
            throw new Error('腾讯财经API返回空数据');
        }

        // 腾讯API返回的是 JavaScript 代码，需要解析
        let dataStr = response.data;
        console.log('腾讯API原始响应前500字符:', dataStr.substring(0, 500));

        // 提取数据部分 - 使用贪婪匹配来获取完整JSON对象
        const match = dataStr.match(/var list_data=({.+});/);
        if (!match) {
            console.log('未匹配到数据，尝试查找其他格式...');
            // 尝试直接查找JSON数组格式
            const arrayMatch = dataStr.match(/\[.+\]/);
            if (arrayMatch) {
                console.log('找到数组格式数据');
                const concepts = JSON.parse(arrayMatch[0]);
                const formattedConcepts = concepts.map(concept => ({
                    code: concept[0],
                    name: concept[1],
                    change_percent: parseFloat(concept[5]) || 0,
                    current_price: parseFloat(concept[4]) || 0,
                    volume: parseFloat(concept[6]) || 0,
                    amount: parseFloat(concept[7]) || 0,
                    stock_count: parseInt(concept[2]) || 0
                }));
                formattedConcepts.sort((a, b) => b.change_percent - a.change_percent);
                return formattedConcepts;
            }
            throw new Error('腾讯财经API数据格式错误');
        }

        console.log('提取的JSON字符串前200字符:', match[1].substring(0, 200));
        const data = JSON.parse(match[1]);
        if (!data || !data.data) {
            throw new Error('腾讯财经返回空数据');
        }

        const concepts = data.data;
        console.log(`获取到 ${concepts.length} 个概念板块`);

        // 格式化数据
        const formattedConcepts = concepts.map(concept => ({
            code: concept[0],                                    // 板块代码
            name: concept[1],                                    // 板块名称
            change_percent: parseFloat(concept[5]) || 0,         // 涨跌幅
            current_price: parseFloat(concept[4]) || 0,          // 最新价
            volume: parseFloat(concept[6]) || 0,                 // 成交量
            amount: parseFloat(concept[7]) || 0,                 // 成交额
            stock_count: parseInt(concept[2]) || 0               // 成分股数量
        }));

        // 按涨跌幅排序
        formattedConcepts.sort((a, b) => b.change_percent - a.change_percent);

        return formattedConcepts;

    } catch (error) {
        console.error('从腾讯财经获取概念板块失败:', error.message);
        throw error;
    }
}

/**
 * 从东方财富网获取概念板块数据
 */
async function fetchConceptFromEastmoney() {
    try {
        console.log('正在从东方财富网获取概念板块数据...');

        // 使用东方财富网web端API（更稳定）
        const url = 'https://push2.eastmoney.com/api/qt/clist/get';

        const params = {
            pn: 1,
            pz: 500,
            po: 1,
            np: 1,
            ut: 'bd1d9ddb04089700cf9c27f6f7426281',
            fltt: 2,
            invt: 2,
            fid: 'f3',  // 按涨跌幅排序
            fs: 'm:90+t:3',  // 概念板块
            fields: 'f12,f14,f2,f3,f5,f6,f104,f105,f106',
            _: Date.now()
            // f12: 代码, f14: 名称, f2: 最新价, f3: 涨跌幅, f5: 成交量, f6: 成交额
            // f104: 上涨家数, f105: 下跌家数, f106: 平盘家数
        };

        const response = await axios.get(url, {
            params,
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://quote.eastmoney.com/center/boardlist.html',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            httpsAgent: new (require('https')).Agent({
                rejectUnauthorized: false
            })
        });

        if (!response.data || !response.data.data || !response.data.data.diff) {
            throw new Error('东方财富网API返回数据格式错误');
        }

        const concepts = response.data.data.diff;
        if (!concepts || concepts.length === 0) {
            throw new Error('东方财富网返回空数据');
        }

        console.log(`获取到 ${concepts.length} 个概念板块`);

        // 格式化数据
        const formattedConcepts = concepts.map(concept => ({
            code: concept.f12,           // 板块代码
            name: concept.f14,           // 板块名称
            change_percent: parseFloat(concept.f3) || 0,     // 涨跌幅
            current_price: parseFloat(concept.f2) || 0,      // 最新价
            volume: parseFloat(concept.f5) || 0,             // 成交量
            amount: parseFloat(concept.f6) || 0,             // 成交额
            stock_count: (concept.f104 || 0) + (concept.f105 || 0) + (concept.f106 || 0)  // 成分股数量
        }));

        // 按涨跌幅排序
        formattedConcepts.sort((a, b) => b.change_percent - a.change_percent);

        return formattedConcepts;

    } catch (error) {
        console.error('从东方财富网获取概念板块失败:', error.message);
        throw error;
    }
}

/**
 * 从Tushare Pro获取概念板块数据
 */
async function fetchConceptFromTushare() {
    try {
        console.log('正在从Tushare Pro获取概念板块数据...');

        // 尝试使用ths_index接口获取同花顺概念指数（免费接口）
        const conceptResponse = await axios.post(TUSHARE_API_URL, {
            api_name: 'ths_index',
            token: TUSHARE_TOKEN,
            params: {
                exchange: 'A',  // A股
                type: 'N'  // 概念指数
            },
            fields: 'ts_code,name'
        }, {
            timeout: 15000
        });

        if (conceptResponse.data.code !== 0) {
            throw new Error(`Tushare API错误: ${conceptResponse.data.msg}`);
        }

        const concepts = conceptResponse.data.data;
        if (!concepts || !concepts.items || concepts.items.length === 0) {
            throw new Error('Tushare Pro返回空数据');
        }

        console.log(`获取到 ${concepts.items.length} 个概念板块`);

        // 获取每个概念指数的当日行情
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const conceptsWithQuotes = [];

        // 批量获取指数行情（免费接口）
        for (const concept of concepts.items.slice(0, 100)) {
            try {
                const quoteResponse = await axios.post(TUSHARE_API_URL, {
                    api_name: 'index_daily',
                    token: TUSHARE_TOKEN,
                    params: {
                        ts_code: concept[0],
                        trade_date: today
                    },
                    fields: 'ts_code,close,pct_chg,vol,amount'
                }, {
                    timeout: 5000
                });

                if (quoteResponse.data.code === 0 && quoteResponse.data.data.items && quoteResponse.data.data.items.length > 0) {
                    const quote = quoteResponse.data.data.items[0];
                    conceptsWithQuotes.push({
                        code: concept[0],
                        name: concept[1],
                        change_percent: parseFloat(quote[2]) || 0,  // pct_chg
                        current_price: parseFloat(quote[1]) || 0,   // close
                        volume: parseFloat(quote[3]) || 0,          // vol
                        amount: parseFloat(quote[4]) || 0,          // amount
                        stock_count: 0
                    });
                } else {
                    // 如果获取不到行情，只添加基础信息
                    conceptsWithQuotes.push({
                        code: concept[0],
                        name: concept[1],
                        change_percent: 0,
                        current_price: 0,
                        volume: 0,
                        amount: 0,
                        stock_count: 0
                    });
                }

                // 避免请求过快
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (quoteError) {
                console.error(`获取指数 ${concept[0]} 行情失败:`, quoteError.message);
                // 添加基础信息
                conceptsWithQuotes.push({
                    code: concept[0],
                    name: concept[1],
                    change_percent: 0,
                    current_price: 0,
                    volume: 0,
                    amount: 0,
                    stock_count: 0
                });
            }
        }

        // 按涨跌幅排序
        conceptsWithQuotes.sort((a, b) => b.change_percent - a.change_percent);

        return conceptsWithQuotes;

    } catch (error) {
        console.error('从Tushare Pro获取概念板块失败:', error.message);
        throw error;
    }
}

/**
 * 从新浪财经获取概念板块数据（已知返回空数据）
 */
async function fetchConceptFromSina() {
    try {
        const url = 'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData';

        const params = {
            page: 1,
            num: 200,
            sort: 'changepercent',
            asc: 0,
            node: 'hy_概念',
            symbol: '',
            _s_r_a: 'page'
        };

        console.log('正在请求新浪财经概念板块API（已知返回空数据）...');

        const response = await axios.get(url, {
            params,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://finance.sina.com.cn/',
                'Accept': '*/*'
            }
        });

        if (!response.data || !Array.isArray(response.data)) {
            throw new Error('新浪财经API返回数据格式错误');
        }

        const concepts = response.data;

        if (!concepts || concepts.length === 0) {
            throw new Error('新浪财经API返回空数据。建议使用Tushare Pro：1) 访问 https://tushare.pro/register 注册账号  2) 在.env文件中设置 TUSHARE_TOKEN=你的token');
        }

        return concepts.map(concept => ({
            code: concept.code || concept.symbol,
            name: concept.name,
            change_percent: parseFloat(concept.changepercent) || 0,
            current_price: parseFloat(concept.trade) || 0,
            volume: parseFloat(concept.volume) || 0,
            amount: parseFloat(concept.amount) || 0,
            stock_count: parseInt(concept.count) || 0
        })).sort((a, b) => b.change_percent - a.change_percent);

    } catch (error) {
        console.error('从新浪财经获取概念板块数据失败:', error.message);
        throw error;
    }
}

/**
 * 获取指定概念板块的成分股
 */
async function fetchConceptStocks(conceptCode) {
    // 优先使用腾讯财经
    try {
        return await fetchConceptStocksFromTencent(conceptCode);
    } catch (error) {
        console.error('从腾讯财经获取概念成分股失败:', error.message);

        // 回退到东方财富网
        try {
            return await fetchConceptStocksFromEastmoney(conceptCode);
        } catch (eastmoneyError) {
            console.error('从东方财富网获取概念成分股失败:', eastmoneyError.message);

            // 回退到Tushare Pro
            if (TUSHARE_TOKEN) {
                try {
                    return await fetchConceptStocksFromTushare(conceptCode);
                } catch (tushareError) {
                    console.error('从Tushare Pro获取概念成分股失败:', tushareError.message);
                }
            }

            // 最后尝试新浪财经
            return await fetchConceptStocksFromSina(conceptCode);
        }
    }
}

/**
 * 从腾讯财经获取概念成分股
 */
async function fetchConceptStocksFromTencent(conceptCode) {
    try {
        console.log(`正在从腾讯财经获取概念 ${conceptCode} 的成分股...`);

        // 腾讯财经概念成分股API
        const url = 'http://stock.gtimg.cn/data/index.php';

        const params = {
            appn: 'rank',
            t: `ranka/chr_${conceptCode}`,
            p: -1,
            o: 0,
            l: 500,
            v: 'list_data'
        };

        const response = await axios.get(url, {
            params,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'http://stock.gtimg.cn/',
                'Accept': '*/*'
            }
        });

        if (!response.data) {
            throw new Error('腾讯财经API返回空数据');
        }

        // 腾讯API返回的是 JavaScript 代码，需要解析
        const dataStr = response.data;

        // 提取数据部分
        const match = dataStr.match(/var list_data=({.*?});/);
        if (!match) {
            throw new Error('腾讯财经API数据格式错误');
        }

        const data = JSON.parse(match[1]);
        if (!data || !data.data) {
            return [];
        }

        const stocks = data.data;
        console.log(`获取到 ${stocks.length} 只成分股`);

        // 格式化数据
        const formattedStocks = stocks.map(stock => ({
            code: stock[0],                                // 股票代码
            name: stock[1],                                // 股票名称
            current_price: parseFloat(stock[3]) || 0,      // 最新价
            change_percent: parseFloat(stock[4]) || 0,     // 涨跌幅
            volume: parseFloat(stock[5]) || 0,             // 成交量
            amount: parseFloat(stock[6]) || 0,             // 成交额
            turnover_rate: parseFloat(stock[9]) || 0,      // 换手率
            high: parseFloat(stock[7]) || 0,               // 最高价
            low: parseFloat(stock[8]) || 0                 // 最低价
        }));

        // 按涨跌幅排序
        formattedStocks.sort((a, b) => b.change_percent - a.change_percent);

        return formattedStocks;

    } catch (error) {
        console.error('从腾讯财经获取概念成分股失败:', error.message);
        throw error;
    }
}

/**
 * 从东方财富网获取概念成分股
 */
async function fetchConceptStocksFromEastmoney(conceptCode) {
    try {
        console.log(`正在从东方财富网获取概念 ${conceptCode} 的成分股...`);

        // 使用东方财富网web端API（更稳定）
        const url = 'https://push2.eastmoney.com/api/qt/clist/get';

        const params = {
            pn: 1,
            pz: 500,
            po: 1,
            np: 1,
            ut: 'bd1d9ddb04089700cf9c27f6f7426281',
            fltt: 2,
            invt: 2,
            fid: 'f3',  // 按涨跌幅排序
            fs: `b:${conceptCode}`,  // 指定概念板块
            fields: 'f12,f14,f2,f3,f5,f6,f8,f9,f10,f15,f16',
            _: Date.now()
            // f12: 代码, f14: 名称, f2: 最新价, f3: 涨跌幅, f5: 成交量, f6: 成交额
            // f8: 换手率, f9: 市盈率, f10: 量比, f15: 最高价, f16: 最低价
        };

        const response = await axios.get(url, {
            params,
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://quote.eastmoney.com/center/boardlist.html',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            httpsAgent: new (require('https')).Agent({
                rejectUnauthorized: false
            })
        });

        if (!response.data || !response.data.data || !response.data.data.diff) {
            throw new Error('东方财富网API返回数据格式���误');
        }

        const stocks = response.data.data.diff;
        if (!stocks || stocks.length === 0) {
            return [];
        }

        console.log(`获取到 ${stocks.length} 只成分股`);

        // 格式化数据
        const formattedStocks = stocks.map(stock => ({
            code: stock.f12,                                // 股票代码
            name: stock.f14,                                // 股票名称
            current_price: parseFloat(stock.f2) || 0,       // 最新价
            change_percent: parseFloat(stock.f3) || 0,      // 涨跌幅
            volume: parseFloat(stock.f5) || 0,              // 成交量
            amount: parseFloat(stock.f6) || 0,              // 成交额
            turnover_rate: parseFloat(stock.f8) || 0,       // 换手率
            high: parseFloat(stock.f15) || 0,               // 最高价
            low: parseFloat(stock.f16) || 0                 // 最低价
        }));

        // 按涨跌幅排序
        formattedStocks.sort((a, b) => b.change_percent - a.change_percent);

        return formattedStocks;

    } catch (error) {
        console.error('从东方财富网获取概念成分股失败:', error.message);
        throw error;
    }
}

/**
 * 从Tushare Pro获取概念成分股
 */
async function fetchConceptStocksFromTushare(conceptCode) {
    try {
        console.log(`正在从Tushare Pro获取概念 ${conceptCode} 的成分股...`);

        // 获取同花顺概念指数成分股（免费接口）
        const response = await axios.post(TUSHARE_API_URL, {
            api_name: 'ths_member',
            token: TUSHARE_TOKEN,
            params: {
                ts_code: conceptCode
            },
            fields: 'ts_code,code,name'
        }, {
            timeout: 15000
        });

        if (response.data.code !== 0) {
            throw new Error(`Tushare API错误: ${response.data.msg}`);
        }

        const stocks = response.data.data;
        if (!stocks || !stocks.items || stocks.items.length === 0) {
            return [];
        }

        console.log(`获取到 ${stocks.items.length} 只成分股`);

        // 获取今日日期
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const formattedStocks = [];

        // 获取每只股票的当日行情（免费接口）
        for (const stock of stocks.items) {
            try {
                const quoteResponse = await axios.post(TUSHARE_API_URL, {
                    api_name: 'daily',
                    token: TUSHARE_TOKEN,
                    params: {
                        ts_code: stock[0],
                        trade_date: today
                    },
                    fields: 'ts_code,close,pct_chg,vol,amount,high,low,turnover_rate'
                }, {
                    timeout: 5000
                });

                if (quoteResponse.data.code === 0 && quoteResponse.data.data.items && quoteResponse.data.data.items.length > 0) {
                    const quote = quoteResponse.data.data.items[0];
                    formattedStocks.push({
                        code: stock[1] || stock[0].replace('.SH', '').replace('.SZ', ''),
                        name: stock[2],
                        current_price: parseFloat(quote[1]) || 0,      // close
                        change_percent: parseFloat(quote[2]) || 0,      // pct_chg
                        volume: parseFloat(quote[3]) || 0,              // vol
                        amount: parseFloat(quote[4]) || 0,              // amount
                        high: parseFloat(quote[5]) || 0,                // high
                        low: parseFloat(quote[6]) || 0,                 // low
                        turnover_rate: parseFloat(quote[7]) || 0        // turnover_rate
                    });
                } else {
                    // 如果获取不到行情，只添加基础信息
                    formattedStocks.push({
                        code: stock[1] || stock[0].replace('.SH', '').replace('.SZ', ''),
                        name: stock[2],
                        current_price: 0,
                        change_percent: 0,
                        volume: 0,
                        amount: 0,
                        high: 0,
                        low: 0,
                        turnover_rate: 0
                    });
                }

                // 避免请求过快
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (quoteError) {
                console.error(`获取股票 ${stock[0]} 行情失败:`, quoteError.message);
                // 添加基础信息
                formattedStocks.push({
                    code: stock[1] || stock[0].replace('.SH', '').replace('.SZ', ''),
                    name: stock[2],
                    current_price: 0,
                    change_percent: 0,
                    volume: 0,
                    amount: 0,
                    high: 0,
                    low: 0,
                    turnover_rate: 0
                });
            }
        }

        // 按涨跌幅排序
        formattedStocks.sort((a, b) => b.change_percent - a.change_percent);

        return formattedStocks;

    } catch (error) {
        console.error('从Tushare Pro获取概念成分股失败:', error.message);
        throw error;
    }
}

/**
 * 从新浪财经获取概念成分股
 */
async function fetchConceptStocksFromSina(conceptCode) {
    try {
        const url = 'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData';

        const params = {
            page: 1,
            num: 500,
            sort: 'changepercent',
            asc: 0,
            node: conceptCode,
            symbol: '',
            _s_r_a: 'page'
        };

        console.log(`正在请求新浪财经概念 ${conceptCode} 的成分股...`);

        const response = await axios.get(url, {
            params,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://finance.sina.com.cn/',
                'Accept': '*/*'
            }
        });

        if (!response.data || !Array.isArray(response.data)) {
            throw new Error('新浪财经API返回数据格式错误');
        }

        const stocks = response.data;
        console.log(`获取到 ${stocks.length} 只成分股`);

        return stocks.map(stock => ({
            code: stock.symbol,
            name: stock.name,
            current_price: parseFloat(stock.trade) || 0,
            change_percent: parseFloat(stock.changepercent) || 0,
            volume: parseFloat(stock.volume) || 0,
            amount: parseFloat(stock.amount) || 0,
            turnover_rate: parseFloat(stock.turnoverratio) || 0,
            high: parseFloat(stock.high) || 0,
            low: parseFloat(stock.low) || 0
        })).sort((a, b) => b.change_percent - a.change_percent);

    } catch (error) {
        console.error('从新浪财经获取概念成分股失败:', error.message);
        throw error;
    }
}
