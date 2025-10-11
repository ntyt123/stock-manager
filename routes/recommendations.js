const express = require('express');
const axios = require('axios');
const iconv = require('iconv-lite');
const { stockRecommendationModel } = require('../database');
const { callDeepSeekAPI, getNextTradingDay } = require('../controllers/analysisController');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 股票推荐API - 手动触发生成推荐
    router.post('/generate', async (req, res) => {
        try {
            console.log('📊 开始生成股票推荐...');

            const today = new Date().toISOString().split('T')[0];
            const nextTradingDay = getNextTradingDay();

            // 1. 获取主要市场指数数据
            const indexCodes = ['000001', '399001', '399006'];
            const indexQuotes = [];

            for (const code of indexCodes) {
                try {
                    let market;
                    if (code === '000001') {
                        market = 'sh';
                    } else if (code.startsWith('6')) {
                        market = 'sh';
                    } else {
                        market = 'sz';
                    }
                    const fullCode = `${market}${code}`;
                    const sinaUrl = `https://hq.sinajs.cn/list=${fullCode}`;

                    const response = await axios.get(sinaUrl, {
                        headers: { 'Referer': 'https://finance.sina.com.cn' },
                        timeout: 5000,
                        responseType: 'arraybuffer'
                    });

                    const data = iconv.decode(Buffer.from(response.data), 'gbk');
                    const match = data.match(/="(.+)"/);

                    if (match && match[1]) {
                        const values = match[1].split(',');
                        if (values.length >= 32) {
                            indexQuotes.push({
                                code: code,
                                name: values[0],
                                currentPrice: parseFloat(values[3]),
                                yesterdayClose: parseFloat(values[2]),
                                change: (parseFloat(values[3]) - parseFloat(values[2])).toFixed(2),
                                changePercent: ((parseFloat(values[3]) - parseFloat(values[2])) / parseFloat(values[2]) * 100).toFixed(2),
                                todayOpen: parseFloat(values[1]),
                                todayHigh: parseFloat(values[4]),
                                todayLow: parseFloat(values[5]),
                                volume: parseInt(values[8]),
                                amount: parseFloat(values[9])
                            });
                        }
                    }
                } catch (error) {
                    console.error(`获取指数 ${code} 数据失败:`, error.message);
                }
            }

            if (indexQuotes.length === 0) {
                return res.json({
                    success: false,
                    error: '无法获取市场指数数据'
                });
            }

            // 2. 构建市场数据摘要
            const marketData = {
                date: today,
                nextTradingDay: nextTradingDay,
                indices: indexQuotes,
                generationTime: new Date().toISOString()
            };

            // 3. 构建AI推荐提示词
            const recommendationPrompt = `请作为专业的股票投资顾问，基于当前市场数据，为投资者推荐${nextTradingDay}（下一个交易日）值得关注和买入的股票：

【市场概况 - ${today}】
${indexQuotes.map(idx =>
    `- ${idx.name} (${idx.code}):
   收盘价: ¥${idx.currentPrice}
   涨跌: ${idx.change >= 0 ? '+' : ''}${idx.change} (${idx.changePercent >= 0 ? '+' : ''}${idx.changePercent}%)
   成交量: ${(idx.volume / 100000000).toFixed(2)}亿股 | 成交额: ${(idx.amount / 100000000).toFixed(2)}亿元`
).join('\n\n')}

请从以下几个方面进行专业推荐：

1. **市场趋势分析**
   - 分析当前市场整体走势和情绪
   - 识别市场热点板块和资金流向
   - 判断短期市场机会

2. **推荐股票（3-5只）**

   对于每只推荐的股票，请按以下格式提供：

   **股票名称 (股票代码)**
   - **推荐理由**: 详细说明推荐该股票的理由（如基本面、技术面、消息面等）
   - **目标买入价**: ¥XX.XX - ¥XX.XX（给出合理的买入价格区间）
   - **止盈位**: ¥XX.XX（建议盈利XX%止盈）
   - **止损位**: ¥XX.XX（建议跌破此价格止损）
   - **持仓建议**: X%（建议占总仓位的比例）
   - **投资周期**: 短线/中线/长线
   - **风险等级**: 高/中/低

3. **交易策略**
   - ${nextTradingDay}具体操作建议
   - 仓位控制建议
   - 分批买入策略

4. **风险提示**
   - 市场风险警示
   - 个股风险提示
   - 注意事项

5. **免责声明**
   以上推荐仅供参考，不构成具体投资建议。投资有风险，入市需谨慎。

请提供详细、专业、可执行的股票推荐和交易建议。`;

            // 4. 调用DeepSeek AI生成推荐
            const aiRecommendation = await callDeepSeekAPI(recommendationPrompt, '你是一位专业的A股投资顾问，擅长分析市场趋势和推荐优质股票。');

            console.log('✅ 股票推荐AI生成完成');

            // 5. 保存推荐结果到数据库
            const savedRecommendation = await stockRecommendationModel.save(today, aiRecommendation, marketData, 'manual');
            console.log(`📄 股票推荐已保存，ID: ${savedRecommendation.id}`);

            // 6. 返回推荐结果
            res.json({
                success: true,
                data: {
                    recommendationId: savedRecommendation.id,
                    recommendationDate: today,
                    nextTradingDay: nextTradingDay,
                    recommendation: aiRecommendation,
                    marketData: marketData,
                    timestamp: savedRecommendation.created_at
                }
            });

        } catch (error) {
            console.error('❌ 股票推荐生成错误:', error.message);
            res.status(500).json({
                success: false,
                error: '股票推荐生成失败: ' + error.message
            });
        }
    });

    // 获取股票推荐历史记录列表API
    router.get('/list', async (req, res) => {
        const limit = parseInt(req.query.limit) || 30;
        const offset = parseInt(req.query.offset) || 0;

        try {
            const records = await stockRecommendationModel.findAll(limit, offset);
            const totalCount = await stockRecommendationModel.getCount();

            res.json({
                success: true,
                data: {
                    records: records,
                    totalCount: totalCount,
                    hasMore: offset + records.length < totalCount
                }
            });
        } catch (error) {
            console.error('❌ 获取推荐列表错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取推荐列表失败'
            });
        }
    });

    // 获取单个股票推荐详情API
    router.get('/:param', async (req, res) => {
        const param = req.params.param;

        try {
            let recommendation;

            // 判断参数是ID还是日期（日期格式：YYYY-MM-DD）
            if (/^\d{4}-\d{2}-\d{2}$/.test(param)) {
                // 按日期查询
                recommendation = await stockRecommendationModel.findByDate(param);
            } else {
                // 按ID查询
                recommendation = await stockRecommendationModel.findById(parseInt(param));
            }

            if (!recommendation) {
                return res.status(404).json({
                    success: false,
                    error: '推荐记录不存在'
                });
            }

            res.json({
                success: true,
                data: {
                    recommendationId: recommendation.id,
                    recommendationDate: recommendation.recommendation_date,
                    recommendation: recommendation.recommendation_content,
                    marketData: recommendation.market_data,
                    recommendationType: recommendation.recommendation_type,
                    timestamp: recommendation.created_at
                }
            });
        } catch (error) {
            console.error('❌ 获取推荐详情错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取推荐详情失败'
            });
        }
    });

    // 删除股票推荐记录API
    router.delete('/:recommendationId', authenticateToken, async (req, res) => {
        const recommendationId = parseInt(req.params.recommendationId);

        try {
            const recommendation = await stockRecommendationModel.findById(recommendationId);

            if (!recommendation) {
                return res.status(404).json({
                    success: false,
                    error: '推荐记录不存在'
                });
            }

            const result = await stockRecommendationModel.delete(recommendationId);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '推荐记录不存在或已被删除'
                });
            }

            console.log(`✅ 用户 ${req.user.id} 删除了股票推荐 ID: ${recommendationId}`);

            res.json({
                success: true,
                message: '推荐记录删除成功',
                deletedCount: result.changes
            });

        } catch (error) {
            console.error('❌ 删除推荐记录错误:', error.message);
            res.status(500).json({
                success: false,
                error: '删除推荐记录失败'
            });
        }
    });

    return router;
};
