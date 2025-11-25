// ==================== trade-manager.js ====================
// 自动生成的模块文件

// openTradeRecordModal
function openTradeRecordModal() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再使用此功能');
        return;
    }

    const modal = document.getElementById('tradeRecordModal');
    if (!modal) {
        console.error('❌ 找不到tradeRecordModal元素');
        alert('模态框元素未找到，请刷新页面重试');
        return;
    }

    // 将模态框移动到body最外层，避免被父元素的display:none影响
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    // 强制设置显示样式
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.position = 'fixed';
    modal.style.zIndex = '10000';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

    // 确保模态框内容也可见
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.display = 'block';
        modalContent.style.position = 'relative';
    }

    // 清空表单
    document.getElementById('tradeRecordForm').reset();
    document.getElementById('tradeFormStatus').textContent = '';
    document.getElementById('tradeFormStatus').className = 'form-status';

    // 设置交易时间默认为当前时间（精确到秒）
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    document.getElementById('tradeDate').value = currentDateTime;

    // 绑定实时计算事件
    bindTradeAmountCalculation();

    // 绑定股票代码自动获取名称功能
    bindStockCodeAutoFill('tradeStockCode', 'tradeStockName');

    console.log('📝 打开交易记录录入模态框, display:', modal.style.display);
}

// closeTradeRecordModal
function closeTradeRecordModal() {
    const modal = document.getElementById('tradeRecordModal');
    modal.style.display = 'none';

    // 清空表单
    document.getElementById('tradeRecordForm').reset();
    document.getElementById('tradeFormStatus').textContent = '';

    console.log('📝 关闭交易记录录入模态框');
}

// bindTradeAmountCalculation
function bindTradeAmountCalculation() {
    // 获取默认手续费率
    const getDefaultFeeRate = () => {
        if (window.SettingsManager) {
            const settings = window.SettingsManager.getSettings();
            return settings.feeRate || 0.0003;
        }
        return 0.0003; // 默认万三
    };

    // 计算手续费函数（符合A股交易规则）
    const calculateFee = () => {
        const tradeType = document.getElementById('tradeType');
        const quantity = document.getElementById('tradeQuantity');
        const price = document.getElementById('tradePrice');
        const fee = document.getElementById('tradeFee');

        const type = tradeType.value;
        const qty = parseFloat(quantity.value) || 0;
        const prc = parseFloat(price.value) || 0;

        if (qty > 0 && prc > 0) {
            const feeRate = getDefaultFeeRate(); // 佣金费率（默认万三）
            const tradeAmount = qty * prc; // 交易金额

            let totalFee = 0;

            // 1. 佣金（买卖都有，最低5元）
            let commission = tradeAmount * feeRate;
            if (commission < 5) {
                commission = 5; // 佣金不足5元按5元收取
            }
            totalFee += commission;

            // 2. 印花税（仅卖出收取，千分之一）
            if (type === 'sell' || type === 'reduce') {
                const stampDuty = tradeAmount * 0.001; // 印花税千分之一
                totalFee += stampDuty;
                console.log(`💰 手续费明细: 佣金${commission.toFixed(2)}元 + 印花税${stampDuty.toFixed(2)}元 = ${totalFee.toFixed(2)}元`);
            } else {
                console.log(`💰 手续费明细: 佣金${commission.toFixed(2)}元`);
            }

            fee.value = totalFee.toFixed(2);
        }
    };

    // 计算金额函数
    const calculateAmount = () => {
        const tradeType = document.getElementById('tradeType');
        const quantity = document.getElementById('tradeQuantity');
        const price = document.getElementById('tradePrice');
        const fee = document.getElementById('tradeFee');
        const amount = document.getElementById('tradeAmount');

        const type = tradeType.value;
        const qty = parseFloat(quantity.value) || 0;
        const prc = parseFloat(price.value) || 0;
        const feeAmount = parseFloat(fee.value) || 0;

        if (qty > 0 && prc > 0) {
            let totalAmount;
            if (type === 'buy' || type === 'add') {
                // 买入/加仓: 总成本 = 金额 + 手续费
                totalAmount = (qty * prc) + feeAmount;
            } else if (type === 'sell' || type === 'reduce') {
                // 卖出/减仓: 实际收入 = 金额 - 手续费
                totalAmount = (qty * prc) - feeAmount;
            } else {
                totalAmount = qty * prc;
            }

            amount.value = totalAmount.toFixed(2);
        } else {
            amount.value = '';
        }
    };

    // 绑定事件（使用事件委托，避免重复绑定）
    const tradeType = document.getElementById('tradeType');
    const quantity = document.getElementById('tradeQuantity');
    const price = document.getElementById('tradePrice');
    const fee = document.getElementById('tradeFee');

    // 移除旧的事件监听器（如果存在）
    tradeType.removeEventListener('change', tradeType._calcHandler);
    quantity.removeEventListener('input', quantity._calcHandler);
    price.removeEventListener('input', price._calcHandler);
    fee.removeEventListener('input', fee._calcHandler);

    // 定义新的事件处理器并保存引用
    tradeType._calcHandler = () => {
        calculateFee();
        calculateAmount();
    };
    quantity._calcHandler = () => {
        calculateFee();
        calculateAmount();
    };
    price._calcHandler = () => {
        calculateFee();
        calculateAmount();
    };
    fee._calcHandler = calculateAmount;

    // 添加事件监听器
    tradeType.addEventListener('change', tradeType._calcHandler);
    quantity.addEventListener('input', quantity._calcHandler);
    price.addEventListener('input', price._calcHandler);
    fee.addEventListener('input', fee._calcHandler);

    console.log('🔢 交易金额和手续费自动计算已绑定');
}

// submitTradeRecord
async function submitTradeRecord() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    // 获取表单数据
    const tradeType = document.getElementById('tradeType').value;
    const tradeDate = document.getElementById('tradeDate').value.trim();
    const stockCode = document.getElementById('tradeStockCode').value.trim();
    const stockName = document.getElementById('tradeStockName').value.trim();
    const quantity = document.getElementById('tradeQuantity').value.trim();
    const price = document.getElementById('tradePrice').value.trim();
    const fee = document.getElementById('tradeFee').value.trim() || '0';
    const notes = document.getElementById('tradeNotes').value.trim();

    const statusDiv = document.getElementById('tradeFormStatus');

    // 验证必填字段（逐个检查并给出明确提示）
    if (!tradeType) {
        statusDiv.textContent = '❌ 请选择交易类型（买入/卖出/加仓/减仓）';
        statusDiv.className = 'form-status error';
        return;
    }
    if (!tradeDate) {
        statusDiv.textContent = '❌ 请选择交易日期';
        statusDiv.className = 'form-status error';
        return;
    }
    if (!stockCode) {
        statusDiv.textContent = '❌ 请输入股票代码';
        statusDiv.className = 'form-status error';
        return;
    }
    if (!stockName) {
        statusDiv.textContent = '❌ 请输入股票名称';
        statusDiv.className = 'form-status error';
        return;
    }
    if (!quantity) {
        statusDiv.textContent = '❌ 请输入交易数量';
        statusDiv.className = 'form-status error';
        return;
    }
    if (!price) {
        statusDiv.textContent = '❌ 请输入交易价格';
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
    if (parseFloat(quantity) <= 0 || parseFloat(price) <= 0) {
        statusDiv.textContent = '❌ 数量和价格必须大于0';
        statusDiv.className = 'form-status error';
        return;
    }

    console.log('💾 正在保存交易记录...');

    // 显示加载状态
    statusDiv.textContent = '⏳ 正在保存...';
    statusDiv.className = 'form-status info';

    try {
        const response = await fetch('/api/trade-operations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                tradeType,
                tradeDate,
                stockCode,
                stockName,
                quantity: parseFloat(quantity),
                price: parseFloat(price),
                fee: parseFloat(fee),
                notes: notes || null
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ 交易记录保存成功');
            statusDiv.textContent = '✅ 交易记录保存成功！';
            statusDiv.className = 'form-status success';

            showNotification('交易记录添加成功', 'success');

            // 刷新持仓数据（如果函数存在）
            if (typeof window.refreshPositionsDisplay === 'function') {
                console.log('🔄 自动刷新持仓数据...');
                window.refreshPositionsDisplay();
            }

            // 刷新自选股列表（如果是买入新股票，会自动加入自选）
            if (typeof loadWatchlist === 'function') {
                console.log('🔄 自动刷新自选股列表...');
                setTimeout(() => {
                    loadWatchlist();
                    if (typeof loadWatchlistQuotes === 'function') {
                        loadWatchlistQuotes();
                    }
                }, 500); // 延迟500ms，确保后端同步完成
            }

            // 延迟关闭模态框
            setTimeout(() => {
                closeTradeRecordModal();
            }, 1500);
        } else {
            throw new Error(result.error || '保存失败');
        }

    } catch (error) {
        console.error('❌ 保存交易记录错误:', error);
        statusDiv.textContent = `❌ ${error.message || '保存失败，请重试'}`;
        statusDiv.className = 'form-status error';
    }
}

// viewTradeHistory
async function viewTradeHistory() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再查看交易历史');
        return;
    }

    const modal = document.getElementById('tradeHistoryModal');
    const content = document.getElementById('tradeHistoryContent');

    if (!modal) {
        console.error('❌ 找不到tradeHistoryModal元素');
        alert('模态框元素未找到，请刷新页面重试');
        return;
    }

    // 将模态框移动到body最外层，避免被父元素的display:none影响
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    // 强制设置显示样式
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.position = 'fixed';
    modal.style.zIndex = '10000';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

    // 确保模态框内容也可见
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.display = 'block';
        modalContent.style.position = 'relative';
    }

    content.innerHTML = '<div class="loading-text">正在加载交易历史...</div>';

    console.log('📊 开始加载交易历史, display:', modal.style.display);

    try {
        const response = await fetch('/api/trade-operations', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        console.log('API响应:', result);

        if (result.success) {
            if (result.data && result.data.length > 0) {
                const operations = result.data;
                console.log(`✅ 成功加载 ${operations.length} 条交易记录`);

            // 按交易类型分类
            const tradeTypeMap = {
                'buy': '买入',
                'sell': '卖出',
                'add': '加仓',
                'reduce': '减仓'
            };

            const tradeTypeClass = {
                'buy': 'trade-buy',
                'sell': 'trade-sell',
                'add': 'trade-add',
                'reduce': 'trade-reduce'
            };

            let html = '<div class="trade-history-list">';

            operations.forEach(op => {
                const date = new Date(op.trade_date);
                const dateStr = date.toLocaleDateString('zh-CN');
                const typeLabel = tradeTypeMap[op.trade_type] || op.trade_type;
                const typeClass = tradeTypeClass[op.trade_type] || '';

                html += `
                    <div class="trade-history-item ${typeClass}">
                        <div class="trade-item-header">
                            <div class="trade-item-title">
                                <span class="trade-type-badge">${typeLabel}</span>
                                <span class="trade-stock">${op.stock_name} (${op.stock_code})</span>
                            </div>
                            <div class="trade-item-date">${dateStr}</div>
                        </div>
                        <div class="trade-item-details">
                            <div class="trade-detail-row">
                                <span class="trade-label">数量：</span>
                                <span class="trade-value">${op.quantity}股</span>
                            </div>
                            <div class="trade-detail-row">
                                <span class="trade-label">价格：</span>
                                <span class="trade-value">¥${parseFloat(op.price).toFixed(2)}</span>
                            </div>
                            <div class="trade-detail-row">
                                <span class="trade-label">手续费：</span>
                                <span class="trade-value">¥${parseFloat(op.fee).toFixed(2)}</span>
                            </div>
                            <div class="trade-detail-row">
                                <span class="trade-label">金额：</span>
                                <span class="trade-value trade-amount">¥${parseFloat(op.amount).toFixed(2)}</span>
                            </div>
                            ${op.notes ? `
                                <div class="trade-detail-row trade-notes">
                                    <span class="trade-label">备注：</span>
                                    <span class="trade-value">${op.notes}</span>
                                </div>
                            ` : ''}
                        </div>
                        <button class="trade-delete-btn" onclick="deleteTradeOperation(${op.id})" title="删除记录">🗑️ 删除</button>
                    </div>
                `;
            });

                html += '</div>';
                content.innerHTML = html;
            } else {
                // 成功但没有数据
                console.log('✅ 加载成功，但没有交易记录');
                content.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: #999;">
                        <div style="font-size: 64px; margin-bottom: 16px;">📭</div>
                        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #666;">暂无交易记录</div>
                        <div style="font-size: 14px;">点击"记录交易"按钮开始记录您的交易</div>
                    </div>
                `;
            }
        } else {
            // API返回失败
            console.error('❌ API返回失败:', result.error);
            content.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #999;">
                    <div style="font-size: 64px; margin-bottom: 16px;">❌</div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #f44336;">加载失败</div>
                    <div style="font-size: 14px;">${result.error || '获取交易历史失败，请重试'}</div>
                </div>
            `;
        }

    } catch (error) {
        console.error('❌ 加载交易历史错误:', error);
        content.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #999;">
                <div style="font-size: 64px; margin-bottom: 16px;">⚠️</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #ff9800;">网络错误</div>
                <div style="font-size: 14px;">无法连接到服务器，请检查网络连接后重试</div>
            </div>
        `;
    }
}

// closeTradeHistoryModal
function closeTradeHistoryModal() {
    const modal = document.getElementById('tradeHistoryModal');
    modal.style.display = 'none';
}

// deleteTradeOperation
async function deleteTradeOperation(operationId) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录');
        return;
    }

    if (!confirm('确定要删除这条交易记录吗？此操作不可恢复。')) {
        return;
    }

    console.log(`🗑️ 正在删除交易记录 ID: ${operationId}`);

    try {
        const response = await fetch(`/api/trade-operations/${operationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ 交易记录删除成功');
            showNotification('交易记录删除成功', 'success');

            // 刷新交易历史列表
            viewTradeHistory();
        } else {
            throw new Error(result.error || '删除失败');
        }

    } catch (error) {
        console.error('❌ 删除交易记录错误:', error);
        showNotification('删除记录失败: ' + error.message, 'error');
    }
}

// bindStockCodeAutoFill
function bindStockCodeAutoFill(codeInputId, nameInputId) {
    const codeInput = document.getElementById(codeInputId);
    const nameInput = document.getElementById(nameInputId);

    if (!codeInput || !nameInput) {
        console.error('❌ 未找到股票代码或名称输入框');
        return;
    }

    // 移除旧的事件监听器
    const newCodeInput = codeInput.cloneNode(true);
    codeInput.parentNode.replaceChild(newCodeInput, codeInput);

    // 重新获取元素并绑定事件
    const stockCodeInput = document.getElementById(codeInputId);
    const stockNameInput = document.getElementById(nameInputId);

    // 创建加载提示元素（如果不存在）
    let loadingHint = stockNameInput.parentElement.querySelector('.stock-name-loading');
    if (!loadingHint) {
        loadingHint = document.createElement('span');
        loadingHint.className = 'stock-name-loading';
        loadingHint.style.display = 'none';
        loadingHint.style.fontSize = '0.85rem';
        loadingHint.style.color = '#3498db';
        loadingHint.style.marginLeft = '10px';
        stockNameInput.parentElement.appendChild(loadingHint);
    }

    // 监听股票代码输入
    stockCodeInput.addEventListener('input', async function() {
        const stockCode = this.value.trim();

        // 检查是否为6位数字
        if (!/^\d{6}$/.test(stockCode)) {
            // 清空名称和提示
            loadingHint.style.display = 'none';
            return;
        }

        console.log(`🔍 正在获取股票 ${stockCode} 的名称...`);

        // 显示加载状态
        loadingHint.textContent = '⏳ 获取中...';
        loadingHint.style.display = 'inline';
        loadingHint.style.color = '#3498db';

        try {
            // 调用股票行情API获取股票信息
            const response = await fetch(`/api/stock/quote/${stockCode}`);
            const result = await response.json();

            if (result.success && result.data && result.data.stockName) {
                const stockName = result.data.stockName;

                // 自动填充股票名称
                stockNameInput.value = stockName;

                // 显示成功提示
                loadingHint.textContent = '✅ 已获取';
                loadingHint.style.color = '#27ae60';

                console.log(`✅ 成功获取股票名称: ${stockCode} - ${stockName}`);

                // 2秒后隐藏提示
                setTimeout(() => {
                    loadingHint.style.display = 'none';
                }, 2000);
            } else {
                throw new Error('未找到该股票信息');
            }

        } catch (error) {
            console.error('❌ 获取股票名称失败:', error);

            // 显示错误提示
            loadingHint.textContent = '❌ 未找到';
            loadingHint.style.color = '#e74c3c';

            // 3秒后隐藏提示
            setTimeout(() => {
                loadingHint.style.display = 'none';
            }, 3000);
        }
    });

    console.log(`✅ 股票代码自动填充已绑定 (${codeInputId} → ${nameInputId})`);
}


// ==================== 导出全局函数 ====================
window.openTradeRecordModal = openTradeRecordModal;
window.viewTradeHistory = viewTradeHistory;
