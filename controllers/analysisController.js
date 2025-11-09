const axios = require('axios');
const iconv = require('iconv-lite');
const { userModel, positionModel, analysisReportModel, callAuctionAnalysisModel, aiPromptTemplateModel, aiApiConfigModel } = require('../database');

// 股票代码到行业的映射表
const STOCK_INDUSTRY_MAP = {
    // 银行
    '600036': '银行', '601398': '银行', '600000': '银行', '601328': '银行', '601288': '银行',
    '601988': '银行', '601939': '银行', '601818': '银行', '600016': '银行', '601166': '银行',
    '600015': '银行', '601169': '银行', '601916': '银行', '601128': '银行', '600908': '银行',
    '600919': '银行', '002142': '银行', '000001': '银行', '002839': '银行', '002958': '银行',
    // 保险
    '601318': '保险', '601601': '保险', '601336': '保险', '601628': '保险',
    // 证券
    '600030': '证券', '600999': '证券', '600958': '证券', '600837': '证券', '600109': '证券',
    '601688': '证券', '601788': '证券', '000776': '证券', '002926': '证券',
    // 白酒
    '600519': '白酒', '000858': '白酒', '000568': '白酒', '603589': '白酒', '000799': '白酒',
    '600809': '白酒', '603369': '白酒', '600779': '白酒', '000860': '白酒',
    // 家电
    '000333': '家电', '000651': '家电', '600690': '家电', '000100': '家电', '600060': '家电',
    // 医药
    '600276': '医药', '000538': '医药', '600436': '医药', '603259': '医药', '000661': '医药',
    '600867': '医药', '002422': '医药', '300015': '医药', '300142': '医药', '002007': '医药',
    // 科技/半导体
    '600584': '科技', '002415': '科技', '002049': '科技', '603986': '科技', '600438': '科技',
    '688012': '科技', '688981': '科技', '688008': '科技', '688396': '科技',
    // 房地产
    '000002': '房地产', '001979': '房地产', '600048': '房地产', '600606': '房地产',
    // 汽车
    '600104': '汽车', '000625': '汽车', '601238': '汽车', '601633': '汽车', '000800': '汽车',
    // 能源/石油
    '601857': '石油', '600028': '石油', '600028': '石油', '601088': '石油', '600346': '石油',
    // 有色金属
    '603993': '有色金属', '600362': '有色金属', '600111': '有色金属', '002460': '有色金属',
    '600219': '有色金属', '000878': '有色金属', '002466': '有色金属', '600489': '有色金属',
    // 钢铁
    '600019': '钢铁', '000708': '钢铁', '600010': '钢铁', '000709': '钢铁', '000898': '钢铁',
    // 煤炭
    '601088': '煤炭', '600188': '煤炭', '601898': '煤炭', '600123': '煤炭', '000983': '煤炭',
    // 电力
    '600900': '电力', '600011': '电力', '600795': '电力', '000027': '电力', '600023': '电力',
    // 通信
    '600050': '通信', '000063': '通信', '600745': '通信', '600198': '通信',
    // 交通运输
    '601111': '交通运输', '600115': '交通运输', '601021': '交通运输', '600009': '交通运输',
    '601006': '交通运输', '000089': '交通运输', '600029': '交通运输'
};

/**
 * 根据股票代码获取行业
 */
function getStockIndustry(stockCode) {
    return STOCK_INDUSTRY_MAP[stockCode] || '其他';
}

/**
 * 构建持仓摘要
 */
function buildPortfolioSummary(positions) {
    let totalMarketValue = 0;
    let totalProfitLoss = 0;
    let totalCost = 0;
    let profitableStocks = 0;
    let lossStocks = 0;

    let detailedPositions = '';

    console.log('📊 [buildPortfolioSummary] 开始构建持仓摘要，持仓数量:', positions.length);

    positions.forEach((pos, index) => {
        console.log(`📊 [buildPortfolioSummary] 持仓 ${index + 1}:`, {
            stockCode: pos.stockCode,
            stockName: pos.stockName,
            marketValue: pos.marketValue,
            profitLoss: pos.profitLoss,
            profitLossRate: pos.profitLossRate,
            costPrice: pos.costPrice,
            currentPrice: pos.currentPrice,
            quantity: pos.quantity
        });

        const marketValue = parseFloat(pos.marketValue) || 0;
        const profitLoss = parseFloat(pos.profitLoss) || 0;
        const profitLossRate = parseFloat(pos.profitLossRate) || 0;
        const costPrice = parseFloat(pos.costPrice) || 0;
        const currentPrice = parseFloat(pos.currentPrice) || 0;

        console.log(`📊 [buildPortfolioSummary] 解析后的值:`, {
            marketValue,
            profitLoss,
            profitLossRate,
            costPrice,
            currentPrice
        });

        totalMarketValue += marketValue;
        totalProfitLoss += profitLoss;
        totalCost += costPrice * pos.quantity;

        if (profitLoss > 0) profitableStocks++;
        if (profitLoss < 0) lossStocks++;

        detailedPositions += `${index + 1}. ${pos.stockName} (${pos.stockCode})
   持仓: ${pos.quantity}股 | 成本价: ¥${costPrice.toFixed(2)} | 现价: ¥${currentPrice.toFixed(2)}
   市值: ¥${marketValue.toFixed(2)} | 盈亏: ${profitLoss >= 0 ? '+' : ''}¥${profitLoss.toFixed(2)} (${profitLoss >= 0 ? '+' : ''}${profitLossRate.toFixed(2)}%)

`;
    });

    const totalProfitLossRate = totalCost > 0 ? ((totalProfitLoss / totalCost) * 100).toFixed(2) : '0.00';

    const summary = {
        totalStocks: positions.length,
        totalMarketValue,
        totalProfitLoss,
        totalProfitLossRate,
        profitableStocks,
        lossStocks,
        detailedPositions: detailedPositions.trim()
    };

    console.log('📊 [buildPortfolioSummary] 最终摘要:', summary);

    return summary;
}

/**
 * 调用AI API的通用函数（支持多种AI服务商）
 * @param {string} userMessage - 用户消息内容
 * @param {string} systemMessage - 默认系统提示词
 * @param {string} sceneType - 场景类型，用于从数据库获取自定义提示词
 */
async function callDeepSeekAPI(userMessage, systemMessage = '你是一位专业的股票投资顾问助手。', sceneType = null) {
    try {
        // 获取当前激活的API配置
        const apiConfig = aiApiConfigModel.getActiveConfig();

        if (!apiConfig) {
            console.error('❌ 没有激活的AI API配置');
            throw new Error('系统未配置AI接口，请联系管理员');
        }

        console.log(`✅ 使用AI配置: ${apiConfig.name} (${apiConfig.provider})`);

        // 如果提供了场景类型，尝试从数据库获取自定义提示词
        let finalSystemMessage = systemMessage;

        if (sceneType) {
            try {
                const template = await aiPromptTemplateModel.findBySceneType(sceneType);
                if (template && template.is_active) {
                    finalSystemMessage = template.system_prompt;
                    console.log(`✅ [${sceneType}] 使用自定义提示词模板`);
                } else {
                    console.log(`ℹ️ [${sceneType}] 使用默认提示词（未找到或未启用自定义模板）`);
                }
            } catch (err) {
                console.warn(`⚠️ [${sceneType}] 获取自定义提示词失败，使用默认提示词:`, err.message);
            }
        }

        // 判断是否是Gemini API (通过URL或provider判断)
        const isGemini = apiConfig.api_url.includes('generativelanguage.googleapis.com') ||
                        apiConfig.provider === 'gemini';

        let response;

        if (isGemini) {
            // ==================== Gemini API 格式 ====================
            console.log('🔷 使用Gemini API格式');

            // Gemini通过URL参数传递API Key
            const apiUrl = apiConfig.api_key
                ? `${apiConfig.api_url}?key=${apiConfig.api_key}`
                : apiConfig.api_url;

            const headers = {
                'Content-Type': 'application/json'
            };

            // 添加自定义请求头
            if (apiConfig.custom_headers) {
                const customHeaders = typeof apiConfig.custom_headers === 'string'
                    ? JSON.parse(apiConfig.custom_headers)
                    : apiConfig.custom_headers;
                Object.assign(headers, customHeaders);
            }

            // Gemini请求体格式
            const requestBody = {
                contents: [{
                    parts: [{
                        text: `${finalSystemMessage}\n\n用户问题：${userMessage}`
                    }]
                }],
                generationConfig: {
                    temperature: apiConfig.temperature || 0.7,
                    maxOutputTokens: apiConfig.max_tokens || 2000,
                    topK: 40,
                    topP: 0.95
                }
            };

            response = await axios.post(apiUrl, requestBody, {
                headers,
                timeout: apiConfig.timeout || 120000,
                httpsAgent: new (require('https').Agent)({
                    keepAlive: true,
                    timeout: apiConfig.timeout || 120000
                })
            });

            // 解析Gemini响应
            if (response.data && response.data.candidates && response.data.candidates.length > 0) {
                const candidate = response.data.candidates[0];
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    return candidate.content.parts[0].text;
                }
            }
            throw new Error('Gemini API响应格式异常');

        } else {
            // ==================== OpenAI/DeepSeek 标准格式 ====================
            console.log('🔶 使用OpenAI标准API格式');

            const headers = {
                'Content-Type': 'application/json'
            };

            // 添加API密钥
            if (apiConfig.api_key) {
                headers['Authorization'] = `Bearer ${apiConfig.api_key}`;
            }

            // 添加自定义请求头
            if (apiConfig.custom_headers) {
                const customHeaders = typeof apiConfig.custom_headers === 'string'
                    ? JSON.parse(apiConfig.custom_headers)
                    : apiConfig.custom_headers;
                Object.assign(headers, customHeaders);
            }

            // 构建请求体
            const requestBody = {
                model: apiConfig.model,
                messages: [
                    {
                        role: 'system',
                        content: finalSystemMessage
                    },
                    {
                        role: 'user',
                        content: userMessage
                    }
                ],
                stream: false,
                temperature: apiConfig.temperature || 0.7,
                max_tokens: apiConfig.max_tokens || 3000
            };

            response = await axios.post(apiConfig.api_url, requestBody, {
                headers,
                timeout: apiConfig.timeout || 120000,
                httpsAgent: new (require('https').Agent)({
                    keepAlive: true,
                    timeout: apiConfig.timeout || 120000
                })
            });

            // 解析OpenAI格式响应
            if (response.data && response.data.choices && response.data.choices.length > 0) {
                return response.data.choices[0].message.content;
            }
            throw new Error('AI响应格式异常');
        }
    } catch (error) {
        if (error.code === 'ECONNABORTED' || error.message === 'aborted') {
            console.error('AI API请求超时，建议检查网络连接或增加超时时间');
            throw new Error('AI服务请求超时，请稍后重试');
        } else if (error.response) {
            console.error('AI API返回错误:', error.response.status, error.response.data);
            throw new Error(`AI服务错误: ${error.response.status}`);
        } else {
            console.error('AI API调用失败:', error.message);
            throw new Error('AI服务暂时不可用，请稍后重试');
        }
    }
}

/**
 * 格式化新闻时间
 */
function formatNewsTime(datetime) {
    if (!datetime) return '刚刚';

    try {
        // 如果是Unix时间戳(秒),转换为毫秒
        let newsTime;
        if (typeof datetime === 'number' || (typeof datetime === 'string' && /^\d+$/.test(datetime))) {
            newsTime = new Date(parseInt(datetime) * 1000);
        } else {
            newsTime = new Date(datetime);
        }

        const now = new Date();
        const diff = Math.floor((now - newsTime) / 1000); // 秒

        if (diff < 60) return '刚刚';
        if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;

        return newsTime.toLocaleDateString('zh-CN');
    } catch (e) {
        return '刚刚';
    }
}

/**
 * 格式化公告时间
 */
function formatAnnouncementTime(datetime) {
    if (!datetime) return '';

    try {
        const announceTime = new Date(datetime);
        const now = new Date();
        const diff = Math.floor((now - announceTime) / 1000); // 秒

        // 公告时间显示更精确的日期
        if (diff < 86400) {
            // 24小时内显示"今天"
            return '今天';
        } else if (diff < 172800) {
            // 48小时内显示"昨天"
            return '昨天';
        } else if (diff < 604800) {
            // 7天内显示"X天前"
            return `${Math.floor(diff / 86400)}天前`;
        } else {
            // 超过7天显示具体日期
            return announceTime.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        }
    } catch (e) {
        return '';
    }
}

/**
 * 获取下一个交易日
 */
function getNextTradingDay() {
    const today = new Date();
    let nextDay = new Date(today);
    nextDay.setDate(nextDay.getDate() + 1);

    // 如果明天是周六，跳到周一
    if (nextDay.getDay() === 6) {
        nextDay.setDate(nextDay.getDate() + 2);
    }
    // 如果明天是周日，跳到周一
    else if (nextDay.getDay() === 0) {
        nextDay.setDate(nextDay.getDate() + 1);
    }

    return nextDay.toISOString().split('T')[0];
}

/**
 * 定时任务：自动分析所有用户持仓
 */
async function runScheduledPortfolioAnalysis() {
    console.log('⏰ 定时任务触发：开始自动分析所有用户持仓...');

    try {
        // 获取所有用户
        const users = await userModel.findAll();

        for (const user of users) {
            try {
                // 获取用户持仓
                const positions = await positionModel.findByUserId(user.id);

                if (positions && positions.length > 0) {
                    console.log(`📊 正在分析用户 ${user.username} (ID: ${user.id}) 的持仓...`);

                    // 构建持仓摘要
                    const portfolioSummary = buildPortfolioSummary(positions);

                    // 获取用户总资金
                    const totalCapital = user.total_capital || 0;
                    const positionRatio = totalCapital > 0 ? (portfolioSummary.totalMarketValue / totalCapital * 100).toFixed(2) : 0;

                    // 调用AI分析
                    const analysisPrompt = `请对以下持仓进行每日例行分析：

【资金情况】
- 总资金：¥${totalCapital.toLocaleString('zh-CN')}
- 持仓市值：¥${portfolioSummary.totalMarketValue.toFixed(2)}
- 仓位占比：${positionRatio}%
- 可用资金：¥${(totalCapital - portfolioSummary.totalMarketValue).toFixed(2)}

【持仓概况】
- 持仓股票：${portfolioSummary.totalStocks} 只
- 总盈亏：¥${portfolioSummary.totalProfitLoss.toFixed(2)} (${portfolioSummary.totalProfitLossRate}%)

【详细持仓】
${portfolioSummary.detailedPositions}

请结合投资者的资金规模和仓位情况，提供：
1. 今日持仓表现评估
2. 仓位管理建议（基于当前仓位占比）
3. 明日需要关注的股票
4. 风险提示和操作建议

请简明扼要，突出重点。`;

                    const defaultSystemPrompt = '你是一位专业的股票投资顾问助手，擅长分析持仓数据并提供投资建议。';
                    const analysis = await callDeepSeekAPI(analysisPrompt, defaultSystemPrompt, 'portfolio_analysis');

                    // 保存分析结果到数据库
                    const savedReport = await analysisReportModel.save(user.id, analysis, portfolioSummary, 'scheduled');
                    console.log(`✅ 用户 ${user.username} 的持仓分析完成，报告ID: ${savedReport.id}`);

                } else {
                    console.log(`ℹ️ 用户 ${user.username} 暂无持仓数据`);
                }

            } catch (error) {
                console.error(`❌ 分析用户 ${user.username} 的持仓时出错:`, error.message);
            }
        }

        console.log('✅ 所有用户持仓分析完成');

    } catch (error) {
        console.error('❌ 定时任务执行失败:', error.message);
    }
}

/**
 * 定时任务：自动分析集合竞价
 */
async function runScheduledCallAuctionAnalysis() {
    console.log('⏰ 定时任务触发：开始自动分析集合竞价...');

    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // 检查今日是否已经分析过（避免重复）
        const existingAnalysis = await callAuctionAnalysisModel.findByDate(today);
        if (existingAnalysis) {
            console.log(`ℹ️ 今日 (${today}) 已存在集合竞价分析，跳过自动分析`);
            return;
        }

        // 1. 获取主要市场指数数据
        const indexCodes = ['000001', '399001', '399006']; // 上证指数、深证成指、创业板指
        const indexQuotes = [];

        for (const code of indexCodes) {
            try {
                // 判断市场：000001是上证指数，6开头是沪市，其他是深市
                let market;
                if (code === '000001') {
                    market = 'sh';  // 上证指数
                } else if (code.startsWith('6')) {
                    market = 'sh';  // 沪市股票
                } else {
                    market = 'sz';  // 深市股票和指数
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
            console.log('❌ 无法获取市场指数数据，跳过集合竞价分析');
            return;
        }

        // 2. 构建市场概况摘要
        const marketSummary = {
            date: today,
            indices: indexQuotes,
            analysisTime: new Date().toISOString()
        };

        // 3. 构建AI分析提示词
        const analysisPrompt = `请作为专业的股票分析师，对今日（${today}）的A股市场集合竞价情况进行分析：

【市场指数概况】
${indexQuotes.map(idx =>
    `- ${idx.name} (${idx.code}):
   开盘价: ¥${idx.todayOpen} | 现价: ¥${idx.currentPrice}
   涨跌: ${idx.change >= 0 ? '+' : ''}${idx.change} (${idx.changePercent >= 0 ? '+' : ''}${idx.changePercent}%)
   最高: ¥${idx.todayHigh} | 最低: ¥${idx.todayLow}
   成交量: ${(idx.volume / 100000000).toFixed(2)}亿股 | 成交额: ${(idx.amount / 100000000).toFixed(2)}亿元`
).join('\n\n')}

请从以下几个方面进行专业分析：

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

        // 4. 调用DeepSeek AI进行分析
        const defaultSystemPrompt = '你是一位专业的A股市场分析师，擅长解读集合竞价和盘前信息。';
        const aiAnalysis = await callDeepSeekAPI(analysisPrompt, defaultSystemPrompt, 'call_auction_analysis');

        console.log('✅ 集合竞价AI分析完成');

        // 5. 保存分析结果到数据库
        const savedAnalysis = await callAuctionAnalysisModel.save(today, aiAnalysis, marketSummary, 'scheduled');
        console.log(`📄 集合竞价分析已保存，ID: ${savedAnalysis.id}, 日期: ${today}`);

        console.log('✅ 集合竞价自动分析完成');

    } catch (error) {
        console.error('❌ 集合竞价自动分析失败:', error.message);
    }
}

module.exports = {
    getStockIndustry,
    buildPortfolioSummary,
    callDeepSeekAPI,
    formatNewsTime,
    formatAnnouncementTime,
    getNextTradingDay,
    runScheduledPortfolioAnalysis,
    runScheduledCallAuctionAnalysis,
    STOCK_INDUSTRY_MAP
};
