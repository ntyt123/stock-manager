const express = require('express');
const axios = require('axios');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // DeepSeek AI API路由
    router.post('/chat', authenticateToken, async (req, res) => {
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                error: '消息内容不能为空'
            });
        }

        try {
            console.log('📤 发送AI请求到DeepSeek:', message.substring(0, 50) + '...');

            const response = await axios.post('https://api.deepseek.com/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: '你是一位专业的股票投资顾问助手。你需要为用户提供专业的投资建议、市场分析和风险提示。请用简洁、专业的语言回答用户的问题。注意：你的建议仅供参考，不构成具体的投资建议。'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                stream: false,
                temperature: 0.7,
                max_tokens: 2000
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer sk-4196cd3ad726465581d70a9791fcbb23'
                },
                timeout: 30000
            });

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const aiResponse = response.data.choices[0].message.content;
                console.log('✅ DeepSeek AI响应成功');

                res.json({
                    success: true,
                    data: {
                        message: aiResponse,
                        model: 'deepseek-chat',
                        timestamp: new Date().toISOString()
                    }
                });
            } else {
                throw new Error('AI响应格式异常');
            }

        } catch (error) {
            console.error('❌ DeepSeek API错误:', error.message);

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
