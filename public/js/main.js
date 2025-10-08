// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuth();
    updateTime();
    setInterval(updateTime, 1000);

    // 初始化Excel上传功能
    initExcelUpload();

    // 初始化页签功能
    initTabs();

    // 页面加载完成后，延迟加载用户持仓数据和自选股行情
    setTimeout(() => {
        loadUserPositions();
        loadOverviewWatchlistQuotes();
        loadMarketIndices();
        loadPortfolioStats();
        loadChangeDistribution();
        loadSystemStats();
    }, 500);

    // 定期更新自选股行情（每30秒）
    setInterval(() => {
        loadOverviewWatchlistQuotes();
        loadMarketIndices();
        loadChangeDistribution();
    }, 30000);
});

// 打开Excel上传模态框
function openExcelUploadModal() {
    const modal = document.getElementById('excelUploadModal');
    modal.style.display = 'block';
    
    // 清空上传状态
    clearUploadStatus();
    
    // 重新绑定拖拽事件（确保模态框显示后事件绑定正确）
    initExcelUpload();
}

// 关闭Excel上传模态框
function closeExcelUploadModal() {
    const modal = document.getElementById('excelUploadModal');
    modal.style.display = 'none';
    
    // 清空上传状态
    clearUploadStatus();
}

// 清空上传状态
function clearUploadStatus() {
    const uploadStatus = document.getElementById('uploadStatus');
    uploadStatus.textContent = '';
    uploadStatus.className = 'upload-status';
    
    // 清空文件输入
    const fileInput = document.getElementById('excelFileInput');
    fileInput.value = '';
}

// 初始化Excel上传功能
function initExcelUpload() {
    const uploadArea = document.getElementById('excelUploadArea');
    const fileInput = document.getElementById('excelFileInput');
    
    if (!uploadArea || !fileInput) return;
    
    // 拖拽事件处理
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleExcelFile(files[0]);
        }
    });
    
    // 文件选择事件
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleExcelFile(e.target.files[0]);
        }
    });
}

// 处理Excel文件上传
async function handleExcelFile(file) {
    if (!file) return;
    
    // 检查文件类型
    const validTypes = ['.xls', '.xlsx'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(fileExtension)) {
        showUploadStatus('请上传.xls或.xlsx格式的Excel文件', 'error');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        showUploadStatus('请先登录系统', 'error');
        return;
    }
    
    try {
        showUploadStatus('正在上传文件...', 'info');
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload/positions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showUploadStatus('文件上传成功！正在解析持仓数据...', 'success');

            // 延迟后显示持仓数据
            setTimeout(async () => {
                displayUploadedPositions(data.data.positions, data.data.summary);
                showUploadStatus('数据解析完成！正在添加到自选股...', 'success');

                // 自动将持仓股票添加到自选股
                await addPositionsToWatchlist(data.data.positions);

                // 上传成功后关闭模态框
                setTimeout(() => {
                    closeExcelUploadModal();
                    showNotification('持仓数据已导入并添加到自选股', 'success');
                }, 500);
            }, 1000);

        } else {
            showUploadStatus(data.error || '文件上传失败', 'error');
        }
        
    } catch (error) {
        console.error('Excel文件上传错误:', error);
        showUploadStatus('网络连接失败，请检查网络后重试', 'error');
    }
}

// 显示上传状态
function showUploadStatus(message, type) {
    const statusDiv = document.getElementById('uploadStatus');
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    statusDiv.className = `upload-status ${type}`;
    statusDiv.style.display = 'block';
}

// 清空上传的数据
async function clearUploadedData() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        // 未登录状态，只清空本地显示
        document.getElementById('uploadedTotalValue').textContent = '¥0.00';
        document.getElementById('uploadedProfitLoss').textContent = '总盈亏: ¥0.00 (0.00%)';
        document.getElementById('uploadedPositions').innerHTML = 
            '<div class="loading-text">请上传Excel文件查看持仓数据</div>';
        
        const statusDiv = document.getElementById('uploadStatus');
        if (statusDiv) {
            statusDiv.style.display = 'none';
            statusDiv.textContent = '';
        }
        
        const fileInput = document.getElementById('excelFileInput');
        if (fileInput) fileInput.value = '';
        
        // 移除更新时间信息
        const updateInfo = document.getElementById('positionUpdateInfo');
        if (updateInfo) {
            updateInfo.remove();
        }
        
        return;
    }
    
    // 确认清空操作
    if (!confirm('确定要清空所有持仓数据吗？此操作不可恢复。')) {
        return;
    }
    
    try {
        const response = await fetch('/api/positions', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                // 清空本地显示
                document.getElementById('uploadedTotalValue').textContent = '¥0.00';
                document.getElementById('uploadedProfitLoss').textContent = '总盈亏: ¥0.00 (0.00%)';
                document.getElementById('uploadedPositions').innerHTML = 
                    '<div class="loading-text">请上传Excel文件查看持仓数据</div>';
                
                const statusDiv = document.getElementById('uploadStatus');
                if (statusDiv) {
                    statusDiv.style.display = 'none';
                    statusDiv.textContent = '';
                }
                
                const fileInput = document.getElementById('excelFileInput');
                if (fileInput) fileInput.value = '';
                
                // 移除更新时间信息
                const updateInfo = document.getElementById('positionUpdateInfo');
                if (updateInfo) {
                    updateInfo.remove();
                }
                
                showNotification('持仓数据已清空', 'success');
                console.log(`✅ 持仓数据已清空，删除了 ${result.deletedCount} 条记录`);
            } else {
                showNotification('清空数据失败：' + (result.error || '未知错误'), 'error');
            }
        } else {
            showNotification('清空数据失败，请重试', 'error');
        }
    } catch (error) {
        console.error('清空持仓数据错误:', error);
        showNotification('清空数据失败，网络连接错误', 'error');
    }
}

// 检查认证状态
async function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                updateNavbar(userData);
                return;
            }
        } catch (error) {
            console.error('认证检查失败:', error);
        }
    }
    
    // 未登录状态
    updateNavbar(null);
}

// 显示上传的持仓数据
function displayUploadedPositions(positions, summary = null) {
    const container = document.getElementById('uploadedPositions');
    const totalValueEl = document.getElementById('uploadedTotalValue');
    const profitLossEl = document.getElementById('uploadedProfitLoss');
    
    if (!container || !totalValueEl || !profitLossEl) return;
    
    if (!positions || positions.length === 0) {
        container.innerHTML = '<div class="loading-text">未找到持仓数据</div>';
        totalValueEl.textContent = '¥0.00';
        profitLossEl.textContent = '总盈亏: ¥0.00 (0.00%)';
        
        // 移除更新时间信息
        const updateInfo = document.getElementById('positionUpdateInfo');
        if (updateInfo) {
            updateInfo.remove();
        }
        
        return;
    }
    
    // 如果提供了汇总信息，直接使用，否则重新计算
    let totalMarketValue, totalProfitLoss, totalCost, profitLossRate;
    if (summary) {
        totalMarketValue = summary.totalMarketValue;
        totalProfitLoss = summary.totalProfitLoss;
        totalCost = summary.totalCost || 0;
        profitLossRate = summary.totalProfitLossRate;
        
        // 显示更新时间信息
        if (summary.lastUpdate) {
            const updateTime = new Date(summary.lastUpdate).toLocaleString('zh-CN');
            
            // 创建或更新状态显示元素
            let statusDiv = document.getElementById('positionUpdateInfo');
            if (!statusDiv) {
                statusDiv = document.createElement('div');
                statusDiv.id = 'positionUpdateInfo';
                statusDiv.className = 'position-update-info';
                const positionsContainer = document.getElementById('uploadedPositions');
                if (positionsContainer) {
                    positionsContainer.parentNode.insertBefore(statusDiv, positionsContainer);
                }
            }
            
            statusDiv.innerHTML = `
                <div class="update-info">
                    <span class="update-label">数据更新时间:</span>
                    <span class="update-time">${updateTime}</span>
                </div>
            `;
        }
    } else {
        // 计算总市值和总盈亏
        totalMarketValue = 0;
        totalProfitLoss = 0;
        totalCost = 0;
        
        positions.forEach(position => {
            totalMarketValue += parseFloat(position.marketValue) || 0;
            totalProfitLoss += parseFloat(position.profitLoss) || 0;
            totalCost += parseFloat(position.costPrice) || 0;
        });
        
        profitLossRate = totalCost > 0 ? (totalProfitLoss / totalCost * 100).toFixed(2) : '0.00';
        
        // 移除更新时间信息
        const updateInfo = document.getElementById('positionUpdateInfo');
        if (updateInfo) {
            updateInfo.remove();
        }
    }
    
    // 更新总市值和盈亏显示
    totalValueEl.textContent = `¥${totalMarketValue.toFixed(2)}`;
    profitLossEl.textContent = `总盈亏: ¥${totalProfitLoss.toFixed(2)} (${profitLossRate}%)`;
    
    // 生成持仓列表HTML
    let html = '<div class="positions-list">';
    
    positions.forEach(position => {
        const profitLoss = parseFloat(position.profitLoss) || 0;
        const profitLossRate = parseFloat(position.profitLossRate) || 0;
        const isProfit = profitLoss >= 0;
        const profitIcon = isProfit ? '📈' : '📉';
        
        html += `
            <div class="position-card">
                <div class="position-header">
                    <div class="stock-info">
                        <div class="stock-symbol">${position.stockCode}</div>
                        <div class="stock-name">${position.stockName}</div>
                    </div>
                    <div class="profit-indicator ${isProfit ? 'profit' : 'loss'}">
                        ${profitIcon}
                    </div>
                </div>
                
                <div class="position-stats">
                    <div class="stat-row">
                        <div class="stat-item">
                            <span class="stat-label">持仓数量</span>
                            <span class="stat-value">${position.quantity}股</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">成本价</span>
                            <span class="stat-value">¥${parseFloat(position.costPrice).toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div class="stat-row">
                        <div class="stat-item">
                            <span class="stat-label">当前价</span>
                            <span class="stat-value">¥${parseFloat(position.currentPrice).toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">市值</span>
                            <span class="stat-value">¥${parseFloat(position.marketValue).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="position-summary">
                    <div class="profit-loss ${isProfit ? 'profit' : 'loss'}">
                        <span class="profit-amount">${isProfit ? '+' : ''}¥${profitLoss.toFixed(2)}</span>
                        <span class="profit-rate">${isProfit ? '+' : ''}${profitLossRate.toFixed(2)}%</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// 加载用户持仓数据
async function loadUserPositions() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('用户未登录，跳过加载持仓数据');
        return;
    }
    
    try {
        const response = await fetch('/api/positions', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data.positions.length > 0) {
                // 显示持仓数据
                displayUploadedPositions(result.data.positions, result.data.summary);
                
                // 显示更新时间信息
                if (result.data.summary.lastUpdate) {
                    const updateTime = new Date(result.data.summary.lastUpdate).toLocaleString('zh-CN');
                    
                    // 创建或更新状态显示元素
                    let statusDiv = document.getElementById('positionUpdateInfo');
                    if (!statusDiv) {
                        statusDiv = document.createElement('div');
                        statusDiv.id = 'positionUpdateInfo';
                        statusDiv.className = 'position-update-info';
                        const positionsContainer = document.getElementById('uploadedPositions');
                        if (positionsContainer) {
                            positionsContainer.parentNode.insertBefore(statusDiv, positionsContainer);
                        }
                    }
                    
                    statusDiv.innerHTML = `
                        <div class="update-info">
                            <span class="update-label">数据更新时间:</span>
                            <span class="update-time">${updateTime}</span>
                        </div>
                    `;
                }
                
                console.log('✅ 用户持仓数据加载成功');
            } else {
                console.log('用户暂无持仓数据');
            }
        } else {
            console.error('获取持仓数据失败:', response.status);
        }
    } catch (error) {
        console.error('加载用户持仓数据错误:', error);
    }
}

// 初始化页签功能
function initTabs() {
    // 为所有页签按钮添加点击事件
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = function() {
            switchTab(this.getAttribute('data-tab'));
        };
    });
}

// 页签切换功能
function switchTab(tabName) {
    // 移除所有按钮的active类
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 移除所有内容的active类
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 激活选中的按钮
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');

    // 显示选中的内容
    const content = document.getElementById(tabName + '-tab');
    if (content) {
        content.classList.add('active');

        // 加载页签数据
        loadTabData(tabName);
    }
}

// 加载页签数据
function loadTabData(tabName) {
    switch (tabName) {
        case 'overview':
            // 总览页签已经默认加载
            break;
        case 'market':
            loadMarketData();
            break;
        case 'analysis':
            loadAnalysisData();
            break;
    }
}

// 加载股市信息数据
function loadMarketData() {
    // 加载新模块
    loadTradeTimeReminder();
    loadMarketOverview();
    loadTopGainersLosers();

    // 加载自选股列表
    loadWatchlist();

    // 加载自选股行情
    loadWatchlistQuotes();

    // 初始化新闻类别切换
    initNewsCategories();

    // 加载热点新闻（默认最新热点）
    loadHotNews('latest');
}

// 加载分析数据
function loadAnalysisData() {
    // 检查是否有持仓数据
    const positions = document.querySelectorAll('.position-card');
    if (positions.length === 0) {
        document.getElementById('analysisCharts').innerHTML = 
            '<div class="loading-text">暂无持仓数据，请先上传Excel文件</div>';
        document.getElementById('analysisStats').innerHTML = 
            '<div class="loading-text">暂无分析数据</div>';
        document.getElementById('industryDistribution').innerHTML = 
            '<div class="loading-text">暂无行业分布数据</div>';
        document.getElementById('riskAssessment').innerHTML = 
            '<div class="loading-text">暂无风险评估数据</div>';
        return;
    }
    
    // 显示分析占位符
    document.getElementById('analysisCharts').innerHTML = 
        '<div class="loading-text">图表分析功能开发中...</div>';
    document.getElementById('analysisStats').innerHTML = 
        '<div class="loading-text">统计数据功能开发中...</div>';
    document.getElementById('industryDistribution').innerHTML = 
        '<div class="loading-text">行业分布分析开发中...</div>';
    document.getElementById('riskAssessment').innerHTML = 
        '<div class="loading-text">风险评估功能开发中...</div>';
}

// 加载自选股列表
async function loadWatchlist() {
    const container = document.getElementById('watchlistContainer');
    
    if (!container) return;
    
    try {
        // 显示加载状态
        container.innerHTML = '<div class="loading-text">正在加载自选股...</div>';
        
        const response = await fetch('/api/watchlist', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('获取自选股列表失败');
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || '获取自选股列表失败');
        }
        
        const watchlist = result.data || [];
        
        if (watchlist.length === 0) {
            container.innerHTML = '<div class="loading-text">暂无自选股，请添加股票代码</div>';
            return;
        }
        
        let html = '';
        watchlist.forEach(stock => {
            html += `
                <div class="watchlist-item">
                    <div class="stock-info">
                        <span class="stock-code">${stock.stock_code}</span>
                        <span class="stock-name">${stock.stock_name || '未知股票'}</span>
                    </div>
                    <button class="remove-btn" onclick="removeFromWatchlist('${stock.stock_code}')">删除</button>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('加载自选股列表错误:', error);
        container.innerHTML = '<div class="error-text">加载自选股失败，请刷新重试</div>';
    }
}

// 添加自选股
async function addToWatchlist() {
    const input = document.getElementById('stockCodeInput');
    const code = input.value.trim();
    
    if (!code) {
        alert('请输入股票代码');
        return;
    }
    
    // 简单的股票代码验证
    if (!/^[0-9]{6}$/.test(code)) {
        alert('请输入正确的6位股票代码');
        return;
    }
    
    try {
        const response = await fetch('/api/watchlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                stockCode: code,
                stockName: '' // 后续可以通过API获取股票名称
            })
        });
        
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || '添加自选股失败');
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || '添加自选股失败');
        }
        
        // 清空输入框
        input.value = '';
        
        // 刷新自选股列表
        await loadWatchlist();
        
        // 刷新自选股行情
        loadWatchlistQuotes();
        
        alert('添加成功！');
        
    } catch (error) {
        console.error('添加自选股错误:', error);
        alert(error.message || '添加自选股失败');
    }
}

// 批量添加持仓股票到自选股
async function addPositionsToWatchlist(positions) {
    console.log('🔄 开始批量添加自选股，持仓数量:', positions?.length);

    if (!positions || positions.length === 0) {
        console.log('❌ 没有持仓数据，跳过添加自选股');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        console.log('⚠️ 用户未登录，跳过添加自选股');
        showNotification('请先登录后再导入数据以自动添加自选股', 'info');
        return;
    }

    try {
        // 构造批量添加的数据
        const stocks = positions.map(position => ({
            stockCode: position.stockCode,
            stockName: position.stockName
        }));

        console.log('📤 发送批量添加请求，股票数量:', stocks.length);
        console.log('📝 股票列表:', stocks);

        // 使用批量添加API
        const response = await fetch('/api/watchlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ stocks })
        });

        console.log('📥 收到响应，状态:', response.status);

        const result = await response.json();
        console.log('📊 服务器响应:', result);

        if (!response.ok) {
            console.error('❌ 请求失败:', response.status, response.statusText);
            console.error('❌ 错误详情:', result);
            throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        if (result.success) {
            const { successCount, skipCount, errorCount } = result.data;
            console.log(`✅ 自选股添加完成: 成功 ${successCount} 个, 跳过 ${skipCount} 个, 失败 ${errorCount} 个`);

            // 如果有成功添加的，刷新自选股列表
            if (successCount > 0) {
                console.log('🔄 刷新自选股列表...');
                setTimeout(() => {
                    loadWatchlist();
                    loadWatchlistQuotes();
                }, 500);
            }

            // 显示通知
            if (successCount > 0 || skipCount > 0) {
                showNotification(`已添加 ${successCount} 支股票到自选股 (跳过 ${skipCount} 支已存在)`, 'success');
            }
        } else {
            console.error('❌ 批量添加自选股失败:', result.error);
            showNotification('添加自选股失败: ' + result.error, 'error');
        }

    } catch (error) {
        console.error('❌ 批量添加自选股错误:', error);
        showNotification('添加自选股时发生错误: ' + error.message, 'error');
    }
}

// 从自选股删除
async function removeFromWatchlist(code) {
    if (!confirm('确定要删除这只自选股吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/watchlist/${code}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || '删除自选股失败');
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || '删除自选股失败');
        }
        
        // 刷新自选股列表
        await loadWatchlist();
        
        // 刷新自选股行情
        loadWatchlistQuotes();
        
        alert('删除成功！');
        
    } catch (error) {
        console.error('删除自选股错误:', error);
        alert(error.message || '删除自选股失败');
    }
}

// 加载自选股行情
async function loadWatchlistQuotes() {
    const container = document.getElementById('watchlistQuotes');
    
    if (!container) return;
    
    try {
        // 显示加载状态
        container.innerHTML = '<div class="loading-text">正在获取行情数据...</div>';
        
        // 获取自选股列表
        const response = await fetch('/api/watchlist', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('获取自选股列表失败');
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || '获取自选股列表失败');
        }
        
        const watchlist = result.data || [];

        if (watchlist.length === 0) {
            container.innerHTML = '<div class="loading-text">暂无自选股行情数据</div>';
            return;
        }

        // 提取股票代码列表
        const stockCodes = watchlist.map(stock => stock.stock_code);

        // 批量获取真实行情数据
        const quotesResponse = await fetch('/api/stock/quotes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ stockCodes })
        });

        if (!quotesResponse.ok) {
            throw new Error('获取行情数据失败');
        }

        const quotesResult = await quotesResponse.json();

        if (!quotesResult.success) {
            throw new Error(quotesResult.error || '获取行情数据失败');
        }

        const quotes = quotesResult.data || [];

        // 渲染行情数据
        let html = '';
        quotes.forEach((quote, index) => {
            const isPositive = parseFloat(quote.changePercent) >= 0;
            const chartId = `chart-${quote.stockCode}-${index}`;

            html += `
                <div class="quote-item">
                    <div class="quote-header">
                        <div class="quote-info">
                            <span class="quote-symbol">${quote.stockName || '未知股票'} (${quote.stockCode})</span>
                        </div>
                        <div class="quote-stats">
                            <div class="quote-price">¥${quote.currentPrice.toFixed(2)}</div>
                            <div class="quote-change ${isPositive ? 'positive' : 'negative'}">
                                ${isPositive ? '+' : ''}${quote.changePercent}%
                            </div>
                        </div>
                    </div>
                    <div class="chart-period-selector">
                        <button class="period-btn active" data-period="day" data-chart="${chartId}" data-stock="${quote.stockCode}">日线</button>
                        <button class="period-btn" data-period="week" data-chart="${chartId}" data-stock="${quote.stockCode}">周线</button>
                        <button class="period-btn" data-period="month" data-chart="${chartId}" data-stock="${quote.stockCode}">月线</button>
                    </div>
                    <div class="quote-chart-container">
                        <canvas id="${chartId}" class="quote-chart"></canvas>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // 渲染图表（使用真实历史数据）
        quotes.forEach((quote, index) => {
            const chartId = `chart-${quote.stockCode}-${index}`;
            renderStockChart(chartId, quote.stockCode, 'day');
        });

        // 绑定周期切换按钮事件
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const period = this.getAttribute('data-period');
                const chartId = this.getAttribute('data-chart');
                const stockCode = this.getAttribute('data-stock');

                // 更新按钮状态
                const parentSelector = this.parentElement;
                parentSelector.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                // 重新渲染图表
                renderStockChart(chartId, stockCode, period);
            });
        });

    } catch (error) {
        console.error('加载自选股行情错误:', error);
        container.innerHTML = '<div class="error-text">获取行情数据失败</div>';
    }
}

// 全局变量存储图表实例
const chartInstances = {};

// 渲染股票价格变化图表
async function renderStockChart(canvasId, stockCode, period = 'day') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas元素 ${canvasId} 不存在`);
        return;
    }

    // 销毁已存在的图表实例
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
        delete chartInstances[canvasId];
    }

    try {
        // 根据周期确定天数和显示数量
        let days, displayCount;
        switch(period) {
            case 'day':
                days = 60;      // 获取60个交易日
                displayCount = 30;  // 显示最近30根K线
                break;
            case 'week':
                days = 300;     // 获取300个交易日（约60周）
                displayCount = 24;  // 显示最近24根周K线
                break;
            case 'month':
                days = 300;     // 获取300个交易日（约15个月，确保有12个完整月）
                displayCount = 12;  // 显示最近12根月K线
                break;
            default:
                days = 60;
                displayCount = 30;
        }

        // 获取真实历史数据
        const response = await fetch(`/api/stock/history/${stockCode}?days=${days}`);

        if (!response.ok) {
            throw new Error('获取历史数据失败');
        }

        const result = await response.json();

        if (!result.success || !result.data.history || result.data.history.length === 0) {
            // 如果获取失败，显示提示
            console.error(`股票 ${stockCode} 历史数据为空`);
            return;
        }

        let historyData = result.data.history;
        console.log(`📊 ${stockCode} ${period}线 - 原始数据: ${historyData.length} 条`);
        if (historyData.length > 0) {
            console.log(`📊 原始数据日期范围: ${historyData[0].date} -> ${historyData[historyData.length-1].date}`);
        }

        // 确保数据按时间正序排列（从旧到新）
        // 腾讯API返回的数据可能是倒序的
        if (historyData.length > 1 && historyData[0].date > historyData[historyData.length - 1].date) {
            historyData = historyData.reverse();
            console.log(`📊 数据已反转为正序 (${historyData[0].date} -> ${historyData[historyData.length-1].date})`);
        }

        // 根据周期聚合数据
        if (period === 'week') {
            historyData = aggregateToWeekly(historyData);
            console.log(`📊 聚合后周线数据: ${historyData.length} 条`);
        } else if (period === 'month') {
            historyData = aggregateToMonthly(historyData);
            console.log(`📊 聚合后月线数据: ${historyData.length} 条`);
        }

        // 只保留最近的指定数量K线
        if (historyData.length > displayCount) {
            historyData = historyData.slice(-displayCount);
            console.log(`📊 截取后显示: ${historyData.length} 条 (目标: ${displayCount} 条)`);
        }

        // 准备K线图数据
        const labels = historyData.map(item => {
            // 处理日期格式：可能是 "20240711" 或 "2024-07-11"
            let dateStr = item.date;
            if (dateStr.includes('-')) {
                // 格式: 2024-07-11
                const parts = dateStr.split('-');
                if (period === 'month') {
                    return `${parts[0]}/${parts[1]}`;
                } else {
                    return `${parts[1]}/${parts[2]}`;
                }
            } else {
                // 格式: 20240711
                if (period === 'month') {
                    return dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1/$2');
                } else {
                    return dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$2/$3');
                }
            }
        });

        // 准备开盘收盘柱状图数据（蜡烛实体）
        const bodyData = historyData.map(item => {
            const isUp = item.close >= item.open;
            return {
                y: [item.open, item.close],
                open: item.open,
                close: item.close,
                high: item.high,
                low: item.low,
                isUp: isUp
            };
        });

        // 准备上下影线数据
        const shadowData = historyData.map(item => {
            return {
                y: [item.low, item.high],
                open: item.open,
                close: item.close,
                high: item.high,
                low: item.low,
                isUp: item.close >= item.open
            };
        });

        // 计算价格变化趋势
        const priceChange = historyData[historyData.length - 1].close - historyData[0].close;
        const isPositive = priceChange >= 0;

        // 创建K线图（A股配色：红涨绿跌）
        const chart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '影线',
                        data: shadowData.map(d => d.y),
                        backgroundColor: shadowData.map(d => d.isUp ? 'rgba(231, 76, 60, 0.8)' : 'rgba(39, 174, 96, 0.8)'),
                        borderColor: shadowData.map(d => d.isUp ? '#e74c3c' : '#27ae60'),
                        borderWidth: 1,
                        barThickness: 2,
                        categoryPercentage: 0.8,
                        barPercentage: 0.9
                    },
                    {
                        label: '实体',
                        data: bodyData.map(d => d.y),
                        backgroundColor: bodyData.map(d => d.isUp ? 'rgba(231, 76, 60, 1)' : 'rgba(39, 174, 96, 1)'),
                        borderColor: bodyData.map(d => d.isUp ? '#e74c3c' : '#27ae60'),
                        borderWidth: 1.5,
                        barThickness: 10,
                        categoryPercentage: 0.8,
                        barPercentage: 0.9
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: isPositive ? '#e74c3c' : '#27ae60',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                const idx = context.dataIndex;
                                const data = historyData[idx];
                                return [
                                    `开盘: ¥${data.open.toFixed(2)}`,
                                    `最高: ¥${data.high.toFixed(2)}`,
                                    `最低: ¥${data.low.toFixed(2)}`,
                                    `收盘: ¥${data.close.toFixed(2)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 6,
                            color: '#95a5a6',
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        stacked: false,
                        display: true,
                        position: 'right',
                        beginAtZero: false,
                        grace: '5%',
                        grid: {
                            color: 'rgba(149, 165, 166, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#95a5a6',
                            font: {
                                size: 10
                            },
                            callback: function(value) {
                                return '¥' + value.toFixed(2);
                            }
                        }
                    }
                }
            }
        });

        // 保存图表实例
        chartInstances[canvasId] = chart;

    } catch (error) {
        console.error(`渲染股票 ${stockCode} 图表失败:`, error);
        // 如果获取真实数据失败，不显示图表
    }
}

// 聚合为周线数据
function aggregateToWeekly(dailyData) {
    const weeklyData = [];
    let currentWeek = null;

    dailyData.forEach(day => {
        // 处理日期格式：可能是 "20240711" 或 "2024-07-11"
        let dateStr = day.date;
        if (!dateStr.includes('-')) {
            // 格式: 20240711 -> 2024-07-11
            dateStr = dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        }
        const date = new Date(dateStr);
        const weekNumber = getWeekNumber(date);

        if (!currentWeek || currentWeek.week !== weekNumber) {
            if (currentWeek) {
                weeklyData.push(currentWeek.data);
            }
            currentWeek = {
                week: weekNumber,
                data: {
                    date: day.date,
                    open: day.open,
                    high: day.high,
                    low: day.low,
                    close: day.close,
                    volume: day.volume
                }
            };
        } else {
            currentWeek.data.high = Math.max(currentWeek.data.high, day.high);
            currentWeek.data.low = Math.min(currentWeek.data.low, day.low);
            currentWeek.data.close = day.close;
            currentWeek.data.volume += day.volume;
            currentWeek.data.date = day.date; // 使用周最后一天的日期
        }
    });

    if (currentWeek) {
        weeklyData.push(currentWeek.data);
    }

    return weeklyData;
}

// 聚合为月线数据
function aggregateToMonthly(dailyData) {
    const monthlyData = [];
    let currentMonth = null;
    const monthCounts = {};

    dailyData.forEach((day, index) => {
        // 处理日期格式：可能是 "20240711" 或 "2024-07-11"
        let monthKey;
        if (day.date.includes('-')) {
            // 格式: 2024-07-11 -> 202407
            monthKey = day.date.substring(0, 7).replace('-', '');
        } else {
            // 格式: 20240711 -> 202407
            monthKey = day.date.substring(0, 6);
        }

        // 统计每个月的数据条数
        monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;

        if (!currentMonth || currentMonth.month !== monthKey) {
            if (currentMonth) {
                monthlyData.push(currentMonth.data);
                console.log(`📅 完成月份 ${currentMonth.month}: ${currentMonth.dayCount} 天, 最终日期: ${currentMonth.data.date}`);
            }
            currentMonth = {
                month: monthKey,
                dayCount: 1,
                data: {
                    date: day.date,
                    open: day.open,       // 月初开盘价
                    high: day.high,
                    low: day.low,
                    close: day.close,
                    volume: day.volume
                }
            };
            console.log(`📅 开始新月份 ${monthKey}: 起始日期 ${day.date}`);
        } else {
            currentMonth.dayCount++;
            // 不更新开盘价，保持月初第一天的开盘价
            currentMonth.data.high = Math.max(currentMonth.data.high, day.high);
            currentMonth.data.low = Math.min(currentMonth.data.low, day.low);
            currentMonth.data.close = day.close;  // 更新为月末收盘价
            currentMonth.data.volume += day.volume;
            currentMonth.data.date = day.date;    // 使用月最后一天的日期
        }
    });

    if (currentMonth) {
        monthlyData.push(currentMonth.data);
        console.log(`📅 完成月份 ${currentMonth.month}: ${currentMonth.dayCount} 天, 最终日期: ${currentMonth.data.date}`);
    }

    console.log(`📅 月线聚合完成: 共 ${monthlyData.length} 个月`);
    console.log(`📅 各月数据量:`, monthCounts);
    if (monthlyData.length > 0) {
        console.log(`📅 第一个月: ${monthlyData[0].date}, 最后一个月: ${monthlyData[monthlyData.length-1].date}`);
    }

    return monthlyData;
}

// 获取周数
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// 加载热点新闻
async function loadHotNews(category = 'latest') {
    const container = document.getElementById('newsContainer');

    if (!container) return;

    try {
        // 显示加载状态
        container.innerHTML = '<div class="loading-text">正在加载热点新闻...</div>';

        // 如果是持仓新闻，调用专门的API
        let response, result;
        if (category === 'positions') {
            const token = localStorage.getItem('token');
            if (!token) {
                container.innerHTML = '<div class="loading-text">请先登录查看持仓新闻</div>';
                return;
            }

            response = await fetch('/api/news/positions', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            result = await response.json();
        } else {
            // 调用普通新闻API
            response = await fetch(`/api/news/hot?category=${category}`);
            result = await response.json();
        }

        if (result.success && result.data && result.data.length > 0) {
            let html = '';
            result.data.forEach((item, index) => {
                const hasUrl = item.url && item.url !== '#';
                const newsId = `news-item-${Date.now()}-${index}`;

                // 持仓新闻显示股票标签
                const stockTag = item.stockName ? `<span class="stock-tag">${item.stockName} (${item.stockCode})</span>` : '';

                html += `
                    <div class="news-item ${hasUrl ? 'news-clickable' : ''}" id="${newsId}">
                        ${hasUrl
                            ? `<div class="news-title" onclick="openNewsLink('${item.url}')" style="cursor: pointer; color: #2c3e50;">${item.title}</div>`
                            : `<div class="news-title">${item.title}</div>`
                        }
                        <div class="news-meta">
                            <span class="news-source">${item.source}</span>
                            <span class="news-time">${item.time}</span>
                            ${stockTag}
                        </div>
                        ${hasUrl ? '<div class="news-link-icon">🔗</div>' : ''}
                    </div>
                `;
            });

            container.innerHTML = html;
        } else {
            // 没有新闻数据
            if (category === 'positions') {
                container.innerHTML = '<div class="loading-text">暂无持仓相关新闻<br><small>请先导入持仓数据</small></div>';
            } else {
                container.innerHTML = '<div class="loading-text">暂无新闻</div>';
            }
        }
    } catch (error) {
        console.error('加载热点新闻错误:', error);
        if (category === 'positions') {
            container.innerHTML = '<div class="loading-text">暂无持仓相关新闻</div>';
        } else {
            container.innerHTML = '<div class="loading-text">暂无新闻</div>';
        }
    }
}

// 初始化新闻类别切换
function initNewsCategories() {
    const categoryBtns = document.querySelectorAll('.news-category-btn');

    categoryBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.getAttribute('data-category');

            // 更新按钮状态
            categoryBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // 加载对应类别的新闻
            loadHotNews(category);
        });
    });
}

// 打开新闻链接
function openNewsLink(url) {
    if (url && url !== '#') {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}


// 显示光大证券持仓数据
function displayEBSCNPositions(data) {
    const { positions, summary } = data;
    
    // 更新总资产和总盈亏
    document.getElementById('ebscnTotalValue').textContent = 
        `¥${summary.totalMarketValue.toLocaleString('zh-CN', {minimumFractionDigits: 2})}`;
    
    const profitClass = summary.totalProfitLoss >= 0 ? 'positive' : 'negative';
    document.getElementById('ebscnProfitLoss').innerHTML = 
        `总盈亏: <span class="${profitClass}">¥${summary.totalProfitLoss.toLocaleString('zh-CN', {minimumFractionDigits: 2})} (${summary.totalProfitLossRate}%)</span>`;
    
    // 显示持仓列表
    const positionsContainer = document.getElementById('ebscnPositions');
    if (positions.length === 0) {
        positionsContainer.innerHTML = '<div class="loading-text">暂无持仓数据</div>';
        return;
    }

    positionsContainer.innerHTML = positions.map(position => {
        const profitLoss = parseFloat(position.profitLoss) || 0;
        const profitLossRate = parseFloat(position.profitLossRate) || 0;
        const isProfit = profitLoss >= 0;
        const profitIcon = isProfit ? '📈' : '📉';
        
        return `
            <div class="position-card">
                <div class="position-header">
                    <div class="stock-info">
                        <div class="stock-symbol">${position.stockCode}</div>
                        <div class="stock-name">${position.stockName}</div>
                    </div>
                    <div class="profit-indicator ${isProfit ? 'profit' : 'loss'}">
                        ${profitIcon}
                    </div>
                </div>
                
                <div class="position-stats">
                    <div class="stat-row">
                        <div class="stat-item">
                            <span class="stat-label">持仓数量</span>
                            <span class="stat-value">${position.quantity}股</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">成本价</span>
                            <span class="stat-value">¥${parseFloat(position.costPrice).toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div class="stat-row">
                        <div class="stat-item">
                            <span class="stat-label">当前价</span>
                            <span class="stat-value">¥${parseFloat(position.currentPrice).toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">市值</span>
                            <span class="stat-value">¥${parseFloat(position.marketValue).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="position-summary">
                    <div class="profit-loss ${isProfit ? 'profit' : 'loss'}">
                        <span class="profit-amount">${isProfit ? '+' : ''}¥${profitLoss.toFixed(2)}</span>
                        <span class="profit-rate">${isProfit ? '+' : ''}${profitLossRate.toFixed(2)}%</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 更新导航栏状态
function updateNavbar(user) {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminBtn = document.getElementById('adminBtn');
    const userName = document.getElementById('userName');
    const userBadge = document.getElementById('userBadge');

    if (user) {
        // 已登录状态
        userName.textContent = user.username;
        
        // 设置用户等级标识
        let badgeText = '';
        let badgeClass = '';
        
        switch(user.role) {
            case 'super_admin':
                badgeText = '超级管理员';
                badgeClass = 'badge-super-admin';
                break;
            case 'admin':
                badgeText = '管理员';
                badgeClass = 'badge-admin';
                break;
            default:
                badgeText = '用户';
                badgeClass = 'badge-user';
        }
        
        userBadge.textContent = badgeText;
        userBadge.className = `user-badge ${badgeClass}`;
        
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        
        // 如果是管理员，显示管理按钮
        if (user.role === 'admin' || user.role === 'super_admin') {
            adminBtn.style.display = 'inline-block';
        } else {
            adminBtn.style.display = 'none';
        }
    } else {
        // 未登录状态
        userName.textContent = '游客';
        userBadge.textContent = '游客';
        userBadge.className = 'user-badge badge-user';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        adminBtn.style.display = 'none';
        
        // 清除本地存储
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
}

// 跳转到登录页面
function goToLogin() {
    window.location.href = '/login.html';
}

// 跳转到管理页面
function goToAdmin() {
    window.location.href = '/admin.html';
}

// 退出登录
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateNavbar(null);
    
    // 显示退出成功消息
    showNotification('已成功退出登录', 'success');
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// 更新当前时间
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN');
    const dateString = now.toLocaleDateString('zh-CN');
    
    document.getElementById('currentTime').textContent = timeString;
    
    // 每5分钟更新一次最后更新时间
    if (now.getMinutes() % 5 === 0 && now.getSeconds() === 0) {
        document.getElementById('lastUpdate').textContent = `${dateString} ${timeString}`;
    }
}

// 加载市场指数
async function loadMarketIndices() {
    const container = document.getElementById('marketIndices');

    if (!container) return;

    try {
        // 主要指数代码
        const indices = [
            { code: '000001', name: '上证指数' },
            { code: '399001', name: '深证成指' },
            { code: '399006', name: '创业板指' }
        ];

        // 批量获取指数行情
        const quotesResponse = await fetch('/api/stock/quotes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stockCodes: indices.map(idx => idx.code)
            })
        });

        if (!quotesResponse.ok) {
            throw new Error('获取指数数据失败');
        }

        const quotesResult = await quotesResponse.json();

        if (!quotesResult.success || !quotesResult.data || quotesResult.data.length === 0) {
            throw new Error('指数数据为空');
        }

        const quotes = quotesResult.data;

        // 渲染指数数据（带K线图）
        let html = '';
        indices.forEach((index, i) => {
            const quote = quotes[i];
            if (quote) {
                const isPositive = parseFloat(quote.changePercent) >= 0;
                const chartId = `market-index-chart-${quote.stockCode}-${i}`;

                html += `
                    <div class="quote-item">
                        <div class="quote-header">
                            <div class="quote-info">
                                <span class="quote-symbol">${index.name} (${quote.stockCode})</span>
                            </div>
                            <div class="quote-stats">
                                <div class="quote-price">${quote.currentPrice.toFixed(2)}</div>
                                <div class="quote-change ${isPositive ? 'positive' : 'negative'}">
                                    ${isPositive ? '+' : ''}${quote.changePercent}%
                                </div>
                            </div>
                        </div>
                        <div class="chart-period-selector">
                            <button class="period-btn active" data-period="day" data-chart="${chartId}" data-stock="${quote.stockCode}">日线</button>
                            <button class="period-btn" data-period="week" data-chart="${chartId}" data-stock="${quote.stockCode}">周线</button>
                            <button class="period-btn" data-period="month" data-chart="${chartId}" data-stock="${quote.stockCode}">月线</button>
                        </div>
                        <div class="quote-chart-container">
                            <canvas id="${chartId}" class="quote-chart"></canvas>
                        </div>
                    </div>
                `;
            }
        });

        if (html) {
            container.innerHTML = html;

            // 渲染K线图
            quotes.forEach((quote, i) => {
                const chartId = `market-index-chart-${quote.stockCode}-${i}`;
                renderStockChart(chartId, quote.stockCode, 'day');
            });

            // 绑定周期切换按钮事件
            document.querySelectorAll('#marketIndices .period-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const period = this.getAttribute('data-period');
                    const chartId = this.getAttribute('data-chart');
                    const stockCode = this.getAttribute('data-stock');

                    // 更新按钮状态
                    const parentSelector = this.parentElement;
                    parentSelector.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');

                    // 重新渲染图表
                    renderStockChart(chartId, stockCode, period);
                });
            });
        } else {
            throw new Error('无法解析指数数据');
        }

    } catch (error) {
        console.error('加载市场指数错误:', error);
        container.innerHTML = '<div class="loading-text">暂无指数数据</div>';
    }
}

// 加载总览页面的自选股行情
async function loadOverviewWatchlistQuotes() {
    const container = document.getElementById('overviewWatchlistQuotes');

    if (!container) return;

    const token = localStorage.getItem('token');
    if (!token) {
        container.innerHTML = '<div class="loading-text">请登录查看自选股行情</div>';
        return;
    }

    try {
        // 获取自选股列表
        const response = await fetch('/api/watchlist', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取自选股列表失败');
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || '获取自选股列表失败');
        }

        const watchlist = result.data || [];

        if (watchlist.length === 0) {
            container.innerHTML = '<div class="loading-text">暂无自选股，请先添加</div>';
            return;
        }

        // 提取股票代码列表
        const stockCodes = watchlist.map(stock => stock.stock_code);

        // 批量获取行情数据
        const quotesResponse = await fetch('/api/stock/quotes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ stockCodes })
        });

        if (!quotesResponse.ok) {
            throw new Error('获取行情数据失败');
        }

        const quotesResult = await quotesResponse.json();

        if (!quotesResult.success) {
            throw new Error(quotesResult.error || '获取行情数据失败');
        }

        const quotes = quotesResult.data || [];

        if (quotes.length === 0) {
            container.innerHTML = '<div class="loading-text">暂无行情数据</div>';
            return;
        }

        // 渲染行情数据（只显示前6个，带K线图）
        let html = '';
        quotes.slice(0, 6).forEach((quote, index) => {
            const isPositive = parseFloat(quote.changePercent) >= 0;
            const chartId = `overview-chart-${quote.stockCode}-${index}`;

            html += `
                <div class="quote-item">
                    <div class="quote-header">
                        <div class="quote-info">
                            <span class="quote-symbol">${quote.stockName || '未知股票'} (${quote.stockCode})</span>
                        </div>
                        <div class="quote-stats">
                            <div class="quote-price">¥${quote.currentPrice.toFixed(2)}</div>
                            <div class="quote-change ${isPositive ? 'positive' : 'negative'}">
                                ${isPositive ? '+' : ''}${quote.changePercent}%
                            </div>
                        </div>
                    </div>
                    <div class="chart-period-selector">
                        <button class="period-btn active" data-period="day" data-chart="${chartId}" data-stock="${quote.stockCode}">日线</button>
                        <button class="period-btn" data-period="week" data-chart="${chartId}" data-stock="${quote.stockCode}">周线</button>
                        <button class="period-btn" data-period="month" data-chart="${chartId}" data-stock="${quote.stockCode}">月线</button>
                    </div>
                    <div class="quote-chart-container">
                        <canvas id="${chartId}" class="quote-chart"></canvas>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // 渲染图表（使用真实历史数据）
        quotes.slice(0, 6).forEach((quote, index) => {
            const chartId = `overview-chart-${quote.stockCode}-${index}`;
            renderStockChart(chartId, quote.stockCode, 'day');
        });

        // 绑定周期切换按钮事件
        document.querySelectorAll('#overviewWatchlistQuotes .period-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const period = this.getAttribute('data-period');
                const chartId = this.getAttribute('data-chart');
                const stockCode = this.getAttribute('data-stock');

                // 更新按钮状态
                const parentSelector = this.parentElement;
                parentSelector.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                // 重新渲染图表
                renderStockChart(chartId, stockCode, period);
            });
        });

    } catch (error) {
        console.error('加载总览自选股行情错误:', error);
        container.innerHTML = '<div class="loading-text">加载失败，请刷新重试</div>';
    }
}

// 模拟股票数据更新
function updateStockData() {
    const stocks = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];
    
    stocks.forEach(stock => {
        const priceElement = document.querySelector(`[data-stock="${stock}"] .stock-price`);
        const changeElement = document.querySelector(`[data-stock="${stock}"] .stock-change`);
        
        if (priceElement && changeElement) {
            const currentPrice = parseFloat(priceElement.textContent.replace('$', '')) || 100;
            const change = (Math.random() - 0.5) * 10;
            const newPrice = Math.max(1, currentPrice + change);
            const changePercent = ((change / currentPrice) * 100).toFixed(2);
            
            priceElement.textContent = `$${newPrice.toFixed(2)}`;
            changeElement.textContent = `${changePercent}%`;
            changeElement.className = `stock-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    });
}

// 添加通知样式
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    }
    
    .notification.success {
        background: linear-gradient(135deg, #e74c3c, #c0392b);
    }

    .notification.info {
        background: linear-gradient(135deg, #3498db, #2980b9);
    }

    .notification.error {
        background: linear-gradient(135deg, #27ae60, #2ecc71);
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .status-indicator {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-left: 8px;
    }
    
    .status-indicator.online {
        background: #e74c3c;
    }
    
    .status-indicator.offline {
        background: #95a5a6;
    }
    
    .user-info {
        display: flex;
        align-items: center;
        margin-right: 15px;
        font-weight: 600;
    }
`;
document.head.appendChild(style);

// 加载持仓概览统计
async function loadPortfolioStats() {
    const container = document.getElementById('portfolioStats');

    if (!container) return;

    const token = localStorage.getItem('token');
    if (!token) {
        container.innerHTML = '<div class="loading-text">请登录查看持仓统计</div>';
        return;
    }

    try {
        // 获取持仓数据
        const response = await fetch('/api/positions', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取持仓数据失败');
        }

        const result = await response.json();

        if (!result.success || !result.data.positions || result.data.positions.length === 0) {
            container.innerHTML = '<div class="loading-text">暂无持仓数据</div>';
            return;
        }

        const positions = result.data.positions;
        const summary = result.data.summary;

        // 找出最佳和最差表现的股票
        let bestStock = positions[0];
        let worstStock = positions[0];

        positions.forEach(pos => {
            if (pos.profitLossRate > bestStock.profitLossRate) {
                bestStock = pos;
            }
            if (pos.profitLossRate < worstStock.profitLossRate) {
                worstStock = pos;
            }
        });

        // 渲染统计数据
        const html = `
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-icon">📦</div>
                    <div class="stat-content">
                        <div class="stat-label">持仓股票</div>
                        <div class="stat-value">${summary.positionCount}只</div>
                    </div>
                </div>

                <div class="stat-box">
                    <div class="stat-icon">💰</div>
                    <div class="stat-content">
                        <div class="stat-label">总市值</div>
                        <div class="stat-value">¥${summary.totalMarketValue.toFixed(2)}</div>
                    </div>
                </div>

                <div class="stat-box ${summary.totalProfitLoss >= 0 ? 'positive' : 'negative'}">
                    <div class="stat-icon">${summary.totalProfitLoss >= 0 ? '📈' : '📉'}</div>
                    <div class="stat-content">
                        <div class="stat-label">总盈亏</div>
                        <div class="stat-value">${summary.totalProfitLoss >= 0 ? '+' : ''}¥${summary.totalProfitLoss.toFixed(2)}</div>
                        <div class="stat-sub">${summary.totalProfitLoss >= 0 ? '+' : ''}${summary.totalProfitLossRate}%</div>
                    </div>
                </div>

                <div class="stat-box best-stock">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-content">
                        <div class="stat-label">最佳</div>
                        <div class="stat-value">${bestStock.stockName}</div>
                        <div class="stat-sub positive">+${bestStock.profitLossRate.toFixed(2)}%</div>
                    </div>
                </div>

                <div class="stat-box worst-stock">
                    <div class="stat-icon">⚠️</div>
                    <div class="stat-content">
                        <div class="stat-label">最差</div>
                        <div class="stat-value">${worstStock.stockName}</div>
                        <div class="stat-sub negative">${worstStock.profitLossRate.toFixed(2)}%</div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('加载持仓统计错误:', error);
        container.innerHTML = '<div class="loading-text">加载失败</div>';
    }
}

// 加载涨跌分布
async function loadChangeDistribution() {
    const container = document.getElementById('changeDistribution');

    if (!container) return;

    const token = localStorage.getItem('token');
    if (!token) {
        container.innerHTML = '<div class="loading-text">请登录查看涨跌分布</div>';
        return;
    }

    try {
        // 获取自选股列表
        const watchlistResponse = await fetch('/api/watchlist', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!watchlistResponse.ok) {
            throw new Error('获取自选股列表失败');
        }

        const watchlistResult = await watchlistResponse.json();

        if (!watchlistResult.success || !watchlistResult.data || watchlistResult.data.length === 0) {
            container.innerHTML = '<div class="loading-text">暂无自选股数据</div>';
            return;
        }

        const watchlist = watchlistResult.data;
        const stockCodes = watchlist.map(stock => stock.stock_code);

        // 批量获取行情数据
        const quotesResponse = await fetch('/api/stock/quotes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ stockCodes })
        });

        if (!quotesResponse.ok) {
            throw new Error('获取行情数据失败');
        }

        const quotesResult = await quotesResponse.json();

        if (!quotesResult.success || !quotesResult.data || quotesResult.data.length === 0) {
            container.innerHTML = '<div class="loading-text">暂无行情数据</div>';
            return;
        }

        const quotes = quotesResult.data;

        // 统计涨跌分布
        let upCount = 0;
        let downCount = 0;
        let flatCount = 0;

        // 按涨跌幅分类
        let bigUp = 0;      // >5%
        let mediumUp = 0;   // 3-5%
        let smallUp = 0;    // 0-3%
        let smallDown = 0;  // 0-(-3)%
        let mediumDown = 0; // (-3)-(-5)%
        let bigDown = 0;    // <-5%

        quotes.forEach(quote => {
            const change = parseFloat(quote.changePercent);
            console.log(`股票 ${quote.stockCode} ${quote.stockName}: 涨跌幅 ${change}%`);

            if (change > 0) {
                upCount++;
                if (change > 5) bigUp++;
                else if (change > 3) mediumUp++;
                else smallUp++;
            } else if (change < 0) {
                downCount++;
                if (change < -5) bigDown++;
                else if (change < -3) mediumDown++;
                else smallDown++;
            } else {
                flatCount++;
            }
        });

        const total = quotes.length;
        const upPercent = ((upCount / total) * 100).toFixed(1);
        const downPercent = ((downCount / total) * 100).toFixed(1);

        console.log(`📊 涨跌分布统计:`);
        console.log(`  总数: ${total}`);
        console.log(`  上涨: ${upCount} (${upPercent}%) - 大涨${bigUp} 中涨${mediumUp} 小涨${smallUp}`);
        console.log(`  下跌: ${downCount} (${downPercent}%) - 大跌${bigDown} 中跌${mediumDown} 小跌${smallDown}`);
        console.log(`  平盘: ${flatCount}`);

        // 渲染涨跌分布
        const html = `
            <div class="distribution-summary">
                <div class="distribution-overview">
                    <div class="overview-item up">
                        <div class="overview-count">${upCount}</div>
                        <div class="overview-label">上涨 (${upPercent}%)</div>
                    </div>
                    <div class="overview-divider"></div>
                    <div class="overview-item down">
                        <div class="overview-count">${downCount}</div>
                        <div class="overview-label">下跌 (${downPercent}%)</div>
                    </div>
                    <div class="overview-divider"></div>
                    <div class="overview-item flat">
                        <div class="overview-count">${flatCount}</div>
                        <div class="overview-label">平盘</div>
                    </div>
                </div>

                <div class="distribution-bars">
                    <div class="bar-item">
                        <div class="bar-label">涨幅 &gt;5%</div>
                        <div class="bar-container">
                            <div class="bar bar-big-up" style="width: ${(bigUp / total * 100).toFixed(1)}%"></div>
                            <span class="bar-count">${bigUp}</span>
                        </div>
                    </div>

                    <div class="bar-item">
                        <div class="bar-label">涨幅 3-5%</div>
                        <div class="bar-container">
                            <div class="bar bar-medium-up" style="width: ${(mediumUp / total * 100).toFixed(1)}%"></div>
                            <span class="bar-count">${mediumUp}</span>
                        </div>
                    </div>

                    <div class="bar-item">
                        <div class="bar-label">涨幅 0-3%</div>
                        <div class="bar-container">
                            <div class="bar bar-small-up" style="width: ${(smallUp / total * 100).toFixed(1)}%"></div>
                            <span class="bar-count">${smallUp}</span>
                        </div>
                    </div>

                    <div class="bar-item">
                        <div class="bar-label">跌幅 0-3%</div>
                        <div class="bar-container">
                            <div class="bar bar-small-down" style="width: ${(smallDown / total * 100).toFixed(1)}%"></div>
                            <span class="bar-count">${smallDown}</span>
                        </div>
                    </div>

                    <div class="bar-item">
                        <div class="bar-label">跌幅 3-5%</div>
                        <div class="bar-container">
                            <div class="bar bar-medium-down" style="width: ${(mediumDown / total * 100).toFixed(1)}%"></div>
                            <span class="bar-count">${mediumDown}</span>
                        </div>
                    </div>

                    <div class="bar-item">
                        <div class="bar-label">跌幅 &gt;5%</div>
                        <div class="bar-container">
                            <div class="bar bar-big-down" style="width: ${(bigDown / total * 100).toFixed(1)}%"></div>
                            <span class="bar-count">${bigDown}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('加载涨跌分布错误:', error);
        container.innerHTML = '<div class="loading-text">加载失败</div>';
    }
}

// 加载系统使用统计
async function loadSystemStats() {
    const container = document.getElementById('systemStats');

    if (!container) return;

    try {
        // 获取缓存统计
        const cacheResponse = await fetch('/api/cache/stats');

        if (!cacheResponse.ok) {
            throw new Error('获取缓存统计失败');
        }

        const cacheResult = await cacheResponse.json();

        if (!cacheResult.success) {
            throw new Error('获取缓存统计失败');
        }

        const cacheStats = cacheResult.data;

        // 获取自选股数量
        const token = localStorage.getItem('token');
        let watchlistCount = 0;

        if (token) {
            try {
                const watchlistResponse = await fetch('/api/watchlist', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (watchlistResponse.ok) {
                    const watchlistResult = await watchlistResponse.json();
                    if (watchlistResult.success && watchlistResult.data) {
                        watchlistCount = watchlistResult.data.length;
                    }
                }
            } catch (e) {
                console.log('获取自选股数量失败:', e);
            }
        }

        // 渲染系统统计
        const html = `
            <div class="system-stats-grid">
                <div class="system-stat-item">
                    <div class="system-stat-icon">⭐</div>
                    <div class="system-stat-content">
                        <div class="system-stat-label">自选股</div>
                        <div class="system-stat-value">${watchlistCount}只</div>
                    </div>
                </div>

                <div class="system-stat-item">
                    <div class="system-stat-icon">💾</div>
                    <div class="system-stat-content">
                        <div class="system-stat-label">行情缓存</div>
                        <div class="system-stat-value">${cacheStats.quoteCount || 0}条</div>
                    </div>
                </div>

                <div class="system-stat-item">
                    <div class="system-stat-icon">📊</div>
                    <div class="system-stat-content">
                        <div class="system-stat-label">历史缓存</div>
                        <div class="system-stat-value">${cacheStats.historyCount || 0}条</div>
                    </div>
                </div>

                <div class="system-stat-item ${cacheStats.isTradeTime ? 'trade-time' : ''}">
                    <div class="system-stat-icon">${cacheStats.isTradeTime ? '🔔' : '🌙'}</div>
                    <div class="system-stat-content">
                        <div class="system-stat-label">交易状态</div>
                        <div class="system-stat-value">${cacheStats.isTradeTime ? '交易时段' : '非交易时段'}</div>
                    </div>
                </div>
            </div>

            <div class="cache-info">
                <div class="cache-info-item">
                    <span class="cache-info-label">缓存策略：</span>
                    <span class="cache-info-value">${cacheStats.message || '智能缓存管理'}</span>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('加载系统统计错误:', error);
        container.innerHTML = '<div class="loading-text">加载失败</div>';
    }
}

// 加载交易时段提醒
function loadTradeTimeReminder() {
    const container = document.getElementById('tradeTimeReminder');

    if (!container) return;

    function updateTradeTime() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const currentTime = hours * 60 + minutes;

        // 定义交易时段
        const morningOpen = 9 * 60 + 30;   // 09:30
        const morningClose = 11 * 60 + 30;  // 11:30
        const afternoonOpen = 13 * 60;      // 13:00
        const afternoonClose = 15 * 60;     // 15:00
        const callAuctionStart = 9 * 60 + 15; // 09:15 集合竞价开始
        const callAuctionEnd = 9 * 60 + 25;   // 09:25 集合竞价结束

        let status = '';
        let icon = '';
        let message = '';
        let countdown = '';
        let statusClass = '';

        // 判断交易状态
        if (currentTime >= morningOpen && currentTime < morningClose) {
            // 上午交易中
            status = '交易中';
            icon = '🔔';
            statusClass = 'trading';
            const remainMinutes = morningClose - currentTime;
            countdown = `距上午收盘还有 ${Math.floor(remainMinutes / 60)}小时${remainMinutes % 60}分钟`;
            message = '上午交易时段';
        } else if (currentTime >= afternoonOpen && currentTime < afternoonClose) {
            // 下午交易中
            status = '交易中';
            icon = '🔔';
            statusClass = 'trading';
            const remainMinutes = afternoonClose - currentTime;
            countdown = `距收盘还有 ${Math.floor(remainMinutes / 60)}小时${remainMinutes % 60}分钟`;
            message = '下午交易时段';
        } else if (currentTime >= callAuctionStart && currentTime < callAuctionEnd) {
            // 集合竞价时段
            status = '集合竞价';
            icon = '⏰';
            statusClass = 'call-auction';
            const remainMinutes = callAuctionEnd - currentTime;
            countdown = `距开盘还有 ${remainMinutes} 分钟`;
            message = '集合竞价中，9:25撮合成交';
        } else if (currentTime >= callAuctionEnd && currentTime < morningOpen) {
            // 集合竞价结束到开盘
            status = '即将开盘';
            icon = '⏰';
            statusClass = 'pre-trading';
            const remainMinutes = morningOpen - currentTime;
            countdown = `距开盘还有 ${remainMinutes} 分钟`;
            message = '准备开盘';
        } else if (currentTime >= morningClose && currentTime < afternoonOpen) {
            // 午休时间
            status = '午休时间';
            icon = '☕';
            statusClass = 'lunch-break';
            const remainMinutes = afternoonOpen - currentTime;
            countdown = `距下午开盘还有 ${Math.floor(remainMinutes / 60)}小时${remainMinutes % 60}分钟`;
            message = '11:30-13:00 休市';
        } else if (currentTime >= afternoonClose) {
            // 收盘后
            status = '已收盘';
            icon = '🌙';
            statusClass = 'closed';
            message = '今日交易已结束';
            countdown = '明日 09:15 开始集合竞价';
        } else {
            // 开盘前
            status = '未开盘';
            icon = '🌙';
            statusClass = 'closed';
            const remainMinutes = callAuctionStart - currentTime;
            countdown = `距集合竞价还有 ${Math.floor(remainMinutes / 60)}小时${remainMinutes % 60}分钟`;
            message = '今日暂未开盘';
        }

        // 渲染交易时段信息
        const html = `
            <div class="trade-time-status ${statusClass}">
                <div class="trade-time-main">
                    <div class="trade-time-icon">${icon}</div>
                    <div class="trade-time-info">
                        <div class="trade-time-status-text">${status}</div>
                        <div class="trade-time-message">${message}</div>
                    </div>
                </div>
                <div class="trade-time-countdown">${countdown}</div>
                <div class="trade-time-schedule">
                    <div class="schedule-item">
                        <span class="schedule-label">集合竞价</span>
                        <span class="schedule-time">09:15 - 09:25</span>
                    </div>
                    <div class="schedule-item">
                        <span class="schedule-label">上午交易</span>
                        <span class="schedule-time">09:30 - 11:30</span>
                    </div>
                    <div class="schedule-item">
                        <span class="schedule-label">下午交易</span>
                        <span class="schedule-time">13:00 - 15:00</span>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    // 初始加载
    updateTradeTime();

    // 每分钟更新一次
    setInterval(updateTradeTime, 60000);
}

// 加载市场概览
async function loadMarketOverview() {
    const container = document.getElementById('marketOverview');

    if (!container) return;

    try {
        // 主要指数代码
        const indices = [
            { code: '000001', name: '上证指数' },
            { code: '399001', name: '深证成指' },
            { code: '399006', name: '创业板指' }
        ];

        // 批量获取指数行情
        const quotesResponse = await fetch('/api/stock/quotes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stockCodes: indices.map(idx => idx.code)
            })
        });

        if (!quotesResponse.ok) {
            throw new Error('获取指数数据失败');
        }

        const quotesResult = await quotesResponse.json();

        if (!quotesResult.success || !quotesResult.data || quotesResult.data.length === 0) {
            throw new Error('指数数据为空');
        }

        const quotes = quotesResult.data;

        // 渲染市场概览（简化版，只显示数据不显示图表）
        let html = '<div class="market-overview-grid">';

        quotes.forEach((quote, i) => {
            const isPositive = parseFloat(quote.changePercent) >= 0;

            html += `
                <div class="market-index-item ${isPositive ? 'up' : 'down'}">
                    <div class="index-header">
                        <div class="index-name">${indices[i].name}</div>
                        <div class="index-code">${quote.stockCode}</div>
                    </div>
                    <div class="index-price">${quote.currentPrice.toFixed(2)}</div>
                    <div class="index-change">
                        <span class="change-value">${isPositive ? '+' : ''}${quote.change.toFixed(2)}</span>
                        <span class="change-percent">${isPositive ? '+' : ''}${quote.changePercent}%</span>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('加载市场概览错误:', error);
        container.innerHTML = '<div class="loading-text">加载失败</div>';
    }
}

// 加载涨跌幅榜
async function loadTopGainersLosers() {
    const gainersContainer = document.getElementById('topGainers');
    const losersContainer = document.getElementById('topLosers');

    if (!gainersContainer || !losersContainer) return;

    const token = localStorage.getItem('token');
    if (!token) {
        gainersContainer.innerHTML = '<div class="loading-text">请登录查看涨幅榜</div>';
        losersContainer.innerHTML = '<div class="loading-text">请登录查看跌幅榜</div>';
        return;
    }

    try {
        // 获取自选股列表
        const watchlistResponse = await fetch('/api/watchlist', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!watchlistResponse.ok) {
            throw new Error('获取自选股列表失败');
        }

        const watchlistResult = await watchlistResponse.json();

        if (!watchlistResult.success || !watchlistResult.data || watchlistResult.data.length === 0) {
            gainersContainer.innerHTML = '<div class="loading-text">暂无自选股数据</div>';
            losersContainer.innerHTML = '<div class="loading-text">暂无自选股数据</div>';
            return;
        }

        const watchlist = watchlistResult.data;
        const stockCodes = watchlist.map(stock => stock.stock_code);

        // 批量获取行情数据
        const quotesResponse = await fetch('/api/stock/quotes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ stockCodes })
        });

        if (!quotesResponse.ok) {
            throw new Error('获取行情数据失败');
        }

        const quotesResult = await quotesResponse.json();

        if (!quotesResult.success || !quotesResult.data || quotesResult.data.length === 0) {
            gainersContainer.innerHTML = '<div class="loading-text">暂无行情数据</div>';
            losersContainer.innerHTML = '<div class="loading-text">暂无行情数据</div>';
            return;
        }

        const quotes = quotesResult.data;

        console.log('📊 涨跌幅榜原始数据:', quotes.map(q => `${q.stockName}(${q.stockCode}): ${q.changePercent}%`));

        // 按涨跌幅排序（从高到低）
        const sortedQuotes = [...quotes].sort((a, b) => {
            return parseFloat(b.changePercent) - parseFloat(a.changePercent);
        });

        console.log('📊 排序后数据:', sortedQuotes.map(q => `${q.stockName}(${q.stockCode}): ${q.changePercent}%`));

        // 涨幅榜 TOP10（取前10个，涨幅最大的）
        const topGainers = sortedQuotes.slice(0, Math.min(10, sortedQuotes.length));
        console.log('📈 涨幅榜 TOP10:', topGainers.map(q => `${q.stockName}: ${q.changePercent}%`));

        let gainersHtml = '<div class="ranking-list">';
        topGainers.forEach((quote, index) => {
            const changePercent = parseFloat(quote.changePercent);
            const change = parseFloat(quote.change);
            const isPositive = changePercent >= 0;

            gainersHtml += `
                <div class="ranking-item">
                    <div class="ranking-number ${index < 3 ? 'top-three' : ''}">${index + 1}</div>
                    <div class="ranking-stock">
                        <div class="ranking-name">${quote.stockName}</div>
                        <div class="ranking-code">${quote.stockCode}</div>
                    </div>
                    <div class="ranking-price">¥${quote.currentPrice.toFixed(2)}</div>
                    <div class="ranking-change ${isPositive ? 'up' : 'down'}">
                        <div class="ranking-percent">${isPositive ? '+' : ''}${changePercent.toFixed(2)}%</div>
                        <div class="ranking-value">${isPositive ? '+' : ''}${change.toFixed(2)}</div>
                    </div>
                </div>
            `;
        });
        gainersHtml += '</div>';
        gainersContainer.innerHTML = gainersHtml;

        // 跌幅榜 TOP10（取后10个并反转，跌幅最大的）
        const topLosers = sortedQuotes.slice(-Math.min(10, sortedQuotes.length)).reverse();
        console.log('📉 跌幅榜 TOP10:', topLosers.map(q => `${q.stockName}: ${q.changePercent}%`));

        let losersHtml = '<div class="ranking-list">';
        topLosers.forEach((quote, index) => {
            const changePercent = parseFloat(quote.changePercent);
            const change = parseFloat(quote.change);
            const isPositive = changePercent >= 0;

            losersHtml += `
                <div class="ranking-item">
                    <div class="ranking-number ${index < 3 ? 'top-three' : ''}">${index + 1}</div>
                    <div class="ranking-stock">
                        <div class="ranking-name">${quote.stockName}</div>
                        <div class="ranking-code">${quote.stockCode}</div>
                    </div>
                    <div class="ranking-price">¥${quote.currentPrice.toFixed(2)}</div>
                    <div class="ranking-change ${isPositive ? 'up' : 'down'}">
                        <div class="ranking-percent">${isPositive ? '+' : ''}${changePercent.toFixed(2)}%</div>
                        <div class="ranking-value">${isPositive ? '+' : ''}${change.toFixed(2)}</div>
                    </div>
                </div>
            `;
        });
        losersHtml += '</div>';
        losersContainer.innerHTML = losersHtml;

    } catch (error) {
        console.error('加载涨跌幅榜错误:', error);
        gainersContainer.innerHTML = '<div class="loading-text">加载失败</div>';
        losersContainer.innerHTML = '<div class="loading-text">加载失败</div>';
    }
}

// AI助手功能
// 发送询问到AI
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

// 生成模拟AI响应
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

// 清空AI对话
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

// 持仓分析功能
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
            const { analysis, portfolioSummary, timestamp } = result.data;

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

// 显示持仓分析结果
function displayPortfolioAnalysis(analysis, summary, timestamp) {
    const container = document.getElementById('portfolioAnalysis');

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

// 查看报告历史
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
                    <div class="report-list-item" onclick="viewReportDetail(${report.id})">
                        <div class="report-item-info">
                            <div class="report-item-date">📅 ${dateStr}</div>
                            <span class="report-item-type ${typeClass}">${typeLabel}</span>
                        </div>
                        <div class="report-item-action">→</div>
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

// 查看报告详情
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

// 关闭报告历史模态框
function closeReportHistoryModal() {
    const modal = document.getElementById('reportHistoryModal');
    modal.style.display = 'none';
}
