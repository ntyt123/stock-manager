// ==================== analysis-manager.js ====================
// 自动生成的模块文件

// loadAnalysisData
async function loadAnalysisData() {
    const token = localStorage.getItem('token');

    if (!token) {
        console.log('用户未登录，跳过加载分析数据');
        // 未登录也加载今日推荐（推荐功能不需要登录）
        loadTodayRecommendation();
        return;
    }

    // 并行加载最新的持仓报告、集合竞价报告和今日推荐
    await Promise.all([
        loadLatestPortfolioReport(),
        loadLatestCallAuctionReport(),
        loadTodayRecommendation()
    ]);
}

// loadLatestPortfolioReport
async function loadLatestPortfolioReport() {
    const container = document.getElementById('portfolioAnalysis');
    const token = localStorage.getItem('token');

    if (!container || !token) return;

    try {
        console.log('📊 正在加载最新持仓分析报告...');

        // 获取最新的持仓分析报告
        const response = await fetch('/api/analysis/reports?limit=1', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取报告列表失败');
        }

        const result = await response.json();

        if (!result.success || !result.data.reports || result.data.reports.length === 0) {
            console.log('ℹ️ 暂无持仓分析报告');
            container.innerHTML = `
                <div class="analysis-hint">
                    <div class="hint-icon">💡</div>
                    <div class="hint-content">
                        <p class="hint-title">AI智能持仓分析</p>
                        <p class="hint-desc">点击"立即分析"按钮，AI将对您的持仓进行全面深度分析</p>
                        <p class="hint-schedule">📅 系统每天下午5点自动分析持仓</p>
                    </div>
                </div>
            `;
            return;
        }

        // 获取最新报告的ID
        const latestReportId = result.data.reports[0].id;
        console.log(`📄 最新持仓报告ID: ${latestReportId}`);

        // 获取报告详情
        const detailResponse = await fetch(`/api/analysis/reports/${latestReportId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!detailResponse.ok) {
            throw new Error('获取报告详情失败');
        }

        const detailResult = await detailResponse.json();

        if (detailResult.success && detailResult.data) {
            const { analysis, portfolioSummary, timestamp } = detailResult.data;

            // 显示报告内容
            displayPortfolioAnalysis(analysis, portfolioSummary, timestamp);

            console.log('✅ 最新持仓报告加载成功');
        }

    } catch (error) {
        console.error('❌ 加载最新持仓报告错误:', error);
        container.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">💡</div>
                <div class="hint-content">
                    <p class="hint-title">AI智能持仓分析</p>
                    <p class="hint-desc">点击"立即分析"按钮，AI将对您的持仓进行全面深度分析</p>
                    <p class="hint-schedule">📅 系统每天下午5点自动分析持仓</p>
                </div>
            </div>
        `;
    }
}

// loadLatestCallAuctionReport
async function loadLatestCallAuctionReport() {
    const container = document.getElementById('callAuctionAnalysis');
    const token = localStorage.getItem('token');

    if (!container || !token) return;

    try {
        console.log('📊 正在加载最新集合竞价分析...');

        // 获取最新的集合竞价分析
        const response = await fetch('/api/analysis/call-auction/list?limit=1', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取分析列表失败');
        }

        const result = await response.json();

        if (!result.success || !result.data.records || result.data.records.length === 0) {
            console.log('ℹ️ 暂无集合竞价分析');
            container.innerHTML = `
                <div class="analysis-hint">
                    <div class="hint-icon">💡</div>
                    <div class="hint-content">
                        <p class="hint-title">AI集合竞价分析</p>
                        <p class="hint-desc">点击"立即分析"按钮，AI将分析今日的集合竞价情况</p>
                        <p class="hint-schedule">📅 系统每天9:30自动分析集合竞价</p>
                    </div>
                </div>
            `;
            return;
        }

        // 获取最新分析的ID
        const latestAnalysisId = result.data.records[0].id;
        console.log(`📄 最新集合竞价分析ID: ${latestAnalysisId}`);

        // 获取分析详情
        const detailResponse = await fetch(`/api/analysis/call-auction/${latestAnalysisId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!detailResponse.ok) {
            throw new Error('获取分析详情失败');
        }

        const detailResult = await detailResponse.json();

        if (detailResult.success && detailResult.data) {
            const { analysis, marketSummary, timestamp, analysisDate } = detailResult.data;

            // 显示分析内容
            displayCallAuctionAnalysis(analysis, marketSummary, timestamp, analysisDate);

            console.log('✅ 最新集合竞价分析加载成功');
        }

    } catch (error) {
        console.error('❌ 加载最新集合竞价分析错误:', error);
        container.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">💡</div>
                <div class="hint-content">
                    <p class="hint-title">AI集合竞价分析</p>
                    <p class="hint-desc">点击"立即分析"按钮，AI将分析今日的集合竞价情况</p>
                    <p class="hint-schedule">📅 系统每天9:30自动分析集合竞价</p>
                </div>
            </div>
        `;
    }
}

// analyzePortfolio
async function analyzePortfolio() {
    const container = document.getElementById('portfolioAnalysis');
    const analyzeBtn = document.getElementById('analyzeBtn');

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再使用持仓分析功能');
        return;
    }

    console.log('📊 开始分析持仓...');

    // 禁用按钮
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span>⏳ 分析中...</span>';

    // 显示加载状态
    container.innerHTML = `
        <div class="analysis-loading">
            <div class="loading-spinner"></div>
            <div class="loading-message">AI正在深度分析您的持仓...</div>
            <div class="loading-tips">
                分析内容包括：持仓结构、个股评估、风险提示、操作建议等<br>
                预计需要10-30秒，请耐心等待
            </div>
        </div>
    `;

    try {
        const response = await fetch('/api/analysis/portfolio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data) {
            const { analysis, portfolioSummary, timestamp, prompt } = result.data;

            // 在浏览器控制台输出发送给AI的提示词
            if (prompt) {
                console.log('%c📝 ==================== AI持仓分析提示词 ====================', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
                console.log(prompt);
                console.log('%c📝 ============================================================', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
            }

            // 显示分析结果
            displayPortfolioAnalysis(analysis, portfolioSummary, timestamp);

            console.log('✅ 持仓分析完成');
            showNotification('持仓分析完成', 'success');

        } else {
            throw new Error(result.error || '分析失败');
        }

    } catch (error) {
        console.error('❌ 持仓分析错误:', error);

        container.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">分析失败</p>
                    <p class="hint-desc">${error.message || '持仓分析失败，请稍后重试'}</p>
                    <p class="hint-schedule">请确保已导入持仓数据</p>
                </div>
            </div>
        `;

        showNotification('持仓分析失败: ' + error.message, 'error');

    } finally {
        // 恢复按钮
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span>🔍 立即分析</span>';
    }
}

// displayPortfolioAnalysis
function displayPortfolioAnalysis(analysis, summary, timestamp) {
    const container = document.getElementById('portfolioAnalysis');

    // 调试日志：检查 summary 对象
    console.log('📊 [displayPortfolioAnalysis] summary 对象:', summary);
    console.log('📊 [displayPortfolioAnalysis] summary 类型:', typeof summary);
    console.log('📊 [displayPortfolioAnalysis] summary 是否为字符串:', typeof summary === 'string');

    // 如果 summary 是字符串，尝试解析为对象
    if (typeof summary === 'string') {
        console.warn('⚠️ [displayPortfolioAnalysis] summary 是字符串，尝试解析为JSON');
        try {
            summary = JSON.parse(summary);
            console.log('✅ [displayPortfolioAnalysis] JSON 解析成功:', summary);
        } catch (error) {
            console.error('❌ [displayPortfolioAnalysis] JSON 解析失败:', error);
        }
    }

    const analysisTime = new Date(timestamp).toLocaleString('zh-CN');

    // 使用marked.parse渲染Markdown格式的分析内容
    const analysisHtml = marked.parse(analysis);

    const html = `
        <div class="analysis-result">
            <div class="analysis-summary">
                <h3 style="margin: 0 0 15px 0;">📊 持仓概况</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">持仓股票</div>
                        <div class="summary-value">${summary.totalStocks}只</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">总市值</div>
                        <div class="summary-value">¥${summary.totalMarketValue.toFixed(2)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">总盈亏</div>
                        <div class="summary-value" style="color: ${summary.totalProfitLoss >= 0 ? '#ffeb3b' : '#ff9800'}">
                            ${summary.totalProfitLoss >= 0 ? '+' : ''}¥${summary.totalProfitLoss.toFixed(2)}
                        </div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">盈亏率</div>
                        <div class="summary-value" style="color: ${summary.totalProfitLoss >= 0 ? '#ffeb3b' : '#ff9800'}">
                            ${summary.totalProfitLoss >= 0 ? '+' : ''}${summary.totalProfitLossRate}%
                        </div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">盈利股票</div>
                        <div class="summary-value">${summary.profitableStocks}只</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">亏损股票</div>
                        <div class="summary-value">${summary.lossStocks}只</div>
                    </div>
                </div>
            </div>
            <div class="analysis-content">${analysisHtml}</div>
            <div class="analysis-timestamp">
                📅 分析时间：${analysisTime}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// viewReportHistory
async function viewReportHistory() {
    const modal = document.getElementById('reportHistoryModal');
    const content = document.getElementById('reportHistoryContent');

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再查看历史报告');
        return;
    }

    // 显示模态框
    modal.style.display = 'block';
    content.innerHTML = '<div class="loading-text">正在加载历史报告...</div>';

    console.log('📋 开始加载历史报告...');

    try {
        const response = await fetch('/api/analysis/reports', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data.reports && result.data.reports.length > 0) {
            const reports = result.data.reports;
            console.log(`✅ 成功加载 ${reports.length} 份历史报告`);

            let html = '<div class="report-list">';

            reports.forEach(report => {
                const date = new Date(report.created_at);
                const dateStr = date.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const typeLabel = report.report_type === 'manual' ? '手动分析' : '定时分析';
                const typeClass = report.report_type === 'manual' ? 'report-type-manual' : 'report-type-scheduled';

                html += `
                    <div class="report-list-item">
                        <div class="report-item-info" onclick="showReportDetailInModal(${report.id})" style="cursor: pointer; flex: 1;">
                            <div class="report-item-date">📅 ${dateStr}</div>
                            <span class="report-item-type ${typeClass}">${typeLabel}</span>
                        </div>
                        <button class="report-delete-btn" onclick="event.stopPropagation(); deleteReport(${report.id});" title="删除报告">🗑️</button>
                        <div class="report-item-action" onclick="showReportDetailInModal(${report.id})" style="cursor: pointer;">→</div>
                    </div>
                `;
            });

            html += '</div>';

            if (result.data.hasMore) {
                html += '<div class="loading-text" style="margin-top: 20px;">显示最近30份报告</div>';
            }

            content.innerHTML = html;
        } else {
            content.innerHTML = '<div class="loading-text">暂无历史报告</div>';
        }

    } catch (error) {
        console.error('❌ 加载历史报告错误:', error);
        content.innerHTML = '<div class="loading-text">加载失败，请重试</div>';
    }
}

// viewReportDetail
async function viewReportDetail(reportId) {
    const container = document.getElementById('portfolioAnalysis');
    const modal = document.getElementById('reportHistoryModal');

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    console.log(`📄 正在加载报告 ID: ${reportId}`);

    // 关闭历史模态框
    modal.style.display = 'none';

    // 切换到分析页签
    switchTab('analysis');

    // 显示加载状态
    container.innerHTML = `
        <div class="analysis-loading">
            <div class="loading-spinner"></div>
            <div class="loading-message">正在加载历史报告...</div>
        </div>
    `;

    try {
        const response = await fetch(`/api/analysis/reports/${reportId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data) {
            const { analysis, portfolioSummary, timestamp } = result.data;

            // 显示报告内容
            displayPortfolioAnalysis(analysis, portfolioSummary, timestamp);

            console.log('✅ 历史报告加载成功');
            showNotification('历史报告加载成功', 'success');
        } else {
            throw new Error(result.error || '加载失败');
        }

    } catch (error) {
        console.error('❌ 加载报告详情错误:', error);

        container.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">加载失败</p>
                    <p class="hint-desc">${error.message || '加载报告详情失败'}</p>
                </div>
            </div>
        `;

        showNotification('加载报告失败', 'error');
    }
}

// showReportDetailInModal
async function showReportDetailInModal(reportId) {
    const detailModal = document.getElementById('reportDetailModal');
    const detailContent = document.getElementById('reportDetailContent');

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    console.log(`📄 正在在弹窗中加载报告 ID: ${reportId}`);

    // 显示详情模态框
    detailModal.style.display = 'block';
    detailContent.innerHTML = '<div class="loading-text">正在加载报告详情...</div>';

    try {
        const response = await fetch(`/api/analysis/reports/${reportId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data) {
            let { analysis, portfolioSummary, timestamp } = result.data;

            // 调试日志：检查 portfolioSummary 对象
            console.log('📊 [showReportDetailInModal] portfolioSummary 对象:', portfolioSummary);
            console.log('📊 [showReportDetailInModal] portfolioSummary 类型:', typeof portfolioSummary);

            // 如果 portfolioSummary 是字符串，尝试解析为对象
            if (typeof portfolioSummary === 'string') {
                console.warn('⚠️ [showReportDetailInModal] portfolioSummary 是字符串，尝试解析为JSON');
                try {
                    portfolioSummary = JSON.parse(portfolioSummary);
                    console.log('✅ [showReportDetailInModal] JSON 解析成功:', portfolioSummary);
                } catch (error) {
                    console.error('❌ [showReportDetailInModal] JSON 解析失败:', error);
                }
            }

            // 格式化时间
            const analysisTime = new Date(timestamp).toLocaleString('zh-CN');

            // 使用marked.parse渲染Markdown格式的分析内容
            const analysisHtml = marked.parse(analysis);

            // 生成详情HTML（与displayPortfolioAnalysis相同的格式）
            const html = `
                <div class="analysis-result">
                    <div class="analysis-summary">
                        <h3 style="margin: 0 0 15px 0;">📊 持仓概况</h3>
                        <div class="summary-grid">
                            <div class="summary-item">
                                <div class="summary-label">持仓股票</div>
                                <div class="summary-value">${portfolioSummary.totalStocks}只</div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-label">总市值</div>
                                <div class="summary-value">¥${portfolioSummary.totalMarketValue.toFixed(2)}</div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-label">总盈亏</div>
                                <div class="summary-value" style="color: ${portfolioSummary.totalProfitLoss >= 0 ? '#ffeb3b' : '#ff9800'}">
                                    ${portfolioSummary.totalProfitLoss >= 0 ? '+' : ''}¥${portfolioSummary.totalProfitLoss.toFixed(2)}
                                </div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-label">盈亏率</div>
                                <div class="summary-value" style="color: ${portfolioSummary.totalProfitLoss >= 0 ? '#ffeb3b' : '#ff9800'}">
                                    ${portfolioSummary.totalProfitLoss >= 0 ? '+' : ''}${portfolioSummary.totalProfitLossRate}%
                                </div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-label">盈利股票</div>
                                <div class="summary-value">${portfolioSummary.profitableStocks}只</div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-label">亏损股票</div>
                                <div class="summary-value">${portfolioSummary.lossStocks}只</div>
                            </div>
                        </div>
                    </div>
                    <div class="analysis-content">${analysisHtml}</div>
                    <div class="analysis-timestamp">
                        📅 分析时间：${analysisTime}
                    </div>
                </div>
            `;

            detailContent.innerHTML = html;

            console.log('✅ 报告详情加载成功');
        } else {
            throw new Error(result.error || '加载失败');
        }

    } catch (error) {
        console.error('❌ 加载报告详情错误:', error);

        detailContent.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">加载失败</p>
                    <p class="hint-desc">${error.message || '加载报告详情失败'}</p>
                </div>
            </div>
        `;

        showNotification('加载报告失败', 'error');
    }
}

// closeReportHistoryModal
function closeReportHistoryModal() {
    const modal = document.getElementById('reportHistoryModal');
    modal.style.display = 'none';
}

// closeReportDetailModal
function closeReportDetailModal() {
    const modal = document.getElementById('reportDetailModal');
    modal.style.display = 'none';
}

// deleteReport
async function deleteReport(reportId) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    if (!confirm('确定要删除这份分析报告吗？此操作不可恢复。')) {
        return;
    }

    console.log(`🗑️ 正在删除报告 ID: ${reportId}`);

    try {
        const response = await fetch(`/api/analysis/reports/${reportId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ 报告删除成功');
            showNotification('报告删除成功', 'success');

            // 刷新报告历史列表
            viewReportHistory();
        } else {
            throw new Error(result.error || '删除失败');
        }

    } catch (error) {
        console.error('❌ 删除报告错误:', error);
        showNotification('删除报告失败: ' + error.message, 'error');
    }
}

// analyzeCallAuction
async function analyzeCallAuction() {
    const container = document.getElementById('callAuctionAnalysis');
    const analyzeBtn = document.getElementById('callAuctionAnalyzeBtn');

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再使用集合竞价分析功能');
        return;
    }

    console.log('📊 开始分析集合竞价...');

    // 禁用按钮
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span>⏳ 分析中...</span>';

    // 显示加载状态
    container.innerHTML = `
        <div class="analysis-loading">
            <div class="loading-spinner"></div>
            <div class="loading-message">AI正在分析今日集合竞价...</div>
            <div class="loading-tips">
                分析内容包括：市场情绪、热点板块、交易策略、风险提示等<br>
                预计需要10-30秒，请耐心等待
            </div>
        </div>
    `;

    try {
        const response = await fetch('/api/analysis/call-auction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data) {
            const { analysis, marketSummary, timestamp, analysisDate, prompt } = result.data;

            // 在浏览器控制台输出发送给AI的提示词
            if (prompt) {
                console.log('%c📝 ==================== AI集合竞价分析提示词 ====================', 'color: #2196F3; font-weight: bold; font-size: 14px;');
                console.log(prompt);
                console.log('%c📝 ================================================================', 'color: #2196F3; font-weight: bold; font-size: 14px;');
            }

            // 显示分析结果
            displayCallAuctionAnalysis(analysis, marketSummary, timestamp, analysisDate);

            console.log('✅ 集合竞价分析完成');
            showNotification('集合竞价分析完成', 'success');

        } else {
            throw new Error(result.error || '分析失败');
        }

    } catch (error) {
        console.error('❌ 集合竞价分析错误:', error);

        container.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">分析失败</p>
                    <p class="hint-desc">${error.message || '集合竞价分析失败，请稍后重试'}</p>
                    <p class="hint-schedule">请稍后重试</p>
                </div>
            </div>
        `;

        showNotification('集合竞价分析失败: ' + error.message, 'error');

    } finally {
        // 恢复按钮
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span>🔍 立即分析</span>';
    }
}

// displayCallAuctionAnalysis
function displayCallAuctionAnalysis(analysis, summary, timestamp, analysisDate) {
    const container = document.getElementById('callAuctionAnalysis');

    const analysisTime = new Date(timestamp).toLocaleString('zh-CN');

    // 使用marked.parse渲染Markdown格式的分析内容
    const analysisHtml = marked.parse(analysis);

    // 构建市场指数信息
    let indicesHtml = '';
    if (summary && summary.indices && summary.indices.length > 0) {
        indicesHtml = '<div class="summary-grid">';
        summary.indices.forEach(idx => {
            const isPositive = parseFloat(idx.changePercent) >= 0;
            indicesHtml += `
                <div class="summary-item">
                    <div class="summary-label">${idx.name}</div>
                    <div class="summary-value">${idx.todayOpen}</div>
                    <div class="summary-sub ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${idx.changePercent}%
                    </div>
                </div>
            `;
        });
        indicesHtml += '</div>';
    }

    const html = `
        <div class="analysis-result">
            <div class="analysis-summary">
                <h3 style="margin: 0 0 15px 0;">📊 集合竞价概况 (${analysisDate})</h3>
                ${indicesHtml}
            </div>
            <div class="analysis-content">${analysisHtml}</div>
            <div class="analysis-timestamp">
                📅 分析时间：${analysisTime}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// viewCallAuctionHistory
async function viewCallAuctionHistory() {
    const modal = document.getElementById('callAuctionHistoryModal');
    const content = document.getElementById('callAuctionHistoryContent');

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再查看历史记录');
        return;
    }

    // 显示模态框
    modal.style.display = 'block';
    content.innerHTML = '<div class="loading-text">正在加载历史记录...</div>';

    console.log('📋 开始加载集合竞价分析历史...');

    try {
        const response = await fetch('/api/analysis/call-auction/list', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data.records && result.data.records.length > 0) {
            const records = result.data.records;
            console.log(`✅ 成功加载 ${records.length} 份历史记录`);

            let html = '<div class="report-list">';

            records.forEach(record => {
                const date = new Date(record.created_at);
                const dateStr = date.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const typeLabel = record.analysis_type === 'manual' ? '手动分析' : '定时分析';
                const typeClass = record.analysis_type === 'manual' ? 'report-type-manual' : 'report-type-scheduled';

                html += `
                    <div class="report-list-item">
                        <div class="report-item-info" onclick="showCallAuctionDetailInModal(${record.id})" style="cursor: pointer; flex: 1;">
                            <div class="report-item-date">📅 ${record.analysis_date}</div>
                            <span class="report-item-type ${typeClass}">${typeLabel}</span>
                        </div>
                        <button class="report-delete-btn" onclick="event.stopPropagation(); deleteCallAuctionAnalysis(${record.id});" title="删除分析记录">🗑️</button>
                        <div class="report-item-action" onclick="showCallAuctionDetailInModal(${record.id})" style="cursor: pointer;">→</div>
                    </div>
                `;
            });

            html += '</div>';

            if (result.data.hasMore) {
                html += '<div class="loading-text" style="margin-top: 20px;">显示最近30份记录</div>';
            }

            content.innerHTML = html;
        } else {
            content.innerHTML = '<div class="loading-text">暂无历史记录</div>';
        }

    } catch (error) {
        console.error('❌ 加载历史记录错误:', error);
        content.innerHTML = '<div class="loading-text">加载失败，请重试</div>';
    }
}

// showCallAuctionDetailInModal
async function showCallAuctionDetailInModal(analysisId) {
    const detailModal = document.getElementById('callAuctionDetailModal');
    const detailContent = document.getElementById('callAuctionDetailContent');

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    console.log(`📄 正在加载集合竞价分析 ID: ${analysisId}`);

    // 显示详情模态框
    detailModal.style.display = 'block';
    detailContent.innerHTML = '<div class="loading-text">正在加载分析详情...</div>';

    try {
        const response = await fetch(`/api/analysis/call-auction/${analysisId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data) {
            const { analysis, marketSummary, timestamp, analysisDate } = result.data;

            // 格式化时间
            const analysisTime = new Date(timestamp).toLocaleString('zh-CN');

            // 使用marked.parse渲染Markdown格式的分析内容
            const analysisHtml = marked.parse(analysis);

            // 构建市场指数信息
            let indicesHtml = '';
            if (marketSummary && marketSummary.indices && marketSummary.indices.length > 0) {
                indicesHtml = '<div class="summary-grid">';
                marketSummary.indices.forEach(idx => {
                    const isPositive = parseFloat(idx.changePercent) >= 0;
                    indicesHtml += `
                        <div class="summary-item">
                            <div class="summary-label">${idx.name}</div>
                            <div class="summary-value">${idx.todayOpen}</div>
                            <div class="summary-sub ${isPositive ? 'positive' : 'negative'}">
                                ${isPositive ? '+' : ''}${idx.changePercent}%
                            </div>
                        </div>
                    `;
                });
                indicesHtml += '</div>';
            }

            // 生成详情HTML
            const html = `
                <div class="analysis-result">
                    <div class="analysis-summary">
                        <h3 style="margin: 0 0 15px 0;">📊 集合竞价概况 (${analysisDate})</h3>
                        ${indicesHtml}
                    </div>
                    <div class="analysis-content">${analysisHtml}</div>
                    <div class="analysis-timestamp">
                        📅 分析时间：${analysisTime}
                    </div>
                </div>
            `;

            detailContent.innerHTML = html;

            console.log('✅ 集合竞价分析详情加载成功');
        } else {
            throw new Error(result.error || '加载失败');
        }

    } catch (error) {
        console.error('❌ 加载分析详情错误:', error);

        detailContent.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">加载失败</p>
                    <p class="hint-desc">${error.message || '加载分析详情失败'}</p>
                </div>
            </div>
        `;

        showNotification('加载分析失败', 'error');
    }
}

// closeCallAuctionHistoryModal
function closeCallAuctionHistoryModal() {
    const modal = document.getElementById('callAuctionHistoryModal');
    modal.style.display = 'none';
}

// closeCallAuctionDetailModal
function closeCallAuctionDetailModal() {
    const modal = document.getElementById('callAuctionDetailModal');
    modal.style.display = 'none';
}

// deleteCallAuctionAnalysis
async function deleteCallAuctionAnalysis(analysisId) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    if (!confirm('确定要删除这份集合竞价分析记录吗？此操作不可恢复。')) {
        return;
    }

    console.log(`🗑️ 正在删除集合竞价分析 ID: ${analysisId}`);

    try {
        const response = await fetch(`/api/analysis/call-auction/${analysisId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ 集合竞价分析删除成功');
            showNotification('分析记录删除成功', 'success');

            // 刷新分析历史列表
            viewCallAuctionHistory();
        } else {
            throw new Error(result.error || '删除失败');
        }

    } catch (error) {
        console.error('❌ 删除集合竞价分析错误:', error);
        showNotification('删除分析记录失败: ' + error.message, 'error');
    }
}

// sendToAI
async function sendToAI() {
    const inputText = document.getElementById('aiInputText').value.trim();
    const responseSection = document.getElementById('aiResponseSection');
    const responseContent = document.getElementById('aiResponseContent');
    const responseTime = document.getElementById('aiResponseTime');

    if (!inputText) {
        alert('请输入您的问题');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再使用AI助手');
        return;
    }

    console.log('📤 发送AI询问:', inputText);

    // 显示响应区域和加载状态
    responseSection.style.display = 'block';
    responseContent.className = 'ai-response-content loading';
    responseContent.textContent = '正在思考中...';

    try {
        // 调用真实的DeepSeek API
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                message: inputText
            })
        });

        const result = await response.json();

        if (result.success && result.data) {
            // 在浏览器控制台输出发送给AI的提示词
            if (result.data.prompt) {
                console.log('%c📝 ==================== AI投资助手提示词 ====================', 'color: #FF9800; font-weight: bold; font-size: 14px;');
                console.log('System Prompt:', result.data.prompt.system);
                console.log('User Message:', result.data.prompt.user);
                console.log('%c📝 ============================================================', 'color: #FF9800; font-weight: bold; font-size: 14px;');
            }

            // 显示响应时间
            const now = new Date();
            responseTime.textContent = now.toLocaleTimeString('zh-CN');

            // 显示响应内容（支持Markdown格式）
            responseContent.className = 'ai-response-content';
            responseContent.innerHTML = marked.parse(result.data.message);

            console.log('✅ AI响应已显示');
        } else {
            throw new Error(result.error || '未知错误');
        }

    } catch (error) {
        console.error('❌ AI请求错误:', error);
        responseContent.className = 'ai-response-content';

        let errorMessage = '抱歉，处理您的问题时出现了错误，请稍后重试。';
        if (error.message && error.message !== '未知错误') {
            errorMessage = error.message;
        }

        responseContent.textContent = errorMessage;
    }
}

// clearAIChat
function clearAIChat() {
    const inputText = document.getElementById('aiInputText');
    const responseSection = document.getElementById('aiResponseSection');
    const responseContent = document.getElementById('aiResponseContent');

    if (confirm('确定要清空对话内容吗？')) {
        inputText.value = '';
        responseSection.style.display = 'none';
        responseContent.textContent = '';
        console.log('🗑️ 已清空AI对话');
    }
}

// generateMockAIResponse
function generateMockAIResponse(question) {
    const responses = [
        `基于您的问题"${question}"，我为您提供以下分析：

1. 市场环境分析
   当前A股市场处于震荡调整阶段，主要指数在关键支撑位附近波动。建议关注政策面和资金面的变化。

2. 持仓建议
   - 建议适当控制仓位，保持50-70%的股票仓位
   - 重点关注业绩稳定、估值合理的蓝筹股
   - 适当配置一些防御性板块，如消费、医药等

3. 风险提示
   - 短期市场波动较大，注意控制风险
   - 建议设置止损位，避免单只股票亏损过大
   - 保持理性投资心态，不要追涨杀跌

以上分析仅供参考，不构成投资建议。投资有风险，入市需谨慎。`,

        `针对您的提问"${question}"，我的分析如下：

【技术面分析】
- 大盘短期支撑位：3200点
- 压力位：3400点
- 建议关注量能变化，放量突破才能确认趋势

【资金面分析】
- 北向资金持续流入，显示外资看好A股
- 两市成交额维持在万亿以上，市场活跃度较高
- 建议关注主力资金流向，跟随热点板块

【操作策略】
1. 短线：快进快出，控制单笔仓位不超过30%
2.中线：逢低布局优质成长股，持有周期3-6个月
3. 长线：定投指数基金，分散风险

【风险控制】
- 严格执行止损纪律
- 不要满仓操作
- 避免频繁交易

祝您投资顺利！`,

        `感谢您的咨询"${question}"。以下是我的专业建议：

一、宏观经济环境
- 国内经济复苏态势良好
- 货币政策保持稳健
- 财政政策积极发力

二、行业板块分析
【看好板块】
✓ 新能源：政策支持力度大，长期成长空间广阔
✓ 科技：国产替代加速，半导体、软件等细分领域机会多
✓ 消费：内需复苏，白酒、家电等龙头估值合理

【谨慎板块】
⚠ 房地产：政策调控持续，短期承压
⚠ 煤炭钢铁：周期性行业，高位注意风险

三、投资建议
1. 分散投资，不要集中在单一板块
2. 关注业绩预告，选择业绩增长稳定的公司
3. 定期调整持仓，优化投资组合

四、注意事项
• 理性投资，不盲目跟风
• 做好资金管理，预留应急资金
• 持续学习，提升投资能力

希望对您有所帮助！`,

        `您好！关于"${question}"这个问题，我为您整理了以下要点：

🎯 核心观点
市场当前处于结构性行情，选股能力比择时更重要。建议重点关注具备核心竞争力的优质企业。

📊 数据参考
- 上证指数：3300点附近
- 深证成指：11000点附近
- 创业板指：2200点附近
- 市场平均市盈率：15倍左右

💡 投资策略
【短期（1-3个月）】
• 波段操作为主
• 重点关注超跌反弹机会
• 控制仓位在50%左右

【中期（3-12个月）】
• 价值投资为主
• 选择估值合理的成长股
• 仓位可提高到70%

【长期（1年以上）】
• 定投优质基金
• 配置核心资产
• 适当配置港股、海外市场

⚠️ 风险提示
1. 地缘政治风险
2. 流动性风险
3. 个股业绩变化风险

🔔 操作建议
- 建立止盈止损机制
- 避免情绪化交易
- 保持投资纪律

以上建议供您参考，具体投资决策请结合自身实际情况。`
    ];

    // 随机返回一个模拟响应
    return responses[Math.floor(Math.random() * responses.length)];
}

