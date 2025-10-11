// ==================== 交易计划管理模块 ====================

const TradingPlanManager = {
    // 当前计划列表
    currentPlans: [],

    // 自动刷新定时器
    refreshTimer: null,

    // 初始化
    init() {
        console.log('📋 初始化交易计划管理模块...');
        this.setupEventListeners();
    },

    // 设置事件监听器
    setupEventListeners() {
        // 新建计划按钮
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn-create-plan')) {
                this.openCreatePlanModal();
            }

            // 执行计划
            if (e.target.closest('.btn-execute-plan')) {
                const planId = e.target.closest('.btn-execute-plan').dataset.planId;
                this.openExecutePlanModal(planId);
            }

            // 取消计划
            if (e.target.closest('.btn-cancel-plan')) {
                const planId = e.target.closest('.btn-cancel-plan').dataset.planId;
                this.cancelPlanWithConfirm(planId);
            }

            // 删除计划
            if (e.target.closest('.btn-delete-plan')) {
                const planId = e.target.closest('.btn-delete-plan').dataset.planId;
                this.deletePlanWithConfirm(planId);
            }

            // 编辑计划
            if (e.target.closest('.btn-edit-plan')) {
                const planId = e.target.closest('.btn-edit-plan').dataset.planId;
                this.openEditPlanModal(planId);
            }

            // 查看计划详情
            if (e.target.closest('.btn-view-plan-detail')) {
                const planId = e.target.closest('.btn-view-plan-detail').dataset.planId;
                this.openPlanDetailModal(planId);
            }
        });

        // 股票代码输入框监听 - 当失去焦点或按回车时自动获取股票信息
        document.addEventListener('change', (e) => {
            if (e.target.id === 'planStockCode') {
                const stockCode = e.target.value.trim();
                if (stockCode) {
                    this.fetchStockInfo(stockCode);
                }
            }
        });

        document.addEventListener('keypress', (e) => {
            if (e.target.id === 'planStockCode' && e.key === 'Enter') {
                e.preventDefault();
                const stockCode = e.target.value.trim();
                if (stockCode) {
                    this.fetchStockInfo(stockCode);
                }
            }
        });

        // 止盈止损滑块监听器
        document.addEventListener('input', (e) => {
            if (e.target.id === 'stopProfitSlider') {
                this.updatePriceFromSlider('stopProfit', e.target.value);
            }
            if (e.target.id === 'stopLossSlider') {
                this.updatePriceFromSlider('stopLoss', e.target.value);
            }
        });

        // 目标价格变化监听器 - 重新计算滑块价格
        document.addEventListener('input', (e) => {
            if (e.target.id === 'planTargetPrice') {
                this.recalculateSliderPrices();
            }
        });
    },

    // ==================== 1. 加载今日计划到首页 ====================
    async loadTodayTradingPlans(options = {}) {
        try {
            console.log('📊 加载今日交易计划...');

            const response = await fetch('/api/trading-plans/today', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('加载今日计划失败');
            }

            const result = await response.json();

            if (result.success) {
                this.currentPlans = result.data.allPlans || [];
                this.renderTodayPlansCard(result.data, options);

                // 启动自动刷新（每30秒更新一次价格）
                this.startAutoRefresh();

                console.log(`✅ 加载了 ${this.currentPlans.length} 个今日计划`);
            } else {
                throw new Error(result.error || '加载失败');
            }
        } catch (error) {
            console.error('❌ 加载今日计划错误:', error);
            this.showError('加载今日计划失败: ' + error.message);
        }
    },

    // ==================== 2. 渲染今日计划卡片 ====================
    renderTodayPlansCard(data, options = {}) {
        const { showActions = true, containerId = 'todayPlansBanner' } = options;
        const container = document.getElementById(containerId);

        if (!container) {
            console.warn('⚠️ 未找到今日计划容器');
            return;
        }

        const { highPriority = [], normalPriority = [], summary = {} } = data;
        const today = data.date || new Date().toISOString().split('T')[0];

        // 如果没有计划
        if (this.currentPlans.length === 0) {
            container.innerHTML = `
                <div class="today-plans-empty">
                    <div class="empty-icon">📋</div>
                    <div class="empty-text">下一交易日暂无计划</div>
                    ${showActions ? `
                    <button class="btn btn-primary btn-create-plan">
                        <i class="fas fa-plus"></i> 新建计划
                    </button>
                    ` : ''}
                </div>
            `;
            return;
        }

        let html = `
            <div class="today-plans-card">
                <div class="plans-header">
                    <div class="plans-title">
                        <i class="fas fa-calendar-check"></i>
                        <span>${showActions ? '今日交易计划' : '下一交易日计划'}</span>
                        <span class="plans-date">(${this.formatDate(today)})</span>
                    </div>
                    ${showActions ? `
                    <div class="plans-actions">
                        <button class="btn btn-sm btn-primary btn-create-plan">
                            <i class="fas fa-plus"></i> 新建计划
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="TradingPlanManager.navigateToPlansPage()">
                            <i class="fas fa-list"></i> 查看全部
                        </button>
                    </div>
                    ` : ''}
                </div>

                <div class="plans-summary">
                    <span class="summary-item">总计: <strong>${summary.total || 0}</strong></span>
                    <span class="summary-item">待执行: <strong class="text-primary">${summary.pending || 0}</strong></span>
                    ${summary.nearTarget > 0 ? `<span class="summary-item alert-highlight">📍 接近目标: <strong class="text-warning">${summary.nearTarget}</strong></span>` : ''}
                    <span class="summary-item">买入: <strong class="text-success">${summary.buyPlans || 0}</strong></span>
                    <span class="summary-item">卖出: <strong class="text-danger">${summary.sellPlans || 0}</strong></span>
                </div>
        `;

        // 高优先级计划
        if (highPriority.length > 0) {
            html += `
                <div class="plans-section">
                    <div class="section-title">
                        <i class="fas fa-fire"></i> 优先执行 (${highPriority.length}个)
                    </div>
                    <div class="plans-list">
                        ${highPriority.map(plan => this.renderPlanCard(plan, true, showActions)).join('')}
                    </div>
                </div>
            `;
        }

        // 普通优先级计划
        if (normalPriority.length > 0) {
            html += `
                <div class="plans-section">
                    <div class="section-title">
                        <i class="fas fa-bookmark"></i> 待观察 (${normalPriority.length}个)
                    </div>
                    <div class="plans-list">
                        ${normalPriority.map(plan => this.renderPlanCard(plan, false, showActions)).join('')}
                    </div>
                </div>
            `;
        }

        html += `</div>`;

        container.innerHTML = html;
    },

    // 渲染单个计划卡片
    renderPlanCard(plan, isHighPriority, showActions = true) {
        const planTypeMap = {
            'buy': { text: '买入', class: 'type-buy', icon: '📈' },
            'sell': { text: '卖出', class: 'type-sell', icon: '📉' },
            'add': { text: '加仓', class: 'type-add', icon: '➕' },
            'reduce': { text: '减仓', class: 'type-reduce', icon: '➖' }
        };

        const typeInfo = planTypeMap[plan.plan_type] || { text: '未知', class: '', icon: '❓' };
        const stars = '⭐'.repeat(plan.priority || 3);

        // 计算价格状态
        const priceGap = plan.priceGap || 0;
        const isNearTarget = plan.isNearTarget || false;

        let priceStatusClass = '';
        let priceStatusText = '';

        if (isNearTarget) {
            priceStatusClass = 'price-near-target';
            priceStatusText = '<span class="badge badge-warning">即将到达</span>';
        } else if (plan.plan_type === 'buy' || plan.plan_type === 'add') {
            if (priceGap <= 0) {
                priceStatusClass = 'price-can-buy';
                priceStatusText = '<span class="badge badge-success">可以买入</span>';
            } else {
                priceStatusText = `<span class="badge badge-secondary">观察中 (+${Math.abs(priceGap).toFixed(2)}%)</span>`;
            }
        } else if (plan.plan_type === 'sell' || plan.plan_type === 'reduce') {
            if (priceGap >= 0) {
                priceStatusClass = 'price-can-sell';
                priceStatusText = '<span class="badge badge-danger">可以卖出</span>';
            } else {
                priceStatusText = `<span class="badge badge-secondary">观察中 (${priceGap.toFixed(2)}%)</span>`;
            }
        }

        return `
            <div class="plan-card ${priceStatusClass} ${isHighPriority ? 'high-priority' : ''}" data-plan-id="${plan.id}">
                <div class="plan-card-header">
                    <div class="plan-info">
                        <span class="plan-priority">${stars}</span>
                        <span class="plan-type ${typeInfo.class}">${typeInfo.icon} ${typeInfo.text}</span>
                        <span class="plan-stock">
                            <strong>${plan.stock_code}</strong> ${plan.stock_name}
                        </span>
                        ${priceStatusText}
                    </div>
                    <div class="plan-time">
                        ${this.formatTime(plan.created_at)}创建
                    </div>
                </div>

                <div class="plan-card-body">
                    <div class="plan-prices">
                        <div class="price-item current">
                            <span class="price-label">当前:</span>
                            <span class="price-value">¥${plan.currentPrice?.toFixed(2) || '--'}</span>
                        </div>
                        <div class="price-item">
                            <span class="price-label">目标:</span>
                            <span class="price-value">¥${plan.target_price?.toFixed(2) || '--'}
                            ${plan.currentPrice ? (() => {
                                const gap = ((plan.target_price - plan.currentPrice) / plan.currentPrice * 100).toFixed(2);
                                return `<span class="price-gap ${gap >= 0 ? 'text-success' : 'text-danger'}">(${gap >= 0 ? '+' : ''}${gap}%)</span>`;
                            })() : ''}</span>
                        </div>
                        ${plan.stop_profit_price ? `
                        <div class="price-item">
                            <span class="price-label">止盈:</span>
                            <span class="price-value">¥${plan.stop_profit_price.toFixed(2)}
                            ${plan.currentPrice ? (() => {
                                const gap = ((plan.stop_profit_price - plan.currentPrice) / plan.currentPrice * 100).toFixed(2);
                                return `<span class="price-gap ${gap >= 0 ? 'text-success' : 'text-danger'}">(${gap >= 0 ? '+' : ''}${gap}%)</span>`;
                            })() : ''}</span>
                        </div>
                        ` : ''}
                        ${plan.stop_loss_price ? `
                        <div class="price-item">
                            <span class="price-label">止损:</span>
                            <span class="price-value">¥${plan.stop_loss_price.toFixed(2)}
                            ${plan.currentPrice ? (() => {
                                const gap = ((plan.stop_loss_price - plan.currentPrice) / plan.currentPrice * 100).toFixed(2);
                                return `<span class="price-gap ${gap >= 0 ? 'text-success' : 'text-danger'}">(${gap >= 0 ? '+' : ''}${gap}%)</span>`;
                            })() : ''}</span>
                        </div>
                        ` : ''}
                    </div>

                    ${plan.quantity ? `
                    <div class="plan-quantity">
                        <span>数量: <strong>${plan.quantity}股</strong></span>
                        <span>预估: <strong>¥${(plan.estimated_amount || 0).toLocaleString()}</strong></span>
                    </div>
                    ` : ''}

                    ${plan.reason ? `
                    <div class="plan-reason">
                        <i class="fas fa-lightbulb"></i> ${plan.reason}
                    </div>
                    ` : ''}
                </div>

                ${showActions ? `
                <div class="plan-card-actions">
                    <button class="btn btn-sm btn-success btn-execute-plan" data-plan-id="${plan.id}">
                        <i class="fas fa-check"></i> 执行
                    </button>
                    <button class="btn btn-sm btn-outline btn-edit-plan" data-plan-id="${plan.id}">
                        <i class="fas fa-edit"></i> 修改
                    </button>
                    <button class="btn btn-sm btn-outline btn-cancel-plan" data-plan-id="${plan.id}">
                        <i class="fas fa-times"></i> 取消
                    </button>
                    <button class="btn btn-sm btn-outline btn-view-plan-detail" data-plan-id="${plan.id}">
                        <i class="fas fa-info-circle"></i> 详情
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    },

    // ==================== 3. 打开新建计划模态框 ====================
    openCreatePlanModal(prefilledData = {}) {
        console.log('📝 打开新建计划模态框', prefilledData);

        // 获取模态框和表单元素
        const modal = document.getElementById('tradingPlanModal');
        const form = document.getElementById('tradingPlanForm');
        const modalTitle = document.getElementById('tradingPlanModalTitle');
        const submitBtnText = document.getElementById('planSubmitBtnText');

        if (!modal || !form) {
            console.error('❌ 未找到模态框或表单元素');
            return;
        }

        // 重置表单
        form.reset();
        const statusDiv = document.getElementById('planFormStatus');
        if (statusDiv) {
            statusDiv.style.display = 'none';
            statusDiv.className = 'form-status';
        }

        // 重置滑块和百分比显示
        const stopProfitSlider = document.getElementById('stopProfitSlider');
        const stopLossSlider = document.getElementById('stopLossSlider');
        const stopProfitPercentage = document.getElementById('stopProfitPercentage');
        const stopLossPercentage = document.getElementById('stopLossPercentage');

        if (stopProfitSlider) stopProfitSlider.value = 0;
        if (stopLossSlider) stopLossSlider.value = 0;
        if (stopProfitPercentage) stopProfitPercentage.textContent = '+0%';
        if (stopLossPercentage) stopLossPercentage.textContent = '-0%';

        // 判断是新建还是编辑
        const isEdit = prefilledData.id ? true : false;
        modalTitle.textContent = isEdit ? '✏️ 编辑交易计划' : '📝 新建交易计划';
        submitBtnText.textContent = isEdit ? '💾 保存修改' : '💾 创建计划';

        // 存储计划ID（如果是编辑模式）
        form.dataset.planId = prefilledData.id || '';

        // 设置默认值
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('planDate').value = prefilledData.planDate || today;
        document.getElementById('planPriority').value = prefilledData.priority || 3;

        // 预填充数据
        if (prefilledData.planType || prefilledData.plan_type) {
            document.getElementById('planType').value = prefilledData.planType || prefilledData.plan_type;
        }

        if (prefilledData.stockCode || prefilledData.stock_code) {
            document.getElementById('planStockCode').value = prefilledData.stockCode || prefilledData.stock_code;
        }

        if (prefilledData.stockName || prefilledData.stock_name) {
            document.getElementById('planStockName').value = prefilledData.stockName || prefilledData.stock_name;
        }

        if (prefilledData.currentPrice || prefilledData.current_price) {
            document.getElementById('planCurrentPrice').value = prefilledData.currentPrice || prefilledData.current_price;
        }

        if (prefilledData.targetPrice || prefilledData.target_price) {
            document.getElementById('planTargetPrice').value = prefilledData.targetPrice || prefilledData.target_price;
        }

        if (prefilledData.stopProfitPrice || prefilledData.stop_profit_price) {
            document.getElementById('planStopProfitPrice').value = prefilledData.stopProfitPrice || prefilledData.stop_profit_price;
        }

        if (prefilledData.stopLossPrice || prefilledData.stop_loss_price) {
            document.getElementById('planStopLossPrice').value = prefilledData.stopLossPrice || prefilledData.stop_loss_price;
        }

        if (prefilledData.quantity) {
            document.getElementById('planQuantity').value = prefilledData.quantity;
        }

        if (prefilledData.reason) {
            document.getElementById('planReason').value = prefilledData.reason;
        }

        if (prefilledData.notes) {
            document.getElementById('planNotes').value = prefilledData.notes;
        }

        // 如果有股票代码但没有当前价格，自动获取
        const stockCode = prefilledData.stockCode || prefilledData.stock_code;
        if (stockCode && !prefilledData.currentPrice && !prefilledData.current_price) {
            this.fetchCurrentPrice(stockCode);
        }

        // 显示模态框
        modal.style.display = 'block';

        // 聚焦到第一个未填充的必填字段
        setTimeout(() => {
            if (!document.getElementById('planType').value) {
                document.getElementById('planType').focus();
            } else if (!document.getElementById('planStockCode').value) {
                document.getElementById('planStockCode').focus();
            } else if (!document.getElementById('planTargetPrice').value) {
                document.getElementById('planTargetPrice').focus();
            }
        }, 100);
    },

    // 关闭计划模态框
    closePlanModal() {
        const modal = document.getElementById('tradingPlanModal');
        if (modal) {
            modal.style.display = 'none';
        }

        // 重置表单
        const form = document.getElementById('tradingPlanForm');
        if (form) {
            form.reset();
            form.dataset.planId = '';
        }

        // 清除状态消息
        const statusDiv = document.getElementById('planFormStatus');
        if (statusDiv) {
            statusDiv.style.display = 'none';
            statusDiv.className = 'form-status';
        }

        // 重置滑块和百分比显示
        const stopProfitSlider = document.getElementById('stopProfitSlider');
        const stopLossSlider = document.getElementById('stopLossSlider');
        const stopProfitPercentage = document.getElementById('stopProfitPercentage');
        const stopLossPercentage = document.getElementById('stopLossPercentage');

        if (stopProfitSlider) stopProfitSlider.value = 0;
        if (stopLossSlider) stopLossSlider.value = 0;
        if (stopProfitPercentage) stopProfitPercentage.textContent = '+0%';
        if (stopLossPercentage) stopLossPercentage.textContent = '-0%';
    },

    // 获取股票信息（名称和当前价格）
    async fetchStockInfo(stockCode) {
        try {
            console.log(`🔍 获取股票 ${stockCode} 的信息...`);

            // 显示加载状态
            const stockNameInput = document.getElementById('planStockName');
            const currentPriceInput = document.getElementById('planCurrentPrice');

            const originalStockNamePlaceholder = stockNameInput.placeholder;
            const originalPricePlaceholder = currentPriceInput.placeholder;

            stockNameInput.placeholder = '正在获取...';
            currentPriceInput.placeholder = '正在获取...';

            const response = await fetch(`/api/stock/quote/${stockCode}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success && result.data) {
                const stockName = result.data.stockName || result.data.name || '';
                const currentPrice = result.data.currentPrice || '';

                // 自动填充股票名称和当前价格
                stockNameInput.value = stockName;
                currentPriceInput.value = currentPrice;

                console.log(`✅ 股票信息: ${stockName} (${stockCode}), 当前价: ¥${currentPrice}`);

                // 显示成功提示
                this.showFormStatus(`✅ 已获取 ${stockName} 的最新价格: ¥${currentPrice}`, 'success');
                setTimeout(() => {
                    const statusDiv = document.getElementById('planFormStatus');
                    if (statusDiv) {
                        statusDiv.style.display = 'none';
                    }
                }, 3000);
            } else {
                throw new Error(result.error || '获取失败');
            }

            // 恢复占位符
            stockNameInput.placeholder = originalStockNamePlaceholder;
            currentPriceInput.placeholder = originalPricePlaceholder;
        } catch (error) {
            console.error('❌ 获取股票信息失败:', error);

            // 显示错误提示
            this.showFormStatus(`⚠️ 获取股票信息失败: ${error.message}`, 'error');
            setTimeout(() => {
                const statusDiv = document.getElementById('planFormStatus');
                if (statusDiv) {
                    statusDiv.style.display = 'none';
                }
            }, 3000);

            // 恢复占位符
            const stockNameInput = document.getElementById('planStockName');
            const currentPriceInput = document.getElementById('planCurrentPrice');
            stockNameInput.placeholder = '例如: 贵州茅台';
            currentPriceInput.placeholder = '自动获取';
        }
    },

    // 获取当前股价（保留兼容性）
    async fetchCurrentPrice(stockCode) {
        await this.fetchStockInfo(stockCode);
    },

    // 根据滑块值更新价格
    updatePriceFromSlider(type, percentage) {
        const targetPrice = parseFloat(document.getElementById('planTargetPrice').value);

        // 如果目标价格为空或无效，显示提示
        if (!targetPrice || targetPrice <= 0) {
            const percentageDisplayId = type === 'stopProfit' ? 'stopProfitPercentage' : 'stopLossPercentage';
            document.getElementById(percentageDisplayId).textContent =
                `${percentage >= 0 ? '+' : ''}${percentage}%`;
            return;
        }

        // 计算实际价格：目标价格 × (1 + 百分比/100)
        const calculatedPrice = targetPrice * (1 + parseFloat(percentage) / 100);

        // 更新对应的价格输入框和百分比显示
        const priceInputId = type === 'stopProfit' ? 'planStopProfitPrice' : 'planStopLossPrice';
        const percentageDisplayId = type === 'stopProfit' ? 'stopProfitPercentage' : 'stopLossPercentage';

        document.getElementById(priceInputId).value = calculatedPrice.toFixed(2);
        document.getElementById(percentageDisplayId).textContent =
            `${percentage >= 0 ? '+' : ''}${percentage}%`;

        console.log(`💰 ${type === 'stopProfit' ? '止盈' : '止损'}价格更新: ${calculatedPrice.toFixed(2)} (${percentage}%)`);
    },

    // 当目标价格变化时，重新计算滑块价格
    recalculateSliderPrices() {
        const stopProfitSlider = document.getElementById('stopProfitSlider');
        const stopLossSlider = document.getElementById('stopLossSlider');

        if (stopProfitSlider && stopProfitSlider.value != 0) {
            this.updatePriceFromSlider('stopProfit', stopProfitSlider.value);
        }

        if (stopLossSlider && stopLossSlider.value != 0) {
            this.updatePriceFromSlider('stopLoss', stopLossSlider.value);
        }
    },

    // 提交交易计划
    async submitPlan() {
        const form = document.getElementById('tradingPlanForm');
        const statusDiv = document.getElementById('planFormStatus');

        if (!form) return;

        // 获取表单数据
        const formData = {
            plan_type: document.getElementById('planType').value,
            plan_date: document.getElementById('planDate').value,
            stock_code: document.getElementById('planStockCode').value.trim(),
            stock_name: document.getElementById('planStockName').value.trim(),
            target_price: parseFloat(document.getElementById('planTargetPrice').value),
            stop_profit_price: document.getElementById('planStopProfitPrice').value ?
                parseFloat(document.getElementById('planStopProfitPrice').value) : null,
            stop_loss_price: document.getElementById('planStopLossPrice').value ?
                parseFloat(document.getElementById('planStopLossPrice').value) : null,
            quantity: document.getElementById('planQuantity').value ?
                parseInt(document.getElementById('planQuantity').value) : null,
            priority: parseInt(document.getElementById('planPriority').value),
            reason: document.getElementById('planReason').value.trim(),
            notes: document.getElementById('planNotes').value.trim() || null
        };

        // 验证必填字段
        if (!formData.plan_type) {
            this.showFormStatus('请选择计划类型', 'error');
            return;
        }

        if (!formData.plan_date) {
            this.showFormStatus('请选择执行日期', 'error');
            return;
        }

        if (!formData.stock_code) {
            this.showFormStatus('请输入股票代码', 'error');
            return;
        }

        if (!formData.stock_name) {
            this.showFormStatus('请输入股票名称', 'error');
            return;
        }

        if (!formData.target_price || formData.target_price <= 0) {
            this.showFormStatus('请输入有效的目标价格', 'error');
            return;
        }

        if (!formData.reason) {
            this.showFormStatus('请输入计划理由', 'error');
            return;
        }

        // 获取计划ID（如果是编辑模式）
        const planId = form.dataset.planId;
        const isEdit = planId ? true : false;

        try {
            this.showFormStatus(isEdit ? '正在保存修改...' : '正在创建计划...', 'info');

            const url = isEdit ? `/api/trading-plans/${planId}` : '/api/trading-plans';
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                this.showFormStatus(
                    isEdit ? '✅ 修改成功！' : '✅ 创建成功！',
                    'success'
                );

                // 延迟关闭模态框
                setTimeout(() => {
                    this.closePlanModal();
                    // 重新加载所有计划页面
                    this.refreshAllPlans();
                }, 1000);

                this.showSuccess(isEdit ? '计划修改成功' : '计划创建成功');
            } else {
                throw new Error(result.error || (isEdit ? '修改失败' : '创建失败'));
            }
        } catch (error) {
            console.error('❌ 提交计划错误:', error);
            this.showFormStatus('❌ ' + error.message, 'error');
            this.showError(error.message);
        }
    },

    // 显示表单状态消息
    showFormStatus(message, type) {
        const statusDiv = document.getElementById('planFormStatus');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `form-status ${type}`;
            statusDiv.style.display = 'block';
        }
    },

    // ==================== 4. 打开编辑计划模态框 ====================
    async openEditPlanModal(planId) {
        try {
            // 获取计划详情
            const plan = await this.getPlanById(planId);

            if (!plan) {
                throw new Error('计划不存在');
            }

            // 使用计划数据预填充模态框
            this.openCreatePlanModal(plan);
        } catch (error) {
            console.error('打开编辑模态框错误:', error);
            this.showError('打开编辑界面失败: ' + error.message);
        }
    },

    // ==================== 5. 打开执行计划模态框 ====================
    async openExecutePlanModal(planId) {
        try {
            const plan = await this.getPlanById(planId);

            if (!plan) {
                throw new Error('计划不存在');
            }

            // 创建简单的执行确认对话框
            const executionPrice = prompt(
                `执行计划: ${plan.stock_name} (${plan.stock_code})\n` +
                `目标价: ¥${plan.target_price}\n` +
                `当前价: ¥${plan.currentPrice || '--'}\n\n` +
                `请输入实际成交价格:`,
                plan.currentPrice || plan.target_price
            );

            if (!executionPrice) return;

            const executionQuantity = prompt(
                `请输入实际成交数量:`,
                plan.quantity || 0
            );

            if (!executionQuantity) return;

            await this.executeTradingPlan(planId, {
                executionPrice: parseFloat(executionPrice),
                executionQuantity: parseFloat(executionQuantity)
            });
        } catch (error) {
            console.error('打开执行模态框错误:', error);
            this.showError('打开执行界面失败: ' + error.message);
        }
    },

    // ==================== 6. 执行交易计划 ====================
    async executeTradingPlan(planId, executionData) {
        try {
            const response = await fetch(`/api/trading-plans/${planId}/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    executionType: 'manual',
                    executionPrice: executionData.executionPrice,
                    executionQuantity: executionData.executionQuantity,
                    notes: executionData.notes || ''
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('计划执行成功！');
                // 重新加载所有计划页面
                await this.refreshAllPlans();

                // 刷新我的持仓数据
                if (typeof loadUserPositions === 'function') {
                    await loadUserPositions();
                    console.log('✅ 已自动刷新持仓数据');
                }
            } else {
                throw new Error(result.error || '执行失败');
            }
        } catch (error) {
            console.error('执行计划错误:', error);
            this.showError('执行计划失败: ' + error.message);
        }
    },

    // ==================== 7. 取消计划（带确认） ====================
    async cancelPlanWithConfirm(planId) {
        const reason = prompt('请输入取消原因（可选）:');

        // 用户点击取消
        if (reason === null) return;

        await this.cancelTradingPlan(planId, reason);
    },

    async cancelTradingPlan(planId, reason) {
        try {
            const response = await fetch(`/api/trading-plans/${planId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ reason })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('计划已取消');
                await this.refreshAllPlans();
            } else {
                throw new Error(result.error || '取消失败');
            }
        } catch (error) {
            console.error('取消计划错误:', error);
            this.showError('取消计划失败: ' + error.message);
        }
    },

    // ==================== 8. 删除计划（带确认） ====================
    async deletePlanWithConfirm(planId) {
        if (!confirm('确定要删除这个计划吗？删除后无法恢复。')) {
            return;
        }

        await this.deleteTradingPlan(planId);
    },

    async deleteTradingPlan(planId) {
        try {
            const response = await fetch(`/api/trading-plans/${planId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('计划已删除');
                await this.refreshAllPlans();
            } else {
                throw new Error(result.error || '删除失败');
            }
        } catch (error) {
            console.error('删除计划错误:', error);
            this.showError('删除计划失败: ' + error.message);
        }
    },

    // ==================== 9. 获取计划详情 ====================
    async getPlanById(planId) {
        try {
            const response = await fetch(`/api/trading-plans/${planId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success) {
                return result.data.plan;
            } else {
                throw new Error(result.error || '获取失败');
            }
        } catch (error) {
            console.error('获取计划详情错误:', error);
            throw error;
        }
    },

    // ==================== 10. 打开计划详情模态框 ====================
    async openPlanDetailModal(planId) {
        try {
            const plan = await this.getPlanById(planId);

            if (!plan) {
                throw new Error('计划不存在');
            }

            // TODO: 实现详情模态框UI
            console.log('计划详情:', plan);
            this.showInfo('详情功能即将上线');
        } catch (error) {
            console.error('打开详情模态框错误:', error);
            this.showError('打开详情失败: ' + error.message);
        }
    },

    // ==================== 11. 自动刷新 ====================
    startAutoRefresh() {
        // 清除旧的定时器
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        // 每30秒刷新一次
        this.refreshTimer = setInterval(() => {
            console.log('🔄 自动刷新今日计划...');
            // 首页只显示预览，不显示操作按钮
            this.loadTodayTradingPlans({ showActions: false });
        }, 30000);
    },

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    },

    // ==================== 12. 计算价格偏差 ====================
    calculatePriceDeviation(targetPrice, currentPrice) {
        if (!targetPrice || !currentPrice) return null;
        return ((currentPrice - targetPrice) / targetPrice * 100).toFixed(2);
    },

    // ==================== 13. 判断是否接近目标价 ====================
    isNearTarget(targetPrice, currentPrice, range = 0.02) {
        if (!targetPrice || !currentPrice) return false;
        const gap = Math.abs((currentPrice - targetPrice) / targetPrice);
        return gap <= range;
    },

    // ==================== 14. 导航到计划管理页面 ====================
    navigateToPlansPage() {
        // 切换到交易计划页签
        console.log('导航到交易计划管理页面');
        // TODO: 实现页签切换
        this.showInfo('计划管理页面即将上线');
    },

    // ==================== 15. 加载所有交易计划（管理界面） ====================
    async loadAllTradingPlans(filters = {}) {
        try {
            console.log('📊 加载所有交易计划...', filters);

            const container = document.getElementById('tradingPlansContainer');
            if (!container) {
                console.warn('⚠️ 未找到交易计划容器');
                return;
            }

            // 显示加载状态
            container.innerHTML = '<div class="loading-text">正在加载交易计划...</div>';

            // 并行加载今日计划和所有计划
            const [todayResponse, allPlansResponse] = await Promise.all([
                fetch('/api/trading-plans/today', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                }),
                fetch(`/api/trading-plans?limit=${filters.limit || 100}&offset=${filters.offset || 0}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                })
            ]);

            if (!todayResponse.ok || !allPlansResponse.ok) {
                throw new Error('加载计划失败');
            }

            const todayResult = await todayResponse.json();
            const allPlansResult = await allPlansResponse.json();

            if (todayResult.success && allPlansResult.success) {
                // 渲染页面：先渲染今日计划，然后渲染所有计划
                this.renderAllPlansTable(allPlansResult.data.plans, todayResult.data);
                console.log(`✅ 加载了今日 ${todayResult.data.allPlans.length} 个计划，总计 ${allPlansResult.data.plans.length} 个计划`);
            } else {
                throw new Error(todayResult.error || allPlansResult.error || '加载失败');
            }
        } catch (error) {
            console.error('❌ 加载交易计划错误:', error);
            const container = document.getElementById('tradingPlansContainer');
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        <div class="error-icon">⚠️</div>
                        <div class="error-text">加载交易计划失败: ${error.message}</div>
                        <button class="btn btn-primary" onclick="TradingPlanManager.loadAllTradingPlans()">
                            重试
                        </button>
                    </div>
                `;
            }
        }
    },

    // ==================== 16. 渲染所有计划表格 ====================
    renderAllPlansTable(plans, todayData = null) {
        const container = document.getElementById('tradingPlansContainer');
        if (!container) return;

        // 如果没有计划
        if (!plans || plans.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div class="empty-text">暂无交易计划</div>
                    <button class="btn btn-primary btn-create-plan">
                        <i class="fas fa-plus"></i> 新建计划
                    </button>
                </div>
            `;
            return;
        }

        // 按状态分组
        const statusMap = {
            'pending': '待执行',
            'executed': '已执行',
            'cancelled': '已取消',
            'expired': '已过期'
        };

        const groupedPlans = {};
        plans.forEach(plan => {
            const status = plan.plan_status || 'pending';
            if (!groupedPlans[status]) {
                groupedPlans[status] = [];
            }
            groupedPlans[status].push(plan);
        });

        let html = '<div class="plans-management-container">';

        // ==================== 渲染今日计划（如果有数据） ====================
        if (todayData && todayData.allPlans && todayData.allPlans.length > 0) {
            // 创建临时容器用于渲染今日计划
            html += '<div id="managementTodayPlans"></div>';
        }

        // 添加筛选和统计区域
        html += `
            <div class="plans-filter-bar">
                <div class="plans-stats">
                    <span class="stat-item">总计: <strong>${plans.length}</strong></span>
                    ${groupedPlans['pending'] ? `<span class="stat-item">待执行: <strong class="text-primary">${groupedPlans['pending'].length}</strong></span>` : ''}
                    ${groupedPlans['executed'] ? `<span class="stat-item">已执行: <strong class="text-success">${groupedPlans['executed'].length}</strong></span>` : ''}
                    ${groupedPlans['cancelled'] ? `<span class="stat-item">已取消: <strong class="text-secondary">${groupedPlans['cancelled'].length}</strong></span>` : ''}
                    ${groupedPlans['expired'] ? `<span class="stat-item">已过期: <strong class="text-danger">${groupedPlans['expired'].length}</strong></span>` : ''}
                </div>
            </div>
        `;

        // 按优先级渲染：pending -> executed -> cancelled -> expired
        const statusOrder = ['pending', 'executed', 'cancelled', 'expired'];
        statusOrder.forEach(status => {
            if (groupedPlans[status] && groupedPlans[status].length > 0) {
                html += `
                    <div class="plans-group">
                        <div class="group-header">
                            <span class="group-title">${statusMap[status]} (${groupedPlans[status].length})</span>
                        </div>
                        <div class="plans-grid">
                            ${groupedPlans[status].map(plan => this.renderManagementPlanCard(plan)).join('')}
                        </div>
                    </div>
                `;
            }
        });

        html += '</div>';

        container.innerHTML = html;

        // ==================== 渲染今日计划到顶部 ====================
        if (todayData && todayData.allPlans && todayData.allPlans.length > 0) {
            // 使用 renderTodayPlansCard 渲染完整的今日计划（带操作按钮）
            this.currentPlans = todayData.allPlans; // 临时设置以供renderTodayPlansCard使用
            this.renderTodayPlansCard(todayData, {
                showActions: true,
                containerId: 'managementTodayPlans'
            });
        }
    },

    // ==================== 17. 渲染管理界面的计划卡片 ====================
    renderManagementPlanCard(plan) {
        const planTypeMap = {
            'buy': { text: '买入', class: 'type-buy', icon: '📈' },
            'sell': { text: '卖出', class: 'type-sell', icon: '📉' },
            'add': { text: '加仓', class: 'type-add', icon: '➕' },
            'reduce': { text: '减仓', class: 'type-reduce', icon: '➖' }
        };

        const statusMap = {
            'pending': { text: '待执行', class: 'status-pending' },
            'executed': { text: '已执行', class: 'status-executed' },
            'cancelled': { text: '已取消', class: 'status-cancelled' },
            'expired': { text: '已过期', class: 'status-expired' }
        };

        const typeInfo = planTypeMap[plan.plan_type] || { text: '未知', class: '', icon: '❓' };
        const statusInfo = statusMap[plan.plan_status] || { text: '未知', class: '' };
        const stars = '⭐'.repeat(plan.priority || 3);

        // 计算价格信息（如果有）
        let priceInfo = '';
        if (plan.currentPrice) {
            priceInfo = `
                <div class="price-info">
                    <span class="price-label">当前:</span>
                    <span class="price-value">¥${plan.currentPrice.toFixed(2)}</span>
                </div>
            `;
        }

        return `
            <div class="plan-management-card ${statusInfo.class}" data-plan-id="${plan.id}">
                <div class="card-header">
                    <div class="card-meta">
                        <span class="plan-priority-badge">${stars}</span>
                        <span class="plan-type-badge ${typeInfo.class}">${typeInfo.icon} ${typeInfo.text}</span>
                        <span class="plan-status-badge ${statusInfo.class}">${statusInfo.text}</span>
                    </div>
                    <div class="card-date">${this.formatDate(plan.plan_date)}</div>
                </div>

                <div class="card-body">
                    <div class="stock-info-section">
                        <div class="stock-code"><strong>${plan.stock_code}</strong></div>
                        <div class="stock-name">${plan.stock_name}</div>
                    </div>

                    <div class="price-section">
                        ${priceInfo}
                        <div class="price-info">
                            <span class="price-label">目标:</span>
                            <span class="price-value">¥${plan.target_price?.toFixed(2) || '--'}
                            ${plan.currentPrice ? (() => {
                                const gap = ((plan.target_price - plan.currentPrice) / plan.currentPrice * 100).toFixed(2);
                                return `<span class="price-gap ${gap >= 0 ? 'text-success' : 'text-danger'}">(${gap >= 0 ? '+' : ''}${gap}%)</span>`;
                            })() : ''}</span>
                        </div>
                    </div>

                    ${plan.quantity ? `
                    <div class="quantity-section">
                        <span>数量: ${plan.quantity}股</span>
                        ${plan.estimated_amount ? `<span>预估: ¥${plan.estimated_amount.toLocaleString()}</span>` : ''}
                    </div>
                    ` : ''}

                    ${plan.reason ? `
                    <div class="reason-section">
                        <i class="fas fa-lightbulb"></i> ${plan.reason}
                    </div>
                    ` : ''}
                </div>

                <div class="card-actions">
                    ${plan.plan_status === 'pending' ? `
                        <button class="btn btn-sm btn-success btn-execute-plan" data-plan-id="${plan.id}">
                            <i class="fas fa-check"></i> 执行
                        </button>
                        <button class="btn btn-sm btn-outline btn-edit-plan" data-plan-id="${plan.id}">
                            <i class="fas fa-edit"></i> 编辑
                        </button>
                        <button class="btn btn-sm btn-outline btn-cancel-plan" data-plan-id="${plan.id}">
                            <i class="fas fa-times"></i> 取消
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline btn-delete-plan" data-plan-id="${plan.id}">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            </div>
        `;
    },

    // ==================== 辅助函数 ====================

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekday = weekdays[date.getDay()];
        return `${month}月${day}日 ${weekday}`;
    },

    formatTime(dateTimeStr) {
        if (!dateTimeStr) return '';

        const date = new Date(dateTimeStr);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return '刚刚';
        if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
        if (diff < 172800) return '昨天';

        return `${date.getMonth() + 1}月${date.getDate()}日`;
    },

    showSuccess(message) {
        // 使用系统的通知函数
        if (window.showSuccess) {
            window.showSuccess(message);
        } else {
            alert(message);
        }
    },

    showError(message) {
        if (window.showError) {
            window.showError(message);
        } else {
            alert('错误: ' + message);
        }
    },

    showInfo(message) {
        if (window.showNotification) {
            window.showNotification(message, 'info');
        } else {
            alert(message);
        }
    },

    // ==================== 刷新所有计划页面 ====================
    async refreshAllPlans() {
        console.log('🔄 刷新交易计划管理页面...');

        // 刷新交易计划管理页面
        const tradingPlansContainer = document.getElementById('tradingPlansContainer');
        if (tradingPlansContainer && tradingPlansContainer.closest('.sub-tab-content.active')) {
            await this.loadAllTradingPlans();
        }

        console.log('✅ 交易计划页面已刷新');
    }
};

// 导出模块
window.TradingPlanManager = TradingPlanManager;

// ==================== 全局辅助函数：快速创建计划 ====================
/**
 * 从股票信息快速创建交易计划
 * @param {string} stockCode - 股票代码
 * @param {string} stockName - 股票名称
 * @param {number} currentPrice - 当前价格
 * @param {string} planType - 计划类型 (buy/sell/add/reduce)
 */
window.createTradingPlanFromStock = function(stockCode, stockName, currentPrice, planType) {
    console.log(`📋 快速创建${planType}计划:`, stockCode, stockName, currentPrice);

    // 预填充数据
    const prefilledData = {
        stockCode: stockCode,
        stockName: stockName,
        currentPrice: currentPrice,
        planType: planType,
        planDate: new Date().toISOString().split('T')[0] // 今天
    };

    // 调用交易计划管理器的创建模态框
    TradingPlanManager.openCreatePlanModal(prefilledData);
};
