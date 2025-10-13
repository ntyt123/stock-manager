// ==================== position-manager.js ====================
// 自动生成的模块文件

// openExcelUploadModal
function openExcelUploadModal() {
    const modal = document.getElementById('excelUploadModal');
    modal.style.display = 'block';
    
    // 清空上传状态
    clearUploadStatus();
    
    // 重新绑定拖拽事件（确保模态框显示后事件绑定正确）
    initExcelUpload();
}

// closeExcelUploadModal
function closeExcelUploadModal() {
    const modal = document.getElementById('excelUploadModal');
    modal.style.display = 'none';
    
    // 清空上传状态
    clearUploadStatus();
}

// clearUploadStatus
function clearUploadStatus() {
    const uploadStatus = document.getElementById('uploadStatus');
    uploadStatus.textContent = '';
    uploadStatus.className = 'upload-status';
    
    // 清空文件输入
    const fileInput = document.getElementById('excelFileInput');
    fileInput.value = '';
}

// initExcelUpload
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

// handleExcelFile
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

                // 自动刷新持仓列表
                loadUserPositions();

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

// showUploadStatus
function showUploadStatus(message, type) {
    const statusDiv = document.getElementById('uploadStatus');
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    statusDiv.className = `upload-status ${type}`;
    statusDiv.style.display = 'block';
}

// clearUploadedData
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

// displayUploadedPositions
async function displayUploadedPositions(positions, summary = null) {
    const container = document.getElementById('uploadedPositions');
    const totalValueEl = document.getElementById('uploadedTotalValue');
    const profitLossEl = document.getElementById('uploadedProfitLoss');
    const totalCapitalEl = document.getElementById('positionTotalCapital');
    const positionRatioEl = document.getElementById('positionRatio');

    if (!container || !totalValueEl || !profitLossEl) return;

    // 等待 CapitalManager 初始化完成（最多等待3秒）
    console.log('📊 [displayUploadedPositions] 开始等待 CapitalManager 初始化...');
    let totalCapital = 0;
    if (window.CapitalManager) {
        let waitCount = 0;
        console.log(`📊 [displayUploadedPositions] CapitalManager.initialized = ${window.CapitalManager.initialized}`);
        while (!window.CapitalManager.initialized && waitCount < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            waitCount++;
            if (waitCount % 5 === 0) {
                console.log(`📊 [displayUploadedPositions] 等待中... ${waitCount * 100}ms`);
            }
        }
        console.log(`📊 [displayUploadedPositions] 等待结束，waitCount = ${waitCount}`);
        totalCapital = window.CapitalManager.getTotalCapital();
        console.log(`📊 [displayUploadedPositions] 获取到总资金: ¥${totalCapital}`);
    } else {
        console.warn('⚠️ [displayUploadedPositions] window.CapitalManager 不存在！');
    }
    
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
    totalValueEl.textContent = `¥${totalMarketValue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    profitLossEl.textContent = `¥${totalProfitLoss.toFixed(2)} (${profitLossRate}%)`;

    // 更新总资金和仓位占比
    if (totalCapitalEl) {
        totalCapitalEl.textContent = `¥${totalCapital.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    if (positionRatioEl && totalCapital > 0) {
        const ratio = (totalMarketValue / totalCapital * 100).toFixed(2);
        positionRatioEl.textContent = `${ratio}%`;

        // 根据仓位比例设置颜色
        if (ratio > 90) {
            positionRatioEl.style.color = '#ef4444'; // 红色 - 满仓
        } else if (ratio > 70) {
            positionRatioEl.style.color = '#f59e0b'; // 橙色 - 重仓
        } else if (ratio > 50) {
            positionRatioEl.style.color = '#10b981'; // 绿色 - 半仓
        } else {
            positionRatioEl.style.color = '#3b82f6'; // 蓝色 - 轻仓
        }
    } else if (positionRatioEl) {
        positionRatioEl.textContent = '0%';
        positionRatioEl.style.color = 'white';
    }

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
                    <button class="create-plan-btn" onclick="createTradingPlanFromStock('${position.stockCode}', '${position.stockName}', ${parseFloat(position.currentPrice)}, 'sell')">📋 制定卖出计划</button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// loadUserPositions
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

// displayEBSCNPositions
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
                    <button class="create-plan-btn" onclick="createTradingPlanFromStock('${position.stockCode}', '${position.stockName}', ${parseFloat(position.currentPrice)}, 'sell')">📋 制定卖出计划</button>
                </div>
            </div>
        `;
    }).join('');
}

// openManualPositionModal
function openManualPositionModal() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再使用此功能');
        return;
    }

    const modal = document.getElementById('manualPositionModal');
    modal.style.display = 'block';

    // 清空表单
    document.getElementById('manualPositionForm').reset();
    document.getElementById('positionFormStatus').textContent = '';
    document.getElementById('positionFormStatus').className = 'form-status';

    // 绑定股票代码自动获取名称功能
    bindStockCodeAutoFill('posStockCode', 'posStockName');

    console.log('📝 打开手动持仓录入模态框');
}

// closeManualPositionModal
function closeManualPositionModal() {
    const modal = document.getElementById('manualPositionModal');
    modal.style.display = 'none';

    // 清空表单
    document.getElementById('manualPositionForm').reset();
    document.getElementById('positionFormStatus').textContent = '';

    console.log('📝 关闭手动持仓录入模态框');
}

// submitManualPosition
async function submitManualPosition() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    // 获取表单数据
    const stockCode = document.getElementById('posStockCode').value.trim();
    const stockName = document.getElementById('posStockName').value.trim();
    const quantity = document.getElementById('posQuantity').value.trim();
    const costPrice = document.getElementById('posCostPrice').value.trim();
    const buyDate = document.getElementById('posBuyDate').value.trim();
    const currentPrice = document.getElementById('posCurrentPrice').value.trim();
    const notes = document.getElementById('posNotes').value.trim();

    const statusDiv = document.getElementById('positionFormStatus');

    // 验证必填字段
    if (!stockCode || !stockName || !quantity || !costPrice || !buyDate) {
        statusDiv.textContent = '❌ 请填写所有必填字段';
        statusDiv.className = 'form-status error';
        return;
    }

    // 验证股票代码格式
    if (!/^[0-9]{6}$/.test(stockCode)) {
        statusDiv.textContent = '❌ 请输入正确的6位股票代码';
        statusDiv.className = 'form-status error';
        return;
    }

    // 验证数量和价格
    if (parseFloat(quantity) <= 0 || parseFloat(costPrice) <= 0) {
        statusDiv.textContent = '❌ 数量和成本价必须大于0';
        statusDiv.className = 'form-status error';
        return;
    }

    console.log('💾 正在保存手动持仓...');

    // 显示加载状态
    statusDiv.textContent = '⏳ 正在保存...';
    statusDiv.className = 'form-status info';

    try {
        const response = await fetch('/api/manual-positions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                stockCode,
                stockName,
                quantity: parseFloat(quantity),
                costPrice: parseFloat(costPrice),
                buyDate,
                currentPrice: currentPrice ? parseFloat(currentPrice) : null,
                notes: notes || null
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ 手动持仓保存成功');
            statusDiv.textContent = '✅ 持仓保存成功！';
            statusDiv.className = 'form-status success';

            showNotification('持仓添加成功', 'success');

            // 自动刷新持仓列表
            loadUserPositions();

            // 延迟关闭模态框
            setTimeout(() => {
                closeManualPositionModal();
            }, 1500);
        } else {
            throw new Error(result.error || '保存失败');
        }

    } catch (error) {
        console.error('❌ 保存手动持仓错误:', error);
        statusDiv.textContent = `❌ ${error.message || '保存失败，请重试'}`;
        statusDiv.className = 'form-status error';
    }
}

// ==================== 刷新持仓显示（用于总资金更新后） ====================
async function refreshPositionsDisplay() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch('/api/positions', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data.positions && result.data.positions.length > 0) {
                // 重新显示持仓数据（会自动使用最新的总资金计算仓位）
                displayUploadedPositions(result.data.positions, result.data.summary);
                console.log('✅ 持仓显示已刷新');
            }
        }
    } catch (error) {
        console.error('刷新持仓显示失败:', error);
    }
}

// ==================== 监听总资金更新事件 ====================
document.addEventListener('capitalUpdated', (event) => {
    console.log('💰 检测到总资金更新，刷新持仓数据...', event.detail);

    // 重新加载持仓数据以更新仓位占比
    const uploadedPositionsContainer = document.getElementById('uploadedPositions');
    if (uploadedPositionsContainer && uploadedPositionsContainer.querySelector('.positions-list')) {
        // 如果已经有持仓数据，重新刷新显示
        refreshPositionsDisplay();
    }
});

