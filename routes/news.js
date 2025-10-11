const express = require('express');
const axios = require('axios');
const { positionModel } = require('../database');
const { formatNewsTime, formatAnnouncementTime } = require('../controllers/analysisController');

module.exports = () => {
    const router = express.Router();

    // 获取A股热点新闻
    router.get('/hot', async (req, res) => {
        try {
            const { category = 'latest' } = req.query;

            console.log(`📰 获取新闻请求: category=${category}`);

            // 新浪财经API的lid分类映射
            const categoryMap = {
                'latest': '2516',
                'stock': '2517',
                'tech': '2515',
                'policy': '2516',
                'international': '2511'
            };

            const lid = categoryMap[category] || '2516';

            try {
                const sinaUrl = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=${lid}&k=&num=20&page=1`;
                const sinaResponse = await axios.get(sinaUrl, {
                    headers: {
                        'Referer': 'https://finance.sina.com.cn/',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 5000
                });

                if (sinaResponse.data && sinaResponse.data.result && sinaResponse.data.result.data) {
                    console.log(`✅ 新浪财经API获取成功 (category: ${category}, lid: ${lid})`);
                    const newsList = sinaResponse.data.result.data.slice(0, 10).map(item => ({
                        title: item.title,
                        source: '新浪财经',
                        time: formatNewsTime(item.ctime),
                        url: item.url || '#'
                    }));

                    res.json({
                        success: true,
                        data: newsList,
                        source: 'sina',
                        category: category
                    });
                } else {
                    console.log(`❌ 新浪API返回数据为空 (category: ${category})`);
                    res.json({
                        success: true,
                        data: [],
                        source: 'none',
                        category: category
                    });
                }
            } catch (sinaError) {
                console.log(`❌ 新浪财经API失败 (category: ${category}):`, sinaError.message);
                res.json({
                    success: true,
                    data: [],
                    source: 'error',
                    category: category,
                    error: sinaError.message
                });
            }

        } catch (error) {
            console.error('❌ 获取新闻严重错误:', error.message);
            res.json({
                success: true,
                data: [],
                source: 'error',
                category: req.query.category || 'latest',
                error: error.message
            });
        }
    });

    // 获取持仓股票相关公告（最近一个月）- 需要认证
    router.get('/positions', async (req, res) => {
        // 从请求头获取token并验证
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                error: '未提供认证令牌'
            });
        }

        // 验证token（简化版，实际应该使用jwt.verify）
        let userId;
        try {
            const jwt = require('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET || 'stock-manager-secret-key';
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.id;
        } catch (err) {
            return res.status(403).json({
                success: false,
                error: '认证令牌无效'
            });
        }

        try {
            console.log(`📢 获取持仓股票公告: userId=${userId}`);

            // 获取用户持仓
            const positions = await positionModel.findByUserId(userId);

            if (!positions || positions.length === 0) {
                console.log('⚠️ 用户没有持仓数据');
                return res.json({
                    success: true,
                    data: [],
                    source: 'none',
                    message: '暂无持仓数据'
                });
            }

            console.log(`📊 找到 ${positions.length} 个持仓股票`);

            // 收集所有股票公告
            const allAnnouncements = [];
            const now = new Date();
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            // 为每个持仓股票获取公告
            for (const position of positions) {
                try {
                    const annType = position.stockCode.startsWith('6') ? 'SHA' : 'SZA';
                    console.log(`🔍 获取 ${position.stockCode} ${position.stockName} 的公告`);

                    const eastmoneyUrl = `http://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=20&page_index=1&ann_type=${annType}&stock_list=${position.stockCode}&f_node=0&s_node=0`;

                    try {
                        const response = await axios.get(eastmoneyUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Referer': 'http://data.eastmoney.com/'
                            },
                            timeout: 8000
                        });

                        const jsonData = response.data;

                        if (jsonData && jsonData.success === 1 && jsonData.data && jsonData.data.list && Array.isArray(jsonData.data.list)) {
                            const announcements = jsonData.data.list
                                .filter(item => {
                                    const announceDate = new Date(item.notice_date);
                                    return announceDate >= oneMonthAgo;
                                })
                                .filter(item => {
                                    if (!item.codes || !Array.isArray(item.codes) || item.codes.length === 0) {
                                        return false;
                                    }
                                    const stockCode = item.codes[0].stock_code;
                                    const isMatch = stockCode === position.stockCode;
                                    if (!isMatch) {
                                        console.log(`  ⏭️ 跳过非本股票公告: ${item.title}`);
                                    }
                                    return isMatch;
                                })
                                .map(item => ({
                                    title: item.title || item.title_ch,
                                    source: '上市公司公告',
                                    time: formatAnnouncementTime(item.notice_date),
                                    url: `http://data.eastmoney.com/notices/detail/${position.stockCode}/${item.art_code}.html`,
                                    stockCode: position.stockCode,
                                    stockName: position.stockName,
                                    announcementType: item.columns && item.columns.length > 0 ? item.columns[0].column_name : '公司公告',
                                    timestamp: new Date(item.notice_date).getTime()
                                }));

                            const limitedAnnouncements = announcements.slice(0, 10);
                            allAnnouncements.push(...limitedAnnouncements);
                            console.log(`  ✅ 找到 ${limitedAnnouncements.length} 条公告`);
                        }
                    } catch (apiError) {
                        console.log(`  ⚠️ 东方财富API失败: ${apiError.message}`);
                    }

                } catch (error) {
                    console.log(`  ❌ 获取 ${position.stockName} 公告失败:`, error.message);
                }
            }

            // 去重
            const uniqueAnnouncements = Array.from(
                new Map(allAnnouncements.map(item => [`${item.stockCode}_${item.title}`, item])).values()
            );

            // 按时间倒序排序
            uniqueAnnouncements.sort((a, b) => b.timestamp - a.timestamp);

            console.log(`📢 总计: ${allAnnouncements.length} 条公告, 去重后: ${uniqueAnnouncements.length} 条`);

            res.json({
                success: true,
                data: uniqueAnnouncements,
                source: 'eastmoney',
                stats: {
                    total: allAnnouncements.length,
                    unique: uniqueAnnouncements.length,
                    returned: uniqueAnnouncements.length,
                    positions: positions.length
                }
            });

        } catch (error) {
            console.error('❌ 获取持仓公告错误:', error.message);
            res.json({
                success: true,
                data: [],
                source: 'error',
                error: error.message
            });
        }
    });

    return router;
};
