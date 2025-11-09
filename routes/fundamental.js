const express = require('express');
const axios = require('axios');
const iconv = require('iconv-lite');
const { fundamentalAnalysisModel, watchlistModel } = require('../database');
const { callDeepSeekAPI } = require('../controllers/analysisController');
const { fetchFundamentalData } = require('../utils/fundamentalDataFetcher');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 获取股票基本面数据API
    router.get('/data', authenticateToken, async (req, res) => {
        const query = req.query.query?.trim();

        if (!query) {
            return res.json({
                success: false,
                error: '请输入股票代码或名称'
            });
        }

        try {
            console.log(`📊 开始查询股票基本面数据: ${query}`);

            // 判断是代码还是名称
            if (!/^\d{6}$/.test(query)) {
                return res.json({
                    success: false,
                    error: '暂不支持按名称搜索，请输入6位股票代码'
                });
            }

            const stockCode = query;

            // 验证股票代码格式
            if (!stockCode.startsWith('6') && !stockCode.startsWith('0') && !stockCode.startsWith('3')) {
                return res.json({
                    success: false,
                    error: '无效的股票代码'
                });
            }

            // 使用真实数据获取工具获取基本面数据
            const fundamentalData = await fetchFundamentalData(stockCode);

            console.log(`✅ 基本面数据查询成功: ${fundamentalData.stockName}(${stockCode})`);

            res.json({
                success: true,
                data: fundamentalData
            });

        } catch (error) {
            console.error('❌ 查询基本面数据错误:', error.message);
            res.status(500).json({
                success: false,
                error: '查询基本面数据失败: ' + error.message
            });
        }
    });

    // AI智能分析基本面数据API
    router.post('/analyze', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const { query } = req.body;

        if (!query) {
            return res.json({
                success: false,
                error: '请输入股票代码或名称'
            });
        }

        try {
            console.log(`🤖 开始AI智能分析基本面: ${query}`);

            // 1. 验证股票代码
            let stockCode = query.trim();
            if (!/^\d{6}$/.test(stockCode)) {
                return res.json({
                    success: false,
                    error: '暂不支持按名称搜索，请输入6位股票代码'
                });
            }

            if (!stockCode.startsWith('6') && !stockCode.startsWith('0') && !stockCode.startsWith('3')) {
                return res.json({
                    success: false,
                    error: '无效的股票代码'
                });
            }

            // 2. 使用真实数据获取工具获取基本面数据
            const fundamentalData = await fetchFundamentalData(stockCode);

            // 3. 构建AI分析提示词
            const analysisPrompt = `请作为专业的证券分析师，对以下股票的基本面数据进行全面深入的分析：

【股票基本信息】
- 股票名称：${fundamentalData.stockName}
- 股票代码：${fundamentalData.stockCode}
- 最新价格：¥${fundamentalData.currentPrice}
- 涨跌幅：${fundamentalData.changePercent >= 0 ? '+' : ''}${fundamentalData.changePercent}%
- 总市值：${fundamentalData.marketCap}

【财务数据】
- 营业收入：${fundamentalData.revenue}
- 净利润：${fundamentalData.netProfit}
- 经营现金流：${fundamentalData.cashFlow}
- 总资产：${fundamentalData.totalAssets}

【估值指标】
- 市盈率(PE)：${fundamentalData.pe}
- 市净率(PB)：${fundamentalData.pb}
- 市销率(PS)：${fundamentalData.ps}
- 市现率(PCF)：${fundamentalData.pcf}

【盈利能力】
- 净资产收益率(ROE)：${fundamentalData.roe}%
- 总资产收益率(ROA)：${fundamentalData.roa}%
- 毛利率：${fundamentalData.grossMargin}%
- 净利率：${fundamentalData.netMargin}%

【成长性指标】
- 营收增长率(YoY)：${fundamentalData.revenueGrowth >= 0 ? '+' : ''}${fundamentalData.revenueGrowth}%
- 净利润增长率(YoY)：${fundamentalData.profitGrowth >= 0 ? '+' : ''}${fundamentalData.profitGrowth}%
- 每股收益(EPS)：¥${fundamentalData.eps}
- 每股净资产(BPS)：¥${fundamentalData.bps}

【偿债能力】
- 资产负债率：${fundamentalData.debtRatio}%
- 流动比率：${fundamentalData.currentRatio}
- 速动比率：${fundamentalData.quickRatio}
- 现金比率：${fundamentalData.cashRatio}

请从以下几个维度进行详细分析：

1. **财务健康度评估**
   - 分析公司的财务状况是否健康稳定
   - 评估现金流和盈利质量
   - 判断财务风险水平

2. **估值水平分析**
   - 评估当前估值是否合理（低估/合理/高估）
   - 与行业平均水平对比
   - 判断投资价值和安全边际

3. **盈利能力评价**
   - 分析盈利能力的强弱
   - 评估盈利的可持续性
   - 识别盈利能力的变化趋势

4. **成长性分析**
   - 评估公司的成长性
   - 分析增长的质量和可持续性
   - 预判未来成长空间

5. **偿债能力评估**
   - 分析公司的债务压力
   - 评估短期和长期偿债能力
   - 判断财务安全性

6. **投资建议**
   - 综合评分（0-100分）
   - 投资评级（买入/增持/持有/减持/卖出）
   - 目标价位预估
   - 风险提示
   - 适合的投资者类型（激进/稳健/保守）

请提供专业、客观、详细的分析报告。注意：以上分析仅供参考，不构成具体投资建议。`;

            // 打印提示词
            console.log('📝 ==================== AI基本面分析提示词 ====================');
            console.log(analysisPrompt);
            console.log('📝 ============================================================');

            // 3. 调用DeepSeek AI进行分析
            const aiAnalysis = await callDeepSeekAPI(
                analysisPrompt,
                '你是一位专业的证券分析师，擅长基本面分析和价值投资。'
            );

            console.log('✅ AI基本面分析完成');

            // 4. 保存分析结果到数据库
            const savedAnalysis = await fundamentalAnalysisModel.save(
                userId,
                stockCode,
                fundamentalData.stockName,
                fundamentalData,
                aiAnalysis,
                'manual'
            );

            console.log(`📄 基本面分析已保存，ID: ${savedAnalysis.id}`);

            // 5. 返回分析结果
            res.json({
                success: true,
                data: {
                    analysisId: savedAnalysis.id,
                    analysis: aiAnalysis,
                    fundamentalData: fundamentalData,
                    timestamp: savedAnalysis.created_at,
                    prompt: analysisPrompt
                }
            });

        } catch (error) {
            console.error('❌ AI基本面分析错误:', error.message);
            res.status(500).json({
                success: false,
                error: 'AI基本面分析失败: ' + error.message
            });
        }
    });

    // 获取基本面分析历史记录列表API
    router.get('/history', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 30;
        const offset = parseInt(req.query.offset) || 0;

        try {
            const records = await fundamentalAnalysisModel.findByUserId(userId, limit, offset);
            const totalCount = await fundamentalAnalysisModel.getCount(userId);

            res.json({
                success: true,
                data: {
                    records: records,
                    totalCount: totalCount,
                    hasMore: offset + records.length < totalCount
                }
            });
        } catch (error) {
            console.error('❌ 获取基本面分析历史错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取历史记录失败'
            });
        }
    });

    // 获取单个基本面分析详情API
    router.get('/history/:analysisId', authenticateToken, async (req, res) => {
        const analysisId = parseInt(req.params.analysisId);
        const userId = req.user.id;

        try {
            const record = await fundamentalAnalysisModel.findById(analysisId);

            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: '分析记录不存在'
                });
            }

            if (record.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    error: '无权访问此记录'
                });
            }

            res.json({
                success: true,
                data: {
                    analysisId: record.id,
                    stockCode: record.stock_code,
                    stockName: record.stock_name,
                    fundamentalData: record.fundamental_data,
                    analysis: record.analysis_content,
                    analysisType: record.analysis_type,
                    timestamp: record.created_at
                }
            });
        } catch (error) {
            console.error('❌ 获取基本面分析详情错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取详情失败'
            });
        }
    });

    // 删除基本面分析记录API
    router.delete('/history/:analysisId', authenticateToken, async (req, res) => {
        const analysisId = parseInt(req.params.analysisId);
        const userId = req.user.id;

        try {
            const record = await fundamentalAnalysisModel.findById(analysisId);

            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: '分析记录不存在'
                });
            }

            if (record.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    error: '无权删除此记录'
                });
            }

            await fundamentalAnalysisModel.delete(analysisId);

            console.log(`✅ 用户 ${userId} 删除了基本面分析记录 ID: ${analysisId}`);

            res.json({
                success: true,
                message: '记录删除成功'
            });

        } catch (error) {
            console.error('❌ 删除基本面分析记录错误:', error.message);
            res.status(500).json({
                success: false,
                error: '删除记录失败'
            });
        }
    });

    // 获取用户自选股列表API（用于下拉选择）
    router.get('/watchlist', authenticateToken, async (req, res) => {
        const userId = req.user.id;

        try {
            const watchlist = await watchlistModel.findByUserId(userId);

            res.json({
                success: true,
                data: {
                    watchlist: watchlist || []
                }
            });
        } catch (error) {
            console.error('❌ 获取自选股列表错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取自选股列表失败'
            });
        }
    });

    return router;
};
