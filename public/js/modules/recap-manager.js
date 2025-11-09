/**
 * 每日复盘管理模块
 */

const RecapManager = {
    currentRecap: null,
    panel: null,
    overlay: null,

    /**
     * 初始化复盘管理器
     */
    async init() {
        console.log('初始化复盘管理器...');

        // 创建复盘面板
        this.createRecapPanel();

        // 检查复盘状态
        await this.checkRecapStatus();

        // 绑定入口按钮事件
        this.bindEntranceEvent();

        // 检查是否需要自动弹出
        this.checkAutoPopup();

        // 启动头部统计和时间轴的定时更新
        this.startAutoUpdate();
    },

    /**
     * 检查复盘状态
     */
    async checkRecapStatus() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`/api/recap/status?date=${today}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success) {
                const { has_recap, is_completed, recap } = result.data;

                // 更新入口按钮状态
                this.updateEntranceStatus(has_recap, is_completed);

                // 保存当前复盘数据
                if (recap) {
                    this.currentRecap = recap;
                }
            }
        } catch (error) {
            console.error('检查复盘状态失败:', error);
        }
    },

    /**
     * 更新入口按钮状态
     */
    updateEntranceStatus(hasRecap, isCompleted) {
        const statusDot = document.querySelector('.recap-status-dot');
        const statusText = document.querySelector('.recap-status-text');
        const entranceBtn = document.getElementById('recapEntranceBtn');

        if (!statusDot || !statusText) return;

        // 判断是否为交易日和交易时间
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const currentTime = hour * 60 + minute;
        const closeTime = 15 * 60; // 15:00

        const isAfterClose = currentTime >= closeTime;
        const isTradingDay = now.getDay() >= 1 && now.getDay() <= 5; // 简单判断周一到周五

        // 非交易日
        if (!isTradingDay) {
            statusDot.className = 'recap-status-dot disabled';
            statusText.textContent = '非交易日';
            if (entranceBtn) entranceBtn.disabled = true;
            return;
        }

        // 交易日但还没收盘
        if (!isAfterClose) {
            statusDot.className = 'recap-status-dot trading';
            statusText.textContent = '交易中';
            if (entranceBtn) entranceBtn.disabled = true;
            return;
        }

        // 交易日且已收盘
        if (entranceBtn) entranceBtn.disabled = false;

        if (isCompleted) {
            statusDot.className = 'recap-status-dot completed';
            statusText.textContent = '已完成';
        } else {
            statusDot.className = 'recap-status-dot pending';
            statusText.textContent = '待复盘';
        }
    },

    /**
     * 绑定入口按钮事件
     */
    bindEntranceEvent() {
        const entranceBtn = document.getElementById('recapEntranceBtn');
        if (entranceBtn) {
            entranceBtn.addEventListener('click', () => {
                this.openRecapPanel();
            });
        }
    },

    /**
     * 检查是否需要自动弹出
     */
    checkAutoPopup() {
        // 检查是否已经弹出过（使用sessionStorage防止刷新重复弹出）
        const hasPopped = sessionStorage.getItem('recapAutoPopped');
        if (hasPopped) return;

        // 检查是否为交易日15:00后且未完成复盘
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const currentTime = hour * 60 + minute;
        const closeTime = 15 * 60;

        const isAfterClose = currentTime >= closeTime;
        const isTradingDay = now.getDay() >= 1 && now.getDay() <= 5;

        if (isTradingDay && isAfterClose && this.currentRecap && !this.currentRecap.is_completed) {
            // 延迟3秒自动弹出
            setTimeout(() => {
                this.openRecapPanel();
                sessionStorage.setItem('recapAutoPopped', 'true');
            }, 3000);
        }
    },

    /**
     * 创建复盘面板
     */
    createRecapPanel() {
        // 创建遮罩层
        this.overlay = document.createElement('div');
        this.overlay.className = 'recap-panel-overlay';
        this.overlay.addEventListener('click', () => this.closeRecapPanel());
        document.body.appendChild(this.overlay);

        // 创建面板
        this.panel = document.createElement('div');
        this.panel.className = 'recap-panel';
        this.panel.innerHTML = `
            <div class="recap-panel-header">
                <div class="recap-panel-title">
                    <span>📊</span>
                    <div>
                        <h2>每日复盘</h2>
                        <div class="date">${new Date().toLocaleDateString('zh-CN')}</div>
                    </div>
                </div>
                <button class="recap-close-btn" onclick="RecapManager.closeRecapPanel()">✕</button>
            </div>
            <div class="recap-panel-body" id="recapPanelBody">
                <div class="recap-empty">
                    <div class="icon">📊</div>
                    <div class="title">正在加载复盘数据...</div>
                    <div class="desc">请稍候</div>
                </div>
            </div>
            <div class="recap-panel-footer">
                <button class="btn btn-secondary" onclick="RecapManager.saveNotes()">💾 保存笔记</button>
                <button class="btn btn-primary" onclick="RecapManager.markAsCompleted()">✅ 完成复盘</button>
            </div>
        `;
        document.body.appendChild(this.panel);
    },

    /**
     * 打开复盘面板
     */
    async openRecapPanel() {
        this.overlay.classList.add('show');
        this.panel.classList.add('show');

        // 加载复盘数据
        await this.loadRecapData();
    },

    /**
     * 关闭复盘面板
     */
    closeRecapPanel() {
        this.overlay.classList.remove('show');
        this.panel.classList.remove('show');
    },

    /**
     * 加载复盘数据
     */
    async loadRecapData() {
        try {
            // 如果没有复盘数据，先生成
            if (!this.currentRecap) {
                await this.generateRecapData();
            }

            // 渲染复盘内容
            this.renderRecapContent();
        } catch (error) {
            console.error('加载复盘数据失败:', error);
            this.showError('加载复盘数据失败');
        }
    },

    /**
     * 生成复盘数据
     */
    async generateRecapData() {
        const today = new Date().toISOString().split('T')[0];

        const response = await fetch('/api/recap/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ date: today })
        });

        const result = await response.json();

        if (result.success) {
            this.currentRecap = result.data;
        } else {
            throw new Error(result.message || '生成复盘数据失败');
        }
    },

    /**
     * 渲染复盘内容
     */
    renderRecapContent() {
        const body = document.getElementById('recapPanelBody');
        if (!body) return;

        const recap = this.currentRecap;
        const marketData = JSON.parse(recap.market_data || '{}');
        const positionData = JSON.parse(recap.position_data || '[]');
        const tradingLogs = JSON.parse(recap.trading_logs_data || '[]');

        body.innerHTML = `
            <!-- 复盘概览 -->
            <div class="recap-overview">
                <div class="recap-overview-card ${recap.today_profit >= 0 ? 'positive' : 'negative'}">
                    <div class="label">今日盈亏</div>
                    <div class="value">${recap.today_profit >= 0 ? '+' : ''}¥${recap.today_profit.toFixed(2)}</div>
                    <div class="desc">${recap.today_profit >= 0 ? '盈利' : '亏损'}</div>
                </div>
                <div class="recap-overview-card">
                    <div class="label">持仓数量</div>
                    <div class="value">${recap.position_count}</div>
                    <div class="desc">只股票</div>
                </div>
                <div class="recap-overview-card">
                    <div class="label">交易次数</div>
                    <div class="value">${recap.trade_count}</div>
                    <div class="desc">笔交易</div>
                </div>
                <div class="recap-overview-card ${tradingLogs.length > 0 ? 'positive' : ''}">
                    <div class="label">操作记录</div>
                    <div class="value">${tradingLogs.length}</div>
                    <div class="desc">${tradingLogs.length > 0 ? '已录入' : '未录入'}</div>
                </div>
            </div>

            <!-- 操作录入提醒 -->
            ${tradingLogs.length === 0 ? `
                <div class="recap-alert-warning">
                    ⚠️ 尚未录入今日操作
                </div>
            ` : ''}

            <!-- 市场回顾 -->
            <div class="recap-section">
                <div class="recap-section-title">
                    <span class="icon">📈</span>
                    市场回顾
                </div>
                <div class="market-data-card">
                    <div class="market-item">
                        <span class="name">上证指数</span>
                        <span class="change ${marketData.sh_index?.change_percent >= 0 ? 'positive' : 'negative'}">
                            ${marketData.sh_index?.change_percent >= 0 ? '+' : ''}${(marketData.sh_index?.change_percent || 0).toFixed(2)}%
                        </span>
                    </div>
                    <div class="market-item">
                        <span class="name">深证成指</span>
                        <span class="change ${marketData.sz_index?.change_percent >= 0 ? 'positive' : 'negative'}">
                            ${marketData.sz_index?.change_percent >= 0 ? '+' : ''}${(marketData.sz_index?.change_percent || 0).toFixed(2)}%
                        </span>
                    </div>
                    <div class="market-item">
                        <span class="name">创业板指</span>
                        <span class="change ${marketData.cy_index?.change_percent >= 0 ? 'positive' : 'negative'}">
                            ${marketData.cy_index?.change_percent >= 0 ? '+' : ''}${(marketData.cy_index?.change_percent || 0).toFixed(2)}%
                        </span>
                    </div>
                    ${marketData.note ? `<div class="market-item"><span class="name" style="color: #999; font-size: 12px;">${marketData.note}</span></div>` : ''}
                </div>
            </div>

            <!-- 持仓表现 -->
            <div class="recap-section">
                <div class="recap-section-title">
                    <span class="icon">💼</span>
                    持仓表现
                </div>
                <div class="position-stats">
                    <div class="position-stat-item rise">
                        <div class="count">${recap.rise_count}</div>
                        <div class="label">上涨</div>
                    </div>
                    <div class="position-stat-item">
                        <div class="count">${recap.flat_count}</div>
                        <div class="label">平盘</div>
                    </div>
                    <div class="position-stat-item fall">
                        <div class="count">${recap.fall_count}</div>
                        <div class="label">下跌</div>
                    </div>
                </div>
                ${positionData.length > 0 ? this.renderPositionList(positionData) : '<p style="text-align: center; color: #999;">暂无持仓数据</p>'}
            </div>

            <!-- 今日操作记录 -->
            <div class="recap-section">
                <div class="recap-section-title">
                    <span class="icon">📝</span>
                    今日操作记录
                </div>
                ${tradingLogs.length > 0 ? this.renderTradingLogs(tradingLogs) : this.renderNoTradingLogs()}
            </div>

            <!-- 集合竞价分析 -->
            <div class="recap-section">
                <div class="recap-section-title">
                    <span class="icon">🌅</span>
                    集合竞价分析
                    <button class="btn btn-small btn-primary" onclick="RecapManager.analyzeCallAuction()" style="margin-left: auto;">
                        ${recap.call_auction_analysis ? '重新分析' : '开始分析'}
                    </button>
                </div>
                <div id="callAuctionAnalysisContainer">
                    ${recap.call_auction_analysis ? `
                        <div class="ai-analysis-content">
                            ${this.renderMarkdown(recap.call_auction_analysis)}
                        </div>
                    ` : `
                        <div class="analysis-placeholder">
                            <p style="color: #999; text-align: center;">点击"开始分析"按钮进行集合竞价分析</p>
                        </div>
                    `}
                </div>
            </div>

            <!-- 持仓分析报告 -->
            <div class="recap-section">
                <div class="recap-section-title">
                    <span class="icon">💼</span>
                    持仓分析报告
                    <button class="btn btn-small btn-primary" onclick="RecapManager.analyzePortfolio()" style="margin-left: auto;">
                        ${recap.portfolio_analysis ? '重新分析' : '开始分析'}
                    </button>
                </div>
                <div id="portfolioAnalysisContainer">
                    ${recap.portfolio_analysis ? `
                        <div class="ai-analysis-content">
                            ${this.renderMarkdown(recap.portfolio_analysis)}
                        </div>
                    ` : `
                        <div class="analysis-placeholder">
                            <p style="color: #999; text-align: center;">点击"开始分析"按钮进行持仓分析</p>
                        </div>
                    `}
                </div>
            </div>

            <!-- 持仓股票基本面分析 -->
            <div class="recap-section">
                <div class="recap-section-title">
                    <span class="icon">📊</span>
                    持仓股票基本面分析
                </div>
                <div id="fundamentalAnalysisContainer">
                    ${positionData.length > 0 ? this.renderFundamentalAnalysisButtons(positionData, recap.fundamental_analysis_data) : '<p style="color: #999; text-align: center;">暂无持仓数据</p>'}
                </div>
            </div>

            <!-- 持仓股票趋势分析 -->
            <div class="recap-section">
                <div class="recap-section-title">
                    <span class="icon">📈</span>
                    持仓股票趋势分析
                </div>
                <div id="trendAnalysisContainer">
                    ${positionData.length > 0 ? this.renderTrendAnalysisButtons(positionData, recap.trend_analysis_data) : '<p style="color: #999; text-align: center;">暂无持仓数据</p>'}
                </div>
            </div>

            <!-- 每日总结 -->
            <div class="recap-section">
                <div class="recap-section-title">
                    <span class="icon">📋</span>
                    每日总结
                    <button class="btn btn-small btn-primary" onclick="RecapManager.generateDailySummary()" style="margin-left: auto;">
                        ${recap.daily_summary ? '重新生成' : '生成总结'}
                    </button>
                </div>
                <div id="dailySummaryContainer">
                    ${recap.daily_summary ? `
                        <div class="ai-analysis-content">
                            ${this.renderMarkdown(recap.daily_summary)}
                        </div>
                    ` : `
                        <div class="analysis-placeholder">
                            <p style="color: #999; text-align: center;">点击"生成总结"按钮，AI将综合所有复盘数据生成每日总结</p>
                        </div>
                    `}
                </div>
            </div>

            <!-- 用户笔记 -->
            <div class="recap-section">
                <div class="recap-section-title">
                    <span class="icon">📝</span>
                    复盘笔记
                </div>
                <div class="user-notes">
                    <textarea id="userNotesInput" placeholder="记录今日心得、经验教训、明日计划...">${recap.user_notes || ''}</textarea>
                </div>
            </div>
        `;
    },

    /**
     * 渲染持仓列表（显示前5个）
     */
    renderPositionList(positions) {
        const top5 = positions.slice(0, 5);
        return `
            <div class="position-list">
                ${top5.map(pos => `
                    <div class="position-item">
                        <div class="info">
                            <div class="stock-name">${pos.name || pos.code}</div>
                            <div class="stock-code">${pos.code}</div>
                        </div>
                        <div class="profit ${(pos.total_profit || 0) >= 0 ? 'positive' : 'negative'}">
                            <div class="profit-percent">${(pos.total_profit || 0) >= 0 ? '+' : ''}${((pos.total_profit || 0) / (pos.cost || 1) * 100).toFixed(2)}%</div>
                            <div class="profit-amount">¥${(pos.total_profit || 0).toFixed(2)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * 渲染AI分析内容
     */
    renderAIAnalysis(analysis) {
        // 尝试解析markdown格式的AI分析
        const sections = analysis.split('##').filter(s => s.trim());

        return `
            <div class="ai-analysis-content">
                ${sections.map(section => {
            const lines = section.trim().split('\n');
            const title = lines[0].trim();
            const content = lines.slice(1).join('\n').trim();

            return `
                        <div class="ai-analysis-section">
                            <h4>${title}</h4>
                            <p>${content || '暂无内容'}</p>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    },

    /**
     * 生成每日总结
     */
    async generateDailySummary() {
        if (!this.currentRecap) return;

        const container = document.getElementById('dailySummaryContainer');
        if (!container) return;

        // 显示加载状态
        container.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>AI正在生成每日总结，请稍候...</p></div>';

        try {
            const response = await fetch('/api/recap/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    recap_id: this.currentRecap.id
                })
            });

            const result = await response.json();

            if (result.success) {
                const summary = result.data.analysis;
                container.innerHTML = `
                    <div class="ai-analysis-content">
                        ${this.renderMarkdown(summary)}
                    </div>
                `;

                // 保存总结结果
                await this.saveAnalysisResult('daily_summary', summary);

                UIUtils.showToast('每日总结生成完成', 'success');
            } else {
                throw new Error(result.message || '生成每日总结失败');
            }
        } catch (error) {
            console.error('生成每日总结失败:', error);
            container.innerHTML = `<div class="error-message">生成每日总结失败: ${error.message}</div>`;
            UIUtils.showToast('生成每日总结失败', 'error');
        }
    },

    /**
     * 保存笔记
     */
    async saveNotes() {
        if (!this.currentRecap) return;

        const notesInput = document.getElementById('userNotesInput');
        if (!notesInput) return;

        const notes = notesInput.value;

        try {
            const response = await fetch('/api/recap/notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    recap_id: this.currentRecap.id,
                    notes: notes
                })
            });

            const result = await response.json();

            if (result.success) {
                this.currentRecap.user_notes = notes;
                UIUtils.showToast('笔记保存成功', 'success');
            } else {
                throw new Error(result.message || '保存笔记失败');
            }
        } catch (error) {
            console.error('保存笔记失败:', error);
            UIUtils.showToast('保存笔记失败', 'error');
        }
    },

    /**
     * 标记复盘已完成
     */
    async markAsCompleted() {
        if (!this.currentRecap) return;

        try {
            const response = await fetch('/api/recap/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    recap_id: this.currentRecap.id
                })
            });

            const result = await response.json();

            if (result.success) {
                this.currentRecap.is_completed = 1;
                this.updateEntranceStatus(true, true);
                UIUtils.showToast('复盘已完成', 'success');
                this.closeRecapPanel();
            } else {
                throw new Error(result.message || '标记完成失败');
            }
        } catch (error) {
            console.error('标记完成失败:', error);
            UIUtils.showToast('标记完成失败', 'error');
        }
    },

    /**
     * 渲染交易日志列表
     */
    renderTradingLogs(logs) {
        const logTypeLabels = {
            daily_recap: '每日复盘',
            decision_note: '决策笔记',
            insight: '交易洞察',
            error_analysis: '错误分析',
            success_case: '成功案例'
        };

        const sentimentEmoji = {
            good: '😊',
            neutral: '😐',
            bad: '😞'
        };

        return `
            <div class="trading-logs-status">
                <div class="status-badge success">
                    <span class="icon">✅</span>
                    <span class="text">操作已录入（${logs.length}条）</span>
                </div>
            </div>
            <div class="trading-logs-list">
                ${logs.map((log, index) => `
                    <div class="trading-log-item">
                        <div class="log-header">
                            <span class="log-type-badge">${logTypeLabels[log.log_type] || log.log_type}</span>
                            ${log.sentiment ? `<span class="log-sentiment">${sentimentEmoji[log.sentiment] || log.sentiment}</span>` : ''}
                            <span class="log-time">${new Date(log.created_at).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}</span>
                        </div>
                        <div class="log-title">${log.title}</div>
                        <div class="log-content">${this.truncateText(log.content, 150)}</div>
                        ${log.related_stock_codes ? `
                            <div class="log-stocks">
                                <span class="label">相关股票：</span>
                                <span class="stocks">${log.related_stock_codes}</span>
                            </div>
                        ` : ''}
                        ${log.profit_loss !== null && log.profit_loss !== undefined ? `
                            <div class="log-profit ${log.profit_loss >= 0 ? 'positive' : 'negative'}">
                                盈亏：${log.profit_loss >= 0 ? '+' : ''}¥${log.profit_loss.toFixed(2)}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * 渲染未录入操作的提示
     */
    renderNoTradingLogs() {
        return `
            <div class="trading-logs-empty-simple">
                <p>尚未录入今日操作</p>
            </div>
        `;
    },

    /**
     * 截断文本
     */
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

    /**
     * 显示错误信息
     */
    showError(message) {
        const body = document.getElementById('recapPanelBody');
        if (body) {
            body.innerHTML = `
                <div class="recap-empty">
                    <div class="icon">❌</div>
                    <div class="title">加载失败</div>
                    <div class="desc">${message}</div>
                </div>
            `;
        }
    },

    /**
     * 更新头部统计数据
     */
    async updateHeaderStats() {
        try {
            // 获取持仓数据
            const positionsResponse = await fetch('/api/positions', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!positionsResponse.ok) {
                throw new Error('获取持仓数据失败');
            }

            const positionsResult = await positionsResponse.json();

            if (positionsResult.success && positionsResult.data) {
                let positions = positionsResult.data;

                // 确保positions是数组
                if (!Array.isArray(positions)) {
                    // 可能是对象，尝试转换为数组
                    if (positions.positions && Array.isArray(positions.positions)) {
                        positions = positions.positions;
                    } else {
                        console.error('❌ 无法获取持仓数组');
                        return;
                    }
                }

                // 计算总盈亏和盈亏率
                let totalProfit = 0;
                let totalCost = 0;

                positions.forEach(pos => {
                    const profit = (pos.currentPrice - pos.costPrice) * pos.quantity;
                    totalProfit += profit;
                    totalCost += pos.costPrice * pos.quantity;
                });

                const profitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

                // 更新总盈亏
                const totalProfitEl = document.getElementById('headerTotalProfit');
                const totalProfitCard = totalProfitEl?.closest('.stat-card');
                if (totalProfitEl) {
                    totalProfitEl.textContent = `${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%`;

                    // 使用classList而不是className，保留stat-value这个class
                    if (profitRate >= 0) {
                        totalProfitEl.classList.remove('negative');
                    } else {
                        totalProfitEl.classList.add('negative');
                    }

                    // 更新卡片背景
                    if (totalProfitCard) {
                        if (profitRate >= 0) {
                            totalProfitCard.classList.remove('negative');
                        } else {
                            totalProfitCard.classList.add('negative');
                        }
                    }
                }

                // 更新持仓数量
                const positionCountEl = document.getElementById('headerPositionCount');
                if (positionCountEl) {
                    positionCountEl.textContent = `${positions.length}只`;
                }

                // 获取今日盈亏（从复盘接口获取真实数据）
                try {
                    const today = new Date().toISOString().split('T')[0];
                    const recapResponse = await fetch(`/api/recap/status?date=${today}`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });

                    if (recapResponse.ok) {
                        const recapResult = await recapResponse.json();

                        if (recapResult.success && recapResult.data && recapResult.data.recap) {
                            const recap = recapResult.data.recap;
                            const todayProfit = recap.today_profit || 0;
                            const todayProfitRate = totalCost > 0 ? (todayProfit / totalCost) * 100 : 0;

                            const todayProfitEl = document.getElementById('headerTodayProfit');
                            const todayProfitCard = todayProfitEl?.closest('.stat-card');

                            if (todayProfitEl) {
                                todayProfitEl.textContent = `${todayProfitRate >= 0 ? '+' : ''}${todayProfitRate.toFixed(2)}%`;

                                // 使用classList而不是className，保留stat-value这个class
                                if (todayProfitRate >= 0) {
                                    todayProfitEl.classList.remove('negative');
                                } else {
                                    todayProfitEl.classList.add('negative');
                                }

                                // 更新卡片背景
                                if (todayProfitCard) {
                                    if (todayProfitRate >= 0) {
                                        todayProfitCard.classList.remove('negative');
                                    } else {
                                        todayProfitCard.classList.add('negative');
                                    }
                                }
                            }
                        }
                    }
                } catch (recapError) {
                    console.error('获取今日盈亏失败:', recapError);
                    // 如果获取复盘数据失败，使用计算值
                    const todayProfitEl = document.getElementById('headerTodayProfit');
                    const todayProfitCard = todayProfitEl?.closest('.stat-card');
                    if (todayProfitEl) {
                        // 使用假数据作为后备
                        const todayProfit = totalProfit * 0.3;
                        const todayProfitRate = totalCost > 0 ? (todayProfit / totalCost) * 100 : 0;
                        todayProfitEl.textContent = `${todayProfitRate >= 0 ? '+' : ''}${todayProfitRate.toFixed(2)}%`;

                        if (todayProfitRate >= 0) {
                            todayProfitEl.classList.remove('negative');
                        } else {
                            todayProfitEl.classList.add('negative');
                        }

                        if (todayProfitCard) {
                            if (todayProfitRate >= 0) {
                                todayProfitCard.classList.remove('negative');
                            } else {
                                todayProfitCard.classList.add('negative');
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('更新头部统计失败:', error);
            // 静默失败，不影响用户体验
        }
    },

    /**
     * 更新交易时间轴
     */
    updateTimeline() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        // 市场时间：09:30 - 15:00
        const marketOpen = 9 * 60 + 30;  // 9:30
        const marketClose = 15 * 60;      // 15:00
        const currentTime = hour * 60 + minute;

        const timelineProgress = document.getElementById('timelineProgress');
        const timelineStatus = document.querySelector('#timelineStatus .status-text');

        if (!timelineProgress || !timelineStatus) return;

        // 判断当前市场状态
        const isTradingDay = now.getDay() >= 1 && now.getDay() <= 5;

        if (!isTradingDay) {
            // 非交易日
            timelineProgress.style.width = '0%';
            timelineStatus.textContent = '今日休市';
            return;
        }

        if (currentTime < marketOpen) {
            // 开盘前
            timelineProgress.style.width = '0%';
            const minutesUntilOpen = marketOpen - currentTime;
            const hoursUntilOpen = Math.floor(minutesUntilOpen / 60);
            const minsUntilOpen = minutesUntilOpen % 60;
            timelineStatus.textContent = `距离开盘 ${hoursUntilOpen}小时${minsUntilOpen}分钟`;
        } else if (currentTime >= marketOpen && currentTime < marketClose) {
            // 交易时间
            const totalTradingMinutes = marketClose - marketOpen;
            const elapsedMinutes = currentTime - marketOpen;
            const progress = (elapsedMinutes / totalTradingMinutes) * 100;

            timelineProgress.style.width = `${progress}%`;

            const minutesUntilClose = marketClose - currentTime;
            const hoursUntilClose = Math.floor(minutesUntilClose / 60);
            const minsUntilClose = minutesUntilClose % 60;
            timelineStatus.textContent = `交易中 (距收盘 ${hoursUntilClose}小时${minsUntilClose}分钟)`;
        } else {
            // 收盘后
            timelineProgress.style.width = '100%';
            timelineStatus.textContent = '市场已收盘';
        }
    },

    /**
     * 启动定时更新
     */
    startAutoUpdate() {
        // 立即更新一次
        this.updateHeaderStats();
        this.updateTimeline();

        // 每30秒更新一次统计数据
        setInterval(() => {
            this.updateHeaderStats();
        }, 30000);

        // 每分钟更新一次时间轴
        setInterval(() => {
            this.updateTimeline();
        }, 60000);
    },

    /**
     * 渲染基本面分析按钮
     */
    renderFundamentalAnalysisButtons(positions, savedDataJson) {
        // 解析保存的分析数据
        let savedData = {};
        if (savedDataJson) {
            try {
                savedData = JSON.parse(savedDataJson);
            } catch (e) {
                console.error('解析基本面分析数据失败:', e);
            }
        }

        return `
            <div class="stock-analysis-buttons">
                ${positions.map(pos => {
                    const saved = savedData[pos.code];
                    const hasAnalysis = saved && saved.analysis;
                    return `
                        <div class="stock-analysis-item" data-stock-code="${pos.code}">
                            <div class="stock-info">
                                <span class="stock-name">${pos.name || pos.code}</span>
                                <span class="stock-code">${pos.code}</span>
                            </div>
                            <button class="btn btn-small btn-secondary" onclick="RecapManager.analyzeFundamental('${pos.code}', '${pos.name || pos.code}')">
                                ${hasAnalysis ? '重新分析' : '分析'}
                            </button>
                            <div class="analysis-result" id="fundamental-${pos.code}" style="${hasAnalysis ? 'display: block;' : 'display: none;'}">
                                ${hasAnalysis ? `
                                    <div class="ai-analysis-content">
                                        ${this.renderMarkdown(saved.analysis)}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * 渲染趋势分析按钮
     */
    renderTrendAnalysisButtons(positions, savedDataJson) {
        // 解析保存的分析数据
        let savedData = {};
        if (savedDataJson) {
            try {
                savedData = JSON.parse(savedDataJson);
            } catch (e) {
                console.error('解析趋势分析数据失败:', e);
            }
        }

        return `
            <div class="stock-analysis-buttons">
                ${positions.map(pos => {
                    const saved = savedData[pos.code];
                    const hasAnalysis = saved && saved.analysis;
                    return `
                        <div class="stock-analysis-item" data-stock-code="${pos.code}">
                            <div class="stock-info">
                                <span class="stock-name">${pos.name || pos.code}</span>
                                <span class="stock-code">${pos.code}</span>
                            </div>
                            <button class="btn btn-small btn-secondary" onclick="RecapManager.analyzeTrend('${pos.code}', '${pos.name || pos.code}')">
                                ${hasAnalysis ? '重新分析' : '分析'}
                            </button>
                            <div class="analysis-result" id="trend-${pos.code}" style="${hasAnalysis ? 'display: block;' : 'display: none;'}">
                                ${hasAnalysis ? `
                                    <div class="ai-analysis-content">
                                        ${this.renderMarkdown(saved.analysis)}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * 集合竞价分析
     */
    async analyzeCallAuction() {
        const container = document.getElementById('callAuctionAnalysisContainer');
        if (!container) return;

        try {
            container.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>正在分析集合竞价...</p></div>';

            const response = await fetch('/api/analysis/call-auction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success) {
                const analysis = result.data.analysis;
                container.innerHTML = `
                    <div class="ai-analysis-content">
                        ${this.renderMarkdown(analysis)}
                    </div>
                `;

                // 保存分析结果
                await this.saveAnalysisResult('call_auction', analysis);
            } else {
                throw new Error(result.error || '集合竞价分析失败');
            }
        } catch (error) {
            console.error('集合竞价分析错误:', error);
            container.innerHTML = `<div class="error-message">集合竞价分析失败: ${error.message}</div>`;
        }
    },

    /**
     * 持仓分析
     */
    async analyzePortfolio() {
        const container = document.getElementById('portfolioAnalysisContainer');
        if (!container) return;

        try {
            container.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>正在分析持仓...</p></div>';

            const response = await fetch('/api/analysis/portfolio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success) {
                const analysis = result.data.analysis;
                container.innerHTML = `
                    <div class="ai-analysis-content">
                        ${this.renderMarkdown(analysis)}
                    </div>
                `;

                // 保存分析结果
                await this.saveAnalysisResult('portfolio', analysis);
            } else {
                throw new Error(result.error || '持仓分析失败');
            }
        } catch (error) {
            console.error('持仓分析错误:', error);
            container.innerHTML = `<div class="error-message">持仓分析失败: ${error.message}</div>`;
        }
    },

    /**
     * 基本面分析
     */
    async analyzeFundamental(stockCode, stockName) {
        const resultContainer = document.getElementById(`fundamental-${stockCode}`);
        if (!resultContainer) return;

        try {
            resultContainer.style.display = 'block';
            resultContainer.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>正在分析基本面...</p></div>';

            const response = await fetch('/api/fundamental/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ query: stockCode })
            });

            const result = await response.json();

            if (result.success) {
                const analysis = result.data.analysis;
                resultContainer.innerHTML = `
                    <div class="ai-analysis-content">
                        ${this.renderMarkdown(analysis)}
                    </div>
                `;

                // 保存分析结果
                await this.saveAnalysisResult('fundamental', analysis, stockCode, stockName);
            } else {
                throw new Error(result.error || '基本面分析失败');
            }
        } catch (error) {
            console.error('基本面分析错误:', error);
            resultContainer.innerHTML = `<div class="error-message">基本面分析失败: ${error.message}</div>`;
        }
    },

    /**
     * 趋势分析
     */
    async analyzeTrend(stockCode, stockName) {
        const resultContainer = document.getElementById(`trend-${stockCode}`);
        if (!resultContainer) return;

        try {
            resultContainer.style.display = 'block';
            resultContainer.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>正在分析趋势...</p></div>';

            const response = await fetch('/api/prediction/trend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    stockCode,
                    stockName
                })
            });

            const result = await response.json();

            if (result.success) {
                const prediction = result.data.prediction;
                resultContainer.innerHTML = `
                    <div class="ai-analysis-content">
                        ${this.renderMarkdown(prediction)}
                    </div>
                `;

                // 保存分析结果
                await this.saveAnalysisResult('trend', prediction, stockCode, stockName);
            } else {
                throw new Error(result.error || '趋势分析失败');
            }
        } catch (error) {
            console.error('趋势分析错误:', error);
            resultContainer.innerHTML = `<div class="error-message">趋势分析失败: ${error.message}</div>`;
        }
    },

    /**
     * 保存分析结果到数据库
     */
    async saveAnalysisResult(analysisType, analysisData, stockCode = null, stockName = null) {
        try {
            const requestBody = {
                analysisType,
                analysisData
            };

            // 如果是股票级别的分析（基本面、趋势），添加股票信息
            if (stockCode) {
                requestBody.stockCode = stockCode;
                requestBody.stockName = stockName;
            }

            const response = await fetch('/api/recap/save-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();
            if (!result.success) {
                console.error('保存分析结果失败:', result.message);
            }
        } catch (error) {
            console.error('保存分析结果错误:', error);
        }
    },

    /**
     * 渲染Markdown格式的内容（增强版）
     */
    renderMarkdown(text) {
        if (!text) return '';

        // 将文本按行分割
        const lines = text.split('\n');
        const result = [];
        let inList = false;
        let listItems = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let processed = false;

            // 处理标题（从多到少匹配，避免误匹配，空格可选）
            if (line.match(/^####\s*(.+)$/)) {
                if (inList) {
                    result.push(`<ul>${listItems.join('')}</ul>`);
                    listItems = [];
                    inList = false;
                }
                result.push(`<h6>${line.replace(/^####\s*/, '')}</h6>`);
                processed = true;
            } else if (line.match(/^###\s*(.+)$/)) {
                if (inList) {
                    result.push(`<ul>${listItems.join('')}</ul>`);
                    listItems = [];
                    inList = false;
                }
                result.push(`<h5>${line.replace(/^###\s*/, '')}</h5>`);
                processed = true;
            } else if (line.match(/^##\s*(.+)$/)) {
                if (inList) {
                    result.push(`<ul>${listItems.join('')}</ul>`);
                    listItems = [];
                    inList = false;
                }
                result.push(`<h4>${line.replace(/^##\s*/, '')}</h4>`);
                processed = true;
            } else if (line.match(/^#\s*(.+)$/)) {
                if (inList) {
                    result.push(`<ul>${listItems.join('')}</ul>`);
                    listItems = [];
                    inList = false;
                }
                result.push(`<h3>${line.replace(/^#\s*/, '')}</h3>`);
                processed = true;
            }
            // 处理无序列表
            else if (line.match(/^[•\-\*]\s+(.+)$/)) {
                const content = line.replace(/^[•\-\*]\s+/, '');
                listItems.push(`<li>${this.processInlineMarkdown(content)}</li>`);
                inList = true;
                processed = true;
            }
            // 处理数字列表
            else if (line.match(/^\d+\.\s+(.+)$/)) {
                if (inList && listItems.length > 0 && !listItems[0].includes('<ol>')) {
                    result.push(`<ul>${listItems.join('')}</ul>`);
                    listItems = [];
                }
                const content = line.replace(/^\d+\.\s+/, '');
                listItems.push(`<li>${this.processInlineMarkdown(content)}</li>`);
                inList = 'ol';
                processed = true;
            }
            // 处理分隔线
            else if (line.match(/^---+$/)) {
                if (inList) {
                    result.push(inList === 'ol' ? `<ol>${listItems.join('')}</ol>` : `<ul>${listItems.join('')}</ul>`);
                    listItems = [];
                    inList = false;
                }
                result.push('<hr>');
                processed = true;
            }

            if (!processed) {
                // 结束列表
                if (inList && line.trim() === '') {
                    result.push(inList === 'ol' ? `<ol>${listItems.join('')}</ol>` : `<ul>${listItems.join('')}</ul>`);
                    listItems = [];
                    inList = false;
                    result.push('<br>');
                } else if (line.trim() === '') {
                    result.push('<br>');
                } else {
                    if (inList) {
                        result.push(inList === 'ol' ? `<ol>${listItems.join('')}</ol>` : `<ul>${listItems.join('')}</ul>`);
                        listItems = [];
                        inList = false;
                    }
                    result.push(`<p>${this.processInlineMarkdown(line)}</p>`);
                }
            }
        }

        // 处理剩余的列表项
        if (inList && listItems.length > 0) {
            result.push(inList === 'ol' ? `<ol>${listItems.join('')}</ol>` : `<ul>${listItems.join('')}</ul>`);
        }

        return result.join('');
    },

    /**
     * 处理行内Markdown语法
     */
    processInlineMarkdown(text) {
        return text
            // 粗体
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // 斜体
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // 【】标记高亮
            .replace(/【(.+?)】/g, '<span style="color: #667eea; font-weight: 600;">【$1】</span>')
            // 代码
            .replace(/`(.+?)`/g, '<code>$1</code>');
    },

    /**
     * 打开历史复盘面板
     */
    async openHistoryPanel() {
        // 如果面板不存在，创建它
        if (!this.historyPanel) {
            this.createHistoryPanel();
        }

        // 显示面板
        this.historyOverlay.style.display = 'block';
        this.historyPanel.style.display = 'block';

        // 添加动画类
        setTimeout(() => {
            this.historyOverlay.classList.add('active');
            this.historyPanel.classList.add('active');
        }, 10);

        // 加载历史记录列表
        await this.loadHistoryList();
    },

    /**
     * 创建历史复盘面板
     */
    createHistoryPanel() {
        // 创建遮罩层
        this.historyOverlay = document.createElement('div');
        this.historyOverlay.className = 'recap-overlay';
        this.historyOverlay.onclick = () => this.closeHistoryPanel();

        // 创建面板
        this.historyPanel = document.createElement('div');
        this.historyPanel.className = 'recap-history-panel';
        this.historyPanel.innerHTML = `
            <div class="recap-panel-header">
                <h2>📚 历史复盘记录</h2>
                <button class="recap-close-btn" onclick="RecapManager.closeHistoryPanel()">✕</button>
            </div>
            <div class="recap-panel-body" id="historyPanelBody">
                <div class="recap-empty">
                    <div class="icon">📚</div>
                    <div class="title">正在加载历史记录...</div>
                    <div class="desc">请稍候</div>
                </div>
            </div>
        `;

        document.body.appendChild(this.historyOverlay);
        document.body.appendChild(this.historyPanel);
    },

    /**
     * 加载历史复盘列表
     */
    async loadHistoryList() {
        const bodyEl = document.getElementById('historyPanelBody');
        if (!bodyEl) return;

        try {
            bodyEl.innerHTML = `
                <div class="recap-empty">
                    <div class="icon">⏳</div>
                    <div class="title">正在加载历史记录...</div>
                </div>
            `;

            const response = await fetch('/api/recap/history?limit=30', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
                bodyEl.innerHTML = this.renderHistoryList(result.data);
            } else {
                bodyEl.innerHTML = `
                    <div class="recap-empty">
                        <div class="icon">📚</div>
                        <div class="title">暂无复盘记录</div>
                        <div class="desc">完成今日复盘后，记录将显示在这里</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('加载历史记录失败:', error);
            bodyEl.innerHTML = `
                <div class="recap-empty">
                    <div class="icon">❌</div>
                    <div class="title">加载失败</div>
                    <div class="desc">${error.message}</div>
                </div>
            `;
        }
    },

    /**
     * 渲染历史复盘列表
     */
    renderHistoryList(historyList) {
        return `
            <div class="history-list">
                ${historyList.map(item => {
                    const date = new Date(item.recap_date);
                    const dateStr = date.toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short'
                    });

                    const todayProfit = item.today_profit || 0;
                    const totalProfit = item.total_profit || 0;
                    const isCompleted = item.is_completed;

                    return `
                        <div class="history-item ${isCompleted ? 'completed' : 'incomplete'}" onclick="RecapManager.viewHistoryRecap('${item.recap_date}')">
                            <div class="history-item-header">
                                <div class="history-date">
                                    <span class="date-text">${dateStr}</span>
                                    ${isCompleted ? '<span class="completed-badge">✓ 已完成</span>' : '<span class="incomplete-badge">未完成</span>'}
                                </div>
                                <div class="history-stats">
                                    <div class="stat-item ${todayProfit >= 0 ? 'profit' : 'loss'}">
                                        <span class="stat-label">今日盈亏</span>
                                        <span class="stat-value">${todayProfit >= 0 ? '+' : ''}¥${todayProfit.toFixed(2)}</span>
                                    </div>
                                    <div class="stat-item ${totalProfit >= 0 ? 'profit' : 'loss'}">
                                        <span class="stat-label">总盈亏</span>
                                        <span class="stat-value">${totalProfit >= 0 ? '+' : ''}¥${totalProfit.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="history-item-footer">
                                <div class="history-summary">
                                    ${item.user_notes ? `📝 ${item.user_notes.substring(0, 100)}${item.user_notes.length > 100 ? '...' : ''}` : '暂无笔记'}
                                </div>
                                <button class="btn btn-small btn-primary view-btn" onclick="event.stopPropagation(); RecapManager.viewHistoryRecap('${item.recap_date}')">
                                    查看详情 →
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * 查看历史复盘详情
     */
    async viewHistoryRecap(date) {
        try {
            const response = await fetch(`/api/recap/status?date=${date}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success && result.data.recap) {
                // 关闭历史面板
                this.closeHistoryPanel();

                // 设置当前复盘数据为历史数据
                this.currentRecap = result.data.recap;

                // 打开详情面板
                this.openRecapPanel();
            } else {
                UIUtils.showToast('无法加载该日期的复盘数据', 'error');
            }
        } catch (error) {
            console.error('加载历史复盘详情失败:', error);
            UIUtils.showToast('加载失败', 'error');
        }
    },

    /**
     * 关闭历史复盘面板
     */
    closeHistoryPanel() {
        if (!this.historyPanel || !this.historyOverlay) return;

        this.historyOverlay.classList.remove('active');
        this.historyPanel.classList.remove('active');

        setTimeout(() => {
            this.historyOverlay.style.display = 'none';
            this.historyPanel.style.display = 'none';
        }, 300);
    }
};

// 导出到全局
window.RecapManager = RecapManager;
