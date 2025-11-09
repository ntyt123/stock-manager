const express = require('express');
const axios = require('axios');
const { aiPromptTemplateModel, aiApiConfigModel } = require('../database');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // AI聊天API路由（支持多种AI服务商）
    router.post('/chat', authenticateToken, async (req, res) => {
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                error: '消息内容不能为空'
            });
        }

        try {
            // 获取当前激活的API配置
            const apiConfig = aiApiConfigModel.getActiveConfig();

            if (!apiConfig) {
                return res.status(500).json({
                    success: false,
                    error: '系统未配置AI接口，请联系管理员'
                });
            }

            console.log(`📤 使用AI配置: ${apiConfig.name} (${apiConfig.provider})`);
            console.log('📤 发送AI请求:', message.substring(0, 50) + '...');

            // 从数据库获取AI聊天的自定义提示词模板
            let systemPrompt = '你是一位专业的股票投资顾问助手。你需要为用户提供专业的投资建议、市场分析和风险提示。请用简洁、专业的语言回答用户的问题。注意：你的建议仅供参考，不构成具体的投资建议。';

            try {
                const template = await aiPromptTemplateModel.findBySceneType('ai_chat');
                if (template && template.is_active) {
                    systemPrompt = template.system_prompt;
                    console.log('✅ 使用自定义提示词模板: ai_chat');
                } else {
                    console.log('ℹ️ 使用默认提示词（未找到或未启用自定义模板）');
                }
            } catch (err) {
                console.warn('⚠️ 获取自定义提示词失败，使用默认提示词:', err.message);
            }

            // 打印提示词
            console.log('📝 ==================== AI投资助手提示词 ====================');
            console.log('System Prompt:', systemPrompt);
            console.log('User Message:', message);
            console.log('📝 ============================================================');

            // 判断是否是Gemini API
            const isGemini = apiConfig.api_url.includes('generativelanguage.googleapis.com') ||
                            apiConfig.provider === 'gemini';

            let aiResponse;

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
                            text: `${systemPrompt}\n\n用户问题：${message}`
                        }]
                    }],
                    generationConfig: {
                        temperature: apiConfig.temperature || 0.7,
                        maxOutputTokens: apiConfig.max_tokens || 2000,
                        topK: 40,
                        topP: 0.95
                    }
                };

                const response = await axios.post(apiUrl, requestBody, {
                    headers,
                    timeout: apiConfig.timeout || 30000
                });

                // 解析Gemini响应
                if (response.data && response.data.candidates && response.data.candidates.length > 0) {
                    const candidate = response.data.candidates[0];
                    if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                        aiResponse = candidate.content.parts[0].text;
                    } else {
                        throw new Error('Gemini API响应格式异常');
                    }
                } else {
                    throw new Error('Gemini API响应格式异常');
                }

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
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: message
                        }
                    ],
                    stream: false,
                    temperature: apiConfig.temperature || 0.7,
                    max_tokens: apiConfig.max_tokens || 2000
                };

                const response = await axios.post(apiConfig.api_url, requestBody, {
                    headers,
                    timeout: apiConfig.timeout || 30000
                });

                // 解析OpenAI格式响应
                if (response.data && response.data.choices && response.data.choices.length > 0) {
                    aiResponse = response.data.choices[0].message.content;
                } else {
                    throw new Error('AI响应格式异常');
                }
            }

            console.log('✅ AI响应成功');

            res.json({
                success: true,
                data: {
                    message: aiResponse,
                    model: apiConfig.model,
                    provider: apiConfig.provider,
                    timestamp: new Date().toISOString(),
                    prompt: {
                        system: systemPrompt,
                        user: message
                    }
                }
            });

        } catch (error) {
            console.error('❌ AI API错误:', error.message);

            let errorMessage = '抱歉，AI服务暂时不可用，请稍后重试。';

            if (error.response) {
                console.error('API错误响应:', error.response.data);
                if (error.response.status === 401) {
                    errorMessage = 'API密钥验证失败';
                } else if (error.response.status === 429) {
                    errorMessage = 'API请求频率超限，请稍后重试';
                } else if (error.response.status === 500) {
                    errorMessage = 'AI服务器错误，请稍后重试';
                }
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = '请求超时，请检查网络连接';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = '无法连接到AI服务，请检查网络';
            }

            res.status(500).json({
                success: false,
                error: errorMessage
            });
        }
    });

    return router;
};
