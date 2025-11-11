// ==================== 核心初始化模块 ====================
// 该文件包含页面加载和初始化的核心逻辑
// 所有功能模块已拆分到 modules/ 目录下

// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuth();
    updateTime();
    setInterval(updateTime, 1000);

    // 初始化Excel上传功能
    initExcelUpload();

    // 初始化页签功能
    initTabs();

    // 初始化模态框点击背景关闭功能
    initModalCloseOnBackgroundClick();

    // 监听 CapitalManager 初始化完成事件
    document.addEventListener('capitalLoaded', () => {
        console.log('💰 CapitalManager 已初始化，开始加载持仓数据...');
        loadUserPositions();
        loadPortfolioStats();
    });

    // 页面加载完成后，延迟加载用户持仓数据和自选股行情
    setTimeout(() => {
        // 如果 CapitalManager 还未初始化（未登录情况），直接加载
        if (!window.CapitalManager || !window.CapitalManager.initialized) {
            console.log('⚠️ CapitalManager 未初始化，直接加载持仓数据...');
            loadUserPositions();
            loadPortfolioStats();
        }

        // 其他不依赖总资金的模块正常加载
        // 只有当总览页签激活时才加载自选股行情，避免不必要的请求
        const activeTab = document.querySelector('.tab-btn.active');
        const currentTab = activeTab ? activeTab.dataset.tab : 'overview';

        if (currentTab === 'overview') {
            loadOverviewWatchlistQuotes();
        }

        loadMarketIndices();
        loadChangeDistribution();
        loadSystemStats();

        // 初始化交易计划管理器（如果用户已登录）
        if (localStorage.getItem('token')) {
            if (typeof TradingPlanManager !== 'undefined') {
                TradingPlanManager.init();
                // 下一交易日计划只在交易计划模块显示，首页不显示
            }
        }

        // 初始化独立行情分析模块
        if (typeof IndependentAnalysisManager !== 'undefined') {
            IndependentAnalysisManager.init();
        }

        // 初始化每日复盘模块
        if (typeof RecapManager !== 'undefined') {
            RecapManager.init();
        }
    }, 500);

    // 启动自动刷新行情（使用设置中的配置）
    // 延迟启动，确保设置已加载
    setTimeout(() => {
        if (typeof startAutoRefresh === 'function') {
            startAutoRefresh();
        }
    }, 1000);

    // 初始化股票代码悬停功能
    setTimeout(() => {
        initStockCodeHover();
    }, 1000);

    // 使用 MutationObserver 监听DOM变化，自动为新添加的股票代码添加悬停功能
    const observer = new MutationObserver((mutations) => {
        let shouldReinit = false;
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                shouldReinit = true;
            }
        });
        if (shouldReinit) {
            // 延迟重新初始化，避免频繁触发
            setTimeout(() => {
                initStockCodeHover();
            }, 500);
        }
    });

    // 监听整个容器的变化
    const container = document.querySelector('.container');
    if (container) {
        observer.observe(container, {
            childList: true,
            subtree: true
        });
    }
});

// 检查认证状态
async function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                updateNavbar(userData);

                // 触发登录成功事件，让 CapitalManager 初始化
                document.dispatchEvent(new CustomEvent('loginSuccess', {
                    detail: { user: userData }
                }));

                return;
            } else {
                // Token无效，清除本地存储
                console.warn('认证token无效，重定向到登录页');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        } catch (error) {
            console.error('认证检查失败:', error);
        }
    }

    // 未登录状态 - 强制重定向到登录页
    console.log('用户未登录，重定向到登录页...');
    window.location.href = '/login.html';
}

// 导出全局函数供HTML调用
window.showStockTooltip = showStockTooltip;
window.closeStockTooltip = closeStockTooltip;
