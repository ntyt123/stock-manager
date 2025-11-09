// ==================== stock-detail.js ====================
// 自动生成的模块文件

// 全局变量：保存当前悬浮框的图表实例和股票代码
let currentTooltipChart = null;
let currentTooltipStockCode = null;

// showStockTooltip
async function showStockTooltip(stockCode, stockName, event) {
    const tooltip = document.getElementById('stockDetailTooltip');
    const tooltipLoading = document.getElementById('tooltipLoading');
    const tooltipData = document.getElementById('tooltipData');
    const tooltipStockName = document.getElementById('tooltipStockName');
    const tooltipStockCode = document.getElementById('tooltipStockCode');

    if (!tooltip) {
        console.error('❌ 找不到悬浮框元素');
        return;
    }

    console.log(`📊 显示股票详情: ${stockCode} ${stockName}`);

    // 保存当前股票代码
    currentTooltipStockCode = stockCode;

    // 设置股票名称和代码
    tooltipStockName.textContent = stockName || '加载中...';
    tooltipStockCode.textContent = stockCode;

    // 显示加载状态 - 强制设置样式
    if (tooltipLoading) {
        tooltipLoading.style.display = 'flex';
        tooltipLoading.style.padding = '40px 20px';
        tooltipLoading.style.minHeight = '100px';
    }
    if (tooltipData) {
        tooltipData.style.display = 'none';
    }

    // 简化定位逻辑：使用固定定位在鼠标附近
    const tooltipWidth = 450;
    const tooltipHeight = 400;
    const offset = 15;

    // 获取视口尺寸
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 鼠标位置
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // 计算位置
    let finalX = mouseX + offset;
    let finalY = mouseY - tooltipHeight / 2;

    // 边界检查
    if (finalX + tooltipWidth > viewportWidth - 10) {
        finalX = mouseX - offset - tooltipWidth;
    }
    if (finalX < 10) finalX = 10;
    if (finalY < 10) finalY = 10;
    if (finalY + tooltipHeight > viewportHeight - 10) {
        finalY = viewportHeight - tooltipHeight - 10;
    }

    // 移动到 body，确保不受其他元素影响（类似模态框的处理方式）
    if (tooltip.parentElement !== document.body) {
        document.body.appendChild(tooltip);
        console.log('✅ 悬浮框已移动到 body');
    }

    // 强制设置样式，使用 cssText 一次性设置所有样式
    tooltip.style.cssText = `
        position: fixed !important;
        left: ${finalX}px !important;
        top: ${finalY}px !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 99999 !important;
        background-color: white !important;
        width: 450px !important;
        min-height: 300px !important;
        height: auto !important;
        border: 2px solid #667eea !important;
        border-radius: 12px !important;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25) !important;
        overflow: visible !important;
        padding: 0 !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        max-width: none !important;
        max-height: none !important;
        transform: none !important;
        clip: auto !important;
        clip-path: none !important;
    `;

    // 确保所有子元素也可见
    const header = tooltip.querySelector('.stock-tooltip-header');
    if (header) {
        header.style.cssText = `
            display: flex !important;
            padding: 15px 20px !important;
            min-height: 50px !important;
            height: auto !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            color: white !important;
            box-sizing: border-box !important;
        `;
    }

    const content = tooltip.querySelector('.stock-tooltip-content');
    if (content) {
        content.style.cssText = `
            display: block !important;
            min-height: 200px !important;
            height: auto !important;
            padding: 10px !important;
            box-sizing: border-box !important;
        `;
    }

    // 确保 loading 和 data 元素也有正确的 box-sizing
    if (tooltipLoading) {
        tooltipLoading.style.boxSizing = 'border-box';
    }
    if (tooltipData) {
        tooltipData.style.boxSizing = 'border-box';
    }

    console.log('🔍 悬浮框样式调试信息:', {
        display: tooltip.style.display,
        position: tooltip.style.position,
        left: tooltip.style.left,
        top: tooltip.style.top,
        zIndex: tooltip.style.zIndex,
        offsetWidth: tooltip.offsetWidth,
        offsetHeight: tooltip.offsetHeight,
        clientWidth: tooltip.clientWidth,
        clientHeight: tooltip.clientHeight,
        computed: window.getComputedStyle(tooltip).display
    });

    try {
        // 获取股票详情数据
        await fetchStockDetail(stockCode, stockName);
    } catch (error) {
        console.error('❌ 获取股票详情失败:', error);
        tooltipLoading.style.display = 'none';
        tooltipData.style.display = 'block';
        document.getElementById('tooltipCompanyInfo').innerHTML = '<div style="color: #e74c3c; text-align: center; padding: 20px;">加载失败，请稍后重试</div>';
    }
}

// closeStockTooltip
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

// buildCompanyInfo
function buildCompanyInfo(quote, stockCode) {
    // 判断交易所
    const exchange = stockCode.startsWith('6') ? '上海证券交易所' :
                     stockCode.startsWith('0') ? '深圳证券交易所' :
                     stockCode.startsWith('3') ? '深圳证券交易所（创业板）' :
                     '深圳证券交易所';

    // 安全获取数值，提供默认值
    const safeNumber = (value) => {
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    };

    const formatPrice = (value) => {
        const num = safeNumber(value);
        return num !== null ? `¥${num.toFixed(2)}` : '--';
    };

    // 计算涨跌幅
    const changePercent = safeNumber(quote.changePercent) || 0;
    const change = safeNumber(quote.change) || 0;
    const isPositive = changePercent >= 0;

    // 计算振幅
    const todayHigh = safeNumber(quote.todayHigh);
    const todayLow = safeNumber(quote.todayLow);
    const yesterdayClose = safeNumber(quote.yesterdayClose);
    const amplitude = (todayHigh && todayLow && yesterdayClose) ?
        (((todayHigh - todayLow) / yesterdayClose) * 100).toFixed(2) : '--';

    // 计算市值（如果有成交量和价格的话，这里是估算）
    const volume = safeNumber(quote.volume) || 0;
    const currentPrice = safeNumber(quote.currentPrice);
    const marketValue = (volume > 0 && currentPrice) ?
        `约 ${(currentPrice * volume / 100000000).toFixed(2)} 亿元` : '数据加载中';

    const amount = safeNumber(quote.amount);

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
                <span class="info-value">${quote.stockName || '--'}</span>
            </div>
        </div>

        <div class="company-info-section">
            <div class="section-subtitle">💹 今日表现</div>
            <div class="info-row">
                <span class="info-label">开盘价：</span>
                <span class="info-value">${formatPrice(quote.todayOpen)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">当前价：</span>
                <span class="info-value" style="color: ${isPositive ? '#e74c3c' : '#27ae60'}; font-weight: 700;">
                    ${formatPrice(quote.currentPrice)}
                    <span style="font-size: 0.85em;">(${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)</span>
                </span>
            </div>
            <div class="info-row">
                <span class="info-label">最高价：</span>
                <span class="info-value">${formatPrice(quote.todayHigh)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">最低价：</span>
                <span class="info-value">${formatPrice(quote.todayLow)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">涨跌额：</span>
                <span class="info-value" style="color: ${isPositive ? '#e74c3c' : '#27ae60'};">
                    ${isPositive ? '+' : ''}${formatPrice(change)}
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
                <span class="info-value">${formatPrice(quote.yesterdayClose)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">成交量：</span>
                <span class="info-value">${volume > 0 ? (volume / 10000).toFixed(2) + ' 万股' : '数据加载中'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">成交额：</span>
                <span class="info-value">${amount ? (amount / 100000000).toFixed(2) + ' 亿元' : '数据加载中'}</span>
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

// fetchStockDetail
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
        const safeNumber = (value) => {
            const num = parseFloat(value);
            return isNaN(num) ? 0 : num;
        };

        const formatPrice = (value) => {
            const num = safeNumber(value);
            return num !== 0 ? `¥${num.toFixed(2)}` : '--';
        };

        const changePercent = safeNumber(quote.changePercent);
        const isPositive = changePercent >= 0;

        // 更新行情数据（如果元素存在）
        const currentPriceEl = document.getElementById('tooltipCurrentPrice');
        const changePercentEl = document.getElementById('tooltipChangePercent');
        const highEl = document.getElementById('tooltipHigh');
        const lowEl = document.getElementById('tooltipLow');

        if (currentPriceEl) {
            currentPriceEl.textContent = formatPrice(quote.currentPrice);
            currentPriceEl.className = `quote-value ${isPositive ? 'positive' : 'negative'}`;
        }
        if (changePercentEl) {
            changePercentEl.textContent = `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`;
            changePercentEl.className = `quote-value ${isPositive ? 'positive' : 'negative'}`;
        }
        if (highEl) {
            highEl.textContent = formatPrice(quote.todayHigh);
        }
        if (lowEl) {
            lowEl.textContent = formatPrice(quote.todayLow);
        }

        // 隐藏加载状态，显示数据
        tooltipLoading.style.display = 'none';
        tooltipData.style.display = 'block';

        console.log('✅ 股票详情加载成功');

    } catch (error) {
        console.error('❌ 获取股票详情错误:', error);
        throw error;
    }
}

// renderTooltipChart
async function renderTooltipChart(stockCode, period) {
    const canvasId = 'tooltipChart';

    try {
        // 如果没有指定周期，使用设置中的默认周期
        if (!period) {
            period = window.SettingsManager ? window.SettingsManager.getSettings().chartPeriod : 'day';
            console.log(`📊 [股票详情] 使用默认K线周期: ${period}`);
        }

        // 强制销毁旧图表（不管currentTooltipChart是否存在）
        // 这确保Canvas上的任何图表都被清理
        stockChartManager.destroyChart(canvasId);
        currentTooltipChart = null;

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

// bindTooltipPeriodButtons
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

// switchTooltipChartPeriod
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

// initStockCodeHover
function initStockCodeHover() {
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
}

// ==================== 导出全局函数 ====================
// 将函数导出到全局作用域，供HTML onclick使用
window.showStockTooltip = showStockTooltip;
window.closeStockTooltip = closeStockTooltip;
window.initStockCodeHover = initStockCodeHover;
window.switchTooltipChartPeriod = switchTooltipChartPeriod;

