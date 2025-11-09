const express = require('express');
const { callDeepSeekAPI } = require('../controllers/analysisController');
const { aiPromptTemplateModel } = require('../database');
const PredictionHistoryModel = require('../database/models/prediction-history');

module.exports = (authenticateToken) => {
    const router = express.Router();

    /**
     * 辅助函数：保存预测历史记录
     */
    async function savePredictionHistory(userId, predictionType, stockCode, stockName, predictionContent, paipanInfo) {
        try {
            const predictionDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD格式

            await PredictionHistoryModel.saveOrUpdate({
                userId,
                predictionType,
                stockCode,
                stockName,
                predictionDate,
                predictionContent,
                paipanInfo
            });
        } catch (error) {
            // 历史记录保存失败不影响主流程
            console.error('⚠️ 保存历史记录失败:', error.message);
        }
    }

    // 大盘预测API（六壬预测法）
    router.post('/market', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const { paipanResult } = req.body;

        if (!paipanResult) {
            return res.json({
                success: false,
                error: '请先进行排盘'
            });
        }

        try {
            console.log('🔮 开始大盘六壬预测...', userId);

            // 从数据库读取提示词模板
            const template = await aiPromptTemplateModel.findBySceneType('market_prediction');

            if (!template || !template.is_active) {
                return res.json({
                    success: false,
                    error: '大盘预测提示词模板未找到或未启用'
                });
            }

            // 构建变量映射
            const variables = {
                prediction_time: paipanResult.date,
                day_ganzhi: paipanResult.dayGanZhi,
                hour_ganzhi: paipanResult.hourGanZhi,
                month_jiang: paipanResult.monthJiang,
                sike: paipanResult.siKe.map((ke, i) => `${ke.name}：${ke.earthBranch}（地支） - ${ke.heavenlyStem}（天干）`).join('\n'),
                sanchuan: `初传：${paipanResult.sanChuan.chu}\n中传：${paipanResult.sanChuan.zhong}\n末传：${paipanResult.sanChuan.mo}`,
                twelve_gods: paipanResult.twelveGods.map(god => `${god.position}位：${god.god}`).join('\n')
            };

            // 替换模板中的变量
            let userPrompt = template.user_prompt_template;
            for (const [key, value] of Object.entries(variables)) {
                userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
            }

            console.log('📝 ==================== 大盘预测提示词 ====================');
            console.log('系统提示词:', template.system_prompt);
            console.log('用户提示词:', userPrompt.substring(0, 500) + '...');
            console.log('📝 ========================================================');

            // 调用DeepSeek AI进行预测
            let aiPrediction = await callDeepSeekAPI(
                userPrompt,
                template.system_prompt
            );

            // 清理AI返回的内容，移除可能的代码块标记
            aiPrediction = aiPrediction.trim();

            // 如果AI返回的内容被包裹在```markdown或```中，移除这些标记
            if (aiPrediction.startsWith('```')) {
                const lines = aiPrediction.split('\n');
                // 移除第一行的```markdown或```
                if (lines[0].match(/^```\s*markdown?\s*$/i)) {
                    lines.shift();
                }
                // 移除最后一行的```
                if (lines[lines.length - 1].trim() === '```') {
                    lines.pop();
                }
                aiPrediction = lines.join('\n').trim();
            }

            console.log('✅ AI大盘预测完成');
            console.log('📄 预测内容前100字符:', aiPrediction.substring(0, 100));

            // 保存历史记录
            await savePredictionHistory(
                userId,
                'market_prediction',
                'MARKET',
                '大盘预测',
                aiPrediction,
                paipanResult
            );

            res.json({
                success: true,
                data: {
                    prediction: aiPrediction,
                    paipanInfo: paipanResult,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ 大盘预测错误:', error.message);
            res.status(500).json({
                success: false,
                error: '大盘预测失败: ' + error.message
            });
        }
    });

    // 价格预测API（开发中）
    router.post('/price', authenticateToken, async (req, res) => {
        try {
            console.log('💰 价格预测功能开发中...');
            res.json({
                success: false,
                error: '价格预测功能正在开发中，敬请期待！'
            });
        } catch (error) {
            console.error('❌ 价格预测错误:', error.message);
            res.status(500).json({
                success: false,
                error: '价格预测失败: ' + error.message
            });
        }
    });

    // 趋势预测API
    router.post('/trend', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const { stockCode, stockName } = req.body;

        if (!stockCode || !stockName) {
            return res.json({
                success: false,
                error: '请提供股票代码和名称'
            });
        }

        try {
            console.log(`📊 开始股票趋势预测: ${stockCode} ${stockName}...`);

            // 判断交易日
            const predictionDate = getNextTradingDay();
            const isToday = isTodayTradingDay();

            console.log(`📅 预测日期: ${predictionDate} (${isToday ? '今日' : '下一交易日'})`);

            // 从数据库读取提示词模板
            const template = await aiPromptTemplateModel.findBySceneType('trend_prediction');

            if (!template || !template.is_active) {
                return res.json({
                    success: false,
                    error: '趋势预测提示词模板未找到或未启用'
                });
            }

            // 构建变量映射
            const variables = {
                stock_code: stockCode,
                stock_name: stockName,
                prediction_date: predictionDate,
                trading_day_status: isToday ? '当前交易日' : '下一个交易日'
            };

            // 替换模板中的变量
            let userPrompt = template.user_prompt_template;
            for (const [key, value] of Object.entries(variables)) {
                userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
            }

            console.log('📝 ==================== 趋势预测提示词 ====================');
            console.log('系统提示词:', template.system_prompt);
            console.log('用户提示词:', userPrompt.substring(0, 500) + '...');
            console.log('📝 ========================================================');

            // 调用DeepSeek AI进行预测
            let aiPrediction = await callDeepSeekAPI(
                userPrompt,
                template.system_prompt
            );

            // 清理AI返回的内容
            aiPrediction = aiPrediction.trim();
            if (aiPrediction.startsWith('```')) {
                const lines = aiPrediction.split('\n');
                if (lines[0].match(/^```\s*markdown?\s*$/i)) {
                    lines.shift();
                }
                if (lines[lines.length - 1].trim() === '```') {
                    lines.pop();
                }
                aiPrediction = lines.join('\n').trim();
            }

            console.log('✅ AI趋势预测完成');

            // 保存历史记录
            await savePredictionHistory(
                userId,
                'trend_prediction',
                stockCode,
                stockName,
                aiPrediction,
                null  // 技术面分析没有排盘信息
            );

            res.json({
                success: true,
                data: {
                    stockCode,
                    stockName,
                    predictionDate,
                    isToday,
                    prediction: aiPrediction,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ 趋势预测错误:', error.message);
            res.status(500).json({
                success: false,
                error: '趋势预测失败: ' + error.message
            });
        }
    });

    // 股票趋势预测API（六壬预测法）
    router.post('/stock-trend', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const { stockCode, stockName, paipanResult } = req.body;

        if (!stockCode || !stockName) {
            return res.json({
                success: false,
                error: '请提供股票代码和名称'
            });
        }

        if (!paipanResult) {
            return res.json({
                success: false,
                error: '请先进行排盘'
            });
        }

        try {
            console.log(`🔮 开始六壬股票趋势预测: ${stockCode} ${stockName}...`);

            // 从数据库读取提示词模板
            const template = await aiPromptTemplateModel.findBySceneType('stock_trend_prediction');

            if (!template || !template.is_active) {
                return res.json({
                    success: false,
                    error: '股票趋势预测提示词模板未找到或未启用'
                });
            }

            // 构建变量映射
            const variables = {
                stock_code: stockCode,
                stock_name: stockName,
                prediction_time: paipanResult.date,
                day_ganzhi: paipanResult.dayGanZhi,
                hour_ganzhi: paipanResult.hourGanZhi,
                month_jiang: paipanResult.monthJiang,
                sike: paipanResult.siKe.map((ke, i) => `${ke.name}：${ke.earthBranch}（地支） - ${ke.heavenlyStem}（天干）`).join('\n'),
                sanchuan: `初传：${paipanResult.sanChuan.chu}\n中传：${paipanResult.sanChuan.zhong}\n末传：${paipanResult.sanChuan.mo}`,
                twelve_gods: paipanResult.twelveGods.map(god => `${god.position}位：${god.god}`).join('\n')
            };

            // 替换模板中的变量
            let userPrompt = template.user_prompt_template;
            for (const [key, value] of Object.entries(variables)) {
                userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
            }

            console.log('📝 ==================== 股票趋势预测提示词 ====================');
            console.log('系统提示词:', template.system_prompt);
            console.log('用户提示词:', userPrompt.substring(0, 500) + '...');
            console.log('📝 ========================================================');

            // 调用DeepSeek AI进行预测
            let aiPrediction = await callDeepSeekAPI(
                userPrompt,
                template.system_prompt
            );

            // 清理AI返回的内容
            aiPrediction = aiPrediction.trim();
            if (aiPrediction.startsWith('```')) {
                const lines = aiPrediction.split('\n');
                if (lines[0].match(/^```\s*markdown?\s*$/i)) {
                    lines.shift();
                }
                if (lines[lines.length - 1].trim() === '```') {
                    lines.pop();
                }
                aiPrediction = lines.join('\n').trim();
            }

            console.log('✅ 六壬股票趋势预测完成');

            // 保存历史记录
            await savePredictionHistory(
                userId,
                'stock_trend_prediction',
                stockCode,
                stockName,
                aiPrediction,
                paipanResult
            );

            res.json({
                success: true,
                data: {
                    stockCode,
                    stockName,
                    prediction: aiPrediction,
                    paipanInfo: paipanResult,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ 股票趋势预测错误:', error.message);
            res.status(500).json({
                success: false,
                error: '股票趋势预测失败: ' + error.message
            });
        }
    });

    // 波动预测API（开发中）
    router.post('/volatility', authenticateToken, async (req, res) => {
        try {
            console.log('📉 波动预测功能开发中...');
            res.json({
                success: false,
                error: '波动预测功能正在开发中，敬请期待！'
            });
        } catch (error) {
            console.error('❌ 波动预测错误:', error.message);
            res.status(500).json({
                success: false,
                error: '波动预测失败: ' + error.message
            });
        }
    });

    // 业绩预测API（开发中）
    router.post('/earnings', authenticateToken, async (req, res) => {
        try {
            console.log('💵 业绩预测功能开发中...');
            res.json({
                success: false,
                error: '业绩预测功能正在开发中，敬请期待！'
            });
        } catch (error) {
            console.error('❌ 业绩预测错误:', error.message);
            res.status(500).json({
                success: false,
                error: '业绩预测失败: ' + error.message
            });
        }
    });

    // 情绪预测API（开发中）
    router.post('/sentiment', authenticateToken, async (req, res) => {
        try {
            console.log('😊 情绪预测功能开发中...');
            res.json({
                success: false,
                error: '情绪预测功能正在开发中，敬请期待！'
            });
        } catch (error) {
            console.error('❌ 情绪预测错误:', error.message);
            res.status(500).json({
                success: false,
                error: '情绪预测失败: ' + error.message
            });
        }
    });

    // 股票风险预测API（六壬预测法）
    router.post('/stock-risk', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const { stockCode, stockName, paipanResult } = req.body;

        if (!stockCode || !stockName) {
            return res.json({
                success: false,
                error: '请提供股票代码和名称'
            });
        }

        if (!paipanResult) {
            return res.json({
                success: false,
                error: '请先进行排盘'
            });
        }

        try {
            console.log(`⚠️ 开始六壬股票风险预测: ${stockCode} ${stockName}...`);

            // 从数据库读取提示词模板
            const template = await aiPromptTemplateModel.findBySceneType('stock_risk_prediction');

            if (!template || !template.is_active) {
                return res.json({
                    success: false,
                    error: '股票风险预测提示词模板未找到或未启用'
                });
            }

            // 构建变量映射
            const variables = {
                stock_code: stockCode,
                stock_name: stockName,
                prediction_time: paipanResult.date,
                day_ganzhi: paipanResult.dayGanZhi,
                hour_ganzhi: paipanResult.hourGanZhi,
                month_jiang: paipanResult.monthJiang,
                sike: paipanResult.siKe.map((ke, i) => `${ke.name}：${ke.earthBranch}（地支） - ${ke.heavenlyStem}（天干）`).join('\n'),
                sanchuan: `初传：${paipanResult.sanChuan.chu}\n中传：${paipanResult.sanChuan.zhong}\n末传：${paipanResult.sanChuan.mo}`,
                twelve_gods: paipanResult.twelveGods.map(god => `${god.position}位：${god.god}`).join('\n')
            };

            // 替换模板中的变量
            let userPrompt = template.user_prompt_template;
            for (const [key, value] of Object.entries(variables)) {
                userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
            }

            console.log('📝 ==================== 股票风险预测提示词 ====================');
            console.log('系统提示词:', template.system_prompt);
            console.log('用户提示词:', userPrompt.substring(0, 500) + '...');
            console.log('📝 ========================================================');

            // 调用DeepSeek AI进行预测
            let aiPrediction = await callDeepSeekAPI(
                userPrompt,
                template.system_prompt
            );

            // 清理AI返回的内容
            aiPrediction = aiPrediction.trim();
            if (aiPrediction.startsWith('```')) {
                const lines = aiPrediction.split('\n');
                if (lines[0].match(/^```\s*markdown?\s*$/i)) {
                    lines.shift();
                }
                if (lines[lines.length - 1].trim() === '```') {
                    lines.pop();
                }
                aiPrediction = lines.join('\n').trim();
            }

            console.log('✅ 六壬股票风险预测完成');

            // 保存历史记录
            await savePredictionHistory(
                userId,
                'stock_risk_prediction',
                stockCode,
                stockName,
                aiPrediction,
                paipanResult
            );

            res.json({
                success: true,
                data: {
                    stockCode,
                    stockName,
                    prediction: aiPrediction,
                    paipanInfo: paipanResult,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ 股票风险预测错误:', error.message);
            res.status(500).json({
                success: false,
                error: '股票风险预测失败: ' + error.message
            });
        }
    });

    // 股票情绪预测API（六壬预测法）
    router.post('/stock-sentiment', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const { stockCode, stockName, paipanResult } = req.body;

        if (!stockCode || !stockName) {
            return res.json({
                success: false,
                error: '请提供股票代码和名称'
            });
        }

        if (!paipanResult) {
            return res.json({
                success: false,
                error: '请先进行排盘'
            });
        }

        try {
            console.log(`😊 开始六壬股票情绪预测: ${stockCode} ${stockName}...`);

            // 从数据库读取提示词模板
            const template = await aiPromptTemplateModel.findBySceneType('stock_sentiment_prediction');

            if (!template || !template.is_active) {
                return res.json({
                    success: false,
                    error: '股票情绪预测提示词模板未找到或未启用'
                });
            }

            // 构建变量映射
            const variables = {
                stock_code: stockCode,
                stock_name: stockName,
                prediction_time: paipanResult.date,
                day_ganzhi: paipanResult.dayGanZhi,
                hour_ganzhi: paipanResult.hourGanZhi,
                month_jiang: paipanResult.monthJiang,
                sike: paipanResult.siKe.map((ke, i) => `${ke.name}：${ke.earthBranch}（地支） - ${ke.heavenlyStem}（天干）`).join('\n'),
                sanchuan: `初传：${paipanResult.sanChuan.chu}\n中传：${paipanResult.sanChuan.zhong}\n末传：${paipanResult.sanChuan.mo}`,
                twelve_gods: paipanResult.twelveGods.map(god => `${god.position}位：${god.god}`).join('\n')
            };

            // 替换模板中的变量
            let userPrompt = template.user_prompt_template;
            for (const [key, value] of Object.entries(variables)) {
                userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
            }

            console.log('📝 ==================== 股票情绪预测提示词 ====================');
            console.log('系统提示词:', template.system_prompt);
            console.log('用户提示词:', userPrompt.substring(0, 500) + '...');
            console.log('📝 ========================================================');

            // 调用DeepSeek AI进行预测
            let aiPrediction = await callDeepSeekAPI(
                userPrompt,
                template.system_prompt
            );

            // 清理AI返回的内容
            aiPrediction = aiPrediction.trim();
            if (aiPrediction.startsWith('```')) {
                const lines = aiPrediction.split('\n');
                if (lines[0].match(/^```\s*markdown?\s*$/i)) {
                    lines.shift();
                }
                if (lines[lines.length - 1].trim() === '```') {
                    lines.pop();
                }
                aiPrediction = lines.join('\n').trim();
            }

            console.log('✅ 六壬股票情绪预测完成');

            // 保存历史记录
            await savePredictionHistory(
                userId,
                'stock_sentiment_prediction',
                stockCode,
                stockName,
                aiPrediction,
                paipanResult
            );

            res.json({
                success: true,
                data: {
                    stockCode,
                    stockName,
                    prediction: aiPrediction,
                    paipanInfo: paipanResult,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ 股票情绪预测错误:', error.message);
            res.status(500).json({
                success: false,
                error: '股票情绪预测失败: ' + error.message
            });
        }
    });

    // 市场整体情绪预测API（六壬预测法）
    router.post('/market-sentiment', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const { stockCode, stockName, paipanResult } = req.body;

        if (!stockCode || !stockName) {
            return res.json({
                success: false,
                error: '请提供市场指数代码和名称'
            });
        }

        if (!paipanResult) {
            return res.json({
                success: false,
                error: '请先进行排盘'
            });
        }

        try {
            console.log(`🌐 开始六壬市场整体情绪预测: ${stockCode} ${stockName}...`);

            // 从数据库读取提示词模板
            const template = await aiPromptTemplateModel.findBySceneType('market_sentiment_prediction');

            if (!template || !template.is_active) {
                return res.json({
                    success: false,
                    error: '市场情绪预测提示词模板未找到或未启用'
                });
            }

            // 构建变量映射
            const variables = {
                market_index: stockCode,
                market_name: stockName,
                prediction_time: paipanResult.date,
                day_ganzhi: paipanResult.dayGanZhi,
                hour_ganzhi: paipanResult.hourGanZhi,
                month_jiang: paipanResult.monthJiang,
                sike: paipanResult.siKe.map((ke, i) => `${ke.name}：${ke.earthBranch}（地支） - ${ke.heavenlyStem}（天干）`).join('\n'),
                sanchuan: `初传：${paipanResult.sanChuan.chu}\n中传：${paipanResult.sanChuan.zhong}\n末传：${paipanResult.sanChuan.mo}`,
                twelve_gods: paipanResult.twelveGods.map(god => `${god.position}位：${god.god}`).join('\n')
            };

            // 替换模板中的变量
            let userPrompt = template.user_prompt_template;
            for (const [key, value] of Object.entries(variables)) {
                userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
            }

            console.log('📝 ==================== 市场情绪预测提示词 ====================');
            console.log('系统提示词:', template.system_prompt);
            console.log('用户提示词:', userPrompt.substring(0, 500) + '...');
            console.log('📝 ========================================================');

            // 调用DeepSeek AI进行预测
            let aiPrediction = await callDeepSeekAPI(
                userPrompt,
                template.system_prompt
            );

            // 清理AI返回的内容
            aiPrediction = aiPrediction.trim();
            if (aiPrediction.startsWith('```')) {
                const lines = aiPrediction.split('\n');
                if (lines[0].match(/^```\s*markdown?\s*$/i)) {
                    lines.shift();
                }
                if (lines[lines.length - 1].trim() === '```') {
                    lines.pop();
                }
                aiPrediction = lines.join('\n').trim();
            }

            console.log('✅ 六壬市场整体情绪预测完成');

            // 保存历史记录
            await savePredictionHistory(
                userId,
                'market_sentiment_prediction',
                stockCode,
                stockName,
                aiPrediction,
                paipanResult
            );

            res.json({
                success: true,
                data: {
                    stockCode,
                    stockName,
                    prediction: aiPrediction,
                    paipanInfo: paipanResult,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ 市场情绪预测错误:', error.message);
            res.status(500).json({
                success: false,
                error: '市场情绪预测失败: ' + error.message
            });
        }
    });

    // 获取预测历史记录列表API
    router.get('/history', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                predictionType,
                stockCode,
                startDate,
                endDate,
                limit = 20,
                offset = 0
            } = req.query;

            console.log('📋 获取预测历史记录:', {
                userId,
                predictionType,
                stockCode,
                startDate,
                endDate,
                limit,
                offset
            });

            // 获取历史记录列表
            const records = PredictionHistoryModel.findByUserId(userId, {
                predictionType,
                stockCode,
                startDate,
                endDate,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            // 获取总数
            const totalCount = PredictionHistoryModel.countByUserId(userId, {
                predictionType,
                stockCode,
                startDate,
                endDate
            });

            res.json({
                success: true,
                data: {
                    records,
                    totalCount,
                    hasMore: parseInt(offset) + records.length < totalCount
                }
            });

        } catch (error) {
            console.error('❌ 获取预测历史错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取历史记录失败: ' + error.message
            });
        }
    });

    // 获取预测历史记录详情API
    router.get('/history/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            console.log('📄 获取预测历史记录详情:', { userId, id });

            const record = PredictionHistoryModel.findById(id, userId);

            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: '历史记录不存在或无权访问'
                });
            }

            res.json({
                success: true,
                data: record
            });

        } catch (error) {
            console.error('❌ 获取预测历史详情错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取历史记录详情失败: ' + error.message
            });
        }
    });

    // 删除预测历史记录API
    router.delete('/history/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            console.log('🗑️ 删除预测历史记录:', { userId, id });

            const deleted = PredictionHistoryModel.deleteById(id, userId);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    error: '历史记录不存在或无权删除'
                });
            }

            res.json({
                success: true,
                message: '历史记录已删除'
            });

        } catch (error) {
            console.error('❌ 删除预测历史错误:', error.message);
            res.status(500).json({
                success: false,
                error: '删除历史记录失败: ' + error.message
            });
        }
    });

    return router;
};

/**
 * 判断今天是否是交易日
 * @returns {boolean} 是否是交易日
 */
function isTodayTradingDay() {
    const now = new Date();
    const day = now.getDay(); // 0=周日, 1-5=周一至周五, 6=周六
    const hour = now.getHours();

    // 周末不是交易日
    if (day === 0 || day === 6) {
        return false;
    }

    // 工作日且在交易时间内视为交易日
    // 交易时间：9:30-11:30, 13:00-15:00
    // 为了简化，如果是工作日就认为是交易日
    return true;
}

/**
 * 获取下一个交易日的日期字符串
 * @returns {string} 日期字符串 YYYY-MM-DD
 */
function getNextTradingDay() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();

    let targetDate = new Date(now);

    // 如果是周五下午3点后，或者周六，返回下周一
    if (day === 5 && hour >= 15) {
        targetDate.setDate(now.getDate() + 3); // 周五 + 3天 = 周一
    } else if (day === 6) {
        targetDate.setDate(now.getDate() + 2); // 周六 + 2天 = 周一
    } else if (day === 0) {
        targetDate.setDate(now.getDate() + 1); // 周日 + 1天 = 周一
    } else if (hour >= 15) {
        // 工作日下午3点后，预测下一个交易日
        if (day === 4) { // 周四下午3点后，预测周五
            targetDate.setDate(now.getDate() + 1);
        } else if (day === 5) { // 周五下午3点后，预测下周一
            targetDate.setDate(now.getDate() + 3);
        } else {
            targetDate.setDate(now.getDate() + 1);
        }
    }
    // 否则返回今天

    // 格式化为 YYYY-MM-DD
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const date = String(targetDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${date}`;
}

/**
 * 构建大盘预测的AI提示词
 * @param {Object} paipanResult - 六壬排盘结果
 * @returns {string} 提示词
 */
function buildMarketPredictionPrompt(paipanResult) {
    return `请作为一位精通六壬预测和股市分析的专家，基于以下六壬排盘信息，预测下一个交易日A股大盘（上证指数、深证成指）的走势。

【六壬排盘信息】
预测时间：${paipanResult.date}
日干支：${paipanResult.dayGanZhi}
时干支：${paipanResult.hourGanZhi}
月将：${paipanResult.monthJiang}

【四课】
${paipanResult.siKe.map((ke, i) => `${ke.name}：${ke.earthBranch}（地支） - ${ke.heavenlyStem}（天干）`).join('\n')}

【三传】
初传：${paipanResult.sanChuan.chu}
中传：${paipanResult.sanChuan.zhong}
末传：${paipanResult.sanChuan.mo}

【十二神】
${paipanResult.twelveGods.map(god => `${god.position}位：${god.god}`).join('\n')}

请从以下几个维度进行详细分析和预测：

1. **六壬盘象解读**
   - 分析日干支、时干支的五行属性和相互关系
   - 解读四课三传的含义和吉凶
   - 分析十二神的配置和暗示
   - 判断月将与当前盘面的匹配度

2. **大盘走势预测**
   - 预测下一个交易日的主要趋势（上涨/下跌/震荡）
   - 给出可能的涨跌幅度范围
   - 分析盘中可能出现的关键时点
   - 判断多空力量的强弱对比

3. **关键点位分析**
   - 上证指数的支撑位和压力位
   - 深证成指的支撑位和压力位
   - 可能的突破方向和力度

4. **板块机会提示**
   - 根据五行属性，推荐可能表现较好的行业板块
   - 提示需要规避的板块

5. **操作建议**
   - 给出具体的操作策略（进场/观望/减仓等）
   - 仓位控制建议
   - 风险提示和注意事项

6. **应验时间**
   - 预测何时可能出现转折
   - 关键时辰的判断

请结合六壬的传统智慧和现代股市技术分析，给出专业、详细的预测报告。

注意事项：
- 预测应具体、明确，避免模棱两可
- 必须给出明确的涨跌方向判断
- 提供具体的操作建议
- 所有预测仅供参考，投资者应理性决策

请以Markdown格式输出预测报告，使用适当的标题、列表和强调格式。`;
}
