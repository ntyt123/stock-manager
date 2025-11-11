/**
 * AI API配置管理模块
 */

// 辅助函数: API请求封装
async function fetchAPI(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            ...options.headers
        }
    };

    const response = await fetch(url, { ...options, headers: defaultOptions.headers });
    return await response.json();
}

const AIApiConfigManager = {
    configs: [],
    currentEditingId: null,

    /**
     * 初始化
     */
    async init() {
        console.log('📦 初始化AI API配置管理模块...');
        await this.loadConfigs();
        await this.loadActiveConfig();
        this.setupModelInputBehavior();
    },

    /**
     * 设置模型输入框行为
     */
    setupModelInputBehavior() {
        const modelInput = document.getElementById('configModel');
        if (!modelInput) return;

        // 当用户聚焦输入框时，如果为空则显示所有选项
        modelInput.addEventListener('focus', function() {
            // 在 Chrome/Edge 中，双击输入框可以显示 datalist
            if (this.value === '') {
                // 触发输入事件以显示所有选项
                this.value = ' ';
                setTimeout(() => {
                    this.value = '';
                    this.dispatchEvent(new Event('input', { bubbles: true }));
                }, 10);
            }
        });

        // 添加提示：用户可以直接开始输入来筛选
        modelInput.addEventListener('click', function() {
            const datalist = document.getElementById('modelList');
            if (datalist && datalist.options.length > 0 && this.value === '') {
                // 显示提示
                const hint = this.nextElementSibling;
                if (hint && hint.classList.contains('model-hint')) {
                    hint.style.display = 'block';
                    setTimeout(() => {
                        hint.style.display = 'none';
                    }, 3000);
                }
            }
        });
    },

    /**
     * 加载所有配置
     */
    async loadConfigs() {
        try {
            const response = await fetchAPI('/api/ai-api/configs');

            if (response.success) {
                this.configs = response.data;
                this.renderConfigsList();
            } else {
                throw new Error(response.error || '加载配置失败');
            }
        } catch (error) {
            console.error('❌ 加载API配置失败:', error);
            showNotification('加载API配置失败', 'error');
        }
    },

    /**
     * 加载当前激活的配置
     */
    async loadActiveConfig() {
        try {
            const response = await fetchAPI('/api/ai-api/configs/active/current');

            if (response.success && response.data) {
                this.renderActiveConfig(response.data);
            } else {
                document.getElementById('activeApiConfig').innerHTML = `
                    <span class="warning-text">暂无激活的配置</span>
                `;
            }
        } catch (error) {
            console.error('❌ 加载激活配置失败:', error);
        }
    },

    /**
     * 渲染激活的配置
     */
    renderActiveConfig(config) {
        const container = document.getElementById('activeApiConfig');
        container.innerHTML = `
            <div class="api-config-badge active">
                <div class="config-badge-header">
                    <span class="config-name">${config.name}</span>
                    <span class="config-provider">${this.getProviderName(config.provider)}</span>
                </div>
                <div class="config-badge-body">
                    <div class="config-info-item">
                        <span class="label">模型:</span>
                        <span class="value">${config.model}</span>
                    </div>
                    <div class="config-info-item">
                        <span class="label">API地址:</span>
                        <span class="value">${config.api_url}</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 渲染配置列表
     */
    renderConfigsList() {
        const container = document.getElementById('aiApiConfigsList');

        if (!this.configs || this.configs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无配置</p>
                    <button class="btn btn-primary" onclick="AIApiConfigManager.openCreateModal()">
                        ➕ 添加第一个配置
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.configs.map(config => `
            <div class="api-config-card ${config.is_active ? 'active' : ''}">
                <div class="config-card-header">
                    <div class="config-card-title">
                        <span class="config-name">${config.name}</span>
                        ${config.is_active ? '<span class="badge badge-success">激活中</span>' : ''}
                        ${config.is_default ? '<span class="badge badge-info">默认</span>' : ''}
                    </div>
                    <div class="config-card-actions">
                        ${!config.is_active ? `
                            <button class="btn-icon" onclick="AIApiConfigManager.activateConfig(${config.id})" title="激活">
                                ⚡
                            </button>
                        ` : ''}
                        <button class="btn-icon" onclick="AIApiConfigManager.testConfigById(${config.id})" title="测试">
                            🧪
                        </button>
                        <button class="btn-icon" onclick="AIApiConfigManager.editConfig(${config.id})" title="编辑">
                            ✏️
                        </button>
                        ${!config.is_default && !config.is_active ? `
                            <button class="btn-icon btn-icon-danger" onclick="AIApiConfigManager.deleteConfig(${config.id})" title="删除">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="config-card-body">
                    <div class="config-info-row">
                        <span class="config-label">提供商:</span>
                        <span class="config-value">${this.getProviderName(config.provider)}</span>
                    </div>
                    <div class="config-info-row">
                        <span class="config-label">模型:</span>
                        <span class="config-value">${config.model}</span>
                    </div>
                    <div class="config-info-row">
                        <span class="config-label">API地址:</span>
                        <span class="config-value config-url">${config.api_url}</span>
                    </div>
                    ${config.api_key ? `
                        <div class="config-info-row">
                            <span class="config-label">API密钥:</span>
                            <span class="config-value">${config.api_key}</span>
                        </div>
                    ` : ''}
                    ${config.description ? `
                        <div class="config-description">${config.description}</div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },

    /**
     * 打开创建配置模态框
     */
    openCreateModal() {
        this.currentEditingId = null;
        document.getElementById('aiApiConfigModalTitle').textContent = '🔌 添加AI API配置';
        document.getElementById('aiApiConfigForm').reset();
        document.getElementById('configId').value = '';
        document.getElementById('configTemperature').value = '0.7';
        document.getElementById('configMaxTokens').value = '2000';
        document.getElementById('configTimeout').value = '30000';
        document.getElementById('aiApiConfigModal').classList.add('show');
    },

    /**
     * 编辑配置
     */
    async editConfig(id) {
        try {
            const response = await fetchAPI(`/api/ai-api/configs/${id}`);

            if (!response.success) {
                throw new Error(response.error || '获取配置详情失败');
            }

            const config = response.data;
            this.currentEditingId = id;

            // 填充表单
            document.getElementById('aiApiConfigModalTitle').textContent = '🔌 编辑AI API配置';
            document.getElementById('configId').value = config.id;
            document.getElementById('configName').value = config.name;
            document.getElementById('configProvider').value = config.provider;
            document.getElementById('configApiUrl').value = config.api_url;
            document.getElementById('configApiKey').value = config.api_key || '';
            document.getElementById('configModel').value = config.model;
            document.getElementById('configTemperature').value = config.temperature;
            document.getElementById('configMaxTokens').value = config.max_tokens;
            document.getElementById('configTimeout').value = config.timeout;
            document.getElementById('configDescription').value = config.description || '';
            document.getElementById('configSetActive').checked = config.is_active;

            // 显示模态框
            document.getElementById('aiApiConfigModal').classList.add('show');

        } catch (error) {
            console.error('❌ 加载配置详情失败:', error);
            showNotification(error.message, 'error');
        }
    },

    /**
     * 关闭模态框
     */
    closeModal() {
        document.getElementById('aiApiConfigModal').classList.remove('show');
        this.currentEditingId = null;
    },

    /**
     * 当提供商选择改变时
     */
    onProviderChange() {
        const provider = document.getElementById('configProvider').value;
        const presets = {
            'deepseek': {
                api_url: 'https://api.deepseek.com/chat/completions',
                model: 'deepseek-chat'
            },
            'openai': {
                api_url: 'https://api.openai.com/v1/chat/completions',
                model: 'gpt-4'
            },
            'anthropic': {
                api_url: 'https://api.anthropic.com/v1/messages',
                model: 'claude-3-sonnet'
            },
            'gemini': {
                api_url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
                model: 'gemini-pro'
            }
        };

        if (presets[provider]) {
            document.getElementById('configApiUrl').value = presets[provider].api_url;
            document.getElementById('configModel').value = presets[provider].model;
        }
    },

    /**
     * 保存配置
     */
    async saveConfig(event) {
        event.preventDefault();

        const formData = {
            name: document.getElementById('configName').value.trim(),
            provider: document.getElementById('configProvider').value,
            api_url: document.getElementById('configApiUrl').value.trim(),
            api_key: document.getElementById('configApiKey').value.trim() || null,
            model: document.getElementById('configModel').value.trim(),
            temperature: parseFloat(document.getElementById('configTemperature').value),
            max_tokens: parseInt(document.getElementById('configMaxTokens').value),
            timeout: parseInt(document.getElementById('configTimeout').value),
            description: document.getElementById('configDescription').value.trim() || null
        };

        try {
            const configId = document.getElementById('configId').value;
            const isEdit = configId && configId !== '';
            const url = isEdit ? `/api/ai-api/configs/${configId}` : '/api/ai-api/configs';
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetchAPI(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.success) {
                throw new Error(response.error || '保存配置失败');
            }

            showNotification(response.message || '配置保存成功', 'success');
            this.closeModal();

            // 如果勾选了设为激活配置
            if (document.getElementById('configSetActive').checked) {
                await this.activateConfig(response.data.id);
            } else {
                await this.loadConfigs();
                await this.loadActiveConfig();
            }

        } catch (error) {
            console.error('❌ 保存配置失败:', error);
            showNotification(error.message, 'error');
        }
    },

    /**
     * 测试当前表单中的配置
     */
    async testConfig() {
        const formData = {
            api_url: document.getElementById('configApiUrl').value.trim(),
            api_key: document.getElementById('configApiKey').value.trim() || null,
            model: document.getElementById('configModel').value.trim(),
            temperature: parseFloat(document.getElementById('configTemperature').value),
            max_tokens: 50,
            timeout: parseInt(document.getElementById('configTimeout').value)
        };

        try {
            showNotification('正在测试配置...', 'info');

            const response = await fetchAPI('/api/ai-api/configs/test-custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.success && response.data.success) {
                showNotification(`✅ 测试成功! 响应时间: ${response.data.responseTime}ms`, 'success');
            } else {
                throw new Error(response.data.message || '测试失败');
            }

        } catch (error) {
            console.error('❌ 测试配置失败:', error);
            showNotification(`测试失败: ${error.message}`, 'error');
        }
    },

    /**
     * 测试已保存的配置
     */
    async testConfigById(id) {
        try {
            showNotification('正在测试配置...', 'info');

            const response = await fetchAPI(`/api/ai-api/configs/${id}/test`, {
                method: 'POST'
            });

            if (response.success && response.data.success) {
                showNotification(`✅ 测试成功! 响应时间: ${response.data.responseTime}ms`, 'success');
            } else {
                throw new Error(response.data.message || '测试失败');
            }

        } catch (error) {
            console.error('❌ 测试配置失败:', error);
            showNotification(`测试失败: ${error.message}`, 'error');
        }
    },

    /**
     * 激活配置
     */
    async activateConfig(id) {
        try {
            const response = await fetchAPI(`/api/ai-api/configs/${id}/activate`, {
                method: 'POST'
            });

            if (!response.success) {
                throw new Error(response.error || '激活配置失败');
            }

            showNotification(response.message || '配置已激活', 'success');
            await this.loadConfigs();
            await this.loadActiveConfig();

        } catch (error) {
            console.error('❌ 激活配置失败:', error);
            showNotification(error.message, 'error');
        }
    },

    /**
     * 删除配置
     */
    async deleteConfig(id) {
        if (!confirm('确定要删除这个配置吗?')) {
            return;
        }

        try {
            const response = await fetchAPI(`/api/ai-api/configs/${id}`, {
                method: 'DELETE'
            });

            if (!response.success) {
                throw new Error(response.error || '删除配置失败');
            }

            showNotification('配置已删除', 'success');
            await this.loadConfigs();

        } catch (error) {
            console.error('❌ 删除配置失败:', error);
            showNotification(error.message, 'error');
        }
    },

    /**
     * 获取API支持的模型列表
     */
    async fetchModels() {
        const apiUrl = document.getElementById('configApiUrl').value.trim();
        const apiKey = document.getElementById('configApiKey').value.trim();

        if (!apiUrl) {
            showNotification('请先填写API地址', 'warning');
            return;
        }

        const btn = document.querySelector('.btn-fetch-models');
        const btnIcon = btn.querySelector('.btn-icon');
        const btnText = btn.querySelector('.btn-text');
        const originalText = btnText.textContent;

        try {
            // 显示加载状态
            btn.disabled = true;
            btnIcon.textContent = '⏳';
            btnText.textContent = '加载中...';

            const response = await fetchAPI('/api/ai-api/fetch-models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_url: apiUrl,
                    api_key: apiKey || null
                })
            });

            if (response.success && response.data) {
                // 保存模型列表到内存
                this.availableModels = response.data;

                // 填充datalist
                const datalist = document.getElementById('modelList');
                datalist.innerHTML = '';

                response.data.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = `${model.id} (${model.owned_by})`;
                    datalist.appendChild(option);
                });

                showNotification(`成功加载 ${response.count} 个模型，清空输入框点击可查看`, 'success');

                // 清空输入框并聚焦，方便用户查看所有选项
                const modelInput = document.getElementById('configModel');
                modelInput.value = '';

                // 延迟聚焦以确保 datalist 已填充
                setTimeout(() => {
                    modelInput.focus();
                    // 触发输入事件以显示 datalist
                    modelInput.dispatchEvent(new Event('input', { bubbles: true }));
                }, 100);

                console.log(`✅ 成功加载 ${response.count} 个模型`);
            } else {
                throw new Error(response.error || '获取模型列表失败');
            }

        } catch (error) {
            console.error('❌ 获取模型列表失败:', error);
            showNotification(error.message || '获取模型列表失败', 'error');
        } finally {
            // 恢复按钮状态
            btn.disabled = false;
            btnIcon.textContent = '📋';
            btnText.textContent = originalText;
        }
    },

    /**
     * 获取提供商名称
     */
    getProviderName(provider) {
        const names = {
            'deepseek': 'DeepSeek',
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'gemini': 'Google Gemini',
            'custom': '自定义'
        };
        return names[provider] || provider;
    }
};

// 将 AIApiConfigManager 暴露到全局作用域
window.AIApiConfigManager = AIApiConfigManager;

// 页面加载完成后将模态框移动到body根部
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('aiApiConfigModal');
    if (modal && modal.parentElement.tagName !== 'BODY') {
        document.body.appendChild(modal);
        console.log('✅ AI API配置模态框已移动到body根部');
    }
});
