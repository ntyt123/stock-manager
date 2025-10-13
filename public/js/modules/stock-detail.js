// ==================== stock-detail.js ====================
// 自动生成的模块文件

// showStockTooltip
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

// renderTooltipChart
async function renderTooltipChart(stockCode, period) {
    const canvasId = 'tooltipChart';

    try {
        // 如果没有指定周期，使用设置中的默认周期
        if (!period) {
            period = window.SettingsManager ? window.SettingsManager.getSettings().chartPeriod : 'day';
            console.log(`📊 [股票详情] 使用默认K线周期: ${period}`);
        }

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

