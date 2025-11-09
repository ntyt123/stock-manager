// ==================== prediction-utils.js ====================
// 预测模块通用工具函数
// ================================================================

/**
 * 通用的股票名称获取函数
 * @param {string} stockCode - 股票代码
 * @param {string} nameInputId - 股票名称输入框ID
 * @param {string} statusId - 状态显示元素ID
 */
async function fetchStockName(stockCode, nameInputId, statusId) {
    const stockNameInput = document.getElementById(nameInputId);
    const statusElement = document.getElementById(statusId);

    if (!stockNameInput || !statusElement) return;

    try {
        statusElement.textContent = '正在获取...';
        statusElement.style.color = '#1976d2';

        const response = await fetch(`/api/stock/quote/${stockCode}`);
        const result = await response.json();

        if (result.success && result.data) {
            stockNameInput.value = result.data.stockName;
            statusElement.textContent = '✓ 获取成功';
            statusElement.style.color = '#4caf50';

            console.log(`✅ 获取股票名称成功: ${stockCode} - ${result.data.stockName}`);
        } else {
            stockNameInput.value = '';
            statusElement.textContent = '✗ 未找到该股票';
            statusElement.style.color = '#f44336';
        }
    } catch (error) {
        console.error('❌ 获取股票名称失败:', error);
        stockNameInput.value = '';
        statusElement.textContent = '✗ 获取失败';
        statusElement.style.color = '#f44336';
    }
}

/**
 * 通用的Markdown内容渲染函数
 * @param {string} content - Markdown内容
 * @param {string} containerId - 容器元素ID
 * @param {string} timeId - 时间显示元素ID（可选）
 * @param {string} timeText - 时间文本（可选）
 * @returns {boolean} - 是否成功渲染
 */
async function renderMarkdownContent(content, containerId, timeId = null, timeText = null) {
    const container = document.getElementById(containerId);
    if (!container) return false;

    try {
        // 检查marked是否可用
        if (typeof marked === 'undefined' || typeof marked.parse !== 'function') {
            throw new Error('Marked库未正确加载');
        }

        const htmlContent = marked.parse(content);
        container.innerHTML = htmlContent;

        // 设置时间文本（如果提供）
        if (timeId && timeText) {
            const timeElement = document.getElementById(timeId);
            if (timeElement) {
                timeElement.textContent = timeText;
            }
        }

        console.log(`✅ Markdown渲染成功: ${containerId}`);
        return true;

    } catch (parseError) {
        console.error('❌ Markdown解析错误:', parseError);

        // 如果解析失败，使用纯文本显示
        const textWithBreaks = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
        container.innerHTML = textWithBreaks;

        // 设置时间文本（如果提供）
        if (timeId && timeText) {
            const timeElement = document.getElementById(timeId);
            if (timeElement) {
                timeElement.textContent = timeText;
            }
        }

        console.log(`⚠️ 使用纯文本模式显示: ${containerId}`);
        return false;
    }
}

/**
 * 通用的日期时间输入框初始化函数
 * @param {string} inputId - 输入框ID
 */
function initDateTimeInput(inputId) {
    const dateTimeInput = document.getElementById(inputId);
    if (!dateTimeInput) return;

    // 设置默认值为当前时间
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    dateTimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * 通用的股票代码输入监听器设置函数
 * @param {string} codeInputId - 股票代码输入框ID
 * @param {string} nameInputId - 股票名称输入框ID
 * @param {string} statusId - 状态显示元素ID
 * @param {number} debounceDelay - 防抖延迟时间（毫秒，默认500）
 */
function setupStockCodeInputListener(codeInputId, nameInputId, statusId, debounceDelay = 500) {
    const stockCodeInput = document.getElementById(codeInputId);
    if (!stockCodeInput) return;

    let debounceTimer;

    stockCodeInput.addEventListener('input', function(e) {
        const stockCode = e.target.value.trim();

        // 清除之前的定时器
        clearTimeout(debounceTimer);

        if (stockCode.length >= 6) {
            // 延迟执行，避免频繁请求
            debounceTimer = setTimeout(() => {
                fetchStockName(stockCode, nameInputId, statusId);
            }, debounceDelay);
        } else {
            // 清空股票名称
            const stockNameInput = document.getElementById(nameInputId);
            const statusElement = document.getElementById(statusId);
            if (stockNameInput) stockNameInput.value = '';
            if (statusElement) statusElement.textContent = '';
        }
    });
}

/**
 * 通用的API请求错误处理函数
 * @param {Response} response - Fetch响应对象
 * @throws {Error} - 包含错误信息的Error对象
 */
async function handleApiResponse(response) {
    if (!response.ok) {
        const errorText = await response.text();
        console.error('API响应错误:', response.status, errorText);
        throw new Error(`服务器返回错误: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || '请求失败');
    }

    return result;
}

/**
 * 通用的加载状态显示函数
 * @param {string} containerId - 容器元素ID
 * @param {string} loadingText - 加载提示文本
 */
function showLoadingState(containerId, loadingText) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #78909c;">
            <div class="loading-spinner"></div>
            <div style="margin-top: 15px;">${loadingText}</div>
        </div>
    `;
}

/**
 * 通用的错误状态显示函数
 * @param {string} containerId - 容器元素ID
 * @param {string} errorText - 错误提示文本
 */
function showErrorState(containerId, errorText) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #f44336;">
            ${errorText}
        </div>
    `;
}

/**
 * 检查用户登录状态
 * @returns {boolean} - 是否已登录
 */
function checkUserLogin() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('用户未登录');
        return false;
    }
    return true;
}

/**
 * 显示登录提示
 * @param {string} featureName - 功能名称
 */
function showLoginPrompt(featureName) {
    alert(`请先登录后再使用${featureName}功能`);
}

// 导出所有工具函数
window.PredictionUtils = {
    fetchStockName,
    renderMarkdownContent,
    initDateTimeInput,
    setupStockCodeInputListener,
    handleApiResponse,
    showLoadingState,
    showErrorState,
    checkUserLogin,
    showLoginPrompt
};