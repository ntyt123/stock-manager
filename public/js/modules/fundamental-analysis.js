// ==================== fundamental-analysis.js ====================
// 基本面分析模块

// 全局变量存储当前查询的股票数据
let currentFundamentalData = null;

// 搜索并获取股票基本面数据
async function searchFundamentalData() {
    const input = document.getElementById('fundamentalStockInput').value.trim();

    if (!input) {
        alert('请输入股票代码或名称');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再使用基本面分析功能');
        return;
    }

    console.log('🔍 开始查询股票基本面数据:', input);

    // 显示加载状态
    const dataContainer = document.getElementById('fundamentalDataContainer');
    dataContainer.style.display = 'block';
    dataContainer.innerHTML = `
        <div class="analysis-loading">
            <div class="loading-spinner"></div>
            <div class="loading-message">正在获取基本面数据...</div>
        </div>
    `;

    try {
        // 调用后端API获取基本面数据
        const response = await fetch(`/api/fundamental/data?query=${encodeURIComponent(input)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data) {
            currentFundamentalData = result.data;
            displayFundamentalData(result.data);
            console.log('✅ 基本面数据获取成功');
        } else {
            throw new Error(result.error || '获取基本面数据失败');
        }

    } catch (error) {
        console.error('❌ 获取基本面数据错误:', error);
        dataContainer.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">查询失败</p>
                    <p class="hint-desc">${error.message || '无法获取基本面数据，请稍后重试'}</p>
                </div>
            </div>
        `;
        showNotification('获取基本面数据失败: ' + error.message, 'error');
    }
}

// 显示基本面数据
function displayFundamentalData(data) {
    const dataContainer = document.getElementById('fundamentalDataContainer');

    // 更新HTML结构，保持原有布局
    dataContainer.innerHTML = `
        <!-- 股票基本信息 -->
        <div class="fundamental-stock-info">
            <h3><span id="fundamental-stock-name">${data.stockName}</span> (<span id="fundamental-stock-code">${data.stockCode}</span>)</h3>
            <div class="stock-price-info">
                <div class="price-item">
                    <span class="label">最新价</span>
                    <span class="value ${data.changePercent >= 0 ? 'up' : 'down'}" id="fundamental-current-price">¥${data.currentPrice ? data.currentPrice.toFixed(2) : '-'}</span>
                </div>
                <div class="price-item">
                    <span class="label">涨跌幅</span>
                    <span class="value ${data.changePercent >= 0 ? 'up' : 'down'}" id="fundamental-change-percent">${data.changePercent >= 0 ? '+' : ''}${data.changePercent ? data.changePercent + '%' : '-'}</span>
                </div>
                <div class="price-item">
                    <span class="label">总市值</span>
                    <span class="value" id="fundamental-market-cap">${data.marketCap || '-'}</span>
                </div>
            </div>
        </div>

        <!-- 财务数据 -->
        <div class="fundamental-section">
            <h4 class="section-title">💰 财务数据</h4>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">营业收入</span>
                    <span class="data-value">${data.revenue || '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">净利润</span>
                    <span class="data-value">${data.netProfit || '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">经营现金流</span>
                    <span class="data-value">${data.cashFlow || '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">总资产</span>
                    <span class="data-value">${data.totalAssets || '-'}</span>
                </div>
            </div>
        </div>

        <!-- 估值指标 -->
        <div class="fundamental-section">
            <h4 class="section-title">📈 估值指标</h4>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">市盈率(PE)</span>
                    <span class="data-value">${data.pe || '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">市净率(PB)</span>
                    <span class="data-value">${data.pb || '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">市销率(PS)</span>
                    <span class="data-value">${data.ps || '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">市现率(PCF)</span>
                    <span class="data-value">${data.pcf || '-'}</span>
                </div>
            </div>
        </div>

        <!-- 盈利能力 -->
        <div class="fundamental-section">
            <h4 class="section-title">💎 盈利能力</h4>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">净资产收益率(ROE)</span>
                    <span class="data-value">${data.roe ? data.roe + '%' : '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">总资产收益率(ROA)</span>
                    <span class="data-value">${data.roa ? data.roa + '%' : '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">毛利率</span>
                    <span class="data-value">${data.grossMargin ? data.grossMargin + '%' : '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">净利率</span>
                    <span class="data-value">${data.netMargin ? data.netMargin + '%' : '-'}</span>
                </div>
            </div>
        </div>

        <!-- 成长性指标 -->
        <div class="fundamental-section">
            <h4 class="section-title">🚀 成长性指标</h4>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">营收增长率(YoY)</span>
                    <span class="data-value ${data.revenueGrowth >= 0 ? 'up' : 'down'}">${data.revenueGrowth ? (data.revenueGrowth >= 0 ? '+' : '') + data.revenueGrowth + '%' : '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">净利润增长率(YoY)</span>
                    <span class="data-value ${data.profitGrowth >= 0 ? 'up' : 'down'}">${data.profitGrowth ? (data.profitGrowth >= 0 ? '+' : '') + data.profitGrowth + '%' : '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">每股收益(EPS)</span>
                    <span class="data-value">${data.eps ? '¥' + data.eps : '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">每股净资产(BPS)</span>
                    <span class="data-value">${data.bps ? '¥' + data.bps : '-'}</span>
                </div>
            </div>
        </div>

        <!-- 偿债能力 -->
        <div class="fundamental-section">
            <h4 class="section-title">🛡️ 偿债能力</h4>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">资产负债率</span>
                    <span class="data-value">${data.debtRatio ? data.debtRatio + '%' : '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">流动比率</span>
                    <span class="data-value">${data.currentRatio || '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">速动比率</span>
                    <span class="data-value">${data.quickRatio || '-'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">现金比率</span>
                    <span class="data-value">${data.cashRatio || '-'}</span>
                </div>
            </div>
        </div>
    `;

    dataContainer.style.display = 'block';
}

// AI智能分析基本面数据
async function analyzeFundamental() {
    const input = document.getElementById('fundamentalStockInput').value.trim();

    if (!input) {
        alert('请先输入股票代码或名称');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录后再使用AI分析功能');
        return;
    }

    const analyzeBtn = document.getElementById('fundamentalAnalyzeBtn');
    const analysisContainer = document.getElementById('fundamentalAnalysisContainer');

    console.log('🤖 开始AI智能分析基本面...');

    // 禁用按钮
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span>⏳ 分析中...</span>';

    // 显示加载状态
    analysisContainer.style.display = 'block';
    analysisContainer.innerHTML = `
        <div class="analysis-loading">
            <div class="loading-spinner"></div>
            <div class="loading-message">AI正在深度分析基本面数据...</div>
            <div class="loading-tips">
                分析内容包括：财务健康度、估值水平、成长性、行业地位等<br>
                预计需要10-30秒，请耐心等待
            </div>
        </div>
    `;

    try {
        // 调用后端API进行AI分析
        const response = await fetch('/api/fundamental/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ query: input })
        });

        const result = await response.json();

        if (result.success && result.data) {
            const { analysis, fundamentalData, timestamp, prompt } = result.data;

            // 在浏览器控制台输出发送给AI的提示词
            if (prompt) {
                console.log('%c📝 ==================== AI基本面分析提示词 ====================', 'color: #9C27B0; font-weight: bold; font-size: 14px;');
                console.log(prompt);
                console.log('%c📝 ============================================================', 'color: #9C27B0; font-weight: bold; font-size: 14px;');
            }

            // 显示分析结果
            displayFundamentalAnalysis(analysis, fundamentalData, timestamp);

            // 同时更新基本面数据展示
            if (fundamentalData) {
                currentFundamentalData = fundamentalData;
                displayFundamentalData(fundamentalData);
            }

            console.log('✅ AI基本面分析完成');
            showNotification('基本面分析完成', 'success');

        } else {
            throw new Error(result.error || '分析失败');
        }

    } catch (error) {
        console.error('❌ AI基本面分析错误:', error);

        analysisContainer.innerHTML = `
            <div class="analysis-hint">
                <div class="hint-icon">⚠️</div>
                <div class="hint-content">
                    <p class="hint-title">分析失败</p>
                    <p class="hint-desc">${error.message || '基本面分析失败，请稍后重试'}</p>
                </div>
            </div>
        `;

        showNotification('基本面分析失败: ' + error.message, 'error');

    } finally {
        // 恢复按钮
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span>🤖 AI智能分析</span>';
    }
}

// 显示AI分析结果
function displayFundamentalAnalysis(analysis, fundamentalData, timestamp) {
    const analysisContainer = document.getElementById('fundamentalAnalysisContainer');
    const analysisTime = new Date(timestamp).toLocaleString('zh-CN');

    // 使用marked.parse渲染Markdown格式的分析内容
    const analysisHtml = marked.parse(analysis);

    const html = `
        <div class="analysis-result">
            <h4 class="section-title">🤖 AI智能分析报告 - ${fundamentalData.stockName}(${fundamentalData.stockCode})</h4>
            <div class="analysis-content">${analysisHtml}</div>
            <div class="analysis-timestamp">
                📅 分析时间：${analysisTime}
            </div>
        </div>
    `;

    analysisContainer.innerHTML = html;
    analysisContainer.style.display = 'block';
}

// 查看历史分析记录
async function viewFundamentalHistory() {
    alert('历史记录功能开发中，敬请期待！');
    // TODO: 实现历史记录查看功能
}

// 加载用户自选股到下拉框
async function loadWatchlistToSelect() {
    const select = document.getElementById('fundamentalWatchlistSelect');
    const token = localStorage.getItem('token');

    if (!select || !token) return;

    try {
        const response = await fetch('/api/fundamental/watchlist', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data.watchlist) {
            const watchlist = result.data.watchlist;

            // 清空现有选项（保留第一个提示选项）
            select.innerHTML = '<option value="">或从自选股选择...</option>';

            // 添加自选股选项
            watchlist.forEach(stock => {
                const option = document.createElement('option');
                option.value = stock.stock_code;
                option.textContent = `${stock.stock_name}(${stock.stock_code})`;
                select.appendChild(option);
            });

            console.log(`✅ 已加载 ${watchlist.length} 只自选股到下拉框`);
        }
    } catch (error) {
        console.error('❌ 加载自选股失败:', error);
    }
}

// 监听自选股下拉框变化
function onWatchlistSelectChange() {
    const select = document.getElementById('fundamentalWatchlistSelect');
    const input = document.getElementById('fundamentalStockInput');

    if (select && input && select.value) {
        input.value = select.value;
        console.log(`✅ 已选择自选股: ${select.value}`);
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ 基本面分析模块已加载');

    // 为输入框添加回车键事件
    const input = document.getElementById('fundamentalStockInput');
    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchFundamentalData();
            }
        });
    }

    // 为自选股下拉框添加change事件
    const select = document.getElementById('fundamentalWatchlistSelect');
    if (select) {
        select.addEventListener('change', onWatchlistSelectChange);
    }

    // 加载自选股数据
    loadWatchlistToSelect();
});

// 当切换到基本面分析标签时也重新加载自选股
window.addEventListener('tabSwitched', function(e) {
    if (e.detail && e.detail.tab === 'analysis-fundamentals') {
        loadWatchlistToSelect();
    }
});
