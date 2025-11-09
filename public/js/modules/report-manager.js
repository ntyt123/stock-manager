/**
 * 报表管理器（支持持仓报表和交易报表）
 */

const ReportManager = {
    reportData: null,
    reportPanel: null,
    reportOverlay: null,
    currentTab: 'summary',
    reportType: 'position', // 'position', 'trade', or 'profit-loss'

    /**
     * 初始化报表管理器
     */
    init() {
        console.log('报表管理器初始化完成');
    },

    /**
     * 打开持仓报表面板
     */
    async openReportPanel() {
        this.reportType = 'position';
        await this.openPanel();
    },

    /**
     * 打开交易报表面板
     */
    async openTradeReportPanel() {
        this.reportType = 'trade';
        await this.openPanel();
    },

    /**
     * 打开盈亏报表面板
     */
    async openProfitLossReportPanel() {
        this.reportType = 'profit-loss';
        await this.openPanel();
    },

    /**
     * 打开月度报表面板
     */
    async openMonthlyReportPanel() {
        this.reportType = 'monthly';
        await this.openPanel();
    },

    /**
     * 打开年度报表面板
     */
    async openYearlyReportPanel() {
        this.reportType = 'yearly';
        await this.openPanel();
    },

    /**
     * 打开面板（通用方法）
     */
    async openPanel() {
        // 创建面板（如果不存在）
        if (!this.reportPanel) {
            this.createReportPanel();
        } else {
            // 更新面板内容以匹配报表类型
            this.updatePanelForReportType();
        }

        // 显示面板
        this.reportOverlay.style.display = 'block';
        this.reportPanel.style.display = 'block';

        setTimeout(() => {
            this.reportOverlay.classList.add('active');
            this.reportPanel.classList.add('active');
        }, 10);

        // 加载报表数据
        await this.loadReportData();
    },

    /**
     * 创建报表面板
     */
    createReportPanel() {
        // 创建遮罩层
        this.reportOverlay = document.createElement('div');
        this.reportOverlay.className = 'report-overlay';
        this.reportOverlay.onclick = () => this.closeReportPanel();

        // 创建面板
        this.reportPanel = document.createElement('div');
        this.reportPanel.className = 'report-panel';

        document.body.appendChild(this.reportOverlay);
        document.body.appendChild(this.reportPanel);

        // 更新面板内容以匹配报表类型
        this.updatePanelForReportType();
    },

    /**
     * 根据报表类型更新面板内容
     */
    updatePanelForReportType() {
        if (!this.reportPanel) return;

        let title, tabs;
        if (this.reportType === 'position') {
            title = '📊 持仓报表';
            tabs = this.getPositionTabs();
        } else if (this.reportType === 'trade') {
            title = '📋 交易报表';
            tabs = this.getTradeTabs();
        } else if (this.reportType === 'profit-loss') {
            title = '💰 盈亏报表';
            tabs = this.getProfitLossTabs();
        } else if (this.reportType === 'monthly') {
            title = '📅 月度报表';
            tabs = this.getMonthlyTabs();
        } else if (this.reportType === 'yearly') {
            title = '🗓️ 年度报表';
            tabs = this.getYearlyTabs();
        }

        this.reportPanel.innerHTML = `
            <div class="report-header">
                <h2>${title}</h2>
                <button class="report-close-btn" onclick="ReportManager.closeReportPanel()">✕</button>
            </div>
            <div class="report-tabs">
                ${tabs}
            </div>
            <div class="report-content" id="reportContent">
                <div class="report-loading">
                    <div class="spinner"></div>
                    <p>正在加载报表数据...</p>
                </div>
            </div>
        `;

        // 根据报表类型设置初始标签
        if (this.reportType === 'monthly') {
            this.currentTab = 'profit-stats';
        } else if (this.reportType === 'yearly') {
            this.currentTab = 'summary';
        } else {
            this.currentTab = 'summary';
        }
    },

    /**
     * 获取持仓报表标签页
     */
    getPositionTabs() {
        return `
            <button class="report-tab active" data-tab="summary" onclick="ReportManager.switchTab('summary', event)">
                📈 持仓汇总
            </button>
            <button class="report-tab" data-tab="industry" onclick="ReportManager.switchTab('industry', event)">
                🏭 行业分布
            </button>
            <button class="report-tab" data-tab="position-ratio" onclick="ReportManager.switchTab('position-ratio', event)">
                📊 仓位占比
            </button>
            <button class="report-tab" data-tab="cost" onclick="ReportManager.switchTab('cost', event)">
                💰 成本分析
            </button>
            <button class="report-tab" data-tab="profit-loss" onclick="ReportManager.switchTab('profit-loss', event)">
                💸 盈亏统计
            </button>
        `;
    },

    /**
     * 获取交易报表标签页
     */
    getTradeTabs() {
        return `
            <button class="report-tab active" data-tab="summary" onclick="ReportManager.switchTab('summary', event)">
                📊 交易汇总
            </button>
            <button class="report-tab" data-tab="trade-records" onclick="ReportManager.switchTab('trade-records', event)">
                📝 交易记录
            </button>
            <button class="report-tab" data-tab="fee-stats" onclick="ReportManager.switchTab('fee-stats', event)">
                💰 手续费统计
            </button>
            <button class="report-tab" data-tab="frequency" onclick="ReportManager.switchTab('frequency', event)">
                📈 交易频率
            </button>
            <button class="report-tab" data-tab="success-rate" onclick="ReportManager.switchTab('success-rate', event)">
                🎯 成功率
            </button>
        `;
    },

    /**
     * 获取盈亏报表标签页
     */
    getProfitLossTabs() {
        return `
            <button class="report-tab active" data-tab="summary" onclick="ReportManager.switchTab('summary', event)">
                📊 总盈亏汇总
            </button>
            <button class="report-tab" data-tab="realized" onclick="ReportManager.switchTab('realized', event)">
                ✅ 已实现盈亏
            </button>
            <button class="report-tab" data-tab="unrealized" onclick="ReportManager.switchTab('unrealized', event)">
                ⏳ 未实现盈亏
            </button>
            <button class="report-tab" data-tab="curve" onclick="ReportManager.switchTab('curve', event)">
                📈 收益率曲线
            </button>
            <button class="report-tab" data-tab="distribution" onclick="ReportManager.switchTab('distribution', event)">
                📊 盈亏分布
            </button>
        `;
    },

    /**
     * 获取月度报表标签页
     */
    getMonthlyTabs() {
        return `
            <button class="report-tab active" data-tab="profit-stats" onclick="ReportManager.switchTab('profit-stats', event)">
                💰 月度收益统计
            </button>
            <button class="report-tab" data-tab="trade-stats" onclick="ReportManager.switchTab('trade-stats', event)">
                📊 月度交易次数
            </button>
            <button class="report-tab" data-tab="comparison" onclick="ReportManager.switchTab('comparison', event)">
                📈 月度盈亏对比
            </button>
            <button class="report-tab" data-tab="best-worst" onclick="ReportManager.switchTab('best-worst', event)">
                🏆 最佳/最差月份
            </button>
            <button class="report-tab" data-tab="review" onclick="ReportManager.switchTab('review', event)">
                📝 月度操作回顾
            </button>
        `;
    },

    /**
     * 获取年度报表标签页
     */
    getYearlyTabs() {
        return `
            <button class="report-tab active" data-tab="summary" onclick="ReportManager.switchTab('summary', event)">
                📊 年度收益总结
            </button>
            <button class="report-tab" data-tab="trade-stats" onclick="ReportManager.switchTab('trade-stats', event)">
                📈 年度交易统计
            </button>
            <button class="report-tab" data-tab="profit-analysis" onclick="ReportManager.switchTab('profit-analysis', event)">
                💰 年度盈亏分析
            </button>
            <button class="report-tab" data-tab="best-worst" onclick="ReportManager.switchTab('best-worst', event)">
                🏆 最佳/最差操作
            </button>
            <button class="report-tab" data-tab="review" onclick="ReportManager.switchTab('review', event)">
                📝 年度投资回顾
            </button>
        `;
    },

    /**
     * 关闭报表面板
     */
    closeReportPanel() {
        if (!this.reportPanel || !this.reportOverlay) return;

        this.reportOverlay.classList.remove('active');
        this.reportPanel.classList.remove('active');

        setTimeout(() => {
            this.reportOverlay.style.display = 'none';
            this.reportPanel.style.display = 'none';
        }, 300);
    },

    /**
     * 切换标签页
     */
    switchTab(tab, event) {
        this.currentTab = tab;

        // 找到当前报表的容器（在内联模式下）
        let reportContent = null;
        if (event && event.target) {
            // 从点击的标签按钮向上查找报表容器
            const inlineWrapper = event.target.closest('.inline-report-wrapper');
            if (inlineWrapper) {
                reportContent = inlineWrapper.querySelector('#reportContent');
            }
        }

        // 如果没找到，使用全局查找（兼容旧的模态窗口模式）
        if (!reportContent) {
            reportContent = document.getElementById('reportContent');
        }

        // 更新标签按钮状态（只更新当前报表内的标签）
        const container = reportContent ? reportContent.closest('.inline-report-wrapper, .report-panel') : document;
        container.querySelectorAll('.report-tab').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            }
        });

        // 渲染对应内容
        this.renderTabContent(tab, reportContent);
    },

    /**
     * 加载报表数据
     */
    async loadReportData(containerEl) {
        // 如果没有传入容器，则使用默认的 reportContent
        const contentEl = containerEl || document.getElementById('reportContent');
        if (!contentEl) return;

        try {
            contentEl.innerHTML = `
                <div class="report-loading">
                    <div class="spinner"></div>
                    <p>正在加载报表数据...</p>
                </div>
            `;

            let endpoint;
            if (this.reportType === 'position') {
                endpoint = '/api/report/position';
            } else if (this.reportType === 'trade') {
                endpoint = '/api/report/trade';
            } else if (this.reportType === 'profit-loss') {
                endpoint = '/api/report/profit-loss';
            } else if (this.reportType === 'monthly') {
                endpoint = '/api/report/monthly';
            } else if (this.reportType === 'yearly') {
                endpoint = '/api/report/yearly';
            }

            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.reportData = result.data;

                // 在浏览器控制台打印调试信息
                if (this.reportType === 'trade' && this.reportData.summary) {
                    // 获取当前用户信息
                    const userStr = localStorage.getItem('user');
                    const currentUser = userStr ? JSON.parse(userStr) : null;

                    console.log('=== 📊 交易报表汇总数据验证 ===');
                    if (currentUser) {
                        console.log(`👤 当前用户: ${currentUser.username} (ID: ${currentUser.id})`);
                        console.log('🔒 数据范围: 仅显示当前用户的交易数据');
                    }
                    console.log('🔢 交易次数统计:');
                    console.log(`   总交易次数: ${this.reportData.summary.totalTrades}`);
                    console.log(`   买入次数: ${this.reportData.summary.buyCount}`);
                    console.log(`   卖出次数: ${this.reportData.summary.sellCount}`);
                    console.log(`   验证: ${this.reportData.summary.buyCount} + ${this.reportData.summary.sellCount} = ${this.reportData.summary.buyCount + this.reportData.summary.sellCount} ${this.reportData.summary.buyCount + this.reportData.summary.sellCount === this.reportData.summary.totalTrades ? '✅' : '❌'}`);

                    console.log('💰 金额统计:');
                    console.log(`   买入金额: ¥${this.reportData.summary.buyAmount.toFixed(2)}`);
                    console.log(`   卖出金额: ¥${this.reportData.summary.sellAmount.toFixed(2)}`);
                    const totalCalc = this.reportData.summary.buyAmount + this.reportData.summary.sellAmount;
                    console.log(`   验证: ¥${this.reportData.summary.buyAmount.toFixed(2)} + ¥${this.reportData.summary.sellAmount.toFixed(2)} = ¥${totalCalc.toFixed(2)} ${Math.abs(totalCalc - (this.reportData.summary.buyAmount + this.reportData.summary.sellAmount)) < 0.01 ? '✅' : '❌'}`);

                    console.log('💸 手续费统计:');
                    console.log(`   总手续费: ¥${this.reportData.summary.totalFees.toFixed(2)}`);

                    console.log('📈 股票统计:');
                    console.log(`   涉及股票数: ${this.reportData.summary.stockCount}`);

                    console.log('📋 完整汇总数据:', this.reportData.summary);
                    console.log('=== 交易报表汇总数据验证结束 ===\n');
                }

                if (this.reportType === 'profit-loss' && this.reportData.profitDistribution) {
                    // 获取当前用户信息
                    const userStr = localStorage.getItem('user');
                    const currentUser = userStr ? JSON.parse(userStr) : null;

                    console.log('=== 📊 盈亏分布数据 ===');
                    if (currentUser) {
                        console.log(`👤 当前用户: ${currentUser.username} (ID: ${currentUser.id})`);
                        console.log('🔒 数据范围: 仅显示当前用户的盈亏数据');
                    }
                    console.table(this.reportData.profitDistribution);
                    console.log('盈亏分布详细:', this.reportData.profitDistribution);
                    console.log('=== 盈亏分布数据结束 ===\n');
                }

                this.renderTabContent(this.currentTab, contentEl);
            } else {
                throw new Error(result.message || '加载报表数据失败');
            }
        } catch (error) {
            console.error('加载报表数据失败:', error);
            contentEl.innerHTML = `
                <div class="report-error">
                    <div class="error-icon">❌</div>
                    <div class="error-title">加载失败</div>
                    <div class="error-message">${error.message}</div>
                    <button class="btn btn-primary" onclick="ReportManager.loadReportData()">重试</button>
                </div>
            `;
        }
    },

    /**
     * 渲染标签内容
     */
    renderTabContent(tab, contentEl) {
        // 如果没有传入contentEl，则查找全局的reportContent（兼容旧代码）
        if (!contentEl) {
            contentEl = document.getElementById('reportContent');
        }
        if (!contentEl || !this.reportData) return;

        if (this.reportType === 'position') {
            switch (tab) {
                case 'summary':
                    contentEl.innerHTML = this.renderSummary();
                    break;
                case 'industry':
                    contentEl.innerHTML = this.renderIndustryDistribution();
                    break;
                case 'position-ratio':
                    contentEl.innerHTML = this.renderPositionRatio();
                    break;
                case 'cost':
                    contentEl.innerHTML = this.renderCostAnalysis();
                    break;
                case 'profit-loss':
                    contentEl.innerHTML = this.renderProfitLossStats();
                    break;
            }
        } else if (this.reportType === 'trade') {
            switch (tab) {
                case 'summary':
                    contentEl.innerHTML = this.renderTradeSummary();
                    break;
                case 'trade-records':
                    contentEl.innerHTML = this.renderTradeRecords();
                    break;
                case 'fee-stats':
                    contentEl.innerHTML = this.renderFeeStats();
                    break;
                case 'frequency':
                    contentEl.innerHTML = this.renderFrequencyAnalysis();
                    break;
                case 'success-rate':
                    contentEl.innerHTML = this.renderSuccessRate();
                    break;
            }
        } else if (this.reportType === 'profit-loss') {
            switch (tab) {
                case 'summary':
                    contentEl.innerHTML = this.renderProfitLossSummary();
                    break;
                case 'realized':
                    contentEl.innerHTML = this.renderRealizedProfitLoss();
                    break;
                case 'unrealized':
                    contentEl.innerHTML = this.renderUnrealizedProfitLoss();
                    break;
                case 'curve':
                    contentEl.innerHTML = this.renderProfitCurve();
                    // 延迟初始化 ECharts，确保 DOM 已渲染
                    setTimeout(() => this.initProfitCurveChart(), 100);
                    break;
                case 'distribution':
                    contentEl.innerHTML = this.renderProfitDistribution();
                    break;
            }
        } else if (this.reportType === 'monthly') {
            switch (tab) {
                case 'profit-stats':
                    contentEl.innerHTML = this.renderMonthlyProfitStats();
                    break;
                case 'trade-stats':
                    contentEl.innerHTML = this.renderMonthlyTradeStats();
                    break;
                case 'comparison':
                    contentEl.innerHTML = this.renderMonthlyComparison();
                    break;
                case 'best-worst':
                    contentEl.innerHTML = this.renderBestWorstMonths();
                    break;
                case 'review':
                    contentEl.innerHTML = this.renderMonthlyReview();
                    break;
            }
        } else if (this.reportType === 'yearly') {
            switch (tab) {
                case 'summary':
                    contentEl.innerHTML = this.renderYearlySummary();
                    break;
                case 'trade-stats':
                    contentEl.innerHTML = this.renderYearlyTradeStats();
                    break;
                case 'profit-analysis':
                    contentEl.innerHTML = this.renderYearlyProfitAnalysis();
                    break;
                case 'best-worst':
                    contentEl.innerHTML = this.renderYearlyBestWorst();
                    break;
                case 'review':
                    contentEl.innerHTML = this.renderYearlyReview();
                    break;
            }
        }
    },

    /**
     * 渲染持仓汇总
     */
    renderSummary() {
        const { summary, positions } = this.reportData;

        // 根据总盈亏判断图标颜色：上涨用红色，下跌用绿色/蓝色
        const iconColor = summary.totalProfitLoss >= 0 ? '#ff4757' : '#2ecc71';

        return `
            <div class="report-section">
                <h3 class="section-title"><span style="color: ${iconColor};">📊</span> 持仓概览</h3>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-icon">📊</div>
                        <div class="card-content">
                            <div class="card-label">持仓数量</div>
                            <div class="card-value">${summary.totalPositions} 只</div>
                        </div>
                    </div>
                    <div class="summary-card">
                        <div class="card-icon">💰</div>
                        <div class="card-content">
                            <div class="card-label">总市值</div>
                            <div class="card-value">¥${summary.totalMarketValue.toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="summary-card">
                        <div class="card-icon">💸</div>
                        <div class="card-content">
                            <div class="card-label">总成本</div>
                            <div class="card-value">¥${summary.totalCostValue.toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="summary-card ${summary.totalProfitLoss >= 0 ? 'profit' : 'loss'}">
                        <div class="card-icon">${summary.totalProfitLoss >= 0 ? '📈' : '📉'}</div>
                        <div class="card-content">
                            <div class="card-label">总盈亏</div>
                            <div class="card-value">${summary.totalProfitLoss >= 0 ? '+' : ''}¥${summary.totalProfitLoss.toFixed(2)}</div>
                            <div class="card-sub">${summary.totalProfitLossRate >= 0 ? '+' : ''}${summary.totalProfitLossRate.toFixed(2)}%</div>
                        </div>
                    </div>
                    <div class="summary-card profit">
                        <div class="card-icon">📈</div>
                        <div class="card-content">
                            <div class="card-label">盈利持仓</div>
                            <div class="card-value">${summary.profitPositions} 只</div>
                        </div>
                    </div>
                    <div class="summary-card loss">
                        <div class="card-icon">📉</div>
                        <div class="card-content">
                            <div class="card-label">亏损持仓</div>
                            <div class="card-value">${summary.lossPositions} 只</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3 class="section-title">📝 持仓明细</h3>
                <div class="report-table-container">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>股票代码</th>
                                <th>股票名称</th>
                                <th>行业</th>
                                <th>持仓数量</th>
                                <th>成本价</th>
                                <th>现价</th>
                                <th>市值</th>
                                <th>盈亏</th>
                                <th>盈亏率</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${positions.map(pos => `
                                <tr>
                                    <td><span class="stock-code">${pos.stockCode}</span></td>
                                    <td>${pos.stockName}</td>
                                    <td>${pos.industry || '-'}</td>
                                    <td>${pos.quantity}</td>
                                    <td>¥${pos.costPrice.toFixed(2)}</td>
                                    <td>¥${pos.currentPrice.toFixed(2)}</td>
                                    <td>¥${pos.marketValue.toFixed(2)}</td>
                                    <td class="${pos.profitLoss >= 0 ? 'profit' : 'loss'}">
                                        ${pos.profitLoss >= 0 ? '+' : ''}¥${pos.profitLoss.toFixed(2)}
                                    </td>
                                    <td class="${pos.profitLossRate >= 0 ? 'profit' : 'loss'}">
                                        ${pos.profitLossRate >= 0 ? '+' : ''}${pos.profitLossRate.toFixed(2)}%
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * 渲染行业分布
     */
    renderIndustryDistribution() {
        const { industryDistribution } = this.reportData;

        if (!industryDistribution || industryDistribution.length === 0) {
            return '<div class="report-empty">暂无行业分布数据</div>';
        }

        return `
            <div class="report-section">
                <h3 class="section-title">🏭 行业分布统计</h3>
                <div class="industry-chart">
                    ${industryDistribution.map(item => `
                        <div class="industry-item">
                            <div class="industry-header">
                                <span class="industry-name">${item.industry}</span>
                                <span class="industry-ratio">${item.ratio.toFixed(2)}%</span>
                            </div>
                            <div class="industry-bar">
                                <div class="industry-bar-fill ${item.profitLoss >= 0 ? 'profit' : 'loss'}"
                                     style="width: ${item.ratio}%"></div>
                            </div>
                            <div class="industry-stats">
                                <span>持仓数: ${item.count}</span>
                                <span>市值: ¥${item.marketValue.toFixed(2)}</span>
                                <span class="${item.profitLoss >= 0 ? 'profit' : 'loss'}">
                                    盈亏: ${item.profitLoss >= 0 ? '+' : ''}¥${item.profitLoss.toFixed(2)}
                                </span>
                            </div>
                            <div class="industry-positions">
                                ${item.positions.map(p => `
                                    <span class="position-badge">${p.stockName}</span>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * 渲染仓位占比
     */
    renderPositionRatio() {
        const { positionRatios } = this.reportData;

        if (!positionRatios || positionRatios.length === 0) {
            return '<div class="report-empty">暂无仓位数据</div>';
        }

        return `
            <div class="report-section">
                <h3 class="section-title">📊 仓位占比分析</h3>
                <div class="position-ratio-chart">
                    ${positionRatios.map(item => `
                        <div class="ratio-item">
                            <div class="ratio-header">
                                <div class="ratio-stock">
                                    <span class="stock-code">${item.stockCode}</span>
                                    <span class="stock-name">${item.stockName}</span>
                                    <span class="stock-industry">${item.industry}</span>
                                </div>
                                <span class="ratio-value">${item.ratio.toFixed(2)}%</span>
                            </div>
                            <div class="ratio-bar">
                                <div class="ratio-bar-fill ${item.profitLoss >= 0 ? 'profit' : 'loss'}"
                                     style="width: ${item.ratio}%"></div>
                            </div>
                            <div class="ratio-stats">
                                <span>市值: ¥${item.marketValue.toFixed(2)}</span>
                                <span class="${item.profitLoss >= 0 ? 'profit' : 'loss'}">
                                    盈亏: ${item.profitLoss >= 0 ? '+' : ''}¥${item.profitLoss.toFixed(2)}
                                    (${item.profitLossRate >= 0 ? '+' : ''}${item.profitLossRate.toFixed(2)}%)
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * 渲染成本分析
     */
    renderCostAnalysis() {
        const { costAnalysis } = this.reportData;

        if (!costAnalysis || costAnalysis.length === 0) {
            return '<div class="report-empty">暂无成本数据</div>';
        }

        return `
            <div class="report-section">
                <h3 class="section-title">💰 持仓成本分析</h3>
                <div class="report-table-container">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>股票</th>
                                <th>行业</th>
                                <th>数量</th>
                                <th>成本价</th>
                                <th>现价</th>
                                <th>涨跌</th>
                                <th>涨跌幅</th>
                                <th>成本</th>
                                <th>市值</th>
                                <th>盈亏</th>
                                <th>盈亏率</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${costAnalysis.map(item => `
                                <tr>
                                    <td>
                                        <div class="stock-info">
                                            <span class="stock-code">${item.stockCode}</span>
                                            <span class="stock-name">${item.stockName}</span>
                                        </div>
                                    </td>
                                    <td>${item.industry || '-'}</td>
                                    <td>${item.quantity}</td>
                                    <td>¥${item.costPrice.toFixed(2)}</td>
                                    <td>¥${item.currentPrice.toFixed(2)}</td>
                                    <td class="${item.priceChange >= 0 ? 'profit' : 'loss'}">
                                        ${item.priceChange >= 0 ? '+' : ''}¥${item.priceChange.toFixed(2)}
                                    </td>
                                    <td class="${item.priceChangeRate >= 0 ? 'profit' : 'loss'}">
                                        ${item.priceChangeRate >= 0 ? '+' : ''}${item.priceChangeRate.toFixed(2)}%
                                    </td>
                                    <td>¥${item.costValue.toFixed(2)}</td>
                                    <td>¥${item.marketValue.toFixed(2)}</td>
                                    <td class="${item.profitLoss >= 0 ? 'profit' : 'loss'}">
                                        ${item.profitLoss >= 0 ? '+' : ''}¥${item.profitLoss.toFixed(2)}
                                    </td>
                                    <td class="${item.profitLossRate >= 0 ? 'profit' : 'loss'}">
                                        ${item.profitLossRate >= 0 ? '+' : ''}${item.profitLossRate.toFixed(2)}%
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * 渲染盈亏统计
     */
    renderProfitLossStats() {
        const { profitLossStats } = this.reportData;

        if (!profitLossStats) {
            return '<div class="report-empty">暂无盈亏数据</div>';
        }

        return `
            <div class="report-section">
                <h3 class="section-title">💸 浮动盈亏统计</h3>

                <div class="profit-loss-summary">
                    <div class="summary-item profit">
                        <div class="item-label">盈利持仓</div>
                        <div class="item-value">${profitLossStats.profitPositions.length} 只</div>
                    </div>
                    <div class="summary-item loss">
                        <div class="item-label">亏损持仓</div>
                        <div class="item-value">${profitLossStats.lossPositions.length} 只</div>
                    </div>
                    <div class="summary-item">
                        <div class="item-label">持平持仓</div>
                        <div class="item-value">${profitLossStats.flatPositions.length} 只</div>
                    </div>
                    <div class="summary-item ${profitLossStats.avgProfitLossRate >= 0 ? 'profit' : 'loss'}">
                        <div class="item-label">平均盈亏率</div>
                        <div class="item-value">${profitLossStats.avgProfitLossRate >= 0 ? '+' : ''}${profitLossStats.avgProfitLossRate.toFixed(2)}%</div>
                    </div>
                </div>

                ${profitLossStats.maxProfit ? `
                    <div class="highlight-section profit-highlight">
                        <h4>🎉 最大盈利</h4>
                        <div class="highlight-content">
                            <div class="highlight-stock">
                                <span class="stock-code">${profitLossStats.maxProfit.stockCode}</span>
                                <span class="stock-name">${profitLossStats.maxProfit.stockName}</span>
                            </div>
                            <div class="highlight-stats">
                                <span class="profit">+¥${profitLossStats.maxProfit.profitLoss.toFixed(2)}</span>
                                <span class="profit">+${profitLossStats.maxProfit.profitLossRate.toFixed(2)}%</span>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${profitLossStats.maxLoss ? `
                    <div class="highlight-section loss-highlight">
                        <h4>⚠️ 最大亏损</h4>
                        <div class="highlight-content">
                            <div class="highlight-stock">
                                <span class="stock-code">${profitLossStats.maxLoss.stockCode}</span>
                                <span class="stock-name">${profitLossStats.maxLoss.stockName}</span>
                            </div>
                            <div class="highlight-stats">
                                <span class="loss">¥${profitLossStats.maxLoss.profitLoss.toFixed(2)}</span>
                                <span class="loss">${profitLossStats.maxLoss.profitLossRate.toFixed(2)}%</span>
                            </div>
                        </div>
                    </div>
                ` : ''}

                <div class="profit-loss-lists">
                    ${profitLossStats.profitPositions.length > 0 ? `
                        <div class="profit-loss-list">
                            <h4 class="list-title profit">📈 盈利持仓 (${profitLossStats.profitPositions.length}只)</h4>
                            <div class="list-items">
                                ${profitLossStats.profitPositions.map(item => `
                                    <div class="list-item">
                                        <div class="item-stock">
                                            <span class="stock-code">${item.stockCode}</span>
                                            <span class="stock-name">${item.stockName}</span>
                                            <span class="stock-industry">${item.industry}</span>
                                        </div>
                                        <div class="item-profit profit">
                                            <span>+¥${item.profitLoss.toFixed(2)}</span>
                                            <span>+${item.profitLossRate.toFixed(2)}%</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${profitLossStats.lossPositions.length > 0 ? `
                        <div class="profit-loss-list">
                            <h4 class="list-title loss">📉 亏损持仓 (${profitLossStats.lossPositions.length}只)</h4>
                            <div class="list-items">
                                ${profitLossStats.lossPositions.map(item => `
                                    <div class="list-item">
                                        <div class="item-stock">
                                            <span class="stock-code">${item.stockCode}</span>
                                            <span class="stock-name">${item.stockName}</span>
                                            <span class="stock-industry">${item.industry}</span>
                                        </div>
                                        <div class="item-profit loss">
                                            <span>¥${item.profitLoss.toFixed(2)}</span>
                                            <span>${item.profitLossRate.toFixed(2)}%</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // ========== 交易报表渲染函数 ==========

    /**
     * 渲染交易汇总
     */
    renderTradeSummary() {
        const { summary } = this.reportData;

        return `
            <div class="report-section">
                <h3 class="section-title">📊 交易概览</h3>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-label">总交易次数</div>
                        <div class="card-value">${summary.totalTrades} 笔</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">买入次数</div>
                        <div class="card-value">${summary.buyCount} 笔</div>
                        <div class="card-sub">¥${summary.buyAmount.toFixed(2)}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">卖出次数</div>
                        <div class="card-value">${summary.sellCount} 笔</div>
                        <div class="card-sub">¥${summary.sellAmount.toFixed(2)}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">总手续费</div>
                        <div class="card-value">¥${summary.totalFees.toFixed(2)}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">涉及股票</div>
                        <div class="card-value">${summary.stockCount} 只</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">平均每笔金额</div>
                        <div class="card-value">¥${summary.avgTradeAmount.toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 渲染交易记录
     */
    renderTradeRecords() {
        const { tradeRecords } = this.reportData;

        if (!tradeRecords || tradeRecords.length === 0) {
            return '<div class="report-empty">暂无交易记录</div>';
        }

        return `
            <div class="report-section">
                <h3 class="section-title">📝 按股票分组的交易记录</h3>
                ${tradeRecords.map(record => `
                    <div style="margin-bottom: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div>
                                <span class="stock-code">${record.stockCode}</span>
                                <span class="stock-name" style="margin-left: 8px; font-weight: 600;">${record.stockName}</span>
                            </div>
                            <div style="font-size: 14px; color: #6c757d;">
                                总计 ${record.totalTrades} 笔交易
                            </div>
                        </div>
                        <div class="summary-cards" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                            <div class="summary-card">
                                <div class="card-label">买入</div>
                                <div class="card-value" style="font-size: 18px;">${record.buyCount} 笔</div>
                                <div class="card-sub">${record.buyQuantity} 股</div>
                            </div>
                            <div class="summary-card">
                                <div class="card-label">卖出</div>
                                <div class="card-value" style="font-size: 18px;">${record.sellCount} 笔</div>
                                <div class="card-sub">${record.sellQuantity} 股</div>
                            </div>
                            <div class="summary-card">
                                <div class="card-label">买入金额</div>
                                <div class="card-value" style="font-size: 18px;">¥${record.buyAmount.toFixed(2)}</div>
                            </div>
                            <div class="summary-card">
                                <div class="card-label">卖出金额</div>
                                <div class="card-value" style="font-size: 18px;">¥${record.sellAmount.toFixed(2)}</div>
                            </div>
                            <div class="summary-card">
                                <div class="card-label">手续费</div>
                                <div class="card-value" style="font-size: 18px;">¥${record.totalFees.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * 渲染手续费统计
     */
    renderFeeStats() {
        const { feeStats } = this.reportData;

        if (!feeStats) {
            return '<div class="report-empty">暂无手续费数据</div>';
        }

        return `
            <div class="report-section">
                <h3 class="section-title">💰 手续费统计</h3>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-label">总手续费</div>
                        <div class="card-value">¥${feeStats.totalFees.toFixed(2)}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">买入手续费</div>
                        <div class="card-value">¥${feeStats.buyFees.toFixed(2)}</div>
                        <div class="card-sub">${feeStats.buyCount} 笔</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">卖出手续费</div>
                        <div class="card-value">¥${feeStats.sellFees.toFixed(2)}</div>
                        <div class="card-sub">${feeStats.sellCount} 笔</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">平均每笔手续费</div>
                        <div class="card-value">¥${feeStats.avgFeePerTrade.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3 class="section-title">📊 各股票手续费明细</h3>
                <div class="report-table-container">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>股票代码</th>
                                <th>股票名称</th>
                                <th>买入手续费</th>
                                <th>卖出手续费</th>
                                <th>总手续费</th>
                                <th>交易次数</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${feeStats.byStock.map(item => `
                                <tr>
                                    <td><span class="stock-code">${item.stockCode}</span></td>
                                    <td>${item.stockName}</td>
                                    <td>¥${item.buyFees.toFixed(2)}</td>
                                    <td>¥${item.sellFees.toFixed(2)}</td>
                                    <td style="font-weight: 600;">¥${item.totalFees.toFixed(2)}</td>
                                    <td>${item.tradeCount} 笔</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * 渲染交易频率分析
     */
    renderFrequencyAnalysis() {
        const { frequencyAnalysis } = this.reportData;

        if (!frequencyAnalysis) {
            return '<div class="report-empty">暂无交易频率数据</div>';
        }

        const { daily, monthly } = frequencyAnalysis;

        return `
            <div class="report-section">
                <h3 class="section-title">📈 日交易频率</h3>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-label">总交易天数</div>
                        <div class="card-value">${daily.totalDays} 天</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">日均交易次数</div>
                        <div class="card-value">${daily.avgTradesPerDay.toFixed(2)} 笔</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">最活跃日期</div>
                        <div class="card-value" style="font-size: 16px;">${daily.mostActiveDate || '-'}</div>
                        <div class="card-sub">${daily.maxTradesInDay || 0} 笔</div>
                    </div>
                </div>

                ${daily.byDate && daily.byDate.length > 0 ? `
                    <div class="report-table-container" style="margin-top: 20px;">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th>日期</th>
                                    <th>交易次数</th>
                                    <th>买入次数</th>
                                    <th>卖出次数</th>
                                    <th>交易金额</th>
                                    <th>手续费</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${daily.byDate.map(item => `
                                    <tr>
                                        <td>${item.date}</td>
                                        <td style="font-weight: 600;">${item.count} 笔</td>
                                        <td>${item.buyCount} 笔</td>
                                        <td>${item.sellCount} 笔</td>
                                        <td>¥${item.totalAmount.toFixed(2)}</td>
                                        <td>¥${item.totalFees.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}
            </div>

            <div class="report-section">
                <h3 class="section-title">📅 月交易频率</h3>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-label">交易月份数</div>
                        <div class="card-value">${monthly.totalMonths} 个月</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">月均交易次数</div>
                        <div class="card-value">${monthly.avgTradesPerMonth.toFixed(2)} 笔</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">最活跃月份</div>
                        <div class="card-value" style="font-size: 16px;">${monthly.mostActiveMonth || '-'}</div>
                        <div class="card-sub">${monthly.maxTradesInMonth || 0} 笔</div>
                    </div>
                </div>

                ${monthly.byMonth && monthly.byMonth.length > 0 ? `
                    <div class="report-table-container" style="margin-top: 20px;">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th>月份</th>
                                    <th>交易次数</th>
                                    <th>买入次数</th>
                                    <th>卖出次数</th>
                                    <th>交易金额</th>
                                    <th>手续费</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthly.byMonth.map(item => `
                                    <tr>
                                        <td>${item.month}</td>
                                        <td style="font-weight: 600;">${item.count} 笔</td>
                                        <td>${item.buyCount} 笔</td>
                                        <td>${item.sellCount} 笔</td>
                                        <td>¥${item.totalAmount.toFixed(2)}</td>
                                        <td>¥${item.totalFees.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * 渲染操作成功率
     */
    renderSuccessRate() {
        const { successRate } = this.reportData;

        if (!successRate) {
            return '<div class="report-empty">暂无成功率数据</div>';
        }

        return `
            <div class="report-section">
                <h3 class="section-title">🎯 操作成功率统计</h3>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-label">配对交易数</div>
                        <div class="card-value">${successRate.totalPairedTrades} 笔</div>
                    </div>
                    <div class="summary-card profit">
                        <div class="card-label">盈利交易</div>
                        <div class="card-value">${successRate.profitableTrades} 笔</div>
                    </div>
                    <div class="summary-card loss">
                        <div class="card-label">亏损交易</div>
                        <div class="card-value">${successRate.lossTrades} 笔</div>
                    </div>
                    <div class="summary-card ${successRate.successRatePercent >= 50 ? 'profit' : 'loss'}">
                        <div class="card-label">成功率</div>
                        <div class="card-value">${successRate.successRatePercent.toFixed(2)}%</div>
                    </div>
                    <div class="summary-card ${successRate.totalProfit >= 0 ? 'profit' : 'loss'}">
                        <div class="card-label">总盈亏</div>
                        <div class="card-value">${successRate.totalProfit >= 0 ? '+' : ''}¥${successRate.totalProfit.toFixed(2)}</div>
                    </div>
                    <div class="summary-card ${successRate.avgProfit >= 0 ? 'profit' : 'loss'}">
                        <div class="card-label">平均盈亏</div>
                        <div class="card-value">${successRate.avgProfit >= 0 ? '+' : ''}¥${successRate.avgProfit.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            ${successRate.pairedTrades && successRate.pairedTrades.length > 0 ? `
                <div class="report-section">
                    <h3 class="section-title">📋 配对交易明细</h3>
                    <div class="report-table-container">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th>股票</th>
                                    <th>买入日期</th>
                                    <th>买入价</th>
                                    <th>数量</th>
                                    <th>卖出日期</th>
                                    <th>卖出价</th>
                                    <th>盈亏金额</th>
                                    <th>盈亏率</th>
                                    <th>持有天数</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${successRate.pairedTrades.map(trade => `
                                    <tr>
                                        <td>
                                            <div class="stock-info">
                                                <span class="stock-code">${trade.stockCode}</span>
                                                <span class="stock-name">${trade.stockName}</span>
                                            </div>
                                        </td>
                                        <td>${trade.buyDate}</td>
                                        <td>¥${trade.buyPrice.toFixed(2)}</td>
                                        <td>${trade.quantity}</td>
                                        <td>${trade.sellDate}</td>
                                        <td>¥${trade.sellPrice.toFixed(2)}</td>
                                        <td class="${trade.profit >= 0 ? 'profit' : 'loss'}">
                                            ${trade.profit >= 0 ? '+' : ''}¥${trade.profit.toFixed(2)}
                                        </td>
                                        <td class="${trade.profitRate >= 0 ? 'profit' : 'loss'}">
                                            ${trade.profitRate >= 0 ? '+' : ''}${trade.profitRate.toFixed(2)}%
                                        </td>
                                        <td>${trade.holdDays} 天</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        `;
    },

    // ========== 盈亏报表渲染函数 ==========

    /**
     * 渲染总盈亏汇总
     */
    renderProfitLossSummary() {
        const { totalSummary, realizedProfitLoss, unrealizedProfitLoss } = this.reportData;

        return `
            <div class="report-section">
                <h3 class="section-title">💰 总盈亏汇总</h3>
                <div class="summary-cards">
                    <div class="summary-card ${totalSummary.totalProfit >= 0 ? 'profit' : 'loss'}">
                        <div class="card-label">总盈亏</div>
                        <div class="card-value">${totalSummary.totalProfit >= 0 ? '+' : ''}¥${totalSummary.totalProfit.toFixed(2)}</div>
                    </div>
                    <div class="summary-card ${realizedProfitLoss.totalProfit >= 0 ? 'profit' : 'loss'}">
                        <div class="card-label">已实现盈亏</div>
                        <div class="card-value">${realizedProfitLoss.totalProfit >= 0 ? '+' : ''}¥${realizedProfitLoss.totalProfit.toFixed(2)}</div>
                        <div class="card-sub">${totalSummary.realizedTrades} 笔交易</div>
                    </div>
                    <div class="summary-card ${unrealizedProfitLoss.totalProfit >= 0 ? 'profit' : 'loss'}">
                        <div class="card-label">未实现盈亏</div>
                        <div class="card-value">${unrealizedProfitLoss.totalProfit >= 0 ? '+' : ''}¥${unrealizedProfitLoss.totalProfit.toFixed(2)}</div>
                        <div class="card-sub">${totalSummary.unrealizedPositions} 个持仓</div>
                    </div>
                    <div class="summary-card profit">
                        <div class="card-label">盈利交易/持仓</div>
                        <div class="card-value">${realizedProfitLoss.profitCount + unrealizedProfitLoss.profitCount} 笔</div>
                    </div>
                    <div class="summary-card loss">
                        <div class="card-label">亏损交易/持仓</div>
                        <div class="card-value">${realizedProfitLoss.lossCount + unrealizedProfitLoss.lossCount} 笔</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">盈亏比</div>
                        <div class="card-value">${((realizedProfitLoss.profitCount + unrealizedProfitLoss.profitCount) / Math.max(1, realizedProfitLoss.lossCount + unrealizedProfitLoss.lossCount)).toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3 class="section-title">📊 盈亏结构分析</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                    <div style="padding: 20px; background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border-radius: 12px;">
                        <h4 style="margin: 0 0 16px 0; color: #28a745; font-size: 18px;">✅ 已实现盈亏</h4>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>总盈亏:</span>
                                <span style="font-weight: 700; color: ${realizedProfitLoss.totalProfit >= 0 ? '#28a745' : '#dc3545'};">
                                    ${realizedProfitLoss.totalProfit >= 0 ? '+' : ''}¥${realizedProfitLoss.totalProfit.toFixed(2)}
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>成功率:</span>
                                <span style="font-weight: 700;">${((realizedProfitLoss.profitCount / Math.max(1, realizedProfitLoss.trades.length)) * 100).toFixed(2)}%</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>盈利笔数:</span>
                                <span style="font-weight: 700; color: #28a745;">${realizedProfitLoss.profitCount} 笔</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>亏损笔数:</span>
                                <span style="font-weight: 700; color: #dc3545;">${realizedProfitLoss.lossCount} 笔</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>平均盈亏:</span>
                                <span style="font-weight: 700;">${realizedProfitLoss.avgProfit >= 0 ? '+' : ''}¥${realizedProfitLoss.avgProfit.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div style="padding: 20px; background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%); border-radius: 12px;">
                        <h4 style="margin: 0 0 16px 0; color: #856404; font-size: 18px;">⏳ 未实现盈亏</h4>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>总盈亏:</span>
                                <span style="font-weight: 700; color: ${unrealizedProfitLoss.totalProfit >= 0 ? '#28a745' : '#dc3545'};">
                                    ${unrealizedProfitLoss.totalProfit >= 0 ? '+' : ''}¥${unrealizedProfitLoss.totalProfit.toFixed(2)}
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>盈利率:</span>
                                <span style="font-weight: 700;">${((unrealizedProfitLoss.profitCount / Math.max(1, unrealizedProfitLoss.positions.length)) * 100).toFixed(2)}%</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>盈利持仓:</span>
                                <span style="font-weight: 700; color: #28a745;">${unrealizedProfitLoss.profitCount} 个</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>亏损持仓:</span>
                                <span style="font-weight: 700; color: #dc3545;">${unrealizedProfitLoss.lossCount} 个</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>平均盈亏:</span>
                                <span style="font-weight: 700;">${unrealizedProfitLoss.avgProfit >= 0 ? '+' : ''}¥${unrealizedProfitLoss.avgProfit.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 渲染已实现盈亏
     */
    renderRealizedProfitLoss() {
        const { realizedProfitLoss } = this.reportData;

        if (!realizedProfitLoss || realizedProfitLoss.trades.length === 0) {
            return '<div class="report-empty">暂无已实现盈亏数据</div>';
        }

        const successRate = (realizedProfitLoss.profitCount / Math.max(1, realizedProfitLoss.trades.length)) * 100;

        return `
            <div class="report-section">
                <h3 class="section-title">✅ 已实现盈亏统计</h3>
                <div class="summary-cards">
                    <div class="summary-card ${realizedProfitLoss.totalProfit >= 0 ? 'profit' : 'loss'}">
                        <div class="card-label">总盈亏</div>
                        <div class="card-value">${realizedProfitLoss.totalProfit >= 0 ? '+' : ''}¥${realizedProfitLoss.totalProfit.toFixed(2)}</div>
                    </div>
                    <div class="summary-card profit">
                        <div class="card-label">盈利笔数</div>
                        <div class="card-value">${realizedProfitLoss.profitCount} 笔</div>
                    </div>
                    <div class="summary-card loss">
                        <div class="card-label">亏损笔数</div>
                        <div class="card-value">${realizedProfitLoss.lossCount} 笔</div>
                    </div>
                    <div class="summary-card ${successRate >= 50 ? 'profit' : 'loss'}">
                        <div class="card-label">成功率</div>
                        <div class="card-value">${successRate.toFixed(2)}%</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">平均盈亏</div>
                        <div class="card-value">${realizedProfitLoss.avgProfit >= 0 ? '+' : ''}¥${realizedProfitLoss.avgProfit.toFixed(2)}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">总交易笔数</div>
                        <div class="card-value">${realizedProfitLoss.trades.length} 笔</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3 class="section-title">📋 已平仓交易明细</h3>
                <div class="report-table-container">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>股票代码</th>
                                <th>股票名称</th>
                                <th>买入价</th>
                                <th>卖出价</th>
                                <th>数量</th>
                                <th>买入日期</th>
                                <th>卖出日期</th>
                                <th>盈亏金额</th>
                                <th>盈亏率</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${realizedProfitLoss.trades.map(trade => `
                                <tr>
                                    <td><span class="stock-code">${trade.stockCode}</span></td>
                                    <td>${trade.stockName}</td>
                                    <td>¥${trade.buyPrice.toFixed(2)}</td>
                                    <td>¥${trade.sellPrice.toFixed(2)}</td>
                                    <td>${trade.quantity}</td>
                                    <td>${trade.buyDate}</td>
                                    <td>${trade.sellDate}</td>
                                    <td class="${trade.profit >= 0 ? 'profit' : 'loss'}">
                                        ${trade.profit >= 0 ? '+' : ''}¥${trade.profit.toFixed(2)}
                                    </td>
                                    <td class="${trade.profitRate >= 0 ? 'profit' : 'loss'}">
                                        ${trade.profitRate >= 0 ? '+' : ''}${trade.profitRate.toFixed(2)}%
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * 渲染未实现盈亏
     */
    renderUnrealizedProfitLoss() {
        const { unrealizedProfitLoss } = this.reportData;

        if (!unrealizedProfitLoss || unrealizedProfitLoss.positions.length === 0) {
            return '<div class="report-empty">暂无未实现盈亏数据</div>';
        }

        return `
            <div class="report-section">
                <h3 class="section-title">⏳ 未实现盈亏统计</h3>
                <div class="summary-cards">
                    <div class="summary-card ${unrealizedProfitLoss.totalProfit >= 0 ? 'profit' : 'loss'}">
                        <div class="card-label">浮动盈亏</div>
                        <div class="card-value">${unrealizedProfitLoss.totalProfit >= 0 ? '+' : ''}¥${unrealizedProfitLoss.totalProfit.toFixed(2)}</div>
                    </div>
                    <div class="summary-card profit">
                        <div class="card-label">盈利持仓</div>
                        <div class="card-value">${unrealizedProfitLoss.profitCount} 个</div>
                    </div>
                    <div class="summary-card loss">
                        <div class="card-label">亏损持仓</div>
                        <div class="card-value">${unrealizedProfitLoss.lossCount} 个</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">总持仓数</div>
                        <div class="card-value">${unrealizedProfitLoss.positions.length} 个</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">平均盈亏</div>
                        <div class="card-value">${unrealizedProfitLoss.avgProfit >= 0 ? '+' : ''}¥${unrealizedProfitLoss.avgProfit.toFixed(2)}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">盈利率</div>
                        <div class="card-value">${((unrealizedProfitLoss.profitCount / Math.max(1, unrealizedProfitLoss.positions.length)) * 100).toFixed(2)}%</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3 class="section-title">📋 当前持仓明细</h3>
                <div class="report-table-container">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>股票代码</th>
                                <th>股票名称</th>
                                <th>成本价</th>
                                <th>现价</th>
                                <th>持仓数量</th>
                                <th>成本金额</th>
                                <th>市值</th>
                                <th>浮动盈亏</th>
                                <th>盈亏率</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${unrealizedProfitLoss.positions.map(pos => `
                                <tr>
                                    <td><span class="stock-code">${pos.stockCode}</span></td>
                                    <td>${pos.stockName}</td>
                                    <td>¥${pos.costPrice.toFixed(2)}</td>
                                    <td>¥${pos.currentPrice.toFixed(2)}</td>
                                    <td>${pos.quantity}</td>
                                    <td>¥${(pos.costPrice * pos.quantity).toFixed(2)}</td>
                                    <td>¥${(pos.currentPrice * pos.quantity).toFixed(2)}</td>
                                    <td class="${pos.profit >= 0 ? 'profit' : 'loss'}">
                                        ${pos.profit >= 0 ? '+' : ''}¥${pos.profit.toFixed(2)}
                                    </td>
                                    <td class="${pos.profitRate >= 0 ? 'profit' : 'loss'}">
                                        ${pos.profitRate >= 0 ? '+' : ''}${pos.profitRate.toFixed(2)}%
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * 渲染收益率曲线
     */
    renderProfitCurve() {
        const { profitCurve } = this.reportData;

        // 调试：打印收益曲线数据
        console.log('profitCurve 数据:', profitCurve);
        console.log('profitCurve 长度:', profitCurve ? profitCurve.length : 0);
        if (profitCurve && profitCurve.length > 0) {
            console.log('最后一个元素:', profitCurve[profitCurve.length - 1]);
        }

        if (!profitCurve || profitCurve.length === 0) {
            return '<div class="report-empty">暂无收益率曲线数据</div>';
        }

        // 过滤掉 cumulativeProfit 为 null/undefined/NaN 的数据
        const validCurve = profitCurve.filter(p =>
            p.cumulativeProfit !== null &&
            p.cumulativeProfit !== undefined &&
            !isNaN(p.cumulativeProfit)
        );

        console.log('有效的 profitCurve 数量:', validCurve.length);

        if (validCurve.length === 0) {
            return '<div class="report-empty">收益曲线数据异常</div>';
        }

        const maxProfit = Math.max(...validCurve.map(p => p.cumulativeProfit));
        const minProfit = Math.min(...validCurve.map(p => p.cumulativeProfit));
        const range = maxProfit - minProfit || 1;

        const lastPoint = validCurve[validCurve.length - 1];
        const lastProfit = lastPoint.cumulativeProfit;

        return `
            <div class="report-section">
                <h3 class="section-title">📈 累计收益率曲线</h3>
                <div class="summary-cards">
                    <div class="summary-card ${lastProfit >= 0 ? 'profit' : 'loss'}">
                        <div class="card-label">累计盈亏</div>
                        <div class="card-value">${lastProfit >= 0 ? '+' : ''}¥${lastProfit.toFixed(2)}</div>
                    </div>
                    <div class="summary-card profit">
                        <div class="card-label">最大盈利</div>
                        <div class="card-value">¥${maxProfit.toFixed(2)}</div>
                    </div>
                    <div class="summary-card loss">
                        <div class="card-label">最大回撤</div>
                        <div class="card-value">¥${minProfit.toFixed(2)}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">波动范围</div>
                        <div class="card-value">¥${range.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3 class="section-title">📊 收益曲线图</h3>
                <div id="profitCurveChart" style="width: 100%; height: 400px; background: white; border-radius: 8px; padding: 10px;"></div>
            </div>
        `;
    },

    /**
     * 初始化收益曲线图表 (ECharts)
     */
    initProfitCurveChart() {
        const { profitCurve } = this.reportData;

        if (!profitCurve || profitCurve.length === 0) {
            return;
        }

        // 过滤有效数据
        const validCurve = profitCurve.filter(p =>
            p.cumulativeProfit !== null &&
            p.cumulativeProfit !== undefined &&
            !isNaN(p.cumulativeProfit)
        );

        if (validCurve.length === 0) {
            return;
        }

        // 获取图表容器
        const chartDom = document.getElementById('profitCurveChart');
        if (!chartDom) {
            console.error('找不到图表容器 profitCurveChart');
            return;
        }

        // 检查 ECharts 是否已加载
        if (typeof echarts === 'undefined') {
            console.error('ECharts 库未加载');
            return;
        }

        // 初始化或获取图表实例
        const myChart = echarts.init(chartDom);

        // 准备数据
        const dates = validCurve.map(p => p.date + (p.isUnrealized ? ' (未实现)' : ''));
        const profits = validCurve.map(p => p.cumulativeProfit);

        // 配置图表选项
        const option = {
            title: {
                text: '累计收益曲线',
                left: 'center',
                textStyle: {
                    fontSize: 16,
                    fontWeight: 'normal'
                }
            },
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    const point = params[0];
                    const profit = point.value;
                    const profitStr = profit >= 0 ? `+¥${profit.toFixed(2)}` : `¥${profit.toFixed(2)}`;
                    const color = profit >= 0 ? '#28a745' : '#dc3545';
                    return `<div style="padding: 5px;">
                        <div style="margin-bottom: 5px;">${point.axisValue}</div>
                        <div style="color: ${color}; font-weight: bold; font-size: 16px;">
                            累计收益: ${profitStr}
                        </div>
                    </div>`;
                }
            },
            grid: {
                left: '60px',
                right: '30px',
                top: '60px',
                bottom: '60px'
            },
            xAxis: {
                type: 'category',
                data: dates,
                axisLabel: {
                    rotate: 45,
                    fontSize: 11
                },
                boundaryGap: false
            },
            yAxis: {
                type: 'value',
                name: '累计收益 (¥)',
                axisLabel: {
                    formatter: function(value) {
                        return value >= 0 ? `+¥${value.toFixed(0)}` : `¥${value.toFixed(0)}`;
                    }
                },
                splitLine: {
                    lineStyle: {
                        type: 'dashed'
                    }
                }
            },
            series: [
                {
                    name: '累计收益',
                    type: 'line',
                    data: profits,
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 8,
                    lineStyle: {
                        width: 3
                    },
                    itemStyle: {
                        color: function(params) {
                            return params.value >= 0 ? '#28a745' : '#dc3545';
                        }
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                {
                                    offset: 0,
                                    color: 'rgba(40, 167, 69, 0.3)'
                                },
                                {
                                    offset: 1,
                                    color: 'rgba(40, 167, 69, 0.05)'
                                }
                            ]
                        }
                    },
                    markLine: {
                        silent: true,
                        lineStyle: {
                            color: '#6c757d',
                            type: 'solid'
                        },
                        data: [
                            {
                                yAxis: 0,
                                label: {
                                    formatter: '盈亏平衡线'
                                }
                            }
                        ]
                    }
                }
            ]
        };

        // 设置配置项
        myChart.setOption(option);

        // 响应式调整
        window.addEventListener('resize', function() {
            myChart.resize();
        });
    },

    /**
     * 渲染盈亏分布
     */
    renderProfitDistribution() {
        const { profitDistribution } = this.reportData;

        if (!profitDistribution || profitDistribution.length === 0) {
            return '<div class="report-empty">暂无盈亏分布数据</div>';
        }

        const totalCount = profitDistribution.reduce((sum, item) => sum + item.count, 0);
        const maxCount = Math.max(...profitDistribution.map(item => item.count));

        return `
            <div class="report-section">
                <h3 class="section-title">📊 盈亏分布分析</h3>
                <p style="color: #6c757d; margin-bottom: 20px;">
                    按盈亏率区间统计交易和持仓的分布情况,帮助分析盈亏结构
                </p>

                <div style="display: flex; flex-direction: column; gap: 16px;">
                    ${profitDistribution.map(item => {
                        const percentage = totalCount > 0 ? (item.count / totalCount * 100) : 0;
                        const barWidth = maxCount > 0 ? (item.count / maxCount * 100) : 0;
                        const isProfit = item.label.includes('盈利');
                        const isLoss = item.label.includes('亏损');

                        return `
                            <div style="padding: 16px; background: #f8f9fa; border-radius: 8px; transition: all 0.3s ease;"
                                 onmouseover="this.style.background='#e9ecef'; this.style.transform='translateX(4px)';"
                                 onmouseout="this.style.background='#f8f9fa'; this.style.transform='translateX(0)';">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-size: 16px; font-weight: 600; color: #2c3e50;">${item.label}</span>
                                    <div style="display: flex; align-items: center; gap: 16px;">
                                        <span style="font-size: 14px; color: #6c757d;">${percentage.toFixed(1)}%</span>
                                        <span style="font-size: 18px; font-weight: 700; color: ${isProfit ? '#28a745' : isLoss ? '#dc3545' : '#667eea'};">
                                            ${item.count} 笔
                                        </span>
                                    </div>
                                </div>
                                <div style="height: 10px; background: #e9ecef; border-radius: 5px; overflow: hidden;">
                                    <div style="height: 100%; width: ${barWidth}%; background: linear-gradient(90deg, ${isProfit ? '#28a745' : isLoss ? '#dc3545' : '#667eea'} 0%, ${isProfit ? '#20c997' : isLoss ? '#fd7e14' : '#764ba2'} 100%); transition: width 0.5s ease;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="report-section">
                <h3 class="section-title">📈 分布统计</h3>
                <div class="report-table-container">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>盈亏率区间</th>
                                <th>交易/持仓数</th>
                                <th>占比</th>
                                <th>分布图</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${profitDistribution.map(item => {
                                const percentage = totalCount > 0 ? (item.count / totalCount * 100) : 0;
                                const barWidth = maxCount > 0 ? (item.count / maxCount * 100) : 0;
                                const isProfit = item.label.includes('盈利');
                                const isLoss = item.label.includes('亏损');

                                return `
                                    <tr>
                                        <td style="font-weight: 600;">${item.label}</td>
                                        <td style="font-weight: 600;">${item.count} 笔</td>
                                        <td>${percentage.toFixed(1)}%</td>
                                        <td>
                                            <div style="height: 24px; display: flex; align-items: center;">
                                                <div style="height: 8px; background: #e9ecef; border-radius: 4px; flex: 1; overflow: hidden;">
                                                    <div style="height: 100%; width: ${barWidth}%; background: ${isProfit ? '#28a745' : isLoss ? '#dc3545' : '#667eea'}; transition: width 0.5s ease;"></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // ========== 月度报表渲染函数 ==========

    /**
     * 渲染月度收益统计
     */
    renderMonthlyProfitStats() {
        const { monthlyProfit } = this.reportData;

        if (!monthlyProfit || monthlyProfit.length === 0) {
            return '<div class="report-empty">暂无月度收益数据</div>';
        }

        const totalProfit = monthlyProfit.reduce((sum, item) => sum + item.totalProfit, 0);
        const profitMonths = monthlyProfit.filter(item => item.totalProfit > 0).length;
        const lossMonths = monthlyProfit.filter(item => item.totalProfit < 0).length;
        const avgProfit = totalProfit / monthlyProfit.length;

        return `
            <div class="report-section">
                <h3 class="section-title">💰 月度收益概览</h3>
                <div class="summary-cards">
                    <div class="summary-card ${totalProfit >= 0 ? 'profit' : 'loss'}">
                        <div class="card-label">总收益</div>
                        <div class="card-value">${totalProfit >= 0 ? '+' : ''}¥${totalProfit.toFixed(2)}</div>
                    </div>
                    <div class="summary-card profit">
                        <div class="card-label">盈利月份</div>
                        <div class="card-value">${profitMonths} 个月</div>
                    </div>
                    <div class="summary-card loss">
                        <div class="card-label">亏损月份</div>
                        <div class="card-value">${lossMonths} 个月</div>
                    </div>
                    <div class="summary-card ${avgProfit >= 0 ? 'profit' : 'loss'}">
                        <div class="card-label">月均收益</div>
                        <div class="card-value">${avgProfit >= 0 ? '+' : ''}¥${avgProfit.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3 class="section-title">📊 月度收益明细</h3>
                <div class="report-table-container">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>月份</th>
                                <th>收益金额</th>
                                <th>收益率</th>
                                <th>交易次数</th>
                                <th>趋势</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthlyProfit.map((item, index) => {
                                const successRate = item.tradeCount > 0 ? (item.profitableTrades / item.tradeCount * 100).toFixed(2) : 0;

                                // 计算环比趋势（与上一个月比较）
                                let trendIcon = '';
                                if (index < monthlyProfit.length - 1) {
                                    const prevProfit = monthlyProfit[index + 1].totalProfit;
                                    const change = item.totalProfit - prevProfit;

                                    if (change > 0) {
                                        trendIcon = '<span style="color: #28a745; font-size: 18px;">▲</span>';
                                    } else if (change < 0) {
                                        trendIcon = '<span style="color: #dc3545; font-size: 18px;">▼</span>';
                                    } else {
                                        trendIcon = '<span style="color: #6c757d; font-size: 16px;">●</span>';
                                    }
                                } else {
                                    trendIcon = '<span style="color: #adb5bd;">—</span>';
                                }

                                return `
                                    <tr>
                                        <td style="font-weight: 600;">${item.month}</td>
                                        <td class="${item.totalProfit >= 0 ? 'profit' : 'loss'}">
                                            ${item.totalProfit >= 0 ? '+' : ''}¥${item.totalProfit.toFixed(2)}
                                        </td>
                                        <td class="${successRate >= 50 ? 'profit' : 'loss'}">
                                            ${successRate}%
                                        </td>
                                        <td>${item.tradeCount || 0} 笔</td>
                                        <td style="text-align: center;">${trendIcon}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * 渲染月度交易次数
     */
    renderMonthlyTradeStats() {
        const { monthlyTrades } = this.reportData;

        if (!monthlyTrades || monthlyTrades.length === 0) {
            return '<div class="report-empty">暂无月度交易数据</div>';
        }

        const totalTrades = monthlyTrades.reduce((sum, item) => sum + item.totalTrades, 0);
        const totalFees = monthlyTrades.reduce((sum, item) => sum + (item.totalFees || 0), 0);
        const avgTradesPerMonth = totalTrades / monthlyTrades.length;
        const maxTrades = Math.max(...monthlyTrades.map(item => item.totalTrades));
        const minTrades = Math.min(...monthlyTrades.map(item => item.totalTrades));

        return `
            <div class="report-section">
                <h3 class="section-title">📊 月度交易概览</h3>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-label">总交易次数</div>
                        <div class="card-value">${totalTrades} 笔</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">月均交易</div>
                        <div class="card-value">${avgTradesPerMonth.toFixed(1)} 笔</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">最高月交易</div>
                        <div class="card-value">${maxTrades} 笔</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">最低月交易</div>
                        <div class="card-value">${minTrades} 笔</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">总手续费</div>
                        <div class="card-value">¥${totalFees.toFixed(2)}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">平均每笔手续费</div>
                        <div class="card-value">¥${totalTrades > 0 ? (totalFees / totalTrades).toFixed(2) : '0.00'}</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3 class="section-title">📋 月度交易明细</h3>
                <div class="report-table-container">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>月份</th>
                                <th>交易次数</th>
                                <th>买入次数</th>
                                <th>卖出次数</th>
                                <th>交易金额</th>
                                <th>手续费</th>
                                <th>活跃度</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthlyTrades.map((item, index) => {
                                const activityLevel = item.totalTrades >= maxTrades * 0.8 ? '高' : item.totalTrades <= minTrades * 1.2 ? '低' : '中';
                                const activityColor = activityLevel === '高' ? '#28a745' : activityLevel === '低' ? '#dc3545' : '#ffc107';
                                const barWidth = maxTrades > 0 ? (item.totalTrades / maxTrades * 100) : 0;
                                const totalAmount = (item.buyAmount || 0) + (item.sellAmount || 0);

                                return `
                                    <tr>
                                        <td style="font-weight: 600;">${item.month}</td>
                                        <td style="font-weight: 600;">${item.totalTrades} 笔</td>
                                        <td>${item.buyTrades || 0} 笔</td>
                                        <td>${item.sellTrades || 0} 笔</td>
                                        <td>¥${totalAmount.toFixed(2)}</td>
                                        <td>¥${(item.totalFees || 0).toFixed(2)}</td>
                                        <td>
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <div style="width: 60px; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden;">
                                                    <div style="height: 100%; width: ${barWidth}%; background: #007bff;"></div>
                                                </div>
                                                <span style="color: ${activityColor}; font-weight: 600; font-size: 12px;">${activityLevel}</span>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * 渲染月度盈亏对比
     */
    renderMonthlyComparison() {
        const { monthlyProfit, monthlyComparison } = this.reportData;

        if (!monthlyProfit || monthlyProfit.length === 0) {
            return '<div class="report-empty">暂无月度对比数据</div>';
        }

        const maxProfit = Math.max(...monthlyProfit.map(item => Math.max(item.totalProfit, 0)));
        const maxLoss = Math.max(...monthlyProfit.map(item => Math.abs(Math.min(item.totalProfit, 0))));
        const maxValue = Math.max(maxProfit, maxLoss) || 1; // 避免除以0

        return `
            <div class="report-section">
                <h3 class="section-title">📈 月度盈亏趋势图</h3>
                <div style="background: #e7f3ff; border-left: 4px solid #667eea; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
                    <div style="color: #495057; font-size: 14px; line-height: 1.6;">
                        <strong>图表说明：</strong>柱状图越高表示该月盈亏金额越大。
                        <span style="color: #28a745; font-weight: 600;">绿色柱</span>代表盈利月份，
                        <span style="color: #dc3545; font-weight: 600;">红色柱</span>代表亏损月份。
                    </div>
                </div>

                <div style="padding: 30px 24px; background: #f8f9fa; border-radius: 12px; margin-bottom: 24px;">
                    <!-- 合并的趋势图表 -->
                    <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 280px; gap: 8px; margin-bottom: 16px; padding: 0 20px; border-bottom: 3px solid #dee2e6; position: relative;">
                        ${[...monthlyProfit].reverse().map(item => {
                            const isProfit = item.totalProfit >= 0;
                            const barHeight = maxValue > 0 ? (Math.abs(item.totalProfit) / maxValue * 220) : 0;
                            const barColor = isProfit ? '#28a745' : '#dc3545';
                            const successRate = item.tradeCount > 0 ? (item.profitableTrades / item.tradeCount * 100) : 0;

                            return `
                                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; position: relative;">
                                    <!-- 金额标签 -->
                                    <div style="font-size: 11px; font-weight: 700; color: ${barColor}; white-space: nowrap; position: absolute; bottom: ${barHeight + 8}px; transform: translateY(-100%);">
                                        ${isProfit ? '+' : ''}¥${Math.abs(item.totalProfit).toFixed(0)}
                                    </div>
                                    <!-- 柱状图 -->
                                    <div style="width: 100%; max-width: 60px; height: ${barHeight}px; background: linear-gradient(to top, ${barColor}, ${isProfit ? '#20c997' : '#fd7e14'}); border-radius: 6px 6px 0 0; transition: all 0.5s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer; position: relative;"
                                         title="月份: ${item.month}&#10;盈亏: ${isProfit ? '+' : ''}¥${item.totalProfit.toFixed(2)}&#10;交易: ${item.tradeCount}笔&#10;成功率: ${successRate.toFixed(1)}%"
                                         onmouseover="this.style.opacity='0.8'"
                                         onmouseout="this.style.opacity='1'">
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- 月份标签 -->
                    <div style="display: flex; justify-content: space-around; gap: 8px; margin-top: 12px; padding: 0 20px;">
                        ${[...monthlyProfit].reverse().map(item => `
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 12px; font-weight: 600; color: #495057; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    ${item.month.substring(5)}月
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <!-- 图例和统计信息 -->
                    <div style="display: flex; justify-content: center; gap: 24px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #dee2e6;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 12px; height: 12px; background: #28a745; border-radius: 2px;"></div>
                            <span style="font-size: 13px; color: #495057;">盈利月份: ${monthlyProfit.filter(d => d.totalProfit > 0).length}个</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 12px; height: 12px; background: #dc3545; border-radius: 2px;"></div>
                            <span style="font-size: 13px; color: #495057;">亏损月份: ${monthlyProfit.filter(d => d.totalProfit < 0).length}个</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 13px; color: #495057;">总计: ${monthlyProfit.length}个月</span>
                        </div>
                    </div>
                </div>

                ${monthlyComparison && monthlyComparison.length > 0 ? `
                <div class="report-section">
                    <h3 class="section-title">📊 月度环比数据</h3>
                    <div class="report-table-container">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th>月份</th>
                                    <th>当月盈亏</th>
                                    <th>上月盈亏</th>
                                    <th>环比变化</th>
                                    <th>变化率</th>
                                    <th>趋势</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthlyComparison.map((item, index) => {
                                    const trendIcon = item.trend === 'up' ? '📈' : item.trend === 'down' ? '📉' : '➖';
                                    const trendColor = item.trend === 'up' ? '#28a745' : item.trend === 'down' ? '#dc3545' : '#6c757d';

                                    return `
                                        <tr>
                                            <td style="font-weight: 600;">${item.currentMonth}</td>
                                            <td class="${item.currentProfit >= 0 ? 'profit' : 'loss'}">
                                                ${item.currentProfit >= 0 ? '+' : ''}¥${item.currentProfit.toFixed(2)}
                                            </td>
                                            <td class="${item.previousProfit >= 0 ? 'profit' : 'loss'}">
                                                ${item.previousProfit >= 0 ? '+' : ''}¥${item.previousProfit.toFixed(2)}
                                            </td>
                                            <td class="${item.profitChange >= 0 ? 'profit' : 'loss'}">
                                                ${item.profitChange >= 0 ? '+' : ''}¥${item.profitChange.toFixed(2)}
                                            </td>
                                            <td class="${item.profitChangeRate >= 0 ? 'profit' : 'loss'}">
                                                ${item.profitChangeRate >= 0 ? '+' : ''}${item.profitChangeRate.toFixed(2)}%
                                            </td>
                                            <td>
                                                <span style="color: ${trendColor}; font-size: 18px;">${trendIcon}</span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * 渲染最佳/最差月份
     */
    renderBestWorstMonths() {
        const { bestWorstMonths, monthlyProfit } = this.reportData;

        if (!bestWorstMonths) {
            return '<div class="report-empty">暂无月度排名数据</div>';
        }

        // 从monthlyProfit中获取排名数据
        const sortedByProfit = monthlyProfit ? [...monthlyProfit].sort((a, b) => b.totalProfit - a.totalProfit) : [];
        const topPerformers = sortedByProfit.slice(0, Math.min(5, sortedByProfit.length));
        const bottomPerformers = sortedByProfit.slice(Math.max(0, sortedByProfit.length - 5)).reverse();

        return `
            <div class="report-section">
                <h3 class="section-title">🏆 月度表现排名</h3>

                ${bestWorstMonths.bestMonth ? `
                    <div class="highlight-section profit-highlight" style="margin-bottom: 32px;">
                        <h4 style="color: #28a745; font-size: 20px; margin-bottom: 20px;">🎉 最佳月份</h4>
                        <div class="summary-cards" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
                            <div class="summary-card">
                                <div class="card-label">月份</div>
                                <div class="card-value" style="font-size: 18px; color: #28a745;">${bestWorstMonths.bestMonth.month}</div>
                            </div>
                            <div class="summary-card profit">
                                <div class="card-label">收益金额</div>
                                <div class="card-value" style="font-size: 20px;">+¥${bestWorstMonths.bestMonth.profit.toFixed(2)}</div>
                                <div class="card-sub">成功率: ${bestWorstMonths.bestMonth.successRate.toFixed(1)}%</div>
                            </div>
                            <div class="summary-card">
                                <div class="card-label">交易次数</div>
                                <div class="card-value" style="font-size: 18px;">${bestWorstMonths.bestMonth.tradeCount} 笔</div>
                            </div>
                            <div class="summary-card">
                                <div class="card-label">盈利笔数</div>
                                <div class="card-value" style="font-size: 16px;">${bestWorstMonths.bestMonth.profitableTrades} 笔</div>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${bestWorstMonths.worstMonth ? `
                    <div class="highlight-section ${bestWorstMonths.worstMonth.profit < 0 ? 'loss-highlight' : 'profit-highlight'}" style="opacity: 0.85;">
                        <h4 style="color: ${bestWorstMonths.worstMonth.profit < 0 ? '#dc3545' : '#28a745'}; font-size: 20px; margin-bottom: 20px;">
                            ${bestWorstMonths.worstMonth.profit < 0 ? '⚠️ 最差月份（亏损）' : '📉 表现最弱月份'}
                        </h4>
                        <div class="summary-cards" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
                            <div class="summary-card">
                                <div class="card-label">月份</div>
                                <div class="card-value" style="font-size: 18px; color: ${bestWorstMonths.worstMonth.profit < 0 ? '#dc3545' : '#28a745'};">${bestWorstMonths.worstMonth.month}</div>
                            </div>
                            <div class="summary-card ${bestWorstMonths.worstMonth.profit < 0 ? 'loss' : 'profit'}">
                                <div class="card-label">${bestWorstMonths.worstMonth.profit < 0 ? '亏损金额' : '盈利金额'}</div>
                                <div class="card-value" style="font-size: 20px; color: ${bestWorstMonths.worstMonth.profit < 0 ? '#dc3545' : '#28a745'};">
                                    ${bestWorstMonths.worstMonth.profit >= 0 ? '+' : ''}¥${bestWorstMonths.worstMonth.profit.toFixed(2)}
                                </div>
                                <div class="card-sub" style="color: ${bestWorstMonths.worstMonth.profit < 0 ? '#dc3545' : '#28a745'};">
                                    ${bestWorstMonths.worstMonth.profit < 0
                                        ? `亏损率: ${bestWorstMonths.worstMonth.lossRate.toFixed(1)}%`
                                        : `成功率: ${(bestWorstMonths.worstMonth.tradeCount > 0 ? (bestWorstMonths.worstMonth.profitableTrades || 0) / bestWorstMonths.worstMonth.tradeCount * 100 : 0).toFixed(1)}%`}
                                </div>
                            </div>
                            <div class="summary-card">
                                <div class="card-label">交易次数</div>
                                <div class="card-value" style="font-size: 18px;">${bestWorstMonths.worstMonth.tradeCount} 笔</div>
                            </div>
                            <div class="summary-card">
                                <div class="card-label">${bestWorstMonths.worstMonth.profit < 0 ? '亏损笔数' : '盈利笔数'}</div>
                                <div class="card-value" style="font-size: 16px;">
                                    ${bestWorstMonths.worstMonth.profit < 0 ? bestWorstMonths.worstMonth.lossTrades : (bestWorstMonths.worstMonth.profitableTrades || 0)} 笔
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${topPerformers.length > 0 ? `
                    <div class="report-section">
                        <h3 class="section-title">📈 表现优秀月份 (前${topPerformers.length}名)</h3>
                        <div class="report-table-container">
                            <table class="report-table">
                                <thead>
                                    <tr>
                                        <th>排名</th>
                                        <th>月份</th>
                                        <th>收益金额</th>
                                        <th>交易次数</th>
                                        <th>成功率</th>
                                        <th>盈利笔数</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topPerformers.map((item, index) => `
                                        <tr class="${index === 0 ? 'best-month' : ''}">
                                            <td>
                                                ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                                            </td>
                                            <td style="font-weight: 600;">${item.month}</td>
                                            <td class="profit" style="font-weight: 600;">
                                                ${item.totalProfit >= 0 ? '+' : ''}¥${item.totalProfit.toFixed(2)}
                                            </td>
                                            <td>${item.tradeCount || 0} 笔</td>
                                            <td style="color: #28a745; font-weight: 600;">
                                                ${((item.profitableTrades / Math.max(1, item.tradeCount)) * 100).toFixed(1)}%
                                            </td>
                                            <td>${item.profitableTrades || 0} 笔</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}

                ${bottomPerformers.length > 0 ? `
                    <div class="report-section">
                        <h3 class="section-title">📉 表现欠佳月份 (后${bottomPerformers.length}名)</h3>
                        <div class="report-table-container">
                            <table class="report-table">
                                <thead>
                                    <tr>
                                        <th>排名</th>
                                        <th>月份</th>
                                        <th>亏损金额</th>
                                        <th>交易次数</th>
                                        <th>成功率</th>
                                        <th>亏损笔数</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${bottomPerformers.map((item, index) => `
                                        <tr class="${index === 0 ? 'worst-month' : ''}">
                                            <td>${index + 1}</td>
                                            <td style="font-weight: 600;">${item.month}</td>
                                            <td class="loss" style="font-weight: 600;">
                                                ¥${item.totalProfit.toFixed(2)}
                                            </td>
                                            <td>${item.tradeCount || 0} 笔</td>
                                            <td style="color: ${((item.profitableTrades / Math.max(1, item.tradeCount)) * 100) >= 50 ? '#28a745' : '#dc3545'}; font-weight: 600;">
                                                ${((item.profitableTrades / Math.max(1, item.tradeCount)) * 100).toFixed(1)}%
                                            </td>
                                            <td>${item.lossTrades || 0} 笔</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * 渲染月度操作回顾
     */
    renderMonthlyReview() {
        const { monthlyReview } = this.reportData;

        // 调试：打印月度回顾数据
        console.log('monthlyReview 数据:', monthlyReview);
        console.log('monthlyReview 长度:', monthlyReview ? monthlyReview.length : 0);

        if (!monthlyReview || monthlyReview.length === 0) {
            return '<div class="report-empty">暂无月度回顾数据</div>';
        }

        return `
            <div class="report-section">
                <h3 class="section-title">📝 月度操作回顾</h3>
                <p style="color: #6c757d; margin-bottom: 24px;">
                    详细的月度操作总结，包括交易记录、盈亏分析和股票分布
                </p>

                ${monthlyReview.map((review, index) => {
                    const successRate = review.summary ? review.summary.successRate : 0;
                    const profitableTrades = review.summary ? review.summary.profitableTrades : 0;
                    const lossTrades = review.summary ? review.summary.lossTrades : 0;

                    return `
                        <div style="margin-bottom: 32px; padding: 24px; background: ${index === 0 ? '#fff3cd' : '#d1ecf1'}; border-radius: 12px; border: 3px solid ${index === 0 ? '#ffc107' : '#0dcaf0'}; border-left: 8px solid ${review.totalProfit >= 0 ? '#28a745' : '#dc3545'};">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                                <div>
                                    <h4 style="margin: 0; color: #2c3e50; font-size: 20px; font-weight: 700;">
                                        📅 ${review.month} ${index === 0 ? '(第1个月)' : '(第2个月)'}
                                    </h4>
                                    <p style="margin: 8px 0 0 0; color: #6c757d; font-size: 14px;">
                                        月度交易总结
                                    </p>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 24px; font-weight: 700; color: ${review.totalProfit >= 0 ? '#28a745' : '#dc3545'};">
                                        ${review.totalProfit >= 0 ? '+' : ''}¥${review.totalProfit.toFixed(2)}
                                    </div>
                                    <div style="font-size: 14px; color: #6c757d; margin-top: 4px;">
                                        ${review.tradeCount} 笔交易
                                    </div>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 20px;">
                                <div style="padding: 12px; background: white; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">交易次数</div>
                                    <div style="font-size: 18px; font-weight: 700; color: #007bff;">${review.tradeCount} 笔</div>
                                </div>
                                <div style="padding: 12px; background: white; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">成功率</div>
                                    <div style="font-size: 18px; font-weight: 700; color: ${successRate >= 50 ? '#28a745' : '#dc3545'};">${successRate.toFixed(1)}%</div>
                                </div>
                                <div style="padding: 12px; background: white; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">盈利笔数</div>
                                    <div style="font-size: 18px; font-weight: 700; color: #28a745;">${profitableTrades} 笔</div>
                                </div>
                                <div style="padding: 12px; background: white; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">亏损笔数</div>
                                    <div style="font-size: 18px; font-weight: 700; color: #dc3545;">${lossTrades} 笔</div>
                                </div>
                                <div style="padding: 12px; background: white; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">操作股票数</div>
                                    <div style="font-size: 18px; font-weight: 700; color: #6c757d;">${review.stockCount} 只</div>
                                </div>
                            </div>

                            ${review.mostActiveStock ? `
                                <div style="padding: 16px; background: white; border-radius: 8px; border-left: 3px solid #007bff;">
                                    <h5 style="margin: 0 0 12px 0; color: #007bff; font-size: 14px; font-weight: 600;">📌 最活跃股票</h5>
                                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                                        <div>
                                            <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">股票代码</div>
                                            <div style="font-size: 16px; font-weight: 600; color: #2c3e50;">${review.mostActiveStock.stockCode}</div>
                                        </div>
                                        <div>
                                            <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">股票名称</div>
                                            <div style="font-size: 16px; font-weight: 600; color: #2c3e50;">${review.mostActiveStock.stockName}</div>
                                        </div>
                                        <div>
                                            <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">买入次数</div>
                                            <div style="font-size: 16px; font-weight: 600; color: #28a745;">${review.mostActiveStock.buyCount} 笔</div>
                                        </div>
                                        <div>
                                            <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">卖出次数</div>
                                            <div style="font-size: 16px; font-weight: 600; color: #dc3545;">${review.mostActiveStock.sellCount} 笔</div>
                                        </div>
                                        <div>
                                            <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">买入金额</div>
                                            <div style="font-size: 16px; font-weight: 600; color: #2c3e50;">¥${review.mostActiveStock.buyAmount.toFixed(2)}</div>
                                        </div>
                                        <div>
                                            <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">卖出金额</div>
                                            <div style="font-size: 16px; font-weight: 600; color: #2c3e50;">¥${review.mostActiveStock.sellAmount.toFixed(2)}</div>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * 渲染年度收益总结
     */
    renderYearlySummary() {
        const summary = this.reportData.yearlySummary;
        return `
            <div class="report-section">
                <h3 class="section-title">📊 ${this.reportData.year}年度收益总结</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">总收益</div>
                        <div class="stat-value ${summary.totalProfit >= 0 ? 'profit' : 'loss'}">
                            ¥${summary.totalProfit.toFixed(2)}
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">年化收益率</div>
                        <div class="stat-value ${summary.returnRate >= 0 ? 'profit' : 'loss'}">
                            ${summary.returnRate.toFixed(2)}%
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">已实现收益</div>
                        <div class="stat-value ${summary.realizedProfit >= 0 ? 'profit' : 'loss'}">
                            ¥${summary.realizedProfit.toFixed(2)}
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">未实现收益</div>
                        <div class="stat-value ${summary.unrealizedProfit >= 0 ? 'profit' : 'loss'}">
                            ¥${summary.unrealizedProfit.toFixed(2)}
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">总投入</div>
                        <div class="stat-value">¥${summary.totalInvestment.toFixed(2)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">总产出</div>
                        <div class="stat-value">¥${summary.totalRevenue.toFixed(2)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">总手续费</div>
                        <div class="stat-value loss">¥${summary.totalFees.toFixed(2)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">成功率</div>
                        <div class="stat-value ${summary.successRate >= 50 ? 'profit' : 'loss'}">
                            ${summary.successRate.toFixed(2)}%
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 渲染年度交易统计
     */
    renderYearlyTradeStats() {
        const stats = this.reportData.yearlyTrades;
        return `
            <div class="report-section">
                <h3 class="section-title">📈 ${this.reportData.year}年度交易统计</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">总交易次数</div>
                        <div class="stat-value">${stats.totalTrades}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">买入次数</div>
                        <div class="stat-value profit">${stats.buyCount}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">卖出次数</div>
                        <div class="stat-value loss">${stats.sellCount}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">交易股票数</div>
                        <div class="stat-value">${stats.stockCount}</div>
                    </div>
                </div>

                <h4 style="margin-top: 30px; margin-bottom: 15px;">💰 金额统计</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">买入金额</div>
                        <div class="stat-value">¥${stats.buyAmount.toFixed(2)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">卖出金额</div>
                        <div class="stat-value">¥${stats.sellAmount.toFixed(2)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">总交易金额</div>
                        <div class="stat-value">¥${stats.totalAmount.toFixed(2)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">总手续费</div>
                        <div class="stat-value loss">¥${stats.totalFees.toFixed(2)}</div>
                    </div>
                </div>

                <h4 style="margin-top: 30px; margin-bottom: 15px;">📊 按月统计</h4>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>月份</th>
                                <th>交易次数</th>
                                <th>买入</th>
                                <th>卖出</th>
                                <th>金额</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stats.byMonth.map(m => `
                                <tr>
                                    <td>${m.monthName}</td>
                                    <td>${m.count}</td>
                                    <td class="profit">${m.buyCount}</td>
                                    <td class="loss">${m.sellCount}</td>
                                    <td>¥${m.amount.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * 渲染年度盈亏分析
     */
    renderYearlyProfitAnalysis() {
        const analysis = this.reportData.yearlyProfitLoss;
        return `
            <div class="report-section">
                <h3 class="section-title">💰 ${this.reportData.year}年度盈亏分析</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">总盈亏</div>
                        <div class="stat-value ${analysis.totalProfit >= 0 ? 'profit' : 'loss'}">
                            ¥${analysis.totalProfit.toFixed(2)}
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">已实现盈亏</div>
                        <div class="stat-value ${analysis.realizedProfit >= 0 ? 'profit' : 'loss'}">
                            ¥${analysis.realizedProfit.toFixed(2)}
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">未实现盈亏</div>
                        <div class="stat-value ${analysis.unrealizedProfit >= 0 ? 'profit' : 'loss'}">
                            ¥${analysis.unrealizedProfit.toFixed(2)}
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">盈利笔数</div>
                        <div class="stat-value profit">${analysis.profitableCount}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">亏损笔数</div>
                        <div class="stat-value loss">${analysis.lossCount}</div>
                    </div>
                </div>

                <h4 style="margin-top: 30px; margin-bottom: 15px;">📊 盈亏分布</h4>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>盈亏区间</th>
                                <th>笔数</th>
                                <th>占比</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${analysis.profitDistribution.map(d => `
                                <tr>
                                    <td>${d.label}</td>
                                    <td>${d.count}</td>
                                    <td>${d.percentage.toFixed(1)}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * 渲染最佳/最差操作
     */
    renderYearlyBestWorst() {
        const bestWorst = this.reportData.bestWorstTrades;

        if (!bestWorst.bestTrade) {
            return `
                <div class="report-section">
                    <div class="empty-state">
                        <div class="empty-icon">📊</div>
                        <div class="empty-text">暂无已实现交易数据</div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="report-section">
                <h3 class="section-title">🏆 ${this.reportData.year}年度最佳/最差操作</h3>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 20px;">
                    <div style="padding: 20px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #28a745;">
                        <h4 style="color: #28a745; margin-bottom: 15px;">🎯 最高收益交易</h4>
                        <p><strong>股票:</strong> ${bestWorst.bestTrade.stockName} (${bestWorst.bestTrade.stockCode})</p>
                        <p><strong>买入日期:</strong> ${bestWorst.bestTrade.buyDate}</p>
                        <p><strong>卖出日期:</strong> ${bestWorst.bestTrade.sellDate}</p>
                        <p><strong>收益:</strong> <span class="profit">¥${bestWorst.bestTrade.profit.toFixed(2)}</span></p>
                        <p><strong>收益率:</strong> <span class="profit">${bestWorst.bestTrade.profitRate.toFixed(2)}%</span></p>
                    </div>

                    <div style="padding: 20px; background: #fff5f5; border-radius: 8px; border-left: 4px solid #dc3545;">
                        <h4 style="color: #dc3545; margin-bottom: 15px;">💔 最大亏损交易</h4>
                        <p><strong>股票:</strong> ${bestWorst.worstTrade.stockName} (${bestWorst.worstTrade.stockCode})</p>
                        <p><strong>买入日期:</strong> ${bestWorst.worstTrade.buyDate}</p>
                        <p><strong>卖出日期:</strong> ${bestWorst.worstTrade.sellDate}</p>
                        <p><strong>亏损:</strong> <span class="loss">¥${bestWorst.worstTrade.profit.toFixed(2)}</span></p>
                        <p><strong>亏损率:</strong> <span class="loss">${bestWorst.worstTrade.profitRate.toFixed(2)}%</span></p>
                    </div>

                    <div style="padding: 20px; background: #f0fff4; border-radius: 8px; border-left: 4px solid #28a745;">
                        <h4 style="color: #28a745; margin-bottom: 15px;">📈 最高收益率交易</h4>
                        <p><strong>股票:</strong> ${bestWorst.bestProfitRate.stockName} (${bestWorst.bestProfitRate.stockCode})</p>
                        <p><strong>收益率:</strong> <span class="profit">${bestWorst.bestProfitRate.profitRate.toFixed(2)}%</span></p>
                        <p><strong>收益:</strong> <span class="profit">¥${bestWorst.bestProfitRate.profit.toFixed(2)}</span></p>
                    </div>

                    <div style="padding: 20px; background: #fff0f0; border-radius: 8px; border-left: 4px solid #dc3545;">
                        <h4 style="color: #dc3545; margin-bottom: 15px;">📉 最低收益率交易</h4>
                        <p><strong>股票:</strong> ${bestWorst.worstProfitRate.stockName} (${bestWorst.worstProfitRate.stockCode})</p>
                        <p><strong>亏损率:</strong> <span class="loss">${bestWorst.worstProfitRate.profitRate.toFixed(2)}%</span></p>
                        <p><strong>亏损:</strong> <span class="loss">¥${bestWorst.worstProfitRate.profit.toFixed(2)}</span></p>
                    </div>

                    <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #6c757d;">
                        <h4 style="color: #6c757d; margin-bottom: 15px;">⏱️ 最长持有</h4>
                        <p><strong>股票:</strong> ${bestWorst.longestHold.stockName} (${bestWorst.longestHold.stockCode})</p>
                        <p><strong>持有天数:</strong> ${bestWorst.longestHold.holdDays} 天</p>
                        <p><strong>收益:</strong> <span class="${bestWorst.longestHold.profit >= 0 ? 'profit' : 'loss'}">¥${bestWorst.longestHold.profit.toFixed(2)}</span></p>
                    </div>

                    <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #6c757d;">
                        <h4 style="color: #6c757d; margin-bottom: 15px;">⚡ 最短持有</h4>
                        <p><strong>股票:</strong> ${bestWorst.shortestHold.stockName} (${bestWorst.shortestHold.stockCode})</p>
                        <p><strong>持有天数:</strong> ${bestWorst.shortestHold.holdDays} 天</p>
                        <p><strong>收益:</strong> <span class="${bestWorst.shortestHold.profit >= 0 ? 'profit' : 'loss'}">¥${bestWorst.shortestHold.profit.toFixed(2)}</span></p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 渲染年度投资回顾
     */
    renderYearlyReview() {
        const review = this.reportData.yearlyReview;
        return `
            <div class="report-section">
                <h3 class="section-title">📝 ${this.reportData.year}年度投资回顾</h3>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">年度总收益</div>
                        <div class="stat-value ${review.summary.totalProfit >= 0 ? 'profit' : 'loss'}">
                            ¥${review.summary.totalProfit.toFixed(2)}
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">年化收益率</div>
                        <div class="stat-value ${review.summary.returnRate >= 0 ? 'profit' : 'loss'}">
                            ${review.summary.returnRate.toFixed(2)}%
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">总交易次数</div>
                        <div class="stat-value">${review.summary.totalTrades}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">交易股票数</div>
                        <div class="stat-value">${review.summary.stockCount}</div>
                    </div>
                </div>

                <h4 style="margin-top: 30px; margin-bottom: 15px;">📊 季度表现</h4>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>季度</th>
                                <th>收益</th>
                                <th>交易次数</th>
                                <th>股票数</th>
                                <th>平均收益</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${review.quarterly.map(q => `
                                <tr>
                                    <td>${q.name}</td>
                                    <td class="${q.profit >= 0 ? 'profit' : 'loss'}">¥${q.profit.toFixed(2)}</td>
                                    <td>${q.trades}</td>
                                    <td>${q.stockCount}</td>
                                    <td class="${q.avgProfit >= 0 ? 'profit' : 'loss'}">¥${q.avgProfit.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <h4 style="margin-top: 30px; margin-bottom: 15px;">🔥 最活跃股票</h4>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>股票代码</th>
                                <th>股票名称</th>
                                <th>交易次数</th>
                                <th>交易金额</th>
                                <th>收益</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${review.mostActiveStocks.map(stock => `
                                <tr>
                                    <td>${stock.stockCode}</td>
                                    <td>${stock.stockName}</td>
                                    <td>${stock.tradeCount}</td>
                                    <td>¥${stock.totalAmount.toFixed(2)}</td>
                                    <td class="${stock.profit >= 0 ? 'profit' : 'loss'}">¥${stock.profit.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * ========== 内联报表加载函数 ==========
     * 这些函数用于直接在页面中显示报表，而不是使用弹窗
     */

    /**
     * 加载持仓报表（内联显示）
     */
    async loadPositionReportInline() {
        const container = document.getElementById('report-content-holder');
        if (!container) return;

        this.reportType = 'position';
        this.renderInlineReport(container, '📊 持仓报表', this.getPositionTabs());

        // 等待DOM更新后，在容器内查找reportContent
        await this.$nextTick();
        const reportContent = container.querySelector('#reportContent');
        await this.loadReportData(reportContent);
    },

    /**
     * 加载交易报表（内联显示）
     */
    async loadTradeReportInline() {
        console.log('=== loadTradeReportInline 开始 ===');
        const container = document.getElementById('trade-report-content-holder');
        console.log('容器元素:', container);
        if (!container) {
            console.error('未找到 trade-report-content-holder 容器');
            return;
        }

        this.reportType = 'trade';
        console.log('渲染内联报表...');
        this.renderInlineReport(container, '📋 交易报表', this.getTradeTabs());

        // 等待DOM更新后，在容器内查找reportContent
        console.log('等待 DOM 更新...');
        await this.$nextTick();
        const reportContent = container.querySelector('#reportContent');
        console.log('reportContent 元素:', reportContent);

        if (!reportContent) {
            console.error('未找到 reportContent 元素');
            return;
        }

        console.log('开始加载报表数据...');
        await this.loadReportData(reportContent);
        console.log('=== loadTradeReportInline 结束 ===');
    },

    /**
     * 加载盈亏报表（内联显示）
     */
    async loadProfitLossReportInline() {
        const container = document.getElementById('profit-report-content-holder');
        if (!container) return;

        this.reportType = 'profit-loss';
        this.renderInlineReport(container, '💰 盈亏报表', this.getProfitLossTabs());

        // 等待DOM更新后，在容器内查找reportContent
        await this.$nextTick();
        const reportContent = container.querySelector('#reportContent');
        await this.loadReportData(reportContent);
    },

    /**
     * 加载月度报表（内联显示）
     */
    async loadMonthlyReportInline() {
        const container = document.getElementById('monthly-report-content-holder');
        if (!container) return;

        this.reportType = 'monthly';
        this.renderInlineReport(container, '📅 月度报表', this.getMonthlyTabs());

        // 等待DOM更新后，在容器内查找reportContent
        await this.$nextTick();
        const reportContent = container.querySelector('#reportContent');
        await this.loadReportData(reportContent);
    },

    /**
     * 加载年度报表（内联显示）
     */
    async loadYearlyReportInline() {
        const container = document.getElementById('yearly-report-content-holder');
        if (!container) return;

        this.reportType = 'yearly';
        this.renderInlineReport(container, '🗓️ 年度报表', this.getYearlyTabs());

        // 等待DOM更新后，在容器内查找reportContent
        await this.$nextTick();
        const reportContent = container.querySelector('#reportContent');
        await this.loadReportData(reportContent);
    },

    /**
     * 等待DOM更新（简单的延迟实现）
     */
    $nextTick() {
        return new Promise(resolve => setTimeout(resolve, 0));
    },

    /**
     * 渲染内联报表容器
     */
    renderInlineReport(container, title, tabs) {
        container.innerHTML = `
            <div class="inline-report-wrapper">
                <div class="report-header-inline">
                    <h2>${title}</h2>
                </div>
                <div class="report-tabs">
                    ${tabs}
                </div>
                <div class="report-content" id="reportContent">
                    <div class="report-loading">
                        <div class="spinner"></div>
                        <p>正在加载报表数据...</p>
                    </div>
                </div>
            </div>
        `;

        // 根据报表类型设置初始标签
        if (this.reportType === 'monthly') {
            this.currentTab = 'profit-stats';
        } else if (this.reportType === 'yearly') {
            this.currentTab = 'summary';
        } else {
            this.currentTab = 'summary';
        }
    }
};

// 导出到全局
window.ReportManager = ReportManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    ReportManager.init();
});
