// ==================== settings-manager.js ====================
// 系统设置管理模块

const SettingsManager = {
    // 默认设置值
    defaultSettings: {
        // 资金设置
        totalCapital: 0,
        refreshInterval: 0,

        // 交易设置
        feeRate: 0.0003,
        stopProfit: 10,
        stopLoss: 5,
        defaultPosition: 30,

        // 显示设置
        theme: 'light',
        autoRefresh: false,
        chartPeriod: 'day',
        colorScheme: 'red-green',

        // 通知设置
        enableNotification: false,
        priceAlert: false,
        planReminder: false,

        // 风险管理
        riskPreference: 'balanced',
        dailyLossLimit: 5,
        maxPosition: 80,
        singleStockLimit: 20
    },

    // 打开设置模态框
    openSettings() {
        console.log('📝 打开系统设置');
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('show');
            this.loadSettings();
            this.initEventListeners();
            this.loadSystemInfo();
        }
    },

    // 关闭设置模态框
    closeSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.remove('show');
        }
    },

    // 初始化事件监听器
    initEventListeners() {
        // 左侧导航点击事件
        const navItems = document.querySelectorAll('.settings-nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', async () => {
                // 移除所有激活状态
                navItems.forEach(n => n.classList.remove('active'));
                document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));

                // 添加当前激活状态
                item.classList.add('active');
                const sectionId = 'settings-' + item.dataset.section;
                const section = document.getElementById(sectionId);
                if (section) {
                    section.classList.add('active');
                }

                // 如果切换到AI提示词管理，初始化AIPromptManager
                if (item.dataset.section === 'ai-prompts' && window.AIPromptManager) {
                    await window.AIPromptManager.init();
                }

                // 如果切换到AI API配置，初始化AIApiConfigManager
                if (item.dataset.section === 'ai-api' && window.AIApiConfigManager) {
                    await window.AIApiConfigManager.init();
                }
            });
        });

        // 点击模态框外部关闭
        const modal = document.getElementById('settingsModal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeSettings();
            }
        });
    },

    // 加载设置
    loadSettings() {
        const settings = this.getSettings();

        // 账户设置
        const userInfo = this.getUserInfo();
        const usernameInput = document.getElementById('setting-username');
        if (usernameInput) usernameInput.value = userInfo.username || '未登录';

        const userRoleBadge = document.getElementById('setting-user-role');
        if (userRoleBadge) userRoleBadge.textContent = userInfo.role || '游客';

        // 资金设置
        const totalCapitalInput = document.getElementById('setting-total-capital');
        if (totalCapitalInput && window.CapitalManager) {
            totalCapitalInput.value = window.CapitalManager.getTotalCapital() || 0;
        }

        const refreshIntervalSelect = document.getElementById('setting-refresh-interval');
        if (refreshIntervalSelect) refreshIntervalSelect.value = settings.refreshInterval;

        // 交易设置
        this.setInputValue('setting-fee-rate', settings.feeRate * 100); // 转换为百分比
        this.setInputValue('setting-stop-profit', settings.stopProfit);
        this.setInputValue('setting-stop-loss', settings.stopLoss);
        this.setInputValue('setting-default-position', settings.defaultPosition);

        // 显示设置
        this.setSelectValue('setting-theme', settings.theme);
        this.setCheckboxValue('setting-auto-refresh', settings.autoRefresh);
        this.setSelectValue('setting-chart-period', settings.chartPeriod);
        this.setSelectValue('setting-color-scheme', settings.colorScheme);

        // 通知设置
        this.setCheckboxValue('setting-enable-notification', settings.enableNotification);
        this.setCheckboxValue('setting-price-alert', settings.priceAlert);
        this.setCheckboxValue('setting-plan-reminder', settings.planReminder);

        // 风险管理
        this.setSelectValue('setting-risk-preference', settings.riskPreference);
        this.setInputValue('setting-daily-loss-limit', settings.dailyLossLimit);
        this.setInputValue('setting-max-position', settings.maxPosition);
        this.setInputValue('setting-single-stock-limit', settings.singleStockLimit);
    },

    // 保存设置
    async saveSettings() {
        try {
            // 先获取旧设置，用于比较变化
            const oldSettings = this.getSettings();

            const settings = {
                // 资金设置
                totalCapital: parseFloat(document.getElementById('setting-total-capital')?.value) || 0,
                refreshInterval: parseInt(document.getElementById('setting-refresh-interval')?.value) || 0,

                // 交易设置
                feeRate: parseFloat(document.getElementById('setting-fee-rate')?.value) / 100 || 0.0003, // 从百分比转换
                stopProfit: parseFloat(document.getElementById('setting-stop-profit')?.value) || 10,
                stopLoss: parseFloat(document.getElementById('setting-stop-loss')?.value) || 5,
                defaultPosition: parseFloat(document.getElementById('setting-default-position')?.value) || 30,

                // 显示设置
                theme: document.getElementById('setting-theme')?.value || 'light',
                autoRefresh: document.getElementById('setting-auto-refresh')?.checked || false,
                chartPeriod: document.getElementById('setting-chart-period')?.value || 'day',
                colorScheme: document.getElementById('setting-color-scheme')?.value || 'red-green',

                // 通知设置
                enableNotification: document.getElementById('setting-enable-notification')?.checked || false,
                priceAlert: document.getElementById('setting-price-alert')?.checked || false,
                planReminder: document.getElementById('setting-plan-reminder')?.checked || false,

                // 风险管理
                riskPreference: document.getElementById('setting-risk-preference')?.value || 'balanced',
                dailyLossLimit: parseFloat(document.getElementById('setting-daily-loss-limit')?.value) || 5,
                maxPosition: parseFloat(document.getElementById('setting-max-position')?.value) || 80,
                singleStockLimit: parseFloat(document.getElementById('setting-single-stock-limit')?.value) || 20
            };

            // 保存到 localStorage
            localStorage.setItem('systemSettings', JSON.stringify(settings));

            // 如果总资金有变化，同步更新到 CapitalManager
            if (window.CapitalManager && settings.totalCapital) {
                await window.CapitalManager.updateTotalCapital(settings.totalCapital);
            }

            // 应用设置
            this.applySettings(settings);

            // 重新启动自动刷新（如果有）
            if (typeof startAutoRefresh === 'function') {
                console.log('🔄 重新启动自动刷新行情...');
                startAutoRefresh();
            }

            // 如果K线图默认周期有变化，重新加载所有行情数据以应用新周期
            if (oldSettings.chartPeriod !== settings.chartPeriod) {
                console.log(`📊 K线图默认周期已变更: ${oldSettings.chartPeriod} → ${settings.chartPeriod}`);
                console.log('🔄 重新加载所有K线图以应用新周期...');

                // 重新加载市场指数
                if (typeof loadMarketIndices === 'function') {
                    setTimeout(() => loadMarketIndices(), 100);
                }

                // 重新加载自选股行情
                if (typeof loadWatchlistQuotes === 'function') {
                    setTimeout(() => loadWatchlistQuotes(), 150);
                }

                // 重新加载总览自选股行情
                if (typeof loadOverviewWatchlistQuotes === 'function') {
                    setTimeout(() => loadOverviewWatchlistQuotes(), 200);
                }
            }

            showNotification('设置保存成功', 'success');
            console.log('✅ 设置已保存:', settings);

            // 延迟关闭模态框
            setTimeout(() => {
                this.closeSettings();
            }, 500);

        } catch (error) {
            console.error('❌ 保存设置失败:', error);
            showNotification('保存设置失败', 'error');
        }
    },

    // 应用设置
    applySettings(settings) {
        // 应用主题
        if (settings.theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }

        // 应用涨跌颜色
        if (settings.colorScheme === 'green-red') {
            document.body.classList.add('green-red-scheme');
        } else {
            document.body.classList.remove('green-red-scheme');
        }

        console.log('✅ 设置已应用');
    },

    // 恢复默认设置
    resetSettings() {
        if (!confirm('确定要恢复所有设置为默认值吗？')) {
            return;
        }

        localStorage.setItem('systemSettings', JSON.stringify(this.defaultSettings));
        this.loadSettings();
        showNotification('已恢复默认设置', 'info');
        console.log('✅ 已恢复默认设置');
    },

    // 获取当前设置
    getSettings() {
        try {
            const saved = localStorage.getItem('systemSettings');
            if (saved) {
                return { ...this.defaultSettings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('获取设置失败:', error);
        }
        return { ...this.defaultSettings };
    },

    // 获取用户信息
    getUserInfo() {
        const token = localStorage.getItem('token');
        if (!token) {
            return { username: '未登录', role: '游客' };
        }

        try {
            const tokenData = JSON.parse(atob(token.split('.')[1]));
            return {
                username: tokenData.account || '未知用户',
                role: tokenData.role === 'super_admin' ? '超级管理员' :
                      tokenData.role === 'admin' ? '管理员' : '普通用户'
            };
        } catch (error) {
            return { username: '未知用户', role: '普通用户' };
        }
    },

    // 加载系统信息
    async loadSystemInfo() {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            // 加载持仓股票数
            const positionsRes = await fetch('/api/positions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (positionsRes.ok) {
                const posData = await positionsRes.json();
                const stockCount = document.getElementById('setting-stock-count');
                if (stockCount && posData.success) {
                    stockCount.textContent = posData.data.positions.length || 0;
                }
            }

            // 加载交易记录数
            const tradesRes = await fetch('/api/trade-operations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (tradesRes.ok) {
                const tradeData = await tradesRes.json();
                const tradeCount = document.getElementById('setting-trade-count');
                if (tradeCount && tradeData.success) {
                    tradeCount.textContent = tradeData.data.length || 0;
                }
            }
        } catch (error) {
            console.error('加载系统信息失败:', error);
        }
    },

    // 修改密码
    async changePassword() {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('请先登录');
            return;
        }

        const oldPassword = prompt('请输入当前密码:');
        if (!oldPassword) return;

        const newPassword = prompt('请输入新密码:');
        if (!newPassword) {
            alert('密码不能为空');
            return;
        }

        const confirmPassword = prompt('请再次输入新密码:');
        if (newPassword !== confirmPassword) {
            alert('两次输入的密码不一致');
            return;
        }

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    oldPassword,
                    newPassword
                })
            });

            const result = await response.json();

            if (result.success) {
                showNotification('密码修改成功', 'success');
            } else {
                showNotification(result.error || '密码修改失败', 'error');
            }
        } catch (error) {
            console.error('修改密码错误:', error);
            showNotification('网络错误，请重试', 'error');
        }
    },

    // 导出数据
    async exportData() {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('请先登录', 'error');
            return;
        }

        try {
            showNotification('正在导出数据...', 'info');
            console.log('📦 开始导出数据...');

            // 并行获取所有数据
            const [positionsRes, tradesRes, plansRes, watchlistRes] = await Promise.all([
                fetch('/api/positions', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/trade-operations', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/trading-plans?limit=1000', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/watchlist', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            // 检查响应状态
            console.log('📊 API响应状态:', {
                positions: positionsRes.status,
                trades: tradesRes.status,
                plans: plansRes.status,
                watchlist: watchlistRes.status
            });

            // 安全解析JSON响应
            const parseJsonSafely = async (response, name) => {
                try {
                    const text = await response.text();
                    console.log(`📄 ${name} 响应内容 (前100字符):`, text.substring(0, 100));

                    // 检查是否是HTML响应
                    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                        console.warn(`⚠️ ${name} 返回了HTML而不是JSON`);
                        return { success: false, data: null, error: '服务器返回了无效的响应' };
                    }

                    return JSON.parse(text);
                } catch (error) {
                    console.error(`❌ 解析 ${name} 响应失败:`, error);
                    return { success: false, data: null, error: error.message };
                }
            };

            // 解析所有响应
            const positions = await parseJsonSafely(positionsRes, 'positions');
            const trades = await parseJsonSafely(tradesRes, 'trades');
            const plans = await parseJsonSafely(plansRes, 'plans');
            const watchlist = await parseJsonSafely(watchlistRes, 'watchlist');

            // 获取用户信息
            const userInfo = this.getUserInfo();

            // 检查是否有任何数据获取失败
            const errors = [];
            if (!positions.success) errors.push('持仓数据: ' + (positions.error || '获取失败'));
            if (!trades.success) errors.push('交易记录: ' + (trades.error || '获取失败'));
            if (!plans.success) errors.push('交易计划: ' + (plans.error || '获取失败'));
            if (!watchlist.success) errors.push('自选股: ' + (watchlist.error || '获取失败'));

            if (errors.length > 0) {
                console.warn('⚠️ 部分数据获取失败:', errors);
                const continueExport = confirm(
                    `以下数据获取失败:\n${errors.join('\n')}\n\n是否继续导出可用数据？`
                );
                if (!continueExport) {
                    showNotification('已取消导出', 'info');
                    return;
                }
            }

            // 构建导出数据
            const exportData = {
                version: '1.0.0',
                exportTime: new Date().toISOString(),
                exportBy: userInfo.username,
                data: {
                    // 持仓数据
                    positions: positions.success ? (positions.data?.positions || []) : [],

                    // 交易记录
                    trades: trades.success ? (trades.data || []) : [],

                    // 交易计划
                    tradingPlans: plans.success ? (plans.data?.plans || []) : [],

                    // 自选股
                    watchlist: watchlist.success ? (watchlist.data || []) : [],

                    // 系统设置
                    settings: this.getSettings(),

                    // 总资金
                    totalCapital: window.CapitalManager ? window.CapitalManager.getTotalCapital() : 0
                },
                statistics: {
                    positionsCount: positions.success ? (positions.data?.positions?.length || 0) : 0,
                    tradesCount: trades.success ? (trades.data?.length || 0) : 0,
                    plansCount: plans.success ? (plans.data?.plans?.length || 0) : 0,
                    watchlistCount: watchlist.success ? (watchlist.data?.length || 0) : 0
                },
                errors: errors.length > 0 ? errors : undefined
            };

            // 创建文件名（包含日期和时间）
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            const filename = `stock-manager-export-${dateStr}-${timeStr}.json`;

            // 下载JSON文件
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('✅ 数据导出成功:', exportData.statistics);
            showNotification(`导出成功！共导出 ${exportData.statistics.positionsCount} 个持仓、${exportData.statistics.tradesCount} 条交易记录`, 'success');
        } catch (error) {
            console.error('❌ 导出数据失败:', error);
            showNotification('导出数据失败: ' + error.message, 'error');
        }
    },

    // 导入数据
    async importData() {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('请先登录', 'error');
            return;
        }

        // 创建文件选择器
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                showNotification('正在读取文件...', 'info');
                console.log('📂 开始读取文件:', file.name);

                // 读取文件内容
                const text = await file.text();
                const importData = JSON.parse(text);

                // 验证数据格式
                if (!importData.version || !importData.data) {
                    throw new Error('无效的数据格式');
                }

                console.log('📊 导入数据统计:', importData.statistics);

                // 显示导入确认对话框
                const confirmMessage = `
确认导入以下数据吗？

导出时间: ${new Date(importData.exportTime).toLocaleString('zh-CN')}
导出者: ${importData.exportBy || '未知'}

数据统计:
- 持仓: ${importData.statistics?.positionsCount || 0} 个
- 交易记录: ${importData.statistics?.tradesCount || 0} 条
- 交易计划: ${importData.statistics?.plansCount || 0} 个
- 自选股: ${importData.statistics?.watchlistCount || 0} 个

⚠️ 警告: 导入将覆盖现有数据！
                `.trim();

                if (!confirm(confirmMessage)) {
                    showNotification('已取消导入', 'info');
                    return;
                }

                // 执行导入
                await this.performImport(importData);

            } catch (error) {
                console.error('❌ 导入数据失败:', error);
                showNotification('导入数据失败: ' + error.message, 'error');
            }
        };

        // 触发文件选择
        input.click();
    },

    // 执行导入操作
    async performImport(importData) {
        const token = localStorage.getItem('token');
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        try {
            showNotification('正在导入数据，请稍候...', 'info');

            // 1. 导入系统设置
            if (importData.data.settings) {
                try {
                    localStorage.setItem('systemSettings', JSON.stringify(importData.data.settings));
                    this.applySettings(importData.data.settings);
                    console.log('✅ 系统设置导入成功');
                } catch (error) {
                    console.error('❌ 系统设置导入失败:', error);
                    errors.push('系统设置: ' + error.message);
                }
            }

            // 2. 导入总资金
            if (importData.data.totalCapital && window.CapitalManager) {
                try {
                    await window.CapitalManager.updateTotalCapital(importData.data.totalCapital);
                    console.log('✅ 总资金导入成功:', importData.data.totalCapital);
                } catch (error) {
                    console.error('❌ 总资金导入失败:', error);
                    errors.push('总资金: ' + error.message);
                }
            }

            // 3. 导入自选股
            if (importData.data.watchlist && importData.data.watchlist.length > 0) {
                try {
                    const stocks = importData.data.watchlist.map(item => ({
                        stockCode: item.stock_code,
                        stockName: item.stock_name
                    }));

                    const response = await fetch('/api/watchlist', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ stocks })
                    });

                    const result = await response.json();
                    if (result.success) {
                        console.log(`✅ 自选股导入成功: ${result.data.successCount} 个`);
                        successCount += result.data.successCount;
                    }
                } catch (error) {
                    console.error('❌ 自选股导入失败:', error);
                    errors.push('自选股: ' + error.message);
                    errorCount++;
                }
            }

            // 4. 导入持仓数据
            if (importData.data.positions && importData.data.positions.length > 0) {
                try {
                    // 逐条导入持仓数据
                    let positionSuccessCount = 0;
                    for (const position of importData.data.positions) {
                        try {
                            // 移除 id 和 user_id 字段，并转换字段名为驼峰格式
                            const { id, user_id, stock_code, stock_name, cost_price, current_price, market_value, profit_loss, profit_loss_rate, ...restData } = position;

                            const positionData = {
                                stockCode: stock_code || position.stockCode,
                                stockName: stock_name || position.stockName,
                                quantity: position.quantity,
                                costPrice: cost_price || position.costPrice,
                                currentPrice: current_price || position.currentPrice,
                                marketValue: market_value || position.marketValue,
                                profitLoss: profit_loss || position.profitLoss,
                                profitLossRate: profit_loss_rate || position.profitLossRate,
                                ...restData
                            };

                            // 先尝试添加，如果已存在则更新
                            let response = await fetch('/api/positions/add', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify(positionData)
                            });

                            let result = await response.json();

                            // 如果提示已存在，则改用更新
                            if (!result.success && result.error && result.error.includes('已存在')) {
                                console.log(`📝 持仓已存在，改为更新: ${positionData.stockName} (${positionData.stockCode})`);

                                response = await fetch(`/api/positions/${positionData.stockCode}`, {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify(positionData)
                                });

                                result = await response.json();
                            }

                            if (result.success) {
                                positionSuccessCount++;
                            } else {
                                console.warn('⚠️ 持仓导入失败:', positionData.stockName, result.error);
                            }
                        } catch (err) {
                            console.error('❌ 导入持仓失败:', position, err);
                        }
                    }
                    console.log(`✅ 持仓数据导入成功: ${positionSuccessCount}/${importData.data.positions.length} 个`);
                    successCount += positionSuccessCount;

                    if (positionSuccessCount < importData.data.positions.length) {
                        const failedCount = importData.data.positions.length - positionSuccessCount;
                        errors.push(`持仓数据: ${failedCount} 个导入失败`);
                        errorCount++;
                    }
                } catch (error) {
                    console.error('❌ 持仓数据导入失败:', error);
                    errors.push('持仓数据: ' + error.message);
                    errorCount++;
                }
            }

            // 5. 导入交易记录
            if (importData.data.trades && importData.data.trades.length > 0) {
                try {
                    // 逐条导入交易记录
                    let tradeSuccessCount = 0;
                    for (const trade of importData.data.trades) {
                        try {
                            // 移除 id 和 user_id 字段，并转换字段名为驼峰格式
                            const { id, user_id, trade_type, trade_date, stock_code, stock_name, ...restData } = trade;

                            const tradeData = {
                                tradeType: trade_type || trade.tradeType,
                                tradeDate: trade_date || trade.tradeDate,
                                stockCode: stock_code || trade.stockCode,
                                stockName: stock_name || trade.stockName,
                                quantity: trade.quantity,
                                price: trade.price,
                                fee: trade.fee,
                                amount: trade.amount,
                                notes: trade.notes,
                                ...restData
                            };

                            const response = await fetch('/api/trade-operations', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify(tradeData)
                            });

                            const result = await response.json();
                            if (result.success) {
                                tradeSuccessCount++;
                            } else {
                                console.warn('⚠️ 交易记录导入失败:', trade.stockName, result.error);
                            }
                        } catch (err) {
                            console.error('❌ 导入交易记录失败:', trade, err);
                        }
                    }
                    console.log(`✅ 交易记录导入成功: ${tradeSuccessCount}/${importData.data.trades.length} 条`);
                    successCount += tradeSuccessCount;

                    if (tradeSuccessCount < importData.data.trades.length) {
                        const failedCount = importData.data.trades.length - tradeSuccessCount;
                        errors.push(`交易记录: ${failedCount} 条导入失败`);
                        errorCount++;
                    }
                } catch (error) {
                    console.error('❌ 交易记录导入失败:', error);
                    errors.push('交易记录: ' + error.message);
                    errorCount++;
                }
            }

            // 6. 导入交易计划
            if (importData.data.tradingPlans && importData.data.tradingPlans.length > 0) {
                try {
                    // 逐条导入交易计划
                    let planSuccessCount = 0;
                    for (const plan of importData.data.tradingPlans) {
                        try {
                            // 移除 id、user_id 和其他自动生成的字段
                            // 注意：交易计划API期望下划线命名，不需要转换
                            const { id, user_id, created_at, updated_at, ...planData } = plan;

                            const response = await fetch('/api/trading-plans', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify(planData)
                            });

                            const result = await response.json();
                            if (result.success) {
                                planSuccessCount++;
                            } else {
                                console.warn('⚠️ 交易计划导入失败:', plan.stock_name, result.error);
                            }
                        } catch (err) {
                            console.error('❌ 导入交易计划失败:', plan, err);
                        }
                    }
                    console.log(`✅ 交易计划导入成功: ${planSuccessCount}/${importData.data.tradingPlans.length} 个`);
                    successCount += planSuccessCount;

                    if (planSuccessCount < importData.data.tradingPlans.length) {
                        const failedCount = importData.data.tradingPlans.length - planSuccessCount;
                        errors.push(`交易计划: ${failedCount} 个导入失败`);
                        errorCount++;
                    }
                } catch (error) {
                    console.error('❌ 交易计划导入失败:', error);
                    errors.push('交易计划: ' + error.message);
                    errorCount++;
                }
            }

            // 显示导入结果
            let resultMessage = '数据导入完成！\n\n';
            if (successCount > 0) {
                resultMessage += `✅ 成功导入 ${successCount} 项数据\n`;
            }
            if (errorCount > 0) {
                resultMessage += `❌ ${errorCount} 项数据导入失败\n`;
            }
            if (errors.length > 0) {
                resultMessage += '\n错误详情:\n' + errors.join('\n');
            }

            alert(resultMessage);

            if (successCount > 0) {
                showNotification(`导入成功！共导入 ${successCount} 项数据`, 'success');

                // 刷新页面数据
                setTimeout(() => {
                    location.reload();
                }, 2000);
            } else if (errorCount > 0) {
                showNotification('导入失败，请检查数据格式', 'error');
            }

        } catch (error) {
            console.error('❌ 导入过程出错:', error);
            showNotification('导入过程出错: ' + error.message, 'error');
        }
    },

    // 清除缓存
    clearCache() {
        if (!confirm('确定要清除所有缓存数据吗？这将清除暂存的行情数据。')) {
            return;
        }

        // 只清除缓存相关的数据，保留设置和登录信息
        const keysToKeep = ['token', 'systemSettings', 'user_total_capital'];
        const allKeys = Object.keys(localStorage);

        allKeys.forEach(key => {
            if (!keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        });

        showNotification('缓存已清除', 'success');
        console.log('✅ 缓存已清除');
    },

    // 清除所有数据
    async clearAllData() {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('请先登录', 'error');
            return;
        }

        // 第一次确认
        const confirm1 = confirm(
            '⚠️ 危险操作警告！\n\n' +
            '此操作将永久删除您的所有数据，包括：\n' +
            '✓ 所有持仓数据\n' +
            '✓ 所有交易记录\n' +
            '✓ 所有交易计划\n' +
            '✓ 所有持仓成本记录\n' +
            '✓ 所有分析报告\n' +
            '✓ 自选股列表\n' +
            '✓ 其他相关数据\n\n' +
            '账户信息将被保留，但所有业务数据将被永久删除！\n\n' +
            '确定要继续吗？'
        );

        if (!confirm1) {
            showNotification('已取消操作', 'info');
            return;
        }

        // 第二次确认
        const confirm2 = confirm(
            '⚠️ 最后确认！\n\n' +
            '这是您最后一次机会！\n' +
            '数据删除后将无法恢复！\n\n' +
            '建议在删除前先导出数据进行备份。\n\n' +
            '确定要清除所有数据吗？'
        );

        if (!confirm2) {
            showNotification('已取消操作', 'info');
            return;
        }

        // 要求输入密码确认
        const password = prompt('请输入您的账户密码以确认此操作：');
        if (!password) {
            showNotification('已取消操作', 'info');
            return;
        }

        try {
            showNotification('正在清除数据，请稍候...', 'info');
            console.log('🔥 开始清除所有数据...');

            const response = await fetch('/api/auth/clear-data', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ password })
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ 数据清除成功:', result.stats);

                // 显示清除统计
                let statsMessage = '数据清除成功！\n\n清除统计：\n';
                const stats = result.stats || {};
                statsMessage += `✓ 持仓数据: ${stats.positions || 0} 条\n`;
                statsMessage += `✓ 自选股: ${stats.watchlist || 0} 条\n`;
                statsMessage += `✓ 分析报告: ${stats.analysisReports || 0} 条\n`;
                statsMessage += `✓ 手动持仓: ${stats.manualPositions || 0} 条\n`;
                statsMessage += `✓ 交易记录: ${stats.tradeOperations || 0} 条\n`;
                statsMessage += `✓ 交易计划: ${stats.tradingPlans || 0} 条\n`;
                statsMessage += `✓ 计划执行记录: ${stats.planExecutions || 0} 条\n`;
                statsMessage += `✓ 成本记录: ${stats.costRecords || 0} 条\n`;
                statsMessage += `✓ 成本调整记录: ${stats.costAdjustments || 0} 条\n`;
                statsMessage += `✓ 持仓更新记录: ${stats.positionUpdates || 0} 条\n`;
                statsMessage += `✓ 交易日志: ${stats.tradingLogs || 0} 条\n`;
                statsMessage += `✓ 每日复盘: ${stats.dailyRecaps || 0} 条\n`;
                statsMessage += `✓ 资金账户: ${stats.fundAccounts || 0} 条\n`;
                statsMessage += `✓ 资金交易: ${stats.fundTransactions || 0} 条\n`;
                statsMessage += `✓ 风险预警: ${stats.riskWarnings || 0} 条\n`;
                statsMessage += `✓ 风险事件: ${stats.riskEvents || 0} 条\n`;
                statsMessage += `✓ 股票池: ${stats.stockPools || 0} 条\n`;
                statsMessage += `✓ 股票池项目: ${stats.stockPoolItems || 0} 条\n`;
                statsMessage += `✓ 组合优化: ${stats.portfolioOptimizations || 0} 条\n`;
                statsMessage += `✓ 预测历史: ${stats.predictionHistory || 0} 条\n`;
                statsMessage += `✓ 三日选股结果: ${stats.threeDaySelectionResults || 0} 条\n`;
                statsMessage += `✓ 集合竞价分析: ${stats.callAuctionAnalysis || 0} 条\n`;
                statsMessage += `✓ 总资金已重置为: ¥0\n`;

                alert(statsMessage);
                showNotification('所有数据已清除，即将退出登录...', 'success');

                // 清除本地缓存（不弹确认框，直接清除所有缓存包括token）
                const allKeys = Object.keys(localStorage);
                allKeys.forEach(key => {
                    localStorage.removeItem(key);
                });
                console.log('✅ 本地缓存已清除（包括登录状态）');

                // 2秒后跳转到登录页
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            } else {
                showNotification(result.error || '清除数据失败', 'error');
                console.error('❌ 清除数据失败:', result.error);
            }
        } catch (error) {
            console.error('❌ 清除数据错误:', error);
            showNotification('清除数据失败: ' + error.message, 'error');
        }
    },

    // 数据备份（统一使用导出功能）
    async backupData() {
        console.log('📦 数据备份功能调用，重定向到导出功能...');
        await this.exportData();
    },

    // 还原备份（统一使用导入功能）
    async restoreBackup() {
        console.log('📥 还原备份功能调用，重定向到导入功能...');
        await this.importData();
    },

    // 显示帮助
    showHelp() {
        alert('系统使用帮助：\n\n1. 持仓管理：导入Excel文件或手动录入持仓信息\n2. 交易记录：记录买入、卖出等交易操作\n3. 交易计划：制定买卖计划，设置止盈止损\n4. AI分析：利用AI进行持仓分析和股票推荐\n5. 自选股：添加关注的股票，查看实时行情\n\n更多功能请在系统中探索！');
    },

    // 显示关于
    showAbout() {
        alert('个人股票信息系统 v0.1.0\n\n一个功能完善的个人股票投资管理系统\n\n功能特性：\n- 持仓管理\n- 交易记录\n- 交易计划\n- AI智能分析\n- 实时行情\n- 风险预警\n\n© 2024 版权所有');
    },

    // 辅助方法：设置输入框值
    setInputValue(id, value) {
        const element = document.getElementById(id);
        if (element) element.value = value || '';
    },

    // 辅助方法：设置下拉框值
    setSelectValue(id, value) {
        const element = document.getElementById(id);
        if (element) element.value = value || '';
    },

    // 辅助方法：设置复选框值
    setCheckboxValue(id, checked) {
        const element = document.getElementById(id);
        if (element) element.checked = checked || false;
    }
};

// 将 SettingsManager 暴露到全局作用域
window.SettingsManager = SettingsManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('⚙️ 设置管理器已加载');

    // 将modal移动到body根部，避免父容器限制
    const modal = document.getElementById('settingsModal');
    if (modal && modal.parentElement.tagName !== 'BODY') {
        document.body.appendChild(modal);
        console.log('✅ 设置模态框已移动到body根部');
    }

    // 应用已保存的设置
    const settings = SettingsManager.getSettings();
    console.log('📋 当前系统设置:', settings);
    console.log('📊 K线图默认周期:', settings.chartPeriod);
    SettingsManager.applySettings(settings);
});
