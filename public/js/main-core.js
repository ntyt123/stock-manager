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

    // 页面加载完成后，延迟加载用户持仓数据和自选股行情
    setTimeout(() => {
        loadUserPositions();
        loadOverviewWatchlistQuotes();
        loadMarketIndices();
        loadPortfolioStats();
        loadChangeDistribution();
        loadSystemStats();

        // 初始化交易计划管理器（如果用户已登录）
        if (localStorage.getItem('token')) {
            if (typeof TradingPlanManager !== 'undefined') {
                TradingPlanManager.init();
                // 下一交易日计划只在交易计划模块显示，首页不显示
            }
        }
    }, 500);

    // 定期更新自选股行情（每30秒）
    setInterval(() => {
        loadOverviewWatchlistQuotes();
        loadMarketIndices();
        loadChangeDistribution();
    }, 30000);

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
                return;
            }
        } catch (error) {
            console.error('认证检查失败:', error);
        }
    }

    // 未登录状态
    updateNavbar(null);
}

// 导出全局函数供HTML调用
window.showStockTooltip = showStockTooltip;
window.closeStockTooltip = closeStockTooltip;
