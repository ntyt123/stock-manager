// ==================== 风险控制管理器 ====================

const RiskControlManager = {
    // 当前风险状态
    currentRiskStatus: null,

    // 加载风险控制页面
    async loadRiskControl() {
        console.log('📊 加载风险控制功能...');

        // 并行加载风险规则和风险检查
        await Promise.all([
            this.loadRiskRules(),
            this.checkRisk()
        ]);
    },

    // 加载风险控制规则
    async loadRiskRules() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('未登录，跳过加载风险规则');
            return null;
        }

        try {
            const response = await fetch('/api/risk-control/rules', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();
            if (result.success) {
                return result.data.rules;
            }
        } catch (error) {
            console.error('❌ 加载风险规则失败:', error);
        }
        return null;
    },

    // 保存风险控制规则
    async saveRiskRules(rules) {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('请先登录', 'error');
            return false;
        }

        try {
            const response = await fetch('/api/risk-control/rules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ rules })
            });

            const result = await response.json();
            if (result.success) {
                showNotification('风险规则保存成功', 'success');
                return true;
            } else {
                showNotification(result.error || '保存失败', 'error');
                return false;
            }
        } catch (error) {
            console.error('❌ 保存风险规则失败:', error);
            showNotification('保存失败', 'error');
            return false;
        }
    },

    // 检查风险状态
    async checkRisk() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('未登录，跳过风险检查');
            this.displayNoLogin();
            return;
        }

        const container = document.getElementById('riskControlContent');
        if (!container) return;

        // 显示加载状态
        container.innerHTML = `
            <div class="loading-text">
                <div class="loading-spinner"></div>
                <span>正在检查风险状态...</span>
            </div>
        `;

        try {
            const response = await fetch('/api/risk-control/check', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.currentRiskStatus = result.data;
                this.displayRiskStatus(result.data);
            } else {
                container.innerHTML = `
                    <div class="analysis-hint">
                        <div class="hint-icon">⚠️</div>
                        <div class="hint-content">
                            <p class="hint-title">风险检查失败</p>
                            <p class="hint-desc">${result.error || '未知错误'}</p>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('❌ 风险检查失败:', error);
            container.innerHTML = `
                <div class="analysis-hint">
                    <div class="hint-icon">⚠️</div>
                    <div class="hint-content">
                        <p class="hint-title">风险检查失败</p>
                        <p class="hint-desc">请稍后重试</p>
                    </div>
                </div>
            `;
        }
    },

    // 显示风险状态
    displayRiskStatus(data) {
        const container = document.getElementById('riskControlContent');
        if (!container) return;

        const { riskLevel, violations, warnings, summary, rules } = data;

        // 风险等级颜色
        const riskLevelColors = {
            'high': '#f44336',
            'medium': '#ff9800',
            'low': '#4caf50'
        };

        const riskLevelTexts = {
            'high': '高风险',
            'medium': '中等风险',
            'low': '低风险'
        };

        // 构建HTML
        let html = `
            <div class="risk-control-container">
                <!-- 风险概览 -->
                <div class="risk-overview">
                    <div class="risk-level-indicator" style="background: ${riskLevelColors[riskLevel]}">
                        <div class="risk-level-icon">${riskLevel === 'high' ? '⚠️' : riskLevel === 'medium' ? '⚡' : '✅'}</div>
                        <div class="risk-level-text">${riskLevelTexts[riskLevel]}</div>
                    </div>

                    <div class="risk-summary-grid">
                        <div class="risk-summary-item">
                            <div class="summary-label">持仓股票</div>
                            <div class="summary-value">${summary.totalStocks}只</div>
                        </div>
                        <div class="risk-summary-item">
                            <div class="summary-label">持仓市值</div>
                            <div class="summary-value">¥${parseFloat(summary.totalMarketValue).toFixed(2)}</div>
                        </div>
                        <div class="risk-summary-item">
                            <div class="summary-label">仓位比例</div>
                            <div class="summary-value">${summary.positionRatio}%</div>
                        </div>
                        <div class="risk-summary-item ${summary.highRiskCount > 0 ? 'risk-high' : ''}">
                            <div class="summary-label">高风险</div>
                            <div class="summary-value">${summary.highRiskCount}项</div>
                        </div>
                        <div class="risk-summary-item ${summary.mediumRiskCount > 0 ? 'risk-medium' : ''}">
                            <div class="summary-label">中风险</div>
                            <div class="summary-value">${summary.mediumRiskCount}项</div>
                        </div>
                        <div class="risk-summary-item">
                            <div class="summary-label">预警提示</div>
                            <div class="summary-value">${summary.lowRiskCount}项</div>
                        </div>
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div class="risk-actions">
                    <button class="action-btn" onclick="RiskControlManager.openRulesModal()">
                        <span>⚙️ 配置规则</span>
                    </button>
                    <button class="action-btn secondary" onclick="RiskControlManager.checkRisk()">
                        <span>🔄 刷新检查</span>
                    </button>
                </div>

                <!-- 风险违规项 -->
                ${violations.length > 0 ? `
                    <div class="risk-section">
                        <h3 class="risk-section-title">
                            <span class="risk-icon">⚠️</span>
                            风险违规 (${violations.length}项)
                        </h3>
                        <div class="risk-items">
                            ${violations.map(v => this.renderRiskItem(v)).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- 预警提示 -->
                ${warnings.length > 0 ? `
                    <div class="risk-section">
                        <h3 class="risk-section-title">
                            <span class="risk-icon">💡</span>
                            预警提示 (${warnings.length}项)
                        </h3>
                        <div class="risk-items">
                            ${warnings.map(w => this.renderRiskItem(w)).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- 无风险状态 -->
                ${violations.length === 0 && warnings.length === 0 ? `
                    <div class="risk-section">
                        <div class="analysis-hint">
                            <div class="hint-icon">✅</div>
                            <div class="hint-content">
                                <p class="hint-title">风险状态良好</p>
                                <p class="hint-desc">当前持仓符合所有风险控制规则</p>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        container.innerHTML = html;
    },

    // 渲染单个风险项
    renderRiskItem(item) {
        const levelColors = {
            'high': 'risk-item-high',
            'medium': 'risk-item-medium',
            'low': 'risk-item-low'
        };

        const levelIcons = {
            'high': '🔴',
            'medium': '🟠',
            'low': '🟡'
        };

        return `
            <div class="risk-item ${levelColors[item.level]}">
                <div class="risk-item-header">
                    <span class="risk-item-icon">${levelIcons[item.level]}</span>
                    <span class="risk-item-title">${item.title}</span>
                    ${item.relatedStockCode ? `<span class="risk-item-stock">${item.relatedStockName}(${item.relatedStockCode})</span>` : ''}
                </div>
                <div class="risk-item-message">${item.message}</div>
                ${item.suggestion ? `<div class="risk-item-suggestion">💡 ${item.suggestion}</div>` : ''}
            </div>
        `;
    },

    // 显示未登录状态
    displayNoLogin() {
        const container = document.getElementById('riskControlContent');
        if (!container) return;

        container.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">🔐</div>
                <div class="hint-content">
                    <p class="hint-title">请先登录</p>
                    <p class="hint-desc">风险控制功能需要登录后使用</p>
                </div>
            </div>
        `;
    },

    // 打开规则配置模态框
    async openRulesModal() {
        const modal = document.getElementById('riskRulesModal');
        if (!modal) {
            // 如果模态框不存在，创建它
            this.createRulesModal();
            return this.openRulesModal();
        }

        // 加载当前规则
        const rules = await this.loadRiskRules();
        if (!rules) {
            showNotification('加载规则失败', 'error');
            return;
        }

        // 填充表单
        document.getElementById('maxTotalPosition').value = rules.position.maxTotalPosition;
        document.getElementById('maxSingleStockPosition').value = rules.position.maxSingleStockPosition;
        document.getElementById('maxIndustryConcentration').value = rules.position.maxIndustryConcentration;
        document.getElementById('globalStopLoss').value = rules.stopLoss.globalStopLoss;
        document.getElementById('singleStockStopLoss').value = rules.stopLoss.singleStockStopLoss;
        document.getElementById('singleStockStopProfit').value = rules.stopLoss.singleStockStopProfit;
        document.getElementById('maxSingleTradeAmount').value = rules.tradingLimits.maxSingleTradeAmount;
        document.getElementById('maxDailyTrades').value = rules.tradingLimits.maxDailyTrades;

        // 显示模态框
        modal.style.display = 'block';
    },

    // 创建规则配置模态框
    createRulesModal() {
        const modalHTML = `
            <div id="riskRulesModal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3>⚙️ 风险控制规则配置</h3>
                        <button class="close-btn" onclick="RiskControlManager.closeRulesModal()">×</button>
                    </div>

                    <div class="form-container">
                        <!-- 仓位控制 -->
                        <div class="rules-section">
                            <h4>📊 仓位控制</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="maxTotalPosition">最大总仓位 (%)</label>
                                    <input type="number" id="maxTotalPosition" class="form-input" min="0" max="100" step="1">
                                    <p class="form-hint">总持仓市值不应超过总资金的此比例</p>
                                </div>
                                <div class="form-group">
                                    <label for="maxSingleStockPosition">单股最大仓位 (%)</label>
                                    <input type="number" id="maxSingleStockPosition" class="form-input" min="0" max="100" step="1">
                                    <p class="form-hint">单只股票市值不应超过总资金的此比例</p>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="maxIndustryConcentration">行业最大集中度 (%)</label>
                                <input type="number" id="maxIndustryConcentration" class="form-input" min="0" max="100" step="1">
                                <p class="form-hint">单个行业持仓不应超过总持仓的此比例</p>
                            </div>
                        </div>

                        <!-- 止损止盈 -->
                        <div class="rules-section">
                            <h4>🛡️ 止损止盈</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="globalStopLoss">账户总止损线 (%)</label>
                                    <input type="number" id="globalStopLoss" class="form-input" max="0" step="1">
                                    <p class="form-hint">账户总亏损超过此比例时触发预警</p>
                                </div>
                                <div class="form-group">
                                    <label for="singleStockStopLoss">单股止损线 (%)</label>
                                    <input type="number" id="singleStockStopLoss" class="form-input" max="0" step="1">
                                    <p class="form-hint">单只股票亏损超过此比例时触发预警</p>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="singleStockStopProfit">单股止盈线 (%)</label>
                                <input type="number" id="singleStockStopProfit" class="form-input" min="0" step="1">
                                <p class="form-hint">单只股票盈利达到此比例时提示止盈</p>
                            </div>
                        </div>

                        <!-- 交易限制 -->
                        <div class="rules-section">
                            <h4>🔒 交易限制</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="maxSingleTradeAmount">单笔最大交易金额 (元)</label>
                                    <input type="number" id="maxSingleTradeAmount" class="form-input" min="0" step="1000">
                                    <p class="form-hint">单笔买入或卖出的最大金额限制</p>
                                </div>
                                <div class="form-group">
                                    <label for="maxDailyTrades">日内最大交易次数</label>
                                    <input type="number" id="maxDailyTrades" class="form-input" min="0" step="1">
                                    <p class="form-hint">每天最多进行的交易次数</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="action-btn secondary" onclick="RiskControlManager.closeRulesModal()">取消</button>
                        <button class="action-btn" onclick="RiskControlManager.saveRulesFromModal()">
                            <span>💾 保存规则</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    // 从模态框保存规则
    async saveRulesFromModal() {
        const rules = {
            position: {
                enabled: true,
                maxTotalPosition: parseInt(document.getElementById('maxTotalPosition').value),
                maxSingleStockPosition: parseInt(document.getElementById('maxSingleStockPosition').value),
                maxIndustryConcentration: parseInt(document.getElementById('maxIndustryConcentration').value)
            },
            stopLoss: {
                enabled: true,
                globalStopLoss: parseFloat(document.getElementById('globalStopLoss').value),
                singleStockStopLoss: parseFloat(document.getElementById('singleStockStopLoss').value),
                singleStockStopProfit: parseFloat(document.getElementById('singleStockStopProfit').value),
                trailingStopLoss: false,
                trailingStopLossRate: 5
            },
            tradingLimits: {
                enabled: true,
                maxSingleTradeAmount: parseFloat(document.getElementById('maxSingleTradeAmount').value),
                maxDailyTrades: parseInt(document.getElementById('maxDailyTrades').value),
                blacklist: []
            }
        };

        const success = await this.saveRiskRules(rules);
        if (success) {
            this.closeRulesModal();
            // 重新检查风险
            await this.checkRisk();
        }
    },

    // 关闭规则配置模态框
    closeRulesModal() {
        const modal = document.getElementById('riskRulesModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
};

// 点击模态框外部关闭
window.addEventListener('click', (event) => {
    const modal = document.getElementById('riskRulesModal');
    if (modal && event.target === modal) {
        RiskControlManager.closeRulesModal();
    }
});
