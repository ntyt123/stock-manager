// ==================== UI 工具函数模块 ====================
// 包含：通知、导航栏、页签切换、模态框等基础UI功能

// 显示通知
// category 参数：'general'（通用）、'price'（价格预警）、'plan'（计划提醒）、'risk'（风险预警）
function showNotification(message, type = 'info', category = 'general') {
    // 获取通知设置
    const settings = window.SettingsManager ? window.SettingsManager.getSettings() : {};

    // 检查总开关
    if (settings.enableNotification === false) {
        console.log('🔕 通知已禁用，跳过显示:', message);
        return;
    }

    // 根据分类检查具体设置
    if (category === 'price' && settings.priceAlert === false) {
        console.log('🔕 价格预警通知已禁用，跳过显示:', message);
        return;
    }
    if (category === 'plan' && settings.planReminder === false) {
        console.log('🔕 计划提醒通知已禁用，跳过显示:', message);
        return;
    }
    if (category === 'risk' && settings.riskAlert === false) {
        console.log('🔕 风险预警通知已禁用，跳过显示:', message);
        return;
    }

    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // 添加到页面
    document.body.appendChild(notification);

    // 3秒后自动移除
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// 更新导航栏状态
function updateNavbar(user) {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminBtn = document.getElementById('adminBtn');
    const userName = document.getElementById('userName');
    const userBadge = document.getElementById('userBadge');

    if (user) {
        // 已登录状态
        userName.textContent = user.username;

        // 设置用户等级标识
        let badgeText = '';
        let badgeClass = '';

        switch(user.role) {
            case 'super_admin':
                badgeText = '超级管理员';
                badgeClass = 'badge-super-admin';
                break;
            case 'admin':
                badgeText = '管理员';
                badgeClass = 'badge-admin';
                break;
            default:
                badgeText = '用户';
                badgeClass = 'badge-user';
        }

        userBadge.textContent = badgeText;
        userBadge.className = `user-badge ${badgeClass}`;

        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';

        // 如果是管理员，显示管理按钮
        if (user.role === 'admin' || user.role === 'super_admin') {
            adminBtn.style.display = 'inline-block';
        } else {
            adminBtn.style.display = 'none';
        }
    } else {
        // 未登录状态
        userName.textContent = '游客';
        userBadge.textContent = '游客';
        userBadge.className = 'user-badge badge-user';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        adminBtn.style.display = 'none';

        // 清除本地存储
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
}

// 跳转到登录页面
function goToLogin() {
    window.location.href = '/login.html';
}

// 跳转到管理页面
function goToAdmin() {
    window.location.href = '/admin.html';
}

// 退出登录
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateNavbar(null);

    // 显示退出成功消息
    showNotification('已成功退出登录', 'success');
}

// 更新当前时间
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN');
    const dateString = now.toLocaleDateString('zh-CN');

    const currentTimeEl = document.getElementById('currentTime');
    if (currentTimeEl) {
        currentTimeEl.textContent = timeString;
    }

    // 每5分钟更新一次最后更新时间
    if (now.getMinutes() % 5 === 0 && now.getSeconds() === 0) {
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = `${dateString} ${timeString}`;
        }
    }
}

// 初始化页签功能
function initTabs() {
    // 为所有主页签按钮添加点击事件
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = function() {
            switchTab(this.getAttribute('data-tab'));
        };
    });

    // 为所有子页签按钮添加点击事件
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.onclick = function() {
            switchSubTab(this);
        };
    });
}

// 页签切换功能
function switchTab(tabName) {
    // 移除所有按钮的active类
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 移除所有内容的active类
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 激活选中的按钮
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');

    // 显示选中的内容
    const content = document.getElementById(tabName + '-tab');
    if (content) {
        content.classList.add('active');

        // 加载页签数据
        loadTabData(tabName);
    }
}

// 子页签切换功能
function switchSubTab(button) {
    const subtabId = button.getAttribute('data-subtab');

    // 获取当前按钮所在的导航容器
    const navigation = button.closest('.sub-tab-navigation');

    // 移除同级所有子页签按钮的active类
    navigation.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 激活当前按钮
    button.classList.add('active');

    // 获取对应的内容容器
    const contentArea = navigation.nextElementSibling;

    // 隐藏所有子页签内容
    contentArea.querySelectorAll('.sub-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 显示对应的子页签内容
    const targetContent = document.getElementById(subtabId);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    // 根据子页签ID加载对应数据
    loadSubTabData(subtabId);
}

// 加载子页签数据
function loadSubTabData(subtabId) {
    switch (subtabId) {
        case 'market-industry':
            // 加载行业分布数据
            if (typeof loadIndustryDistribution === 'function') {
                loadIndustryDistribution();
            }
            break;
        case 'overview-trading-plans':
            // 加载交易计划数据
            if (typeof TradingPlanManager !== 'undefined' && typeof TradingPlanManager.loadAllTradingPlans === 'function') {
                TradingPlanManager.loadAllTradingPlans();
            }
            break;
        // 可以在这里添加其他子页签的数据加载逻辑
        default:
            break;
    }
}

// 加载页签数据
function loadTabData(tabName) {
    switch (tabName) {
        case 'overview':
            // 总览页签已经默认加载
            break;
        case 'market':
            if (typeof loadMarketData === 'function') {
                loadMarketData();
            }
            break;
        case 'analysis':
            if (typeof loadAnalysisData === 'function') {
                loadAnalysisData();
            }
            break;
        case 'trading':
            // 加载交易计划数据
            if (typeof TradingPlanManager !== 'undefined' && typeof TradingPlanManager.loadAllTradingPlans === 'function') {
                TradingPlanManager.loadAllTradingPlans();
            }
            break;
    }
}

// 初始化模态框点击背景关闭功能
function initModalCloseOnBackgroundClick() {
    // 报告历史模态框
    const reportHistoryModal = document.getElementById('reportHistoryModal');
    if (reportHistoryModal) {
        reportHistoryModal.addEventListener('click', function(event) {
            if (event.target === reportHistoryModal && typeof closeReportHistoryModal === 'function') {
                closeReportHistoryModal();
            }
        });
    }

    // 报告详情模态框
    const reportDetailModal = document.getElementById('reportDetailModal');
    if (reportDetailModal) {
        reportDetailModal.addEventListener('click', function(event) {
            if (event.target === reportDetailModal && typeof closeReportDetailModal === 'function') {
                closeReportDetailModal();
            }
        });
    }

    // Excel上传模态框
    const excelUploadModal = document.getElementById('excelUploadModal');
    if (excelUploadModal) {
        excelUploadModal.addEventListener('click', function(event) {
            if (event.target === excelUploadModal && typeof closeExcelUploadModal === 'function') {
                closeExcelUploadModal();
            }
        });
    }

    // 集合竞价历史模态框
    const callAuctionHistoryModal = document.getElementById('callAuctionHistoryModal');
    if (callAuctionHistoryModal) {
        callAuctionHistoryModal.addEventListener('click', function(event) {
            if (event.target === callAuctionHistoryModal && typeof closeCallAuctionHistoryModal === 'function') {
                closeCallAuctionHistoryModal();
            }
        });
    }

    // 集合竞价详情模态框
    const callAuctionDetailModal = document.getElementById('callAuctionDetailModal');
    if (callAuctionDetailModal) {
        callAuctionDetailModal.addEventListener('click', function(event) {
            if (event.target === callAuctionDetailModal && typeof closeCallAuctionDetailModal === 'function') {
                closeCallAuctionDetailModal();
            }
        });
    }

    // 股票推荐历史模态框
    const recommendationHistoryModal = document.getElementById('recommendationHistoryModal');
    if (recommendationHistoryModal) {
        recommendationHistoryModal.addEventListener('click', function(event) {
            if (event.target === recommendationHistoryModal && typeof closeRecommendationHistoryModal === 'function') {
                closeRecommendationHistoryModal();
            }
        });
    }

    // 股票推荐详情模态框
    const recommendationDetailModal = document.getElementById('recommendationDetailModal');
    if (recommendationDetailModal) {
        recommendationDetailModal.addEventListener('click', function(event) {
            if (event.target === recommendationDetailModal && typeof closeRecommendationDetailModal === 'function') {
                closeRecommendationDetailModal();
            }
        });
    }
}

// 添加通知样式
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        }

        .notification.success {
            background: linear-gradient(135deg, #e74c3c, #c0392b);
        }

        .notification.info {
            background: linear-gradient(135deg, #3498db, #2980b9);
        }

        .notification.error {
            background: linear-gradient(135deg, #27ae60, #2ecc71);
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-left: 8px;
        }

        .status-indicator.online {
            background: #e74c3c;
        }

        .status-indicator.offline {
            background: #95a5a6;
        }

        .user-info {
            display: flex;
            align-items: center;
            margin-right: 15px;
            font-weight: 600;
        }
    `;
    if (document.head) {
        document.head.appendChild(style);
    }
})();
