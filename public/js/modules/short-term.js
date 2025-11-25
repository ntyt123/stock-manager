/**
 * 短线交易模块
 * 提供短线交易相关功能
 */

// ==================== 辅助函数 ====================
/**
 * 显示美化的输入对话框
 */
function showInputDialog(config) {
    return new Promise((resolve) => {
        const { title, fields } = config;

        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease-out;
        `;

        // 创建对话框
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 90%;
            max-width: 500px;
            max-height: 80vh;
            overflow: hidden;
            animation: slideUp 0.3s ease-out;
        `;

        // 标题栏
        const header = document.createElement('div');
        header.style.cssText = `
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            padding: 20px 24px;
            font-size: 18px;
            font-weight: 600;
        `;
        header.textContent = title;

        // 内容区域
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 24px;
            max-height: calc(80vh - 150px);
            overflow-y: auto;
        `;

        // 生成表单字段
        let formHTML = '';
        fields.forEach(field => {
            const label = field.label || field.name;
            const required = field.required !== false && !label.includes('选填');
            const showWhen = field.showWhen ? `data-show-when="${field.showWhen.field}" data-show-value="${field.showWhen.value}"` : '';
            const initiallyHidden = field.showWhen ? 'style="display: none;"' : '';

            // 添加tip说明
            const tipHTML = field.tip ? `
                <div style="margin-top: 6px; padding: 8px 12px; background: #f0f9ff; border-left: 3px solid #3b82f6; border-radius: 4px; font-size: 13px; color: #1e40af; line-height: 1.5;">
                    💡 ${field.tip}
                </div>
            ` : '';

            formHTML += `
                <div ${showWhen} ${initiallyHidden} data-field-container="${field.name}" style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; color: #374151; font-weight: 500; font-size: 14px;">
                        ${label}${required ? '<span style="color: #ef4444;">*</span>' : ''}
                    </label>
            `;

            if (field.type === 'select') {
                formHTML += `<select name="${field.name}" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">`;
                field.options.forEach(opt => {
                    const selected = field.value === opt.value ? 'selected' : '';
                    formHTML += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                });
                formHTML += `</select>`;
            } else if (field.type === 'textarea') {
                formHTML += `<textarea name="${field.name}" placeholder="${field.placeholder || ''}" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; resize: vertical; min-height: 80px; font-family: inherit;">${field.value || ''}</textarea>`;
            } else if (field.type === 'checkbox') {
                const checked = field.value ? 'checked' : '';
                formHTML += `
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" name="${field.name}" ${checked} style="width: 18px; height: 18px; margin-right: 8px; cursor: pointer;">
                        <span style="font-size: 14px; color: #6b7280;">${field.checkboxLabel || '启用'}</span>
                    </label>
                `;
            } else {
                const inputType = field.type || 'text';
                const readonly = field.readonly ? 'readonly' : '';
                formHTML += `<input type="${inputType}" name="${field.name}" value="${field.value || ''}" placeholder="${field.placeholder || ''}" ${readonly} style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; ${field.readonly ? 'background: #f9fafb; cursor: not-allowed;' : ''}">`;
            }

            formHTML += tipHTML + `</div>`;
        });

        content.innerHTML = formHTML;

        // 添加条件字段显示/隐藏逻辑
        fields.forEach(field => {
            if (field.showWhen) {
                const triggerField = content.querySelector(`[name="${field.showWhen.field}"]`);
                const targetContainer = content.querySelector(`[data-field-container="${field.name}"]`);

                if (triggerField && targetContainer) {
                    const updateVisibility = () => {
                        let shouldShow;
                        if (field.showWhen.checkValue) {
                            // 使用自定义检查函数
                            shouldShow = field.showWhen.checkValue(triggerField.value);
                        } else {
                            // 使用简单值匹配
                            shouldShow = triggerField.value === field.showWhen.value;
                        }
                        targetContainer.style.display = shouldShow ? 'block' : 'none';
                    };

                    triggerField.addEventListener('change', updateVisibility);
                    updateVisibility(); // 初始检查
                }
            }
        });

        // 添加自动填充功能
        const autoFillField = fields.find(f => f.autoFill);
        if (autoFillField) {
            const codeInput = content.querySelector(`[name="${autoFillField.name}"]`);
            const nameInput = content.querySelector(`[name="stock_name"]`);
            const priceInput = content.querySelector(`[name="current_price"]`);
            const tagsInput = content.querySelector(`[name="tags"]`);

            if (codeInput && nameInput) {
                let debounceTimer;
                codeInput.addEventListener('input', () => {
                    clearTimeout(debounceTimer);
                    const code = codeInput.value.trim();

                    if (code.length === 6) {
                        debounceTimer = setTimeout(async () => {
                            nameInput.value = '正在查询...';
                            if (priceInput) {
                                priceInput.value = '正在获取价格...';
                            }
                            if (tagsInput) {
                                tagsInput.value = '正在获取行业信息...';
                            }

                            try {
                                const token = localStorage.getItem('token');

                                // 获取股票名称和价格
                                const quoteResponse = await fetch(`/api/stock/quote/${code}`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });

                                if (quoteResponse.ok) {
                                    const quoteData = await quoteResponse.json();
                                    if (quoteData.success && quoteData.data && quoteData.data.stockName) {
                                        nameInput.value = quoteData.data.stockName;
                                        nameInput.style.color = '#10b981';

                                        // 显示最新价格
                                        if (priceInput && quoteData.data.currentPrice !== null && quoteData.data.currentPrice !== undefined) {
                                            const price = parseFloat(quoteData.data.currentPrice);
                                            const changePercent = parseFloat(quoteData.data.changePercent) || 0;

                                            // 根据涨跌设置颜色和显示内容
                                            if (changePercent > 0) {
                                                priceInput.value = `¥${price.toFixed(2)} (+${changePercent.toFixed(2)}%)`;
                                                priceInput.style.color = '#ef4444';
                                                priceInput.style.fontWeight = '600';
                                            } else if (changePercent < 0) {
                                                priceInput.value = `¥${price.toFixed(2)} (${changePercent.toFixed(2)}%)`;
                                                priceInput.style.color = '#22c55e';
                                                priceInput.style.fontWeight = '600';
                                            } else {
                                                priceInput.value = `¥${price.toFixed(2)}`;
                                                priceInput.style.color = '#6b7280';
                                                priceInput.style.fontWeight = '600';
                                            }
                                        } else if (priceInput) {
                                            priceInput.value = '';
                                            priceInput.placeholder = '价格暂无';
                                        }
                                    } else {
                                        nameInput.value = '';
                                        nameInput.placeholder = '未找到股票信息';
                                        if (priceInput) {
                                            priceInput.value = '';
                                            priceInput.placeholder = '价格暂无';
                                        }
                                    }
                                } else {
                                    nameInput.value = '';
                                    nameInput.placeholder = '查询失败';
                                    if (priceInput) {
                                        priceInput.value = '';
                                        priceInput.placeholder = '获取失败';
                                    }
                                }

                                // 获取行业信息
                                if (tagsInput) {
                                    const industryResponse = await fetch(`/api/stock/industry/${code}`, {
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    });

                                    if (industryResponse.ok) {
                                        const industryData = await industryResponse.json();
                                        if (industryData.success && industryData.data && industryData.data.allTags) {
                                            tagsInput.value = industryData.data.allTags;
                                            tagsInput.style.color = '#10b981';
                                        } else {
                                            tagsInput.value = '';
                                            tagsInput.placeholder = '未找到行业信息，请手动填写';
                                        }
                                    } else {
                                        tagsInput.value = '';
                                        tagsInput.placeholder = '行业信息获取失败，请手动填写';
                                    }
                                }
                            } catch (error) {
                                console.error('查询股票信息失败:', error);
                                nameInput.value = '';
                                nameInput.placeholder = '查询失败';
                                if (priceInput) {
                                    priceInput.value = '';
                                    priceInput.placeholder = '获取失败';
                                }
                                if (tagsInput) {
                                    tagsInput.value = '';
                                    tagsInput.placeholder = '请手动填写';
                                }
                            }
                        }, 500);
                    } else {
                        nameInput.value = '';
                        nameInput.placeholder = '自动匹配...';
                        nameInput.style.color = '';
                        if (priceInput) {
                            priceInput.value = '';
                            priceInput.placeholder = '自动获取...';
                            priceInput.style.color = '';
                            priceInput.style.fontWeight = '';
                        }
                        if (tagsInput) {
                            tagsInput.value = '';
                            tagsInput.placeholder = '例如: 人工智能,芯片,新能源（用逗号分隔）';
                            tagsInput.style.color = '';
                        }
                    }
                });
            }
        }

        // 按钮区域
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 16px 24px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            padding: 10px 20px;
            border: 1px solid #d1d5db;
            background: white;
            color: #374151;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        `;
        cancelBtn.onmouseover = () => cancelBtn.style.background = '#f3f4f6';
        cancelBtn.onmouseout = () => cancelBtn.style.background = 'white';

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '确定';
        confirmBtn.style.cssText = `
            padding: 10px 20px;
            border: none;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        `;
        confirmBtn.onmouseover = () => confirmBtn.style.transform = 'translateY(-1px)';
        confirmBtn.onmouseout = () => confirmBtn.style.transform = 'translateY(0)';

        // 事件处理
        const closeDialog = () => {
            overlay.style.animation = 'fadeOut 0.2s ease-out';
            setTimeout(() => document.body.removeChild(overlay), 200);
        };

        cancelBtn.onclick = () => {
            closeDialog();
            resolve(null);
        };

        confirmBtn.onclick = () => {
            const result = {};
            fields.forEach(field => {
                const input = content.querySelector(`[name="${field.name}"]`);
                result[field.name] = input.value || field.value || null;
            });
            closeDialog();
            resolve(result);
        };

        // 组装对话框
        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);
        dialog.appendChild(header);
        dialog.appendChild(content);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);

        // 添加CSS动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // 显示对话框
        document.body.appendChild(overlay);

        // 点击遮罩层关闭
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                closeDialog();
                resolve(null);
            }
        };

        // 如果有对话框显示后的回调，执行它
        if (config.onDialogShown) {
            setTimeout(() => config.onDialogShown(content), 0);
        }
    });
}

/**
 * 显示美化的消息提示
 */
function showMessage(message, type = 'info') {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
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

// ==================== 涨跌幅颜色分级工具函数 ====================
/**
 * 根据涨跌幅获取CSS类名
 * @param {number} changePercent - 涨跌幅百分比
 * @returns {string} CSS类名
 */
function getChangePercentClass(changePercent) {
    const percent = parseFloat(changePercent);
    if (isNaN(percent)) return 'change-neutral';

    if (percent >= 5) return 'change-strong-up';
    if (percent >= 3) return 'change-moderate-up';
    if (percent >= 1) return 'change-mild-up';
    if (percent > -1) return 'change-neutral';
    if (percent > -3) return 'change-mild-down';
    if (percent > -5) return 'change-moderate-down';
    return 'change-strong-down';
}

/**
 * 根据涨跌幅获取显示文本（包含图标）
 * @param {number} changePercent - 涨跌幅百分比
 * @returns {string} 显示文本
 */
function getChangePercentText(changePercent) {
    const percent = parseFloat(changePercent);
    if (isNaN(percent)) return '0.00%';

    const sign = percent >= 0 ? '+' : '';
    const text = `${sign}${percent.toFixed(2)}%`;

    // 添加图标
    if (percent >= 5) return `${text} 🔥`;
    if (percent <= -5) return `${text} ⚠️`;
    return text;
}

/**
 * 根据量比获取徽章HTML
 * @param {number} volumeRatio - 量比
 * @returns {string} 徽章HTML
 */
function getVolumeRatioBadge(volumeRatio) {
    const ratio = parseFloat(volumeRatio);
    if (isNaN(ratio)) return '';

    if (ratio > 2.0) {
        return '<span class="volume-badge volume-high">💥 放量</span>';
    }
    if (ratio > 1.5) {
        return '<span class="volume-badge volume-moderate">📈 温和放量</span>';
    }
    if (ratio < 0.5) {
        return '<span class="volume-badge volume-low">📉 缩量</span>';
    }
    return '';
}

/**
 * 根据技术指标获取信号灯HTML
 * @param {object} indicators - 技术指标对象 {macd, kdj, rsi, etc}
 * @returns {string} 信号灯HTML
 */
function getTechnicalSignal(indicators) {
    if (!indicators) return '';

    // 简单的信号判断逻辑（可根据实际需要调整）
    let buySignals = 0;
    let sellSignals = 0;

    // MACD信号
    if (indicators.macd && indicators.macd > 0) buySignals++;
    if (indicators.macd && indicators.macd < 0) sellSignals++;

    // KDJ信号
    if (indicators.kdj) {
        if (indicators.kdj.k < 20 && indicators.kdj.k > indicators.kdj.d) buySignals++;
        if (indicators.kdj.k > 80 && indicators.kdj.k < indicators.kdj.d) sellSignals++;
    }

    // RSI信号
    if (indicators.rsi) {
        if (indicators.rsi < 30) buySignals++;
        if (indicators.rsi > 70) sellSignals++;
    }

    // 判断总体信号
    if (buySignals > sellSignals) {
        return '<div class="signal-light signal-buy">🟢 买入信号</div>';
    }
    if (sellSignals > buySignals) {
        return '<div class="signal-light signal-sell">🔴 卖出信号</div>';
    }
    return '<div class="signal-light signal-hold">🟡 观望信号</div>';
}

// ==================== 短线池管理 ====================
const ShortTermPool = {
    stocks: [],
    priceUpdateInterval: null,

    // 初始化短线池
    async init() {
        console.log('初始化短线池...');
        const content = document.getElementById('shortTermPoolContent');

        content.innerHTML = `
            <div class="short-term-pool-header" style="margin-bottom: 20px;">
                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px;">
                    <button class="action-btn primary" onclick="ShortTermPool.addStock()">
                        <span class="btn-icon">➕</span>
                        <span class="btn-text">添加股票</span>
                    </button>
                    <button class="action-btn secondary" onclick="ShortTermPool.refresh()">
                        <span class="btn-icon">🔄</span>
                        <span class="btn-text">刷新</span>
                    </button>
                    <select id="poolStatusFilter" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer;" onchange="ShortTermPool.filterByStatus(this.value)">
                        <option value="">全部状态</option>
                        <option value="watching">观察中</option>
                        <option value="ready">准备买入</option>
                        <option value="holding">已持仓</option>
                        <option value="sold">已卖出</option>
                    </select>
                    <div style="margin-left: auto; font-size: 14px; color: #6b7280;">
                        共 <span id="poolStockCount">0</span> 支股票
                    </div>
                </div>

                <!-- 快速排序按钮组 -->
                <div class="sort-buttons-group">
                    <span style="font-size: 13px; color: #6b7280; font-weight: 500;">快速排序:</span>
                    <button class="sort-btn" data-sort="change-desc">
                        <span class="sort-icon">📈</span>
                        <span>涨幅↓</span>
                    </button>
                    <button class="sort-btn" data-sort="volume-desc">
                        <span class="sort-icon">📊</span>
                        <span>量比↓</span>
                    </button>
                    <button class="sort-btn" data-sort="turnover-desc">
                        <span class="sort-icon">🔄</span>
                        <span>换手↓</span>
                    </button>
                    <button class="sort-btn" data-sort="amplitude-desc">
                        <span class="sort-icon">📉</span>
                        <span>振幅↓</span>
                    </button>
                    <button class="sort-btn active" data-sort="latest">
                        <span class="sort-icon">🕐</span>
                        <span>最新</span>
                    </button>
                    <button class="sort-btn" data-sort="priority">
                        <span class="sort-icon">⭐</span>
                        <span>自定义</span>
                    </button>
                </div>
            </div>
            <div id="shortTermPoolList">
                <div class="loading-text">正在加载短线池...</div>
            </div>
        `;

        // 绑定排序按钮事件
        this.bindSortButtons();

        await this.loadData();
    },

    // 加载数据
    async loadData(status = null) {
        try {
            const token = localStorage.getItem('token');
            const url = status ? `/api/short-term-pool?status=${status}` : '/api/short-term-pool';

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('加载短线池失败');
            }

            const data = await response.json();
            this.stocks = data.data || [];

            // 获取所有股票的市场数据
            await this.fetchAllMarketData();

            await this.render();
        } catch (error) {
            console.error('加载短线池失败:', error);
            document.getElementById('shortTermPoolList').innerHTML = `
                <div class="error-message">
                    <span class="error-icon">❌</span>
                    <span>加载数据失败: ${error.message}</span>
                </div>
            `;
        }
    },

    // 渲染界面
    async render() {
        const container = document.getElementById('shortTermPoolList');
        const countSpan = document.getElementById('poolStockCount');

        if (countSpan) {
            countSpan.textContent = this.stocks.length;
        }

        if (this.stocks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎯</div>
                    <div class="empty-title">短线池为空</div>
                    <div class="empty-desc">点击"添加股票"按钮将股票加入短线池</div>
                </div>
            `;
            return;
        }

        // 获取默认K线周期设置
        const settings = window.SettingsManager ? window.SettingsManager.getSettings() : {};
        const defaultPeriod = settings.chartPeriod || 'day';

        let html = '<div class="short-term-pool-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 16px;">';

        for (const stock of this.stocks) {
            const statusMap = {
                'watching': { text: '观察中', color: '#6b7280', bg: '#f3f4f6' },
                'ready': { text: '准备买入', color: '#f59e0b', bg: '#fef3c7' },
                'holding': { text: '已持仓', color: '#10b981', bg: '#d1fae5' },
                'sold': { text: '已卖出', color: '#9ca3af', bg: '#f9fafb' }
            };

            const statusInfo = statusMap[stock.status] || statusMap['watching'];
            const tags = stock.tags ? stock.tags.split(',').filter(t => t.trim()) : [];
            const priority = stock.priority || 0;
            const priorityStars = '★'.repeat(Math.min(priority, 5)) + '☆'.repeat(Math.max(5 - priority, 0));
            const chartId = `short-term-chart-${stock.stock_code}`;

            html += `
                <div class="pool-stock-card" style="
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 16px;
                    transition: all 0.2s;
                " onmouseover="this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <div style="font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">
                                ${stock.stock_name}
                            </div>
                            <div style="font-size: 14px; color: #6b7280;">
                                ${stock.stock_code}
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span style="
                                background: ${statusInfo.bg};
                                color: ${statusInfo.color};
                                padding: 4px 10px;
                                border-radius: 12px;
                                font-size: 12px;
                                font-weight: 600;
                            ">${statusInfo.text}</span>
                            <button class="icon-btn" onclick="event.stopPropagation(); ShortTermPool.editStock('${stock.stock_code}')" title="编辑">⚙️</button>
                            <button class="icon-btn" onclick="event.stopPropagation(); ShortTermPool.deleteStock('${stock.stock_code}')" title="删除">🗑️</button>
                        </div>
                    </div>

                    ${priority > 0 ? `
                    <div style="margin-bottom: 12px; color: #f59e0b; font-size: 14px;">
                        优先级: ${priorityStars}
                    </div>
                    ` : ''}

                    ${stock.stock_type ? `
                    <div style="margin-bottom: 12px; padding: 10px; background: #fef2f2; border-left: 3px solid #ef4444; border-radius: 4px;">
                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px; font-weight: 600;">股票类型</div>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <span style="
                                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                                color: white;
                                padding: 4px 12px;
                                border-radius: 14px;
                                font-size: 13px;
                                font-weight: 600;
                                box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
                            ">${stock.stock_type}</span>
                            ${stock.board_shape ? `
                                <span style="
                                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                                    color: white;
                                    padding: 4px 10px;
                                    border-radius: 12px;
                                    font-size: 12px;
                                    font-weight: 500;
                                    box-shadow: 0 2px 4px rgba(139, 92, 246, 0.3);
                                ">${stock.board_shape}</span>
                            ` : ''}
                            ${stock.stock_type === '游资进入' && stock.hot_money_name ? `
                                <span style="
                                    background: #fef3c7;
                                    color: #92400e;
                                    padding: 4px 10px;
                                    border-radius: 12px;
                                    font-size: 12px;
                                    font-weight: 500;
                                    border: 1px solid #fbbf24;
                                ">${stock.hot_money_name}</span>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}

                    ${stock.marketData ? `
                    <!-- 市场数据信息面板 -->
                    <div class="market-data-panel">
                        <div class="market-data-item">
                            <div class="market-data-label">最新价</div>
                            <div class="market-data-value" style="color: ${stock.marketData.changePercent >= 0 ? '#ef4444' : '#22c55e'};">
                                ¥${stock.marketData.currentPrice.toFixed(2)}
                            </div>
                        </div>
                        <div class="market-data-item">
                            <div class="market-data-label">涨跌幅</div>
                            <div class="market-data-value">
                                <span class="${getChangePercentClass(stock.marketData.changePercent)}">
                                    ${getChangePercentText(stock.marketData.changePercent)}
                                </span>
                            </div>
                        </div>
                        <div class="market-data-item">
                            <div class="market-data-label">量比</div>
                            <div class="market-data-value" style="font-size: 13px;">
                                ${stock.marketData.volumeRatio.toFixed(2)}
                                ${getVolumeRatioBadge(stock.marketData.volumeRatio)}
                            </div>
                        </div>
                        <div class="market-data-item">
                            <div class="market-data-label">换手率</div>
                            <div class="market-data-value">
                                ${stock.marketData.turnoverRate.toFixed(2)}%
                            </div>
                        </div>
                        <div class="market-data-item">
                            <div class="market-data-label">振幅</div>
                            <div class="market-data-value">
                                ${stock.marketData.amplitude.toFixed(2)}%
                            </div>
                        </div>
                        <div class="market-data-item">
                            <div class="market-data-label">最高/最低</div>
                            <div class="market-data-value" style="font-size: 12px;">
                                ${stock.marketData.high.toFixed(2)}/${stock.marketData.low.toFixed(2)}
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <div style="margin-bottom: 12px; padding: 10px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px; font-weight: 600;">相关概念/行业</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            ${tags.length > 0 ? tags.map(tag => `
                                <span style="
                                    background: #3b82f6;
                                    color: white;
                                    padding: 3px 10px;
                                    border-radius: 12px;
                                    font-size: 12px;
                                    font-weight: 500;
                                ">${tag.trim()}</span>
                            `).join('') : '<span style="color: #9ca3af; font-size: 13px;">未填写</span>'}
                        </div>
                    </div>

                    <div style="margin-bottom: 12px; padding: 10px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 4px;">
                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px; font-weight: 600;">加入理由</div>
                        <div style="font-size: 13px; color: #374151; line-height: 1.5;">
                            ${stock.reason || '<span style="color: #9ca3af;">未填写</span>'}
                        </div>
                    </div>

                    ${stock.entry_price ? `
                    <div style="margin-bottom: 12px; padding: 10px; background: #f0fdf4; border-left: 3px solid #10b981; border-radius: 4px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">加入价格</div>
                                <div style="font-size: 16px; font-weight: 600; color: #374151;">¥${parseFloat(stock.entry_price).toFixed(2)}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">当前价格</div>
                                <div id="current-price-${stock.stock_code}" style="font-size: 16px; font-weight: 600; color: #9ca3af;">加载中...</div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    ${stock.target_price || stock.stop_loss_price ? `
                    <div style="margin-bottom: 12px; padding: 10px; background: #f9fafb; border-radius: 6px;">
                        ${stock.target_price ? `<div style="font-size: 13px; color: #10b981; margin-bottom: 4px;">目标价: ¥${parseFloat(stock.target_price).toFixed(2)}</div>` : ''}
                        ${stock.stop_loss_price ? `<div style="font-size: 13px; color: #ef4444;">止损价: ¥${parseFloat(stock.stop_loss_price).toFixed(2)}</div>` : ''}
                    </div>
                    ` : ''}

                    <div class="chart-period-selector" style="margin-bottom: 12px;">
                        <button class="period-btn ${defaultPeriod === 'intraday' ? 'active' : ''}" data-period="intraday" data-chart="${chartId}" data-stock="${stock.stock_code}">分时</button>
                        <button class="period-btn ${defaultPeriod === 'day' ? 'active' : ''}" data-period="day" data-chart="${chartId}" data-stock="${stock.stock_code}">日线</button>
                        <button class="period-btn ${defaultPeriod === 'week' ? 'active' : ''}" data-period="week" data-chart="${chartId}" data-stock="${stock.stock_code}">周线</button>
                        <button class="period-btn ${defaultPeriod === 'month' ? 'active' : ''}" data-period="month" data-chart="${chartId}" data-stock="${stock.stock_code}">月线</button>
                    </div>

                    <div class="quote-chart-container" style="margin-bottom: 12px;">
                        <canvas id="${chartId}" class="quote-chart"></canvas>
                    </div>

                    <div style="padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
                        添加时间: ${new Date(stock.created_at).toLocaleDateString('zh-CN')}
                    </div>
                </div>
            `;
        }

        html += '</div>';

        // 在清空容器前，先销毁所有旧的图表实例
        if (typeof stockChartManager !== 'undefined' && stockChartManager) {
            const oldCanvases = container.querySelectorAll('canvas[id^="short-term-chart-"]');
            oldCanvases.forEach(canvas => {
                stockChartManager.destroyChart(canvas.id);
            });
        }

        container.innerHTML = html;

        // 延迟渲染图表以确保 DOM 完全更新
        setTimeout(async () => {
            if (typeof renderStockChart === 'function') {
                for (const stock of this.stocks) {
                    const chartId = `short-term-chart-${stock.stock_code}`;
                    const canvas = document.getElementById(chartId);

                    if (canvas) {
                        try {
                            await renderStockChart(chartId, stock.stock_code, defaultPeriod);
                        } catch (error) {
                            console.error(`渲染图表 ${chartId} 失败:`, error);
                        }
                    }
                }

                // 绑定周期切换按钮事件
                const periodBtns = document.querySelectorAll('.period-btn');
                periodBtns.forEach(btn => {
                    btn.addEventListener('click', async function(e) {
                        e.stopPropagation();
                        const period = this.getAttribute('data-period');
                        const chartId = this.getAttribute('data-chart');
                        const stockCode = this.getAttribute('data-stock');

                        // 更新按钮状态
                        const parentSelector = this.parentElement;
                        parentSelector.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                        this.classList.add('active');

                        // 重新渲染图表
                        try {
                            await renderStockChart(chartId, stockCode, period);
                        } catch (error) {
                            console.error(`切换周期后渲染图表失败:`, error);
                        }
                    });
                });
            }
        }, 100);

        // 启动价格更新
        this.startPriceUpdates();
    },

    // 判断是否是交易时间
    isTradingTime() {
        const now = new Date();
        const day = now.getDay();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const time = hours * 60 + minutes;

        // 周一到周五
        if (day >= 1 && day <= 5) {
            // 9:30-11:30 或 13:00-15:00
            return (time >= 570 && time < 690) || (time >= 780 && time < 900);
        }
        return false;
    },

    // 更新股票价格
    async updateStockPrices() {
        if (!this.stocks || this.stocks.length === 0) return;

        const token = localStorage.getItem('token');

        for (const stock of this.stocks) {
            // 更新市场数据
            const marketData = await this.fetchMarketData(stock.stock_code);
            if (marketData) {
                stock.marketData = marketData;
            }

            // 只更新有加入价格的股票价格显示
            if (!stock.entry_price) continue;

            const priceElement = document.getElementById(`current-price-${stock.stock_code}`);
            if (!priceElement) continue;

            try {
                if (!marketData) continue;

                const currentPrice = marketData.currentPrice;
                const changePercent = marketData.changePercent;

                if (isNaN(currentPrice)) continue;

                // 使用新的颜色分级系统
                const changeClass = getChangePercentClass(changePercent);
                const changeText = getChangePercentText(changePercent);

                // 清除旧的类
                priceElement.className = '';
                priceElement.classList.add(changeClass);

                priceElement.innerHTML = `¥${currentPrice.toFixed(2)} <span style="font-size: 12px;">(${changeText})</span>`;
                priceElement.style.fontWeight = '600';
            } catch (error) {
                console.error(`更新 ${stock.stock_code} 价格失败:`, error);
            }
        }
    },

    // 启动价格更新
    async startPriceUpdates() {
        // 先停止旧的更新
        this.stopPriceUpdates();

        // 立即更新一次
        await this.updateStockPrices();

        // 判断是否需要定期更新
        if (this.isTradingTime()) {
            // 交易时间内，每5秒更新一次
            this.priceUpdateInterval = setInterval(() => {
                this.updateStockPrices();
            }, 5000);
        }
    },

    // 停止价格更新
    stopPriceUpdates() {
        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
            this.priceUpdateInterval = null;
        }
    },

    // 绑定排序按钮事件
    bindSortButtons() {
        setTimeout(() => {
            const sortBtns = document.querySelectorAll('.sort-btn');
            sortBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    // 更新按钮状态
                    sortBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // 执行排序
                    const sortType = btn.getAttribute('data-sort');
                    this.sortStocks(sortType);
                });
            });
        }, 100);
    },

    // 排序股票
    sortStocks(sortType) {
        if (!this.stocks || this.stocks.length === 0) return;

        switch (sortType) {
            case 'change-desc':
                // 按涨幅降序排序（需要实时获取市场数据）
                this.stocks.sort((a, b) => {
                    const changeA = parseFloat(a.marketData?.changePercent || 0);
                    const changeB = parseFloat(b.marketData?.changePercent || 0);
                    return changeB - changeA;
                });
                break;

            case 'volume-desc':
                // 按量比降序排序
                this.stocks.sort((a, b) => {
                    const volumeA = parseFloat(a.marketData?.volumeRatio || 0);
                    const volumeB = parseFloat(b.marketData?.volumeRatio || 0);
                    return volumeB - volumeA;
                });
                break;

            case 'turnover-desc':
                // 按换手率降序排序
                this.stocks.sort((a, b) => {
                    const turnoverA = parseFloat(a.marketData?.turnoverRate || 0);
                    const turnoverB = parseFloat(b.marketData?.turnoverRate || 0);
                    return turnoverB - turnoverA;
                });
                break;

            case 'amplitude-desc':
                // 按振幅降序排序
                this.stocks.sort((a, b) => {
                    const amplitudeA = parseFloat(a.marketData?.amplitude || 0);
                    const amplitudeB = parseFloat(b.marketData?.amplitude || 0);
                    return amplitudeB - amplitudeA;
                });
                break;

            case 'priority':
                // 按自定义优先级排序
                this.stocks.sort((a, b) => {
                    const priorityA = parseInt(a.priority || 0);
                    const priorityB = parseInt(b.priority || 0);
                    return priorityB - priorityA;
                });
                break;

            case 'latest':
            default:
                // 按添加时间降序排序（最新的在前面）
                this.stocks.sort((a, b) => {
                    return new Date(b.created_at) - new Date(a.created_at);
                });
                break;
        }

        // 重新渲染
        this.render();
    },

    // 获取股票市场数据
    async fetchMarketData(stockCode) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/stock/quote/${stockCode}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return null;

            const quoteData = await response.json();
            if (!quoteData.success || !quoteData.data) return null;

            return {
                currentPrice: parseFloat(quoteData.data.currentPrice),
                changePercent: parseFloat(quoteData.data.changePercent || 0),
                volumeRatio: parseFloat(quoteData.data.volumeRatio || 0),
                turnoverRate: parseFloat(quoteData.data.turnoverRate || 0),
                amplitude: parseFloat(quoteData.data.amplitude || 0),
                high: parseFloat(quoteData.data.high || 0),
                low: parseFloat(quoteData.data.low || 0),
                volume: parseFloat(quoteData.data.volume || 0)
            };
        } catch (error) {
            console.error(`获取 ${stockCode} 市场数据失败:`, error);
            return null;
        }
    },

    // 批量获取所有股票的市场数据
    async fetchAllMarketData() {
        if (!this.stocks || this.stocks.length === 0) return;

        const promises = this.stocks.map(async (stock) => {
            const marketData = await this.fetchMarketData(stock.stock_code);
            stock.marketData = marketData;
        });

        await Promise.all(promises);
    },

    // 添加股票
    async addStock() {
        const result = await showInputDialog({
            title: '添加股票到短线池',
            fields: [
                { name: 'stock_code', label: '股票代码', type: 'text', placeholder: '例如: 600000', autoFill: true },
                { name: 'stock_name', label: '股票名称', type: 'text', placeholder: '自动匹配...', readonly: true },
                { name: 'current_price', label: '最新价格', type: 'text', placeholder: '自动获取...', readonly: true, isPriceDisplay: true },
                {
                    name: 'stock_type',
                    label: '股票类型',
                    type: 'select',
                    required: true,
                    options: [
                        { value: '', label: '请选择类型' },
                        { value: '首板', label: '首板' },
                        { value: '二板', label: '二板' },
                        { value: '三板', label: '三板' },
                        { value: '四板', label: '四板' },
                        { value: '五板', label: '五板' },
                        { value: '六板', label: '六板' },
                        { value: '七板', label: '七板' },
                        { value: '八板', label: '八板' },
                        { value: '九板', label: '九板' },
                        { value: '十板', label: '十板' },
                        { value: '十一板', label: '十一板' },
                        { value: '十二板', label: '十二板' },
                        { value: '十三板', label: '十三板' },
                        { value: '十四板', label: '十四板' },
                        { value: '十五板', label: '十五板' },
                        { value: '十六板', label: '十六板' },
                        { value: '十七板', label: '十七板' },
                        { value: '十八板', label: '十八板' },
                        { value: '十九板', label: '十九板' },
                        { value: '二十板', label: '二十板' },
                        { value: '大资金流入', label: '大资金流入' },
                        { value: '游资进入', label: '游资进入' },
                        { value: '概念龙头', label: '概念龙头' },
                        { value: '题材龙头', label: '题材龙头' },
                        { value: '板块龙头', label: '板块龙头' },
                        { value: '总龙头', label: '总龙头' },
                        { value: '跟风股', label: '跟风股' },
                        { value: '突破新高', label: '突破新高' },
                        { value: '回调低吸', label: '回调低吸' },
                        { value: '底部放量', label: '底部放量' },
                        { value: '反包板', label: '反包板' },
                        { value: '补涨股', label: '补涨股' },
                        { value: '打板', label: '打板' },
                        { value: '低吸', label: '低吸' }
                    ]
                },
                {
                    name: 'hot_money_name',
                    label: '游资名字',
                    type: 'text',
                    placeholder: '请填写游资名字...',
                    showWhen: { field: 'stock_type', value: '游资进入' }
                },
                {
                    name: 'board_shape',
                    label: '板型',
                    type: 'select',
                    options: [
                        { value: '', label: '请选择板型' },
                        { value: '一字板', label: '一字板' },
                        { value: 'T字板', label: 'T字板' },
                        { value: '正常板', label: '正常板' }
                    ],
                    showWhen: {
                        field: 'stock_type',
                        checkValue: (value) => {
                            const boardTypes = ['首板', '二板', '三板', '四板', '五板', '六板', '七板', '八板', '九板', '十板',
                                              '十一板', '十二板', '十三板', '十四板', '十五板', '十六板', '十七板', '十八板', '十九板', '二十板'];
                            return boardTypes.includes(value);
                        }
                    }
                },
                { name: 'tags', label: '相关概念/行业', type: 'text', placeholder: '例如: 人工智能,芯片,新能源（用逗号分隔）', required: true },
                { name: 'reason', label: '加入理由', type: 'textarea', placeholder: '说明加入短线池的理由，如技术形态、基本面、市场热点等...', required: true }
            ]
        });

        if (!result) return;

        if (!result.stock_code || !result.stock_name) {
            showMessage('股票代码和名称不能为空', 'error');
            return;
        }

        if (!result.tags || !result.tags.trim()) {
            showMessage('请填写相关概念或行业', 'error');
            return;
        }

        if (!result.reason || !result.reason.trim()) {
            showMessage('请填写加入短线池的理由', 'error');
            return;
        }

        if (!result.stock_type) {
            showMessage('请选择股票类型', 'error');
            return;
        }

        if (result.stock_type === '游资进入' && (!result.hot_money_name || !result.hot_money_name.trim())) {
            showMessage('请填写游资名字', 'error');
            return;
        }

        // 提取加入时的价格
        let entryPrice = null;
        if (result.current_price) {
            // 从格式如 "¥12.34 (+5.23%)" 中提取数字
            const priceMatch = result.current_price.match(/¥?([\d.]+)/);
            if (priceMatch) {
                entryPrice = parseFloat(priceMatch[1]);
            }
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/short-term-pool', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    stock_code: result.stock_code,
                    stock_name: result.stock_name,
                    tags: result.tags.trim(),
                    reason: result.reason.trim(),
                    entry_price: entryPrice,
                    stock_type: result.stock_type,
                    hot_money_name: result.hot_money_name ? result.hot_money_name.trim() : null,
                    board_shape: result.board_shape || null
                })
            });

            const data = await response.json();

            if (data.success) {
                showMessage('已添加到短线池', 'success');
                await this.loadData();
            } else {
                showMessage(data.error || '添加失败', 'error');
            }
        } catch (error) {
            console.error('添加股票失败:', error);
            showMessage('添加失败: ' + error.message, 'error');
        }
    },

    // 编辑股票
    async editStock(stockCode) {
        const stock = this.stocks.find(s => s.stock_code === stockCode);
        if (!stock) return;

        const result = await showInputDialog({
            title: `编辑 ${stock.stock_name} (${stock.stock_code})`,
            fields: [
                { name: 'tags', label: '相关概念/行业', type: 'text', value: stock.tags || '', placeholder: '例如: 人工智能,芯片,新能源（用逗号分隔）', required: true },
                { name: 'reason', label: '加入理由', type: 'textarea', value: stock.reason || '', placeholder: '说明加入短线池的理由，如技术形态、基本面、市场热点等...', required: true },
                {
                    name: 'stock_type',
                    label: '股票类型',
                    type: 'select',
                    value: stock.stock_type || '',
                    required: true,
                    options: [
                        { value: '', label: '请选择类型' },
                        { value: '首板', label: '首板' },
                        { value: '二板', label: '二板' },
                        { value: '三板', label: '三板' },
                        { value: '四板', label: '四板' },
                        { value: '五板', label: '五板' },
                        { value: '六板', label: '六板' },
                        { value: '七板', label: '七板' },
                        { value: '八板', label: '八板' },
                        { value: '九板', label: '九板' },
                        { value: '十板', label: '十板' },
                        { value: '十一板', label: '十一板' },
                        { value: '十二板', label: '十二板' },
                        { value: '十三板', label: '十三板' },
                        { value: '十四板', label: '十四板' },
                        { value: '十五板', label: '十五板' },
                        { value: '十六板', label: '十六板' },
                        { value: '十七板', label: '十七板' },
                        { value: '十八板', label: '十八板' },
                        { value: '十九板', label: '十九板' },
                        { value: '二十板', label: '二十板' },
                        { value: '大资金流入', label: '大资金流入' },
                        { value: '游资进入', label: '游资进入' },
                        { value: '概念龙头', label: '概念龙头' },
                        { value: '题材龙头', label: '题材龙头' },
                        { value: '板块龙头', label: '板块龙头' },
                        { value: '总龙头', label: '总龙头' },
                        { value: '跟风股', label: '跟风股' },
                        { value: '突破新高', label: '突破新高' },
                        { value: '回调低吸', label: '回调低吸' },
                        { value: '底部放量', label: '底部放量' },
                        { value: '反包板', label: '反包板' },
                        { value: '补涨股', label: '补涨股' },
                        { value: '打板', label: '打板' },
                        { value: '低吸', label: '低吸' }
                    ]
                },
                {
                    name: 'hot_money_name',
                    label: '游资名字',
                    type: 'text',
                    value: stock.hot_money_name || '',
                    placeholder: '请填写游资名字...',
                    showWhen: { field: 'stock_type', value: '游资进入' }
                },
                {
                    name: 'board_shape',
                    label: '板型',
                    type: 'select',
                    value: stock.board_shape || '',
                    options: [
                        { value: '', label: '请选择板型' },
                        { value: '一字板', label: '一字板' },
                        { value: 'T字板', label: 'T字板' },
                        { value: '正常板', label: '正常板' }
                    ],
                    showWhen: {
                        field: 'stock_type',
                        checkValue: (value) => {
                            const boardTypes = ['首板', '二板', '三板', '四板', '五板', '六板', '七板', '八板', '九板', '十板',
                                              '十一板', '十二板', '十三板', '十四板', '十五板', '十六板', '十七板', '十八板', '十九板', '二十板'];
                            return boardTypes.includes(value);
                        }
                    }
                },
                { name: 'entry_price', label: '入场价（选填）', type: 'number', value: stock.entry_price || '', placeholder: '计划买入价格', required: false },
                { name: 'target_price', label: '目标价（选填）', type: 'number', value: stock.target_price || '', placeholder: '预期卖出价格', required: false },
                { name: 'stop_loss_price', label: '止损价（选填）', type: 'number', value: stock.stop_loss_price || '', placeholder: '止损价格', required: false },
                { name: 'priority', label: '优先级（0-5）', type: 'number', value: stock.priority || 0 },
                { name: 'status', label: '状态', type: 'select', value: stock.status, options: [
                    { value: 'watching', label: '观察中' },
                    { value: 'ready', label: '准备买入' },
                    { value: 'holding', label: '已持仓' },
                    { value: 'sold', label: '已卖出' }
                ]}
            ],
            onDialogShown: async (content) => {
                // 对话框显示后，自动获取最新的行业信息
                const tagsInput = content.querySelector('[name="tags"]');
                if (!tagsInput) return;

                try {
                    // 显示加载状态
                    const originalValue = tagsInput.value;
                    tagsInput.value = '正在获取最新行业信息...';
                    tagsInput.style.color = '#9ca3af';

                    const token = localStorage.getItem('token');
                    const industryResponse = await fetch(`/api/stock/industry/${stockCode}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (industryResponse.ok) {
                        const industryData = await industryResponse.json();
                        if (industryData.success && industryData.data && industryData.data.allTags) {
                            // 如果获取到新的行业信息，更新输入框
                            tagsInput.value = industryData.data.allTags;
                            tagsInput.style.color = '#10b981';

                            // 3秒后恢复正常颜色
                            setTimeout(() => {
                                tagsInput.style.color = '';
                            }, 3000);
                        } else {
                            // 如果没有获取到数据，恢复原值
                            tagsInput.value = originalValue;
                            tagsInput.style.color = '';
                        }
                    } else {
                        // 请求失败，恢复原值
                        tagsInput.value = originalValue;
                        tagsInput.style.color = '';
                    }
                } catch (error) {
                    console.error('获取行业信息失败:', error);
                    // 出错时恢复原值
                    const originalValue = stock.tags || '';
                    tagsInput.value = originalValue;
                    tagsInput.style.color = '';
                }
            }
        });

        if (!result) return;

        if (!result.tags || !result.tags.trim()) {
            showMessage('请填写相关概念或行业', 'error');
            return;
        }

        if (!result.reason || !result.reason.trim()) {
            showMessage('请填写加入短线池的理由', 'error');
            return;
        }

        if (!result.stock_type) {
            showMessage('请选择股票类型', 'error');
            return;
        }

        if (result.stock_type === '游资进入' && (!result.hot_money_name || !result.hot_money_name.trim())) {
            showMessage('请填写游资名字', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/short-term-pool/${stockCode}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    entry_price: result.entry_price ? parseFloat(result.entry_price) : null,
                    target_price: result.target_price ? parseFloat(result.target_price) : null,
                    stop_loss_price: result.stop_loss_price ? parseFloat(result.stop_loss_price) : null,
                    tags: result.tags.trim(),
                    reason: result.reason.trim(),
                    priority: parseInt(result.priority) || 0,
                    status: result.status,
                    stock_type: result.stock_type,
                    hot_money_name: result.hot_money_name ? result.hot_money_name.trim() : null,
                    board_shape: result.board_shape || null
                })
            });

            const data = await response.json();

            if (data.success) {
                showMessage('更新成功', 'success');
                await this.loadData();
            } else {
                showMessage(data.error || '更新失败', 'error');
            }
        } catch (error) {
            console.error('更新股票失败:', error);
            showMessage('更新失败: ' + error.message, 'error');
        }
    },

    // 删除股票
    async deleteStock(stockCode) {
        const stock = this.stocks.find(s => s.stock_code === stockCode);
        if (!stock) return;

        if (!confirm(`确定要从短线池移除 ${stock.stock_name}(${stock.stock_code}) 吗？`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/short-term-pool/${stockCode}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (data.success) {
                showMessage('已从短线池移除', 'success');
                await this.loadData();
            } else {
                showMessage(data.error || '删除失败', 'error');
            }
        } catch (error) {
            console.error('删除股票失败:', error);
            showMessage('删除失败: ' + error.message, 'error');
        }
    },

    // 按状态筛选
    async filterByStatus(status) {
        await this.loadData(status);
    },

    // 刷新
    async refresh() {
        const statusFilter = document.getElementById('poolStatusFilter');
        const status = statusFilter ? statusFilter.value : '';
        await this.loadData(status || null);
        this.bindSortButtons(); // 重新绑定排序按钮
        showMessage('已刷新', 'success');
    }
};

// ==================== 止盈止损管理 ====================
const ShortTermStopLoss = {
    settings: [],
    positions: [],
    alerts: [],

    // 初始化
    async init() {
        console.log('初始化止盈止损...');
        const content = document.getElementById('shortTermStopLossContent');

        content.innerHTML = `
            <div class="stop-loss-actions" style="margin-bottom: 20px; display: flex; gap: 12px; align-items: center;">
                <button class="action-btn primary" onclick="ShortTermStopLoss.batchSetup()">
                    <span class="btn-icon">⚡</span>
                    <span class="btn-text">批量设置（基于持仓）</span>
                </button>
                <button class="action-btn secondary" onclick="ShortTermStopLoss.refresh()">
                    <span class="btn-icon">🔄</span>
                    <span class="btn-text">刷新</span>
                </button>
                <button class="action-btn secondary" onclick="ShortTermStopLoss.markAllRead()">
                    <span class="btn-icon">✓</span>
                    <span class="btn-text">全部已读</span>
                </button>
                <div id="alertBadge" style="margin-left: auto; display: none;">
                    <span style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                        <span id="unreadCount">0</span> 条未读提醒
                    </span>
                </div>
            </div>
            <div id="alertsContainer"></div>
            <div id="stopLossListContainer">
                <div class="loading-text">正在加载止盈止损设置...</div>
            </div>
        `;

        await this.loadData();
    },

    // 加载数据
    async loadData() {
        try {
            const token = localStorage.getItem('token');

            // 并行加载持仓、止盈止损设置和价格告警
            const [positionsRes, settingsRes, alertsRes] = await Promise.all([
                fetch('/api/positions', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/stop-loss', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/price-alerts?limit=10', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (!positionsRes.ok || !settingsRes.ok) {
                throw new Error('加载数据失败');
            }

            const positionsData = await positionsRes.json();
            const settingsData = await settingsRes.json();
            const alertsData = alertsRes.ok ? await alertsRes.json() : { data: [] };

            this.positions = positionsData.data?.positions || [];
            this.settings = settingsData.data || [];
            this.alerts = alertsData.data || [];

            await this.renderAlerts();
            await this.render();
        } catch (error) {
            console.error('加载止盈止损数据失败:', error);
            document.getElementById('stopLossListContainer').innerHTML = `
                <div class="error-message">
                    <span class="error-icon">❌</span>
                    <span>加载数据失败: ${error.message}</span>
                </div>
            `;
        }
    },

    // 渲染界面
    async render() {
        const container = document.getElementById('stopLossListContainer');

        if (this.positions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div class="empty-title">暂无持仓</div>
                    <div class="empty-desc">请先添加持仓，然后可以为持仓设置止盈止损</div>
                </div>
            `;
            return;
        }

        // 合并持仓和设置数据
        const mergedData = this.positions.map(pos => {
            const posStockCode = pos.stock_code || pos.stockCode;
            const setting = this.settings.find(s => s.stock_code === posStockCode);
            return {
                ...pos,
                setting: setting || null
            };
        });

        let html = '<div class="stop-loss-grid">';

        for (const item of mergedData) {
            // 支持两种字段命名格式：camelCase 和 snake_case
            const costPrice = item.costPrice || item.cost_price || 0;
            const currentPrice = item.currentPrice || item.current_price || costPrice;
            const stockCode = item.stockCode || item.stock_code || '';
            const stockName = item.stockName || item.stock_name || '';

            const profitLoss = costPrice > 0 ? ((currentPrice - costPrice) / costPrice * 100).toFixed(2) : '0.00';
            const isProfitable = parseFloat(profitLoss) >= 0;

            const setting = item.setting;
            const stopLossPercent = setting?.stop_loss_percent || -5;
            const stopProfitPercent = setting?.stop_profit_percent || 10;
            const stopLossPrice = (costPrice * (1 + stopLossPercent / 100)).toFixed(2);
            const stopProfitPrice = (costPrice * (1 + stopProfitPercent / 100)).toFixed(2);

            // 计算状态
            let status = 'normal';
            let statusText = '正常';
            if (currentPrice <= parseFloat(stopLossPrice)) {
                status = 'danger';
                statusText = '⚠️ 已触发止损';
            } else if (currentPrice >= parseFloat(stopProfitPrice)) {
                status = 'safe';
                statusText = '✅ 已达止盈';
            } else if (currentPrice <= parseFloat(stopLossPrice) * 1.02) {
                status = 'warning';
                statusText = '⚠️ 接近止损';
            }

            html += `
                <div class="stop-loss-card ${status}">
                    <div class="stop-loss-header">
                        <div>
                            <span class="stop-loss-stock-name">${stockName}</span>
                            <span class="stop-loss-stock-code">${stockCode}</span>
                        </div>
                        <div class="stop-loss-actions-mini">
                            <button class="icon-btn" onclick="ShortTermStopLoss.editSetting('${stockCode}')" title="设置">⚙️</button>
                        </div>
                    </div>

                    <div class="stop-loss-price-info">
                        <div class="price-item">
                            <div class="price-label">成本价</div>
                            <div class="price-value cost">¥${costPrice.toFixed(2)}</div>
                        </div>
                        <div class="price-item">
                            <div class="price-label">现价</div>
                            <div class="price-value current">¥${currentPrice.toFixed(2)}</div>
                        </div>
                        <div class="price-item">
                            <div class="price-label">盈亏</div>
                            <div class="price-value ${isProfitable ? 'profit' : 'loss'}">
                                ${isProfitable ? '+' : ''}${profitLoss}%
                            </div>
                        </div>
                    </div>

                    <div class="stop-loss-targets">
                        <div class="target-row">
                            <span class="target-label">止损位 (${stopLossPercent}%)</span>
                            <span class="target-value stop-loss">¥${stopLossPrice}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill ${status === 'danger' ? 'danger' : ''}"
                                 style="width: ${Math.max(0, Math.min(100, ((currentPrice - stopLossPrice) / (item.cost_price - stopLossPrice) * 100)))}%">
                            </div>
                        </div>
                        <div class="target-row">
                            <span class="target-label">止盈位 (+${stopProfitPercent}%)</span>
                            <span class="target-value stop-profit">¥${stopProfitPrice}</span>
                        </div>
                    </div>

                    <div class="stop-loss-status" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 14px; font-weight: 600;">
                        ${statusText}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    // 渲染告警
    async renderAlerts() {
        const container = document.getElementById('alertsContainer');
        const badgeContainer = document.getElementById('alertBadge');
        const unreadCountSpan = document.getElementById('unreadCount');

        const unreadCount = this.alerts.filter(a => !a.is_read).length;

        // 更新未读数量徽章
        if (unreadCount > 0) {
            badgeContainer.style.display = 'block';
            unreadCountSpan.textContent = unreadCount;
        } else {
            badgeContainer.style.display = 'none';
        }

        // 如果没有告警，不显示告警区域
        if (this.alerts.length === 0) {
            container.innerHTML = '';
            return;
        }

        let html = '<div class="alerts-section" style="margin-bottom: 24px;">';
        html += '<h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #1f2937;">最近提醒</h3>';
        html += '<div class="alerts-list">';

        this.alerts.forEach(alert => {
            const alertTypeMap = {
                'stop_loss': { icon: '⚠️', text: '止损触发', color: '#ef4444' },
                'stop_profit': { icon: '✅', text: '止盈触发', color: '#10b981' },
                'warning': { icon: '⚡', text: '接近止损', color: '#f59e0b' }
            };

            const alertInfo = alertTypeMap[alert.alert_type] || { icon: '🔔', text: '提醒', color: '#6b7280' };
            const isUnread = !alert.is_read;
            const createdTime = new Date(alert.created_at).toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            });

            html += `
                <div class="alert-item ${isUnread ? 'unread' : ''}" style="
                    padding: 12px 16px;
                    margin-bottom: 8px;
                    background: ${isUnread ? '#fef2f2' : '#f9fafb'};
                    border-left: 4px solid ${alertInfo.color};
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                " onclick="ShortTermStopLoss.markAlertRead(${alert.id})">
                    <span style="font-size: 20px;">${alertInfo.icon}</span>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; color: #1f2937; margin-bottom: 4px;">
                            <strong>${alert.stock_name} (${alert.stock_code})</strong>
                            <span style="background: ${alertInfo.color}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-left: 8px;">
                                ${alertInfo.text}
                            </span>
                        </div>
                        <div style="font-size: 13px; color: #6b7280;">
                            ${alert.alert_message}
                        </div>
                    </div>
                    <div style="font-size: 12px; color: #9ca3af; white-space: nowrap;">
                        ${createdTime}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        html += '</div>';

        container.innerHTML = html;
    },

    // 标记告警为已读
    async markAlertRead(alertId) {
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/price-alerts/${alertId}/read`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // 更新本地状态
            const alert = this.alerts.find(a => a.id === alertId);
            if (alert) {
                alert.is_read = 1;
            }

            await this.renderAlerts();
        } catch (error) {
            console.error('标记告警已读失败:', error);
        }
    },

    // 标记所有告警为已读
    async markAllRead() {
        try {
            const token = localStorage.getItem('token');
            await fetch('/api/price-alerts/read-all', {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // 更新本地状态
            this.alerts.forEach(alert => alert.is_read = 1);

            await this.renderAlerts();
            showMessage('所有提醒已标记为已读', 'success');
        } catch (error) {
            console.error('标记所有告警已读失败:', error);
            showMessage('操作失败', 'error');
        }
    },

    // 批量设置
    async batchSetup() {
        const result = await showInputDialog({
            title: '批量设置止盈止损',
            fields: [
                { name: 'stopLossPercent', label: '止损百分比 (%)', type: 'number', value: '-5', placeholder: '例如: -5 表示成本价下跌5%' },
                { name: 'stopProfitPercent', label: '止盈百分比 (%)', type: 'number', value: '10', placeholder: '例如: 10 表示成本价上涨10%' },
                { name: 'alertEnabled', label: '启用价格提醒', type: 'checkbox', value: true }
            ]
        });

        if (!result) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/stop-loss/batch/from-positions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    stop_loss_percent: parseFloat(result.stopLossPercent),
                    stop_profit_percent: parseFloat(result.stopProfitPercent),
                    alert_enabled: result.alertEnabled
                })
            });

            const data = await response.json();

            if (data.success) {
                showMessage(`已为${data.count}个持仓设置止盈止损`, 'success');
                await this.loadData();
            } else {
                showMessage(data.error || '批量设置失败', 'error');
            }
        } catch (error) {
            console.error('批量设置失败:', error);
            showMessage('批量设置失败: ' + error.message, 'error');
        }
    },

    // 编辑设置
    async editSetting(stockCode) {
        // 支持两种字段命名格式：camelCase 和 snake_case
        const position = this.positions.find(p =>
            (p.stock_code === stockCode) || (p.stockCode === stockCode)
        );
        const setting = this.settings.find(s => s.stock_code === stockCode);

        if (!position) {
            showMessage('找不到持仓信息', 'error');
            return;
        }

        // 统一字段名
        const posStockName = position.stock_name || position.stockName || '';
        const posCostPrice = position.cost_price || position.costPrice || 0;

        const result = await showInputDialog({
            title: `设置止盈止损策略 - ${posStockName}`,
            fields: [
                {
                    name: 'costPrice',
                    label: '成本价 (¥)',
                    type: 'number',
                    value: posCostPrice.toFixed(2),
                    readonly: true
                },
                {
                    name: 'strategyType',
                    label: '策略类型',
                    type: 'select',
                    value: setting?.strategy_type || 'basic',
                    options: [
                        { value: 'basic', label: '📊 基础策略 - 固定百分比' },
                        { value: 'trailing', label: '📈 移动止损 - 跟踪涨幅' },
                        { value: 'breakeven', label: '🔒 保本止损 - 锁定利润' },
                        { value: 'tiered', label: '🎯 分批止盈 - 梯度卖出' },
                        { value: 'time_based', label: '⏰ 时间止损 - 定期平仓' }
                    ],
                    tip: '选择适合您的止盈止损策略。不同策略适用于不同的市场环境和风险偏好。'
                },

                // 基础策略字段
                {
                    name: 'stopLossPercent',
                    label: '止损百分比 (%)',
                    type: 'number',
                    value: (setting?.stop_loss_percent || -5).toString(),
                    placeholder: '-5',
                    tip: '当价格下跌到此百分比时自动触发止损。例如：-5 表示跌5%止损。建议设置在-3%到-10%之间。'
                },
                {
                    name: 'stopProfitPercent',
                    label: '止盈百分比 (%)',
                    type: 'number',
                    value: (setting?.stop_profit_percent || 10).toString(),
                    placeholder: '10',
                    tip: '当价格上涨到此百分比时触发止盈。例如：10 表示涨10%止盈。建议根据个股波动性设置。'
                },

                // 移动止损策略字段
                {
                    name: 'enableTrailingStop',
                    label: '启用移动止损',
                    type: 'checkbox',
                    value: setting?.enable_trailing_stop || false,
                    checkboxLabel: '跟踪最高价自动上移止损位',
                    showWhen: { field: 'strategyType', value: 'trailing' },
                    tip: '移动止损会跟踪最高价自动上移止损位，帮助您锁定更多利润。适合趋势明显的股票。'
                },
                {
                    name: 'trailingTrigger',
                    label: '触发阈值 (%)',
                    type: 'number',
                    value: (setting?.trailing_stop_trigger || 5).toString(),
                    placeholder: '5',
                    showWhen: { field: 'strategyType', value: 'trailing' },
                    tip: '当盈利达到此百分比后，止损位会随最高价上移。例如：5 表示盈利5%后开始移动止损。'
                },

                // 保本止损策略字段
                {
                    name: 'enableBreakeven',
                    label: '启用保本止损',
                    type: 'checkbox',
                    value: setting?.enable_breakeven_stop || false,
                    checkboxLabel: '盈利后自动上移止损至成本价',
                    showWhen: { field: 'strategyType', value: 'breakeven' },
                    tip: '当股价盈利后，自动将止损位上移至成本价，确保不亏损。适合稳健型投资者。'
                },
                {
                    name: 'breakevenTrigger',
                    label: '保本触发点 (%)',
                    type: 'number',
                    value: (setting?.breakeven_trigger_percent || 3).toString(),
                    placeholder: '3',
                    showWhen: { field: 'strategyType', value: 'breakeven' },
                    tip: '当盈利达到此百分比时，止损位自动上移至成本价。例如：3 表示盈利3%后保本。'
                },

                // 分批止盈策略字段
                {
                    name: 'tieredProfit1',
                    label: '第一档止盈 (涨幅%/卖出%)',
                    type: 'text',
                    value: setting?.tiered_profit_taking ? JSON.parse(setting.tiered_profit_taking)[0] || '5,30' : '5,30',
                    placeholder: '5,30',
                    showWhen: { field: 'strategyType', value: 'tiered' },
                    tip: '格式：涨幅,卖出比例。例如"5,30"表示涨5%时卖出30%仓位。'
                },
                {
                    name: 'tieredProfit2',
                    label: '第二档止盈 (涨幅%/卖出%)',
                    type: 'text',
                    value: setting?.tiered_profit_taking ? JSON.parse(setting.tiered_profit_taking)[1] || '10,40' : '10,40',
                    placeholder: '10,40',
                    showWhen: { field: 'strategyType', value: 'tiered' },
                    tip: '第二档止盈设置。例如"10,40"表示涨10%时再卖出40%仓位（累计卖出70%）。'
                },
                {
                    name: 'tieredProfit3',
                    label: '第三档止盈 (涨幅%/卖出%)',
                    type: 'text',
                    value: setting?.tiered_profit_taking ? JSON.parse(setting.tiered_profit_taking)[2] || '15,30' : '15,30',
                    placeholder: '15,30',
                    showWhen: { field: 'strategyType', value: 'tiered' },
                    tip: '第三档止盈设置。例如"15,30"表示涨15%时清仓（卖出剩余30%）。'
                },

                // 时间止损策略字段
                {
                    name: 'timeDays',
                    label: '持仓天数限制',
                    type: 'number',
                    value: (setting?.time_based_stop_days || 0).toString(),
                    placeholder: '5',
                    showWhen: { field: 'strategyType', value: 'time_based' },
                    tip: '超过此天数自动平仓。适合短线交易，避免资金占用过久。例如：5 表示持仓5天后自动卖出。'
                },

                // 金额止损止盈字段（所有策略通用）
                {
                    name: 'maxLossAmount',
                    label: '最大亏损金额 (¥，选填)',
                    type: 'number',
                    value: (setting?.max_loss_amount || 0).toString(),
                    placeholder: '0',
                    required: false,
                    tip: '设置最大可接受的亏损金额。到达此金额立即止损，优先于百分比止损。留空则不启用。'
                },
                {
                    name: 'targetProfitAmount',
                    label: '目标盈利金额 (¥，选填)',
                    type: 'number',
                    value: (setting?.target_profit_amount || 0).toString(),
                    placeholder: '0',
                    required: false,
                    tip: '设置目标盈利金额。到达此金额自动止盈。适合有明确盈利目标的投资者。留空则不启用。'
                },

                // 通用设置
                {
                    name: 'alertEnabled',
                    label: '价格提醒',
                    type: 'checkbox',
                    value: setting?.alert_enabled !== false,
                    checkboxLabel: '到达止盈止损价位时发送通知',
                    tip: '启用后，当价格触及设定的止盈止损价位时，系统会发送提醒通知。'
                }
            ]
        });

        if (!result) return;

        try {
            // 准备分批止盈数据
            let tieredProfitTaking = null;
            if (result.strategyType === 'tiered') {
                tieredProfitTaking = JSON.stringify([
                    result.tieredProfit1 || '5,30',
                    result.tieredProfit2 || '10,40',
                    result.tieredProfit3 || '15,30'
                ]);
            }

            const token = localStorage.getItem('token');
            const response = await fetch('/api/stop-loss', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    stock_code: stockCode,
                    stock_name: posStockName,
                    cost_price: posCostPrice,
                    strategy_type: result.strategyType,
                    stop_loss_percent: parseFloat(result.stopLossPercent),
                    stop_profit_percent: parseFloat(result.stopProfitPercent),
                    enable_trailing_stop: result.enableTrailingStop || false,
                    trailing_stop_trigger: parseFloat(result.trailingTrigger) || 5.0,
                    enable_breakeven_stop: result.enableBreakeven || false,
                    breakeven_trigger_percent: parseFloat(result.breakevenTrigger) || 3.0,
                    time_based_stop_days: parseInt(result.timeDays) || 0,
                    tiered_profit_taking: tieredProfitTaking,
                    max_loss_amount: parseFloat(result.maxLossAmount) || 0,
                    target_profit_amount: parseFloat(result.targetProfitAmount) || 0,
                    alert_enabled: result.alertEnabled
                })
            });

            const data = await response.json();

            if (data.success) {
                showMessage('止盈止损设置已保存', 'success');
                await this.loadData();
            } else {
                showMessage(data.error || '保存失败', 'error');
            }
        } catch (error) {
            console.error('保存设置失败:', error);
            showMessage('保存失败: ' + error.message, 'error');
        }
    },

    // 刷新
    async refresh() {
        await this.loadData();
        showMessage('已刷新', 'success');
    }
};

// ==================== 快速决策面板 ====================
const ShortTermDecision = {
    positions: [],
    poolStocks: [],
    stopLossSettings: [],

    async init() {
        console.log('初始化快速决策面板...');
        const content = document.getElementById('shortTermDecisionContent');

        content.innerHTML = `
            <div style="margin-bottom: 20px; display: flex; gap: 12px; align-items: center;">
                <button class="action-btn secondary" onclick="ShortTermDecision.refresh()">
                    <span class="btn-icon">🔄</span>
                    <span class="btn-text">刷新</span>
                </button>
                <div style="margin-left: auto; font-size: 14px; color: #6b7280;">
                    快速决策参考（基于持仓和短线池）
                </div>
            </div>
            <div id="decisionContent">
                <div class="loading-text">正在加载决策面板...</div>
            </div>
        `;

        await this.loadData();
    },

    async loadData() {
        try {
            const token = localStorage.getItem('token');

            const [positionsRes, poolRes, stopLossRes] = await Promise.all([
                fetch('/api/positions', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/short-term-pool?status=watching', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/stop-loss', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            const positionsData = await positionsRes.json();
            const poolData = await poolRes.json();
            const stopLossData = await stopLossRes.json();

            this.positions = positionsData.data || [];
            this.poolStocks = poolData.data || [];
            this.stopLossSettings = stopLossData.data || [];

            await this.render();
        } catch (error) {
            console.error('加载快速决策数据失败:', error);
            document.getElementById('decisionContent').innerHTML = `<div class="error-message">加载失败</div>`;
        }
    },

    async render() {
        const container = document.getElementById('decisionContent');

        if (this.positions.length === 0 && this.poolStocks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚡</div>
                    <div class="empty-title">暂无决策数据</div>
                    <div class="empty-desc">请先添加持仓或短线池股票</div>
                </div>
            `;
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 24px;">';

        // 持仓决策
        if (this.positions.length > 0) {
            html += `
                <div>
                    <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">持仓决策 (${this.positions.length})</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 16px;">
            `;

            for (const pos of this.positions) {
                const stopLoss = this.stopLossSettings.find(s => s.stock_code === pos.stock_code);
                const currentPrice = pos.current_price || pos.cost_price;
                const profitLoss = ((currentPrice - pos.cost_price) / pos.cost_price * 100).toFixed(2);
                const isProfitable = parseFloat(profitLoss) >= 0;

                // 决策评分逻辑
                let decision = '';
                let decisionColor = '';
                let score = 0;

                if (stopLoss) {
                    const stopLossPrice = pos.cost_price * (1 + (stopLoss.stop_loss_percent || -5) / 100);
                    const stopProfitPrice = pos.cost_price * (1 + (stopLoss.stop_profit_percent || 10) / 100);

                    if (currentPrice <= stopLossPrice) {
                        decision = '⚠️ 建议止损';
                        decisionColor = '#ef4444';
                        score = 2;
                    } else if (currentPrice >= stopProfitPrice) {
                        decision = '✅ 建议止盈';
                        decisionColor = '#10b981';
                        score = 8;
                    } else if (currentPrice <= stopLossPrice * 1.02) {
                        decision = '⚡ 接近止损，注意风险';
                        decisionColor = '#f59e0b';
                        score = 3;
                    } else if (parseFloat(profitLoss) > 5) {
                        decision = '📈 适度盈利，可考虑减仓';
                        decisionColor = '#3b82f6';
                        score = 7;
                    } else if (parseFloat(profitLoss) < -3) {
                        decision = '📉 轻度亏损，密切关注';
                        decisionColor = '#f59e0b';
                        score = 4;
                    } else {
                        decision = '⏳ 持有观察';
                        decisionColor = '#6b7280';
                        score = 5;
                    }
                } else {
                    if (parseFloat(profitLoss) > 10) {
                        decision = '📈 盈利较多，建议设置止盈';
                        decisionColor = '#10b981';
                        score = 7;
                    } else if (parseFloat(profitLoss) < -5) {
                        decision = '📉 亏损较多，建议设置止损';
                        decisionColor = '#ef4444';
                        score = 3;
                    } else {
                        decision = '⚙️ 建议设置止盈止损';
                        decisionColor = '#6b7280';
                        score = 5;
                    }
                }

                html += `
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div>
                                <span style="font-weight: 600; font-size: 15px;">${pos.stock_name}</span>
                                <span style="color: #6b7280; margin-left: 8px; font-size: 13px;">${pos.stock_code}</span>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 18px; font-weight: 700; color: ${isProfitable ? '#10b981' : '#ef4444'};">
                                    ${isProfitable ? '+' : ''}${profitLoss}%
                                </div>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; font-size: 13px;">
                            <div><span style="color: #6b7280;">成本:</span> ¥${pos.cost_price.toFixed(2)}</div>
                            <div><span style="color: #6b7280;">现价:</span> ¥${currentPrice.toFixed(2)}</div>
                            <div><span style="color: #6b7280;">持仓:</span> ${pos.quantity}股</div>
                            <div><span style="color: #6b7280;">市值:</span> ¥${(currentPrice * pos.quantity).toFixed(0)}</div>
                        </div>
                        <div style="padding: 12px; background: ${decisionColor}15; border-left: 3px solid ${decisionColor}; border-radius: 4px;">
                            <div style="font-weight: 600; color: ${decisionColor}; margin-bottom: 4px;">${decision}</div>
                            <div style="font-size: 12px; color: #6b7280;">决策评分: ${'★'.repeat(Math.min(score, 10))}${'☆'.repeat(Math.max(10 - score, 0))}</div>
                        </div>
                    </div>
                `;
            }

            html += '</div></div>';
        }

        // 短线池决策
        if (this.poolStocks.length > 0) {
            html += `
                <div>
                    <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">短线池机会 (${this.poolStocks.length})</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 16px;">
            `;

            for (const stock of this.poolStocks.slice(0, 6)) {
                const priority = stock.priority || 0;
                const tags = stock.tags ? stock.tags.split(',').filter(t => t.trim()) : [];

                let buySignal = '';
                let signalColor = '';

                if (priority >= 4) {
                    buySignal = '🔥 高优先级，建议关注';
                    signalColor = '#ef4444';
                } else if (priority >= 3) {
                    buySignal = '⚡ 中等机会，可考虑';
                    signalColor = '#f59e0b';
                } else {
                    buySignal = '👀 继续观察';
                    signalColor = '#6b7280';
                }

                html += `
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div>
                                <span style="font-weight: 600; font-size: 15px;">${stock.stock_name}</span>
                                <span style="color: #6b7280; margin-left: 8px; font-size: 13px;">${stock.stock_code}</span>
                            </div>
                            <div style="font-size: 18px;">
                                ${'★'.repeat(Math.min(priority, 5))}${'☆'.repeat(Math.max(5 - priority, 0))}
                            </div>
                        </div>
                        ${stock.entry_price || stock.target_price ? `
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; font-size: 13px;">
                            ${stock.entry_price ? `<div><span style="color: #6b7280;">入场价:</span> ¥${parseFloat(stock.entry_price).toFixed(2)}</div>` : ''}
                            ${stock.target_price ? `<div><span style="color: #6b7280;">目标价:</span> ¥${parseFloat(stock.target_price).toFixed(2)}</div>` : ''}
                        </div>
                        ` : ''}
                        ${tags.length > 0 ? `
                        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
                            ${tags.map(tag => `<span style="background: #eff6ff; color: #3b82f6; padding: 2px 8px; border-radius: 10px; font-size: 12px;">${tag.trim()}</span>`).join('')}
                        </div>
                        ` : ''}
                        <div style="padding: 12px; background: ${signalColor}15; border-left: 3px solid ${signalColor}; border-radius: 4px;">
                            <div style="font-weight: 600; color: ${signalColor};">${buySignal}</div>
                            ${stock.reason ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${stock.reason.substring(0, 60)}${stock.reason.length > 60 ? '...' : ''}</div>` : ''}
                        </div>
                    </div>
                `;
            }

            html += '</div></div>';
        }

        html += '</div>';
        container.innerHTML = html;
    },

    async refresh() {
        await this.loadData();
        showMessage('已刷新', 'success');
    }
};

// ==================== 复盘笔记管理 ====================
const ShortTermReview = {
    reviews: [],
    currentReview: null,

    async init() {
        console.log('初始化复盘笔记...');
        const content = document.getElementById('shortTermReviewContent');
        const today = new Date().toISOString().split('T')[0];

        content.innerHTML = `
            <div style="margin-bottom: 20px; display: flex; gap: 12px; align-items: center;">
                <button class="action-btn primary" onclick="ShortTermReview.createReview()">
                    <span class="btn-icon">📝</span>
                    <span class="btn-text">写今日复盘</span>
                </button>
                <button class="action-btn secondary" onclick="ShortTermReview.refresh()">
                    <span class="btn-icon">🔄</span>
                    <span class="btn-text">刷新</span>
                </button>
                <input type="date" id="reviewDatePicker" value="${today}" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;" onchange="ShortTermReview.loadByDate(this.value)">
            </div>
            <div id="reviewContent">
                <div class="loading-text">正在加载复盘笔记...</div>
            </div>
        `;

        await this.loadData();
    },

    async loadData() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/short-term/reviews', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            this.reviews = data.data || [];
            await this.render();
        } catch (error) {
            console.error('加载复盘笔记失败:', error);
            document.getElementById('reviewContent').innerHTML = `<div class="error-message">加载失败</div>`;
        }
    },

    async loadByDate(date) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/short-term/reviews?date=${date}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            this.currentReview = data.data;
            await this.renderSingle();
        } catch (error) {
            console.error('加载复盘笔记失败:', error);
        }
    },

    async render() {
        const container = document.getElementById('reviewContent');

        if (this.reviews.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <div class="empty-title">暂无复盘笔记</div>
                    <div class="empty-desc">点击"写今日复盘"开始记录</div>
                </div>
            `;
            return;
        }

        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">';
        for (const review of this.reviews) {
            const moodEmojis = ['😢', '😟', '😐', '🙂', '😊'];
            const moodEmoji = moodEmojis[(review.mood_score || 3) - 1] || '😐';
            const profitColor = review.profit_loss > 0 ? '#10b981' : review.profit_loss < 0 ? '#ef4444' : '#6b7280';

            html += `
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; cursor: pointer;" onclick="ShortTermReview.loadByDate('${review.review_date}')">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="font-weight: 600;">${review.review_date}</span>
                        <span style="font-size: 20px;">${moodEmoji}</span>
                    </div>
                    <div style="font-size: 24px; font-weight: 700; color: ${profitColor}; margin-bottom: 8px;">
                        ${review.profit_loss >= 0 ? '+' : ''}¥${(review.profit_loss || 0).toFixed(2)}
                    </div>
                    ${review.market_summary ? `<div style="font-size: 13px; color: #6b7280; line-height: 1.5;">${review.market_summary.substring(0, 50)}${review.market_summary.length > 50 ? '...' : ''}</div>` : ''}
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    },

    async renderSingle() {
        const container = document.getElementById('reviewContent');

        if (!this.currentReview) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <div class="empty-title">该日期暂无复盘</div>
                    <div class="empty-desc">点击"写今日复盘"开始记录</div>
                </div>
            `;
            return;
        }

        const review = this.currentReview;
        const moodEmojis = ['😢', '😟', '😐', '🙂', '😊'];
        const moodEmoji = moodEmojis[(review.mood_score || 3) - 1] || '😐';
        const profitColor = review.profit_loss > 0 ? '#10b981' : review.profit_loss < 0 ? '#ef4444' : '#6b7280';

        container.innerHTML = `
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="font-size: 18px; font-weight: 600; margin: 0;">${review.review_date} 复盘</h3>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 24px;">${moodEmoji}</span>
                        <span style="font-size: 20px; font-weight: 700; color: ${profitColor};">${review.profit_loss >= 0 ? '+' : ''}¥${(review.profit_loss || 0).toFixed(2)}</span>
                    </div>
                </div>
                ${review.market_summary ? `<div style="margin-bottom: 16px;"><strong>市场总结</strong><p style="color: #374151; line-height: 1.6; margin-top: 4px;">${review.market_summary}</p></div>` : ''}
                ${review.today_operations ? `<div style="margin-bottom: 16px;"><strong>今日操作</strong><p style="color: #374151; line-height: 1.6; margin-top: 4px;">${review.today_operations}</p></div>` : ''}
                ${review.lessons_learned ? `<div style="margin-bottom: 16px;"><strong>经验教训</strong><p style="color: #374151; line-height: 1.6; margin-top: 4px;">${review.lessons_learned}</p></div>` : ''}
                ${review.tomorrow_plan ? `<div><strong>明日计划</strong><p style="color: #374151; line-height: 1.6; margin-top: 4px;">${review.tomorrow_plan}</p></div>` : ''}
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <button class="action-btn secondary" onclick="ShortTermReview.editReview('${review.review_date}')">编辑此复盘</button>
                </div>
            </div>
        `;
    },

    async createReview() {
        const today = new Date().toISOString().split('T')[0];
        const result = await showInputDialog({
            title: '写今日复盘',
            fields: [
                { name: 'review_date', label: '日期', type: 'date', value: today },
                { name: 'market_summary', label: '市场总结', type: 'textarea', placeholder: '今日大盘走势，板块轮动...' },
                { name: 'today_operations', label: '今日操作', type: 'textarea', placeholder: '买入/卖出了哪些股票...' },
                { name: 'profit_loss', label: '今日盈亏', type: 'number', placeholder: '例如: 100 或 -50' },
                { name: 'lessons_learned', label: '经验教训', type: 'textarea', placeholder: '做对了什么，做错了什么...' },
                { name: 'tomorrow_plan', label: '明日计划', type: 'textarea', placeholder: '明天的操作计划...' },
                { name: 'mood_score', label: '心情评分 (1-5)', type: 'number', value: '3', placeholder: '1=很差, 5=很好' }
            ]
        });

        if (!result) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/short-term/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    review_date: result.review_date,
                    market_summary: result.market_summary,
                    today_operations: result.today_operations,
                    profit_loss: result.profit_loss ? parseFloat(result.profit_loss) : 0,
                    lessons_learned: result.lessons_learned,
                    tomorrow_plan: result.tomorrow_plan,
                    mood_score: parseInt(result.mood_score) || 3
                })
            });

            const data = await response.json();
            if (data.success) {
                showMessage('复盘已保存', 'success');
                await this.loadData();
            } else {
                showMessage(data.error || '保存失败', 'error');
            }
        } catch (error) {
            showMessage('保存失败: ' + error.message, 'error');
        }
    },

    async editReview(date) {
        await this.loadByDate(date);
        if (this.currentReview) {
            await this.createReview(); // 复用创建对话框，会自动更新
        }
    },

    async refresh() {
        await this.loadData();
        showMessage('已刷新', 'success');
    }
};

// ==================== 数据看板 ====================
const ShortTermDashboard = {
    data: null,

    async init() {
        console.log('初始化数据看板...');
        const content = document.getElementById('shortTermDashboardContent');

        content.innerHTML = `
            <div style="margin-bottom: 20px; display: flex; gap: 12px; align-items: center;">
                <select id="dashboardPeriod" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;" onchange="ShortTermDashboard.loadData(this.value)">
                    <option value="7">最近7天</option>
                    <option value="30" selected>最近30天</option>
                    <option value="90">最近90天</option>
                </select>
                <button class="action-btn secondary" onclick="ShortTermDashboard.refresh()">
                    <span class="btn-icon">🔄</span>
                    <span class="btn-text">刷新</span>
                </button>
            </div>
            <div id="dashboardStats">
                <div class="loading-text">正在加载统计数据...</div>
            </div>
        `;

        await this.loadData(30);
    },

    async loadData(days = 30) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/short-term/dashboard?days=${days}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            this.data = result.data;
            await this.render();
        } catch (error) {
            console.error('加载数据看板失败:', error);
            document.getElementById('dashboardStats').innerHTML = `<div class="error-message">加载失败</div>`;
        }
    },

    async render() {
        const container = document.getElementById('dashboardStats');

        if (!this.data) {
            container.innerHTML = `<div class="error-message">暂无数据</div>`;
            return;
        }

        const { logStats, planStats, poolStats, reviewStats, planExecuteRate } = this.data;

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center;">
                    <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">交易日志</div>
                    <div style="font-size: 28px; font-weight: 700; color: #1f2937;">${logStats?.total_logs || 0}</div>
                </div>
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center;">
                    <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">股票池</div>
                    <div style="font-size: 28px; font-weight: 700; color: #3b82f6;">${poolStats?.total_stocks || 0}</div>
                </div>
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center;">
                    <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">总盈亏</div>
                    <div style="font-size: 28px; font-weight: 700; color: ${(logStats?.total_profit || 0) >= 0 ? '#10b981' : '#ef4444'};">
                        ${(logStats?.total_profit || 0) >= 0 ? '+' : ''}¥${(logStats?.total_profit || 0).toFixed(0)}
                    </div>
                </div>
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center;">
                    <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">计划执行率</div>
                    <div style="font-size: 28px; font-weight: 700; color: ${parseFloat(planExecuteRate) >= 80 ? '#10b981' : '#f59e0b'};">${planExecuteRate}%</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                    <h4 style="font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">交易日志统计</h4>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
                        <div>
                            <div style="font-size: 12px; color: #6b7280;">总日志</div>
                            <div style="font-size: 20px; font-weight: 600;">${logStats?.total_logs || 0}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6b7280;">买入日志</div>
                            <div style="font-size: 20px; font-weight: 600; color: #10b981;">${logStats?.buy_logs || 0}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6b7280;">卖出日志</div>
                            <div style="font-size: 20px; font-weight: 600; color: #ef4444;">${logStats?.sell_logs || 0}</div>
                        </div>
                    </div>
                </div>

                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                    <h4 style="font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">交易计划统计</h4>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
                        <div>
                            <div style="font-size: 12px; color: #6b7280;">总计划</div>
                            <div style="font-size: 20px; font-weight: 600;">${planStats?.total_plans || 0}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6b7280;">已完成</div>
                            <div style="font-size: 20px; font-weight: 600; color: #10b981;">${planStats?.completed_plans || 0}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6b7280;">成功计划</div>
                            <div style="font-size: 20px; font-weight: 600; color: #3b82f6;">${planStats?.success_plans || 0}</div>
                        </div>
                    </div>
                </div>

                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                    <h4 style="font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">股票池统计</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; text-align: center;">
                        <div>
                            <div style="font-size: 12px; color: #6b7280;">总股票</div>
                            <div style="font-size: 20px; font-weight: 600;">${poolStats?.total_stocks || 0}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6b7280;">关注中</div>
                            <div style="font-size: 20px; font-weight: 600; color: #3b82f6;">${poolStats?.watching_stocks || 0}</div>
                        </div>
                    </div>
                </div>

                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                    <h4 style="font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">复盘笔记统计</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; text-align: center;">
                        <div>
                            <div style="font-size: 12px; color: #6b7280;">复盘次数</div>
                            <div style="font-size: 20px; font-weight: 600;">${reviewStats?.total_reviews || 0}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6b7280;">平均心情</div>
                            <div style="font-size: 20px; font-weight: 600; color: #f59e0b;">${(reviewStats?.avg_mood_score || 0).toFixed(1)}/5</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async refresh() {
        const period = document.getElementById('dashboardPeriod');
        await this.loadData(period ? period.value : 30);
        showMessage('已刷新', 'success');
    }
};

// ==================== 主初始化函数 ====================
async function initShortTerm() {
    console.log('初始化短线交易模块...');

    // 初始化当前活动的子页签
    const activeSubTab = document.querySelector('#short-term-tab .sub-tab-btn.active');
    if (activeSubTab) {
        const subTabId = activeSubTab.getAttribute('data-subtab');
        await loadShortTermSubTab(subTabId);
    }
}

// 加载子页签内容
async function loadShortTermSubTab(subTabId) {
    console.log(`加载短线子页签: ${subTabId}`);

    switch(subTabId) {
        case 'short-term-pool':
            await ShortTermPool.init();
            break;
        case 'short-term-stop-loss':
            await ShortTermStopLoss.init();
            break;
        case 'short-term-decision':
            await ShortTermDecision.init();
            break;
        case 'short-term-review':
            await ShortTermReview.init();
            break;
        case 'short-term-dashboard':
            await ShortTermDashboard.init();
            break;
    }
}

// ==================== 股票筛选功能 ====================
let currentFilterCategory = 'continuous-limit';
let filterData = null;

/**
 * 打开股票筛选弹窗
 */
function openStockFilterModal() {
    const modal = document.getElementById('stockFilterModal');
    modal.style.display = 'flex';

    // 确保连板股票按钮处于选中状态
    selectFilterCategory('continuous-limit');
}

/**
 * 关闭股票筛选弹窗
 */
function closeStockFilterModal() {
    const modal = document.getElementById('stockFilterModal');
    modal.style.display = 'none';
}

/**
 * 选择筛选类别
 */
function selectFilterCategory(category) {
    currentFilterCategory = category;

    // 更新左侧按钮状态
    document.querySelectorAll('.filter-category-btn').forEach(btn => {
        if (btn.dataset.category === category) {
            btn.classList.add('active');
            btn.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
            btn.style.color = 'white';
            btn.style.borderColor = '#6366f1';
        } else {
            btn.classList.remove('active');
            btn.style.background = 'white';
            btn.style.color = '#374151';
            btn.style.borderColor = '#e5e7eb';
        }
    });

    // 加载对应类别的数据
    loadFilterData(category);
}

/**
 * 刷新筛选数据
 */
function refreshFilterData() {
    loadFilterData(currentFilterCategory);
}

/**
 * 加载筛选数据
 */
async function loadFilterData(category) {
    const contentDiv = document.getElementById('filterResultContent');
    const titleSpan = document.getElementById('filterResultTitle');
    const countSpan = document.getElementById('filterResultCount');

    // 显示加载状态
    contentDiv.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #9ca3af;">
            <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
            <div style="font-size: 14px;">加载中...</div>
        </div>
    `;

    try {
        switch (category) {
            case 'continuous-limit':
                titleSpan.textContent = '连板股票';
                await loadContinuousLimitStocks();
                break;
            case 'concept':
                titleSpan.textContent = '概念板块';
                await loadConceptStocks();
                break;
            case 'industry':
                titleSpan.textContent = '行业板块';
                await loadIndustryStocks();
                break;
        }
    } catch (error) {
        console.error('加载筛选数据失败:', error);
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #ef4444;">
                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                <div style="font-size: 14px;">加载失败: ${error.message}</div>
            </div>
        `;
    }
}

/**
 * 加载连板股票数据
 */
async function loadContinuousLimitStocks() {
    const contentDiv = document.getElementById('filterResultContent');
    const countSpan = document.getElementById('filterResultCount');

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/market-data/continuous-limit', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('获取连板数据失败');
        }

        const data = await response.json();
        filterData = data.data || [];

        // 按连板数分组
        const grouped = {};
        filterData.forEach(stock => {
            const limitCount = stock.continuous_limit_days || 1;
            if (!grouped[limitCount]) {
                grouped[limitCount] = [];
            }
            grouped[limitCount].push(stock);
        });

        // 按连板数降序排序
        const sortedKeys = Object.keys(grouped).sort((a, b) => b - a);

        countSpan.textContent = `(${filterData.length})`;

        if (filterData.length === 0) {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #9ca3af;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                    <div style="font-size: 14px;">暂无连板股票数据</div>
                </div>
            `;
            return;
        }

        // 渲染分组结果
        let html = '';
        sortedKeys.forEach(limitCount => {
            const stocks = grouped[limitCount];
            const limitColor = getLimitColor(parseInt(limitCount));

            html += `
                <div style="margin-bottom: 24px;">
                    <div style="font-size: 16px; font-weight: 600; color: ${limitColor}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${limitColor}; display: flex; align-items: center; gap: 8px;">
                        <span>🔥</span>
                        <span>${limitCount}连板</span>
                        <span style="font-size: 14px; color: #6b7280; font-weight: 400;">(${stocks.length}只)</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
            `;

            stocks.forEach(stock => {
                const changePercent = parseFloat(stock.change_percent || 0).toFixed(2);
                const price = parseFloat(stock.current_price || 0).toFixed(2);
                const volume = formatVolume(stock.volume);
                const turnoverRate = parseFloat(stock.turnover_rate || 0).toFixed(2);

                html += `
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; transition: all 0.2s; cursor: pointer;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'; this.style.borderColor='${limitColor}'" onmouseout="this.style.boxShadow='none'; this.style.borderColor='#e5e7eb'" onclick="addToShortTermPool('${stock.code}', '${stock.name}')">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <div>
                                <div style="font-size: 15px; font-weight: 600; color: #1f2937; margin-bottom: 2px;">${stock.name}</div>
                                <div style="font-size: 13px; color: #6b7280;">${stock.code}</div>
                            </div>
                            <div style="background: ${limitColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                ${limitCount}板
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px;">
                            <div style="color: #6b7280;">价格: <span style="color: #ef4444; font-weight: 600;">¥${price}</span></div>
                            <div style="color: #6b7280;">涨幅: <span style="color: #ef4444; font-weight: 600;">+${changePercent}%</span></div>
                            <div style="color: #6b7280;">成交量: <span style="color: #374151; font-weight: 500;">${volume}</span></div>
                            <div style="color: #6b7280;">换手率: <span style="color: #374151; font-weight: 500;">${turnoverRate}%</span></div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        contentDiv.innerHTML = html;

    } catch (error) {
        throw error;
    }
}

/**
 * 获取连板数对应的颜色
 */
function getLimitColor(limitCount) {
    if (limitCount >= 5) return '#dc2626'; // 5板以上 - 深红色
    if (limitCount >= 3) return '#f59e0b'; // 3-4板 - 橙色
    if (limitCount >= 2) return '#8b5cf6'; // 2板 - 紫色
    return '#6366f1'; // 1板 - 蓝色
}

/**
 * 格式化成交量
 */
function formatVolume(volume) {
    if (!volume) return '-';
    const num = parseFloat(volume);
    if (num >= 100000000) return (num / 100000000).toFixed(2) + '亿';
    if (num >= 10000) return (num / 10000).toFixed(2) + '万';
    return num.toFixed(0);
}

/**
 * 添加到短线池
 */
async function addToShortTermPool(stockCode, stockName) {
    if (!confirm(`是否将 ${stockName}(${stockCode}) 添加到短线池？`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/short-term-pool', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                stock_code: stockCode,
                stock_name: stockName,
                status: 'watching',
                priority: 3
            })
        });

        if (!response.ok) {
            throw new Error('添加失败');
        }

        alert(`已成功将 ${stockName}(${stockCode}) 添加到短线池`);

        // 如果短线池页面已加载，刷新数据
        if (typeof ShortTermPool !== 'undefined' && ShortTermPool.loadData) {
            await ShortTermPool.loadData();
        }
    } catch (error) {
        console.error('添加到短线池失败:', error);
        alert('添加失败: ' + error.message);
    }
}

/**
 * 加载概念板块数据（待实现）
 */
async function loadConceptStocks() {
    const contentDiv = document.getElementById('filterResultContent');
    const countSpan = document.getElementById('filterResultCount');

    try {
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #9ca3af;">
                <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
                <div style="font-size: 14px;">正在加载概念板块数据...</div>
            </div>
        `;

        const token = localStorage.getItem('token');
        const response = await fetch('/api/market-data/concept', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取概念板块数据失败');
        }

        const data = await response.json();
        const concepts = data.data || [];

        if (concepts.length === 0) {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #9ca3af;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                    <div style="font-size: 14px;">暂无概念板块数据</div>
                </div>
            `;
            countSpan.textContent = '(0)';
            return;
        }

        // 分离涨幅和跌幅板块
        const gainers = concepts.filter(c => c.change_percent > 0).slice(0, 10);
        const losers = concepts.filter(c => c.change_percent <= 0).sort((a, b) => a.change_percent - b.change_percent).slice(0, 10);

        countSpan.textContent = `(${gainers.length + losers.length})`;

        // 渲染涨幅前十和跌幅前十
        let html = '';

        // 涨幅前十
        if (gainers.length > 0) {
            html += `
                <div style="margin-bottom: 32px;">
                    <div style="font-size: 18px; font-weight: 600; color: #ef4444; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #ef4444; display: flex; align-items: center; gap: 8px;">
                        <span>📈</span>
                        <span>涨幅前十概念板块</span>
                        <span style="font-size: 14px; color: #6b7280; font-weight: 400;">(${gainers.length}个)</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px;">
            `;

            gainers.forEach(concept => {
                const changePercent = parseFloat(concept.change_percent || 0).toFixed(2);
                const price = parseFloat(concept.current_price || 0).toFixed(2);
                const stockCount = concept.stock_count || 0;

                html += `
                    <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%); border: 1px solid #fecaca; border-radius: 8px; padding: 14px; transition: all 0.2s; cursor: pointer;"
                         onmouseover="this.style.boxShadow='0 4px 12px rgba(239,68,68,0.2)'; this.style.borderColor='#ef4444'"
                         onmouseout="this.style.boxShadow='none'; this.style.borderColor='#fecaca'"
                         onclick="loadConceptDetail('${concept.code}', '${concept.name}')">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <div style="flex: 1;">
                                <div style="font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">${concept.name}</div>
                                <div style="font-size: 12px; color: #6b7280;">成分股: ${stockCount}只</div>
                            </div>
                            <div style="background: #ef4444; color: white; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 700;">
                                +${changePercent}%
                            </div>
                        </div>
                        <div style="font-size: 12px; color: #6b7280;">
                            点击查看成分股 →
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        // 跌幅前十
        if (losers.length > 0) {
            html += `
                <div style="margin-bottom: 24px;">
                    <div style="font-size: 18px; font-weight: 600; color: #10b981; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #10b981; display: flex; align-items: center; gap: 8px;">
                        <span>📉</span>
                        <span>跌幅前十概念板块</span>
                        <span style="font-size: 14px; color: #6b7280; font-weight: 400;">(${losers.length}个)</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px;">
            `;

            losers.forEach(concept => {
                const changePercent = parseFloat(concept.change_percent || 0).toFixed(2);
                const price = parseFloat(concept.current_price || 0).toFixed(2);
                const stockCount = concept.stock_count || 0;

                html += `
                    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%); border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; transition: all 0.2s; cursor: pointer;"
                         onmouseover="this.style.boxShadow='0 4px 12px rgba(16,185,129,0.2)'; this.style.borderColor='#10b981'"
                         onmouseout="this.style.boxShadow='none'; this.style.borderColor='#bbf7d0'"
                         onclick="loadConceptDetail('${concept.code}', '${concept.name}')">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <div style="flex: 1;">
                                <div style="font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">${concept.name}</div>
                                <div style="font-size: 12px; color: #6b7280;">成分股: ${stockCount}只</div>
                            </div>
                            <div style="background: #10b981; color: white; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 700;">
                                ${changePercent}%
                            </div>
                        </div>
                        <div style="font-size: 12px; color: #6b7280;">
                            点击查看成分股 →
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        contentDiv.innerHTML = html;

    } catch (error) {
        console.error('加载概念板块失败:', error);
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #ef4444;">
                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                <div style="font-size: 14px;">加载概念板块数据失败</div>
                <div style="font-size: 12px; margin-top: 8px; color: #9ca3af;">${error.message}</div>
            </div>
        `;
        countSpan.textContent = '(0)';
    }
}

/**
 * 加载指定概念板块的成分股
 */
async function loadConceptDetail(conceptCode, conceptName) {
    const contentDiv = document.getElementById('filterResultContent');
    const countSpan = document.getElementById('filterResultCount');

    try {
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #9ca3af;">
                <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
                <div style="font-size: 14px;">正在加载${conceptName}成分股...</div>
            </div>
        `;

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/market-data/concept/${conceptCode}/stocks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取成分股数据失败');
        }

        const data = await response.json();
        const stocks = data.data || [];

        if (stocks.length === 0) {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #9ca3af;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                    <div style="font-size: 14px;">该概念板块暂无成分股数据</div>
                    <button onclick="loadConceptStocks()" style="margin-top: 16px; padding: 8px 16px; background: #8b5cf6; color: white; border: none; border-radius: 6px; cursor: pointer;">返回概念列表</button>
                </div>
            `;
            countSpan.textContent = '(0)';
            return;
        }

        countSpan.textContent = `(${stocks.length})`;

        // 渲染成分股列表
        let html = `
            <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 2px solid #8b5cf6;">
                <button onclick="loadConceptStocks()" style="padding: 6px 12px; background: #f3f4f6; color: #374151; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 4px;">
                    ← 返回
                </button>
                <div style="font-size: 18px; font-weight: 600; color: #8b5cf6;">
                    ${conceptName}
                </div>
                <div style="font-size: 14px; color: #6b7280;">
                    (${stocks.length}只成分股)
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
        `;

        stocks.forEach(stock => {
            const changePercent = parseFloat(stock.change_percent || 0).toFixed(2);
            const price = parseFloat(stock.current_price || 0).toFixed(2);
            const volume = formatVolume(stock.volume);
            const turnoverRate = parseFloat(stock.turnover_rate || 0).toFixed(2);
            const isRising = changePercent >= 0;
            const percentColor = isRising ? '#ef4444' : '#10b981';
            const sign = isRising ? '+' : '';

            html += `
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; transition: all 0.2s; cursor: pointer;"
                     onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'; this.style.borderColor='#8b5cf6'"
                     onmouseout="this.style.boxShadow='none'; this.style.borderColor='#e5e7eb'"
                     onclick="addToShortTermPool('${stock.code}', '${stock.name}')">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <div style="font-size: 15px; font-weight: 600; color: #1f2937; margin-bottom: 2px;">${stock.name}</div>
                            <div style="font-size: 13px; color: #6b7280;">${stock.code}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 15px; font-weight: 600; color: #1f2937;">¥${price}</div>
                            <div style="font-size: 12px; font-weight: 600; color: ${percentColor};">${sign}${changePercent}%</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px;">
                        <div style="color: #6b7280;">成交量: <span style="color: #374151; font-weight: 500;">${volume}</span></div>
                        <div style="color: #6b7280;">换手率: <span style="color: #374151; font-weight: 500;">${turnoverRate}%</span></div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        contentDiv.innerHTML = html;

    } catch (error) {
        console.error('加载概念成分股失败:', error);
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #ef4444;">
                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                <div style="font-size: 14px;">加载成分股数据失败</div>
                <div style="font-size: 12px; margin-top: 8px; color: #9ca3af;">${error.message}</div>
                <button onclick="loadConceptStocks()" style="margin-top: 16px; padding: 8px 16px; background: #8b5cf6; color: white; border: none; border-radius: 6px; cursor: pointer;">返回概念列表</button>
            </div>
        `;
        countSpan.textContent = '(0)';
    }
}

/**
 * 加载行业板块数据（待实现）
 */
async function loadIndustryStocks() {
    const contentDiv = document.getElementById('filterResultContent');
    const countSpan = document.getElementById('filterResultCount');

    countSpan.textContent = '(0)';
    contentDiv.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #9ca3af;">
            <div style="font-size: 48px; margin-bottom: 16px;">🚧</div>
            <div style="font-size: 14px;">行业板块筛选功能开发中...</div>
        </div>
    `;
}

// 导出函数供全局使用
window.ShortTermPool = ShortTermPool;
window.ShortTermStopLoss = ShortTermStopLoss;
window.ShortTermDecision = ShortTermDecision;
window.ShortTermReview = ShortTermReview;
window.ShortTermDashboard = ShortTermDashboard;
window.initShortTerm = initShortTerm;
window.loadShortTermSubTab = loadShortTermSubTab;
window.openStockFilterModal = openStockFilterModal;
window.closeStockFilterModal = closeStockFilterModal;
window.selectFilterCategory = selectFilterCategory;
window.addToShortTermPool = addToShortTermPool;
window.loadConceptDetail = loadConceptDetail;
window.loadConceptStocks = loadConceptStocks;
