// ==================== 股票池管理模块 ====================

const StockPoolManager = {
    currentPool: null,
    pools: [],
    currentSelectedStock: null, // 当前选中的股票
    poolStocksData: [], // 股票池中的股票数据
    poolQuotesData: {}, // 股票行情数据

    // 初始化股票池管理
    init: async function() {
        console.log('📊 初始化股票池管理模块');
        await this.loadPools();
    },

    // 加载所有股票池
    loadPools: async function() {
        try {
            const response = await fetch('/api/stock-pool/pools', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.pools = data.data;
                this.renderPoolsGrid();
                console.log('✅ 股票池加载成功，共', this.pools.length, '个');
            } else {
                showNotification(data.error || '加载股票池失败', 'error');
            }

        } catch (error) {
            console.error('❌ 加载股票池失败:', error);
            showNotification('加载股票池失败', 'error');
        }
    },

    // 渲染股票池列表（新的侧边栏布局）
    renderPoolsGrid: function() {
        const container = document.getElementById('stockPoolGrid');
        if (!container) return;

        // 创建左右分栏布局
        let html = `
            <div class="stock-pool-container">
                <!-- 左侧股票池列表 -->
                <div class="stock-pool-sidebar">
                    <button class="create-pool-btn" onclick="StockPoolManager.openCreatePoolModal()">
                        ➕ 创建股票池
                    </button>
                    <div class="sidebar-title">我的股票池</div>
                    <div class="pool-list" id="poolList">
        `;

        if (this.pools.length === 0) {
            html += `
                        <div class="pool-empty-hint">暂无股票池，点击上方按钮创建</div>
            `;
        } else {
            // 显示所有股票池
            this.pools.forEach((pool, index) => {
                const poolType = pool.pool_type || 'custom';
                const isFirst = index === 0;

                html += `
                    <div class="pool-list-item ${poolType}-pool ${isFirst ? 'active' : ''}"
                         data-pool-id="${pool.id}"
                         onclick="StockPoolManager.selectPool(${pool.id})">
                        <div class="pool-list-header">
                            <div class="pool-list-name">
                                ${this.getPoolIcon(poolType)}
                                <span>${escapeHtml(pool.name)}</span>
                            </div>
                            <div class="pool-list-count">${pool.stock_count || 0}</div>
                        </div>
                        <div class="pool-list-actions">
                            <button class="pool-list-action-btn"
                                    onclick="event.stopPropagation(); StockPoolManager.openEditPoolModal(${pool.id})"
                                    title="编辑">
                                ✏️ 编辑
                            </button>
                            <button class="pool-list-action-btn"
                                    onclick="event.stopPropagation(); StockPoolManager.confirmDeletePool(${pool.id})"
                                    title="删除">
                                🗑️ 删除
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += `
                    </div>
                </div>

                <!-- 右侧股票详情区域 -->
                <div class="stock-pool-main" id="poolMainContent">
        `;

        if (this.pools.length === 0) {
            html += `
                    <div class="pool-main-empty">
                        <div class="pool-main-empty-icon">📊</div>
                        <div class="pool-main-empty-text">暂无股票池</div>
                        <div class="pool-main-empty-hint">请先创建一个股票池</div>
                    </div>
            `;
        } else {
            html += `
                    <div class="loading-text">正在加载股票池详情...</div>
            `;
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;

        // 如果有股票池，自动加载第一个
        if (this.pools.length > 0) {
            this.viewPoolDetail(this.pools[0].id);
        }
    },

    // 选择股票池
    selectPool: function(poolId) {
        // 更新选中状态
        document.querySelectorAll('.pool-list-item').forEach(item => {
            item.classList.remove('active');
        });

        const selectedItem = document.querySelector(`[data-pool-id="${poolId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        // 加载股票池详情
        this.viewPoolDetail(poolId);
    },

    // 获取股票池图标
    getPoolIcon: function(poolType) {
        const icons = {
            'custom': '📁',
            'core': '⭐',
            'watch': '👁️',
            'blacklist': '🚫'
        };
        return icons[poolType] || '📁';
    },

    // 打开创建股票池模态框
    openCreatePoolModal: function() {
        document.getElementById('poolModalTitle').textContent = '创建股票池';
        document.getElementById('poolFormSubmitBtn').textContent = '💾 创建';
        document.getElementById('poolFormId').value = '';
        document.getElementById('poolFormName').value = '';
        document.getElementById('poolFormDescription').value = '';
        document.getElementById('poolFormType').value = 'custom';
        document.getElementById('poolFormTags').value = '';
        document.getElementById('poolFormStatus').innerHTML = '';

        document.getElementById('stockPoolFormModal').classList.add('show');
    },

    // 打开编辑股票池模态框
    openEditPoolModal: async function(poolId) {
        try {
            const pool = this.pools.find(p => p.id === poolId);
            if (!pool) {
                showNotification('股票池不存在', 'error');
                return;
            }

            document.getElementById('poolModalTitle').textContent = '编辑股票池';
            document.getElementById('poolFormSubmitBtn').textContent = '💾 保存';
            document.getElementById('poolFormId').value = pool.id;
            document.getElementById('poolFormName').value = pool.name;
            document.getElementById('poolFormDescription').value = pool.description || '';
            document.getElementById('poolFormType').value = pool.pool_type || 'custom';
            document.getElementById('poolFormTags').value = pool.tags || '';
            document.getElementById('poolFormStatus').innerHTML = '';

            document.getElementById('stockPoolFormModal').classList.add('show');

        } catch (error) {
            console.error('❌ 打开编辑模态框失败:', error);
            showNotification('打开编辑模态框失败', 'error');
        }
    },

    // 关闭股票池表单模态框
    closePoolFormModal: function() {
        document.getElementById('stockPoolFormModal').classList.remove('show');
    },

    // 提交股票池表单
    submitPoolForm: async function() {
        try {
            const poolId = document.getElementById('poolFormId').value;
            const name = document.getElementById('poolFormName').value.trim();
            const description = document.getElementById('poolFormDescription').value.trim();
            const pool_type = document.getElementById('poolFormType').value;
            const tags = document.getElementById('poolFormTags').value.trim();

            if (!name) {
                document.getElementById('poolFormStatus').innerHTML = `
                    <div class="error">股票池名称不能为空</div>
                `;
                return;
            }

            const poolData = {
                name,
                description,
                pool_type,
                tags
            };

            const isEdit = poolId !== '';
            const url = isEdit ? `/api/stock-pool/pools/${poolId}` : '/api/stock-pool/pools';
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(poolData)
            });

            const data = await response.json();

            if (data.success) {
                showNotification(isEdit ? '股票池更新成功' : '股票池创建成功', 'success');
                this.closePoolFormModal();
                await this.loadPools();
            } else {
                document.getElementById('poolFormStatus').innerHTML = `
                    <div class="error">${data.error || (isEdit ? '更新失败' : '创建失败')}</div>
                `;
            }

        } catch (error) {
            console.error('❌ 提交股票池表单失败:', error);
            document.getElementById('poolFormStatus').innerHTML = `
                <div class="error">提交失败，请重试</div>
            `;
        }
    },

    // 确认删除股票池
    confirmDeletePool: function(poolId) {
        const pool = this.pools.find(p => p.id === poolId);
        if (!pool) return;

        if (confirm(`确定要删除股票池"${pool.name}"吗？\n该股票池中的所有股票也将被删除（不会影响自选股列表）。`)) {
            this.deletePool(poolId);
        }
    },

    // 删除股票池
    deletePool: async function(poolId) {
        try {
            const response = await fetch(`/api/stock-pool/pools/${poolId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (data.success) {
                showNotification('股票池删除成功', 'success');
                await this.loadPools();
            } else {
                showNotification(data.error || '删除失败', 'error');
            }

        } catch (error) {
            console.error('❌ 删除股票池失败:', error);
            showNotification('删除股票池失败', 'error');
        }
    },

    // 查看股票池详情
    viewPoolDetail: async function(poolId) {
        try {
            const response = await fetch(`/api/stock-pool/pools/${poolId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.currentPool = data.data.pool;
                this.renderPoolDetail(data.data.pool, data.data.stocks);
            } else {
                showNotification(data.error || '加载详情失败', 'error');
            }

        } catch (error) {
            console.error('❌ 加载股票池详情失败:', error);
            showNotification('加载股票池详情失败', 'error');
        }
    },

    // 渲染股票池详情（在右侧面板）
    renderPoolDetail: async function(pool, stocks) {
        const container = document.getElementById('poolMainContent');
        if (!container) return;

        const tags = pool.tags ? pool.tags.split(',').filter(t => t.trim()) : [];

        let html = `
            <div class="pool-detail-header">
                <div class="pool-detail-title">
                    ${this.getPoolIcon(pool.pool_type)}
                    <span>${escapeHtml(pool.name)}</span>
                </div>
                ${pool.description ? `<div class="pool-description">${escapeHtml(pool.description)}</div>` : ''}
                <div class="pool-detail-meta">
                    <div class="pool-detail-meta-item">
                        📊 股票数量: ${stocks.length}
                    </div>
                    <div class="pool-detail-meta-item">
                        📅 创建时间: ${formatDateTime(pool.created_at)}
                    </div>
                    ${tags.length > 0 ? `
                        <div class="pool-detail-meta-item">
                            🏷️ 标签: ${tags.join(', ')}
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="pool-toolbar">
                <div class="pool-search-box">
                    <input type="text" class="pool-search-input" id="poolStockSearch"
                           placeholder="搜索股票代码或名称..."
                           onkeyup="StockPoolManager.filterPoolStocks()">
                </div>
                <div class="pool-toolbar-actions">
                    <button class="pool-toolbar-btn primary" onclick="StockPoolManager.openAddStockModal(${pool.id})">
                        ➕ 添加股票
                    </button>
                </div>
            </div>

            <div class="pool-stock-list" id="poolStockList">
                <div class="loading-text">正在获取行情数据...</div>
            </div>
        `;

        container.innerHTML = html;

        // 异步获取行情并渲染
        await this.renderPoolStocksWithQuotes(pool.id, stocks);
    },

    // 渲染带行情的股票列表（新的左右分栏布局）
    renderPoolStocksWithQuotes: async function(poolId, stocks) {
        const container = document.getElementById('poolStockList');
        if (!container) return;

        if (stocks.length === 0) {
            container.innerHTML = `
                <div class="pool-empty-state">
                    <div class="pool-empty-icon">📊</div>
                    <div class="pool-empty-text">股票池中还没有股票</div>
                    <div class="pool-empty-hint">点击"添加股票"按钮开始添加</div>
                </div>
            `;
            return;
        }

        try {
            // 获取所有股票的实时行情
            const stockCodes = stocks.map(s => s.stock_code);
            const quotesResponse = await fetch('/api/stock/quotes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ stockCodes })
            });

            const quotesResult = await quotesResponse.json();
            const quotes = quotesResult.success ? quotesResult.data : [];

            // 创建行情映射
            const quoteMap = {};
            quotes.forEach(quote => {
                quoteMap[quote.stockCode] = quote;
            });

            // 保存数据供后续使用
            this.poolStocksData = stocks;
            this.poolQuotesData = quoteMap;

            // 渲染左右分栏布局
            let html = `
                <!-- 左侧股票列表 -->
                <div class="pool-stock-sidebar" id="poolStockSidebar">
            `;

            // 渲染股票列表项
            stocks.forEach((stock, index) => {
                const quote = quoteMap[stock.stock_code];
                const currentPrice = quote ? parseFloat(quote.currentPrice) : 0;
                const todayChangePercent = quote ? parseFloat(quote.changePercent) : 0;
                const todayChangeClass = todayChangePercent > 0 ? 'positive' : (todayChangePercent < 0 ? 'negative' : 'neutral');
                const isFirst = index === 0;

                html += `
                    <div class="pool-stock-list-item ${isFirst ? 'active' : ''}"
                         data-stock-index="${index}"
                         data-stock-code="${stock.stock_code}"
                         onclick="StockPoolManager.selectStock(${poolId}, ${index})">
                        <div class="pool-stock-list-item-header">
                            <div class="pool-stock-list-item-code">${stock.stock_code}</div>
                        </div>
                        <div class="pool-stock-list-item-name">${escapeHtml(stock.stock_name)}</div>
                        <div class="pool-stock-list-item-prices">
                            ${quote ? `
                                <div class="pool-stock-list-item-price">¥${currentPrice.toFixed(2)}</div>
                                <div class="pool-stock-list-item-change ${todayChangeClass}">
                                    ${todayChangePercent > 0 ? '+' : ''}${todayChangePercent}%
                                </div>
                            ` : '<div class="pool-stock-list-item-price">--</div>'}
                        </div>
                    </div>
                `;
            });

            html += `
                </div>

                <!-- 右侧股票详情 -->
                <div class="pool-stock-detail" id="poolStockDetail">
                    <div class="loading-text">正在加载股票详情...</div>
                </div>
            `;

            container.innerHTML = html;

            // 自动选中第一个股票
            if (stocks.length > 0) {
                this.renderStockDetail(poolId, 0);
            }

        } catch (error) {
            console.error('获取股票行情失败:', error);
            container.innerHTML = `<div class="error-text">获取行情数据失败</div>`;
        }
    },

    // 选中股票
    selectStock: function(poolId, stockIndex) {
        // 更新选中状态
        document.querySelectorAll('.pool-stock-list-item').forEach(item => {
            item.classList.remove('active');
        });

        const selectedItem = document.querySelector(`[data-stock-index="${stockIndex}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        // 渲染股票详情
        this.renderStockDetail(poolId, stockIndex);
    },

    // 渲染股票详情
    renderStockDetail: function(poolId, stockIndex) {
        const detailContainer = document.getElementById('poolStockDetail');
        if (!detailContainer) return;

        const stock = this.poolStocksData[stockIndex];
        if (!stock) return;

        this.currentSelectedStock = stock;

        const quote = this.poolQuotesData[stock.stock_code];
        const tags = stock.tags ? stock.tags.split(',').filter(t => t.trim()) : [];
        const addedPrice = parseFloat(stock.added_price) || 0;
        const currentPrice = quote ? parseFloat(quote.currentPrice) : 0;
        const todayChangePercent = quote ? parseFloat(quote.changePercent) : 0;

        // 计算相对于加入价的涨跌幅
        const sinceAddedPercent = addedPrice > 0 && currentPrice > 0
            ? (((currentPrice - addedPrice) / addedPrice) * 100).toFixed(2)
            : '0.00';

        const todayChangeClass = todayChangePercent > 0 ? 'positive' : (todayChangePercent < 0 ? 'negative' : 'neutral');
        const sinceAddedClass = parseFloat(sinceAddedPercent) > 0 ? 'positive' : (parseFloat(sinceAddedPercent) < 0 ? 'negative' : 'neutral');

        // 格式化加入时间
        const addedDate = stock.added_at ? new Date(stock.added_at).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }) : '未知';

        const chartId = `pool-chart-${stock.stock_code}`;

        // 获取默认K线周期
        const defaultPeriod = window.SettingsManager ? window.SettingsManager.getSettings().chartPeriod : 'day';

        let html = `
            <div class="pool-stock-item">
                <!-- 股票头部信息 -->
                <div class="pool-stock-header">
                    <div class="pool-stock-info">
                        <div class="pool-stock-basic">
                            <div class="pool-stock-code-name">
                                <span class="pool-stock-code">${stock.stock_code}</span>
                                <span class="pool-stock-name">${escapeHtml(stock.stock_name)}</span>
                            </div>
                            ${tags.length > 0 ? `
                                <div class="pool-stock-tags">
                                    ${tags.map(tag => `<span class="pool-stock-tag">${escapeHtml(tag)}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                        <div class="pool-stock-prices">
                            ${quote ? `
                                <div class="pool-price-item">
                                    <div class="pool-price-label">💰 当前价</div>
                                    <div class="pool-price-value current">¥${currentPrice.toFixed(2)}</div>
                                </div>
                                <div class="pool-price-item">
                                    <div class="pool-price-label">📊 今日涨跌</div>
                                    <div class="pool-price-change ${todayChangeClass}">
                                        ${todayChangePercent > 0 ? '+' : ''}${todayChangePercent}%
                                    </div>
                                </div>
                            ` : '<div class="pool-price-item"><div class="pool-price-label">暂无行情</div></div>'}

                            <div class="pool-price-item">
                                <div class="pool-price-label">🎯 加入价</div>
                                <div class="pool-price-value">${addedPrice > 0 ? '¥' + addedPrice.toFixed(2) : '<span style="color: #94a3b8; font-size: 0.9rem;">未记录</span>'}</div>
                            </div>

                            ${addedPrice > 0 && currentPrice > 0 ? `
                                <div class="pool-price-item">
                                    <div class="pool-price-label">📈 加入后涨跌</div>
                                    <div class="pool-price-change ${sinceAddedClass}">
                                        ${parseFloat(sinceAddedPercent) > 0 ? '+' : ''}${sinceAddedPercent}%
                                    </div>
                                </div>
                            ` : `
                                <div class="pool-price-item">
                                    <div class="pool-price-label">📈 加入后涨跌</div>
                                    <div class="pool-price-value"><span style="color: #94a3b8; font-size: 0.9rem;">--</span></div>
                                </div>
                            `}

                            <div class="pool-price-item">
                                <div class="pool-price-label">🕒 加入时间</div>
                                <div class="pool-price-time">${addedDate}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- K线图区域 -->
                <div class="pool-stock-chart-section">
                    <div class="pool-chart-period-selector">
                        <button class="pool-period-btn ${defaultPeriod === 'intraday' ? 'active' : ''}"
                                data-period="intraday" data-chart="${chartId}" data-stock="${stock.stock_code}">分时</button>
                        <button class="pool-period-btn ${defaultPeriod === 'day' ? 'active' : ''}"
                                data-period="day" data-chart="${chartId}" data-stock="${stock.stock_code}">日线</button>
                        <button class="pool-period-btn ${defaultPeriod === 'week' ? 'active' : ''}"
                                data-period="week" data-chart="${chartId}" data-stock="${stock.stock_code}">周线</button>
                        <button class="pool-period-btn ${defaultPeriod === 'month' ? 'active' : ''}"
                                data-period="month" data-chart="${chartId}" data-stock="${stock.stock_code}">月线</button>
                    </div>
                    <div class="pool-stock-chart-container">
                        <canvas id="${chartId}" class="pool-stock-chart"></canvas>
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div class="pool-stock-actions">
                    ${stock.notes ? `<div class="pool-stock-notes" style="flex: 1; text-align: left; margin-right: 10px;">备注: ${escapeHtml(stock.notes)}</div>` : '<div style="flex: 1;"></div>'}
                    <button class="validate-btn" onclick="BuyPointValidationManager.validateBuyPoint('${stock.stock_code}', '${escapeHtml(stock.stock_name)}')">
                        ✅ 验证买入点
                    </button>
                    <button class="pool-stock-action-btn edit-btn" onclick="StockPoolManager.openEditStockModal(${poolId}, ${stock.id})">
                        ✏️ 编辑
                    </button>
                    <button class="pool-stock-action-btn delete-btn" onclick="StockPoolManager.confirmDeleteStock(${poolId}, ${stock.id}, '${stock.stock_code}')">
                        🗑️ 删除
                    </button>
                </div>
            </div>
        `;

        detailContainer.innerHTML = html;

        // 渲染K线图
        if (typeof renderStockChart === 'function') {
            renderStockChart(chartId, stock.stock_code, defaultPeriod);
        }

        // 绑定周期切换按钮事件
        document.querySelectorAll('.pool-period-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const period = this.getAttribute('data-period');
                const chartId = this.getAttribute('data-chart');
                const stockCode = this.getAttribute('data-stock');

                // 更新按钮状态
                const parentSelector = this.parentElement;
                parentSelector.querySelectorAll('.pool-period-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                // 重新渲染图表
                if (typeof renderStockChart === 'function') {
                    renderStockChart(chartId, stockCode, period);
                }
            });
        });
    },

    // 旧的渲染函数（保留用于兼容）
    renderPoolStocks: function(poolId, stocks) {
        if (stocks.length === 0) {
            return `
                <div class="pool-empty-state">
                    <div class="pool-empty-icon">📊</div>
                    <div class="pool-empty-text">股票池中还没有股票</div>
                    <div class="pool-empty-hint">点击"添加股票"按钮开始添加</div>
                </div>
            `;
        }

        return stocks.map(stock => {
            const tags = stock.tags ? stock.tags.split(',').filter(t => t.trim()) : [];

            return `
                <div class="pool-stock-item" data-stock-code="${stock.stock_code}" data-stock-name="${escapeHtml(stock.stock_name)}">
                    <div class="pool-stock-info">
                        <div class="pool-stock-code">${stock.stock_code}</div>
                        <div class="pool-stock-name">${escapeHtml(stock.stock_name)}</div>
                        ${tags.length > 0 ? `
                            <div class="pool-stock-tags">
                                ${tags.map(tag => `<span class="pool-stock-tag">${escapeHtml(tag)}</span>`).join('')}
                            </div>
                        ` : ''}
                        ${stock.notes ? `<div class="pool-stock-notes">${escapeHtml(stock.notes)}</div>` : ''}
                    </div>
                    <div class="pool-stock-actions">
                        <button class="validate-btn" onclick="BuyPointValidationManager.validateBuyPoint('${stock.stock_code}', '${escapeHtml(stock.stock_name)}')">
                            ✅ 验证买入点
                        </button>
                        <button class="pool-stock-action-btn" onclick="StockPoolManager.openEditStockModal(${poolId}, ${stock.id})">
                            ✏️ 编辑
                        </button>
                        <button class="pool-stock-action-btn delete-btn" onclick="StockPoolManager.confirmDeleteStock(${poolId}, ${stock.id}, '${stock.stock_code}')">
                            🗑️ 删除
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // 过滤股票（适配新的左右布局）
    filterPoolStocks: function() {
        const searchText = document.getElementById('poolStockSearch').value.toLowerCase();
        const items = document.querySelectorAll('.pool-stock-list-item');

        items.forEach(item => {
            const code = item.dataset.stockCode;
            const itemName = item.querySelector('.pool-stock-list-item-name');
            const name = itemName ? itemName.textContent.toLowerCase() : '';

            if (code.includes(searchText) || name.includes(searchText)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    },

    // 打开添加股票模态框
    openAddStockModal: function(poolId) {
        document.getElementById('addStockPoolId').value = poolId;
        document.getElementById('addStockCode').value = '';
        document.getElementById('addStockName').value = '';
        document.getElementById('addStockTags').value = '';
        document.getElementById('addStockNotes').value = '';
        document.getElementById('addStockFormStatus').innerHTML = '';

        // 添加股票代码输入框的事件监听
        const stockCodeInput = document.getElementById('addStockCode');
        const stockNameInput = document.getElementById('addStockName');

        // 移除旧的事件监听（如果存在）
        stockCodeInput.removeEventListener('blur', this._handleStockCodeBlur);

        // 创建新的事件处理函数
        this._handleStockCodeBlur = async () => {
            const stockCode = stockCodeInput.value.trim();

            // 验证股票代码格式（6位数字）
            if (!/^[0-9]{6}$/.test(stockCode)) {
                if (stockCode.length > 0) {
                    document.getElementById('addStockFormStatus').innerHTML = `
                        <div class="error">请输入正确的6位股票代码</div>
                    `;
                }
                return;
            }

            // 清空提示
            document.getElementById('addStockFormStatus').innerHTML = '';

            // 如果股票名称已经有值，不覆盖
            if (stockNameInput.value.trim()) {
                return;
            }

            // 获取股票信息
            try {
                stockNameInput.value = '获取中...';
                stockNameInput.disabled = true;

                const response = await fetch(`/api/stock/quote/${stockCode}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                const data = await response.json();

                if (data.success && data.data && data.data.stockName) {
                    stockNameInput.value = data.data.stockName;
                    document.getElementById('addStockFormStatus').innerHTML = `
                        <div class="success">✓ 已自动获取股票名称</div>
                    `;
                    // 3秒后清除成功提示
                    setTimeout(() => {
                        const status = document.getElementById('addStockFormStatus');
                        if (status && status.innerHTML.includes('已自动获取')) {
                            status.innerHTML = '';
                        }
                    }, 3000);
                } else {
                    stockNameInput.value = '';
                    document.getElementById('addStockFormStatus').innerHTML = `
                        <div class="warning">⚠ 未找到该股票，请手动输入股票名称</div>
                    `;
                }
            } catch (error) {
                console.error('获取股票信息失败:', error);
                stockNameInput.value = '';
                document.getElementById('addStockFormStatus').innerHTML = `
                    <div class="warning">⚠ 获取股票名称失败，请手动输入</div>
                `;
            } finally {
                stockNameInput.disabled = false;
            }
        };

        // 添加失焦事件监听
        stockCodeInput.addEventListener('blur', this._handleStockCodeBlur);

        // 添加Enter键监听
        stockCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._handleStockCodeBlur();
            }
        });

        document.getElementById('addStockToPoolModal').classList.add('show');

        // 聚焦到股票代码输入框
        setTimeout(() => stockCodeInput.focus(), 100);
    },

    // 关闭添加股票模态框
    closeAddStockModal: function() {
        document.getElementById('addStockToPoolModal').classList.remove('show');
    },

    // 提交添加股票
    submitAddStock: async function() {
        try {
            const poolId = document.getElementById('addStockPoolId').value;
            const stock_code = document.getElementById('addStockCode').value.trim();
            const stock_name = document.getElementById('addStockName').value.trim();
            const tags = document.getElementById('addStockTags').value.trim();
            const notes = document.getElementById('addStockNotes').value.trim();

            if (!stock_code || !stock_name) {
                document.getElementById('addStockFormStatus').innerHTML = `
                    <div class="error">股票代码和名称不能为空</div>
                `;
                return;
            }

            const stockData = { stock_code, stock_name, tags, notes };

            const response = await fetch(`/api/stock-pool/pools/${poolId}/stocks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(stockData)
            });

            const data = await response.json();

            if (data.success) {
                showNotification(data.message || '添加股票成功', 'success');
                this.closeAddStockModal();
                await this.viewPoolDetail(poolId);

                // 刷新自选股列表和行情
                console.log('🔄 股票已添加到股票池，刷新自选股...');
                if (typeof loadWatchlist === 'function') {
                    loadWatchlist();
                }
                if (typeof loadWatchlistQuotes === 'function') {
                    loadWatchlistQuotes();
                }
                if (typeof loadOverviewWatchlistQuotes === 'function') {
                    loadOverviewWatchlistQuotes();
                }
            } else {
                document.getElementById('addStockFormStatus').innerHTML = `
                    <div class="error">${data.error || '添加失败'}</div>
                `;
            }

        } catch (error) {
            console.error('❌ 添加股票失败:', error);
            document.getElementById('addStockFormStatus').innerHTML = `
                <div class="error">添加失败，请重试</div>
            `;
        }
    },

    // 确认删除股票
    confirmDeleteStock: function(poolId, itemId, stockCode) {
        if (confirm(`确定要从股票池中删除 ${stockCode} 吗？`)) {
            this.deleteStock(poolId, itemId);
        }
    },

    // 删除股票
    deleteStock: async function(poolId, itemId) {
        try {
            const response = await fetch(`/api/stock-pool/pools/${poolId}/stocks/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (data.success) {
                showNotification(data.message || '删除股票成功', 'success');
                await this.viewPoolDetail(poolId);

                // 刷新自选股列表和行情（因为可能已被删除）
                console.log('🔄 股票已从股票池删除，刷新自选股...');
                if (typeof loadWatchlist === 'function') {
                    loadWatchlist();
                }
                if (typeof loadWatchlistQuotes === 'function') {
                    loadWatchlistQuotes();
                }
                if (typeof loadOverviewWatchlistQuotes === 'function') {
                    loadOverviewWatchlistQuotes();
                }
            } else {
                showNotification(data.error || '删除失败', 'error');
            }

        } catch (error) {
            console.error('❌ 删除股票失败:', error);
            showNotification('删除股票失败', 'error');
        }
    },

};

// 工具函数：转义HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// 工具函数：格式化日期时间
function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}
