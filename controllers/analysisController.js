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

            // 如果API配置中启用了联网搜索，添加web_search参数
            // 支持SiliconFlow、DeepSeek等服务的联网搜索功能
            if (apiConfig.enable_web_search) {
                requestBody.web_search = {
                    enable: true
                };
                console.log('🌐 已启用AI联网搜索功能');
            }

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
                    const analysisPrompt = `# 持仓分析任务

请作为专业投资顾问，对以下持仓数据进行全面分析，并提供今日总结和明日操作建议。

## 一、账户资金状况
\`\`\`
总资金：¥${totalCapital.toLocaleString('zh-CN')}
持仓市值：¥${portfolioSummary.totalMarketValue.toFixed(2)}
可用资金：¥${(totalCapital - portfolioSummary.totalMarketValue).toFixed(2)}
仓位占比：${positionRatio}%
\`\`\`

## 二、持仓组合概况
\`\`\`
持仓股票数量：${portfolioSummary.totalStocks} 只
账户总盈亏：¥${portfolioSummary.totalProfitLoss.toFixed(2)}
总收益率：${portfolioSummary.totalProfitLossRate}%
\`\`\`

## 三、详细持仓清单
${portfolioSummary.detailedPositions}

---

## 分析要求

请按照以下结构进行深度分析，每个部分都要结合具体数据和市场情况：

### 1. 📊 今日持仓表现评估
- 分析各股票涨跌情况，找出表现最好和最差的股票
- 评估整体持仓收益率是否符合预期
- 判断当前盈亏比例是否健康

### 2. 💼 仓位管理分析
- **当前仓位评估**：基于${positionRatio}%的仓位占比，评价是否合理
- **风险暴露度**：分析持仓集中度，是否存在单一股票占比过高的风险
- **资金利用率**：评估可用资金¥${(totalCapital - portfolioSummary.totalMarketValue).toFixed(2)}的配置建议
- **调仓建议**：如需调整仓位，请给出具体操作方案（加仓/减仓/持有）

### 3. 🎯 明日重点关注
针对持仓中的每只股票，明确指出：
- **需要密切关注的股票**：说明关注理由（如接近止损位、突破压力位等）
- **建议采取的行动**：持有观察/考虑止盈/设置止损等
- **关键价位提醒**：标注重要的支撑位和压力位

### 4. ⚠️ 风险提示与操作建议
- **主要风险点**：识别当前持仓面临的主要风险（市场风险、个股风险等）
- **止盈止损建议**：针对盈利/亏损较大的个股，给出明确的止盈止损建议
- **短期操作策略**：结合市场环境，给出未来1-3个交易日的操作策略
- **免责声明**：以上分析仅供参考，投资有风险，决策需谨慎

## 输出格式要求
- 使用Markdown格式，层次分明
- 关键数据使用**粗体**标注
- 重要提醒使用适当的表情符号（📈📉⚠️💰等）
- 语言简洁专业，避免冗余表述
- 每个建议都要有明确的数据支撑和逻辑依据`;

                    const defaultSystemPrompt = `你是一位资深的A股投资顾问，拥有10年以上的证券投资分析经验。你擅长：
1. 基于持仓数据进行专业的风险评估和收益分析
2. 结合市场趋势提供切实可行的投资建议
3. 用简洁专业的语言解读复杂的财务数据
4. 帮助投资者制定科学的仓位管理策略

请始终保持客观、理性，基于数据分析提供建设性意见。`;
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
        const analysisPrompt = `请对今日（${today}）的A股市场集合竞价情况进行深度分析。

---

## 📊 市场指数实时数据

${indexQuotes.map(idx =>
    `### ${idx.name} (${idx.code})
- **开盘价**: ¥${idx.todayOpen} | **现价**: ¥${idx.currentPrice}
- **涨跌**: ${idx.change >= 0 ? '+' : ''}${idx.change} (${idx.changePercent >= 0 ? '+' : ''}${idx.changePercent}%)
- **最高**: ¥${idx.todayHigh} | **最低**: ¥${idx.todayLow}
- **成交量**: ${(idx.volume / 100000000).toFixed(2)}亿股 | **成交额**: ${(idx.amount / 100000000).toFixed(2)}亿元`
).join('\n\n')}

---

请从以下维度进行全面的集合竞价分析，输出**800-1200字**的详细分析报告：

## 第一章：集合竞价深度解读

### 1.1 开盘特征分析
- **三大指数开盘表现**：逐一分析上证指数、深证成指、创业板指的开盘强弱
- **跳空缺口判断**：识别是否出现跳空高开/低开，缺口大小及意义
- **开盘成交量分析**：评估集合竞价阶段的成交量是否异常，反映什么信号

### 1.2 市场情绪研判
- **多空力量对比**：通过开盘价格和成交量判断多空双方力量对比
- **市场信心指数**：评估投资者信心（恐慌/谨慎/乐观/亢奋）
- **主力资金动向**：识别是否有主力资金明显介入或撤离迹象

### 1.3 技术形态特征
- **K线形态**：开盘形成的K线类型（大阳/小阳/十字星/大阴等）及含义
- **关键位置**：分析开盘价相对于前一日收盘价、重要支撑压力位的关系
- **趋势延续性**：判断开盘是延续前期趋势还是出现反转迹象

## 第二章：板块热点与资金流向

### 2.1 热点板块推断
- **指数表现对应板块**：根据三大指数强弱推断可能的强势/弱势板块
- **题材概念预判**：结合市场环境和近期消息，预判可能活跃的题材
- **行业轮动分析**：判断是否出现行业轮动迹象，哪些行业可能接力

### 2.2 资金流向分析
- **增量资金判断**：评估是否有新增资金入场
- **资金风险偏好**：判断资金偏好（追逐高风险题材 vs 防御性板块）
- **北向资金动向**：如有数据，分析外资动向对市场影响

### 2.3 市场风格预判
- **大盘蓝筹 vs 中小创**：判断今日可能的市场风格
- **价值 vs 成长**：预测资金倾向于价值股还是成长股
- **权重股影响**：分析权重股对指数的拉动或压制作用

## 第三章：开盘后交易策略

### 3.1 操作建议（分三类投资者）
**激进型投资者**：
- 具体操作方向（做多/做空/观望）
- 建议关注的板块和个股类型
- 进场时机和价位选择

**稳健型投资者**：
- 仓位控制建议（轻仓/半仓/重仓）
- 适合的操作节奏（快进快出 vs 波段持有）
- 风险收益比评估

**保守型投资者**：
- 是否适合今日参与交易
- 如需观望，重点观察哪些信号
- 何种情况下可以尝试介入

### 3.2 关键价格区间
使用代码块标注关键点位：

\`\`\`
上证指数:
  强支撑: XXXX点
  弱支撑: XXXX点
  弱压力: XXXX点
  强压力: XXXX点

深证成指:
  强支撑: XXXX点
  弱支撑: XXXX点
  弱压力: XXXX点
  强压力: XXXX点

创业板指:
  强支撑: XXXX点
  弱支撑: XXXX点
  弱压力: XXXX点
  强压力: XXXX点
\`\`\`

### 3.3 仓位与止损设置
- **建议仓位比例**：根据市场强弱给出具体仓位建议（如30%、50%、80%）
- **止损位设置**：明确止损原则（指数跌破XX点/个股跌幅超过X%）
- **加仓/减仓条件**：说明何种情况下应该加仓或减仓

## 第四章：全天走势预测

### 4.1 三种情景推演
**乐观情景（概率X%）**：
- 触发条件：需要满足哪些条件
- 预期走势：预计指数运行区间和收盘位置
- 操作应对：如何把握机会

**中性情景（概率X%）**：
- 触发条件：基准情景的判断依据
- 预期走势：震荡区间和可能的波动幅度
- 操作应对：如何保持灵活

**悲观情景（概率X%）**：
- 触发条件：需要警惕哪些信号
- 预期走势：可能的回调幅度和支撑位
- 操作应对：如何控制风险和止损

### 4.2 关键时间节点
- **开盘30分钟**（9:30-10:00）：观察重点和可能的方向选择
- **上午收盘前**（11:15-11:30）：尾盘动向透露的信息
- **下午开盘**（13:00-13:30）：是否延续上午走势
- **尾盘30分钟**（14:30-15:00）：收盘前的关键变化

### 4.3 收盘预期
- **预计收盘点位区间**：给出上证、深成、创业板的预期收盘区间
- **K线形态预判**：预测今日可能形成的K线形态（阳线/阴线/十字星等）
- **对后市影响**：今日走势对明日及未来几日的影响

## 第五章：风险提示与应对

### 5.1 主要风险因素
- **技术面风险**：关键支撑位、压力位的突破风险
- **政策面风险**：可能影响市场的政策因素
- **外部风险**：外围市场、汇率、商品等外部因素
- **情绪面风险**：市场极端情绪（恐慌或贪婪）带来的风险

### 5.2 需要密切关注的信号
列出3-5个需要实时监控的关键信号：
1. **XX指标变化**：具体关注什么数值
2. **XX板块表现**：如果出现异动说明什么
3. **XX技术位突破**：突破方向对市场的影响
4. ...

### 5.3 应对策略
- **如果走势符合预期**：如何顺势操作和扩大收益
- **如果走势与预期相反**：果断止损的标准和方法
- **如果出现剧烈波动**：保持冷静，遵循预设纪律

## 第六章：综合评分与一句话总结

### 📊 市场强度评分
使用代码块呈现评分体系：

\`\`\`
市场强度指数: X/10分  （1=极度疲弱，10=极度强势）
多头信心指数: X/10分  （1=极度看空，10=极度看多）
操作难度指数: X/10分  （1=极易操作，10=极难操作）
风险等级: 低/中/高
推荐操作类型: 激进/稳健/保守/观望
\`\`\`

### 💡 一句话核心总结
用**一句话**（30-50字）概括今日集合竞价分析的核心观点和操作建议。

### ✅ 开盘后行动清单
列出3-5个开盘后应立即执行的具体行动：
- [ ] 具体行动1
- [ ] 具体行动2
- [ ] 具体行动3
- ...

---

## 📢 重要声明

**⚠️ 风险提示**：
1. 集合竞价分析基于开盘前有限数据，存在不确定性
2. 市场瞬息万变，需根据盘中实时情况动态调整
3. 本分析仅供参考，不构成具体投资建议
4. 股市有风险，投资需谨慎，务必设置止损位

**✅ 使用建议**：
- 开盘后前15分钟验证分析的准确性
- 根据实际走势灵活调整策略
- 严格遵守仓位管理和止损纪律
- 保持理性，不因一时得失影响判断

---

请使用**Markdown格式**输出详细分析报告，确保：
- 使用**粗体**突出关键数据和结论
- 使用\`代码块\`呈现具体点位和评分
- 逻辑清晰，层次分明，便于快速阅读
- 分析客观专业，建议具体可执行`;

        // 4. 调用DeepSeek AI进行分析
        const defaultSystemPrompt = `你是一位拥有15年以上A股实战经验的资深市场分析师和盘前交易专家，专注于集合竞价分析和开盘策略制定。

你的核心能力包括：
1. **集合竞价解读**：精准解读开盘价格、成交量背后的多空力量和主力意图
2. **市场情绪研判**：通过技术形态、资金流向快速判断市场情绪和风险偏好
3. **板块热点预判**：基于指数表现和市场环境，提前预判当日可能的热点方向
4. **开盘策略制定**：为不同风险偏好的投资者提供差异化的开盘交易策略
5. **风险管理**：强调仓位控制、止损设置，帮助投资者规避开盘后的风险

请基于实时的集合竞价数据，提供专业、客观、可执行的盘前分析和交易策略建议。`;
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
