// ==================== 三日选股法管理模块 ====================

const ThreeDaySelectionManager = {
    currentConfig: null,
    configs: [],
    results: [],
    stats: [],
    isScanning: false,
    isLoading: true,

    // 初始化模块
    init: async function() {
        console.log('🎯 初始化三日选股法模块');

        // 先立即渲染界面
        this.isLoading = true;
        this.renderConfigsTab();

        // 然后异步加载数据
        this.loadConfigs();
        this.loadStats();
    },

    // ==================== 配置管理 ====================

    // 加载所有配置
    loadConfigs: async function() {
        try {
            const response = await fetch('/api/three-day-selection/configs', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.configs = data.data;
                this.isLoading = false;
                this.renderConfigsTab();
                console.log('✅ 配置加载成功，共', this.configs.length, '个');
            } else {
                this.isLoading = false;
                this.renderConfigsTab();
                showNotification('加载配置失败', 'error');
            }
        } catch (error) {
            console.error('❌ 加载配置失败:', error);
            this.isLoading = false;
            this.renderConfigsTab();
            showNotification('加载配置失败', 'error');
        }
    },

    // 渲染配置标签页
    renderConfigsTab: function() {
        const container = document.getElementById('threeDaySelectionContent');
        if (!container) return;

        let html = `
            <div class="three-day-selection-container">
                <div class="config-header">
                    <h3>📋 选股策略配置</h3>
                    <button class="btn btn-primary" onclick="ThreeDaySelectionManager.openCreateConfigModal()">
                        ➕ 新建配置
                    </button>
                </div>

                <div class="config-list">
        `;

        if (this.isLoading) {
            html += `
                    <div class="empty-state">
                        <div class="empty-icon">⏳</div>
                        <div class="empty-text">正在加载配置...</div>
                    </div>
            `;
        } else if (this.configs.length === 0) {
            html += `
                    <div class="empty-state">
                        <div class="empty-icon">📊</div>
                        <div class="empty-text">暂无配置</div>
                        <div class="empty-hint">点击"新建配置"创建您的选股策略</div>
                    </div>
            `;
        } else {
            this.configs.forEach(config => {
                html += `
                    <div class="config-card ${config.is_active ? 'active' : ''}">
                        <div class="config-card-header">
                            <h4>${escapeHtml(config.config_name)}</h4>
                            <div class="config-card-actions">
                                <button class="btn btn-sm btn-success"
                                        onclick="ThreeDaySelectionManager.openScanModal(${config.id})"
                                        title="执行扫描">
                                    🔍 扫描
                                </button>
                                <button class="btn btn-sm btn-primary"
                                        onclick="ThreeDaySelectionManager.viewResults(${config.id})"
                                        title="查看结果">
                                    📊 结果
                                </button>
                                <button class="btn btn-sm"
                                        onclick="ThreeDaySelectionManager.editConfig(${config.id})"
                                        title="编辑">
                                    ✏️
                                </button>
                                <button class="btn btn-sm btn-danger"
                                        onclick="ThreeDaySelectionManager.deleteConfig(${config.id})"
                                        title="删除">
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div class="config-card-body">
                            <div class="config-params">
                                <div class="config-param">
                                    <span class="param-label">价格区间:</span>
                                    <span class="param-value">¥${config.min_price} - ¥${config.max_price}</span>
                                </div>
                                <div class="config-param">
                                    <span class="param-label">单日涨幅:</span>
                                    <span class="param-value">${config.min_daily_increase}% - ${config.max_daily_increase}%</span>
                                </div>
                                <div class="config-param">
                                    <span class="param-label">量比:</span>
                                    <span class="param-value">${config.min_volume_ratio} - ${config.max_volume_ratio}</span>
                                </div>
                                <div class="config-param">
                                    <span class="param-label">MA5:</span>
                                    <span class="param-value">${config.require_above_ma5 ? '✓ 需要' : '✗ 不需要'}</span>
                                </div>
                                <div class="config-param">
                                    <span class="param-label">RSI:</span>
                                    <span class="param-value">${config.rsi_min} - ${config.rsi_max}</span>
                                </div>
                                <div class="config-param">
                                    <span class="param-label">排除ST:</span>
                                    <span class="param-value">${config.exclude_st ? '✓ 是' : '✗ 否'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    // 打开创建配置弹窗
    openCreateConfigModal: function() {
        const modal = document.getElementById('configModal');
        if (!modal) {
            this.createConfigModal();
        }

        // 重置表单
        document.getElementById('configForm').reset();
        document.getElementById('configModalTitle').textContent = '新建选股配置';
        document.getElementById('configId').value = '';

        // 设置默认值
        document.getElementById('minPrice').value = '5.0';
        document.getElementById('maxPrice').value = '100.0';
        document.getElementById('minDailyIncrease').value = '1.0';
        document.getElementById('maxDailyIncrease').value = '5.0';
        document.getElementById('minVolumeRatio').value = '1.2';
        document.getElementById('maxVolumeRatio').value = '2.5';
        document.getElementById('requireAboveMA5').checked = true;
        document.getElementById('rsiMin').value = '35';
        document.getElementById('rsiMax').value = '65';
        document.getElementById('excludeST').checked = true;

        document.getElementById('configModal').style.display = 'flex';
    },

    // 创建配置弹窗DOM
    createConfigModal: function() {
        const modalHtml = `
            <div id="configModal" class="modal">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3 id="configModalTitle">新建选股配置</h3>
                        <span class="close" onclick="ThreeDaySelectionManager.closeConfigModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="configForm">
                            <input type="hidden" id="configId" />

                            <div class="form-group">
                                <label>配置名称 *</label>
                                <input type="text" id="configName" class="form-control" required
                                       placeholder="例如：稳健型选股">
                            </div>

                            <div class="form-section">
                                <h4>💰 价格条件</h4>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>最低价格 (元)</label>
                                        <input type="number" id="minPrice" class="form-control"
                                               min="0" step="0.1" required>
                                    </div>
                                    <div class="form-group">
                                        <label>最高价格 (元)</label>
                                        <input type="number" id="maxPrice" class="form-control"
                                               min="0" step="0.1" required>
                                    </div>
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>📈 涨幅条件</h4>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>最小单日涨幅 (%)</label>
                                        <input type="number" id="minDailyIncrease" class="form-control"
                                               min="0" max="20" step="0.1" required>
                                    </div>
                                    <div class="form-group">
                                        <label>最大单日涨幅 (%)</label>
                                        <input type="number" id="maxDailyIncrease" class="form-control"
                                               min="0" max="20" step="0.1" required>
                                    </div>
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>📊 成交量条件</h4>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>最小量比</label>
                                        <input type="number" id="minVolumeRatio" class="form-control"
                                               min="0" step="0.1" required>
                                    </div>
                                    <div class="form-group">
                                        <label>最大量比</label>
                                        <input type="number" id="maxVolumeRatio" class="form-control"
                                               min="0" step="0.1" required>
                                    </div>
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>📉 技术指标</h4>
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="requireAboveMA5">
                                        要求站上5日均线
                                    </label>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>RSI最小值</label>
                                        <input type="number" id="rsiMin" class="form-control"
                                               min="0" max="100" step="1" required>
                                    </div>
                                    <div class="form-group">
                                        <label>RSI最大值</label>
                                        <input type="number" id="rsiMax" class="form-control"
                                               min="0" max="100" step="1" required>
                                    </div>
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>🏢 其他条件</h4>
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="excludeST">
                                        排除ST股票
                                    </label>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="ThreeDaySelectionManager.closeConfigModal()">
                            取消
                        </button>
                        <button class="btn btn-primary" onclick="ThreeDaySelectionManager.saveConfig()">
                            保存
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // 关闭配置弹窗
    closeConfigModal: function() {
        document.getElementById('configModal').style.display = 'none';
    },

    // 保存配置
    saveConfig: async function() {
        const configId = document.getElementById('configId').value;
        const configData = {
            config_name: document.getElementById('configName').value,
            min_price: parseFloat(document.getElementById('minPrice').value),
            max_price: parseFloat(document.getElementById('maxPrice').value),
            min_daily_increase: parseFloat(document.getElementById('minDailyIncrease').value),
            max_daily_increase: parseFloat(document.getElementById('maxDailyIncrease').value),
            volume_increase_required: 1,
            min_volume_ratio: parseFloat(document.getElementById('minVolumeRatio').value),
            max_volume_ratio: parseFloat(document.getElementById('maxVolumeRatio').value),
            require_macd_golden: 0,
            require_above_ma5: document.getElementById('requireAboveMA5').checked ? 1 : 0,
            rsi_min: parseInt(document.getElementById('rsiMin').value),
            rsi_max: parseInt(document.getElementById('rsiMax').value),
            min_market_cap: 10,
            max_market_cap: 1000,
            exclude_st: document.getElementById('excludeST').checked ? 1 : 0
        };

        try {
            const url = configId
                ? `/api/three-day-selection/configs/${configId}`
                : '/api/three-day-selection/configs';

            const method = configId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(configData)
            });

            const data = await response.json();

            if (data.success) {
                showNotification(configId ? '配置更新成功' : '配置创建成功', 'success');
                this.closeConfigModal();
                await this.loadConfigs();
            } else {
                showNotification(data.message || '保存失败', 'error');
            }
        } catch (error) {
            console.error('❌ 保存配置失败:', error);
            showNotification('保存配置失败', 'error');
        }
    },

    // 编辑配置
    editConfig: async function(configId) {
        try {
            const response = await fetch(`/api/three-day-selection/configs/${configId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (data.success) {
                const config = data.data;

                if (!document.getElementById('configModal')) {
                    this.createConfigModal();
                }

                document.getElementById('configModalTitle').textContent = '编辑选股配置';
                document.getElementById('configId').value = config.id;
                document.getElementById('configName').value = config.config_name;
                document.getElementById('minPrice').value = config.min_price;
                document.getElementById('maxPrice').value = config.max_price;
                document.getElementById('minDailyIncrease').value = config.min_daily_increase;
                document.getElementById('maxDailyIncrease').value = config.max_daily_increase;
                document.getElementById('minVolumeRatio').value = config.min_volume_ratio;
                document.getElementById('maxVolumeRatio').value = config.max_volume_ratio;
                document.getElementById('requireAboveMA5').checked = config.require_above_ma5 === 1;
                document.getElementById('rsiMin').value = config.rsi_min;
                document.getElementById('rsiMax').value = config.rsi_max;
                document.getElementById('excludeST').checked = config.exclude_st === 1;

                document.getElementById('configModal').style.display = 'flex';
            }
        } catch (error) {
            console.error('❌ 加载配置失败:', error);
            showNotification('加载配置失败', 'error');
        }
    },

    // 删除配置
    deleteConfig: async function(configId) {
        if (!confirm('确定要删除这个配置吗？')) {
            return;
        }

        try {
            const response = await fetch(`/api/three-day-selection/configs/${configId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (data.success) {
                showNotification('配置删除成功', 'success');
                await this.loadConfigs();
            } else {
                showNotification(data.message || '删除失败', 'error');
            }
        } catch (error) {
            console.error('❌ 删除配置失败:', error);
            showNotification('删除配置失败', 'error');
        }
    },

    // ==================== 扫描功能 ====================

    // 打开扫描弹窗
    openScanModal: async function(configId) {
        console.log('🔍 打开扫描弹窗, configId:', configId);
        this.currentConfig = this.configs.find(c => c.id === configId);

        if (!document.getElementById('scanModal')) {
            console.log('📦 创建扫描弹窗DOM');
            this.createScanModal();
        }

        document.getElementById('scanConfigName').textContent = this.currentConfig.config_name;

        // 加载全部股票列表
        await this.loadAllStocksForScan();

        document.getElementById('scanModal').style.display = 'flex';
        console.log('✅ 扫描弹窗已打开');
    },

    // 加载全部股票列表用于扫描
    loadAllStocksForScan: async function() {
        try {
            document.getElementById('scanStockCount').textContent = '加载中...';
            document.getElementById('loadStocksBtn').disabled = true;
            document.getElementById('loadStocksBtn').textContent = '⏳ 加载中...';

            const response = await fetch('/api/three-day-selection/all-stocks', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (data.success && data.data && data.data.length > 0) {
                this.allStocks = data.data;
                document.getElementById('scanStockCount').textContent = data.data.length;
                document.getElementById('loadStocksBtn').textContent = '✅ 已加载 ' + data.data.length + ' 只';
                console.log(`✅ 已加载 ${data.data.length} 只股票`);
            } else {
                this.allStocks = [];
                document.getElementById('scanStockCount').textContent = '0';
                document.getElementById('loadStocksBtn').textContent = '❌ 加载失败';
                showNotification('获取股票列表失败', 'error');
            }
        } catch (error) {
            console.error('❌ 加载股票列表失败:', error);
            this.allStocks = [];
            document.getElementById('scanStockCount').textContent = '0';
            document.getElementById('loadStocksBtn').textContent = '❌ 加载失败';
            showNotification('加载股票列表失败', 'error');
        }
    },

    // 创建扫描弹窗DOM
    createScanModal: function() {
        const modalHtml = `
            <div id="scanModal" class="modal">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3>🔍 执行选股扫描</h3>
                        <span class="close" onclick="ThreeDaySelectionManager.closeScanModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="scan-info">
                            <p>配置: <strong id="scanConfigName"></strong></p>
                            <p>扫描范围: <strong>全部A股 (<span id="scanStockCount">0</span> 只)</strong></p>
                            <p>
                                <button id="loadStocksBtn" class="btn btn-sm btn-secondary" onclick="ThreeDaySelectionManager.loadAllStocksForScan()">
                                    🔄 重新加载股票列表
                                </button>
                            </p>
                        </div>
                        <div id="scanProgress" class="scan-progress" style="display: none;">
                            <div class="scan-info" style="margin-bottom: 15px;">
                                <p><strong>扫描进度:</strong></p>
                                <p style="font-size: 16px; color: #4CAF50;">
                                    正在扫描: <span id="currentStockCode" style="font-weight: bold;">-</span>
                                    <span id="currentStockName" style="font-weight: bold;">-</span>
                                </p>
                                <p>
                                    已扫描: <span id="scannedCount">0</span> / <span id="totalCount">0</span>
                                    (<span id="scanPercent">0</span>%)
                                </p>
                                <p>
                                    已发现: <span id="foundCount" style="color: #4CAF50; font-weight: bold;">0</span> 只符合条件的股票
                                </p>
                            </div>
                            <div class="progress-bar">
                                <div id="scanProgressBar" class="progress-fill" style="width: 0%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="closeScanBtn" class="btn btn-secondary" onclick="ThreeDaySelectionManager.closeScanModal()">
                            取消
                        </button>
                        <button id="startScanBtn" class="btn btn-primary" onclick="ThreeDaySelectionManager.startScan()">
                            🚀 开始扫描
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // 关闭扫描弹窗
    closeScanModal: function() {
        if (!this.isScanning) {
            document.getElementById('scanModal').style.display = 'none';
        }
    },

    // 开始扫描
    startScan: async function() {
        console.log('🎯 开始扫描函数被调用');

        if (!this.allStocks || this.allStocks.length === 0) {
            showNotification('请先加载股票列表', 'warning');
            return;
        }

        const stockList = this.allStocks.map(stock => ({
            stockCode: stock.code,
            stockName: stock.name
        }));

        console.log(`📝 准备扫描 ${stockList.length} 只股票`);

        this.isScanning = true;
        document.getElementById('scanProgress').style.display = 'block';
        document.getElementById('startScanBtn').disabled = true;
        document.getElementById('closeScanBtn').disabled = true;

        // 更新总数
        document.getElementById('totalCount').textContent = stockList.length;
        document.getElementById('scannedCount').textContent = '0';
        document.getElementById('scanPercent').textContent = '0';
        document.getElementById('foundCount').textContent = '0';
        document.getElementById('scanProgressBar').style.width = '0%';

        try {
            const response = await fetch('/api/three-day-selection/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    configId: this.currentConfig.id,
                    stockList: stockList
                })
            });

            const data = await response.json();

            if (data.success) {
                showNotification(`扫描完成！选中 ${data.data.totalSelected} 只股票`, 'success');
                document.getElementById('scanModal').style.display = 'none';
                this.viewResults(this.currentConfig.id);
            } else {
                showNotification(data.message || '扫描失败', 'error');
            }
        } catch (error) {
            console.error('❌ 扫描失败:', error);
            showNotification('扫描失败: ' + error.message, 'error');
        } finally {
            this.isScanning = false;
            document.getElementById('scanProgress').style.display = 'none';
            document.getElementById('startScanBtn').disabled = false;
            document.getElementById('closeScanBtn').disabled = false;
        }
    },

    // ==================== 结果查看 ====================

    // 查看结果
    viewResults: async function(configId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`/api/three-day-selection/results?configId=${configId}&date=${today}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.results = data.data.results;
                this.renderResults();
            } else {
                showNotification('加载结果失败', 'error');
            }
        } catch (error) {
            console.error('❌ 加载结果失败:', error);
            showNotification('加载结果失败', 'error');
        }
    },

    // 渲染结果列表
    renderResults: function() {
        const container = document.getElementById('threeDaySelectionContent');
        if (!container) return;

        let html = `
            <div class="three-day-results-container">
                <div class="results-header">
                    <h3>📊 选股结果</h3>
                    <button class="btn btn-secondary" onclick="ThreeDaySelectionManager.init()">
                        ← 返回配置列表
                    </button>
                </div>

                <div class="results-summary">
                    <div class="summary-card">
                        <div class="summary-value">${this.results.length}</div>
                        <div class="summary-label">选中股票</div>
                    </div>
                </div>

                <div class="results-list">
        `;

        if (this.results.length === 0) {
            html += `
                    <div class="empty-state">
                        <div class="empty-icon">📊</div>
                        <div class="empty-text">暂无结果</div>
                        <div class="empty-hint">请先执行扫描</div>
                    </div>
            `;
        } else {
            // 按评分排序
            this.results.sort((a, b) => b.score - a.score);

            this.results.forEach(result => {
                const confidenceColor = {
                    'high': '#4CAF50',
                    'medium': '#FF9800',
                    'low': '#F44336'
                }[result.confidence_level] || '#999';

                html += `
                    <div class="result-card">
                        <div class="result-header">
                            <div class="result-title">
                                <h4>${escapeHtml(result.stock_name)} (${result.stock_code})</h4>
                                <span class="result-score" style="background-color: ${confidenceColor}">
                                    ${result.score.toFixed(1)}分
                                </span>
                            </div>
                            <div class="result-actions">
                                <button class="btn btn-sm btn-primary"
                                        onclick="openStockDetailModal('${result.stock_code}', '${escapeHtml(result.stock_name)}')">
                                    查看详情
                                </button>
                            </div>
                        </div>
                        <div class="result-body">
                            <div class="result-metrics">
                                <div class="metric">
                                    <span class="metric-label">当前价:</span>
                                    <span class="metric-value">¥${result.current_price.toFixed(2)}</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">三日涨幅:</span>
                                    <span class="metric-value ${result.three_day_increase >= 0 ? 'text-success' : 'text-danger'}">
                                        ${result.three_day_increase.toFixed(2)}%
                                    </span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">量比:</span>
                                    <span class="metric-value">${result.volume_ratio.toFixed(2)}</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">信心等级:</span>
                                    <span class="metric-value">${this.getConfidenceText(result.confidence_level)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    // 获取信心等级文本
    getConfidenceText: function(level) {
        const texts = {
            'high': '⭐⭐⭐ 高',
            'medium': '⭐⭐ 中',
            'low': '⭐ 低'
        };
        return texts[level] || level;
    },

    // ==================== 统计数据 ====================

    // 加载统计数据
    loadStats: async function() {
        try {
            const response = await fetch('/api/three-day-selection/stats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.stats = data.data;
                console.log('✅ 统计数据加载成功');
            }
        } catch (error) {
            console.error('❌ 加载统计数据失败:', error);
        }
    }
};

// 辅助函数：HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
