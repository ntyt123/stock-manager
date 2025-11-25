// ==================== 市场情绪分析路由 ====================
// 提供真实的市场数据，包括资金流向、龙虎榜、大单追踪等

const express = require('express');
const axios = require('axios');
const { db } = require('../database/connection');

module.exports = function(authenticateToken) {
    const router = express.Router();

    // ==================== 辅助函数：检查是否为交易时间 ====================
    const isTradingHours = () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const day = now.getDay();

        // 周末不是交易时间
        if (day === 0 || day === 6) {
            return false;
        }

        const currentTime = hours * 60 + minutes;
        const morningStart = 9 * 60 + 30;  // 9:30
        const morningEnd = 11 * 60 + 30;   // 11:30
        const afternoonStart = 13 * 60;     // 13:00
        const afternoonEnd = 15 * 60;       // 15:00

        return (currentTime >= morningStart && currentTime <= morningEnd) ||
               (currentTime >= afternoonStart && currentTime <= afternoonEnd);
    };

    // ==================== 辅助函数：保存市场统计数据 ====================
    const saveMarketStats = (upCount, downCount, flatCount, total) => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date().toISOString();

            // 使用 INSERT OR REPLACE 确保每天只有一条记录
            db.prepare(`
                INSERT OR REPLACE INTO market_stats
                (trade_date, up_count, down_count, flat_count, total_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?,
                    COALESCE((SELECT created_at FROM market_stats WHERE trade_date = ?), ?),
                    ?)
            `).run(today, upCount, downCount, flatCount, total, today, now, now);

            console.log(`✅ 市场统计已保存到数据库: ${today}, 上涨${upCount}, 下跌${downCount}, 平盘${flatCount}`);
            return true;
        } catch (error) {
            console.error('❌ 保存市场统计失败:', error.message);
            return false;
        }
    };

    // ==================== 辅助函数：从数据库获取最新市场统计 ====================
    const getLatestMarketStats = () => {
        try {
            const row = db.prepare(`
                SELECT trade_date, up_count, down_count, flat_count, total_count
                FROM market_stats
                ORDER BY trade_date DESC
                LIMIT 1
            `).get();

            if (row) {
                console.log(`📊 从数据库获取历史数据: ${row.trade_date}, 上涨${row.up_count}, 下跌${row.down_count}`);
                return {
                    upCount: row.up_count,
                    downCount: row.down_count,
                    flatCount: row.flat_count,
                    total: row.total_count,
                    tradeDate: row.trade_date,
                    isHistorical: true
                };
            }
            return null;
        } catch (error) {
            console.error('❌ 从数据库获取市场统计失败:', error.message);
            return null;
        }
    };

    // ==================== 获取资金流向数据 ====================
    router.get('/funds-flow', authenticateToken, async (req, res) => {
        try {
            // 调用东方财富资金流向API
            const response = await axios.get('http://push2.eastmoney.com/api/qt/stock/fflow/kline/get', {
                params: {
                    lmt: 0,
                    klt: 1,
                    secid: '1.000001', // 上证指数
                    fields1: 'f1,f2,f3,f7',
                    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63'
                },
                timeout: 5000
            });

            if (response.data && response.data.data) {
                const klines = response.data.data.klines || [];
                const latest = klines[klines.length - 1];

                if (latest) {
                    const values = latest.split(',');
                    const fundsFlowData = [
                        {
                            sector: '主力资金',
                            inflow: parseFloat(values[1]) > 0 ? (Math.abs(parseFloat(values[1])) / 100000000) : 0,
                            outflow: parseFloat(values[1]) < 0 ? (Math.abs(parseFloat(values[1])) / 100000000) : 0,
                            net: parseFloat(values[1]) / 100000000
                        },
                        {
                            sector: '超大单',
                            inflow: parseFloat(values[2]) > 0 ? (Math.abs(parseFloat(values[2])) / 100000000) : 0,
                            outflow: parseFloat(values[2]) < 0 ? (Math.abs(parseFloat(values[2])) / 100000000) : 0,
                            net: parseFloat(values[2]) / 100000000
                        },
                        {
                            sector: '大单',
                            inflow: parseFloat(values[3]) > 0 ? (Math.abs(parseFloat(values[3])) / 100000000) : 0,
                            outflow: parseFloat(values[3]) < 0 ? (Math.abs(parseFloat(values[3])) / 100000000) : 0,
                            net: parseFloat(values[3]) / 100000000
                        },
                        {
                            sector: '中单',
                            inflow: parseFloat(values[4]) > 0 ? (Math.abs(parseFloat(values[4])) / 100000000) : 0,
                            outflow: parseFloat(values[4]) < 0 ? (Math.abs(parseFloat(values[4])) / 100000000) : 0,
                            net: parseFloat(values[4]) / 100000000
                        },
                        {
                            sector: '小单',
                            inflow: parseFloat(values[5]) > 0 ? (Math.abs(parseFloat(values[5])) / 100000000) : 0,
                            outflow: parseFloat(values[5]) < 0 ? (Math.abs(parseFloat(values[5])) / 100000000) : 0,
                            net: parseFloat(values[5]) / 100000000
                        }
                    ];

                    return res.json({
                        success: true,
                        data: fundsFlowData
                    });
                }
            }

            throw new Error('无法获取资金流向数据');
        } catch (error) {
            console.error('❌ 获取资金流向失败:', error.message);
            res.status(500).json({
                success: false,
                error: '获取资金流向数据失败',
                message: error.message
            });
        }
    });

    // ==================== 获取行业资金流向数据 ====================
    router.get('/industry-flow', authenticateToken, async (req, res) => {
        try {
            // 调用东方财富行业资金流向API
            const response = await axios.get('http://push2.eastmoney.com/api/qt/clist/get', {
                params: {
                    pn: 1,
                    pz: 10,
                    po: 1,
                    np: 1,
                    fltt: 2,
                    invt: 2,
                    fid: 'f62',
                    fs: 'm:90+t:2',
                    fields: 'f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f204,f205,f124,f1,f13'
                },
                timeout: 5000
            });

            if (response.data && response.data.data && response.data.data.diff) {
                const industries = response.data.data.diff;
                const industryFlowData = industries.slice(0, 10).map(industry => {
                    const netInflow = parseFloat(industry.f62) || 0;
                    const changePercent = parseFloat(industry.f3) || 0;
                    return {
                        industry: industry.f14,
                        inflow: (netInflow > 0 ? netInflow : 0) / 100000000, // 转换为亿元
                        outflow: (netInflow < 0 ? Math.abs(netInflow) : 0) / 100000000, // 转换为亿元
                        net: netInflow / 100000000, // 转换为亿元
                        change: changePercent
                    };
                });

                return res.json({
                    success: true,
                    data: industryFlowData
                });
            }

            throw new Error('无法获取行业资金流向数据');
        } catch (error) {
            console.error('❌ 获取行业资金流向失败:', error.message);
            res.status(500).json({
                success: false,
                error: '获取行业资金流向数据失败',
                message: error.message
            });
        }
    });

    // ==================== 获取龙虎榜数据 ====================
    router.get('/dragon-tiger', authenticateToken, async (req, res) => {
        try {
            // 调用东方财富龙虎榜API
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

            console.log('🔍 正在获取龙虎榜数据...');

            const response = await axios.get('http://datacenter-web.eastmoney.com/api/data/v1/get', {
                params: {
                    reportName: 'RPT_DAILYBILLBOARD_DETAILS',
                    columns: 'SECURITY_CODE,SECUCODE,SECURITY_NAME_ABBR,TRADE_DATE,EXPLANATION,CLOSE_PRICE,CHANGE_RATE,BILLBOARD_NET_AMT,BILLBOARD_BUY_AMT,BILLBOARD_SELL_AMT,BILLBOARD_DEAL_AMT,ACCUM_AMOUNT,DEAL_NET_RATIO,DEAL_AMOUNT_RATIO,TURNOVERRATE,FREE_MARKET_CAP,EXPLANATION,D1_CLOSE_ADJCHRATE,D2_CLOSE_ADJCHRATE,D5_CLOSE_ADJCHRATE,D10_CLOSE_ADJCHRATE,SECURITY_TYPE_CODE',
                    pageNumber: 1,
                    pageSize: 10,
                    sortTypes: -1,
                    sortColumns: 'TRADE_DATE,BILLBOARD_NET_AMT',
                    source: 'WEB',
                    client: 'WEB'
                },
                timeout: 5000
            });

            // 详细日志：查看API返回的数据结构
            console.log('📊 龙虎榜API响应状态:', response.status);
            console.log('📊 响应数据结构:', JSON.stringify({
                hasData: !!response.data,
                hasResult: !!(response.data && response.data.result),
                hasResultData: !!(response.data && response.data.result && response.data.result.data),
                dataLength: response.data?.result?.data?.length || 0
            }));

            if (response.data && response.data.result && response.data.result.data) {
                const stocks = response.data.result.data;
                console.log(`✅ 成功获取 ${stocks.length} 条龙虎榜数据`);

                const dragonTigerData = stocks.map(stock => ({
                    name: stock.SECURITY_NAME_ABBR,
                    code: stock.SECURITY_CODE,
                    change: (stock.CHANGE_RATE || 0).toFixed(2),
                    amount: (stock.BILLBOARD_NET_AMT / 100000000).toFixed(2), // 转换为亿元
                    reason: stock.EXPLANATION || '连续三日涨幅偏离值达20%'
                }));

                return res.json({
                    success: true,
                    data: dragonTigerData
                });
            }

            // 如果没有数据，返回空数组而不是错误
            console.log('⚠️ 龙虎榜API返回数据格式不正确或暂无数据，返回空数组');
            return res.json({
                success: true,
                data: [],
                message: '暂无龙虎榜数据'
            });
        } catch (error) {
            console.error('❌ 获取龙虎榜失败:', error.message);
            console.error('❌ 错误详情:', {
                code: error.code,
                response: error.response?.status,
                data: error.response?.data
            });

            // 返回空数组而不是500错误，让前端优雅降级
            return res.json({
                success: true,
                data: [],
                message: '龙虎榜数据暂时无法获取'
            });
        }
    });

    // ==================== 获取大单追踪数据 ====================
    router.get('/big-orders', authenticateToken, async (req, res) => {
        try {
            // 调用东方财富大单数据API
            const response = await axios.get('http://push2.eastmoney.com/api/qt/clist/get', {
                params: {
                    pn: 1,
                    pz: 20,
                    po: 1,
                    np: 1,
                    fltt: 2,
                    invt: 2,
                    fid: 'f62',
                    fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23',
                    fields: 'f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87'
                },
                timeout: 5000
            });

            if (response.data && response.data.data && response.data.data.diff) {
                const stocks = response.data.data.diff;
                const bigOrdersData = stocks.slice(0, 15).map(stock => {
                    const netAmount = parseFloat(stock.f62) || 0;
                    return {
                        name: stock.f14,
                        code: stock.f12,
                        type: netAmount > 0 ? 'buy' : 'sell',
                        amount: (Math.abs(netAmount) / 100000000).toFixed(2), // 转换为亿元
                        price: (stock.f2 || 0).toFixed(2),
                        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                    };
                });

                return res.json({
                    success: true,
                    data: bigOrdersData
                });
            }

            throw new Error('无法获取大单追踪数据');
        } catch (error) {
            console.error('❌ 获取大单追踪失败:', error.message);
            res.status(500).json({
                success: false,
                error: '获取大单追踪数据失败',
                message: error.message
            });
        }
    });

    // ==================== 获取北上资金数据 ====================
    router.get('/northbound-funds', authenticateToken, async (req, res) => {
        try {
            // 调用东方财富沪深港通资金流向API
            const response = await axios.get('http://push2.eastmoney.com/api/qt/kamt.rtmin/get', {
                params: {
                    fields1: 'f1,f2,f3,f4',
                    fields2: 'f51,f52,f53,f54,f55,f56'
                },
                timeout: 5000
            });

            if (response.data && response.data.data) {
                const data = response.data.data;
                const hgtInflow = parseFloat(data.hgt?.f52 || 0); // 沪股通净流入
                const sgtInflow = parseFloat(data.sgt?.f52 || 0); // 深股通净流入
                const totalInflow = hgtInflow + sgtInflow;

                return res.json({
                    success: true,
                    data: {
                        total: (totalInflow / 100000000).toFixed(2), // 转换为亿元
                        hgt: (hgtInflow / 100000000).toFixed(2),
                        sgt: (sgtInflow / 100000000).toFixed(2)
                    }
                });
            }

            throw new Error('无法获取北上资金数据');
        } catch (error) {
            console.error('❌ 获取北上资金失败:', error.message);
            res.status(500).json({
                success: false,
                error: '获取北上资金数据失败',
                message: error.message
            });
        }
    });

    // ==================== 获取市场涨跌统计数据 ====================
    router.get('/market-stats', authenticateToken, async (req, res) => {
        try {
            console.log('🔍 正在获取市场涨跌统计...');

            // 检查是否为交易时间
            const tradingHours = isTradingHours();
            console.log(`⏰ 当前${tradingHours ? '是' : '不是'}交易时间`);

            // 如果不是交易时间，直接返回数据库中的历史数据
            if (!tradingHours) {
                console.log('📚 非交易时间，从数据库获取最新历史数据...');
                const historicalData = getLatestMarketStats();

                if (historicalData) {
                    return res.json({
                        success: true,
                        data: historicalData
                    });
                } else {
                    console.warn('⚠️ 数据库中没有历史数据');
                    return res.json({
                        success: true,
                        data: { upCount: 0, downCount: 0, flatCount: 0, total: 0, isHistorical: true }
                    });
                }
            }

            // 交易时间内，尝试从API获取实时数据
            console.log('🔴 交易时间内，尝试获取实时数据...');

            // 方法1: 使用网易财经沪深市场概况API
            try {
                console.log('📊 尝试网易财经市场概况API...');

                // 网易API可以直接获取沪深市场的涨跌家数
                const url163 = 'http://api.money.126.net/data/feed/0000001,1399001,money.api';
                const response163 = await axios.get(url163, {
                    timeout: 5000,
                    headers: {
                        'Referer': 'http://quotes.money.163.com/'
                    }
                });

                if (response163.data) {
                    // 解析JSONP格式: _ntes_quote_callback({"0000001":{...},"1399001":{...}});
                    const jsonMatch = response163.data.match(/_ntes_quote_callback\((.+)\)/);
                    if (jsonMatch) {
                        const data = JSON.parse(jsonMatch[1]);

                        // 上证指数数据
                        const sh = data['0000001'];
                        // 深证成指数据
                        const sz = data['1399001'];

                        if (sh && sz) {
                            // 网易API字段: upNum=上涨家数, downNum=下跌家数
                            const shUp = parseInt(sh.upNum) || 0;
                            const shDown = parseInt(sh.downNum) || 0;
                            const szUp = parseInt(sz.upNum) || 0;
                            const szDown = parseInt(sz.downNum) || 0;

                            const totalUp = shUp + szUp;
                            const totalDown = shDown + szDown;

                            if (totalUp > 10 && totalDown > 10) {
                                console.log(`✅ 网易市场统计: 上涨${totalUp}, 下跌${totalDown}`);

                                // 保存到数据库
                                saveMarketStats(totalUp, totalDown, 0, totalUp + totalDown);

                                return res.json({
                                    success: true,
                                    data: {
                                        upCount: totalUp,
                                        downCount: totalDown,
                                        flatCount: 0,
                                        total: totalUp + totalDown,
                                        isHistorical: false
                                    }
                                });
                            } else {
                                console.warn(`⚠️ 网易数据不合理: 上涨${totalUp}, 下跌${totalDown}`);
                            }
                        }
                    }
                }
            } catch (error163) {
                console.warn('⚠️ 网易财经API失败:', error163.message);
            }

            // 方法2: 使用东方财富股票列表API获取所有A股并统计
            try {
                console.log('📊 尝试东方财富A股列表统计...');

                const response = await axios.get('http://push2.eastmoney.com/api/qt/clist/get', {
                    params: {
                        pn: 1,
                        pz: 5000,
                        po: 1,
                        np: 1,
                        ut: 'bd1d9ddb04089700cf9c27f6f7426281',
                        fltt: 2,
                        invt: 2,
                        fid: 'f3',
                        fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23',
                        fields: 'f3',
                        _: Date.now()
                    },
                    timeout: 8000
                });

                if (response.data && response.data.data) {
                    const data = response.data.data;
                    const stocks = data.diff || [];

                    console.log(`📊 东方财富API: 返回${stocks.length}支股票`);

                    // API限制导致只返回部分数据，不能作为全市场统计
                    if (stocks.length < 1000) {
                        console.warn(`⚠️ 返回数据不足（${stocks.length}支），跳过此方法`);
                    } else {
                        let upCount = 0, downCount = 0, flatCount = 0;

                        stocks.forEach(stock => {
                            const changePercent = parseFloat(stock.f3);
                            if (changePercent > 0) upCount++;
                            else if (changePercent < 0) downCount++;
                            else flatCount++;
                        });

                        const total = upCount + downCount + flatCount;
                        console.log(`✅ 东方财富统计: 上涨${upCount}, 下跌${downCount}, 平盘${flatCount}, 总计${total}支`);

                        // 保存到数据库
                        saveMarketStats(upCount, downCount, flatCount, total);

                        return res.json({
                            success: true,
                            data: { upCount, downCount, flatCount, total, isHistorical: false }
                        });
                    }
                }
            } catch (listError) {
                console.warn('⚠️ 东方财富列表API失败:', listError.message);
            }

            // 交易时间内API失败，尝试返回数据库中的历史数据作为备选
            console.warn('⚠️ 交易时间内所有API都失败，返回历史数据');
            const historicalData = getLatestMarketStats();

            if (historicalData) {
                return res.json({
                    success: true,
                    data: historicalData
                });
            }

            // 数据库也没有数据，返回空数据
            return res.json({
                success: true,
                data: { upCount: 0, downCount: 0, flatCount: 0, total: 0, isHistorical: false }
            });
        } catch (error) {
            console.error('❌ 获取市场统计失败:', error.message);

            // 尝试返回历史数据
            const historicalData = getLatestMarketStats();
            if (historicalData) {
                return res.json({
                    success: true,
                    data: historicalData
                });
            }

            return res.json({
                success: true,
                data: { upCount: 0, downCount: 0, flatCount: 0, total: 0 }
            });
        }
    });

    // ==================== 获取所有市场情绪数据 ====================
    router.get('/all', authenticateToken, async (req, res) => {
        try {
            const [
                fundsFlow,
                industryFlow,
                dragonTiger,
                bigOrders,
                northboundFunds
            ] = await Promise.allSettled([
                axios.get(`http://localhost:${process.env.PORT || 3000}/api/market-sentiment/funds-flow`, {
                    headers: { 'Authorization': req.headers.authorization }
                }),
                axios.get(`http://localhost:${process.env.PORT || 3000}/api/market-sentiment/industry-flow`, {
                    headers: { 'Authorization': req.headers.authorization }
                }),
                axios.get(`http://localhost:${process.env.PORT || 3000}/api/market-sentiment/dragon-tiger`, {
                    headers: { 'Authorization': req.headers.authorization }
                }),
                axios.get(`http://localhost:${process.env.PORT || 3000}/api/market-sentiment/big-orders`, {
                    headers: { 'Authorization': req.headers.authorization }
                }),
                axios.get(`http://localhost:${process.env.PORT || 3000}/api/market-sentiment/northbound-funds`, {
                    headers: { 'Authorization': req.headers.authorization }
                })
            ]);

            res.json({
                success: true,
                data: {
                    fundsFlow: fundsFlow.status === 'fulfilled' ? fundsFlow.value.data.data : [],
                    industryFlow: industryFlow.status === 'fulfilled' ? industryFlow.value.data.data : [],
                    dragonTiger: dragonTiger.status === 'fulfilled' ? dragonTiger.value.data.data : [],
                    bigOrders: bigOrders.status === 'fulfilled' ? bigOrders.value.data.data : [],
                    northboundFunds: northboundFunds.status === 'fulfilled' ? northboundFunds.value.data.data : null
                }
            });
        } catch (error) {
            console.error('❌ 获取市场情绪数据失败:', error.message);
            res.status(500).json({
                success: false,
                error: '获取市场情绪数据失败',
                message: error.message
            });
        }
    });

    return router;
};
