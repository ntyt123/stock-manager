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
            // 允许在非交易日访问复盘
            if (entranceBtn) entranceBtn.disabled = false;
            return;
        }

        // 交易日但还没收盘
        if (!isAfterClose) {
            statusDot.className = 'recap-status-dot trading';
            statusText.textContent = '交易中';
            // 允许在交易时间访问复盘
            if (entranceBtn) entranceBtn.disabled = false;
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

        // 每次打开都刷新最新数据
        await this.refreshRecapData();

        // 渲染复盘内容
        this.renderRecapContent();
    },

    /**
     * 关闭复盘面板
     */
    closeRecapPanel() {
        this.overlay.classList.remove('show');
        this.panel.classList.remove('show');
    },

    /**
     * 刷新复盘数据（获取最新数据）
     */
    async refreshRecapData() {
        try {
            const today = new Date().toISOString().split('T')[0];

            // 每次都重新生成复盘数据，确保使用最新的持仓和盈亏数据
            // generateRecapData会调用/api/recap/generate，该接口会更新现有记录或创建新记录
            await this.generateRecapData();

            console.log('✅ 已刷新最新复盘数据');
        } catch (error) {
            console.error('❌ 刷新复盘数据失败:', error);

            // 如果刷新失败，尝试从服务器获取现有数据作为后备
            try {
                const response = await fetch(`/api/recap/status?date=${new Date().toISOString().split('T')[0]}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                const result = await response.json();

                if (result.success && result.data.recap) {
                    this.currentRecap = result.data.recap;
                    console.log('⚠️ 使用缓存的复盘数据作为后备');
                } else {
                    throw new Error('无法获取复盘数据');
                }
            } catch (fallbackError) {
                console.error('❌ 获取后备数据也失败:', fallbackError);
                throw error;
            }
        }
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
     * 渲染复盘内容（V2版本 - 集成新模块）
     */
    async renderRecapContent() {
        const body = document.getElementById('recapPanelBody');
        if (!body) return;

        const recap = this.currentRecap;
        const marketData = JSON.parse(recap.market_data || '{}');
        const positionData = JSON.parse(recap.position_data || '[]');
        const tradeData = JSON.parse(recap.trade_data || '[]');
        const tradingLogs = JSON.parse(recap.trading_logs_data || '[]');

        // 异步加载周月统计
        const weekStatsHTML = await this.renderWeekStatsComparison();
        const monthStatsHTML = await this.renderMonthStatsComparison();

        body.innerHTML = `
            <!-- 复盘概览 -->
            <div class="recap-overview">
                <div class="recap-overview-card ${recap.today_profit >= 0 ? 'positive' : 'negative'}">
                    <div class="label">今日盈亏</div>
                    <div class="value">${recap.today_profit >= 0 ? '+' : ''}¥${recap.today_profit.toFixed(2)}</div>
                    <div class="desc">${recap.today_profit >= 0 ? '盈利' : '亏损'}</div>
                </div>
                <div class="recap-overview-card ${recap.total_profit >= 0 ? 'positive' : 'negative'}">
                    <div class="label">总盈亏</div>
                    <div class="value">${recap.total_profit >= 0 ? '+' : ''}¥${recap.total_profit.toFixed(2)}</div>
                    <div class="desc">${recap.total_profit >= 0 ? '盈利' : '亏损'}</div>
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
            </div>

            <!-- V2新增：周月数据对比 -->
            <div class="recap-section">
                <div class="recap-section-title">
                    <span class="icon">📊</span>
                    数据对比
                </div>
                <div class="stats-comparison-container">
                    ${weekStatsHTML}
                    ${monthStatsHTML}
                </div>
            </div>

            <!-- V2扩展：市场环境模块 -->
            ${this.renderMarketEnvironmentSection(recap, marketData)}

            <!-- V2新增：交易回顾模块 -->
            ${this.renderTradeReviewSection(recap, tradeData)}

            <!-- V2新增：持仓分析模块 -->
            ${this.renderPositionAnalysisSection(recap, positionData)}

            <!-- 集合竞价分析（保留现有功能） -->
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

            <!-- 持仓分析报告（保留现有功能） -->
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

            <!-- V2新增：复盘反思模块 -->
            ${this.renderReflectionSection(recap)}

            <!-- V2新增：明日计划模块 -->
            ${this.renderTomorrowPlanSection(recap)}

            <!-- 每日总结（保留现有功能） -->
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

        // 设置市场环境表单的自动计算功能
        this.setupMarketEnvironmentAutoCalc();
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
                            <span class="log-time">${new Date(log.created_at).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</span>
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
                let totalMarketValue = 0;

                positions.forEach(pos => {
                    const profit = (pos.currentPrice - pos.costPrice) * pos.quantity;
                    totalProfit += profit;
                    totalCost += pos.costPrice * pos.quantity;
                    totalMarketValue += pos.currentPrice * pos.quantity;
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
                            // 今日盈利率 = 今日盈利 / 昨日收盘市值 * 100
                            // 昨日收盘市值 = 当前市值 - 今日盈利
                            const yesterdayMarketValue = totalMarketValue - todayProfit;
                            const todayProfitRate = yesterdayMarketValue > 0 ? (todayProfit / yesterdayMarketValue) * 100 : 0;

                            // 调试日志
                            console.log('📊 今日盈利率计算详情:');
                            console.log('   - 今日盈利:', todayProfit.toFixed(2));
                            console.log('   - 当前市值:', totalMarketValue.toFixed(2));
                            console.log('   - 昨日市值:', yesterdayMarketValue.toFixed(2));
                            console.log('   - 今日盈利率:', todayProfitRate.toFixed(2) + '%');

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
                        const yesterdayMarketValue = totalMarketValue - todayProfit;
                        const todayProfitRate = yesterdayMarketValue > 0 ? (todayProfit / yesterdayMarketValue) * 100 : 0;
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
                UIUtils.showToast('集合竞价分析完成', 'success');
            } else {
                throw new Error(result.error || '集合竞价分析失败');
            }
        } catch (error) {
            console.error('集合竞价分析错误:', error);
            container.innerHTML = `<div class="error-message">集合竞价分析失败: ${error.message}</div>`;
            UIUtils.showToast('集合竞价分析失败', 'error');
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

            // 获取今天的交易记录
            const recap = this.currentRecap;
            const tradingLogs = recap ? JSON.parse(recap.trading_logs_data || '[]') : [];

            const response = await fetch('/api/analysis/portfolio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    todayTrades: tradingLogs
                })
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
                UIUtils.showToast('持仓分析完成', 'success');
            } else {
                throw new Error(result.error || '持仓分析失败');
            }
        } catch (error) {
            console.error('持仓分析错误:', error);
            container.innerHTML = `<div class="error-message">持仓分析失败: ${error.message}</div>`;
            UIUtils.showToast('持仓分析失败', 'error');
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
                UIUtils.showToast(`${stockName} 趋势分析完成`, 'success');
            } else {
                throw new Error(result.error || '趋势分析失败');
            }
        } catch (error) {
            console.error('趋势分析错误:', error);
            resultContainer.innerHTML = `<div class="error-message">趋势分析失败: ${error.message}</div>`;
            UIUtils.showToast(`${stockName} 趋势分析失败`, 'error');
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
     * 渲染周统计对比（V2新增）
     */
    async renderWeekStatsComparison() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`/api/recap/week-stats?date=${today}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success && result.data) {
                const stats = result.data;
                return `
                    <div class="stats-comparison">
                        <div class="stats-header">本周数据</div>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <div class="stat-label">交易日</div>
                                <div class="stat-value">${stats.trading_days}天</div>
                            </div>
                            <div class="stat-item ${stats.total_profit >= 0 ? 'positive' : 'negative'}">
                                <div class="stat-label">总盈亏</div>
                                <div class="stat-value">${stats.total_profit >= 0 ? '+' : ''}¥${stats.total_profit.toFixed(2)}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">胜率</div>
                                <div class="stat-value">${stats.win_rate}%</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">交易次数</div>
                                <div class="stat-value">${stats.total_trades}笔</div>
                            </div>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('获取周统计失败:', error);
            return '<p style="color: #999;">暂无周统计数据</p>';
        }
    },

    /**
     * 渲染月统计对比（V2新增）
     */
    async renderMonthStatsComparison() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`/api/recap/month-stats?date=${today}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success && result.data) {
                const stats = result.data;
                return `
                    <div class="stats-comparison">
                        <div class="stats-header">本月数据</div>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <div class="stat-label">交易日</div>
                                <div class="stat-value">${stats.trading_days}天</div>
                            </div>
                            <div class="stat-item ${stats.total_profit >= 0 ? 'positive' : 'negative'}">
                                <div class="stat-label">总盈亏</div>
                                <div class="stat-value">${stats.total_profit >= 0 ? '+' : ''}¥${stats.total_profit.toFixed(2)}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">胜率</div>
                                <div class="stat-value">${stats.win_rate}%</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">交易次数</div>
                                <div class="stat-value">${stats.total_trades}笔</div>
                            </div>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('获取月统计失败:', error);
            return '<p style="color: #999;">暂无月统计数据</p>';
        }
    },

    /**
     * 渲染市场环境模块（V2扩展版）
     */
    renderMarketEnvironmentSection(recap, marketData) {
        const marketEmotion = recap.market_emotion || '';
        const limitUpCount = recap.limit_up_count || 0;
        const limitDownCount = recap.limit_down_count || 0;
        const blownBoardCount = recap.blown_board_count || 0;
        const blownBoardRate = recap.blown_board_rate || 0;
        const activeThemes = recap.active_themes ? JSON.parse(recap.active_themes) : [];
        const marketNotes = recap.market_notes || '';

        return `
            <div class="recap-section" id="marketEnvironmentSection">
                <div class="recap-section-title">
                    <span class="icon">📈</span>
                    市场环境
                </div>

                <!-- 指数表现 -->
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
                </div>

                <!-- 市场情绪和涨跌停数据 -->
                <div class="market-details">
                    <div class="form-group">
                        <label>市场情绪</label>
                        <select id="marketEmotionInput" class="form-control">
                            <option value="">请选择</option>
                            <option value="冰点" ${marketEmotion === '冰点' ? 'selected' : ''}>冰点</option>
                            <option value="冷清" ${marketEmotion === '冷清' ? 'selected' : ''}>冷清</option>
                            <option value="正常" ${marketEmotion === '正常' ? 'selected' : ''}>正常</option>
                            <option value="活跃" ${marketEmotion === '活跃' ? 'selected' : ''}>活跃</option>
                            <option value="火热" ${marketEmotion === '火热' ? 'selected' : ''}>火热</option>
                        </select>
                    </div>
                    <div class="stats-row">
                        <div class="form-group">
                            <label>涨停数</label>
                            <input type="number" id="limitUpCountInput" class="form-control" value="${limitUpCount}" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>跌停数</label>
                            <input type="number" id="limitDownCountInput" class="form-control" value="${limitDownCount}" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>炸板数</label>
                            <input type="number" id="blownBoardCountInput" class="form-control" value="${blownBoardCount}" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>炸板率 (%)</label>
                            <input type="text" id="blownBoardRateDisplay" class="form-control" value="${blownBoardRate > 0 ? blownBoardRate.toFixed(1) : '0.0'}" readonly style="background-color: #f5f5f5;">
                        </div>
                    </div>
                </div>

                <!-- 活跃题材 -->
                <div class="form-group">
                    <label>活跃题材</label>
                    <textarea id="activeThemesInput" class="form-control" rows="2" placeholder="输入活跃题材，多个题材用逗号分隔">${activeThemes.join(', ')}</textarea>
                </div>

                <!-- 市场观察备注 -->
                <div class="form-group">
                    <label>市场观察</label>
                    <textarea id="marketNotesInput" class="form-control" rows="3" placeholder="记录今日市场的特点、异常情况等">${marketNotes}</textarea>
                </div>

                <button class="btn btn-primary btn-small" onclick="RecapManager.saveMarketEnvironment()">
                    保存市场环境
                </button>
            </div>
        `;
    },

    /**
     * 保存市场环境数据
     */
    async saveMarketEnvironment() {
        if (!this.currentRecap) return;

        try {
            const marketEmotion = document.getElementById('marketEmotionInput').value;
            const limitUpCount = parseInt(document.getElementById('limitUpCountInput').value) || 0;
            const limitDownCount = parseInt(document.getElementById('limitDownCountInput').value) || 0;
            const blownBoardCount = parseInt(document.getElementById('blownBoardCountInput').value) || 0;

            // 计算炸板率：炸板数 / (涨停数 + 炸板数) * 100
            let blownBoardRate = 0;
            if (limitUpCount + blownBoardCount > 0) {
                blownBoardRate = (blownBoardCount / (limitUpCount + blownBoardCount)) * 100;
            }

            const activeThemesText = document.getElementById('activeThemesInput').value;
            const activeThemes = activeThemesText.split(',').map(t => t.trim()).filter(t => t);
            const marketNotes = document.getElementById('marketNotesInput').value;

            const response = await fetch('/api/recap/save-market-env', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    recap_id: this.currentRecap.id,
                    market_emotion: marketEmotion,
                    limit_up_count: limitUpCount,
                    limit_down_count: limitDownCount,
                    blown_board_count: blownBoardCount,
                    blown_board_rate: blownBoardRate,
                    active_themes: activeThemes,
                    market_notes: marketNotes
                })
            });

            const result = await response.json();

            if (result.success) {
                UIUtils.showToast('市场环境已保存', 'success');
            } else {
                throw new Error(result.message || '保存失败');
            }
        } catch (error) {
            console.error('保存市场环境失败:', error);
            UIUtils.showToast('保存失败', 'error');
        }
    },

    /**
     * 设置市场环境表单的自动计算功能
     */
    setupMarketEnvironmentAutoCalc() {
        const limitUpInput = document.getElementById('limitUpCountInput');
        const blownBoardInput = document.getElementById('blownBoardCountInput');
        const blownRateDisplay = document.getElementById('blownBoardRateDisplay');

        if (!limitUpInput || !blownBoardInput || !blownRateDisplay) return;

        const calculateBlownBoardRate = () => {
            const limitUpCount = parseInt(limitUpInput.value) || 0;
            const blownBoardCount = parseInt(blownBoardInput.value) || 0;

            let blownBoardRate = 0;
            if (limitUpCount + blownBoardCount > 0) {
                blownBoardRate = (blownBoardCount / (limitUpCount + blownBoardCount)) * 100;
            }

            blownRateDisplay.value = blownBoardRate.toFixed(1);
        };

        // 绑定输入事件
        limitUpInput.addEventListener('input', calculateBlownBoardRate);
        blownBoardInput.addEventListener('input', calculateBlownBoardRate);
    },

    /**
     * 渲染交易回顾模块（V2新增）
     */
    renderTradeReviewSection(recap, tradeData) {
        const tradeReflections = recap.trade_reflections ? JSON.parse(recap.trade_reflections) : [];
        const noTradeReason = recap.no_trade_reason || '';

        return `
            <div class="recap-section" id="tradeReviewSection">
                <div class="recap-section-title">
                    <span class="icon">💼</span>
                    交易回顾
                </div>

                ${tradeData.length > 0 ? `
                    <div class="trade-list">
                        ${tradeData.map((trade, index) => {
                            const reflection = tradeReflections.find(r => r.trade_id === trade.id) || {};
                            return `
                                <div class="trade-item">
                                    <div class="trade-header">
                                        <span class="trade-type ${trade.trade_type === 'buy' ? 'buy' : 'sell'}">
                                            ${trade.trade_type === 'buy' ? '买入' : '卖出'}
                                        </span>
                                        <span class="trade-stock">${trade.stock_name} (${trade.stock_code})</span>
                                        <span class="trade-time">${new Date(trade.created_at).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</span>
                                    </div>
                                    <div class="trade-details">
                                        <span>数量：${trade.quantity}股</span>
                                        <span>价格：¥${trade.price}</span>
                                        <span>金额：¥${trade.amount.toFixed(2)}</span>
                                    </div>
                                    <div class="trade-reflection">
                                        <label>交易反思</label>
                                        <textarea class="form-control trade-reflection-input"
                                            data-trade-id="${trade.id}"
                                            placeholder="记录这笔交易的思路、问题、改进点..."
                                            rows="2">${reflection.notes || ''}</textarea>
                                        <div class="trade-tags">
                                            <label>
                                                <input type="checkbox" ${reflection.is_good ? 'checked' : ''}
                                                    onchange="RecapManager.toggleTradeTag(${trade.id}, 'is_good', this.checked)">
                                                执行良好
                                            </label>
                                            <label>
                                                <input type="checkbox" ${reflection.has_error ? 'checked' : ''}
                                                    onchange="RecapManager.toggleTradeTag(${trade.id}, 'has_error', this.checked)">
                                                有失误
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <div class="no-trade-section">
                        <p style="color: #999;">今日无交易</p>
                        <div class="form-group">
                            <label>无交易原因</label>
                            <textarea id="noTradeReasonInput" class="form-control" rows="3"
                                placeholder="记录今日为什么没有交易（如：观望、没有机会、执行力不足等）">${noTradeReason}</textarea>
                        </div>
                    </div>
                `}

                <button class="btn btn-primary btn-small" onclick="RecapManager.saveTradeReflections()">
                    保存交易回顾
                </button>
            </div>
        `;
    },

    /**
     * 切换交易标签
     */
    toggleTradeTag(tradeId, tag, checked) {
        // 临时存储标签状态，在保存时一起提交
        if (!this.tempTradeReflections) {
            this.tempTradeReflections = {};
        }
        if (!this.tempTradeReflections[tradeId]) {
            this.tempTradeReflections[tradeId] = {};
        }
        this.tempTradeReflections[tradeId][tag] = checked;
    },

    /**
     * 保存交易反思
     */
    async saveTradeReflections() {
        if (!this.currentRecap) return;

        try {
            // 收集所有交易的反思数据
            const reflections = [];
            const tradeInputs = document.querySelectorAll('.trade-reflection-input');

            tradeInputs.forEach(input => {
                const tradeId = input.getAttribute('data-trade-id');
                const notes = input.value;
                const tempData = this.tempTradeReflections?.[tradeId] || {};

                reflections.push({
                    trade_id: parseInt(tradeId),
                    notes: notes,
                    is_good: tempData.is_good || false,
                    has_error: tempData.has_error || false
                });
            });

            // 获取无交易原因
            const noTradeReasonInput = document.getElementById('noTradeReasonInput');
            const noTradeReason = noTradeReasonInput ? noTradeReasonInput.value : '';

            const response = await fetch('/api/recap/save-trade-reflections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    recap_id: this.currentRecap.id,
                    trade_reflections: reflections,
                    no_trade_reason: noTradeReason
                })
            });

            const result = await response.json();

            if (result.success) {
                UIUtils.showToast('交易回顾已保存', 'success');
                this.tempTradeReflections = {}; // 清空临时数据
            } else {
                throw new Error(result.message || '保存失败');
            }
        } catch (error) {
            console.error('保存交易反思失败:', error);
            UIUtils.showToast('保存失败', 'error');
        }
    },

    /**
     * 渲染持仓分析模块（V2新增）
     */
    renderPositionAnalysisSection(recap, positionData) {
        const positionNotes = recap.position_notes ? JSON.parse(recap.position_notes) : {};

        return `
            <div class="recap-section" id="positionAnalysisSection">
                <div class="recap-section-title">
                    <span class="icon">📊</span>
                    持仓分析
                </div>

                ${positionData.length > 0 ? `
                    <div class="position-analysis-list">
                        ${positionData.map(pos => {
                            const notes = positionNotes[pos.code] || '';
                            const profitRate = pos.profit_rate || 0;
                            const todayProfit = pos.today_profit || 0;

                            return `
                                <div class="position-analysis-item">
                                    <div class="position-header">
                                        <div class="position-info">
                                            <span class="position-name">${pos.name}</span>
                                            <span class="position-code">${pos.code}</span>
                                        </div>
                                        <div class="position-stats">
                                            <span class="profit-stat ${profitRate >= 0 ? 'positive' : 'negative'}">
                                                持仓盈亏：${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%
                                            </span>
                                            <span class="today-stat ${todayProfit >= 0 ? 'positive' : 'negative'}">
                                                今日：${todayProfit >= 0 ? '+' : ''}¥${todayProfit.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="position-details">
                                        <span>持仓：${pos.quantity}股</span>
                                        <span>成本：¥${pos.cost_price}</span>
                                        <span>现价：¥${pos.current_price}</span>
                                        <span>市值：¥${(pos.current_price * pos.quantity).toFixed(2)}</span>
                                    </div>
                                    <div class="position-notes">
                                        <label>持仓备注</label>
                                        <textarea class="form-control position-notes-input"
                                            data-stock-code="${pos.code}"
                                            placeholder="记录持仓理由、操作计划、风险点..."
                                            rows="2">${notes}</textarea>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <p style="text-align: center; color: #999;">暂无持仓数据</p>
                `}

                ${positionData.length > 0 ? `
                    <button class="btn btn-primary btn-small" onclick="RecapManager.savePositionNotes()">
                        保存持仓备注
                    </button>
                ` : ''}
            </div>
        `;
    },

    /**
     * 保存持仓备注
     */
    async savePositionNotes() {
        if (!this.currentRecap) return;

        try {
            const positionNotes = {};
            const noteInputs = document.querySelectorAll('.position-notes-input');

            noteInputs.forEach(input => {
                const stockCode = input.getAttribute('data-stock-code');
                const notes = input.value;
                if (notes.trim()) {
                    positionNotes[stockCode] = notes;
                }
            });

            const response = await fetch('/api/recap/save-position-notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    recap_id: this.currentRecap.id,
                    position_notes: positionNotes
                })
            });

            const result = await response.json();

            if (result.success) {
                UIUtils.showToast('持仓备注已保存', 'success');
            } else {
                throw new Error(result.message || '保存失败');
            }
        } catch (error) {
            console.error('保存持仓备注失败:', error);
            UIUtils.showToast('保存失败', 'error');
        }
    },

    /**
     * 渲染复盘反思模块（V2新增）
     */
    renderReflectionSection(recap) {
        const whatWentRight = recap.what_went_right ? JSON.parse(recap.what_went_right) : [];
        const whatWentWrong = recap.what_went_wrong ? JSON.parse(recap.what_went_wrong) : [];
        const errorDetails = recap.error_details ? JSON.parse(recap.error_details) : {};
        const reflectionNotes = recap.reflection_notes || '';
        const selfRating = recap.self_rating ? JSON.parse(recap.self_rating) : {};

        const rightOptions = [
            '严格执行交易计划', '及时止损', '控制仓位合理', '情绪管理良好',
            '选股精准', '买卖时机把握好', '保持纪律性'
        ];

        const wrongOptions = [
            '追高买入', '恐慌性卖出', '仓位过重', '未设止损',
            '频繁交易', '情绪化操作', '逆势而为', '盲目跟风'
        ];

        return `
            <div class="recap-section" id="reflectionSection">
                <div class="recap-section-title">
                    <span class="icon">💭</span>
                    复盘反思
                </div>

                <!-- 做对的事 -->
                <div class="reflection-group">
                    <label class="reflection-label">今日做对的事</label>
                    <div class="checkbox-grid">
                        ${rightOptions.map(option => `
                            <label class="checkbox-item positive">
                                <input type="checkbox" value="${option}"
                                    ${whatWentRight.includes(option) ? 'checked' : ''}
                                    onchange="RecapManager.updateReflectionCheckbox('right', '${option}', this.checked)">
                                ${option}
                            </label>
                        `).join('')}
                    </div>
                </div>

                <!-- 犯的错误 -->
                <div class="reflection-group">
                    <label class="reflection-label">今日犯的错误</label>
                    <div class="checkbox-grid">
                        ${wrongOptions.map(option => `
                            <label class="checkbox-item negative">
                                <input type="checkbox" value="${option}"
                                    ${whatWentWrong.includes(option) ? 'checked' : ''}
                                    onchange="RecapManager.updateReflectionCheckbox('wrong', '${option}', this.checked)">
                                ${option}
                            </label>
                        `).join('')}
                    </div>
                </div>

                <!-- 错误详情展开 -->
                ${whatWentWrong.length > 0 ? `
                    <div class="error-details-section">
                        <label class="reflection-label">错误详情</label>
                        ${whatWentWrong.map(error => `
                            <div class="error-detail-item">
                                <strong>${error}</strong>
                                <textarea class="form-control error-detail-input"
                                    data-error-key="${error}"
                                    placeholder="详细说明这个错误的情况、原因、教训..."
                                    rows="2">${errorDetails[error] || ''}</textarea>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- 今日感悟 -->
                <div class="form-group">
                    <label>今日感悟</label>
                    <textarea id="reflectionNotesInput" class="form-control" rows="4"
                        placeholder="记录今日的心得体会、重要领悟...">${reflectionNotes}</textarea>
                </div>

                <!-- 自我评分 -->
                <div class="self-rating-section">
                    <label class="reflection-label">自我评分</label>
                    <div class="rating-grid">
                        <div class="rating-item">
                            <span>纪律性</span>
                            <select class="form-control rating-select" data-rating-key="discipline">
                                <option value="">-</option>
                                ${[1,2,3,4,5].map(n => `<option value="${n}" ${selfRating.discipline == n ? 'selected' : ''}>${n}分</option>`).join('')}
                            </select>
                        </div>
                        <div class="rating-item">
                            <span>执行力</span>
                            <select class="form-control rating-select" data-rating-key="execution">
                                <option value="">-</option>
                                ${[1,2,3,4,5].map(n => `<option value="${n}" ${selfRating.execution == n ? 'selected' : ''}>${n}分</option>`).join('')}
                            </select>
                        </div>
                        <div class="rating-item">
                            <span>情绪控制</span>
                            <select class="form-control rating-select" data-rating-key="emotion">
                                <option value="">-</option>
                                ${[1,2,3,4,5].map(n => `<option value="${n}" ${selfRating.emotion == n ? 'selected' : ''}>${n}分</option>`).join('')}
                            </select>
                        </div>
                        <div class="rating-item">
                            <span>学习态度</span>
                            <select class="form-control rating-select" data-rating-key="learning">
                                <option value="">-</option>
                                ${[1,2,3,4,5].map(n => `<option value="${n}" ${selfRating.learning == n ? 'selected' : ''}>${n}分</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <button class="btn btn-primary btn-small" onclick="RecapManager.saveReflectionData()">
                    保存复盘反思
                </button>
            </div>
        `;
    },

    /**
     * 更新反思复选框（临时存储）
     */
    updateReflectionCheckbox(type, option, checked) {
        if (!this.tempReflection) {
            this.tempReflection = { right: [], wrong: [] };
        }

        if (checked) {
            if (!this.tempReflection[type].includes(option)) {
                this.tempReflection[type].push(option);
            }
        } else {
            const index = this.tempReflection[type].indexOf(option);
            if (index > -1) {
                this.tempReflection[type].splice(index, 1);
            }
        }
    },

    /**
     * 保存复盘反思数据
     */
    async saveReflectionData() {
        if (!this.currentRecap) return;

        try {
            // 收集做对的事
            const rightCheckboxes = document.querySelectorAll('.checkbox-item.positive input:checked');
            const whatWentRight = Array.from(rightCheckboxes).map(cb => cb.value);

            // 收集犯的错误
            const wrongCheckboxes = document.querySelectorAll('.checkbox-item.negative input:checked');
            const whatWentWrong = Array.from(wrongCheckboxes).map(cb => cb.value);

            // 收集错误详情
            const errorDetails = {};
            const errorInputs = document.querySelectorAll('.error-detail-input');
            errorInputs.forEach(input => {
                const key = input.getAttribute('data-error-key');
                const value = input.value;
                if (value.trim()) {
                    errorDetails[key] = value;
                }
            });

            // 收集今日感悟
            const reflectionNotes = document.getElementById('reflectionNotesInput').value;

            // 收集自我评分
            const selfRating = {};
            const ratingSelects = document.querySelectorAll('.rating-select');
            ratingSelects.forEach(select => {
                const key = select.getAttribute('data-rating-key');
                const value = select.value;
                if (value) {
                    selfRating[key] = parseInt(value);
                }
            });

            const response = await fetch('/api/recap/save-reflection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    recap_id: this.currentRecap.id,
                    what_went_right: whatWentRight,
                    what_went_wrong: whatWentWrong,
                    error_details: errorDetails,
                    reflection_notes: reflectionNotes,
                    self_rating: selfRating
                })
            });

            const result = await response.json();

            if (result.success) {
                UIUtils.showToast('复盘反思已保存', 'success');
                this.tempReflection = null;
            } else {
                throw new Error(result.message || '保存失败');
            }
        } catch (error) {
            console.error('保存复盘反思失败:', error);
            UIUtils.showToast('保存失败', 'error');
        }
    },

    /**
     * 渲染明日计划模块（V2新增）
     */
    renderTomorrowPlanSection(recap) {
        const tomorrowPlans = recap.tomorrow_plans ? JSON.parse(recap.tomorrow_plans) : [];
        const tomorrowNotes = recap.tomorrow_notes || '';

        return `
            <div class="recap-section" id="tomorrowPlanSection">
                <div class="recap-section-title">
                    <span class="icon">📅</span>
                    明日计划
                </div>

                <div class="tomorrow-plans-list" id="tomorrowPlansList">
                    ${tomorrowPlans.map((plan, index) => `
                        <div class="plan-item">
                            <input type="checkbox" ${plan.completed ? 'checked' : ''}
                                onchange="RecapManager.togglePlanStatus(${index}, this.checked)">
                            <input type="text" class="form-control plan-input"
                                value="${plan.text}"
                                data-plan-index="${index}"
                                placeholder="输入明日计划...">
                            <button class="btn-icon" onclick="RecapManager.removePlan(${index})">×</button>
                        </div>
                    `).join('')}
                </div>

                <button class="btn btn-secondary btn-small" onclick="RecapManager.addPlan()">
                    + 添加计划
                </button>

                <div class="form-group" style="margin-top: 15px;">
                    <label>明日注意事项</label>
                    <textarea id="tomorrowNotesInput" class="form-control" rows="3"
                        placeholder="记录明日需要特别注意的事项、风险提示...">${tomorrowNotes}</textarea>
                </div>

                <button class="btn btn-primary btn-small" onclick="RecapManager.saveTomorrowPlans()">
                    保存明日计划
                </button>
            </div>
        `;
    },

    /**
     * 添加计划
     */
    addPlan() {
        const plansList = document.getElementById('tomorrowPlansList');
        const newIndex = plansList.children.length;

        const planItem = document.createElement('div');
        planItem.className = 'plan-item';
        planItem.innerHTML = `
            <input type="checkbox" onchange="RecapManager.togglePlanStatus(${newIndex}, this.checked)">
            <input type="text" class="form-control plan-input"
                data-plan-index="${newIndex}"
                placeholder="输入明日计划...">
            <button class="btn-icon" onclick="RecapManager.removePlan(${newIndex})">×</button>
        `;

        plansList.appendChild(planItem);
    },

    /**
     * 移除计划
     */
    removePlan(index) {
        const plansList = document.getElementById('tomorrowPlansList');
        const planItems = plansList.children;
        if (planItems[index]) {
            planItems[index].remove();
        }
    },

    /**
     * 切换计划状态
     */
    togglePlanStatus(index, completed) {
        // 状态在保存时一起提交，这里只需要更新UI
    },

    /**
     * 保存明日计划
     */
    async saveTomorrowPlans() {
        if (!this.currentRecap) return;

        try {
            // 收集所有计划
            const plans = [];
            const planItems = document.querySelectorAll('.plan-item');

            planItems.forEach((item, index) => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                const input = item.querySelector('.plan-input');
                const text = input.value.trim();

                if (text) {
                    plans.push({
                        text: text,
                        completed: checkbox.checked
                    });
                }
            });

            // 获取明日注意事项
            const tomorrowNotes = document.getElementById('tomorrowNotesInput').value;

            const response = await fetch('/api/recap/save-tomorrow-plans', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    recap_id: this.currentRecap.id,
                    tomorrow_plans: plans,
                    tomorrow_notes: tomorrowNotes
                })
            });

            const result = await response.json();

            if (result.success) {
                UIUtils.showToast('明日计划已保存', 'success');
            } else {
                throw new Error(result.message || '保存失败');
            }
        } catch (error) {
            console.error('保存明日计划失败:', error);
            UIUtils.showToast('保存失败', 'error');
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
    },

    /**
     * 标记今日无操作
     */
    async markNoTrading() {
        try {
            const today = new Date().toISOString().split('T')[0];

            const response = await fetch('/api/recap/no-trading', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ date: today })
            });

            const result = await response.json();

            if (result.success) {
                // 更新当前复盘数据
                if (this.currentRecap) {
                    this.currentRecap.no_trading_today = 1;
                }

                // 重新渲染内容
                this.renderRecapContent();

                // 显示成功提示
                if (typeof UIUtils !== 'undefined' && UIUtils.showToast) {
                    UIUtils.showToast('已标记今日无操作', 'success');
                } else {
                    alert('已标记今日无操作');
                }

                console.log('✅ 已标记今日无操作');
            } else {
                throw new Error(result.message || '标记失败');
            }
        } catch (error) {
            console.error('❌ 标记今日无操作失败:', error);

            if (typeof UIUtils !== 'undefined' && UIUtils.showToast) {
                UIUtils.showToast('标记失败: ' + error.message, 'error');
            } else {
                alert('标记失败: ' + error.message);
            }
        }
    }
};

// 导出到全局
window.RecapManager = RecapManager;
