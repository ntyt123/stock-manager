// ==================== 资金管理模块 ====================

const FundManagementManager = {
    currentAccount: null,
    transactions: [],
    chart: null,

    // 加载资金管理主界面
    async loadFundManagement() {
        try {
            const container = document.getElementById('fundManagementContent');
            if (!container) {
                console.error('资金管理容器未找到');
                return;
            }

            // 显示加载状态
            container.innerHTML = '<div class="loading-text">正在加载资金管理数据...</div>';

            // 获取账户信息和数据
            await Promise.all([
                this.loadAccountInfo(),
                this.loadTransactions(),
                this.loadStatistics()
            ]);

            // 渲染界面
            this.renderFundManagement();

        } catch (error) {
            console.error('加载资金管理错误:', error);
            UIUtils.showToast('加载资金管理失败', 'error');
        }
    },

    // 加载账户信息
    async loadAccountInfo() {
        try {
            const response = await fetch('/api/fund-management/account', {
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                }
            });

            const result = await response.json();

            if (result.success) {
                this.currentAccount = result.data;
            } else {
                throw new Error(result.error || '加载账户信息失败');
            }
        } catch (error) {
            console.error('加载账户信息错误:', error);
            throw error;
        }
    },

    // 加载资金流水
    async loadTransactions(limit = 50) {
        try {
            const response = await fetch(`/api/fund-management/transactions?limit=${limit}`, {
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                }
            });

            const result = await response.json();

            if (result.success) {
                this.transactions = result.data;
            } else {
                throw new Error(result.error || '加载资金流水失败');
            }
        } catch (error) {
            console.error('加载资金流水错误:', error);
            throw error;
        }
    },

    // 加载统计信息
    async loadStatistics(days = 30) {
        try {
            const response = await fetch(`/api/fund-management/account/statistics?days=${days}`, {
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                }
            });

            const result = await response.json();

            if (result.success) {
                this.statistics = result.data.statistics;
            } else {
                throw new Error(result.error || '加载统计信息失败');
            }
        } catch (error) {
            console.error('加载统计信息错误:', error);
            throw error;
        }
    },

    // 渲染资金管理界面
    renderFundManagement() {
        const container = document.getElementById('fundManagementContent');
        if (!container) return;

        const account = this.currentAccount || {
            total_assets: 0,
            cash_balance: 0,
            position_value: 0,
            frozen_funds: 0,
            available_funds: 0
        };

        const stats = this.statistics || {
            total_deposits: 0,
            total_withdrawals: 0,
            total_dividends: 0
        };

        // 计算资产配置比例
        const cashRatio = account.total_assets > 0 ? (account.cash_balance / account.total_assets * 100).toFixed(2) : 0;
        const positionRatio = account.total_assets > 0 ? (account.position_value / account.total_assets * 100).toFixed(2) : 0;

        container.innerHTML = `
            <!-- 账户资产概览 -->
            <div class="fund-overview-section">
                <div class="fund-overview-card main-card">
                    <div class="card-header">
                        <div class="card-icon">💰</div>
                        <div class="card-title">账户总资产</div>
                    </div>
                    <div class="card-value">¥${UIUtils.formatNumber(account.total_assets, 2)}</div>
                    <div class="card-actions">
                        <button class="action-btn" onclick="FundManagementManager.syncPositionValue()">
                            🔄 同步持仓
                        </button>
                    </div>
                </div>

                <div class="fund-overview-card">
                    <div class="card-label">💵 现金余额</div>
                    <div class="card-value">¥${UIUtils.formatNumber(account.cash_balance, 2)}</div>
                    <div class="card-ratio">${cashRatio}%</div>
                </div>

                <div class="fund-overview-card">
                    <div class="card-label">📊 持仓市值</div>
                    <div class="card-value">¥${UIUtils.formatNumber(account.position_value, 2)}</div>
                    <div class="card-ratio">${positionRatio}%</div>
                </div>

                <div class="fund-overview-card">
                    <div class="card-label">💵 可用资金</div>
                    <div class="card-value">¥${UIUtils.formatNumber(account.available_funds, 2)}</div>
                </div>

                <div class="fund-overview-card">
                    <div class="card-label">🔒 冻结资金</div>
                    <div class="card-value">¥${UIUtils.formatNumber(account.frozen_funds, 2)}</div>
                </div>
            </div>

            <!-- 资产配置饼图 -->
            <div class="fund-chart-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-icon">📊</div>
                        <div class="card-title">资产配置</div>
                    </div>
                    <div class="chart-container" style="height: 300px;">
                        <canvas id="assetAllocationChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- 资金统计 -->
            <div class="fund-stats-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-icon">📈</div>
                        <div class="card-title">资金统计 (最近30天)</div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-label">💰 累计入金</div>
                            <div class="stat-value positive">¥${UIUtils.formatNumber(stats.total_deposits, 2)}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">💸 累计出金</div>
                            <div class="stat-value negative">¥${UIUtils.formatNumber(stats.total_withdrawals, 2)}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">💎 累计分红</div>
                            <div class="stat-value positive">¥${UIUtils.formatNumber(stats.total_dividends, 2)}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">💰 净流入</div>
                            <div class="stat-value ${(stats.total_deposits - stats.total_withdrawals) >= 0 ? 'positive' : 'negative'}">
                                ¥${UIUtils.formatNumber(stats.total_deposits - stats.total_withdrawals + stats.total_dividends, 2)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 快捷操作 -->
            <div class="fund-actions-section">
                <button class="fund-action-btn primary" onclick="FundManagementManager.openAddTransactionModal('deposit')">
                    💰 入金
                </button>
                <button class="fund-action-btn" onclick="FundManagementManager.openAddTransactionModal('withdrawal')">
                    💸 出金
                </button>
                <button class="fund-action-btn" onclick="FundManagementManager.openAddTransactionModal('dividend')">
                    💎 分红
                </button>
                <button class="fund-action-btn" onclick="FundManagementManager.openUpdateAccountModal()">
                    ⚙️ 调整账户
                </button>
            </div>

            <!-- 资金流水记录 -->
            <div class="fund-transactions-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-icon">📝</div>
                        <div class="card-title">资金流水</div>
                        <div class="header-actions">
                            <button class="refresh-btn" onclick="FundManagementManager.loadFundManagement()">
                                🔄 刷新
                            </button>
                        </div>
                    </div>
                    <div class="transactions-table-container">
                        ${this.renderTransactionsTable()}
                    </div>
                </div>
            </div>
        `;

        // 渲染资产配置饼图
        this.renderAssetAllocationChart();
    },

    // 渲染资金流水表格
    renderTransactionsTable() {
        if (!this.transactions || this.transactions.length === 0) {
            return '<div class="empty-state">暂无资金流水记录</div>';
        }

        const typeLabels = {
            'deposit': '💰 入金',
            'withdrawal': '💸 出金',
            'dividend': '💎 分红',
            'buy': '📉 买入',
            'sell': '📈 卖出',
            'fee': '💳 手续费'
        };

        const rows = this.transactions.map(tx => `
            <tr>
                <td>${tx.transaction_date}</td>
                <td><span class="transaction-type ${tx.transaction_type}">${typeLabels[tx.transaction_type] || tx.transaction_type}</span></td>
                <td class="${['deposit', 'dividend', 'sell'].includes(tx.transaction_type) ? 'positive' : 'negative'}">
                    ${['deposit', 'dividend', 'sell'].includes(tx.transaction_type) ? '+' : '-'}¥${UIUtils.formatNumber(Math.abs(tx.amount), 2)}
                </td>
                <td>¥${UIUtils.formatNumber(tx.balance_after, 2)}</td>
                <td>${tx.stock_code || '-'}</td>
                <td>${tx.notes || '-'}</td>
                <td>
                    <button class="btn-icon" onclick="FundManagementManager.deleteTransaction(${tx.id})" title="删除">
                        🗑️
                    </button>
                </td>
            </tr>
        `).join('');

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>日期</th>
                        <th>类型</th>
                        <th>金额</th>
                        <th>余额</th>
                        <th>股票代码</th>
                        <th>备注</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    },

    // 渲染资产配置饼图
    renderAssetAllocationChart() {
        const canvas = document.getElementById('assetAllocationChart');
        if (!canvas) return;

        const account = this.currentAccount || { cash_balance: 0, position_value: 0 };

        // 销毁旧图表
        if (this.chart) {
            this.chart.destroy();
        }

        // 创建新图表
        this.chart = new Chart(canvas, {
            type: 'pie',
            data: {
                labels: ['现金', '持仓'],
                datasets: [{
                    data: [account.cash_balance, account.position_value],
                    backgroundColor: ['#4CAF50', '#2196F3'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#2c3e50'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
                                return `${label}: ¥${UIUtils.formatNumber(value, 2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    // 打开添加资金流水模态框
    openAddTransactionModal(type = 'deposit') {
        const modal = document.getElementById('addFundTransactionModal');
        if (!modal) {
            this.createAddTransactionModal();
            return this.openAddTransactionModal(type);
        }

        // 设置交易类型
        const typeSelect = document.getElementById('fundTransactionType');
        if (typeSelect) {
            typeSelect.value = type;
        }

        // 设置默认日期为今天
        const dateInput = document.getElementById('fundTransactionDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        modal.style.display = 'flex';
    },

    // 创建添加资金流水模态框
    createAddTransactionModal() {
        const modalHtml = `
            <div id="addFundTransactionModal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>💰 添加资金流水</h3>
                        <button class="close-btn" onclick="FundManagementManager.closeAddTransactionModal()">×</button>
                    </div>
                    <div class="form-container">
                        <form id="addFundTransactionForm">
                            <div class="form-group">
                                <label for="fundTransactionType">交易类型 *</label>
                                <select id="fundTransactionType" class="form-input" required>
                                    <option value="deposit">💰 入金</option>
                                    <option value="withdrawal">💸 出金</option>
                                    <option value="dividend">💎 分红</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="fundTransactionAmount">金额 *</label>
                                <input type="number" id="fundTransactionAmount" class="form-input"
                                    placeholder="请输入金额" step="0.01" min="0" required>
                            </div>
                            <div class="form-group">
                                <label for="fundTransactionDate">日期 *</label>
                                <input type="date" id="fundTransactionDate" class="form-input" required>
                            </div>
                            <div class="form-group">
                                <label for="fundTransactionNotes">备注</label>
                                <textarea id="fundTransactionNotes" class="form-textarea"
                                    placeholder="可选：记录备注信息..." rows="3"></textarea>
                            </div>
                            <div class="form-status" id="fundTransactionFormStatus"></div>
                        </form>
                    </div>
                    <div class="modal-actions">
                        <button class="action-btn secondary" onclick="FundManagementManager.closeAddTransactionModal()">取消</button>
                        <button class="action-btn" onclick="FundManagementManager.submitAddTransaction()">
                            💾 保存
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // 关闭添加资金流水模态框
    closeAddTransactionModal() {
        const modal = document.getElementById('addFundTransactionModal');
        if (modal) {
            modal.style.display = 'none';
            // 清空表单
            document.getElementById('addFundTransactionForm').reset();
            document.getElementById('fundTransactionFormStatus').innerHTML = '';
        }
    },

    // 提交添加资金流水
    async submitAddTransaction() {
        try {
            const type = document.getElementById('fundTransactionType').value;
            const amount = document.getElementById('fundTransactionAmount').value;
            const date = document.getElementById('fundTransactionDate').value;
            const notes = document.getElementById('fundTransactionNotes').value;

            // 验证
            if (!type || !amount || !date) {
                UIUtils.showFormStatus('fundTransactionFormStatus', '请填写所有必填项', 'error');
                return;
            }

            UIUtils.showFormStatus('fundTransactionFormStatus', '正在添加...', 'info');

            const response = await fetch('/api/fund-management/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                },
                body: JSON.stringify({
                    transaction_type: type,
                    amount: parseFloat(amount),
                    transaction_date: date,
                    notes: notes || null
                })
            });

            const result = await response.json();

            if (result.success) {
                UIUtils.showFormStatus('fundTransactionFormStatus', '添加成功！', 'success');
                UIUtils.showToast('资金流水添加成功', 'success');
                setTimeout(() => {
                    this.closeAddTransactionModal();
                    this.loadFundManagement();
                }, 1000);
            } else {
                UIUtils.showFormStatus('fundTransactionFormStatus', result.error || '添加失败', 'error');
            }

        } catch (error) {
            console.error('添加资金流水错误:', error);
            UIUtils.showFormStatus('fundTransactionFormStatus', '添加失败: ' + error.message, 'error');
        }
    },

    // 删除资金流水
    async deleteTransaction(id) {
        if (!confirm('确定要删除这条资金流水记录吗？')) {
            return;
        }

        try {
            const response = await fetch(`/api/fund-management/transactions/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                }
            });

            const result = await response.json();

            if (result.success) {
                UIUtils.showToast('删除成功', 'success');
                this.loadFundManagement();
            } else {
                UIUtils.showToast(result.error || '删除失败', 'error');
            }

        } catch (error) {
            console.error('删除资金流水错误:', error);
            UIUtils.showToast('删除失败', 'error');
        }
    },

    // 同步持仓市值
    async syncPositionValue() {
        try {
            UIUtils.showToast('正在同步持仓市值...', 'info');

            const response = await fetch('/api/fund-management/sync-position-value', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                }
            });

            const result = await response.json();

            if (result.success) {
                UIUtils.showToast('持仓市值同步成功', 'success');
                this.loadFundManagement();
            } else {
                UIUtils.showToast(result.error || '同步失败', 'error');
            }

        } catch (error) {
            console.error('同步持仓市值错误:', error);
            UIUtils.showToast('同步失败', 'error');
        }
    },

    // 打开调整账户模态框
    openUpdateAccountModal() {
        const modal = document.getElementById('updateAccountModal');
        if (!modal) {
            this.createUpdateAccountModal();
            return this.openUpdateAccountModal();
        }

        // 填充当前账户信息
        const account = this.currentAccount || { cash_balance: 0, position_value: 0, frozen_funds: 0 };
        document.getElementById('updateCashBalance').value = account.cash_balance;
        document.getElementById('updatePositionValue').value = account.position_value;
        document.getElementById('updateFrozenFunds').value = account.frozen_funds;

        modal.style.display = 'flex';
    },

    // 创建调整账户模态框
    createUpdateAccountModal() {
        const modalHtml = `
            <div id="updateAccountModal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>⚙️ 调整账户资金</h3>
                        <button class="close-btn" onclick="FundManagementManager.closeUpdateAccountModal()">×</button>
                    </div>
                    <div class="form-container">
                        <form id="updateAccountForm">
                            <div class="form-group">
                                <label for="updateCashBalance">现金余额 *</label>
                                <input type="number" id="updateCashBalance" class="form-input"
                                    placeholder="请输入现金余额" step="0.01" min="0" required>
                            </div>
                            <div class="form-group">
                                <label for="updatePositionValue">持仓市值 *</label>
                                <input type="number" id="updatePositionValue" class="form-input"
                                    placeholder="请输入持仓市值" step="0.01" min="0" required>
                            </div>
                            <div class="form-group">
                                <label for="updateFrozenFunds">冻结资金</label>
                                <input type="number" id="updateFrozenFunds" class="form-input"
                                    placeholder="请输入冻结资金" step="0.01" min="0" value="0">
                            </div>
                            <div class="form-hint">
                                💡 提示：调整账户资金会直接修改账户余额，不会生成资金流水记录
                            </div>
                            <div class="form-status" id="updateAccountFormStatus"></div>
                        </form>
                    </div>
                    <div class="modal-actions">
                        <button class="action-btn secondary" onclick="FundManagementManager.closeUpdateAccountModal()">取消</button>
                        <button class="action-btn" onclick="FundManagementManager.submitUpdateAccount()">
                            💾 保存
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // 关闭调整账户模态框
    closeUpdateAccountModal() {
        const modal = document.getElementById('updateAccountModal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('updateAccountFormStatus').innerHTML = '';
        }
    },

    // 提交调整账户
    async submitUpdateAccount() {
        try {
            const cashBalance = document.getElementById('updateCashBalance').value;
            const positionValue = document.getElementById('updatePositionValue').value;
            const frozenFunds = document.getElementById('updateFrozenFunds').value;

            // 验证
            if (!cashBalance || !positionValue) {
                UIUtils.showFormStatus('updateAccountFormStatus', '请填写现金余额和持仓市值', 'error');
                return;
            }

            UIUtils.showFormStatus('updateAccountFormStatus', '正在更新...', 'info');

            const response = await fetch('/api/fund-management/account', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                },
                body: JSON.stringify({
                    cash_balance: parseFloat(cashBalance),
                    position_value: parseFloat(positionValue),
                    frozen_funds: parseFloat(frozenFunds) || 0
                })
            });

            const result = await response.json();

            if (result.success) {
                UIUtils.showFormStatus('updateAccountFormStatus', '更新成功！', 'success');
                UIUtils.showToast('账户资金更新成功', 'success');
                setTimeout(() => {
                    this.closeUpdateAccountModal();
                    this.loadFundManagement();
                }, 1000);
            } else {
                UIUtils.showFormStatus('updateAccountFormStatus', result.error || '更新失败', 'error');
            }

        } catch (error) {
            console.error('更新账户资金错误:', error);
            UIUtils.showFormStatus('updateAccountFormStatus', '更新失败: ' + error.message, 'error');
        }
    }
};
