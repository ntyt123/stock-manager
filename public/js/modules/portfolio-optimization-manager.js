// ==================== portfolio-optimization-manager.js ====================
// 组合优化管理模块

// 加载组合优化数据
async function loadPortfolioOptimizationData() {
    const token = localStorage.getItem('token');

    if (!token) {
        console.log('用户未登录，跳过加载组合优化数据');
        return;
    }

    // 加载最新的组合优化分析
    await loadLatestOptimization();
}

// 加载最新的组合优化分析
async function loadLatestOptimization() {
    const container = document.getElementById('portfolioOptimizationContent');
    const token = localStorage.getItem('token');

    if (!container || !token) return;

    try {
        console.log('📊 正在加载最新组合优化分析...');

        // 获取最新的组合优化记录列表
        const response = await fetch('/api/analysis/portfolio-optimization/list?limit=1', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取组合优化列表失败');
        }

        const result = await response.json();

        if (!result.success || !result.data.records || result.data.records.length === 0) {
            console.log('ℹ️ 暂无组合优化分析');
            container.innerHTML = `
                <div class="analysis-hint">
                    <div class="hint-icon">💡</div>
                    <div class="hint-content">
                        <p class="hint-title">AI组合优化分析</p>
                        <p class="hint-desc">点击"立即优化"按钮，AI将对您的投资组合进行全面深度分析优化</p>
                        <p class="hint-features">
                            ✅ 资产配置分析<br>
                            ✅ 行业配置优化<br>
                            ✅ 个股权重调整<br>
                            ✅ 风险收益平衡<br>
                            ✅ 组合再平衡方案<br>
                            ✅ 长期配置建议
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        // 获取最新记录的ID
        const latestOptimizationId = result.data.records[0].id;
        console.log(`📄 最新组合优化ID: ${latestOptimizationId}`);

        // 获取详情
        const detailResponse = await fetch(`/api/analysis/portfolio-optimization/${latestOptimizationId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!detailResponse.ok) {
            throw new Error('获取组合优化详情失败');
        }

        const detailResult = await detailResponse.json();

        if (detailResult.success && detailResult.data) {
            const { analysis, portfolioSummary, timestamp } = detailResult.data;

            // 显示组合优化内容
            displayPortfolioOptimization(analysis, portfolioSummary, timestamp);

            console.log('✅ 最新组合优化分析加载成功');
        }

    } catch (error) {
        console.error('❌ 加载最新组合优化分析错误:', error);
        container.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">💡</div>
                <div class="hint-content">
                    <p class="hint-title">AI组合优化分析</p>
                    <p class="hint-desc">点击"立即优化"按钮，AI将对您的投资组合进行全面深度分析优化</p>
                </div>
            </div>
        `;
    }
}

// 显示组合优化分析结果
function displayPortfolioOptimization(analysis, summary, timestamp) {
    const container = document.getElementById('portfolioOptimizationContent');

    // 解析summary（如果是字符串）
    if (typeof summary === 'string') {
        try {
            summary = JSON.parse(summary);
        } catch (error) {
            console.error('❌ 解析portfolioSummary失败:', error);
        }
    }

    const analysisTime = new Date(timestamp).toLocaleString('zh-CN');

    // 使用marked.parse渲染Markdown格式的分析内容
    const analysisHtml = marked.parse(analysis);

    const html = `
        <div class="analysis-result">
            <div class="analysis-summary">
                <h3 style="margin: 0 0 15px 0;">📊 投资组合概况</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">总资金</div>
                        <div class="summary-value">¥${summary.totalCapital ? summary.totalCapital.toLocaleString('zh-CN') : '0'}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">持仓市值</div>
                        <div class="summary-value">¥${summary.totalMarketValue ? summary.totalMarketValue.toFixed(2) : '0.00'}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">仓位占比</div>
                        <div class="summary-value">${summary.positionRatio || '0'}%</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">持仓股票</div>
                        <div class="summary-value">${summary.totalStocks}只</div>
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

// 执行组合优化分析
async function optimizePortfolio() {
    const container = document.getElementById('portfolioOptimizationContent');
    const optimizeBtn = document.getElementById('portfolioOptimizeBtn');

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再使用组合优化功能');
        return;
    }

    console.log('📊 开始进行组合优化分析...');

    // 禁用按钮
    optimizeBtn.disabled = true;
    optimizeBtn.innerHTML = '<span>⏳ 分析中...</span>';

    // 显示加载状态
    container.innerHTML = `
        <div class="analysis-loading">
            <div class="loading-spinner"></div>
            <div class="loading-message">AI正在深度分析您的投资组合...</div>
            <div class="loading-tips">
                分析内容包括：资产配置、行业分布、个股权重、风险收益、再平衡方案等<br>
                预计需要10-30秒，请耐心等待
            </div>
        </div>
    `;

    try {
        const response = await fetch('/api/analysis/portfolio-optimization', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 服务器响应错误:', response.status, errorText);
            throw new Error(`服务器响应错误 (${response.status})`);
        }

        const result = await response.json();

        if (result.success && result.data) {
            const { analysis, portfolioSummary, timestamp, prompt } = result.data;

            // 在浏览器控制台输出发送给AI的提示词
            if (prompt) {
                console.log('%c📝 ==================== AI组合优化提示词 ====================', 'color: #9C27B0; font-weight: bold; font-size: 14px;');
                console.log(prompt);
                console.log('%c📝 ============================================================', 'color: #9C27B0; font-weight: bold; font-size: 14px;');
            }

            // 显示分析结果
            displayPortfolioOptimization(analysis, portfolioSummary, timestamp);

            console.log('✅ 组合优化分析完成');
            showNotification('组合优化分析完成', 'success');

        } else {
            throw new Error(result.error || '分析失败');
        }

    } catch (error) {
        console.error('❌ 组合优化分析错误:', error);

        container.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">分析失败</p>
                    <p class="hint-desc">${error.message || '组合优化分析失败，请稍后重试'}</p>
                    <p class="hint-schedule">请确保已导入持仓数据</p>
                </div>
            </div>
        `;

        showNotification('组合优化分析失败: ' + error.message, 'error');

    } finally {
        // 恢复按钮
        optimizeBtn.disabled = false;
        optimizeBtn.innerHTML = '<span>🎯 立即优化</span>';
    }
}

// 查看组合优化历史记录
async function viewOptimizationHistory() {
    const modal = document.getElementById('optimizationHistoryModal');
    const content = document.getElementById('optimizationHistoryContent');

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再查看历史记录');
        return;
    }

    // 显示模态框
    modal.style.display = 'block';
    content.innerHTML = '<div class="loading-text">正在加载历史记录...</div>';

    console.log('📋 开始加载组合优化历史...');

    try {
        const response = await fetch('/api/analysis/portfolio-optimization/list', {
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

                const typeLabel = record.optimization_type === 'manual' ? '手动分析' : '定时分析';
                const typeClass = record.optimization_type === 'manual' ? 'report-type-manual' : 'report-type-scheduled';

                html += `
                    <div class="report-list-item">
                        <div class="report-item-info" onclick="showOptimizationDetailInModal(${record.id})" style="cursor: pointer; flex: 1;">
                            <div class="report-item-date">📅 ${dateStr}</div>
                            <span class="report-item-type ${typeClass}">${typeLabel}</span>
                        </div>
                        <button class="report-delete-btn" onclick="event.stopPropagation(); deleteOptimization(${record.id});" title="删除记录">🗑️</button>
                        <div class="report-item-action" onclick="showOptimizationDetailInModal(${record.id})" style="cursor: pointer;">→</div>
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

// 在模态框中显示组合优化详情
async function showOptimizationDetailInModal(optimizationId) {
    const detailModal = document.getElementById('optimizationDetailModal');
    const detailContent = document.getElementById('optimizationDetailContent');

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    console.log(`📄 正在加载组合优化 ID: ${optimizationId}`);

    // 显示详情模态框
    detailModal.style.display = 'block';
    detailContent.innerHTML = '<div class="loading-text">正在加载详情...</div>';

    try {
        const response = await fetch(`/api/analysis/portfolio-optimization/${optimizationId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data) {
            const { analysis, portfolioSummary, timestamp } = result.data;

            // 解析portfolioSummary
            let summary = portfolioSummary;
            if (typeof summary === 'string') {
                try {
                    summary = JSON.parse(summary);
                } catch (error) {
                    console.error('❌ 解析portfolioSummary失败:', error);
                }
            }

            // 格式化时间
            const analysisTime = new Date(timestamp).toLocaleString('zh-CN');

            // 使用marked.parse渲染Markdown格式的分析内容
            const analysisHtml = marked.parse(analysis);

            // 生成详情HTML
            const html = `
                <div class="analysis-result">
                    <div class="analysis-summary">
                        <h3 style="margin: 0 0 15px 0;">📊 投资组合概况</h3>
                        <div class="summary-grid">
                            <div class="summary-item">
                                <div class="summary-label">总资金</div>
                                <div class="summary-value">¥${summary.totalCapital ? summary.totalCapital.toLocaleString('zh-CN') : '0'}</div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-label">持仓市值</div>
                                <div class="summary-value">¥${summary.totalMarketValue ? summary.totalMarketValue.toFixed(2) : '0.00'}</div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-label">仓位占比</div>
                                <div class="summary-value">${summary.positionRatio || '0'}%</div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-label">持仓股票</div>
                                <div class="summary-value">${summary.totalStocks}只</div>
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
                        </div>
                    </div>
                    <div class="analysis-content">${analysisHtml}</div>
                    <div class="analysis-timestamp">
                        📅 分析时间：${analysisTime}
                    </div>
                </div>
            `;

            detailContent.innerHTML = html;

            console.log('✅ 组合优化详情加载成功');
        } else {
            throw new Error(result.error || '加载失败');
        }

    } catch (error) {
        console.error('❌ 加载组合优化详情错误:', error);

        detailContent.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">加载失败</p>
                    <p class="hint-desc">${error.message || '加载详情失败'}</p>
                </div>
            </div>
        `;

        showNotification('加载详情失败', 'error');
    }
}

// 关闭历史记录模态框
function closeOptimizationHistoryModal() {
    const modal = document.getElementById('optimizationHistoryModal');
    modal.style.display = 'none';
}

// 关闭详情模态框
function closeOptimizationDetailModal() {
    const modal = document.getElementById('optimizationDetailModal');
    modal.style.display = 'none';
}

// 删除组合优化记录
async function deleteOptimization(optimizationId) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    if (!confirm('确定要删除这份组合优化记录吗？此操作不可恢复。')) {
        return;
    }

    console.log(`🗑️ 正在删除组合优化记录 ID: ${optimizationId}`);

    try {
        const response = await fetch(`/api/analysis/portfolio-optimization/${optimizationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ 组合优化记录删除成功');
            showNotification('记录删除成功', 'success');

            // 刷新历史列表
            viewOptimizationHistory();
        } else {
            throw new Error(result.error || '删除失败');
        }

    } catch (error) {
        console.error('❌ 删除组合优化记录错误:', error);
        showNotification('删除记录失败: ' + error.message, 'error');
    }
}
