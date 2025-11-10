// ==================== trading-log-manager.js ====================
// 交易日志管理模块

const TradingLogManager = {
    currentLogId: null, // 当前编辑的日志ID
    currentFilter: 'all', // 当前过滤器

    // 加载交易日志列表
    async loadTradingLogs(filter = 'all') {
        const token = localStorage.getItem('token');
        if (!token) {
            document.getElementById('tradingLogContent').innerHTML = '<div class="loading-text">请先登录后查看交易日志</div>';
            return;
        }

        document.getElementById('tradingLogContent').innerHTML = '<div class="loading-text">正在加载交易日志...</div>';
        console.log('📖 加载交易日志...');

        try {
            let url = '/api/trading-logs';

            // 根据过滤器调整URL
            if (filter === 'important') {
                url = '/api/trading-logs/important/list';
            } else if (filter !== 'all') {
                url = `/api/trading-logs/type/${filter}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                if (result.data && result.data.length > 0) {
                    this.renderTradingLogs(result.data);
                } else {
                    // 没有数据，显示空状态
                    document.getElementById('tradingLogContent').innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">📝</div>
                            <div class="empty-title">暂无交易日志</div>
                            <div class="empty-desc">点击"新建日志"按钮开始记录您的交易心得</div>
                        </div>
                    `;
                }
                // 加载统计信息
                this.loadStatistics();
            } else {
                // API返回失败
                document.getElementById('tradingLogContent').innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">❌</div>
                        <div class="empty-title">加载失败</div>
                        <div class="empty-desc">${result.error || '获取交易日志失败，请重试'}</div>
                    </div>
                `;
            }

        } catch (error) {
            console.error('❌ 加载交易日志失败:', error);
            document.getElementById('tradingLogContent').innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-title">网络错误</div>
                    <div class="empty-desc">无法连接到服务器，请检查网络连接后重试</div>
                </div>
            `;
            // 即使加载失败，也尝试加载统计信息
            this.loadStatistics();
        }
    },

    // 渲染交易日志列表
    renderTradingLogs(logs) {
        const logTypeMap = {
            'daily_recap': { label: '每日复盘', icon: '📊', class: 'log-type-recap' },
            'decision_note': { label: '决策记录', icon: '💡', class: 'log-type-decision' },
            'insight': { label: '交易心得', icon: '✍️', class: 'log-type-insight' },
            'error_analysis': { label: '错误分析', icon: '❌', class: 'log-type-error' },
            'success_case': { label: '成功案例', icon: '✅', class: 'log-type-success' }
        };

        const sentimentMap = {
            'good': { label: '良好', icon: '😊', class: 'sentiment-good' },
            'neutral': { label: '一般', icon: '😐', class: 'sentiment-neutral' },
            'bad': { label: '糟糕', icon: '😞', class: 'sentiment-bad' }
        };

        let html = '<div class="trading-log-list">';

        logs.forEach(log => {
            const typeInfo = logTypeMap[log.log_type] || { label: log.log_type, icon: '📝', class: '' };
            const sentimentInfo = sentimentMap[log.sentiment] || sentimentMap['neutral'];
            const date = new Date(log.log_date).toLocaleDateString('zh-CN');
            const createdDate = new Date(log.created_at).toLocaleString('zh-CN');

            // 解析标签
            const tags = log.tags ? log.tags.split(',').filter(t => t.trim()) : [];

            // 解析关联股票
            const stockCodes = log.related_stock_codes ? log.related_stock_codes.split(',').filter(s => s.trim()) : [];

            html += `
                <div class="trading-log-item ${typeInfo.class}" data-log-id="${log.id}">
                    <div class="log-item-header">
                        <div class="log-item-left">
                            <span class="log-type-badge">${typeInfo.icon} ${typeInfo.label}</span>
                            ${log.is_important ? '<span class="log-important-badge">⭐ 重要</span>' : ''}
                            <span class="log-sentiment ${sentimentInfo.class}">${sentimentInfo.icon} ${sentimentInfo.label}</span>
                        </div>
                        <div class="log-item-right">
                            <span class="log-date">📅 ${date}</span>
                        </div>
                    </div>

                    <div class="log-item-body">
                        <h3 class="log-title">${this.escapeHtml(log.title)}</h3>
                        <div class="log-content-preview">${this.escapeHtml(log.content.substring(0, 150))}${log.content.length > 150 ? '...' : ''}</div>

                        ${tags.length > 0 ? `
                            <div class="log-tags">
                                ${tags.map(tag => `<span class="log-tag">🏷️ ${this.escapeHtml(tag)}</span>`).join('')}
                            </div>
                        ` : ''}

                        ${stockCodes.length > 0 ? `
                            <div class="log-stocks">
                                ${stockCodes.map(code => `<span class="log-stock-code">${this.escapeHtml(code)}</span>`).join('')}
                            </div>
                        ` : ''}

                        ${log.profit_loss !== null && log.profit_loss !== undefined ? `
                            <div class="log-profit-loss ${log.profit_loss >= 0 ? 'profit' : 'loss'}">
                                ${log.profit_loss >= 0 ? '📈' : '📉'} 盈亏: ¥${parseFloat(log.profit_loss).toFixed(2)}
                            </div>
                        ` : ''}
                    </div>

                    <div class="log-item-footer">
                        <span class="log-created-time">创建于: ${createdDate}</span>
                        <div class="log-actions">
                            <button class="log-action-btn view-btn" onclick="TradingLogManager.viewLogDetail(${log.id})" title="查看详情">
                                👁️ 查看
                            </button>
                            <button class="log-action-btn edit-btn" onclick="TradingLogManager.editLog(${log.id})" title="编辑">
                                ✏️ 编辑
                            </button>
                            <button class="log-action-btn delete-btn" onclick="TradingLogManager.deleteLog(${log.id})" title="删除">
                                🗑️ 删除
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        document.getElementById('tradingLogContent').innerHTML = html;
    },

    // 加载统计信息
    async loadStatistics() {
        const token = localStorage.getItem('token');
        const statsContainer = document.getElementById('tradingLogStats');

        if (!token || !statsContainer) return;

        try {
            const response = await fetch('/api/trading-logs/statistics/summary', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success && result.data) {
                this.renderStatistics(result.data);
            } else {
                // 没有数据时显示空状态
                statsContainer.innerHTML = `
                    <div class="stats-summary">
                        <div class="stat-item">
                            <div class="stat-value">0</div>
                            <div class="stat-label">总日志数</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">0</div>
                            <div class="stat-label">重要日志</div>
                        </div>
                    </div>
                `;
            }

        } catch (error) {
            console.error('❌ 加载统计信息失败:', error);
            // 加载失败时也要更新UI
            statsContainer.innerHTML = `
                <div class="stats-summary">
                    <div class="stat-item">
                        <div class="stat-value">--</div>
                        <div class="stat-label">加载失败</div>
                    </div>
                </div>
            `;
        }
    },

    // 渲染统计信息
    renderStatistics(stats) {
        const statsContainer = document.getElementById('tradingLogStats');
        if (!statsContainer) return;

        const typeLabels = {
            'daily_recap': '📊 每日复盘',
            'decision_note': '💡 决策记录',
            'insight': '✍️ 交易心得',
            'error_analysis': '❌ 错误分析',
            'success_case': '✅ 成功案例'
        };

        let html = `
            <div class="stats-summary">
                <div class="stat-item">
                    <div class="stat-value">${stats.total}</div>
                    <div class="stat-label">总日志数</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${stats.important}</div>
                    <div class="stat-label">重要日志</div>
                </div>
            </div>
        `;

        // 只有当有分类统计时才显示
        if (stats.byType && stats.byType.length > 0) {
            html += `
                <div class="stats-types">
                    ${stats.byType.map(item => `
                        <div class="type-stat-item">
                            <span class="type-stat-label">${typeLabels[item.log_type] || item.log_type}</span>
                            <span class="type-stat-value">${item.count}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        statsContainer.innerHTML = html;
    },

    // 打开新建日志模态框
    openNewLogModal() {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('请先登录');
            return;
        }

        this.currentLogId = null;
        document.getElementById('tradingLogModalTitle').textContent = '📝 新建交易日志';
        document.getElementById('logSubmitBtnText').textContent = '💾 保存日志';

        // 重置表单
        document.getElementById('tradingLogForm').reset();
        document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('logFormStatus').textContent = '';

        // 显示模态框
        document.getElementById('tradingLogModal').classList.add('show');

        console.log('📝 打开新建日志模态框');
    },

    // 关闭日志模态框
    closeLogModal() {
        document.getElementById('tradingLogModal').classList.remove('show');
        document.getElementById('tradingLogForm').reset();
        this.currentLogId = null;
    },

    // 保存日志（新建或更新）
    async submitLog() {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('请先登录');
            return;
        }

        // 获取表单数据
        const logDate = document.getElementById('logDate').value;
        const logType = document.getElementById('logType').value;
        const title = document.getElementById('logTitle').value.trim();
        const content = document.getElementById('logContent').value.trim();
        const tags = document.getElementById('logTags').value.trim();
        const relatedStockCodes = document.getElementById('logStockCodes').value.trim();
        const sentiment = document.getElementById('logSentiment').value;
        const profitLoss = document.getElementById('logProfitLoss').value.trim();
        const isImportant = document.getElementById('logIsImportant').checked;

        const statusDiv = document.getElementById('logFormStatus');

        // 验证必填字段
        if (!logDate || !logType || !title || !content) {
            statusDiv.textContent = '❌ 请填写所有必填字段';
            statusDiv.className = 'form-status error';
            return;
        }

        statusDiv.textContent = '⏳ 正在保存...';
        statusDiv.className = 'form-status info';

        try {
            const logData = {
                logDate,
                logType,
                title,
                content,
                tags: tags || null,
                relatedStockCodes: relatedStockCodes || null,
                sentiment,
                profitLoss: profitLoss ? parseFloat(profitLoss) : null,
                isImportant
            };

            const url = this.currentLogId
                ? `/api/trading-logs/${this.currentLogId}`
                : '/api/trading-logs';

            const method = this.currentLogId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(logData)
            });

            const result = await response.json();

            if (result.success) {
                statusDiv.textContent = `✅ ${this.currentLogId ? '更新' : '保存'}成功！`;
                statusDiv.className = 'form-status success';

                showNotification(`交易日志${this.currentLogId ? '更新' : '添加'}成功`, 'success');

                setTimeout(() => {
                    this.closeLogModal();
                    this.loadTradingLogs(this.currentFilter);
                }, 1500);
            } else {
                throw new Error(result.error || '保存失败');
            }

        } catch (error) {
            console.error('❌ 保存日志错误:', error);
            statusDiv.textContent = `❌ ${error.message || '保存失败，请重试'}`;
            statusDiv.className = 'form-status error';
        }
    },

    // 编辑日志
    async editLog(logId) {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('请先登录');
            return;
        }

        try {
            const response = await fetch(`/api/trading-logs/${logId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success && result.data) {
                const log = result.data;
                this.currentLogId = logId;

                // 填充表单
                document.getElementById('tradingLogModalTitle').textContent = '✏️ 编辑交易日志';
                document.getElementById('logSubmitBtnText').textContent = '💾 更新日志';
                document.getElementById('logDate').value = log.log_date;
                document.getElementById('logType').value = log.log_type;
                document.getElementById('logTitle').value = log.title;
                document.getElementById('logContent').value = log.content;
                document.getElementById('logTags').value = log.tags || '';
                document.getElementById('logStockCodes').value = log.related_stock_codes || '';
                document.getElementById('logSentiment').value = log.sentiment;
                document.getElementById('logProfitLoss').value = log.profit_loss || '';
                document.getElementById('logIsImportant').checked = log.is_important === 1;

                // 显示模态框
                document.getElementById('tradingLogModal').classList.add('show');
            }

        } catch (error) {
            console.error('❌ 加载日志详情失败:', error);
            showNotification('加载日志详情失败', 'error');
        }
    },

    // 查看日志详情
    async viewLogDetail(logId) {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('请先登录');
            return;
        }

        try {
            const response = await fetch(`/api/trading-logs/${logId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success && result.data) {
                this.renderLogDetail(result.data);
            }

        } catch (error) {
            console.error('❌ 加载日志详情失败:', error);
            showNotification('加载日志详情失败', 'error');
        }
    },

    // 渲染日志详情
    renderLogDetail(log) {
        const typeMap = {
            'daily_recap': { label: '每日复盘', icon: '📊' },
            'decision_note': { label: '决策记录', icon: '💡' },
            'insight': { label: '交易心得', icon: '✍️' },
            'error_analysis': { label: '错误分析', icon: '❌' },
            'success_case': { label: '成功案例', icon: '✅' }
        };

        const sentimentMap = {
            'good': { label: '良好', icon: '😊' },
            'neutral': { label: '一般', icon: '😐' },
            'bad': { label: '糟糕', icon: '😞' }
        };

        const typeInfo = typeMap[log.log_type] || { label: log.log_type, icon: '📝' };
        const sentimentInfo = sentimentMap[log.sentiment] || sentimentMap['neutral'];
        const date = new Date(log.log_date).toLocaleDateString('zh-CN');
        const tags = log.tags ? log.tags.split(',').filter(t => t.trim()) : [];
        const stockCodes = log.related_stock_codes ? log.related_stock_codes.split(',').filter(s => s.trim()) : [];

        const detailHtml = `
            <div class="log-detail-header">
                <div class="log-detail-badges">
                    <span class="log-type-badge">${typeInfo.icon} ${typeInfo.label}</span>
                    ${log.is_important ? '<span class="log-important-badge">⭐ 重要</span>' : ''}
                    <span class="log-sentiment">${sentimentInfo.icon} ${sentimentInfo.label}</span>
                </div>
                <div class="log-detail-date">📅 ${date}</div>
            </div>

            <div class="log-detail-title">
                <h2>${this.escapeHtml(log.title)}</h2>
            </div>

            <div class="log-detail-content">
                <div class="content-section">
                    <h3>📝 日志内容</h3>
                    <div class="content-text">${this.escapeHtml(log.content).replace(/\n/g, '<br>')}</div>
                </div>

                ${tags.length > 0 ? `
                    <div class="content-section">
                        <h3>🏷️ 标签</h3>
                        <div class="log-tags">
                            ${tags.map(tag => `<span class="log-tag">${this.escapeHtml(tag)}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${stockCodes.length > 0 ? `
                    <div class="content-section">
                        <h3>📊 关联股票</h3>
                        <div class="log-stocks">
                            ${stockCodes.map(code => `<span class="log-stock-code">${this.escapeHtml(code)}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${log.profit_loss !== null && log.profit_loss !== undefined ? `
                    <div class="content-section">
                        <h3>💰 盈亏情况</h3>
                        <div class="log-profit-loss ${log.profit_loss >= 0 ? 'profit' : 'loss'}">
                            ${log.profit_loss >= 0 ? '📈 盈利' : '📉 亏损'}: ¥${Math.abs(parseFloat(log.profit_loss)).toFixed(2)}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('logDetailContent').innerHTML = detailHtml;
        document.getElementById('logDetailModal').style.display = 'block';
    },

    // 关闭详情模态框
    closeDetailModal() {
        document.getElementById('logDetailModal').style.display = 'none';
    },

    // 删除日志
    async deleteLog(logId) {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('请先登录');
            return;
        }

        if (!confirm('确定要删除这条交易日志吗？此操作不可恢复。')) {
            return;
        }

        try {
            const response = await fetch(`/api/trading-logs/${logId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                showNotification('交易日志删除成功', 'success');
                this.loadTradingLogs(this.currentFilter);
            } else {
                throw new Error(result.error || '删除失败');
            }

        } catch (error) {
            console.error('❌ 删除日志失败:', error);
            showNotification('删除日志失败: ' + error.message, 'error');
        }
    },

    // 搜索日志
    async searchLogs() {
        const keyword = document.getElementById('logSearchInput').value.trim();

        if (!keyword) {
            this.loadTradingLogs(this.currentFilter);
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            alert('请先登录');
            return;
        }

        try {
            const response = await fetch(`/api/trading-logs/search/${encodeURIComponent(keyword)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
                this.renderTradingLogs(result.data);
            } else {
                document.getElementById('tradingLogContent').innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🔍</div>
                        <div class="empty-title">未找到相关日志</div>
                        <div class="empty-desc">尝试使用其他关键词搜索</div>
                    </div>
                `;
            }

        } catch (error) {
            console.error('❌ 搜索日志失败:', error);
            showNotification('搜索失败', 'error');
        }
    },

    // 过滤日志
    filterLogs(filterType) {
        this.currentFilter = filterType;

        // 更新按钮状态
        document.querySelectorAll('.log-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        this.loadTradingLogs(filterType);
    },

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 导出到全局
window.TradingLogManager = TradingLogManager;

// 页面加载完成后将模态框移动到body根部
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('tradingLogModal');
    if (modal && modal.parentElement.tagName !== 'BODY') {
        document.body.appendChild(modal);
        console.log('✅ 交易日志模态框已移动到body根部');
    }
});
