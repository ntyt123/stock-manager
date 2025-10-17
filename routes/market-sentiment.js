// ==================== 市场情绪分析路由 ====================
// 提供真实的市场数据，包括资金流向、龙虎榜、大单追踪等

const express = require('express');
const axios = require('axios');

module.exports = function(authenticateToken) {
    const router = express.Router();

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

            if (response.data && response.data.result && response.data.result.data) {
                const stocks = response.data.result.data;
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

            throw new Error('无法获取龙虎榜数据');
        } catch (error) {
            console.error('❌ 获取龙虎榜失败:', error.message);
            res.status(500).json({
                success: false,
                error: '获取龙虎榜数据失败',
                message: error.message
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
