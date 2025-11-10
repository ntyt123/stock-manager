// ==================== 总资金管理模块 ====================

const CapitalManager = {
    // 当前总资金
    totalCapital: 0,

    // 初始化状态标记
    initialized: false,

    // 初始化
    async init() {
        console.log('💰 初始化总资金管理模块...');
        await this.loadTotalCapital();
        this.initialized = true;
    },

    // 加载总资金
    async loadTotalCapital() {
        console.log('💰 [CapitalManager] 开始加载总资金...');
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.log('❌ [CapitalManager] 未登录，无法加载总资金');
                this.totalCapital = 0;
                this.initialized = true; // 即使未登录也标记为已初始化
                return;
            }

            console.log('💰 [CapitalManager] Token存在，正在请求API...');
            const response = await fetch('/api/auth/capital', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log(`💰 [CapitalManager] API响应状态: ${response.status}`);
            if (response.ok) {
                const data = await response.json();
                this.totalCapital = data.total_capital || 0;
                console.log(`✅ [CapitalManager] 总资金加载成功: ¥${this.totalCapital.toFixed(2)}`);
                this.updateDisplay();
            } else {
                console.error('❌ [CapitalManager] 加载总资金失败，响应不正常');
                this.totalCapital = 0;
            }
        } catch (error) {
            console.error('❌ [CapitalManager] 加载总资金错误:', error);
            this.totalCapital = 0;
        }
    },

    // 更新总资金
    async updateTotalCapital(amount) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('未登录');
            }

            const response = await fetch('/api/auth/capital', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ total_capital: amount })
            });

            if (response.ok) {
                const data = await response.json();
                this.totalCapital = data.total_capital;
                this.updateDisplay();

                // 触发全局事件，通知其他模块总资金已更新
                document.dispatchEvent(new CustomEvent('capitalUpdated', {
                    detail: { totalCapital: this.totalCapital }
                }));

                console.log(`✅ 总资金更新成功: ¥${this.totalCapital.toFixed(2)}`);
                return { success: true, message: '总资金更新成功' };
            } else {
                const error = await response.json();
                throw new Error(error.error || '更新失败');
            }
        } catch (error) {
            console.error('❌ 更新总资金错误:', error);
            return { success: false, message: error.message };
        }
    },

    // 更新显示
    updateDisplay() {
        const formattedCapital = `¥${this.totalCapital.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // 更新状态栏显示
        const displayElement = document.getElementById('totalCapitalDisplay');
        if (displayElement) {
            displayElement.textContent = formattedCapital;
        }

        // 更新持仓页面中的总资金显示
        const positionCapitalEl = document.getElementById('positionTotalCapital');
        if (positionCapitalEl) {
            positionCapitalEl.textContent = formattedCapital;
        }

        // 触发持仓数据刷新（重新计算仓位占比）
        this.refreshPositionData();
    },

    // 刷新持仓相关数据
    refreshPositionData() {
        // 刷新持仓概览统计
        if (typeof loadPortfolioStats === 'function') {
            loadPortfolioStats();
        }
    },

    // 获取总资金（确保已初始化）
    getTotalCapital() {
        // 如果尚未初始化，返回0（避免NaN）
        if (!this.initialized) {
            console.warn('⚠️ CapitalManager尚未初始化，返回默认值0');
            return 0;
        }
        return this.totalCapital;
    },

    // 计算金额占总资金的百分比
    calculatePercentage(amount) {
        if (this.totalCapital === 0) {
            return 0;
        }
        return (amount / this.totalCapital * 100).toFixed(2);
    },

    // 计算百分比对应的金额
    calculateAmount(percentage) {
        return (this.totalCapital * percentage / 100).toFixed(2);
    }
};

// ==================== 全局函数（供HTML调用）====================

// 打开总资金设置模态框
function openCapitalModal() {
    const modal = document.getElementById('capitalModal');
    const input = document.getElementById('totalCapitalInput');
    const statusDiv = document.getElementById('capitalFormStatus');

    // 设置当前值
    input.value = CapitalManager.totalCapital;

    // 清空状态
    statusDiv.innerHTML = '';
    statusDiv.className = 'form-status';

    // 显示模态框 - 使用class控制并强制设置尺寸
    modal.classList.add('show');
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.minWidth = '100vw';
    modal.style.minHeight = '100vh';

    console.log('✅ 模态框已打开，classList:', modal.classList);
    console.log('✅ 尺寸:', modal.getBoundingClientRect());
}

// 关闭总资金设置模态框
function closeCapitalModal() {
    const modal = document.getElementById('capitalModal');
    modal.classList.remove('show');
}

// 保存总资金
async function saveTotalCapital() {
    const input = document.getElementById('totalCapitalInput');
    const statusDiv = document.getElementById('capitalFormStatus');
    const amount = parseFloat(input.value);

    // 验证输入
    if (isNaN(amount) || amount < 0) {
        statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> 请输入有效的金额';
        statusDiv.className = 'form-status error';
        return;
    }

    // 显示加载状态
    statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在保存...';
    statusDiv.className = 'form-status info';

    // 更新总资金
    const result = await CapitalManager.updateTotalCapital(amount);

    if (result.success) {
        statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> ' + result.message;
        statusDiv.className = 'form-status success';

        // 1秒后关闭模态框
        setTimeout(() => {
            closeCapitalModal();
        }, 1000);
    } else {
        statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + result.message;
        statusDiv.className = 'form-status error';
    }
}

// 导出到全局 window 对象
window.CapitalManager = CapitalManager;
window.openCapitalModal = openCapitalModal;
window.closeCapitalModal = closeCapitalModal;
window.saveTotalCapital = saveTotalCapital;

// 调试信息
console.log('✅ Capital Manager 模块已加载');
console.log('✅ openCapitalModal:', typeof openCapitalModal);
console.log('✅ closeCapitalModal:', typeof closeCapitalModal);
console.log('✅ saveTotalCapital:', typeof saveTotalCapital);

// 页面加载时初始化（等待登录完成）
document.addEventListener('DOMContentLoaded', async () => {
    // 将modal移动到body根部，避免父容器限制
    const modal = document.getElementById('capitalModal');
    if (modal && modal.parentElement.tagName !== 'BODY') {
        document.body.appendChild(modal);
        console.log('✅ 资金模态框已移动到body根部');
    }

    // 监听登录成功事件
    document.addEventListener('loginSuccess', async () => {
        await CapitalManager.init();
        // 触发资金加载完成事件
        document.dispatchEvent(new CustomEvent('capitalLoaded', {
            detail: { totalCapital: CapitalManager.totalCapital }
        }));
    });

    // 如果已经登录，直接初始化
    if (localStorage.getItem('token')) {
        await CapitalManager.init();
        // 触发资金加载完成事件
        document.dispatchEvent(new CustomEvent('capitalLoaded', {
            detail: { totalCapital: CapitalManager.totalCapital }
        }));
    }
});
