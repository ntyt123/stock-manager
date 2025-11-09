/**
 * AI API配置数据模型
 */

const { db } = require('../connection');

const aiApiConfigModel = {
    /**
     * 获取所有API配置
     */
    findAll() {
        const stmt = db.prepare(`
            SELECT * FROM ai_api_configs
            ORDER BY is_active DESC, is_default DESC, created_at DESC
        `);
        return stmt.all();
    },

    /**
     * 根据ID获取配置
     */
    findById(id) {
        const stmt = db.prepare('SELECT * FROM ai_api_configs WHERE id = ?');
        return stmt.get(id);
    },

    /**
     * 获取当前激活的配置
     */
    getActiveConfig() {
        const stmt = db.prepare('SELECT * FROM ai_api_configs WHERE is_active = 1 LIMIT 1');
        return stmt.get();
    },

    /**
     * 获取默认配置
     */
    getDefaultConfig() {
        const stmt = db.prepare('SELECT * FROM ai_api_configs WHERE is_default = 1 LIMIT 1');
        return stmt.get();
    },

    /**
     * 创建新配置
     */
    create(config) {
        const stmt = db.prepare(`
            INSERT INTO ai_api_configs (
                name, provider, api_url, api_key, model,
                temperature, max_tokens, timeout,
                is_active, is_default,
                custom_headers, custom_request_transform, custom_response_transform,
                description, extra_config
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            config.name,
            config.provider,
            config.api_url,
            config.api_key || null,
            config.model,
            config.temperature || 0.7,
            config.max_tokens || 2000,
            config.timeout || 30000,
            config.is_active || 0,
            config.is_default || 0,
            config.custom_headers ? JSON.stringify(config.custom_headers) : null,
            config.custom_request_transform || null,
            config.custom_response_transform || null,
            config.description || null,
            config.extra_config ? JSON.stringify(config.extra_config) : null
        );

        return this.findById(result.lastInsertRowid);
    },

    /**
     * 更新配置
     */
    update(id, config) {
        const stmt = db.prepare(`
            UPDATE ai_api_configs
            SET name = ?,
                provider = ?,
                api_url = ?,
                api_key = ?,
                model = ?,
                temperature = ?,
                max_tokens = ?,
                timeout = ?,
                custom_headers = ?,
                custom_request_transform = ?,
                custom_response_transform = ?,
                description = ?,
                extra_config = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(
            config.name,
            config.provider,
            config.api_url,
            config.api_key || null,
            config.model,
            config.temperature || 0.7,
            config.max_tokens || 2000,
            config.timeout || 30000,
            config.custom_headers ? JSON.stringify(config.custom_headers) : null,
            config.custom_request_transform || null,
            config.custom_response_transform || null,
            config.description || null,
            config.extra_config ? JSON.stringify(config.extra_config) : null,
            id
        );

        return this.findById(id);
    },

    /**
     * 激活指定配置(同时取消其他配置的激活状态)
     */
    setActive(id) {
        // 先取消所有配置的激活状态
        db.prepare('UPDATE ai_api_configs SET is_active = 0').run();

        // 激活指定配置
        const stmt = db.prepare('UPDATE ai_api_configs SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        stmt.run(id);

        return this.findById(id);
    },

    /**
     * 设置默认配置
     */
    setDefault(id) {
        // 先取消所有配置的默认状态
        db.prepare('UPDATE ai_api_configs SET is_default = 0').run();

        // 设置指定配置为默认
        const stmt = db.prepare('UPDATE ai_api_configs SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        stmt.run(id);

        return this.findById(id);
    },

    /**
     * 删除配置
     */
    delete(id) {
        // 不允许删除默认配置或激活的配置
        const config = this.findById(id);
        if (!config) {
            throw new Error('配置不存在');
        }

        if (config.is_default) {
            throw new Error('不能删除默认配置');
        }

        if (config.is_active) {
            throw new Error('不能删除当前激活的配置，请先激活其他配置');
        }

        const stmt = db.prepare('DELETE FROM ai_api_configs WHERE id = ?');
        return stmt.run(id);
    },

    /**
     * 测试API配置是否可用
     * @param {Object} config - API配置对象
     * @returns {Promise<Object>} 测试结果
     */
    async testConfig(config) {
        const axios = require('axios');

        try {
            // 构建请求头
            const headers = {
                'Content-Type': 'application/json'
            };

            // 添加API密钥
            if (config.api_key) {
                headers['Authorization'] = `Bearer ${config.api_key}`;
            }

            // 添加自定义请求头
            if (config.custom_headers) {
                const customHeaders = typeof config.custom_headers === 'string'
                    ? JSON.parse(config.custom_headers)
                    : config.custom_headers;
                Object.assign(headers, customHeaders);
            }

            // 构建请求体
            const requestBody = {
                model: config.model,
                messages: [
                    {
                        role: 'user',
                        content: '你好，请回复"测试成功"'
                    }
                ],
                temperature: config.temperature || 0.7,
                max_tokens: 50
            };

            // 发送测试请求
            const startTime = Date.now();
            const response = await axios.post(config.api_url, requestBody, {
                headers,
                timeout: config.timeout || 30000
            });
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            // 验证响应格式
            if (response.data && response.data.choices && response.data.choices.length > 0) {
                return {
                    success: true,
                    message: '配置测试成功',
                    responseTime: responseTime,
                    response: response.data.choices[0].message.content
                };
            } else {
                return {
                    success: false,
                    message: 'API响应格式不符合预期',
                    responseTime: responseTime
                };
            }

        } catch (error) {
            let errorMessage = '测试失败';

            if (error.response) {
                errorMessage = `API返回错误: ${error.response.status} - ${error.response.statusText}`;
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = '请求超时';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = '无法连接到API服务器';
            } else {
                errorMessage = error.message;
            }

            return {
                success: false,
                message: errorMessage,
                error: error.message
            };
        }
    }
};

module.exports = aiApiConfigModel;
