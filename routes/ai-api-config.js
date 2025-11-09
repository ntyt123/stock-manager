/**
 * AI API配置管理路由
 */

const express = require('express');
const { aiApiConfigModel } = require('../database');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 获取所有API配置列表
    router.get('/configs', authenticateToken, async (req, res) => {
        try {
            const configs = aiApiConfigModel.findAll();

            // 隐藏API密钥的部分内容
            const maskedConfigs = configs.map(config => ({
                ...config,
                api_key: config.api_key ? maskApiKey(config.api_key) : null,
                // 解析JSON字段
                custom_headers: config.custom_headers ? JSON.parse(config.custom_headers) : null,
                extra_config: config.extra_config ? JSON.parse(config.extra_config) : null
            }));

            res.json({
                success: true,
                data: maskedConfigs
            });
        } catch (error) {
            console.error('获取API配置列表失败:', error.message);
            res.status(500).json({
                success: false,
                error: '获取配置列表失败'
            });
        }
    });

    // 获取单个API配置详情
    router.get('/configs/:id', authenticateToken, async (req, res) => {
        try {
            const config = aiApiConfigModel.findById(parseInt(req.params.id));

            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: '配置不存在'
                });
            }

            // 解析JSON字段
            const configWithParsed = {
                ...config,
                custom_headers: config.custom_headers ? JSON.parse(config.custom_headers) : null,
                extra_config: config.extra_config ? JSON.parse(config.extra_config) : null
            };

            res.json({
                success: true,
                data: configWithParsed
            });
        } catch (error) {
            console.error('获取API配置详情失败:', error.message);
            res.status(500).json({
                success: false,
                error: '获取配置详情失败'
            });
        }
    });

    // 获取当前激活的配置
    router.get('/configs/active/current', authenticateToken, async (req, res) => {
        try {
            const config = aiApiConfigModel.getActiveConfig();

            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: '没有激活的配置'
                });
            }

            // 隐藏API密钥
            const maskedConfig = {
                ...config,
                api_key: config.api_key ? maskApiKey(config.api_key) : null,
                custom_headers: config.custom_headers ? JSON.parse(config.custom_headers) : null,
                extra_config: config.extra_config ? JSON.parse(config.extra_config) : null
            };

            res.json({
                success: true,
                data: maskedConfig
            });
        } catch (error) {
            console.error('获取激活配置失败:', error.message);
            res.status(500).json({
                success: false,
                error: '获取激活配置失败'
            });
        }
    });

    // 创建新的API配置
    router.post('/configs', authenticateToken, async (req, res) => {
        try {
            const config = req.body;

            // 验证必填字段
            if (!config.name || !config.provider || !config.api_url || !config.model) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必填字段: name, provider, api_url, model'
                });
            }

            const newConfig = aiApiConfigModel.create(config);

            console.log(`✅ 创建新API配置: ${newConfig.name} (ID: ${newConfig.id})`);

            res.json({
                success: true,
                data: newConfig,
                message: '配置创建成功'
            });
        } catch (error) {
            console.error('创建API配置失败:', error.message);
            res.status(500).json({
                success: false,
                error: '创建配置失败: ' + error.message
            });
        }
    });

    // 更新API配置
    router.put('/configs/:id', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const config = req.body;

            // 验证必填字段
            if (!config.name || !config.provider || !config.api_url || !config.model) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必填字段: name, provider, api_url, model'
                });
            }

            const updatedConfig = aiApiConfigModel.update(id, config);

            console.log(`✅ 更新API配置: ${updatedConfig.name} (ID: ${updatedConfig.id})`);

            res.json({
                success: true,
                data: updatedConfig,
                message: '配置更新成功'
            });
        } catch (error) {
            console.error('更新API配置失败:', error.message);
            res.status(500).json({
                success: false,
                error: '更新配置失败: ' + error.message
            });
        }
    });

    // 激活指定配置
    router.post('/configs/:id/activate', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const config = aiApiConfigModel.setActive(id);

            console.log(`✅ 激活API配置: ${config.name} (ID: ${config.id})`);

            res.json({
                success: true,
                data: config,
                message: `已激活配置: ${config.name}`
            });
        } catch (error) {
            console.error('激活API配置失败:', error.message);
            res.status(500).json({
                success: false,
                error: '激活配置失败: ' + error.message
            });
        }
    });

    // 设置默认配置
    router.post('/configs/:id/set-default', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const config = aiApiConfigModel.setDefault(id);

            console.log(`✅ 设置默认API配置: ${config.name} (ID: ${config.id})`);

            res.json({
                success: true,
                data: config,
                message: `已设置默认配置: ${config.name}`
            });
        } catch (error) {
            console.error('设置默认配置失败:', error.message);
            res.status(500).json({
                success: false,
                error: '设置默认配置失败: ' + error.message
            });
        }
    });

    // 删除API配置
    router.delete('/configs/:id', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            aiApiConfigModel.delete(id);

            console.log(`✅ 删除API配置 (ID: ${id})`);

            res.json({
                success: true,
                message: '配置删除成功'
            });
        } catch (error) {
            console.error('删除API配置失败:', error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 测试API配置
    router.post('/configs/:id/test', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const config = aiApiConfigModel.findById(id);

            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: '配置不存在'
                });
            }

            console.log(`🧪 测试API配置: ${config.name} (ID: ${config.id})`);

            const result = await aiApiConfigModel.testConfig(config);

            if (result.success) {
                console.log(`✅ 配置测试成功: ${config.name} (响应时间: ${result.responseTime}ms)`);
            } else {
                console.log(`❌ 配置测试失败: ${config.name} - ${result.message}`);
            }

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('测试API配置失败:', error.message);
            res.status(500).json({
                success: false,
                error: '测试配置失败: ' + error.message
            });
        }
    });

    // 测试自定义配置(不保存)
    router.post('/configs/test-custom', authenticateToken, async (req, res) => {
        try {
            const config = req.body;

            // 验证必填字段
            if (!config.api_url || !config.model) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必填字段: api_url, model'
                });
            }

            console.log(`🧪 测试自定义配置`);

            const result = await aiApiConfigModel.testConfig(config);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('测试自定义配置失败:', error.message);
            res.status(500).json({
                success: false,
                error: '测试配置失败: ' + error.message
            });
        }
    });

    // 获取API提供商预设列表
    router.get('/providers', authenticateToken, async (req, res) => {
        res.json({
            success: true,
            data: [
                {
                    id: 'deepseek',
                    name: 'DeepSeek',
                    api_url: 'https://api.deepseek.com/chat/completions',
                    models: ['deepseek-chat', 'deepseek-coder'],
                    default_model: 'deepseek-chat'
                },
                {
                    id: 'openai',
                    name: 'OpenAI',
                    api_url: 'https://api.openai.com/v1/chat/completions',
                    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
                    default_model: 'gpt-4'
                },
                {
                    id: 'anthropic',
                    name: 'Anthropic Claude',
                    api_url: 'https://api.anthropic.com/v1/messages',
                    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
                    default_model: 'claude-3-sonnet'
                },
                {
                    id: 'custom',
                    name: '自定义API',
                    api_url: '',
                    models: [],
                    default_model: ''
                }
            ]
        });
    });

    // 获取指定API的模型列表
    router.post('/fetch-models', authenticateToken, async (req, res) => {
        const { api_url, api_key } = req.body;

        if (!api_url) {
            return res.status(400).json({
                success: false,
                error: 'API地址不能为空'
            });
        }

        try {
            const axios = require('axios');

            // 从完整URL中提取基础URL
            // 例如: https://api.example.com/v1/chat/completions -> https://api.example.com/v1
            let baseUrl = api_url;
            if (api_url.includes('/chat/completions')) {
                baseUrl = api_url.replace('/chat/completions', '');
            } else if (api_url.includes('/completions')) {
                baseUrl = api_url.replace('/completions', '');
            }

            const modelsUrl = `${baseUrl}/models`;
            console.log(`📡 获取模型列表: ${modelsUrl}`);

            const headers = {
                'Content-Type': 'application/json'
            };

            if (api_key) {
                headers['Authorization'] = `Bearer ${api_key}`;
            }

            const response = await axios.get(modelsUrl, {
                headers,
                timeout: 10000
            });

            // 解析OpenAI格式的模型列表
            if (response.data && response.data.data && Array.isArray(response.data.data)) {
                const models = response.data.data.map(model => ({
                    id: model.id,
                    name: model.id,
                    owned_by: model.owned_by || 'unknown'
                }));

                console.log(`✅ 成功获取 ${models.length} 个模型`);

                res.json({
                    success: true,
                    data: models,
                    count: models.length
                });
            } else {
                throw new Error('API响应格式不符合预期');
            }

        } catch (error) {
            console.error('❌ 获取模型列表失败:', error.message);

            let errorMessage = '获取模型列表失败';

            if (error.response) {
                if (error.response.status === 401) {
                    errorMessage = 'API密钥验证失败';
                } else if (error.response.status === 404) {
                    errorMessage = '该API不支持查询模型列表';
                } else {
                    errorMessage = `API错误: ${error.response.status}`;
                }
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = '请求超时';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = '无法连接到API';
            }

            res.status(500).json({
                success: false,
                error: errorMessage,
                details: error.message
            });
        }
    });

    return router;
};

/**
 * 掩码API密钥，只显示前后几位
 */
function maskApiKey(apiKey) {
    if (!apiKey || apiKey.length <= 10) {
        return '***';
    }
    const start = apiKey.substring(0, 7);
    const end = apiKey.substring(apiKey.length - 4);
    return `${start}...${end}`;
}
