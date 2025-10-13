// ==================== cost-management.js ====================
// 持仓成本管理模块

// 加载所有持仓的成本汇总列表
async function loadCostManagement() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('用户未登录，跳过加载成本管理');
        document.getElementById('costManagementContent').innerHTML = `
            <div class="feature-hint">
                <div class="hint-icon">🔐</div>
                <div class="hint-content">
                    <p class="hint-title">请先登录</p>
                    <p class="hint-desc">登录后即可使用持仓成本管理功能</p>
                </div>
            </div>
        `;
        return;
    }

    try {
        const response = await fetch('/api/cost-management/summaries', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            displayCostSummaries(result.data);
        } else {
            throw new Error(result.error || '加载成本汇总失败');
        }

    } catch (error) {
        console.error('加载成本管理错误:', error);
        document.getElementById('costManagementContent').innerHTML = `
            <div class="feature-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">加载失败</p>
                    <p class="hint-desc">${error.message || '网络连接错误'}</p>
                </div>
            </div>
        `;
    }
}

// 显示成本汇总列表
function displayCostSummaries(summaries) {
    const container = document.getElementById('costManagementContent');

    if (!summaries || summaries.length === 0) {
        container.innerHTML = `
            <div class="feature-hint">
                <div class="hint-icon">📊</div>
                <div class="hint-content">
                    <p class="hint-title">暂无持仓成本数据</p>
                    <p class="hint-desc">添加买入记录后即可查看持仓成本分析</p>
                    <button class="action-btn" onclick="openAddCostRecordModal()">
                        <span>➕ 添加成本记录</span>
                    </button>
                </div>
            </div>
        `;
        return;
    }

    let html = '<div class="cost-summary-list">';

    summaries.forEach(summary => {
        const tPlusInfo = summary.unsellableQuantity > 0
            ? `<div class="t-plus-info">⏰ T+1未解锁: ${summary.unsellableQuantity}股</div>`
            : '';

        html += `
            <div class="cost-summary-card" onclick="viewCostDetail('${summary.stockCode}', '${summary.stockName}')">
                <div class="cost-header">
                    <div class="stock-info">
                        <div class="stock-code">${summary.stockCode}</div>
                        <div class="stock-name">${summary.stockName}</div>
                    </div>
                    <div class="cost-actions">
                        <button class="icon-btn" onclick="event.stopPropagation(); openAddCostRecordModal('${summary.stockCode}', '${summary.stockName}')" title="添加成本记录">
                            ➕
                        </button>
                    </div>
                </div>

                <div class="cost-stats">
                    <div class="stat-row">
                        <div class="stat-item">
                            <span class="stat-label">持仓数量</span>
                            <span class="stat-value">${summary.totalQuantity}股</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">加权成本</span>
                            <span class="stat-value highlight">¥${summary.avgCost.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="stat-row">
                        <div class="stat-item">
                            <span class="stat-label">可卖数量</span>
                            <span class="stat-value">${summary.sellableQuantity}股</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">总费用</span>
                            <span class="stat-value">¥${summary.totalFees.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                ${tPlusInfo}
            </div>
        `;
    });

    html += '</div>';

    html += `
        <div class="cost-actions-footer">
            <button class="action-btn" onclick="openAddCostRecordModal()">
                <span>➕ 添加成本记录</span>
            </button>
        </div>
    `;

    container.innerHTML = html;
}

// 查看成本详情
async function viewCostDetail(stockCode, stockName) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    try {
        // 显示模态框
        const modal = document.getElementById('costDetailModal');
        modal.style.display = 'block';

        document.getElementById('costDetailTitle').textContent = `${stockCode} ${stockName} - 成本详情`;
        document.getElementById('costDetailContent').innerHTML = '<div class="loading-text">正在加载成本详情...</div>';

        // 加载成本汇总和记录
        const [summaryResponse, recordsResponse, adjustmentsResponse] = await Promise.all([
            fetch(`/api/cost-management/summary?stockCode=${stockCode}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`/api/cost-management/records?stockCode=${stockCode}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`/api/cost-management/adjustments?stockCode=${stockCode}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        const summaryResult = await summaryResponse.json();
        const recordsResult = await recordsResponse.json();
        const adjustmentsResult = await adjustmentsResponse.json();

        if (summaryResult.success && recordsResult.success) {
            displayCostDetail(summaryResult.data, recordsResult.data, adjustmentsResult.data || []);
        } else {
            throw new Error('加载成本详情失败');
        }

    } catch (error) {
        console.error('查看成本详情错误:', error);
        document.getElementById('costDetailContent').innerHTML = `
            <div class="error-message">加载失败: ${error.message}</div>
        `;
    }
}

// 显示成本详情
function displayCostDetail(summary, records, adjustments) {
    const today = new Date().toISOString().split('T')[0];

    let html = `
        <div class="cost-detail-summary">
            <div class="summary-stats">
                <div class="stat-card">
                    <div class="stat-label">持仓总量</div>
                    <div class="stat-value">${summary.totalQuantity}股</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">加权成本</div>
                    <div class="stat-value primary">¥${summary.avgCost.toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">可卖数量</div>
                    <div class="stat-value success">${summary.sellableQuantity}股</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">T+1锁定</div>
                    <div class="stat-value warning">${summary.unsellableQuantity}股</div>
                </div>
            </div>
        </div>

        <div class="cost-detail-section">
            <h3 class="section-title">💰 成本记录</h3>
            <div class="cost-records-table">
                <table>
                    <thead>
                        <tr>
                            <th>日期</th>
                            <th>类型</th>
                            <th>数量</th>
                            <th>价格</th>
                            <th>金额</th>
                            <th>费用</th>
                            <th>剩余</th>
                            <th>T+N</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    records.forEach(record => {
        const operationType = record.operation_type === 'buy' ? '买入' : '卖出';
        const typeClass = record.operation_type === 'buy' ? 'buy-type' : 'sell-type';
        const isSellable = record.t_plus_n_date <= today;
        const tPlusStatus = isSellable ? '✅ 可卖' : `⏰ ${record.t_plus_n_date}`;
        const tPlusClass = isSellable ? 'sellable' : 'unsellable';

        html += `
            <tr>
                <td>${record.operation_date}</td>
                <td><span class="type-badge ${typeClass}">${operationType}</span></td>
                <td>${record.quantity}股</td>
                <td>¥${record.price.toFixed(2)}</td>
                <td>¥${record.amount.toFixed(2)}</td>
                <td>¥${record.total_fee.toFixed(2)}</td>
                <td>${record.remaining_quantity}股</td>
                <td><span class="t-plus-badge ${tPlusClass}">${tPlusStatus}</span></td>
                <td>
                    <button class="icon-btn-small" onclick="deleteCostRecord(${record.id})" title="删除">🗑️</button>
                </td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // 显示调整记录
    if (adjustments && adjustments.length > 0) {
        html += `
            <div class="cost-detail-section">
                <h3 class="section-title">📋 调整记录</h3>
                <div class="adjustments-list">
        `;

        adjustments.forEach(adj => {
            html += `
                <div class="adjustment-card">
                    <div class="adjustment-header">
                        <span class="adjustment-date">${adj.adjustment_date}</span>
                        <span class="adjustment-type">${getAdjustmentTypeName(adj.adjustment_type)}</span>
                    </div>
                    <div class="adjustment-description">${adj.description}</div>
                    <div class="adjustment-stats">
                        <span>调整前: ${adj.quantity_before}股 @¥${adj.cost_before.toFixed(2)}</span>
                        <span>→</span>
                        <span>调整后: ${adj.quantity_after}股 @¥${adj.cost_after.toFixed(2)}</span>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    }

    document.getElementById('costDetailContent').innerHTML = html;
}

// 获取调整类型名称
function getAdjustmentTypeName(type) {
    const typeMap = {
        'dividend': '📤 分红',
        'bonus': '🎁 送股',
        'rights': '🔄 配股'
    };
    return typeMap[type] || type;
}

// 关闭成本详情模态框
function closeCostDetailModal() {
    const modal = document.getElementById('costDetailModal');
    modal.style.display = 'none';
}

// 打开添加成本记录模态框
function openAddCostRecordModal(stockCode = '', stockName = '') {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    const modal = document.getElementById('addCostRecordModal');
    modal.style.display = 'block';

    // 重置表单
    document.getElementById('addCostRecordForm').reset();
    document.getElementById('costRecordFormStatus').textContent = '';

    // 填充股票信息（如果提供）
    if (stockCode) {
        document.getElementById('costRecordStockCode').value = stockCode;
        document.getElementById('costRecordStockName').value = stockName;
    }

    // 设置默认日期为今天
    document.getElementById('costRecordOperationDate').value = new Date().toISOString().split('T')[0];

    // 绑定自动计算
    bindCostRecordAutoCalculate();
}

// 关闭添加成本记录模态框
function closeAddCostRecordModal() {
    const modal = document.getElementById('addCostRecordModal');
    modal.style.display = 'none';
}

// 绑定成本记录自动计算
function bindCostRecordAutoCalculate() {
    const quantityInput = document.getElementById('costRecordQuantity');
    const priceInput = document.getElementById('costRecordPrice');
    const amountDisplay = document.getElementById('costRecordAmount');

    const calculateAmount = () => {
        const quantity = parseFloat(quantityInput.value) || 0;
        const price = parseFloat(priceInput.value) || 0;
        const amount = quantity * price;
        amountDisplay.value = amount.toFixed(2);
    };

    quantityInput.addEventListener('input', calculateAmount);
    priceInput.addEventListener('input', calculateAmount);
}

// 提交成本记录
async function submitCostRecord() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    const stockCode = document.getElementById('costRecordStockCode').value.trim();
    const stockName = document.getElementById('costRecordStockName').value.trim();
    const operationType = document.getElementById('costRecordOperationType').value;
    const operationDate = document.getElementById('costRecordOperationDate').value;
    const quantity = document.getElementById('costRecordQuantity').value.trim();
    const price = document.getElementById('costRecordPrice').value.trim();
    const notes = document.getElementById('costRecordNotes').value.trim();

    const statusDiv = document.getElementById('costRecordFormStatus');

    // 验证
    if (!stockCode || !stockName || !operationType || !operationDate || !quantity || !price) {
        statusDiv.textContent = '❌ 请填写所有必填字段';
        statusDiv.className = 'form-status error';
        return;
    }

    if (parseFloat(quantity) <= 0 || parseFloat(price) <= 0) {
        statusDiv.textContent = '❌ 数量和价格必须大于0';
        statusDiv.className = 'form-status error';
        return;
    }

    statusDiv.textContent = '⏳ 正在保存...';
    statusDiv.className = 'form-status info';

    try {
        const response = await fetch('/api/cost-management/records', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                stockCode,
                stockName,
                operationType,
                operationDate,
                quantity: parseFloat(quantity),
                price: parseFloat(price),
                notes: notes || null
            })
        });

        const result = await response.json();

        if (result.success) {
            statusDiv.textContent = '✅ 成本记录添加成功！';
            statusDiv.className = 'form-status success';

            showNotification('成本记录添加成功', 'success');

            // 刷新成本管理列表
            loadCostManagement();

            setTimeout(() => {
                closeAddCostRecordModal();
            }, 1500);
        } else {
            throw new Error(result.error || '添加失败');
        }

    } catch (error) {
        console.error('添加成本记录错误:', error);
        statusDiv.textContent = `❌ ${error.message}`;
        statusDiv.className = 'form-status error';
    }
}

// 删除成本记录
async function deleteCostRecord(recordId) {
    if (!confirm('确定要删除这条成本记录吗？')) {
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    try {
        const response = await fetch(`/api/cost-management/records/${recordId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            showNotification('成本记录删除成功', 'success');

            // 刷新详情页
            const modal = document.getElementById('costDetailModal');
            if (modal.style.display === 'block') {
                const title = document.getElementById('costDetailTitle').textContent;
                const match = title.match(/(\d{6})\s+(.+?)\s+-/);
                if (match) {
                    viewCostDetail(match[1], match[2]);
                }
            }

            // 刷新列表
            loadCostManagement();
        } else {
            throw new Error(result.error || '删除失败');
        }

    } catch (error) {
        console.error('删除成本记录错误:', error);
        alert(`删除失败: ${error.message}`);
    }
}

// 打开成本调整模态框
function openCostAdjustmentModal(stockCode = '', stockName = '') {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    const modal = document.getElementById('costAdjustmentModal');
    modal.style.display = 'block';

    // 重置表单
    document.getElementById('costAdjustmentForm').reset();
    document.getElementById('adjustmentFormStatus').textContent = '';

    // 填充股票信息
    if (stockCode) {
        document.getElementById('adjustmentStockCode').value = stockCode;
        document.getElementById('adjustmentStockName').value = stockName;
    }

    // 设置默认日期
    document.getElementById('adjustmentDate').value = new Date().toISOString().split('T')[0];

    // 绑定调整类型变化事件
    bindAdjustmentTypeChange();
}

// 关闭成本调整模态框
function closeCostAdjustmentModal() {
    const modal = document.getElementById('costAdjustmentModal');
    modal.style.display = 'none';
}

// 绑定调整类型变化
function bindAdjustmentTypeChange() {
    const typeSelect = document.getElementById('adjustmentType');
    const dividendField = document.getElementById('dividendField');
    const bonusField = document.getElementById('bonusField');
    const rightsFields = document.getElementById('rightsFields');

    typeSelect.addEventListener('change', () => {
        // 隐藏所有字段
        dividendField.style.display = 'none';
        bonusField.style.display = 'none';
        rightsFields.style.display = 'none';

        // 显示对应字段
        const type = typeSelect.value;
        if (type === 'dividend') {
            dividendField.style.display = 'block';
        } else if (type === 'bonus') {
            bonusField.style.display = 'block';
        } else if (type === 'rights') {
            rightsFields.style.display = 'block';
        }
    });

    // 触发一次change事件
    typeSelect.dispatchEvent(new Event('change'));
}

// 提交成本调整
async function submitCostAdjustment() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    const stockCode = document.getElementById('adjustmentStockCode').value.trim();
    const stockName = document.getElementById('adjustmentStockName').value.trim();
    const adjustmentType = document.getElementById('adjustmentType').value;
    const adjustmentDate = document.getElementById('adjustmentDate').value;
    const dividendAmount = document.getElementById('dividendAmount').value.trim();
    const bonusShares = document.getElementById('bonusShares').value.trim();
    const rightsShares = document.getElementById('rightsShares').value.trim();
    const rightsPrice = document.getElementById('rightsPrice').value.trim();

    const statusDiv = document.getElementById('adjustmentFormStatus');

    // 验证
    if (!stockCode || !stockName || !adjustmentType || !adjustmentDate) {
        statusDiv.textContent = '❌ 请填写所有必填字段';
        statusDiv.className = 'form-status error';
        return;
    }

    statusDiv.textContent = '⏳ 正在保存...';
    statusDiv.className = 'form-status info';

    try {
        const response = await fetch('/api/cost-management/adjustments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                stockCode,
                stockName,
                adjustmentType,
                adjustmentDate,
                dividendAmount: dividendAmount ? parseFloat(dividendAmount) : 0,
                bonusShares: bonusShares ? parseFloat(bonusShares) : 0,
                rightsShares: rightsShares ? parseFloat(rightsShares) : 0,
                rightsPrice: rightsPrice ? parseFloat(rightsPrice) : 0
            })
        });

        const result = await response.json();

        if (result.success) {
            statusDiv.textContent = '✅ 成本调整成功！';
            statusDiv.className = 'form-status success';

            showNotification('成本调整成功', 'success');

            // 刷新
            loadCostManagement();

            setTimeout(() => {
                closeCostAdjustmentModal();
            }, 1500);
        } else {
            throw new Error(result.error || '调整失败');
        }

    } catch (error) {
        console.error('成本调整错误:', error);
        statusDiv.textContent = `❌ ${error.message}`;
        statusDiv.className = 'form-status error';
    }
}
