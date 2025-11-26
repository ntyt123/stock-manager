/**
 * 买入点验证管理模块
 * 提供股票买入点评分和验证功能
 */

const BuyPointValidationManager = {
    // 当前验证结果
    currentValidation: null,

    /**
     * 初始化模块
     */
    init() {
        console.log('📊 买入点验证管理器已初始化');
    },

    /**
     * 验证单个股票的买入点
     */
    async validateBuyPoint(stockCode, stockName) {
        try {
            console.log(`📊 开始验证股票 ${stockCode} (${stockName}) 的买入点...`);

            // 显示加载状态
            this.showLoading(stockCode, stockName);

            const response = await fetch('/api/buy-point-validation/validate', {
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

            if (!response.ok) {
                throw new Error('验证请求失败');
            }

            const result = await response.json();

            if (result.success) {
                this.currentValidation = result.data;
                this.showValidationResult(result.data);
            } else {
                throw new Error(result.message || '验证失败');
            }

        } catch (error) {
            console.error('验证失败:', error);
            showMessage('验证失败: ' + error.message, 'error');
            this.hideLoading();
        }
    },

    /**
     * 批量验证股票池
     */
    async batchValidate(stocks) {
        try {
            console.log(`📊 开始批量验证 ${stocks.length} 只股票...`);

            // 显示批量验证对话框
            this.showBatchValidationDialog(stocks);

            const response = await fetch('/api/buy-point-validation/batch-validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    stocks: stocks.map(s => ({
                        stockCode: s.code || s.stockCode,
                        stockName: s.name || s.stockName
                    }))
                })
            });

            if (!response.ok) {
                throw new Error('批量验证请求失败');
            }

            const result = await response.json();

            if (result.success) {
                this.showBatchValidationResults(result.data);
            } else {
                throw new Error(result.message || '批量验证失败');
            }

        } catch (error) {
            console.error('批量验证失败:', error);
            showMessage('批量验证失败: ' + error.message, 'error');
        }
    },

    /**
     * 获取历史验证记录
     */
    async getValidationHistory(stockCode = null, limit = 20, offset = 0) {
        try {
            let url = `/api/buy-point-validation/history?limit=${limit}&offset=${offset}`;
            if (stockCode) {
                url += `&stockCode=${stockCode}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('获取历史记录失败');
            }

            const result = await response.json();

            if (result.success) {
                this.showHistoryDialog(result.data);
            } else {
                throw new Error(result.message || '获取历史记录失败');
            }

        } catch (error) {
            console.error('获取历史记录失败:', error);
            showMessage('获取历史记录失败: ' + error.message, 'error');
        }
    },

    /**
     * 显示加载状态
     */
    showLoading(stockCode, stockName) {
        const existingOverlay = document.getElementById('buyPointValidationOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'buyPointValidationOverlay';
        overlay.className = 'validation-overlay';
        overlay.innerHTML = `
            <div class="validation-loading">
                <div class="loading-spinner"></div>
                <div class="loading-text">
                    <h3>正在验证买入点...</h3>
                    <p>${stockCode} ${stockName}</p>
                    <p class="loading-tip">正在分析技术指标和市场环境，请稍候...</p>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
    },

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const overlay = document.getElementById('buyPointValidationOverlay');
        if (overlay) {
            overlay.remove();
        }
    },

    /**
     * 显示验证结果
     */
    showValidationResult(data) {
        this.hideLoading();

        const overlay = document.createElement('div');
        overlay.id = 'buyPointValidationOverlay';
        overlay.className = 'validation-overlay';

        const ratingColor = this.getRatingColor(data.totalScore);
        const ratingIcon = this.getRatingIcon(data.ratingLevel);

        overlay.innerHTML = `
            <div class="validation-result-panel">
                <!-- 头部 -->
                <div class="validation-header">
                    <h2>买入点验证报告</h2>
                    <button class="close-btn" onclick="BuyPointValidationManager.hideResult()">&times;</button>
                </div>

                <!-- 股票信息 -->
                <div class="stock-info">
                    <div class="stock-basic">
                        <span class="stock-code">${data.stockCode}</span>
                        <span class="stock-name">${data.stockName}</span>
                        <span class="stock-price">¥${data.currentPrice ? data.currentPrice.toFixed(2) : '--'}</span>
                    </div>
                </div>

                <!-- 总体评分 -->
                <div class="overall-rating" style="background: linear-gradient(135deg, ${ratingColor}15, ${ratingColor}05);">
                    <div class="rating-circle" style="border-color: ${ratingColor};">
                        <div class="rating-score" style="color: ${ratingColor};">${data.totalScore}</div>
                        <div class="rating-label">总分</div>
                    </div>
                    <div class="rating-details">
                        <div class="rating-level">
                            <span class="rating-icon">${ratingIcon}</span>
                            <span class="rating-text" style="color: ${ratingColor};">${data.ratingLevel}</span>
                        </div>
                        <div class="rating-recommendation">
                            ${data.advice.recommendation}
                        </div>
                    </div>
                </div>

                <!-- 分维度得分 -->
                <div class="dimension-scores">
                    <div class="dimension-item">
                        <div class="dimension-header dimension-header-clickable" onclick="BuyPointValidationManager.toggleDimensionDetails(this)">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="expand-icon">▶</span>
                                <span class="dimension-name">技术分析</span>
                            </div>
                            <span class="dimension-score">${data.scores.technical_score}/40</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(data.scores.technical_score / 40 * 100)}%; background: #3b82f6;"></div>
                        </div>
                        <div class="sub-scores">
                            <span>趋势: ${data.scores.trend_score}</span>
                            <span>成交量: ${data.scores.volume_score}</span>
                            <span>指标: ${data.scores.indicator_score}</span>
                        </div>

                        <!-- 详细评分说明（默认折叠） -->
                        <div class="dimension-details" style="display: none;">
                            ${data.scores.trend_details ? `
                                <div class="detail-section">
                                    <div class="detail-title">
                                        <span class="detail-icon">📈</span>
                                        <strong>趋势分析 (${data.scores.trend_score}/15分)</strong>
                                    </div>
                                    <ul class="detail-list">
                                        ${data.scores.trend_details.map(detail => `<li>${detail}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}

                            ${data.scores.volume_details ? `
                                <div class="detail-section">
                                    <div class="detail-title">
                                        <span class="detail-icon">📊</span>
                                        <strong>成交量分析 (${data.scores.volume_score}/10分)</strong>
                                    </div>
                                    <ul class="detail-list">
                                        ${data.scores.volume_details.map(detail => `<li>${detail}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}

                            ${data.scores.indicator_details ? `
                                <div class="detail-section">
                                    <div class="detail-title">
                                        <span class="detail-icon">📉</span>
                                        <strong>指标分析 (${data.scores.indicator_score}/15分)</strong>
                                    </div>
                                    <ul class="detail-list">
                                        ${data.scores.indicator_details.map(detail => `<li>${detail}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="dimension-item">
                        <div class="dimension-header">
                            <span class="dimension-name">形态位置</span>
                            <span class="dimension-score">${data.scores.pattern_score}/25</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(data.scores.pattern_score / 25 * 100)}%; background: #8b5cf6;"></div>
                        </div>
                        <div class="sub-scores">
                            <span>K线形态: ${data.scores.kline_score}</span>
                            <span>支撑位: ${data.scores.support_score}</span>
                        </div>
                    </div>

                    <div class="dimension-item">
                        <div class="dimension-header">
                            <span class="dimension-name">市场环境</span>
                            <span class="dimension-score">${data.scores.market_score}/20</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(data.scores.market_score / 20 * 100)}%; background: #10b981;"></div>
                        </div>
                        <div class="sub-scores">
                            <span>大盘: ${data.scores.index_score}</span>
                            <span>板块: ${data.scores.sector_score}</span>
                        </div>
                    </div>

                    <div class="dimension-item">
                        <div class="dimension-header">
                            <span class="dimension-name">风险控制</span>
                            <span class="dimension-score">${data.scores.risk_score}/15</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(data.scores.risk_score / 15 * 100)}%; background: #f59e0b;"></div>
                        </div>
                        <div class="sub-scores">
                            <span>位置: ${data.scores.position_risk}</span>
                            <span>波动: ${data.scores.volatility_risk}</span>
                            <span>信号: ${data.scores.signal_risk}</span>
                        </div>
                    </div>
                </div>

                <!-- 技术指标 -->
                <div class="indicators-section">
                    <h3>技术指标</h3>
                    <div class="indicators-grid">
                        ${data.indicators.macd ? `
                            <div class="indicator-item">
                                <span class="indicator-name">MACD</span>
                                <span class="indicator-value">DIF: ${data.indicators.macd.dif || '--'}</span>
                            </div>
                        ` : ''}
                        ${data.indicators.kdj ? `
                            <div class="indicator-item">
                                <span class="indicator-name">KDJ</span>
                                <span class="indicator-value">K: ${data.indicators.kdj.k || '--'}</span>
                            </div>
                        ` : ''}
                        ${data.indicators.rsi ? `
                            <div class="indicator-item">
                                <span class="indicator-name">RSI</span>
                                <span class="indicator-value">${data.indicators.rsi}</span>
                            </div>
                        ` : ''}
                        ${data.indicators.ma5 ? `
                            <div class="indicator-item">
                                <span class="indicator-name">MA5</span>
                                <span class="indicator-value">${data.indicators.ma5}</span>
                            </div>
                        ` : ''}
                        ${data.indicators.ma10 ? `
                            <div class="indicator-item">
                                <span class="indicator-name">MA10</span>
                                <span class="indicator-value">${data.indicators.ma10}</span>
                            </div>
                        ` : ''}
                        ${data.indicators.ma20 ? `
                            <div class="indicator-item">
                                <span class="indicator-name">MA20</span>
                                <span class="indicator-value">${data.indicators.ma20}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- 操作建议 -->
                <div class="advice-section">
                    <h3>操作建议</h3>
                    <div class="advice-grid">
                        <div class="advice-item">
                            <label>建议仓位</label>
                            <div class="advice-value">${data.advice.positionAdvice}</div>
                        </div>
                        <div class="advice-item">
                            <label>买入价格区间</label>
                            <div class="advice-value">${data.advice.buyPriceRange}</div>
                        </div>
                        ${data.advice.stopLossPrice ? `
                            <div class="advice-item">
                                <label>止损价</label>
                                <div class="advice-value price">¥${data.advice.stopLossPrice}</div>
                            </div>
                        ` : ''}
                        ${data.advice.targetPrice ? `
                            <div class="advice-item">
                                <label>目标价</label>
                                <div class="advice-value price">¥${data.advice.targetPrice}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- 风险提示 -->
                ${data.advice.riskWarning ? `
                    <div class="risk-warning">
                        <div class="warning-icon">⚠️</div>
                        <div class="warning-text">${data.advice.riskWarning}</div>
                    </div>
                ` : ''}

                <!-- 底部操作按钮 -->
                <div class="validation-actions">
                    <button class="btn btn-secondary" onclick="BuyPointValidationManager.hideResult()">
                        关闭
                    </button>
                    <button class="btn btn-primary" onclick="BuyPointValidationManager.showHistory('${data.stockCode}')">
                        查看历史记录
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // 点击遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hideResult();
            }
        });
    },

    /**
     * 隐藏验证结果
     */
    hideResult() {
        const overlay = document.getElementById('buyPointValidationOverlay');
        if (overlay) {
            overlay.remove();
        }
    },

    /**
     * 显示批量验证对话框
     */
    showBatchValidationDialog(stocks) {
        const overlay = document.createElement('div');
        overlay.id = 'buyPointValidationOverlay';
        overlay.className = 'validation-overlay';
        overlay.innerHTML = `
            <div class="validation-loading">
                <div class="loading-spinner"></div>
                <div class="loading-text">
                    <h3>正在批量验证...</h3>
                    <p>共 ${stocks.length} 只股票</p>
                    <p class="loading-tip">正在分析中，请稍候...</p>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
    },

    /**
     * 显示批量验证结果
     */
    showBatchValidationResults(data) {
        this.hideLoading();

        const overlay = document.createElement('div');
        overlay.id = 'buyPointValidationOverlay';
        overlay.className = 'validation-overlay';

        // 生成结果列表HTML
        const resultsHTML = data.results.map(item => {
            const ratingColor = this.getRatingColor(item.totalScore);
            return `
                <tr class="result-row" onclick="BuyPointValidationManager.validateBuyPoint('${item.stockCode}', '${item.stockName}')">
                    <td>${item.stockCode}</td>
                    <td>${item.stockName}</td>
                    <td>
                        <div class="score-badge" style="background: ${ratingColor};">
                            ${item.totalScore}
                        </div>
                    </td>
                    <td>
                        <span class="rating-badge" style="color: ${ratingColor};">
                            ${item.ratingLevel}
                        </span>
                    </td>
                    <td>
                        <button class="btn-link">查看详情</button>
                    </td>
                </tr>
            `;
        }).join('');

        overlay.innerHTML = `
            <div class="validation-result-panel">
                <div class="validation-header">
                    <h2>批量验证结果</h2>
                    <button class="close-btn" onclick="BuyPointValidationManager.hideResult()">&times;</button>
                </div>

                <div class="batch-summary">
                    <div class="summary-item">
                        <label>总数</label>
                        <span>${data.total}</span>
                    </div>
                    <div class="summary-item">
                        <label>成功</label>
                        <span class="success">${data.successCount}</span>
                    </div>
                    ${data.errorCount > 0 ? `
                        <div class="summary-item">
                            <label>失败</label>
                            <span class="error">${data.errorCount}</span>
                        </div>
                    ` : ''}
                </div>

                <div class="batch-results-table">
                    <table>
                        <thead>
                            <tr>
                                <th>代码</th>
                                <th>名称</th>
                                <th>总分</th>
                                <th>评级</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${resultsHTML}
                        </tbody>
                    </table>
                </div>

                <div class="validation-actions">
                    <button class="btn btn-primary" onclick="BuyPointValidationManager.hideResult()">
                        关闭
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // 点击遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hideResult();
            }
        });
    },

    /**
     * 显示历史记录对话框
     */
    showHistoryDialog(data) {
        const overlay = document.createElement('div');
        overlay.id = 'buyPointValidationOverlay';
        overlay.className = 'validation-overlay';

        const recordsHTML = data.records.map(record => {
            const ratingColor = this.getRatingColor(record.total_score);
            const date = new Date(record.validation_time).toLocaleString('zh-CN');
            return `
                <tr class="history-row">
                    <td>${date}</td>
                    <td>${record.stock_code}</td>
                    <td>${record.stock_name}</td>
                    <td>${record.stock_price ? '¥' + record.stock_price.toFixed(2) : '--'}</td>
                    <td>
                        <div class="score-badge" style="background: ${ratingColor};">
                            ${record.total_score}
                        </div>
                    </td>
                    <td>
                        <span class="rating-badge" style="color: ${ratingColor};">
                            ${record.rating_level}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        overlay.innerHTML = `
            <div class="validation-result-panel">
                <div class="validation-header">
                    <h2>历史验证记录</h2>
                    <button class="close-btn" onclick="BuyPointValidationManager.hideResult()">&times;</button>
                </div>

                <div class="history-table">
                    <table>
                        <thead>
                            <tr>
                                <th>验证时间</th>
                                <th>股票代码</th>
                                <th>股票名称</th>
                                <th>当时价格</th>
                                <th>总分</th>
                                <th>评级</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recordsHTML || '<tr><td colspan="6" class="no-data">暂无记录</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <div class="validation-actions">
                    <button class="btn btn-primary" onclick="BuyPointValidationManager.hideResult()">
                        关闭
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // 点击遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hideResult();
            }
        });
    },

    /**
     * 显示历史记录（快捷方法）
     */
    showHistory(stockCode = null) {
        this.hideResult();
        this.getValidationHistory(stockCode);
    },

    /**
     * 获取评级颜色
     */
    getRatingColor(score) {
        if (score >= 80) return '#10b981'; // 绿色
        if (score >= 60) return '#3b82f6'; // 蓝色
        if (score >= 40) return '#f59e0b'; // 橙色
        return '#ef4444'; // 红色
    },

    /**
     * 获取评级图标
     */
    getRatingIcon(level) {
        const icons = {
            '优秀': '⭐⭐⭐',
            '良好': '⭐⭐',
            '一般': '⭐',
            '较差': '❌'
        };
        return icons[level] || '❓';
    },

    /**
     * 切换维度详情显示/隐藏
     */
    toggleDimensionDetails(headerElement) {
        // 找到当前维度项
        const dimensionItem = headerElement.closest('.dimension-item');
        if (!dimensionItem) return;

        // 找到详情区域和展开图标
        const detailsSection = dimensionItem.querySelector('.dimension-details');
        const expandIcon = headerElement.querySelector('.expand-icon');

        if (!detailsSection) return;

        // 切换显示/隐藏
        if (detailsSection.style.display === 'none' || !detailsSection.style.display) {
            detailsSection.style.display = 'block';
            if (expandIcon) expandIcon.textContent = '▼';
        } else {
            detailsSection.style.display = 'none';
            if (expandIcon) expandIcon.textContent = '▶';
        }
    }
};

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    BuyPointValidationManager.init();
});
