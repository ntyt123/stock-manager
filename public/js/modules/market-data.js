// ==================== market-data.js ====================
// 自动生成的模块文件

// loadMarketData
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

    // 加载行业分布
    loadIndustryDistribution();
}

// loadMarketIndices
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

        // 获取默认K线周期设置
        const settings = window.SettingsManager ? window.SettingsManager.getSettings() : {};
        const defaultPeriod = settings.chartPeriod || 'day';

        // 检查容器是否已有内容（判断是否为首次加载）
        const isFirstLoad = !container.querySelector('.quote-item');

        if (isFirstLoad) {
            // 首次加载，渲染完整HTML结构
            console.log(`📊 [市场指数] 首次加载，完整设置:`, settings);
            console.log(`📊 [市场指数] 使用周期: "${defaultPeriod}"`);

            let html = '';
            indices.forEach((index, i) => {
                const quote = quotes[i];
                if (quote) {
                    const isPositive = parseFloat(quote.changePercent) >= 0;
                    const chartId = `market-index-chart-${quote.stockCode}-${i}`;

                    html += `
                        <div class="quote-item" data-stock-code="${quote.stockCode}">
                            <div class="quote-header">
                                <div class="quote-info">
                                    <span class="quote-symbol">${index.name} (${quote.stockCode})</span>
                                </div>
                                <div class="quote-stats">
                                    <div class="quote-price" data-price>${quote.currentPrice.toFixed(2)}</div>
                                    <div class="quote-change ${isPositive ? 'positive' : 'negative'}" data-change>
                                        ${isPositive ? '+' : ''}${quote.changePercent}%
                                    </div>
                                </div>
                            </div>
                            <div class="chart-period-selector">
                                <button class="period-btn ${defaultPeriod === 'intraday' ? 'active' : ''}" data-period="intraday" data-chart="${chartId}" data-stock="${quote.stockCode}">分时</button>
                                <button class="period-btn ${defaultPeriod === 'day' ? 'active' : ''}" data-period="day" data-chart="${chartId}" data-stock="${quote.stockCode}">日线</button>
                                <button class="period-btn ${defaultPeriod === 'week' ? 'active' : ''}" data-period="week" data-chart="${chartId}" data-stock="${quote.stockCode}">周线</button>
                                <button class="period-btn ${defaultPeriod === 'month' ? 'active' : ''}" data-period="month" data-chart="${chartId}" data-stock="${quote.stockCode}">月线</button>
                            </div>
                            <div class="quote-chart-container">
                                <canvas id="${chartId}" class="quote-chart"></canvas>
                            </div>
                        </div>
                    `;
                }
            });

            container.innerHTML = html;

            // 渲染图表
            quotes.forEach((quote, i) => {
                const chartId = `market-index-chart-${quote.stockCode}-${i}`;
                renderStockChart(chartId, quote.stockCode, defaultPeriod);
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
            // 刷新数据，只更新价格和图表
            console.log(`📊 [市场指数] 刷新数据`);

            quotes.forEach((quote, i) => {
                const quoteItem = container.querySelector(`.quote-item[data-stock-code="${quote.stockCode}"]`);
                if (quoteItem) {
                    // 更新价格
                    const priceElement = quoteItem.querySelector('[data-price]');
                    const changeElement = quoteItem.querySelector('[data-change]');

                    if (priceElement) {
                        priceElement.textContent = quote.currentPrice.toFixed(2);
                    }

                    if (changeElement) {
                        const isPositive = parseFloat(quote.changePercent) >= 0;
                        changeElement.textContent = `${isPositive ? '+' : ''}${quote.changePercent}%`;
                        changeElement.className = `quote-change ${isPositive ? 'positive' : 'negative'}`;
                    }

                    // 更新图表（获取当前激活的周期）
                    const activePeriodBtn = quoteItem.querySelector('.period-btn.active');
                    const currentPeriod = activePeriodBtn ? activePeriodBtn.getAttribute('data-period') : defaultPeriod;
                    const chartId = `market-index-chart-${quote.stockCode}-${i}`;
                    renderStockChart(chartId, quote.stockCode, currentPeriod);
                }
            });
        }

    } catch (error) {
        console.error('加载市场指数错误:', error);
        container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无指数数据</div>';
    }
}

// loadMarketOverview
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

// loadHotNews
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
                container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无持仓相关新闻<br><small>请先导入持仓数据</small></div>';
            } else {
                container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无新闻</div>';
            }
        }
    } catch (error) {
        console.error('加载热点新闻错误:', error);
        if (category === 'positions') {
            container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无持仓相关新闻</div>';
        } else {
            container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无新闻</div>';
        }
    }
}

// initNewsCategories
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

// openNewsLink
function openNewsLink(url) {
    if (url && url !== '#') {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

// loadTopGainersLosers
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
            gainersContainer.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无自选股数据</div>';
            losersContainer.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无自选股数据</div>';
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
            gainersContainer.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无行情数据</div>';
            losersContainer.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无行情数据</div>';
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

// loadChangeDistribution
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
            container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无自选股数据</div>';
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
            container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无行情数据</div>';
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

// loadPortfolioStats
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
            container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无持仓数据</div>';
            return;
        }

        const positions = result.data.positions;
        const summary = result.data.summary;

        // 等待 CapitalManager 初始化完成（最多等待3秒）
        console.log('📊 [loadPortfolioStats] 开始等待 CapitalManager 初始化...');
        let totalCapital = 0;
        if (window.CapitalManager) {
            let waitCount = 0;
            console.log(`📊 [loadPortfolioStats] CapitalManager.initialized = ${window.CapitalManager.initialized}`);
            while (!window.CapitalManager.initialized && waitCount < 30) {
                await new Promise(resolve => setTimeout(resolve, 100));
                waitCount++;
                if (waitCount % 5 === 0) {
                    console.log(`📊 [loadPortfolioStats] 等待中... ${waitCount * 100}ms`);
                }
            }
            console.log(`📊 [loadPortfolioStats] 等待结束，waitCount = ${waitCount}`);
            totalCapital = window.CapitalManager.getTotalCapital();
            console.log(`📊 [loadPortfolioStats] 获取到总资金: ¥${totalCapital}`);
        } else {
            console.warn('⚠️ [loadPortfolioStats] window.CapitalManager 不存在！');
        }

        const positionRatio = totalCapital > 0 ? (summary.totalMarketValue / totalCapital * 100).toFixed(2) : 0;

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
                    <div class="stat-icon">💼</div>
                    <div class="stat-content">
                        <div class="stat-label">总资金</div>
                        <div class="stat-value">¥${totalCapital.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>

                <div class="stat-box">
                    <div class="stat-icon">💰</div>
                    <div class="stat-content">
                        <div class="stat-label">持仓市值</div>
                        <div class="stat-value">¥${summary.totalMarketValue.toFixed(2)}</div>
                    </div>
                </div>

                <div class="stat-box">
                    <div class="stat-icon">📊</div>
                    <div class="stat-content">
                        <div class="stat-label">仓位占比</div>
                        <div class="stat-value">${positionRatio}%</div>
                        <div class="stat-sub">${summary.positionCount}只股票</div>
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

// loadSystemStats
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

// loadTradeTimeReminder
function loadTradeTimeReminder() {
    const container = document.getElementById('tradeTimeReminder');

    if (!container) return;

    function updateTradeTime() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
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
            const remainSeconds = 60 - seconds;
            countdown = `距上午收盘还有 ${Math.floor(remainMinutes / 60)}小时${remainMinutes % 60}分${remainSeconds}秒`;
            message = '上午交易时段';
        } else if (currentTime >= afternoonOpen && currentTime < afternoonClose) {
            // 下午交易中
            status = '交易中';
            icon = '🔔';
            statusClass = 'trading';
            const remainMinutes = afternoonClose - currentTime;
            const remainSeconds = 60 - seconds;
            countdown = `距收盘还有 ${Math.floor(remainMinutes / 60)}小时${remainMinutes % 60}分${remainSeconds}秒`;
            message = '下午交易时段';
        } else if (currentTime >= callAuctionStart && currentTime < callAuctionEnd) {
            // 集合竞价时段
            status = '集合竞价';
            icon = '⏰';
            statusClass = 'call-auction';
            const remainMinutes = callAuctionEnd - currentTime;
            const remainSeconds = 60 - seconds;
            countdown = `距开盘还有 ${remainMinutes}分${remainSeconds}秒`;
            message = '集合竞价中，9:25撮合成交';
        } else if (currentTime >= callAuctionEnd && currentTime < morningOpen) {
            // 集合竞价结束到开盘
            status = '即将开盘';
            icon = '⏰';
            statusClass = 'pre-trading';
            const remainMinutes = morningOpen - currentTime;
            const remainSeconds = 60 - seconds;
            countdown = `距开盘还有 ${remainMinutes}分${remainSeconds}秒`;
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

    // 在交易时间内每秒更新，非交易时间每分钟更新
    let updateInterval = null;

    function scheduleNextUpdate() {
        if (updateInterval) {
            clearInterval(updateInterval);
        }

        const inTradeTime = isTradeTime();
        const interval = inTradeTime ? 1000 : 60000; // 交易时间1秒，非交易时间60秒

        updateInterval = setInterval(updateTradeTime, interval);

        // 每次更新后重新检查是否需要调整更新频率
        setTimeout(() => {
            const stillInTradeTime = isTradeTime();
            if (inTradeTime !== stillInTradeTime) {
                scheduleNextUpdate();
            }
        }, interval);
    }

    scheduleNextUpdate();
}

// loadIndustryDistribution
async function loadIndustryDistribution() {
    const container = document.getElementById('industryDistribution');

    if (!container) return;

    const token = localStorage.getItem('token');
    if (!token) {
        container.innerHTML = '<div class="loading-text">请登录查看行业分布</div>';
        return;
    }

    try {
        // 显示加载状态
        container.innerHTML = '<div class="loading-text">正在加载行业分布...</div>';

        // 获取行业分布数据
        const response = await fetch('/api/analysis/industry-distribution', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取行业分布失败');
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || '获取行业分布失败');
        }

        const { distribution, totalMarketValue, positionCount } = result.data;

        if (distribution.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">暂无持仓数据</div>';
            return;
        }

        // 渲染行业分布数据
        let html = '<div class="industry-distribution-content">';

        // 概览信息
        html += `
            <div class="industry-overview">
                <div class="overview-stat">
                    <span class="stat-label">总市值</span>
                    <span class="stat-value">¥${totalMarketValue.toFixed(2)}</span>
                </div>
                <div class="overview-stat">
                    <span class="stat-label">持仓股票</span>
                    <span class="stat-value">${positionCount}只</span>
                </div>
                <div class="overview-stat">
                    <span class="stat-label">涉及行业</span>
                    <span class="stat-value">${distribution.length}个</span>
                </div>
            </div>
        `;

        // 行业列表
        html += '<div class="industry-list">';

        distribution.forEach((item, index) => {
            const percentage = parseFloat(item.percentage);

            // 根据占比设置颜色
            let barColor = '#3498db';
            if (percentage > 30) barColor = '#e74c3c';
            else if (percentage > 20) barColor = '#f39c12';
            else if (percentage > 10) barColor = '#2ecc71';

            html += `
                <div class="industry-item">
                    <div class="industry-header">
                        <div class="industry-info">
                            <span class="industry-rank">#${index + 1}</span>
                            <span class="industry-name">${item.industry}</span>
                            <span class="industry-count">${item.count}只股票</span>
                        </div>
                        <div class="industry-stats">
                            <span class="industry-value">¥${item.marketValue.toFixed(2)}</span>
                            <span class="industry-percent">${item.percentage}%</span>
                        </div>
                    </div>
                    <div class="industry-bar-container">
                        <div class="industry-bar" style="width: ${item.percentage}%; background-color: ${barColor};"></div>
                    </div>
                    <div class="industry-stocks">
                        ${item.stocks.map(stock => `
                            <div class="industry-stock-item">
                                <span class="stock-name">${stock.stockName}</span>
                                <span class="stock-code">${stock.stockCode}</span>
                                <span class="stock-value">¥${stock.marketValue.toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        html += '</div></div>';

        container.innerHTML = html;

        console.log('✅ 行业分布加载成功');

    } catch (error) {
        console.error('加载行业分布错误:', error);
        container.innerHTML = '<div class="loading-text">加载失败，请刷新重试</div>';
    }
}

// ==================== 自动刷新行情功能 ====================
let autoRefreshTimer = null;

// 判断当前是否在交易时间段内
function isTradeTime() {
    const now = new Date();
    const day = now.getDay();

    // 周末不是交易时间
    if (day === 0 || day === 6) {
        return false;
    }

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;

    // 定义交易时段
    const callAuctionStart = 9 * 60 + 15;  // 09:15 集合竞价开始
    const morningClose = 11 * 60 + 30;     // 11:30
    const afternoonOpen = 13 * 60;         // 13:00
    const afternoonClose = 15 * 60;        // 15:00

    // 判断是否在交易时段内（包括集合竞价）
    return (currentTime >= callAuctionStart && currentTime < morningClose) ||
           (currentTime >= afternoonOpen && currentTime < afternoonClose);
}

// 启动自动刷新
function startAutoRefresh() {
    // 先停止旧的定时器
    stopAutoRefresh();

    // 获取设置
    const settings = window.SettingsManager ? window.SettingsManager.getSettings() : {};
    const autoRefresh = settings.autoRefresh || false;
    const refreshInterval = settings.refreshInterval || 0; // 秒

    // 如果用户未启用自动刷新或刷新间隔为0，则不启动
    if (!autoRefresh || refreshInterval <= 0) {
        console.log('⏸️ 自动刷新已禁用（用户设置）');
        return;
    }

    console.log(`🔄 启动自动刷新行情，间隔: ${refreshInterval}秒`);

    // 设置定时器
    autoRefreshTimer = setInterval(() => {
        refreshMarketData();
    }, refreshInterval * 1000);
}

// 停止自动刷新
function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
        console.log('⏹️ 自动刷新行情已停止');
    }
}

// 刷新所有行情数据
function refreshMarketData() {
    // 获取当前激活的页签
    const activeTab = document.querySelector('.tab-btn.active');
    const currentTab = activeTab ? activeTab.dataset.tab : null;

    // 只刷新当前激活页签相关的数据
    if (currentTab === 'overview') {
        // 总览页签：刷新总览自选股行情和持仓统计
        const overviewWatchlistContainer = document.getElementById('overviewWatchlistQuotes');
        if (overviewWatchlistContainer && overviewWatchlistContainer.innerHTML) {
            loadOverviewWatchlistQuotes();
        }

        const portfolioStatsContainer = document.getElementById('portfolioStats');
        if (portfolioStatsContainer && portfolioStatsContainer.innerHTML) {
            loadPortfolioStats();
        }
    } else if (currentTab === 'market') {
        // 股市信息页签：刷新市场相关数据
        const marketIndicesContainer = document.getElementById('marketIndices');
        if (marketIndicesContainer && marketIndicesContainer.innerHTML) {
            loadMarketIndices();
        }

        const marketOverviewContainer = document.getElementById('marketOverview');
        if (marketOverviewContainer && marketOverviewContainer.innerHTML) {
            loadMarketOverview();
        }

        const watchlistQuotesContainer = document.getElementById('watchlistQuotes');
        if (watchlistQuotesContainer && watchlistQuotesContainer.innerHTML) {
            loadWatchlistQuotes();
        }

        const topGainersContainer = document.getElementById('topGainers');
        const topLosersContainer = document.getElementById('topLosers');
        if (topGainersContainer && topLosersContainer) {
            loadTopGainersLosers();
        }

        const changeDistributionContainer = document.getElementById('changeDistribution');
        if (changeDistributionContainer && changeDistributionContainer.innerHTML) {
            loadChangeDistribution();
        }
    }
    // 其他页签（选股、交易、分析等）不自动刷新行情数据
}

// updateStockData (旧函数，保留兼容性)
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

// ==================== 市场情绪分析功能 ====================

// 加载市场情绪分析
async function loadMarketSentiment() {
    console.log('📊 开始加载市场情绪分析...');

    try {
        // 并行加载所有模块
        await Promise.all([
            loadSentimentOverview(),
            loadFundsFlowData(),
            loadIndustryFlowData(),
            loadDragonTigerData(),
            loadBigOrdersData()
        ]);

        // 初始化标签页切换
        initSentimentTabs();

        console.log('✅ 市场情绪分析加载完成');
    } catch (error) {
        console.error('❌ 加载市场情绪分析失败:', error);
    }
}

// 加载市场情绪概览（四个指标卡片）
async function loadSentimentOverview() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            updateSentimentCard('sentimentIndex', '--', '请登录查看');
            updateSentimentCard('gainLossRatio', '--', '请登录查看');
            updateSentimentCard('northboundFunds', '--', '请登录查看');
            updateSentimentCard('marketHeat', '--', '请登录查看');
            return;
        }

        // 1. 获取市场主要指数数据（上证、深证、创业板）用于计算整体市场情绪
        const indexCodes = ['000001', '399001', '399006'];

        const quotesResponse = await fetch('/api/stock/quotes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ stockCodes: indexCodes })
        });

        if (!quotesResponse.ok) throw new Error('获取指数数据失败');

        const quotesResult = await quotesResponse.json();
        if (!quotesResult.success || !quotesResult.data) throw new Error('指数数据为空');

        const quotes = quotesResult.data;

        // 计算指数平均涨跌幅（用于情绪指数）
        let totalChange = 0;
        quotes.forEach(quote => {
            totalChange += parseFloat(quote.changePercent);
        });
        const avgChange = totalChange / quotes.length;

        // 2. 获取市场涨跌家数统计（用于涨跌比例）
        let upCount = 0, downCount = 0, flatCount = 0;

        try {
            const statsResponse = await fetch('/api/market-sentiment/market-stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (statsResponse.ok) {
                const statsResult = await statsResponse.json();
                if (statsResult.success && statsResult.data) {
                    upCount = statsResult.data.upCount;
                    downCount = statsResult.data.downCount;
                    flatCount = statsResult.data.flatCount;
                    const dataType = statsResult.data.isHistorical ? '历史数据' : '实时数据';
                    console.log(`📊 市场涨跌统计(${dataType}): 上涨${upCount}, 下跌${downCount}, 平盘${flatCount}`);
                }
            }
        } catch (error) {
            console.warn('⚠️ 获取市场统计失败:', error);
        }

        const gainLossRatio = (upCount + downCount + flatCount) > 0
            ? upCount / (upCount + downCount + flatCount)
            : 0.5;

        // 计算市场情绪指数 (基于三大指数的涨跌幅)
        // 将平均涨跌幅映射到0-100的情绪指数
        const sentimentIndex = Math.round(50 + (avgChange * 10));
        const sentimentLevel = sentimentIndex >= 60 ? '极度乐观' :
                               sentimentIndex >= 52 ? '乐观' :
                               sentimentIndex >= 48 ? '中性' :
                               sentimentIndex >= 40 ? '谨慎' : '恐慌';

        // 计算市场热度 (基于指数波动幅度)
        const maxChange = Math.max(...quotes.map(q => Math.abs(parseFloat(q.changePercent))));
        const marketHeat = Math.round(Math.min(100, maxChange * 20));
        const heatLevel = marketHeat >= 40 ? '🔥 极热' :
                         marketHeat >= 25 ? '🌡️ 活跃' :
                         marketHeat >= 15 ? '😐 温和' : '❄️ 清淡';

        // 更新市场情绪指数
        updateSentimentCard('sentimentIndex', sentimentIndex.toString(), sentimentLevel);

        // 更新涨跌比例
        const ratioText = `${upCount}:${downCount}`;
        const ratioStatus = gainLossRatio >= 0.6 ? '强势上涨' :
                           gainLossRatio >= 0.4 ? '震荡整理' : '普遍下跌';
        updateSentimentCard('gainLossRatio', ratioText, ratioStatus);

        // 更新北上资金 (真实数据)
        try {
            const northboundResponse = await fetch('/api/market-sentiment/northbound-funds', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (northboundResponse.ok) {
                const northboundResult = await northboundResponse.json();
                if (northboundResult.success && northboundResult.data) {
                    const northboundAmount = parseFloat(northboundResult.data.total);
                    const northboundStatus = northboundAmount >= 0 ? '净流入' : '净流出';
                    updateSentimentCard('northboundFunds',
                        `${northboundAmount >= 0 ? '+' : ''}${northboundAmount}亿`,
                        northboundStatus);
                } else {
                    updateSentimentCard('northboundFunds', '--', '数据获取失败');
                }
            } else {
                updateSentimentCard('northboundFunds', '--', '数据获取失败');
            }
        } catch (error) {
            console.error('❌ 获取北上资金失败:', error);
            updateSentimentCard('northboundFunds', '--', '数据获取失败');
        }

        // 更新市场热度
        updateSentimentCard('marketHeat', `${marketHeat}%`, heatLevel);

    } catch (error) {
        console.error('❌ 加载市场情绪概览失败:', error);
        updateSentimentCard('sentimentIndex', '--', '加载失败');
        updateSentimentCard('gainLossRatio', '--', '加载失败');
        updateSentimentCard('northboundFunds', '--', '加载失败');
        updateSentimentCard('marketHeat', '--', '加载失败');
    }
}

// 更新情绪卡片
function updateSentimentCard(cardId, value, status) {
    const valueElement = document.getElementById(cardId);

    // 正确映射cardId到statusId
    const statusIdMap = {
        'sentimentIndex': 'sentimentStatus',
        'gainLossRatio': 'gainLossStatus',
        'northboundFunds': 'northboundStatus',
        'marketHeat': 'marketHeatStatus'
    };

    const statusElement = document.getElementById(statusIdMap[cardId]);

    if (valueElement) valueElement.textContent = value;
    if (statusElement) statusElement.textContent = status;

    // 根据状态设置颜色
    if (statusElement) {
        statusElement.className = 'sentiment-status';
        if (status.includes('乐观') || status.includes('强势') || status.includes('净流入') || status.includes('极热') || status.includes('活跃')) {
            statusElement.classList.add('positive');
        } else if (status.includes('恐慌') || status.includes('下跌') || status.includes('净流出') || status.includes('清淡')) {
            statusElement.classList.add('negative');
        }
    }
}

// 加载资金流向数据
async function loadFundsFlowData() {
    const container = document.getElementById('fundsFlowData');
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading-text">正在加载资金流向数据...</div>';

        const token = localStorage.getItem('token');
        if (!token) {
            container.innerHTML = '<div class="loading-text">请登录查看资金流向</div>';
            return;
        }

        // 调用真实API获取资金流向数据
        const response = await fetch('/api/market-sentiment/funds-flow', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('获取资金流向失败');
        }

        const result = await response.json();
        if (!result.success || !result.data) {
            throw new Error('资金流向数据为空');
        }

        const fundsFlowData = result.data;

        let html = '<div class="funds-flow-table">';
        html += '<div class="flow-table-header">';
        html += '<div class="flow-col">类型</div>';
        html += '<div class="flow-col">流入(亿)</div>';
        html += '<div class="flow-col">流出(亿)</div>';
        html += '<div class="flow-col">净额(亿)</div>';
        html += '</div>';

        fundsFlowData.forEach(item => {
            const isPositive = item.net >= 0;
            html += `
                <div class="flow-table-row">
                    <div class="flow-col flow-sector">${item.sector}</div>
                    <div class="flow-col flow-inflow">+${item.inflow.toFixed(2)}</div>
                    <div class="flow-col flow-outflow">-${item.outflow.toFixed(2)}</div>
                    <div class="flow-col flow-net ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${item.net.toFixed(2)}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('❌ 加载资金流向失败:', error);
        container.innerHTML = '<div class="loading-text">加载失败</div>';
    }
}

// 加载行业资金流向数据
async function loadIndustryFlowData() {
    const container = document.getElementById('industryFlowData');
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading-text">正在加载行业资金流向...</div>';

        const token = localStorage.getItem('token');
        if (!token) {
            container.innerHTML = '<div class="loading-text">请登录查看行业资金</div>';
            return;
        }

        // 调用真实API获取行业资金流向数据
        const response = await fetch('/api/market-sentiment/industry-flow', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('获取行业资金流向失败');
        }

        const result = await response.json();
        if (!result.success || !result.data) {
            throw new Error('行业资金流向数据为空');
        }

        const industryFlowData = result.data;

        let html = '<div class="industry-flow-table">';
        html += '<div class="flow-table-header">';
        html += '<div class="flow-col">行业</div>';
        html += '<div class="flow-col">净流入(亿)</div>';
        html += '<div class="flow-col">涨跌幅(%)</div>';
        html += '</div>';

        industryFlowData.forEach(item => {
            const isPositive = item.net >= 0;
            html += `
                <div class="flow-table-row">
                    <div class="flow-col flow-industry">${item.industry}</div>
                    <div class="flow-col flow-net ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${item.net.toFixed(2)}
                    </div>
                    <div class="flow-col ${item.change >= 0 ? 'positive' : 'negative'}">
                        ${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('❌ 加载行业资金流向失败:', error);
        container.innerHTML = '<div class="loading-text">加载失败</div>';
    }
}

// 加载龙虎榜数据
async function loadDragonTigerData() {
    const container = document.getElementById('dragonTigerData');
    if (!container) return;

    try {
        container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">正在加载龙虎榜数据...</div>';

        const token = localStorage.getItem('token');
        if (!token) {
            container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">请登录查看龙虎榜</div>';
            return;
        }

        // 调用真实API获取龙虎榜数据
        const response = await fetch('/api/market-sentiment/dragon-tiger', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('获取龙虎榜失败');
        }

        const result = await response.json();

        // 处理空数据情况
        if (!result.data || result.data.length === 0) {
            const message = result.message || '暂无龙虎榜数据';
            container.innerHTML = `<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">${message}</div>`;
            return;
        }

        const dragonTigerData = result.data.map(item => ({
            stockCode: item.code,
            stockName: item.name,
            change: parseFloat(item.change),
            amount: parseFloat(item.amount),
            reason: item.reason
        }));

        let html = '<div class="dragon-tiger-list">';

        dragonTigerData.forEach(item => {
            const isPositive = item.change >= 0;
            html += `
                <div class="dragon-tiger-item">
                    <div class="dt-header">
                        <div class="dt-stock">
                            <span class="dt-name">${item.stockName}</span>
                            <span class="dt-code">${item.stockCode}</span>
                        </div>
                        <div class="dt-change ${isPositive ? 'positive' : 'negative'}">
                            ${isPositive ? '+' : ''}${item.change.toFixed(2)}%
                        </div>
                    </div>
                    <div class="dt-info">
                        <div class="dt-amount">成交额: ¥${item.amount.toFixed(2)}亿</div>
                        <div class="dt-reason">${item.reason}</div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('❌ 加载龙虎榜失败:', error);
        container.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 40px; font-size: 16px;">龙虎榜数据暂时无法获取</div>';
    }
}

// 加载大单追踪数据
async function loadBigOrdersData() {
    const container = document.getElementById('bigOrdersData');
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading-text">正在加载大单追踪数据...</div>';

        const token = localStorage.getItem('token');
        if (!token) {
            container.innerHTML = '<div class="loading-text">请登录查看大单追踪</div>';
            return;
        }

        // 调用真实API获取大单追踪数据
        const response = await fetch('/api/market-sentiment/big-orders', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('获取大单追踪失败');
        }

        const result = await response.json();
        if (!result.success || !result.data) {
            throw new Error('大单追踪数据为空');
        }

        const bigOrdersData = result.data.map(item => ({
            stockCode: item.code,
            stockName: item.name,
            type: item.type,
            amount: parseFloat(item.amount),
            price: parseFloat(item.price),
            time: item.time
        }));

        let html = '<div class="big-orders-list">';

        bigOrdersData.forEach(item => {
            const isBuy = item.type === 'buy';
            html += `
                <div class="big-order-item">
                    <div class="order-header">
                        <div class="order-stock">
                            <span class="order-name">${item.stockName}</span>
                            <span class="order-code">${item.stockCode}</span>
                        </div>
                        <div class="order-type ${isBuy ? 'buy' : 'sell'}">
                            ${isBuy ? '买入' : '卖出'}
                        </div>
                    </div>
                    <div class="order-info">
                        <div class="order-amount">金额: ¥${item.amount.toFixed(2)}亿</div>
                        <div class="order-price">价格: ¥${item.price.toFixed(2)}</div>
                        <div class="order-time">${item.time}</div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('❌ 加载大单追踪失败:', error);
        container.innerHTML = '<div class="loading-text">加载失败</div>';
    }
}

// 初始化情绪分析标签页切换
function initSentimentTabs() {
    const tabBtns = document.querySelectorAll('.sentiment-tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            // 移除所有active状态
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.sentiment-tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // 添加当前active状态
            this.classList.add('active');
            const targetContent = document.getElementById(`${targetTab}-content`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// 将函数暴露到全局作用域
window.loadMarketSentiment = loadMarketSentiment;

// ==================== 监听总资金更新事件 ====================
document.addEventListener('capitalUpdated', (event) => {
    console.log('💰 检测到总资金更新，刷新持仓概览...', event.detail);

    // 重新加载持仓概览统计
    const portfolioStatsContainer = document.getElementById('portfolioStats');
    if (portfolioStatsContainer && portfolioStatsContainer.querySelector('.stats-grid')) {
        // 如果已经有统计数据，重新加载
        loadPortfolioStats();
    }
});

