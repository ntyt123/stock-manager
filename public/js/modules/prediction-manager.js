// ==================== prediction-manager.js ====================
// AI预测功能模块（重构版本）
// ================================================================

// 全局变量，保存排盘结果
let currentPaipanResult = null;

/**
 * 初始化预测模块
 */
function initPredictionModule() {
    console.log('🔮 预测模块已初始化');

    // 配置marked选项（v9版本）
    initMarkedLibrary();

    // 检查用户登录状态
    if (!window.PredictionUtils || !window.PredictionUtils.checkUserLogin()) {
        console.log('用户未登录，预测功能需要登录');
    }

    // 初始化日期时间输入框
    if (window.PredictionUtils) {
        window.PredictionUtils.initDateTimeInput('predictionDateTime');
    }
}

/**
 * 初始化Marked库
 */
function initMarkedLibrary() {
    console.log('🔍 检查marked库...', typeof marked);
    if (typeof marked !== 'undefined') {
        console.log('marked对象:', marked);
        console.log('marked.parse:', typeof marked.parse);
        console.log('marked.use:', typeof marked.use);

        try {
            // 测试marked是否能工作
            const testMarkdown = '# 测试\n\n这是**粗体**文本。';
            const testHtml = marked.parse(testMarkdown);
            console.log('✅ Marked测试成功:', testHtml);

            marked.use({
                breaks: true,        // 支持换行
                gfm: true,          // 使用GitHub风格的Markdown
                headerIds: true,    // 为标题添加ID
                mangle: false       // 不混淆邮箱地址
            });
            console.log('✅ Marked配置完成');
        } catch (e) {
            console.error('❌ Marked配置失败:', e);
        }
    } else {
        console.error('❌ Marked库未加载！');
    }
}

/**
 * 价格预测功能
 */
async function predictPrice() {
    if (!window.PredictionUtils) {
        console.error('预测工具模块未加载');
        return;
    }

    if (!window.PredictionUtils.checkUserLogin()) {
        window.PredictionUtils.showLoginPrompt('价格预测');
        return;
    }

    console.log('💰 价格预测功能开发中...');
    showNotification('价格预测功能正在开发中，敬请期待！', 'info');
}

/**
 * 趋势预测功能
 */
async function predictTrend() {
    if (!window.PredictionUtils) {
        console.error('预测工具模块未加载');
        return;
    }

    if (!window.PredictionUtils.checkUserLogin()) {
        window.PredictionUtils.showLoginPrompt('趋势预测');
        return;
    }

    console.log('📊 趋势预测功能开发中...');
    showNotification('趋势预测功能正在开发中，敬请期待！', 'info');
}

// ==================== 股票趋势预测功能 ====================

/**
 * 设置股票代码输入监听器
 */
document.addEventListener('DOMContentLoaded', function() {
    if (window.PredictionUtils) {
        // 设置趋势预测的股票代码输入监听
        window.PredictionUtils.setupStockCodeInputListener(
            'trendStockCode',
            'trendStockName',
            'stockNameStatus'
        );

        // 设置六壬趋势预测的股票代码输入监听
        window.PredictionUtils.setupStockCodeInputListener(
            'liurenTrendStockCode',
            'liurenTrendStockName',
            'liurenStockNameStatus'
        );

        // 设置六壬风险预测的股票代码输入监听
        window.PredictionUtils.setupStockCodeInputListener(
            'liurenRiskStockCode',
            'liurenRiskStockName',
            'liurenRiskStockNameStatus'
        );

        // 设置六壬情绪预测的股票代码输入监听
        window.PredictionUtils.setupStockCodeInputListener(
            'liurenSentimentStockCode',
            'liurenSentimentStockName',
            'liurenSentimentStockNameStatus'
        );

        // 初始化所有日期时间输入框
        initAllDateTimeInputs();
    }
});

/**
 * 初始化所有日期时间输入框
 */
function initAllDateTimeInputs() {
    const dateTimeInputs = [
        'liurenTrendDateTime',
        'liurenRiskDateTime',
        'liurenSentimentDateTime'
    ];

    dateTimeInputs.forEach(inputId => {
        window.PredictionUtils.initDateTimeInput(inputId);
    });
}

/**
 * 开始趋势分析（分析页签使用）
 */
async function startTrendAnalysis() {
    if (!window.PredictionUtils) {
        console.error('预测工具模块未加载');
        return;
    }

    if (!window.PredictionUtils.checkUserLogin()) {
        window.PredictionUtils.showLoginPrompt('趋势分析');
        return;
    }

    const stockCode = document.getElementById('trendStockCode')?.value.trim();
    const stockName = document.getElementById('trendStockName')?.value.trim();
    const resultDiv = document.getElementById('trendAnalysisResult');
    const contentDiv = document.getElementById('trendAnalysisContent');
    const titleElement = document.getElementById('trendAnalysisTitle');
    const dateBadge = document.getElementById('trendAnalysisBadge');
    const timeElement = document.getElementById('trendAnalysisTime');

    if (!stockCode || !stockName) {
        alert('请输入股票代码并等待自动获取股票名称');
        return;
    }

    try {
        console.log(`🔍 开始趋势分析: ${stockCode} ${stockName}`);

        // 显示加载状态
        window.PredictionUtils.showLoadingState('trendAnalysisContent', 'AI正在分析股票趋势...');
        resultDiv.style.display = 'block';

        // 调用后端API
        const response = await fetch('/api/prediction/trend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                stockCode,
                stockName
            })
        });

        const result = await window.PredictionUtils.handleApiResponse(response);

        if (result.success && result.data) {
            console.log('📈 趋势分析结果:', result.data);

            // 更新标题和日期标签
            titleElement.textContent = `${stockName} (${stockCode}) 趋势分析`;
            dateBadge.textContent = result.data.isToday ? '当前交易日' : '下一交易日';
            dateBadge.style.background = result.data.isToday ?
                'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)' :
                'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)';

            // 显示分析结果 - 使用通用工具函数
            const timeText = `分析时间：${new Date().toLocaleString('zh-CN')} | 预测日期：${result.data.predictionDate}`;
            const success = window.PredictionUtils.renderMarkdownContent(
                result.data.prediction,
                'trendAnalysisContent',
                'trendAnalysisTime',
                timeText
            );

            console.log('✅ 趋势分析完成并渲染');
            showNotification('趋势分析完成！', 'success');

            if (!success) {
                showNotification('分析完成（纯文本模式）', 'warning');
            }
        }

    } catch (error) {
        console.error('❌ 趋势分析错误:', error);
        window.PredictionUtils.showErrorState('trendAnalysisContent', `分析失败：${error.message}`);
        showNotification('趋势分析失败: ' + error.message, 'error');
    }
}

// ==================== 六壬股票趋势预测功能 ====================

// 保存六壬排盘结果（用于股票趋势预测）
let currentLiuRenTrendPaipanResult = null;
let currentLiuRenTrendStock = null;

/**
 * 执行六壬股票趋势排盘
 */
function performLiuRenTrendPaipan() {
    const stockCode = document.getElementById('liurenTrendStockCode')?.value.trim();
    const stockName = document.getElementById('liurenTrendStockName')?.value.trim();
    const dateTimeInput = document.getElementById('liurenTrendDateTime');
    const paipanResult = document.getElementById('liurenTrendPaipanResult');
    const paipanContent = document.getElementById('liurenTrendPaipanContent');
    const predictionResult = document.getElementById('liurenTrendPredictionResult');

    if (!stockCode || !stockName) {
        alert('请输入股票代码并等待自动获取股票名称');
        return;
    }

    if (!dateTimeInput || !dateTimeInput.value) {
        alert('请选择预测日期时间');
        return;
    }

    try {
        // 解析日期时间
        const selectedDate = new Date(dateTimeInput.value);

        console.log(`🎲 开始六壬排盘 - ${stockCode} ${stockName}...`, selectedDate);

        // 调用六壬排盘计算器
        if (typeof LiuRenCalculator === 'undefined') {
            throw new Error('六壬排盘工具未加载');
        }

        currentLiuRenTrendPaipanResult = LiuRenCalculator.paipan(selectedDate);
        currentLiuRenTrendStock = { stockCode, stockName };

        // 生成排盘描述（HTML格式）
        const description = LiuRenCalculator.formatPaipanDescription(currentLiuRenTrendPaipanResult);

        // 显示排盘结果
        paipanContent.innerHTML = description;
        paipanResult.style.display = 'block';

        // 隐藏之前的预测结果
        if (predictionResult) {
            predictionResult.style.display = 'none';
        }

        console.log('✅ 六壬排盘完成', currentLiuRenTrendPaipanResult);
        showNotification('排盘完成！可以开始预测了', 'success');

    } catch (error) {
        console.error('❌ 排盘错误:', error);
        alert('排盘失败: ' + error.message);
    }
}

/**
 * 开始六壬股票趋势预测
 */
async function startLiuRenTrendPrediction() {
    if (!window.PredictionUtils) {
        console.error('预测工具模块未加载');
        return;
    }

    if (!window.PredictionUtils.checkUserLogin()) {
        window.PredictionUtils.showLoginPrompt('六壬股票趋势预测');
        return;
    }

    if (!currentLiuRenTrendPaipanResult || !currentLiuRenTrendStock) {
        alert('请先进行排盘');
        return;
    }

    const predictionResult = document.getElementById('liurenTrendPredictionResult');
    const predictionContent = document.getElementById('liurenTrendPredictionContent');
    const titleElement = document.getElementById('liurenTrendResultTitle');
    const predictionTime = document.getElementById('liurenTrendPredictionTime');

    try {
        console.log('🔮 开始六壬股票趋势预测...', currentLiuRenTrendStock);

        // 显示加载状态
        window.PredictionUtils.showLoadingState('liurenTrendPredictionContent', 'AI正在基于六壬排盘分析股票趋势...');
        predictionResult.style.display = 'block';

        // 调用后端API
        const response = await fetch('/api/prediction/stock-trend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                stockCode: currentLiuRenTrendStock.stockCode,
                stockName: currentLiuRenTrendStock.stockName,
                paipanResult: currentLiuRenTrendPaipanResult
            })
        });

        const result = await window.PredictionUtils.handleApiResponse(response);

        if (result.success && result.data) {
            // 更新标题
            titleElement.textContent = `${currentLiuRenTrendStock.stockName} (${currentLiuRenTrendStock.stockCode}) 趋势预测`;

            // 显示预测结果 - 使用通用工具函数
            const timeText = `预测时间：${new Date().toLocaleString('zh-CN')}`;
            const success = window.PredictionUtils.renderMarkdownContent(
                result.data.prediction,
                'liurenTrendPredictionContent',
                'liurenTrendPredictionTime',
                timeText
            );

            console.log('✅ 六壬股票趋势预测完成并渲染');
            showNotification('预测完成！', 'success');

            if (!success) {
                showNotification('预测完成（纯文本模式）', 'warning');
            }
        }

    } catch (error) {
        console.error('❌ 六壬趋势预测错误:', error);
        window.PredictionUtils.showErrorState('liurenTrendPredictionContent', `预测失败：${error.message}`);
        showNotification('趋势预测失败: ' + error.message, 'error');
    }
}

/**
 * 波动预测功能
 */
async function predictVolatility() {
    if (!window.PredictionUtils) {
        console.error('预测工具模块未加载');
        return;
    }

    if (!window.PredictionUtils.checkUserLogin()) {
        window.PredictionUtils.showLoginPrompt('波动预测');
        return;
    }

    console.log('📉 波动预测功能开发中...');
    showNotification('波动预测功能正在开发中，敬请期待！', 'info');
}

/**
 * 业绩预测功能
 */
async function predictEarnings() {
    if (!window.PredictionUtils) {
        console.error('预测工具模块未加载');
        return;
    }

    if (!window.PredictionUtils.checkUserLogin()) {
        window.PredictionUtils.showLoginPrompt('业绩预测');
        return;
    }

    console.log('💵 业绩预测功能开发中...');
    showNotification('业绩预测功能正在开发中，敬请期待！', 'info');
}

/**
 * 情绪预测功能
 */
async function predictSentiment() {
    if (!window.PredictionUtils) {
        console.error('预测工具模块未加载');
        return;
    }

    if (!window.PredictionUtils.checkUserLogin()) {
        window.PredictionUtils.showLoginPrompt('情绪预测');
        return;
    }

    console.log('😊 情绪预测功能开发中...');
    showNotification('情绪预测功能正在开发中，敬请期待！', 'info');
}

/**
 * 风险预测功能
 */
async function predictRisk() {
    if (!window.PredictionUtils) {
        console.error('预测工具模块未加载');
        return;
    }

    if (!window.PredictionUtils.checkUserLogin()) {
        window.PredictionUtils.showLoginPrompt('风险预测');
        return;
    }

    console.log('⚠️ 风险预测功能开发中...');
    showNotification('风险预测功能正在开发中，敬请期待！', 'info');
}

/**
 * 加载预测历史数据
 */
async function loadPredictionHistory() {
    if (!window.PredictionUtils || !window.PredictionUtils.checkUserLogin()) {
        console.log('用户未登录，跳过加载预测历史');
        return;
    }

    console.log('📋 加载预测历史数据功能开发中...');
}

/**
 * 显示预测结果
 * @param {string} type - 预测类型
 * @param {Object} data - 预测数据
 */
function displayPredictionResult(type, data) {
    console.log(`📊 显示${type}预测结果:`, data);
    // 后续实现具体的显示逻辑
}

/**
 * 清空预测结果
 */
function clearPredictionResults() {
    console.log('🗑️ 清空预测结果');
    showNotification('预测结果已清空', 'success');
}

// ==================== 六壬排盘和大盘预测 ====================

/**
 * 执行六壬排盘
 */
function performLiuRenPaipan() {
    const dateTimeInput = document.getElementById('predictionDateTime');
    const paipanResult = document.getElementById('paipanResult');
    const paipanContent = document.getElementById('paipanContent');
    const predictionResult = document.getElementById('predictionResult');

    if (!dateTimeInput || !dateTimeInput.value) {
        alert('请选择预测日期时间');
        return;
    }

    try {
        // 解析日期时间
        const selectedDate = new Date(dateTimeInput.value);

        console.log('🎲 开始六壬排盘...', selectedDate);

        // 调用六壬排盘计算器
        if (typeof LiuRenCalculator === 'undefined') {
            throw new Error('六壬排盘工具未加载');
        }

        currentPaipanResult = LiuRenCalculator.paipan(selectedDate);

        // 生成排盘描述（HTML格式）
        const description = LiuRenCalculator.formatPaipanDescription(currentPaipanResult);

        // 显示排盘结果（使用innerHTML来渲染HTML）
        paipanContent.innerHTML = description;
        paipanResult.style.display = 'block';

        // 隐藏之前的预测结果
        if (predictionResult) {
            predictionResult.style.display = 'none';
        }

        console.log('✅ 排盘完成', currentPaipanResult);
        showNotification('排盘完成！', 'success');

    } catch (error) {
        console.error('❌ 排盘错误:', error);
        alert('排盘失败: ' + error.message);
    }
}

/**
 * 开始大盘预测
 */
async function startMarketPrediction() {
    if (!window.PredictionUtils) {
        console.error('预测工具模块未加载');
        return;
    }

    if (!window.PredictionUtils.checkUserLogin()) {
        window.PredictionUtils.showLoginPrompt('大盘预测');
        return;
    }

    if (!currentPaipanResult) {
        alert('请先进行排盘');
        return;
    }

    const predictionResult = document.getElementById('predictionResult');
    const predictionContent = document.getElementById('predictionContent');
    const predictionTime = document.getElementById('predictionTime');

    try {
        console.log('🔮 开始AI大盘预测...', currentPaipanResult);

        // 显示加载状态
        window.PredictionUtils.showLoadingState('predictionContent', 'AI正在分析排盘信息...');
        predictionResult.style.display = 'block';

        // 调用后端API
        const response = await fetch('/api/prediction/market', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                paipanResult: currentPaipanResult
            })
        });

        const result = await window.PredictionUtils.handleApiResponse(response);

        if (result.success && result.data) {
            // 显示预测结果 - 使用通用工具函数
            const timeText = `预测时间：${new Date().toLocaleString('zh-CN')}`;
            const success = window.PredictionUtils.renderMarkdownContent(
                result.data.prediction,
                'predictionContent',
                'predictionTime',
                timeText
            );

            console.log('✅ AI预测完成并渲染');
            showNotification('预测完成！', 'success');

            if (!success) {
                showNotification('预测完成（纯文本模式）', 'warning');
            }
        }

    } catch (error) {
        console.error('❌ 预测错误:', error);
        window.PredictionUtils.showErrorState('predictionContent', `预测失败：${error.message}`);
        showNotification('预测失败: ' + error.message, 'error');
    }
}

// 由于重构后其���功能模块较大，这里先实现核心功能。
// 其他六壬预测功能可以类似地重构，使用通用工具函数

// 页面加载时初始化预测模块
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPredictionModule);
} else {
    initPredictionModule();
}

// ==================== 导出全局函数 ====================
// 将函数导出到全局作用域，供HTML onclick使用
window.performLiuRenPaipan = performLiuRenPaipan;
window.startMarketPrediction = startMarketPrediction;
window.predictTrend = predictTrend;
window.predictVolatility = predictVolatility;
window.predictRisk = predictRisk;
window.predictSentiment = predictSentiment;
window.startTrendAnalysis = startTrendAnalysis;
window.performLiuRenTrendPaipan = performLiuRenTrendPaipan;
window.startLiuRenTrendPrediction = startLiuRenTrendPrediction;