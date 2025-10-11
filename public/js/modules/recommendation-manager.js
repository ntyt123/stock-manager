// ==================== recommendation-manager.js ====================
// 自动生成的模块文件

// generateRecommendation
async function generateRecommendation() {
    const container = document.getElementById('stockRecommendation');
    const generateBtn = document.getElementById('generateRecommendationBtn');

    console.log('💎 开始生成股票推荐...');

    // 禁用按钮
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span>⏳ 生成中...</span>';

    // 显示加载状态
    container.innerHTML = `
        <div class="analysis-loading">
            <div class="loading-spinner"></div>
            <div class="loading-message">AI正在分析市场并生成股票推荐...</div>
            <div class="loading-tips">
                分析内容包括：市场趋势、推荐股票、买入策略、止盈止损建议等<br>
                预计需要20-40秒，请耐心等待
            </div>
        </div>
    `;

    try {
        const response = await fetch('/api/recommendations/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success && result.data) {
            const { recommendation, marketData, recommendationDate, nextTradingDay, timestamp } = result.data;

            // 显示推荐结果
            displayStockRecommendation(recommendation, marketData, recommendationDate, nextTradingDay, timestamp);

            console.log('✅ 股票推荐生成完成');
            showNotification('股票推荐生成完成', 'success');

        } else {
            throw new Error(result.error || '生成失败');
        }

    } catch (error) {
        console.error('❌ 股票推荐生成错误:', error);

        container.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">生成失败</p>
                    <p class="hint-desc">${error.message || '股票推荐生成失败，请稍后重试'}</p>
                </div>
            </div>
        `;

        showNotification('股票推荐生成失败: ' + error.message, 'error');

    } finally {
        // 恢复按钮
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span>🔍 生成推荐</span>';
    }
}

// displayStockRecommendation
function displayStockRecommendation(recommendation, marketData, recommendationDate, nextTradingDay, timestamp) {
    const container = document.getElementById('stockRecommendation');

    const recommendationTime = new Date(timestamp).toLocaleString('zh-CN');

    // 使用marked.parse渲染Markdown格式的推荐内容
    const recommendationHtml = marked.parse(recommendation);

    // 构建市场指数信息
    let indicesHtml = '';
    if (marketData && marketData.indices && marketData.indices.length > 0) {
        indicesHtml = '<div class="summary-grid">';
        marketData.indices.forEach(idx => {
            const isPositive = parseFloat(idx.changePercent) >= 0;
            indicesHtml += `
                <div class="summary-item">
                    <div class="summary-label">${idx.name}</div>
                    <div class="summary-value">${idx.currentPrice}</div>
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
                <h3 style="margin: 0 0 15px 0;">💎 股票推荐 (${nextTradingDay})</h3>
                <div class="recommendation-date-info">
                    <span>📅 基于 ${recommendationDate} 市场数据</span>
                    <span>🎯 推荐交易日：${nextTradingDay}</span>
                </div>
                ${indicesHtml}
            </div>
            <div class="analysis-content">${recommendationHtml}</div>
            <div class="analysis-timestamp">
                📅 生成时间：${recommendationTime}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// loadRecommendationByDate
async function loadRecommendationByDate() {
    const datePicker = document.getElementById('recommendationDatePicker');
    const selectedDate = datePicker.value;

    if (!selectedDate) {
        alert('请选择日期');
        return;
    }

    const container = document.getElementById('stockRecommendation');

    console.log(`📅 加载日期 ${selectedDate} 的推荐...`);

    // 显示加载状态
    container.innerHTML = '<div class="loading-text">正在加载推荐...</div>';

    try {
        const response = await fetch(`/api/recommendations/${selectedDate}`);
        const result = await response.json();

        if (result.success && result.data) {
            const { recommendation, marketData, recommendationDate, timestamp } = result.data;
            const nextTradingDay = marketData.nextTradingDay || recommendationDate;

            // 显示推荐结果
            displayStockRecommendation(recommendation, marketData, recommendationDate, nextTradingDay, timestamp);

            console.log('✅ 推荐加载成功');
        } else {
            container.innerHTML = `
                <div class="analysis-hint">
                    <div class="hint-icon">💡</div>
                    <div class="hint-content">
                        <p class="hint-title">暂无推荐</p>
                        <p class="hint-desc">${selectedDate} 暂无股票推荐记录</p>
                    </div>
                </div>
            `;
        }

    } catch (error) {
        console.error('❌ 加载推荐错误:', error);
        container.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">加载失败</p>
                    <p class="hint-desc">加载推荐失败，请重试</p>
                </div>
            </div>
        `;
    }
}

// viewRecommendationHistory
async function viewRecommendationHistory() {
    const modal = document.getElementById('recommendationHistoryModal');
    const content = document.getElementById('recommendationHistoryContent');

    // 显示模态框
    modal.style.display = 'block';
    content.innerHTML = '<div class="loading-text">正在加载历史推荐...</div>';

    console.log('📋 开始加载历史推荐...');

    try {
        const response = await fetch('/api/recommendations/list');
        const result = await response.json();

        if (result.success && result.data.records && result.data.records.length > 0) {
            const records = result.data.records;
            console.log(`✅ 成功加载 ${records.length} 份历史推荐`);

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

                const typeLabel = record.recommendation_type === 'manual' ? '手动生成' : '自动生成';
                const typeClass = record.recommendation_type === 'manual' ? 'report-type-manual' : 'report-type-scheduled';

                html += `
                    <div class="report-list-item">
                        <div class="report-item-info" onclick="showRecommendationDetailInModal(${record.id})" style="cursor: pointer; flex: 1;">
                            <div class="report-item-date">📅 ${record.recommendation_date}</div>
                            <span class="report-item-type ${typeClass}">${typeLabel}</span>
                        </div>
                        <button class="report-delete-btn" onclick="event.stopPropagation(); deleteRecommendation(${record.id});" title="删除推荐">🗑️</button>
                        <div class="report-item-action" onclick="showRecommendationDetailInModal(${record.id})" style="cursor: pointer;">→</div>
                    </div>
                `;
            });

            html += '</div>';

            if (result.data.hasMore) {
                html += '<div class="loading-text" style="margin-top: 20px;">显示最近30份推荐</div>';
            }

            content.innerHTML = html;
        } else {
            content.innerHTML = '<div class="loading-text">暂无历史推荐</div>';
        }

    } catch (error) {
        console.error('❌ 加载历史推荐错误:', error);
        content.innerHTML = '<div class="loading-text">加载失败，请重试</div>';
    }
}

// showRecommendationDetailInModal
async function showRecommendationDetailInModal(recommendationId) {
    const detailModal = document.getElementById('recommendationDetailModal');
    const detailContent = document.getElementById('recommendationDetailContent');

    console.log(`📄 正在加载推荐 ID: ${recommendationId}`);

    // 显示详情模态框
    detailModal.style.display = 'block';
    detailContent.innerHTML = '<div class="loading-text">正在加载推荐详情...</div>';

    try {
        const response = await fetch(`/api/recommendations/${recommendationId}`);
        const result = await response.json();

        if (result.success && result.data) {
            const { recommendation, marketData, recommendationDate, timestamp } = result.data;
            const nextTradingDay = marketData.nextTradingDay || recommendationDate;

            // 格式化时间
            const recommendationTime = new Date(timestamp).toLocaleString('zh-CN');

            // 使用marked.parse渲染Markdown格式的推荐内容
            const recommendationHtml = marked.parse(recommendation);

            // 构建市场指数信息
            let indicesHtml = '';
            if (marketData && marketData.indices && marketData.indices.length > 0) {
                indicesHtml = '<div class="summary-grid">';
                marketData.indices.forEach(idx => {
                    const isPositive = parseFloat(idx.changePercent) >= 0;
                    indicesHtml += `
                        <div class="summary-item">
                            <div class="summary-label">${idx.name}</div>
                            <div class="summary-value">${idx.currentPrice}</div>
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
                        <h3 style="margin: 0 0 15px 0;">💎 股票推荐 (${nextTradingDay})</h3>
                        <div class="recommendation-date-info">
                            <span>📅 基于 ${recommendationDate} 市场数据</span>
                            <span>🎯 推荐交易日：${nextTradingDay}</span>
                        </div>
                        ${indicesHtml}
                    </div>
                    <div class="analysis-content">${recommendationHtml}</div>
                    <div class="analysis-timestamp">
                        📅 生成时间：${recommendationTime}
                    </div>
                </div>
            `;

            detailContent.innerHTML = html;

            console.log('✅ 推荐详情加载成功');
        } else {
            throw new Error(result.error || '加载失败');
        }

    } catch (error) {
        console.error('❌ 加载推荐详情错误:', error);

        detailContent.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">加载失败</p>
                    <p class="hint-desc">${error.message || '加载推荐详情失败'}</p>
                </div>
            </div>
        `;

        showNotification('加载推荐失败', 'error');
    }
}

// closeRecommendationHistoryModal
function closeRecommendationHistoryModal() {
    const modal = document.getElementById('recommendationHistoryModal');
    modal.style.display = 'none';
}

// closeRecommendationDetailModal
function closeRecommendationDetailModal() {
    const modal = document.getElementById('recommendationDetailModal');
    modal.style.display = 'none';
}

// deleteRecommendation
async function deleteRecommendation(recommendationId) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    if (!confirm('确定要删除这份推荐记录吗？此操作不可恢复。')) {
        return;
    }

    console.log(`🗑️ 正在删除推荐 ID: ${recommendationId}`);

    try {
        const response = await fetch(`/api/recommendations/${recommendationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ 推荐删除成功');
            showNotification('推荐记录删除成功', 'success');

            // 刷新推荐历史列表
            viewRecommendationHistory();
        } else {
            throw new Error(result.error || '删除失败');
        }

    } catch (error) {
        console.error('❌ 删除推荐错误:', error);
        showNotification('删除推荐失败: ' + error.message, 'error');
    }
}

// loadTodayRecommendation
async function loadTodayRecommendation() {
    const container = document.getElementById('stockRecommendation');

    if (!container) return;

    try {
        const today = new Date().toISOString().split('T')[0];
        console.log(`📅 自动加载今日推荐 (${today})...`);

        const response = await fetch(`/api/recommendations/${today}`);
        const result = await response.json();

        if (result.success && result.data) {
            const { recommendation, marketData, recommendationDate, timestamp } = result.data;
            const nextTradingDay = marketData.nextTradingDay || recommendationDate;

            // 显示推荐结果
            displayStockRecommendation(recommendation, marketData, recommendationDate, nextTradingDay, timestamp);

            console.log('✅ 今日推荐加载成功');
        } else {
            console.log('ℹ️ 今日暂无推荐');
        }

    } catch (error) {
        console.error('❌ 加载今日推荐错误:', error);
    }
}

