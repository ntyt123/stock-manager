// ==================== watchlist-manager.js ====================
// 自动生成的模块文件

// loadWatchlist
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

// addToWatchlist
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

// removeFromWatchlist
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

// loadWatchlistQuotes
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
                        <button class="create-plan-btn" onclick="createTradingPlanFromStock('${quote.stockCode}', '${quote.stockName || ''}', ${quote.currentPrice}, 'buy')">📋 制定买入计划</button>
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

// addPositionsToWatchlist
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

// loadOverviewWatchlistQuotes
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
                        <button class="create-plan-btn" onclick="createTradingPlanFromStock('${quote.stockCode}', '${quote.stockName || ''}', ${quote.currentPrice}, 'buy')">📋 制定买入计划</button>
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

