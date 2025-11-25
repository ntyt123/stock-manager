// ==================== 通用函数 ====================
function showMessage(message, type = 'info') {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
    `;

    const colors = {
        info: { bg: '#3b82f6', icon: 'ℹ️' },
        success: { bg: '#10b981', icon: '✅' },
        error: { bg: '#ef4444', icon: '❌' },
        warning: { bg: '#f59e0b', icon: '⚠️' }
    };

    const color = colors[type] || colors.info;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        padding: 32px;
        max-width: 400px;
        text-align: center;
        animation: slideUp 0.3s ease-out;
    `;

    dialog.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">${color.icon}</div>
        <div style="font-size: 16px; color: #374151; margin-bottom: 24px;">${message}</div>
        <button style="
            padding: 10px 24px;
            border: none;
            background: ${color.bg};
            color: white;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
        " onclick="this.closest('div[style*=fixed]').remove()">确定</button>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.onclick = (e) => {
        if (e.target === overlay && overlay.parentNode) {
            document.body.removeChild(overlay);
        }
    };

    setTimeout(() => {
        if (overlay.parentNode) {
            document.body.removeChild(overlay);
        }
    }, 3000);
}

// ==================== 三日选股法 ====================
const ThreeDaySelection = {
    stocks: [],

    async init() {
        console.log('初始化三日选股法...');
        this.initGuideState();
        await this.loadCriteriaSettings();
        await this.loadData();
        this.render();
        this.bindEvents();
    },

    async loadData() {
        try {
            const response = await fetch('/api/short-term/three-day', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const result = await response.json();

            if (result.success) {
                this.stocks = result.data || [];
                // 为每只股票获取实时行情
                await this.loadRealTimeQuotes();
            } else {
                console.error('加载三日选股法数据失败:', result.error);
                this.stocks = [];
            }
        } catch (error) {
            console.error('加载三日选股法数据失败:', error);
            this.stocks = [];
        }
    },

    async loadRealTimeQuotes() {
        // 并发获取所有股票的实时行情
        const promises = this.stocks.map(async (stock) => {
            try {
                const response = await fetch(`/api/stock/quote/${stock.stock_code}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                const result = await response.json();
                if (result.success) {
                    stock.realtime = result.data;
                }
            } catch (error) {
                console.error(`获取 ${stock.stock_code} 实时行情失败:`, error);
            }
        });
        await Promise.all(promises);
    },

    initGuideState() {
        // 恢复使用指南的展开/收起状态
        const guideExpanded = localStorage.getItem('threeDayGuideExpanded');
        const guideContent = document.getElementById('guideContent');
        const guideIcon = document.querySelector('.guide-toggle-icon');

        if (guideContent && guideIcon) {
            if (guideExpanded === '1') {
                guideContent.style.display = 'block';
                guideIcon.textContent = '▲';
            } else {
                guideContent.style.display = 'none';
                guideIcon.textContent = '▼';
            }
        }
    },

    render() {
        const listDiv = document.getElementById('threeDayStockList');

        if (this.stocks.length === 0) {
            listDiv.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #9ca3af;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                    <div style="font-size: 14px;">暂无股票，请先添加股票</div>
                </div>
            `;
            return;
        }

        // 按天数分组
        const day1Stocks = this.stocks.filter(s => s.day_status === 1 && s.status !== 'archived');
        const day2Stocks = this.stocks.filter(s => s.day_status === 2 && s.status !== 'archived');
        const day3Stocks = this.stocks.filter(s => s.day_status === 3 && s.status !== 'archived');

        let html = '';

        // 第一天
        if (day1Stocks.length > 0) {
            html += `
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px; padding: 10px; background: #e3f2fd; border-radius: 6px; color: #1976d2;">
                        📌 第一天 (${day1Stocks.length})
                    </h4>
                    ${this.renderStockCards(day1Stocks)}
                </div>
            `;
        }

        // 第二天
        if (day2Stocks.length > 0) {
            html += `
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px; padding: 10px; background: #fff3e0; border-radius: 6px; color: #f57c00;">
                        📌 第二天 (${day2Stocks.length})
                    </h4>
                    ${this.renderStockCards(day2Stocks)}
                </div>
            `;
        }

        // 第三天
        if (day3Stocks.length > 0) {
            html += `
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px; padding: 10px; background: #fce4ec; border-radius: 6px; color: #c2185b;">
                        📌 第三天 (${day3Stocks.length})
                    </h4>
                    ${this.renderStockCards(day3Stocks)}
                </div>
            `;
        }

        listDiv.innerHTML = html;
    },

    renderStockCards(stocks) {
        return stocks.map(stock => {
            const rt = stock.realtime || {};
            const currentPrice = rt.currentPrice || 0;
            const changePercent = parseFloat(rt.changePercent) || 0;
            const priceColor = changePercent > 0 ? '#f44336' : changePercent < 0 ? '#4caf50' : '#666';

            // 计算与首日价格对比
            const firstDayPrice = parseFloat(stock.first_day_price) || 0;
            const profitPercent = firstDayPrice > 0 ? ((currentPrice - firstDayPrice) / firstDayPrice * 100).toFixed(2) : 0;
            const profitColor = profitPercent > 0 ? '#f44336' : profitPercent < 0 ? '#4caf50' : '#666';

            // 检查是否有警告信息
            const hasWarnings = stock.criteria_warnings && stock.criteria_warnings.trim() !== '';
            const warningsList = hasWarnings ? stock.criteria_warnings.split(';').map(w => w.trim()).filter(w => w) : [];

            return `
            <div style="padding: 15px; padding-right: ${hasWarnings ? '50px' : '15px'}; margin-bottom: 10px; background: white; border: 1px solid ${hasWarnings ? '#ff9800' : '#e0e0e0'}; border-radius: 6px; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px;">
                            ${hasWarnings ? `<div style="font-size: 20px; line-height: 1;" title="不符合选股标准">⚠️</div>` : ''}
                            <div style="font-size: 16px; font-weight: bold; color: #333;">
                                ${stock.stock_code} ${stock.stock_name}
                            </div>
                            ${rt.currentPrice ? `
                                <div style="font-size: 20px; font-weight: bold; color: ${priceColor};">
                                    ¥${currentPrice.toFixed(2)}
                                </div>
                                <div style="font-size: 14px; color: ${priceColor};">
                                    ${changePercent > 0 ? '+' : ''}${changePercent}%
                                </div>
                            ` : ''}
                        </div>

                        <div style="display: flex; gap: 15px; flex-wrap: wrap; font-size: 12px; color: #666; margin-bottom: 8px;">
                            <div>
                                ${stock.day_status === 1 ? `📌 第一天 | ${stock.first_day_date} | ¥${firstDayPrice.toFixed(2)}` : ''}
                                ${stock.day_status === 2 ? `📌 第二天 | ${stock.second_day_date} | ¥${parseFloat(stock.second_day_price || 0).toFixed(2)}` : ''}
                                ${stock.day_status === 3 ? `📌 第三天 | ${stock.third_day_date} | ¥${parseFloat(stock.third_day_price || 0).toFixed(2)}` : ''}
                            </div>
                            ${rt.currentPrice && firstDayPrice > 0 ? `
                                <div style="color: ${profitColor}; font-weight: bold;">
                                    持仓盈亏: ${profitPercent > 0 ? '+' : ''}${profitPercent}%
                                </div>
                            ` : ''}
                        </div>

                        ${rt.volumeRatio || rt.turnoverRate ? `
                            <div style="display: flex; gap: 15px; flex-wrap: wrap; font-size: 12px; color: #666; margin-bottom: 8px;">
                                ${rt.volumeRatio ? `<div>📊 量比: <span style="font-weight: bold;">${rt.volumeRatio}</span></div>` : ''}
                                ${rt.turnoverRate ? `<div>🔄 换手率: <span style="font-weight: bold;">${rt.turnoverRate}%</span></div>` : ''}
                                ${rt.amplitude ? `<div>📈 振幅: <span style="font-weight: bold;">${rt.amplitude}%</span></div>` : ''}
                            </div>
                        ` : ''}

                        ${hasWarnings ? `
                            <div style="font-size: 12px; color: #d84315; background: #ffe0b2; padding: 8px 10px; border-radius: 4px; margin-top: 8px; border-left: 3px solid #ff9800;">
                                <div style="font-weight: bold; margin-bottom: 4px;">⚠️ 不符合选股标准：</div>
                                ${warningsList.map(w => `<div style="margin-left: 12px;">• ${w}</div>`).join('')}
                            </div>
                        ` : ''}

                        ${stock.selection_notes ? `<div style="font-size: 12px; color: #999; background: #f5f5f5; padding: 6px 10px; border-radius: 4px; margin-top: 5px;">💡 ${stock.selection_notes}</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px; margin-left: 15px;">
                        ${stock.day_status < 3 ? `
                            <button
                                onclick="ThreeDaySelection.advanceDay(${stock.id})"
                                style="padding: 6px 12px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; white-space: nowrap;"
                            >
                                推进到${stock.day_status === 1 ? '第二天' : '第三天'}
                            </button>
                        ` : ''}
                        <button
                            onclick="ThreeDaySelection.archiveStock(${stock.id})"
                            style="padding: 6px 12px; background: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
                        >
                            归档
                        </button>
                        <button
                            onclick="ThreeDaySelection.deleteStock(${stock.id})"
                            style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
                        >
                            删除
                        </button>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    },

    bindEvents() {
        const addBtn = document.getElementById('threeDayBatchAddBtn');
        if (addBtn) {
            addBtn.onclick = () => this.batchAddStocks();
        }
    },

    async batchAddStocks() {
        const inputTextarea = document.getElementById('threeDayBatchInput');
        const notesInput = document.getElementById('threeDayBatchNotes');

        const stockCodes = inputTextarea.value.trim();
        const notes = notesInput.value.trim();

        if (!stockCodes) {
            showMessage('请输入股票代码', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/short-term/three-day/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ stockCodes, notes })
            });

            const result = await response.json();

            if (result.success) {
                const addedCount = result.data.added.length;
                const errorCount = result.data.errors.length;

                let message = `成功添加 ${addedCount} 只股票`;
                if (errorCount > 0) {
                    message += `，${errorCount} 只失败`;
                    // 显示详细的失败原因
                    const errorDetails = result.data.errors.map(e => `${e.code}: ${e.error}`).join('<br>');
                    message += `<br><br>失败详情：<br>${errorDetails}`;
                }

                showMessage(message, addedCount > 0 ? 'success' : 'warning');

                // 清空输入框
                inputTextarea.value = '';
                notesInput.value = '';

                // 刷新列表
                await this.loadData();
                this.render();
            } else {
                showMessage(result.error || '批量添加失败', 'error');
            }
        } catch (error) {
            console.error('批量添加股票失败:', error);
            showMessage('批量添加失败', 'error');
        }
    },

    async advanceDay(stockId) {
        const stock = this.stocks.find(s => s.id === stockId);
        if (!stock) return;

        const price = prompt(`请输入${stock.day_status === 1 ? '第二天' : '第三天'}的价格:`, '');
        if (price === null) return;

        const notes = prompt('备注（可选）:', stock.selection_notes || '');

        try {
            const response = await fetch(`/api/short-term/three-day/${stockId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    action: 'next_day',
                    price: parseFloat(price) || 0,
                    notes: notes || ''
                })
            });

            const result = await response.json();

            if (result.success) {
                showMessage('已推进到下一天', 'success');
                await this.loadData();
                this.render();
            } else {
                showMessage(result.error || '操作失败', 'error');
            }
        } catch (error) {
            console.error('推进到下一天失败:', error);
            showMessage('操作失败', 'error');
        }
    },

    async archiveStock(stockId) {
        if (!confirm('确定要归档这只股票吗？')) return;

        try {
            const response = await fetch(`/api/short-term/three-day/${stockId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ action: 'archive' })
            });

            const result = await response.json();

            if (result.success) {
                showMessage('已归档', 'success');
                await this.loadData();
                this.render();
            } else {
                showMessage(result.error || '归档失败', 'error');
            }
        } catch (error) {
            console.error('归档股票失败:', error);
            showMessage('归档失败', 'error');
        }
    },

    async deleteStock(stockId) {
        if (!confirm('确定要删除这只股票吗？')) return;

        try {
            const response = await fetch(`/api/short-term/three-day/${stockId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success) {
                showMessage('已删除', 'success');
                await this.loadData();
                this.render();
            } else {
                showMessage(result.error || '删除失败', 'error');
            }
        } catch (error) {
            console.error('删除股票失败:', error);
            showMessage('删除失败', 'error');
        }
    },

    // ==================== 配置管理 ====================
    criteriaSettings: null,

    async loadCriteriaSettings() {
        try {
            const response = await fetch('/api/short-term/criteria-settings', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const result = await response.json();
            if (result.success) {
                this.criteriaSettings = result.data;
                this.displayCriteriaSettings();
            }
        } catch (error) {
            console.error('加载选股标准配置失败:', error);
        }
    },

    displayCriteriaSettings() {
        if (!this.criteriaSettings) return;

        const c = this.criteriaSettings;
        const statusText = document.getElementById('criteriaStatusText');
        const displayDiv = document.getElementById('criteriaDisplay');

        if (statusText) {
            statusText.textContent = c.enable_check ? '(自动检测已启用)' : '(自动检测已禁用)';
        }

        if (displayDiv) {
            displayDiv.innerHTML = `
                <div style="background: rgba(255, 255, 255, 0.15); padding: 12px; border-radius: 6px; backdrop-filter: blur(10px);">
                    <div style="font-weight: bold; margin-bottom: 8px;">📊 量比</div>
                    <div style="line-height: 1.8;">• ${c.volume_ratio_min} - ${c.volume_ratio_max}</div>
                </div>
                <div style="background: rgba(255, 255, 255, 0.15); padding: 12px; border-radius: 6px; backdrop-filter: blur(10px);">
                    <div style="font-weight: bold; margin-bottom: 8px;">🔄 换手率</div>
                    <div style="line-height: 1.8;">• ${c.turnover_rate_min}% - ${c.turnover_rate_max}%</div>
                </div>
                <div style="background: rgba(255, 255, 255, 0.15); padding: 12px; border-radius: 6px; backdrop-filter: blur(10px);">
                    <div style="font-weight: bold; margin-bottom: 8px;">📈 涨跌幅</div>
                    <div style="line-height: 1.8;">• ${c.change_percent_min}% - ${c.change_percent_max}%</div>
                </div>
                ${(c.amplitude_min > 0 || c.amplitude_max < 100) ? `
                    <div style="background: rgba(255, 255, 255, 0.15); padding: 12px; border-radius: 6px; backdrop-filter: blur(10px);">
                        <div style="font-weight: bold; margin-bottom: 8px;">📊 振幅</div>
                        <div style="line-height: 1.8;">• ${c.amplitude_min}% - ${c.amplitude_max}%</div>
                    </div>
                ` : ''}
                ${(c.price_min > 0 || c.price_max < 999999) ? `
                    <div style="background: rgba(255, 255, 255, 0.15); padding: 12px; border-radius: 6px; backdrop-filter: blur(10px);">
                        <div style="font-weight: bold; margin-bottom: 8px;">💰 价格范围</div>
                        <div style="line-height: 1.8;">• ¥${c.price_min} - ¥${c.price_max}</div>
                    </div>
                ` : ''}
            `;
        }
    },

    openCriteriaSettings() {
        if (!this.criteriaSettings) {
            showMessage('加载配置中，请稍后...', 'info');
            return;
        }

        const c = this.criteriaSettings;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6); display: flex;
            align-items: center; justify-content: center; z-index: 10000;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white; border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 24px; max-width: 600px; width: 90%;
            max-height: 80vh; overflow-y: auto;
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #333;">⚙️ 选股标准配置</h3>
            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="criteriaEnableCheck" ${c.enable_check ? 'checked' : ''} style="width: 18px; height: 18px;">
                    <span>启用自动检测（不符合标准的股票将显示⚠️警告）</span>
                </label>
            </div>
            <div style="display: grid; gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">📊 量比范围</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="number" id="volumeRatioMin" value="${c.volume_ratio_min}" step="0.1" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <span>-</span>
                        <input type="number" id="volumeRatioMax" value="${c.volume_ratio_max}" step="0.1" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">🔄 换手率范围 (%)</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="number" id="turnoverRateMin" value="${c.turnover_rate_min}" step="0.1" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <span>-</span>
                        <input type="number" id="turnoverRateMax" value="${c.turnover_rate_max}" step="0.1" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">📈 涨跌幅范围 (%)</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="number" id="changePercentMin" value="${c.change_percent_min}" step="0.1" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <span>-</span>
                        <input type="number" id="changePercentMax" value="${c.change_percent_max}" step="0.1" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">📊 振幅范围 (%) <small style="color: #666;">可选</small></label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="number" id="amplitudeMin" value="${c.amplitude_min}" step="0.1" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <span>-</span>
                        <input type="number" id="amplitudeMax" value="${c.amplitude_max}" step="0.1" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">💰 价格范围 (¥) <small style="color: #666;">可选</small></label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="number" id="priceMin" value="${c.price_min}" step="1" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <span>-</span>
                        <input type="number" id="priceMax" value="${c.price_max}" step="1" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 24px; justify-content: flex-end;">
                <button id="cancelBtn" style="padding: 10px 24px; background: #f5f5f5; border: none; border-radius: 6px; cursor: pointer;">取消</button>
                <button id="saveBtn" style="padding: 10px 24px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">保存</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        document.getElementById('cancelBtn').onclick = () => document.body.removeChild(overlay);
        overlay.onclick = (e) => {
            if (e.target === overlay) document.body.removeChild(overlay);
        };

        document.getElementById('saveBtn').onclick = async () => {
            const settings = {
                enable_check: document.getElementById('criteriaEnableCheck').checked ? 1 : 0,
                volume_ratio_min: parseFloat(document.getElementById('volumeRatioMin').value) || 0,
                volume_ratio_max: parseFloat(document.getElementById('volumeRatioMax').value) || 999,
                turnover_rate_min: parseFloat(document.getElementById('turnoverRateMin').value) || 0,
                turnover_rate_max: parseFloat(document.getElementById('turnoverRateMax').value) || 100,
                change_percent_min: parseFloat(document.getElementById('changePercentMin').value) || -100,
                change_percent_max: parseFloat(document.getElementById('changePercentMax').value) || 100,
                amplitude_min: parseFloat(document.getElementById('amplitudeMin').value) || 0,
                amplitude_max: parseFloat(document.getElementById('amplitudeMax').value) || 100,
                price_min: parseFloat(document.getElementById('priceMin').value) || 0,
                price_max: parseFloat(document.getElementById('priceMax').value) || 999999
            };

            try {
                const response = await fetch('/api/short-term/criteria-settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(settings)
                });

                const result = await response.json();

                if (result.success) {
                    showMessage('配置已保存', 'success');
                    await this.loadCriteriaSettings();
                    document.body.removeChild(overlay);
                } else {
                    showMessage(result.error || '保存失败', 'error');
                }
            } catch (error) {
                console.error('保存配置失败:', error);
                showMessage('保存失败', 'error');
            }
        };
    }
};

// ==================== 主初始化函数 ====================
async function initStockSelection() {
    console.log('初始化选股模块...');

    // 初始化当前活动的子页签
    const activeSubTab = document.querySelector('#stock-selection-tab .sub-tab-btn.active');
    if (activeSubTab) {
        const subTabId = activeSubTab.getAttribute('data-subtab');
        await loadStockSelectionSubTab(subTabId);
    }
}

// 加载子页签内容
async function loadStockSelectionSubTab(subTabId) {
    console.log(`加载选股子页签: ${subTabId}`);

    switch(subTabId) {
        case 'stock-selection-three-day':
            await ThreeDaySelection.init();
            break;
    }
}

// 导出函数供全局使用
window.ThreeDaySelection = ThreeDaySelection;
window.initStockSelection = initStockSelection;
window.loadStockSelectionSubTab = loadStockSelectionSubTab;

// 页面加载完成后自动初始化选股模块
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStockSelection);
} else {
    // DOMContentLoaded已经触发，立即初始化
    initStockSelection();
}
