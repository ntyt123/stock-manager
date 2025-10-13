/**
 * 盈亏分析管理模块
 * 负责加载和展示盈亏分析数据
 */

const ProfitAnalysisManager = {
    // 图表实例
    profitTrendChart: null,
    profitDistributionChart: null,

    /**
     * 初始化盈亏分析
     */
    async init() {
        console.log('初始化盈亏分析模块...');
        await this.loadProfitAnalysis();
    },

    /**
     * 加载盈亏分析数据
     */
    async loadProfitAnalysis() {
        const container = document.getElementById('profitAnalysisContent');
        if (!container) return;

        try {
            // 显示加载状态
            container.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">正在加载盈亏分析数据...</div>';

            // 检查是否登录
            const token = localStorage.getItem('token');
            if (!token) {
                container.innerHTML = `
                    <div class="info-message">
                        <div class="info-icon">ℹ️</div>
                        <div class="info-title">请先登录</div>
                        <div class="info-desc">查看盈亏分析需要先登录账户</div>
                        <button class="action-btn" onclick="goToLogin()">前往登录</button>
                    </div>
                `;
                return;
            }

            // 并行获取所有数据
            const [overallRes, stocksRes, trendRes, rankingRes, distributionRes] = await Promise.all([
                this.fetchOverallStats(),
                this.fetchStockDetails(),
                this.fetchProfitTrend(),
                this.fetchProfitRanking(),
                this.fetchProfitDistribution()
            ]);

            // 渲染界面
            this.renderProfitAnalysis(overallRes, stocksRes, trendRes, rankingRes, distributionRes);

        } catch (error) {
            console.error('加载盈亏分析失败:', error);
            container.innerHTML = `
                <div class="error-message">
                    <div class="error-icon">❌</div>
                    <div class="error-title">加载失败</div>
                    <div class="error-desc">${error.message}</div>
                    <button class="action-btn" onclick="ProfitAnalysisManager.loadProfitAnalysis()">重试</button>
                </div>
            `;
        }
    },

    /**
     * 获取总体盈亏统计
     */
    async fetchOverallStats() {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/profit-analysis/overall', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取总体盈亏统计失败');
        }

        const result = await response.json();
        return result.data;
    },

    /**
     * 获取股票盈亏明细
     */
    async fetchStockDetails() {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/profit-analysis/stocks', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取股票盈亏明细失败');
        }

        const result = await response.json();
        return result.data;
    },

    /**
     * 获取盈亏趋势
     */
    async fetchProfitTrend() {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/profit-analysis/trend', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取盈亏趋势失败');
        }

        const result = await response.json();
        return result.data;
    },

    /**
     * 获取盈亏排名
     */
    async fetchProfitRanking() {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/profit-analysis/ranking?limit=5', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取盈亏排名失败');
        }

        const result = await response.json();
        return result.data;
    },

    /**
     * 获取盈亏分布
     */
    async fetchProfitDistribution() {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/profit-analysis/distribution', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取盈亏分布失败');
        }

        const result = await response.json();
        return result.data;
    },

    /**
     * 渲染盈亏分析界面
     */
    renderProfitAnalysis(overall, stocks, trend, ranking, distribution) {
        const container = document.getElementById('profitAnalysisContent');

        const html = `
            <!-- 总体盈亏概览 -->
            <div class="profit-overview-section">
                <div class="section-header">
                    <h3>💰 总体盈亏概览</h3>
                </div>
                <div class="profit-stats-grid">
                    <div class="profit-stat-card ${overall.overview.totalProfitLoss >= 0 ? 'profit' : 'loss'}">
                        <div class="stat-label">总盈亏</div>
                        <div class="stat-value">¥${this.formatNumber(overall.overview.totalProfitLoss)}</div>
                        <div class="stat-badge ${overall.overview.totalReturn >= 0 ? 'badge-success' : 'badge-danger'}">
                            ${overall.overview.totalReturn >= 0 ? '▲' : '▼'} ${Math.abs(overall.overview.totalReturn).toFixed(2)}%
                        </div>
                    </div>
                    <div class="profit-stat-card info">
                        <div class="stat-label">总投入</div>
                        <div class="stat-value">¥${this.formatNumber(overall.overview.totalInvestment)}</div>
                    </div>
                    <div class="profit-stat-card success">
                        <div class="stat-label">累计盈利</div>
                        <div class="stat-value">¥${this.formatNumber(overall.overview.totalProfit)}</div>
                    </div>
                    <div class="profit-stat-card danger">
                        <div class="stat-label">累计亏损</div>
                        <div class="stat-value">¥${this.formatNumber(overall.overview.totalLoss)}</div>
                    </div>
                </div>

                <!-- 已实现 vs 未实现盈亏 -->
                <div class="profit-breakdown">
                    <div class="breakdown-item">
                        <div class="breakdown-header">
                            <span class="breakdown-icon">📊</span>
                            <span class="breakdown-title">已实现盈亏</span>
                        </div>
                        <div class="breakdown-stats">
                            <div class="breakdown-row">
                                <span class="label">盈利：</span>
                                <span class="value success">¥${this.formatNumber(overall.realized.profit)}</span>
                            </div>
                            <div class="breakdown-row">
                                <span class="label">亏损：</span>
                                <span class="value danger">¥${this.formatNumber(overall.realized.loss)}</span>
                            </div>
                            <div class="breakdown-row total">
                                <span class="label">合计：</span>
                                <span class="value ${overall.realized.total >= 0 ? 'success' : 'danger'}">
                                    ¥${this.formatNumber(overall.realized.total)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="breakdown-item">
                        <div class="breakdown-header">
                            <span class="breakdown-icon">📈</span>
                            <span class="breakdown-title">未实现盈亏（持仓浮盈浮亏）</span>
                        </div>
                        <div class="breakdown-stats">
                            <div class="breakdown-row">
                                <span class="label">浮盈：</span>
                                <span class="value success">¥${this.formatNumber(overall.unrealized.profit)}</span>
                            </div>
                            <div class="breakdown-row">
                                <span class="label">浮亏：</span>
                                <span class="value danger">¥${this.formatNumber(overall.unrealized.loss)}</span>
                            </div>
                            <div class="breakdown-row total">
                                <span class="label">合计：</span>
                                <span class="value ${overall.unrealized.total >= 0 ? 'success' : 'danger'}">
                                    ¥${this.formatNumber(overall.unrealized.total)} (${overall.unrealized.rate.toFixed(2)}%)
                                </span>
                            </div>
                            <div class="breakdown-row">
                                <span class="label">持仓市值：</span>
                                <span class="value">¥${this.formatNumber(overall.unrealized.marketValue)}</span>
                            </div>
                            <div class="breakdown-row">
                                <span class="label">持仓成本：</span>
                                <span class="value">¥${this.formatNumber(overall.unrealized.cost)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 持仓统计 -->
                <div class="position-stats-bar">
                    <div class="stats-item">
                        <span class="label">持仓总数：</span>
                        <span class="value">${overall.positionStats.total}</span>
                    </div>
                    <div class="stats-item success">
                        <span class="label">盈利股票：</span>
                        <span class="value">${overall.positionStats.profit}</span>
                    </div>
                    <div class="stats-item danger">
                        <span class="label">亏损股票：</span>
                        <span class="value">${overall.positionStats.loss}</span>
                    </div>
                    <div class="stats-item">
                        <span class="label">持平股票：</span>
                        <span class="value">${overall.positionStats.flat}</span>
                    </div>
                    <div class="stats-item">
                        <span class="label">胜率：</span>
                        <span class="value">${overall.positionStats.profitRate}%</span>
                    </div>
                </div>
            </div>

            <!-- 盈亏排名 -->
            <div class="profit-ranking-section">
                <div class="section-header">
                    <h3>🏆 盈亏排行榜</h3>
                </div>
                <div class="ranking-grid">
                    <div class="ranking-panel">
                        <div class="panel-title success">💰 最赚钱的股票 TOP5</div>
                        <div class="ranking-list">
                            ${this.renderRankingList(ranking.topProfits, 'profit')}
                        </div>
                    </div>
                    <div class="ranking-panel">
                        <div class="panel-title danger">📉 最亏钱的股票 TOP5</div>
                        <div class="ranking-list">
                            ${this.renderRankingList(ranking.topLosses, 'loss')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- 盈亏分布 -->
            <div class="profit-distribution-section">
                <div class="section-header">
                    <h3>📊 盈亏分布</h3>
                </div>
                <div class="distribution-chart-container">
                    <canvas id="profitDistributionChart"></canvas>
                </div>
            </div>

            <!-- 股票盈亏明细 -->
            <div class="stock-profit-details-section">
                <div class="section-header">
                    <h3>📋 股票盈亏明细</h3>
                </div>
                <div class="profit-details-table">
                    ${this.renderStockDetailsTable(stocks)}
                </div>
            </div>

            <!-- 盈亏趋势图 -->
            ${trend && trend.length > 0 ? `
            <div class="profit-trend-section">
                <div class="section-header">
                    <h3>📈 盈亏趋势</h3>
                </div>
                <div class="trend-chart-container">
                    <canvas id="profitTrendChart"></canvas>
                </div>
            </div>
            ` : ''}
        `;

        container.innerHTML = html;

        // 延迟绘制图表，确保DOM已渲染且Chart.js已加载
        setTimeout(() => {
            try {
                this.renderProfitDistributionChart(distribution);
                if (trend && trend.length > 0) {
                    this.renderProfitTrendChart(trend);
                }
            } catch (error) {
                console.error('绘制图表失败:', error);
            }
        }, 100);
    },

    /**
     * 渲染排名列表
     */
    renderRankingList(items, type) {
        if (!items || items.length === 0) {
            return '<div class="empty-message">暂无数据</div>';
        }

        return items.map((item, index) => `
            <div class="ranking-item">
                <div class="rank-number">${index + 1}</div>
                <div class="stock-info">
                    <div class="stock-name">${item.stockName}</div>
                    <div class="stock-code">${item.stockCode}</div>
                </div>
                <div class="profit-info">
                    <div class="profit-amount ${type === 'profit' ? 'success' : 'danger'}">
                        ${type === 'profit' ? '+' : ''}¥${this.formatNumber(item.profitLoss)}
                    </div>
                    <div class="profit-rate ${item.profitLossRate >= 0 ? 'success' : 'danger'}">
                        ${item.profitLossRate >= 0 ? '+' : ''}${item.profitLossRate.toFixed(2)}%
                    </div>
                </div>
            </div>
        `).join('');
    },

    /**
     * 渲染股票明细表格
     */
    renderStockDetailsTable(stocks) {
        if (!stocks || stocks.length === 0) {
            return '<div class="empty-message">暂无持仓数据</div>';
        }

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>股票代码</th>
                        <th>股票名称</th>
                        <th>未实现盈亏</th>
                        <th>已实现盈亏</th>
                        <th>总盈亏</th>
                        <th>持仓状态</th>
                    </tr>
                </thead>
                <tbody>
                    ${stocks.map(stock => `
                        <tr>
                            <td>${stock.stockCode}</td>
                            <td>${stock.stockName}</td>
                            <td class="${stock.unrealizedProfitLoss >= 0 ? 'text-success' : 'text-danger'}">
                                ${stock.unrealizedProfitLoss >= 0 ? '+' : ''}¥${this.formatNumber(stock.unrealizedProfitLoss)}
                            </td>
                            <td class="${stock.realizedProfitLoss >= 0 ? 'text-success' : 'text-danger'}">
                                ${stock.realizedProfitLoss >= 0 ? '+' : ''}¥${this.formatNumber(stock.realizedProfitLoss)}
                            </td>
                            <td class="${stock.totalProfitLoss >= 0 ? 'text-success' : 'text-danger'}">
                                <strong>${stock.totalProfitLoss >= 0 ? '+' : ''}¥${this.formatNumber(stock.totalProfitLoss)}</strong>
                            </td>
                            <td>
                                ${stock.currentPosition ?
                                    `<span class="badge badge-info">持仓中</span>` :
                                    `<span class="badge badge-secondary">已清仓</span>`
                                }
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    /**
     * 渲染盈亏分布图表
     */
    renderProfitDistributionChart(distribution) {
        const canvas = document.getElementById('profitDistributionChart');
        if (!canvas) return;

        // 检查Chart.js是否加载
        if (typeof Chart === 'undefined') {
            console.error('Chart.js 未加载');
            return;
        }

        // 销毁旧图表
        if (this.profitDistributionChart) {
            this.profitDistributionChart.destroy();
        }

        const ctx = canvas.getContext('2d');
        this.profitDistributionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [
                    '亏损>20%', '亏损10-20%', '亏损5-10%', '亏损0-5%',
                    '持平',
                    '盈利0-5%', '盈利5-10%', '盈利10-20%', '盈利>20%'
                ],
                datasets: [{
                    label: '股票数量',
                    data: [
                        distribution.loss_over_20,
                        distribution.loss_10_to_20,
                        distribution.loss_5_to_10,
                        distribution.loss_0_to_5,
                        distribution.flat,
                        distribution.profit_0_to_5,
                        distribution.profit_5_to_10,
                        distribution.profit_10_to_20,
                        distribution.profit_over_20
                    ],
                    backgroundColor: [
                        '#dc3545', '#e74c3c', '#e67e73', '#ffb3b3',
                        '#6c757d',
                        '#b3d9b3', '#73c673', '#28a745', '#00b300'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: '股票盈亏分布图'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    },

    /**
     * 渲染盈亏趋势图表
     */
    renderProfitTrendChart(trend) {
        const canvas = document.getElementById('profitTrendChart');
        if (!canvas) return;

        // 检查Chart.js是否加载
        if (typeof Chart === 'undefined') {
            console.error('Chart.js 未加载');
            return;
        }

        // 销毁旧图表
        if (this.profitTrendChart) {
            this.profitTrendChart.destroy();
        }

        const ctx = canvas.getContext('2d');
        this.profitTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trend.map(item => item.date),
                datasets: [
                    {
                        label: '累计盈亏',
                        data: trend.map(item => item.cumulativeProfit),
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: '单日盈亏',
                        data: trend.map(item => item.dailyProfit),
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: '盈亏趋势图'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    },

    /**
     * 格式化数字
     */
    formatNumber(num) {
        if (num === null || num === undefined) return '0.00';
        return Math.abs(num).toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
};

// 导出到全局作用域
window.ProfitAnalysisManager = ProfitAnalysisManager;
