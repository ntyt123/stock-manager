// ==================== AI提示词管理模块 ====================
// 管理所有AI场景的提示词模板

const AIPromptManager = {
    templates: [],
    currentEditingTemplate: null,

    // 定义所有场景通用的完整可用变量列表
    allAvailableVariables: [
        // 用户相关
        {
            name: '用户消息',
            key: 'message',
            type: 'text',
            category: '用户输入',
            description: '用户输入的问题或咨询内容',
            recommendedFor: ['ai_chat']
        },

        // 时间相关
        {
            name: '当前日期',
            key: 'date',
            type: 'text',
            category: '时间',
            description: '当前日期（格式：YYYY-MM-DD）',
            recommendedFor: ['portfolio_analysis', 'call_auction_analysis', 'stock_recommendation']
        },
        {
            name: '当前时间',
            key: 'time',
            type: 'text',
            category: '时间',
            description: '当前时间（格式：HH:MM:SS）',
            recommendedFor: ['portfolio_analysis']
        },

        // 持仓相关
        {
            name: '持仓数据',
            key: 'positions',
            type: 'text',
            category: '持仓',
            description: '用户当前持仓数据（包含股票代码、名称、数量、成本价、当前价、市值、盈亏等）',
            recommendedFor: ['portfolio_analysis', 'stock_recommendation']
        },
        {
            name: '总资金',
            key: 'total_capital',
            type: 'number',
            category: '持仓',
            description: '用户的总投资资金',
            recommendedFor: ['portfolio_analysis', 'stock_recommendation']
        },
        {
            name: '盈亏情况',
            key: 'profit_loss',
            type: 'text',
            category: '持仓',
            description: '持仓盈亏详情（总盈亏、盈亏率等）',
            recommendedFor: ['portfolio_analysis']
        },

        // 市场相关
        {
            name: '市场指数',
            key: 'indices',
            type: 'text',
            category: '市场',
            description: '主要市场指数数据（上证指数、深证成指、创业板指的当前价、涨跌幅等）',
            recommendedFor: ['call_auction_analysis', 'stock_recommendation']
        },
        {
            name: '市场数据',
            key: 'market_data',
            type: 'text',
            category: '市场',
            description: '市场整体数据（涨跌比例、成交量、成交额等）',
            recommendedFor: ['call_auction_analysis']
        },

        // 自选股相关
        {
            name: '自选股列表',
            key: 'watchlist',
            type: 'text',
            category: '自选股',
            description: '用户自选股列表（股票代码、名称、当前价格等）',
            recommendedFor: ['stock_recommendation']
        },

        // 交易相关
        {
            name: '交易记录',
            key: 'trade_records',
            type: 'text',
            category: '交易',
            description: '最近的交易记录（买入、卖出操作）',
            recommendedFor: ['portfolio_analysis']
        },

        // 六壬排盘相关
        {
            name: '预测时间',
            key: 'prediction_time',
            type: 'text',
            category: '六壬排盘',
            description: '六壬排盘的预测时间',
            recommendedFor: ['market_prediction']
        },
        {
            name: '日干支',
            key: 'day_ganzhi',
            type: 'text',
            category: '六壬排盘',
            description: '日干支（天干地支）',
            recommendedFor: ['market_prediction']
        },
        {
            name: '时干支',
            key: 'hour_ganzhi',
            type: 'text',
            category: '六壬排盘',
            description: '时干支（天干地支）',
            recommendedFor: ['market_prediction']
        },
        {
            name: '月将',
            key: 'month_jiang',
            type: 'text',
            category: '六壬排盘',
            description: '月将信息',
            recommendedFor: ['market_prediction']
        },
        {
            name: '四课',
            key: 'sike',
            type: 'text',
            category: '六壬排盘',
            description: '四课信息（第一课至第四课）',
            recommendedFor: ['market_prediction']
        },
        {
            name: '三传',
            key: 'sanchuan',
            type: 'text',
            category: '六壬排盘',
            description: '三传信息（初传、中传、末传）',
            recommendedFor: ['market_prediction']
        },
        {
            name: '十二神',
            key: 'twelve_gods',
            type: 'text',
            category: '六壬排盘',
            description: '十二神信息（六合、勾陈等）',
            recommendedFor: ['market_prediction', 'stock_trend_prediction']
        },

        // 趋势分析相关
        {
            name: '股票代码',
            key: 'stock_code',
            type: 'text',
            category: '股票信息',
            description: '股票代码（如: 600036）',
            recommendedFor: ['trend_prediction', 'stock_trend_prediction']
        },
        {
            name: '股票名称',
            key: 'stock_name',
            type: 'text',
            category: '股票信息',
            description: '股票名称（如: 招商银行）',
            recommendedFor: ['trend_prediction', 'stock_trend_prediction']
        },
        {
            name: '预测日期',
            key: 'prediction_date',
            type: 'text',
            category: '时间',
            description: '预测的目标日期',
            recommendedFor: ['trend_prediction']
        },
        {
            name: '交易日状态',
            key: 'trading_day_status',
            type: 'text',
            category: '时间',
            description: '当前是否为交易日的状态描述',
            recommendedFor: ['trend_prediction']
        }
    ],

    // 场景推荐变量映射（用于标注推荐使用）
    sceneRecommendedVariables: {
        'ai_chat': ['message'],
        'portfolio_analysis': ['positions', 'total_capital', 'profit_loss', 'date', 'time'],
        'call_auction_analysis': ['date', 'indices', 'market_data'],
        'stock_recommendation': ['date', 'indices', 'positions', 'total_capital', 'watchlist'],
        'market_prediction': ['prediction_time', 'day_ganzhi', 'hour_ganzhi', 'month_jiang', 'sike', 'sanchuan', 'twelve_gods'],
        'trend_prediction': ['stock_code', 'stock_name', 'prediction_date', 'trading_day_status'],
        'stock_trend_prediction': ['stock_code', 'stock_name', 'prediction_time', 'day_ganzhi', 'hour_ganzhi', 'month_jiang', 'sike', 'sanchuan', 'twelve_gods']
    },

    // 初始化（由SettingsManager调用）
    async init() {
        await this.loadTemplates();
        this.renderTemplatesList();
    },

    // 加载所有提示词模板
    async loadTemplates() {
        try {
            const response = await fetch('/api/ai-prompts', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('加载提示词模板失败');
            }

            const result = await response.json();
            this.templates = result.data || [];
        } catch (error) {
            console.error('加载提示词模板失败:', error);
            UIUtils.showToast('加载提示词模板失败', 'error');
        }
    },

    // 渲染提示词模板列表
    renderTemplatesList() {
        const container = document.getElementById('aiPromptsList');
        if (!container) return;

        if (this.templates.length === 0) {
            container.innerHTML = '<div class="loading-text">暂无提示词模板</div>';
            return;
        }

        // 按类别分组
        const categories = {};
        this.templates.forEach(template => {
            if (!categories[template.category]) {
                categories[template.category] = [];
            }
            categories[template.category].push(template);
        });

        let html = '';

        // 遍历每个类别
        for (const [category, templates] of Object.entries(categories)) {
            html += `
                <div class="prompt-category">
                    <div class="prompt-category-title">${this.getCategoryName(category)}</div>
                    <div class="prompt-templates-grid">
            `;

            templates.forEach(template => {
                const statusClass = template.is_active ? 'active' : 'inactive';
                const statusText = template.is_active ? '已启用' : '已禁用';

                html += `
                    <div class="prompt-template-card ${statusClass}" data-template-id="${template.id}">
                        <div class="template-header">
                            <div class="template-info">
                                <div class="template-name">${template.scene_name}</div>
                                <div class="template-type">${template.scene_type}</div>
                            </div>
                            <div class="template-status status-${statusClass}">${statusText}</div>
                        </div>
                        <div class="template-description">${template.description || '暂无描述'}</div>
                        <div class="template-variables">
                            <span class="variables-label">可用变量:</span>
                            ${this.renderVariablesPreview(template.variables)}
                        </div>
                        <div class="template-actions">
                            <button class="template-action-btn" onclick="AIPromptManager.editTemplate(${template.id})">
                                <span>✏️ 编辑</span>
                            </button>
                            <button class="template-action-btn" onclick="AIPromptManager.toggleTemplate(${template.id}, ${!template.is_active})">
                                <span>${template.is_active ? '🚫 禁用' : '✅ 启用'}</span>
                            </button>
                            <button class="template-action-btn" onclick="AIPromptManager.resetTemplate(${template.id})">
                                <span>🔄 重置</span>
                            </button>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    // 获取类别名称
    getCategoryName(category) {
        const categoryNames = {
            'chat': '💬 对话分析',
            'analysis': '📊 数据分析',
            'recommendation': '💡 推荐建议',
            'prediction': '🔮 预测分析'
        };
        return categoryNames[category] || category;
    },

    // 渲染变量预览
    renderVariablesPreview(variables) {
        try {
            // 解析 JSON 字符串
            const parsedVars = typeof variables === 'string' ? JSON.parse(variables) : variables;

            if (!parsedVars || parsedVars.length === 0) {
                return '<span class="no-variables">无</span>';
            }

            // 提取变量的 key 字段
            const variableKeys = parsedVars.map(v => v.key || v);
            const preview = variableKeys.slice(0, 3).map(key => `<code>{${key}}</code>`).join(' ');
            const more = variableKeys.length > 3 ? `<span class="more-variables">+${variableKeys.length - 3}</span>` : '';
            return preview + more;
        } catch (error) {
            console.error('解析变量失败:', error);
            return '<span class="no-variables">解析失败</span>';
        }
    },

    // 编辑提示词模板
    async editTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) {
            UIUtils.showToast('模板不存在', 'error');
            return;
        }

        this.currentEditingTemplate = template;
        this.showEditModal(template);
    },

    // 显示编辑模态框
    showEditModal(template) {
        // 创建编辑模态框（如果不存在）
        let modal = document.getElementById('aiPromptEditModal');
        if (!modal) {
            this.createEditModal();
            modal = document.getElementById('aiPromptEditModal');
        }

        // 填充表单数据
        document.getElementById('promptSceneName').textContent = template.scene_name;
        document.getElementById('promptSceneType').textContent = template.scene_type;
        document.getElementById('promptCategory').textContent = this.getCategoryName(template.category);
        document.getElementById('promptSystemPrompt').value = template.system_prompt;
        document.getElementById('promptUserTemplate').value = template.user_prompt_template;
        document.getElementById('promptDescription').value = template.description || '';

        // 根据场景类型渲染固定的可用变量
        this.renderAvailableVariables(template.scene_type);

        // 显示模态框
        modal.style.display = 'flex';
    },

    // 创建编辑模态框
    createEditModal() {
        const modalHTML = `
            <div id="aiPromptEditModal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 1400px; width: 95%; max-height: 92vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h3>✏️ 编辑AI提示词</h3>
                        <button class="close-btn" onclick="AIPromptManager.closeEditModal()">×</button>
                    </div>

                    <div class="modal-body">
                        <div class="prompt-edit-info">
                            <div class="info-item">
                                <span class="info-label">场景名称:</span>
                                <span class="info-value" id="promptSceneName">--</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">场景类型:</span>
                                <span class="info-value" id="promptSceneType">--</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">分类:</span>
                                <span class="info-value" id="promptCategory">--</span>
                            </div>
                        </div>

                        <div class="prompt-edit-layout">
                            <!-- 左侧：编辑区域 -->
                            <div class="prompt-edit-left">
                                <div class="form-group">
                                    <label for="promptSystemPrompt">系统提示词 *</label>
                                    <div class="prompt-help">
                                        定义AI的角色、能力和行为规范
                                    </div>
                                    <textarea id="promptSystemPrompt" class="form-textarea" rows="8" required></textarea>
                                </div>

                                <div class="form-group">
                                    <label for="promptUserTemplate">用户提示词模板 *</label>
                                    <div class="prompt-help">
                                        定义用户输入的模板，可使用变量如 {positions}, {watchlist} 等
                                    </div>
                                    <textarea id="promptUserTemplate" class="form-textarea" rows="16" required></textarea>
                                </div>

                                <div class="form-group">
                                    <label for="promptDescription">描述</label>
                                    <textarea id="promptDescription" class="form-textarea" rows="3" placeholder="简要描述此提示词的用途和特点"></textarea>
                                </div>

                                <div id="promptEditStatus" class="form-status"></div>
                            </div>

                            <!-- 右侧：变量选择区域 -->
                            <div class="prompt-edit-right">
                                <div class="variables-panel">
                                    <div class="variables-panel-header">
                                        <h4>📋 可用变量</h4>
                                        <span class="variables-count" id="variablesCount">10个变量</span>
                                    </div>
                                    <div class="variables-info">
                                        💡 <strong>所有变量均可使用</strong>，⭐ 推荐标识表示本场景常用变量
                                    </div>
                                    <div id="availableVariables" class="variables-grid">
                                        <div class="loading-text">加载中...</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="action-btn secondary" onclick="AIPromptManager.closeEditModal()">取消</button>
                        <button class="action-btn" onclick="AIPromptManager.saveTemplate()">
                            <span>💾 保存</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    // 渲染可用变量（显示所有变量，标注推荐变量）
    renderAvailableVariables(sceneType) {
        const container = document.getElementById('availableVariables');
        if (!container) return;

        const recommendedVars = this.sceneRecommendedVariables[sceneType] || [];

        // 按类别分组
        const categorizedVars = {};
        this.allAvailableVariables.forEach(variable => {
            if (!categorizedVars[variable.category]) {
                categorizedVars[variable.category] = [];
            }
            categorizedVars[variable.category].push(variable);
        });

        let html = '';

        // 遍历每个类别
        for (const [category, variables] of Object.entries(categorizedVars)) {
            html += `
                <div class="variable-category">
                    <div class="variable-category-title">${this.getCategoryIcon(category)} ${category}</div>
                    <div class="variable-category-grid">
            `;

            variables.forEach(variable => {
                const isRecommended = recommendedVars.includes(variable.key);
                const recommendedBadge = isRecommended
                    ? '<span class="var-recommended-badge">⭐ 推荐</span>'
                    : '<span class="var-optional-badge">可选</span>';

                const typeBadge = variable.type === 'number'
                    ? '<span class="var-type-badge type-number">数字</span>'
                    : '<span class="var-type-badge type-text">文本</span>';

                html += `
                    <div class="variable-card ${isRecommended ? 'recommended' : ''}" onclick="AIPromptManager.insertVariable('{${variable.key}}')">
                        <div class="variable-header">
                            <div class="variable-name">{${variable.key}}</div>
                            <div class="variable-badges">
                                ${recommendedBadge}
                                ${typeBadge}
                            </div>
                        </div>
                        <div class="variable-label">${variable.name}</div>
                        <div class="variable-desc">${variable.description}</div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    // 获取分类图标
    getCategoryIcon(category) {
        const icons = {
            '用户输入': '💬',
            '时间': '⏰',
            '持仓': '📊',
            '市场': '📈',
            '自选股': '⭐',
            '交易': '💰',
            '六壬排盘': '🔮'
        };
        return icons[category] || '📋';
    },

    // 插入变量到光标位置
    insertVariable(variable) {
        const textarea = document.getElementById('promptUserTemplate');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        textarea.value = text.substring(0, start) + variable + text.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();

        UIUtils.showToast('变量已插入', 'success');
    },

    // 保存提示词模板
    async saveTemplate() {
        if (!this.currentEditingTemplate) return;

        const systemPrompt = document.getElementById('promptSystemPrompt').value.trim();
        const userTemplate = document.getElementById('promptUserTemplate').value.trim();
        const description = document.getElementById('promptDescription').value.trim();

        if (!systemPrompt || !userTemplate) {
            UIUtils.showToast('系统提示词和用户模板不能为空', 'error');
            return;
        }

        const statusEl = document.getElementById('promptEditStatus');
        statusEl.innerHTML = '<div class="loading-text">正在保存...</div>';

        try {
            const response = await fetch(`/api/ai-prompts/${this.currentEditingTemplate.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    system_prompt: systemPrompt,
                    user_prompt_template: userTemplate,
                    description: description
                })
            });

            if (!response.ok) {
                throw new Error('保存提示词失败');
            }

            const result = await response.json();
            UIUtils.showToast('提示词保存成功', 'success');

            // 重新加载模板列表
            await this.loadTemplates();
            this.renderTemplatesList();
            this.closeEditModal();

        } catch (error) {
            console.error('保存提示词失败:', error);
            statusEl.innerHTML = '<div class="error-text">保存失败: ' + error.message + '</div>';
        }
    },

    // 关闭编辑模态框
    closeEditModal() {
        const modal = document.getElementById('aiPromptEditModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentEditingTemplate = null;
    },

    // 切换模板状态
    async toggleTemplate(templateId, isActive) {
        try {
            const response = await fetch(`/api/ai-prompts/${templateId}/toggle`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ is_active: isActive })
            });

            if (!response.ok) {
                throw new Error('切换状态失败');
            }

            UIUtils.showToast(isActive ? '模板已启用' : '模板已禁用', 'success');

            // 重新加载模板列表
            await this.loadTemplates();
            this.renderTemplatesList();

        } catch (error) {
            console.error('切换模板状态失败:', error);
            UIUtils.showToast('切换状态失败', 'error');
        }
    },

    // 重置提示词模板
    async resetTemplate(templateId) {
        if (!confirm('确定要将此提示词重置为默认值吗？此操作不可撤销。')) {
            return;
        }

        try {
            const response = await fetch(`/api/ai-prompts/${templateId}/reset`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('重置失败');
            }

            UIUtils.showToast('提示词已重置为默认值', 'success');

            // 重新加载模板列表
            await this.loadTemplates();
            this.renderTemplatesList();

        } catch (error) {
            console.error('重置提示词失败:', error);
            UIUtils.showToast('重置失败', 'error');
        }
    }
};

// 导出给SettingsManager使用
window.AIPromptManager = AIPromptManager;
