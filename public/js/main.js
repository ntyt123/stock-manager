// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuth();
    updateTime();
    setInterval(updateTime, 1000);

    // 初始化Excel上传功能
    initExcelUpload();

    // 初始化页签功能
    initTabs();

    // 初始化模态框点击背景关闭功能
    initModalCloseOnBackgroundClick();

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

// 初始化模态框点击背景关闭功能
function initModalCloseOnBackgroundClick() {
    // 报告历史模态框
    const reportHistoryModal = document.getElementById('reportHistoryModal');
    if (reportHistoryModal) {
        reportHistoryModal.addEventListener('click', function(event) {
            // 如果点击的是模态框背景（而不是内容区域），则关闭
            if (event.target === reportHistoryModal) {
                closeReportHistoryModal();
            }
        });
    }

    // 报告详情模态框
    const reportDetailModal = document.getElementById('reportDetailModal');
    if (reportDetailModal) {
        reportDetailModal.addEventListener('click', function(event) {
            // 如果点击的是模态框背景（而不是内容区域），则关闭
            if (event.target === reportDetailModal) {
                closeReportDetailModal();
            }
        });
    }

    // Excel上传模态框
    const excelUploadModal = document.getElementById('excelUploadModal');
    if (excelUploadModal) {
        excelUploadModal.addEventListener('click', function(event) {
            // 如果点击的是模态框背景（而不是内容区域），则关闭
            if (event.target === excelUploadModal) {
                closeExcelUploadModal();
            }
        });
    }

    // 集合竞价历史模态框
    const callAuctionHistoryModal = document.getElementById('callAuctionHistoryModal');
    if (callAuctionHistoryModal) {
        callAuctionHistoryModal.addEventListener('click', function(event) {
            if (event.target === callAuctionHistoryModal) {
                closeCallAuctionHistoryModal();
            }
        });
    }

    // 集合竞价详情模态框
    const callAuctionDetailModal = document.getElementById('callAuctionDetailModal');
    if (callAuctionDetailModal) {
        callAuctionDetailModal.addEventListener('click', function(event) {
            if (event.target === callAuctionDetailModal) {
                closeCallAuctionDetailModal();
            }
        });
    }

    // 股票推荐历史模态框
    const recommendationHistoryModal = document.getElementById('recommendationHistoryModal');
    if (recommendationHistoryModal) {
        recommendationHistoryModal.addEventListener('click', function(event) {
            if (event.target === recommendationHistoryModal) {
                closeRecommendationHistoryModal();
            }
        });
    }

    // 股票推荐详情模态框
    const recommendationDetailModal = document.getElementById('recommendationDetailModal');
    if (recommendationDetailModal) {
        recommendationDetailModal.addEventListener('click', function(event) {
            if (event.target === recommendationDetailModal) {
                closeRecommendationDetailModal();
            }
        });
    }
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
async function loadAnalysisData() {
    const token = localStorage.getItem('token');

    if (!token) {
        console.log('用户未登录，跳过加载分析数据');
        // 未登录也加载今日推荐（推荐功能不需要登录）
        loadTodayRecommendation();
        return;
    }

    // 并行加载最新的持仓报告、集合竞价报告、风险预警和今日推荐
    await Promise.all([
        loadLatestPortfolioReport(),
        loadLatestCallAuctionReport(),
        loadRiskWarnings(),
        loadTodayRecommendation()
    ]);
}

// 加载最新的持仓分析报告
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

// 加载最新的集合竞价分析报告
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
                        <button class="period-btn active" data-period="intraday" data-chart="${chartId}" data-stock="${quote.stockCode}">分时</button>
                        <button class="period-btn" data-period="day" data-chart="${chartId}" data-stock="${quote.stockCode}">日线</button>
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

        // 渲染图表（默认显示分时图）
        quotes.forEach((quote, index) => {
            const chartId = `chart-${quote.stockCode}-${index}`;
            renderStockChart(chartId, quote.stockCode, 'intraday');
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
                            <button class="period-btn active" data-period="intraday" data-chart="${chartId}" data-stock="${quote.stockCode}">分时</button>
                            <button class="period-btn" data-period="day" data-chart="${chartId}" data-stock="${quote.stockCode}">日线</button>
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

            // 渲染图表（默认显示分时图）
            quotes.forEach((quote, i) => {
                const chartId = `market-index-chart-${quote.stockCode}-${i}`;
                renderStockChart(chartId, quote.stockCode, 'intraday');
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
                        <button class="period-btn active" data-period="intraday" data-chart="${chartId}" data-stock="${quote.stockCode}">分时</button>
                        <button class="period-btn" data-period="day" data-chart="${chartId}" data-stock="${quote.stockCode}">日线</button>
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

        // 渲染图表（默认显示分时图）
        quotes.slice(0, 6).forEach((quote, index) => {
            const chartId = `overview-chart-${quote.stockCode}-${index}`;
            renderStockChart(chartId, quote.stockCode, 'intraday');
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

// 在弹窗中查看报告详情
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
            const { analysis, portfolioSummary, timestamp } = result.data;

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

// 关闭报告详情模态框
function closeReportDetailModal() {
    const modal = document.getElementById('reportDetailModal');
    modal.style.display = 'none';
}

// ==================== 集合竞价分析功能 ====================

// 手动触发集合竞价分析
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
            const { analysis, marketSummary, timestamp, analysisDate } = result.data;

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

// 显示集合竞价分析结果
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

// 查看集合竞价分析历史
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

// 在弹窗中查看集合竞价分析详情
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

// 关闭集合竞价历史模态框
function closeCallAuctionHistoryModal() {
    const modal = document.getElementById('callAuctionHistoryModal');
    modal.style.display = 'none';
}

// 关闭集合竞价详情模态框
function closeCallAuctionDetailModal() {
    const modal = document.getElementById('callAuctionDetailModal');
    modal.style.display = 'none';
}

// 删除持仓分析报告
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

// 删除集合竞价分析记录
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

// 加载风险预警（从最新的持仓分析报告中提取）
async function loadRiskWarnings() {
    const container = document.getElementById('riskAssessment');

    if (!container) return;

    const token = localStorage.getItem('token');
    if (!token) {
        container.innerHTML = '<div class="loading-text">请登录后查看风险预警</div>';
        return;
    }

    try {
        console.log('📊 正在加载风险预警...');

        // 显示加载状态
        container.innerHTML = '<div class="loading-text">正在加载风险预警...</div>';

        // 获取最新的持仓分析报告
        const response = await fetch('/api/analysis/reports?limit=1', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取报告失败');
        }

        const result = await response.json();

        if (!result.success || !result.data.reports || result.data.reports.length === 0) {
            container.innerHTML = '<div class="loading-text">暂无风险预警数据，请先进行持仓分析</div>';
            console.log('ℹ️ 没有找到持仓分析报告');
            return;
        }

        // 获取最新报告的ID
        const latestReportId = result.data.reports[0].id;
        console.log(`📄 最新报告ID: ${latestReportId}`);

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

        if (!detailResult.success || !detailResult.data) {
            throw new Error('报告数据为空');
        }

        const analysisContent = detailResult.data.analysis;

        // 提取风险预警内容（寻找 ## 【风险预警】 标题）
        const riskHeadingPattern = /##\s*【风险预警】/;
        const match = analysisContent.match(riskHeadingPattern);

        if (!match) {
            console.log('⚠️ 未找到风险预警标题');
            container.innerHTML = '<div class="loading-text">暂无风险预警数据<br><small>最新报告中未包含风险预警信息</small></div>';
            return;
        }

        // 找到风险预警标题的位置
        const headingStart = match.index;
        const headingEnd = headingStart + match[0].length;

        // 从标题后开始提取内容，直到下一个 ## 标题或文本结束
        const contentAfterHeading = analysisContent.substring(headingEnd);
        const nextHeadingMatch = contentAfterHeading.match(/\n##\s+/);

        let riskWarningText;
        if (nextHeadingMatch) {
            // 提取到下一个标题之前的内容
            riskWarningText = contentAfterHeading.substring(0, nextHeadingMatch.index).trim();
        } else {
            // 提取到文本结束
            riskWarningText = contentAfterHeading.trim();
        }

        if (!riskWarningText) {
            container.innerHTML = '<div class="loading-text">暂无风险预警数据</div>';
            return;
        }

        console.log('✅ 成功提取风险预警内容');

        // 使用marked解析Markdown格式的风险预警
        let riskWarningHtml = marked.parse(riskWarningText);

        // 对风险等级标签进行美化处理
        riskWarningHtml = riskWarningHtml
            .replace(/【高风险】/g, '<span class="risk-level-high">⚠️ 高风险</span>')
            .replace(/【中风险】/g, '<span class="risk-level-medium">⚡ 中风险</span>')
            .replace(/【注意】/g, '<span class="risk-level-notice">💡 注意</span>');

        // 显示风险预警
        const html = `
            <div class="risk-warning-content">
                <div class="risk-warning-header">
                    <span class="warning-icon">⚠️</span>
                    <span class="warning-title">最新风险预警</span>
                    <span class="warning-time">${new Date(detailResult.data.timestamp).toLocaleString('zh-CN')}</span>
                </div>
                <div class="risk-warning-list">
                    ${riskWarningHtml}
                </div>
            </div>
        `;

        container.innerHTML = html;

        console.log('✅ 风险预警加载完成');

    } catch (error) {
        console.error('❌ 加载风险预警错误:', error);
        container.innerHTML = `
            <div class="loading-text">
                加载失败: ${error.message}<br>
                <small>请稍后重试或重新进行持仓分析</small>
            </div>
        `;
    }
}

// ==================== 股票详情悬浮框功能 ====================

let currentTooltipChart = null; // 保存当前悬浮框中的图表实例
let currentTooltipStockCode = null; // 保存当前悬浮框显示的股票代码

// 显示股票详情悬浮框
async function showStockTooltip(stockCode, stockName, event) {
    const tooltip = document.getElementById('stockDetailTooltip');
    const tooltipLoading = document.getElementById('tooltipLoading');
    const tooltipData = document.getElementById('tooltipData');
    const tooltipStockName = document.getElementById('tooltipStockName');
    const tooltipStockCode = document.getElementById('tooltipStockCode');

    if (!tooltip) return;

    console.log(`📊 显示股票详情: ${stockCode} ${stockName}`);

    // 保存当前股票代码
    currentTooltipStockCode = stockCode;

    // 设置股票名称和代码
    tooltipStockName.textContent = stockName || '加载中...';
    tooltipStockCode.textContent = stockCode;

    // 显示加载状态
    tooltipLoading.style.display = 'flex';
    tooltipData.style.display = 'none';

    // 绑定周期切换按钮事件
    bindTooltipPeriodButtons();

    // 优化定位逻辑：智能计算悬浮框位置
    // 注意：tooltip 使用 position: fixed，所以坐标是相对于视口的，不需要加滚动偏移
    const tooltipWidth = 450;
    const tooltipHeight = 600;
    const offset = 15; // 鼠标偏移量
    const topOffset = 20; // 悬浮框距离鼠标上方的距离

    // 获取视口尺寸
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 鼠标位置（相对于视口）
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // 智能定位：优先显示在右侧，如果空间不足则显示在左侧
    let finalX, finalY;

    // 水平方向定位
    if (mouseX + offset + tooltipWidth < viewportWidth) {
        // 鼠标右侧有足够空间
        finalX = mouseX + offset;
    } else if (mouseX - offset - tooltipWidth > 0) {
        // 鼠标左侧有足够空间
        finalX = mouseX - offset - tooltipWidth;
    } else {
        // 两侧空间都不足，居中显示
        finalX = Math.max(10, (viewportWidth - tooltipWidth) / 2);
    }

    // 垂直方向定位：优先显示在鼠标上方
    if (mouseY - tooltipHeight - topOffset > 10) {
        // 上方有足够空间，显示在鼠标上方
        finalY = mouseY - tooltipHeight - topOffset;
    } else if (mouseY + offset + tooltipHeight < viewportHeight - 10) {
        // 上方空间不足，显示在鼠标下方
        finalY = mouseY + offset;
    } else {
        // 上下空间都不足，尽量靠上显示
        finalY = Math.max(10, Math.min(mouseY - tooltipHeight / 2, viewportHeight - tooltipHeight - 10));
    }

    // 最终边界检查：确保不超出视口
    finalX = Math.max(10, Math.min(finalX, viewportWidth - tooltipWidth - 10));
    finalY = Math.max(10, Math.min(finalY, viewportHeight - tooltipHeight - 10));

    tooltip.style.left = `${finalX}px`;
    tooltip.style.top = `${finalY}px`;
    tooltip.style.display = 'block';

    try {
        // 获取股票详情数据
        await fetchStockDetail(stockCode, stockName);
    } catch (error) {
        console.error('❌ 获取股票详情失败:', error);
        tooltipLoading.style.display = 'none';
        tooltipData.style.display = 'block';
        document.getElementById('tooltipCompanyInfo').textContent = '加载失败，请稍后重试';
    }
}

// 关闭股票详情悬浮框
function closeStockTooltip() {
    const tooltip = document.getElementById('stockDetailTooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }

    // 销毁图表实例（使用通用组件的销毁方法）
    if (currentTooltipChart) {
        stockChartManager.destroyChart('tooltipChart');
        currentTooltipChart = null;
    }

    // 清除保存的股票代码
    currentTooltipStockCode = null;

    console.log('📊 关闭股票详情悬浮框');
}

// 构建详细的公司简介
function buildCompanyInfo(quote, stockCode) {
    // 判断交易所
    const exchange = stockCode.startsWith('6') ? '上海证券交易所' :
                     stockCode.startsWith('0') ? '深圳证券交易所' :
                     stockCode.startsWith('3') ? '深圳证券交易所（创业板）' :
                     '深圳证券交易所';

    // 计算涨跌幅
    const changePercent = parseFloat(quote.changePercent);
    const change = parseFloat(quote.change);
    const isPositive = changePercent >= 0;

    // 计算振幅
    const amplitude = quote.todayHigh && quote.todayLow && quote.yesterdayClose ?
        (((quote.todayHigh - quote.todayLow) / quote.yesterdayClose) * 100).toFixed(2) : '--';

    // 计算市值（如果有成交量和价格的话，这里是估算）
    const volume = quote.volume || 0;
    const marketValue = volume > 0 ? `约 ${(quote.currentPrice * volume / 100000000).toFixed(2)} 亿元` : '数据加载中';

    return `
        <div class="company-info-section">
            <div class="info-row">
                <span class="info-label">📍 交易所：</span>
                <span class="info-value">${exchange}</span>
            </div>
            <div class="info-row">
                <span class="info-label">🏢 股票代码：</span>
                <span class="info-value">${stockCode}</span>
            </div>
            <div class="info-row">
                <span class="info-label">📊 股票名称：</span>
                <span class="info-value">${quote.stockName}</span>
            </div>
        </div>

        <div class="company-info-section">
            <div class="section-subtitle">💹 今日表现</div>
            <div class="info-row">
                <span class="info-label">开盘价：</span>
                <span class="info-value">¥${quote.todayOpen.toFixed(2)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">当前价：</span>
                <span class="info-value" style="color: ${isPositive ? '#e74c3c' : '#27ae60'}; font-weight: 700;">
                    ¥${quote.currentPrice.toFixed(2)}
                    <span style="font-size: 0.85em;">(${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)</span>
                </span>
            </div>
            <div class="info-row">
                <span class="info-label">最高价：</span>
                <span class="info-value">¥${quote.todayHigh.toFixed(2)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">最低价：</span>
                <span class="info-value">¥${quote.todayLow.toFixed(2)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">涨跌额：</span>
                <span class="info-value" style="color: ${isPositive ? '#e74c3c' : '#27ae60'};">
                    ${isPositive ? '+' : ''}¥${change.toFixed(2)}
                </span>
            </div>
            <div class="info-row">
                <span class="info-label">振幅：</span>
                <span class="info-value">${amplitude}%</span>
            </div>
        </div>

        <div class="company-info-section">
            <div class="section-subtitle">📈 市场数据</div>
            <div class="info-row">
                <span class="info-label">昨收价：</span>
                <span class="info-value">¥${quote.yesterdayClose.toFixed(2)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">成交量：</span>
                <span class="info-value">${volume > 0 ? (volume / 10000).toFixed(2) + ' 万股' : '数据加载中'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">成交额：</span>
                <span class="info-value">${quote.amount ? (quote.amount / 100000000).toFixed(2) + ' 亿元' : '数据加载中'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">流通市值：</span>
                <span class="info-value">${marketValue}</span>
            </div>
        </div>

        <div class="company-info-section">
            <div class="section-subtitle">ℹ️ 温馨提示</div>
            <p style="font-size: 0.85rem; color: #7f8c8d; line-height: 1.6; margin: 0;">
                以上数据仅供参考，投资有风险，入市需谨慎。建议您在投资前充分了解公司基本面、行业前景和市场风险。
            </p>
        </div>
    `;
}

// 获取股票详情数据
async function fetchStockDetail(stockCode, stockName) {
    const tooltipLoading = document.getElementById('tooltipLoading');
    const tooltipData = document.getElementById('tooltipData');

    try {
        // 获取股票行情数据
        const quoteResponse = await fetch(`/api/stock/quote/${stockCode}`);

        if (!quoteResponse.ok) {
            throw new Error('获取数据失败');
        }

        const quoteResult = await quoteResponse.json();

        if (!quoteResult.success) {
            throw new Error('数据解析失败');
        }

        const quote = quoteResult.data;

        // 更新股票名称（使用实时数据中的名称）
        document.getElementById('tooltipStockName').textContent = quote.stockName || stockName;

        // 构建详细的公司简介
        const companyInfo = buildCompanyInfo(quote, stockCode);
        document.getElementById('tooltipCompanyInfo').innerHTML = companyInfo;

        // 更新实时行情
        const changePercent = parseFloat(quote.changePercent);
        const isPositive = changePercent >= 0;

        document.getElementById('tooltipCurrentPrice').textContent = `¥${quote.currentPrice.toFixed(2)}`;
        document.getElementById('tooltipCurrentPrice').className = `quote-value ${isPositive ? 'positive' : 'negative'}`;

        document.getElementById('tooltipChangePercent').textContent = `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`;
        document.getElementById('tooltipChangePercent').className = `quote-value ${isPositive ? 'positive' : 'negative'}`;

        document.getElementById('tooltipHigh').textContent = `¥${quote.todayHigh.toFixed(2)}`;
        document.getElementById('tooltipLow').textContent = `¥${quote.todayLow.toFixed(2)}`;

        // 隐藏加载状态，显示数据（先显示行情数据）
        tooltipLoading.style.display = 'none';
        tooltipData.style.display = 'block';

        // 异步渲染K线图（使用通用组件）
        renderTooltipChart(stockCode);

        console.log('✅ 股票详情加载成功');

    } catch (error) {
        console.error('❌ 获取股票详情错误:', error);
        throw error;
    }
}

// 渲染悬浮框中的K线图（使用通用组件）
async function renderTooltipChart(stockCode, period = 'intraday') {
    const canvasId = 'tooltipChart';

    try {
        // 销毁旧图表
        if (currentTooltipChart) {
            stockChartManager.destroyChart(canvasId);
            currentTooltipChart = null;
        }

        // 使用通用K线图组件渲染图表
        const options = period === 'intraday' ? {
            limit: 48,  // 48个5分钟数据点
            intradayPeriod: 5  // 5分钟K线
        } : {};

        await stockChartManager.renderChart(canvasId, stockCode, period, options);

        // 保存图表实例的引用（用于后续销毁）
        currentTooltipChart = stockChartManager.chartInstances[canvasId];

        console.log(`✅ 悬浮框K线图渲染完成（${period}）`);
    } catch (error) {
        console.error('❌ 渲染悬浮框K线图失败:', error);
    }
}

// 绑定悬浮框周期切换按钮事件
function bindTooltipPeriodButtons() {
    const periodButtons = document.querySelectorAll('.tooltip-period-btn');

    periodButtons.forEach(btn => {
        // 移除之前的事件监听器（如果有）
        btn.replaceWith(btn.cloneNode(true));
    });

    // 重新获取按钮并绑定事件
    document.querySelectorAll('.tooltip-period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const period = this.getAttribute('data-period');
            switchTooltipChartPeriod(period);
        });
    });

    console.log('✅ 悬浮框周期切换按钮已绑定');
}

// 切换悬浮框图表周期
async function switchTooltipChartPeriod(period) {
    if (!currentTooltipStockCode) {
        console.error('❌ 无当前股票代码');
        return;
    }

    console.log(`🔄 切换悬浮框图表周期: ${period}`);

    // 更新按钮状态
    document.querySelectorAll('.tooltip-period-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-period') === period) {
            btn.classList.add('active');
        }
    });

    // 重新渲染图表
    await renderTooltipChart(currentTooltipStockCode, period);
}

// 初始化股票代码悬停功能
function initStockCodeHover() {
    console.log('🔍 初始化股票代码悬停功能...');

    // 为所有包含股票代码的元素添加悬停事件
    // 策略：查找所有显示股票代码的元素，为其添加 .stock-hoverable 类和事件

    // 辅助函数：为元素添加悬停事件
    const addHoverEvents = (el, stockCode, stockName) => {
        el.classList.add('stock-hoverable');

        // 鼠标进入时显示悬浮框
        el.addEventListener('mouseenter', (e) => {
            showStockTooltip(stockCode, stockName, e);
        });

        // 鼠标离开时延迟关闭悬浮框（给用户时间移动到悬浮框上）
        el.addEventListener('mouseleave', () => {
            setTimeout(() => {
                const tooltip = document.getElementById('stockDetailTooltip');
                // 检查鼠标是否在悬浮框上
                if (tooltip && !tooltip.matches(':hover')) {
                    closeStockTooltip();
                }
            }, 200);
        });
    };

    // 1. 持仓卡片中的股票代码
    document.querySelectorAll('.position-card .stock-symbol').forEach(el => {
        const stockCode = el.textContent.trim();
        const stockName = el.parentElement.querySelector('.stock-name')?.textContent.trim() || '';
        if (stockCode && /^\d{6}$/.test(stockCode)) {
            addHoverEvents(el, stockCode, stockName);
        }
    });

    // 2. 自选股列表中的股票代码
    document.querySelectorAll('.watchlist-item .stock-code').forEach(el => {
        const stockCode = el.textContent.trim();
        const stockName = el.parentElement.querySelector('.stock-name')?.textContent.trim() || '';
        if (stockCode && /^\d{6}$/.test(stockCode)) {
            addHoverEvents(el, stockCode, stockName);
        }
    });

    // 3. 行情卡片中的股票代码（提取括号中的代码）
    document.querySelectorAll('.quote-symbol').forEach(el => {
        const text = el.textContent.trim();
        const match = text.match(/\((\d{6})\)/);
        if (match) {
            const stockCode = match[1];
            const stockName = text.replace(/\(.*\)/, '').trim();
            addHoverEvents(el, stockCode, stockName);
        }
    });

    // 4. 涨跌幅榜中的股票代码
    document.querySelectorAll('.ranking-code').forEach(el => {
        const stockCode = el.textContent.trim();
        const stockName = el.parentElement.querySelector('.ranking-name')?.textContent.trim() || '';
        if (stockCode && /^\d{6}$/.test(stockCode)) {
            addHoverEvents(el, stockCode, stockName);
        }
    });

    // 5. 新闻中的股票标签
    document.querySelectorAll('.stock-tag').forEach(el => {
        const text = el.textContent.trim();
        const match = text.match(/\((\d{6})\)/);
        if (match) {
            const stockCode = match[1];
            const stockName = text.replace(/\(.*\)/, '').trim();
            addHoverEvents(el, stockCode, stockName);
        }
    });

    // 为悬浮框本身添加鼠标事件，允许用户将鼠标移到悬浮框上
    const tooltip = document.getElementById('stockDetailTooltip');
    if (tooltip) {
        // 鼠标离开悬浮框时关闭
        tooltip.addEventListener('mouseleave', () => {
            closeStockTooltip();
        });
    }

    console.log('✅ 股票代码悬停功能初始化完成');
}

// 在页面加载和内容更新时调用初始化函数
// 添加到现有的 DOMContentLoaded 事件监听器中
document.addEventListener('DOMContentLoaded', function() {
    // 延迟初始化，等待内容加载完成
    setTimeout(() => {
        initStockCodeHover();
    }, 1000);

    // 使用 MutationObserver 监听DOM变化，自动为新添加的股票代码添加悬停功能
    const observer = new MutationObserver((mutations) => {
        let shouldReinit = false;
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                shouldReinit = true;
            }
        });
        if (shouldReinit) {
            // 延迟重新初始化，避免频繁触发
            setTimeout(() => {
                initStockCodeHover();
            }, 500);
        }
    });

    // 监听整个容器的变化
    const container = document.querySelector('.container');
    if (container) {
        observer.observe(container, {
            childList: true,
            subtree: true
        });
    }
});

// 导出函数供全局使用
window.showStockTooltip = showStockTooltip;
window.closeStockTooltip = closeStockTooltip;

// ==================== 股票推荐功能 ====================

// 生成股票推荐
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

// 显示股票推荐内容
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

// 按日期加载推荐
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

// 查看推荐历史
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

// 在弹窗中查看推荐详情
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

// 关闭推荐历史模态框
function closeRecommendationHistoryModal() {
    const modal = document.getElementById('recommendationHistoryModal');
    modal.style.display = 'none';
}

// 关闭推荐详情模态框
function closeRecommendationDetailModal() {
    const modal = document.getElementById('recommendationDetailModal');
    modal.style.display = 'none';
}

// 删除推荐记录
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

// 加载今日推荐（自动加载）
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
