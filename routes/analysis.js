const express = require('express');
const axios = require('axios');
const iconv = require('iconv-lite');
const { positionModel, analysisReportModel, callAuctionAnalysisModel } = require('../database');
const {
    buildPortfolioSummary,
    callDeepSeekAPI,
    getStockIndustry
} = require('../controllers/analysisController');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 持仓分析API - 调用DeepSeek分析持仓
    router.post('/portfolio', authenticateToken, async (req, res) => {
        const userId = req.user.id;

        try {
            console.log(`📊 开始分析用户 ${userId} 的持仓...`);

            // 1. 获取用户持仓数据
            const positions = await positionModel.findByUserId(userId);

            if (!positions || positions.length === 0) {
                return res.json({
                    success: false,
                    error: '暂无持仓数据，请先导入持仓信息'
                });
            }

            // 2. 刷新所有持仓股票的最新价格（从新浪财经API获取实时行情）
            console.log(`📊 开始刷新 ${positions.length} 个持仓股票的最新价格...`);
            try {
                const stockCodes = positions.map(pos => pos.stockCode);

                // 构建新浪财经API的股票代码列表
                const fullCodes = stockCodes.map(code => {
                    let market;
                    if (code === '000001') {
                        market = 'sh';  // 上证指数
                    } else if (code.startsWith('6')) {
                        market = 'sh';  // 沪市股票
                    } else {
                        market = 'sz';  // 深市股票
                    }
                    return `${market}${code}`;
                }).join(',');

                // 调用新浪财经API获取实时行情
                const sinaUrl = `https://hq.sinajs.cn/list=${fullCodes}`;
                const response = await axios.get(sinaUrl, {
                    headers: { 'Referer': 'https://finance.sina.com.cn' },
                    timeout: 10000,
                    responseType: 'arraybuffer'
                });

                const data = iconv.decode(Buffer.from(response.data), 'gbk');
                const lines = data.split('\n').filter(line => line.trim());

                console.log(`📊 成功获取 ${lines.length} 个股票的实时行情数据`);

                // 解析每个股票的行情数据并更新持仓信息
                for (let i = 0; i < stockCodes.length; i++) {
                    const line = lines[i];
                    if (!line) continue;

                    const match = line.match(/="(.+)"/);
                    if (!match || !match[1]) continue;

                    const values = match[1].split(',');
                    if (values.length < 32) continue;

                    const currentPrice = parseFloat(values[3]);  // 当前价格
                    if (currentPrice > 0) {
                        const pos = positions[i];
                        const oldPrice = pos.currentPrice;

                        // 更新现价
                        pos.currentPrice = currentPrice;

                        // 重新计算市值
                        pos.marketValue = currentPrice * pos.quantity;

                        // 重新计算盈亏
                        pos.profitLoss = (currentPrice - pos.costPrice) * pos.quantity;

                        // 重新计算盈亏率
                        pos.profitLossRate = pos.costPrice > 0
                            ? ((currentPrice - pos.costPrice) / pos.costPrice * 100)
                            : 0;

                        console.log(`📊 ${pos.stockName}(${pos.stockCode}): 价格更新 ¥${oldPrice.toFixed(2)} → ¥${currentPrice.toFixed(2)}, 盈亏: ¥${pos.profitLoss.toFixed(2)}`);
                    }
                }

                console.log(`✅ 所有持仓股票价格已刷新完成`);

            } catch (priceError) {
                console.error('⚠️ 刷新股票价格失败:', priceError.message);
                console.log('⚠️ 将使用数据库中的价格进行分析（可能不是最新价格）');
                // 价格刷新失败不影响分析流程，继续使用数据库中的价格
            }

            // 3. 构建详细的持仓数据摘要（使用刷新后的最新价格）
            const portfolioSummary = buildPortfolioSummary(positions);

            // 4. 调用DeepSeek AI进行分析
            const analysisPrompt = `请作为专业的股票投资顾问，对以下持仓进行全面深入的分析：

【持仓概况】
- 总持仓股票：${portfolioSummary.totalStocks} 只
- 总市值：¥${portfolioSummary.totalMarketValue.toFixed(2)}
- 总盈亏：¥${portfolioSummary.totalProfitLoss.toFixed(2)} (${portfolioSummary.totalProfitLossRate}%)
- 盈利股票：${portfolioSummary.profitableStocks} 只
- 亏损股票：${portfolioSummary.lossStocks} 只

【详细持仓】
${portfolioSummary.detailedPositions}

请从以下几个方面进行详细分析：

1. **整体持仓评估**
   - 分析当前持仓结构的合理性
   - 评估整体风险水平（高/中/低）
   - 判断持仓集中度是否合理

2. **个股分析**
   - 分析表现最好和最差的股票
   - 指出哪些股票值得继续持有
   - 指出哪些股票需要警惕或减仓

3. **风险预警** ⚠️ **【关键】此部分必须包含且格式必须严格遵守！**

   **重要格式要求：**
   - 必须使用独立的二级标题：## 【风险预警】（必须独占一行，前后各空一行）
   - 在标题下方列出3-5个具体的风险预警点
   - 每个预警必须以 "-" 开头，独立一行
   - 每个预警必须包含风险等级标识：【高风险】、【中风险】或【注意】
   - 每个预警必须包含具体的数据和操作建议

   **标准格式示例（请严格遵守此格式）：**

   ## 【风险预警】

   - ⚠️ 【高风险】XX股票亏损严重（当前亏损-XX%），建议设置止损位于¥XX，避免进一步损失
   - ⚠️ 【中风险】持仓过于集中在XX行业（占比XX%），建议分散投资到其他板块
   - ⚠️ 【注意】XX股票短期涨幅过大（已上涨XX%），注意回调风险，建议适当减仓

4. **操作建议**
   - 短期（1-2周）操作建议
   - 中期（1-3个月）操作建议
   - 仓位调整建议

5. **市场环境**
   - 结合当前A股市场环境
   - 分析对持仓的影响
   - 提出应对策略

请提供详细、专业、可执行的分析建议。注意：以上建议仅供参考，不构成具体投资建议。`;

            // 打印提示词
            console.log('📝 ==================== AI持仓分析提示词 ====================');
            console.log(analysisPrompt);
            console.log('📝 ============================================================');

            const aiResponse = await callDeepSeekAPI(analysisPrompt);

            console.log('✅ 持仓分析完成');

            // 5. 保存分析报告到数据库
            const savedReport = await analysisReportModel.save(userId, aiResponse, portfolioSummary, 'manual');
            console.log(`📄 分析报告已保存，ID: ${savedReport.id}`);

            // 6. 返回分析结果（包含提示词供前端输出）
            res.json({
                success: true,
                data: {
                    reportId: savedReport.id,
                    analysis: aiResponse,
                    portfolioSummary: portfolioSummary,
                    timestamp: savedReport.created_at,
                    positions: positions,
                    prompt: analysisPrompt  // 包含提示词
                }
            });

        } catch (error) {
            console.error('❌ 持仓分析错误:', error.message);
            res.status(500).json({
                success: false,
                error: '持仓分析失败: ' + error.message
            });
        }
    });

    // 获取分析报告列表API
    router.get('/reports', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 30;
        const offset = parseInt(req.query.offset) || 0;

        try {
            const reports = await analysisReportModel.findByUserId(userId, limit, offset);
            const totalCount = await analysisReportModel.getCount(userId);

            res.json({
                success: true,
                data: {
                    reports: reports,
                    totalCount: totalCount,
                    hasMore: offset + reports.length < totalCount
                }
            });
        } catch (error) {
            console.error('❌ 获取报告列表错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取报告列表失败'
            });
        }
    });

    // 获取单个分析报告详情API
    router.get('/reports/:reportId', authenticateToken, async (req, res) => {
        const reportId = parseInt(req.params.reportId);
        const userId = req.user.id;

        try {
            const report = await analysisReportModel.findById(reportId);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: '报告不存在'
                });
            }

            // 验证报告所有权
            if (report.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    error: '无权访问此报告'
                });
            }

            res.json({
                success: true,
                data: {
                    reportId: report.id,
                    analysis: report.analysis_content,
                    portfolioSummary: report.portfolio_summary,
                    reportType: report.report_type,
                    timestamp: report.created_at
                }
            });
        } catch (error) {
            console.error('❌ 获取报告详情错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取报告详情失败'
            });
        }
    });

    // 删除持仓分析报告API
    router.delete('/reports/:reportId', authenticateToken, async (req, res) => {
        const reportId = parseInt(req.params.reportId);
        const userId = req.user.id;

        try {
            const report = await analysisReportModel.findById(reportId);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: '报告不存在'
                });
            }

            if (report.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    error: '无权删除此报告'
                });
            }

            const result = await analysisReportModel.delete(reportId);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '报告不存在或已被删除'
                });
            }

            console.log(`✅ 用户 ${userId} 删除了持仓分析报告 ID: ${reportId}`);

            res.json({
                success: true,
                message: '报告删除成功',
                deletedCount: result.changes
            });

        } catch (error) {
            console.error('❌ 删除报告错误:', error.message);
            res.status(500).json({
                success: false,
                error: '删除报告失败'
            });
        }
    });

    // 集合竞价分析API - 手动触发分析
    router.post('/call-auction', authenticateToken, async (req, res) => {
        try {
            console.log('📊 开始集合竞价分析...');

            const userId = req.user.id;
            const today = new Date().toISOString().split('T')[0];

            // 获取用户总资金和持仓信息
            const { userModel } = require('../database');
            const user = await userModel.findById(userId);
            const totalCapital = user?.total_capital || 0;

            let positionSummary = '';
            try {
                const positions = await positionModel.findByUserId(userId);
                if (positions && positions.length > 0) {
                    const totalMarketValue = positions.reduce((sum, p) => sum + (parseFloat(p.marketValue) || 0), 0);
                    const positionRatio = totalCapital > 0 ? (totalMarketValue / totalCapital * 100).toFixed(2) : 0;
                    positionSummary = `\n【投资者情况】\n- 总资金: ¥${totalCapital.toLocaleString('zh-CN')}\n- 持仓市值: ¥${totalMarketValue.toFixed(2)}\n- 仓位占比: ${positionRatio}%\n- 持仓股票: ${positions.map(p => `${p.stockName}(${p.stockCode})`).join('、')}\n`;
                } else {
                    positionSummary = `\n【投资者情况】\n- 总资金: ¥${totalCapital.toLocaleString('zh-CN')}\n- 当前持仓: 空仓\n`;
                }
            } catch (err) {
                console.log('获取持仓信息失败，使用默认值');
                positionSummary = `\n【投资者情况】\n- 总资金: ¥${totalCapital.toLocaleString('zh-CN')}\n- 当前持仓: 暂无数据\n`;
            }

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

            // 2. 构建市场概况摘要
            const marketSummary = {
                date: today,
                indices: indexQuotes,
                analysisTime: new Date().toISOString()
            };

            // 3. 构建AI分析提示词
            const analysisPrompt = `请作为专业的股票分析师，结合投资者的资金和持仓情况，对今日（${today}）的A股市场集合竞价情况进行分析：

【市场指数概况】
${indexQuotes.map(idx =>
    `- ${idx.name} (${idx.code}):
   开盘价: ¥${idx.todayOpen} | 现价: ¥${idx.currentPrice}
   涨跌: ${idx.change >= 0 ? '+' : ''}${idx.change} (${idx.changePercent >= 0 ? '+' : ''}${idx.changePercent}%)
   最高: ¥${idx.todayHigh} | 最低: ¥${idx.todayLow}
   成交量: ${(idx.volume / 100000000).toFixed(2)}亿股 | 成交额: ${(idx.amount / 100000000).toFixed(2)}亿元`
).join('\n\n')}
${positionSummary}

请结合投资者的资金规模和持仓情况，从以下几个方面进行专业分析：

1. **集合竞价特征**
   - 分析三大指数的开盘情况和市场情绪
   - 判断今日市场的整体强弱
   - 识别是否有明显的主力资金动向

2. **市场热点**
   - 根据指数表现推断可能的热点板块
   - 分析资金流向和市场偏好
   - 预判今日可能活跃的行业

3. **交易策略建议**
   - 今日操作建议（激进/稳健/观望）
   - 重点关注的指数区间
   - 仓位控制建议

4. **风险提示**
   - 识别今日潜在风险点
   - 提醒需要警惕的市场信号
   - 建议设置止损位

5. **全天展望**
   - 预测今日市场可能走势
   - 关键时间节点提醒
   - 收盘预期

请提供简明扼要、可执行的专业分析建议。注意：以上建议仅供参考，不构成具体投资建议。`;

            // 打印提示词
            console.log('📝 ==================== AI集合竞价分析提示词 ====================');
            console.log(analysisPrompt);
            console.log('📝 ================================================================');

            // 4. 调用DeepSeek AI进行分析
            const aiAnalysis = await callDeepSeekAPI(analysisPrompt, '你是一位专业的A股市场分析师，擅长解读集合竞价和盘前信息。');

            console.log('✅ 集合竞价AI分析完成');

            // 5. 保存分析结果到数据库
            const savedAnalysis = await callAuctionAnalysisModel.save(today, aiAnalysis, marketSummary, 'manual');
            console.log(`📄 集合竞价分析已保存，ID: ${savedAnalysis.id}`);

            // 6. 返回分析结果（包含提示词供前端输出）
            res.json({
                success: true,
                data: {
                    analysisId: savedAnalysis.id,
                    analysisDate: today,
                    analysis: aiAnalysis,
                    marketSummary: marketSummary,
                    timestamp: savedAnalysis.created_at,
                    prompt: analysisPrompt  // 包含提示词
                }
            });

        } catch (error) {
            console.error('❌ 集合竞价分析错误:', error.message);
            res.status(500).json({
                success: false,
                error: '集合竞价分析失败: ' + error.message
            });
        }
    });

    // 获取集合竞价分析历史记录列表API
    router.get('/call-auction/list', async (req, res) => {
        const limit = parseInt(req.query.limit) || 30;
        const offset = parseInt(req.query.offset) || 0;

        try {
            const records = await callAuctionAnalysisModel.findAll(limit, offset);
            const totalCount = await callAuctionAnalysisModel.getCount();

            res.json({
                success: true,
                data: {
                    records: records,
                    totalCount: totalCount,
                    hasMore: offset + records.length < totalCount
                }
            });
        } catch (error) {
            console.error('❌ 获取集合竞价分析列表错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取分析列表失败'
            });
        }
    });

    // 获取单个集合竞价分析详情API
    router.get('/call-auction/:param', async (req, res) => {
        const param = req.params.param;

        try {
            let analysis;

            // 判断参数是ID还是日期（日期格式：YYYY-MM-DD）
            if (/^\d{4}-\d{2}-\d{2}$/.test(param)) {
                // 按日期查询
                analysis = await callAuctionAnalysisModel.findByDate(param);
            } else {
                // 按ID查询
                analysis = await callAuctionAnalysisModel.findById(parseInt(param));
            }

            if (!analysis) {
                return res.status(404).json({
                    success: false,
                    error: '分析记录不存在'
                });
            }

            res.json({
                success: true,
                data: {
                    analysisId: analysis.id,
                    analysisDate: analysis.analysis_date,
                    analysis: analysis.analysis_content,
                    marketSummary: analysis.market_summary,
                    analysisType: analysis.analysis_type,
                    timestamp: analysis.created_at
                }
            });
        } catch (error) {
            console.error('❌ 获取集合竞价分析详情错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取分析详情失败'
            });
        }
    });

    // 删除集合竞价分析记录API
    router.delete('/call-auction/:analysisId', authenticateToken, async (req, res) => {
        const analysisId = parseInt(req.params.analysisId);

        try {
            const analysis = await callAuctionAnalysisModel.findById(analysisId);

            if (!analysis) {
                return res.status(404).json({
                    success: false,
                    error: '分析记录不存在'
                });
            }

            const result = await callAuctionAnalysisModel.delete(analysisId);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '分析记录不存在或已被删除'
                });
            }

            console.log(`✅ 用户 ${req.user.id} 删除了集合竞价分析 ID: ${analysisId}`);

            res.json({
                success: true,
                message: '分析记录删除成功',
                deletedCount: result.changes
            });

        } catch (error) {
            console.error('❌ 删除集合竞价分析错误:', error.message);
            res.status(500).json({
                success: false,
                error: '删除分析记录失败'
            });
        }
    });

    // 获取用户持仓的行业分布API
    router.get('/industry-distribution', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;

            console.log(`📊 获取用户 ${userId} 的行业分布...`);

            const positions = await positionModel.findByUserId(userId);

            if (!positions || positions.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        distribution: [],
                        totalMarketValue: 0,
                        positionCount: 0
                    },
                    message: '暂无持仓数据'
                });
            }

            // 按行业分组统计
            const industryMap = {};
            let totalMarketValue = 0;

            positions.forEach(pos => {
                const industry = getStockIndustry(pos.stockCode);
                const marketValue = parseFloat(pos.marketValue) || 0;

                totalMarketValue += marketValue;

                if (!industryMap[industry]) {
                    industryMap[industry] = {
                        industry: industry,
                        marketValue: 0,
                        count: 0,
                        stocks: []
                    };
                }

                industryMap[industry].marketValue += marketValue;
                industryMap[industry].count += 1;
                industryMap[industry].stocks.push({
                    stockCode: pos.stockCode,
                    stockName: pos.stockName,
                    marketValue: marketValue
                });
            });

            // 转换为数组并计算百分比
            const distribution = Object.values(industryMap).map(item => ({
                industry: item.industry,
                marketValue: item.marketValue,
                percentage: totalMarketValue > 0 ? ((item.marketValue / totalMarketValue) * 100).toFixed(2) : '0.00',
                count: item.count,
                stocks: item.stocks
            }));

            // 按市值降序排序
            distribution.sort((a, b) => b.marketValue - a.marketValue);

            console.log(`✅ 行业分布统计完成: ${distribution.length} 个行业`);

            res.json({
                success: true,
                data: {
                    distribution: distribution,
                    totalMarketValue: totalMarketValue,
                    positionCount: positions.length
                }
            });

        } catch (error) {
            console.error('❌ 获取行业分布错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取行业分布失败: ' + error.message
            });
        }
    });

    return router;
};
