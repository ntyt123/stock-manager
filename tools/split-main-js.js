#!/usr/bin/env node

/**
 * main.js 自动拆分工具
 * 将 main.js (5133行) 拆分为多个模块文件
 */

const fs = require('fs');
const path = require('path');

// 定义模块拆分规则
const modules = {
    'position-manager.js': {
        functions: [
            'openExcelUploadModal', 'closeExcelUploadModal', 'clearUploadStatus',
            'initExcelUpload', 'handleExcelFile', 'showUploadStatus', 'clearUploadedData',
            'displayUploadedPositions', 'loadUserPositions', 'displayEBSCNPositions',
            'openManualPositionModal', 'closeManualPositionModal', 'submitManualPosition'
        ]
    },
    'watchlist-manager.js': {
        functions: [
            'loadWatchlist', 'addToWatchlist', 'removeFromWatchlist',
            'loadWatchlistQuotes', 'addPositionsToWatchlist', 'loadOverviewWatchlistQuotes'
        ]
    },
    'analysis-manager.js': {
        functions: [
            'loadAnalysisData', 'loadLatestPortfolioReport', 'loadLatestCallAuctionReport',
            'analyzePortfolio', 'displayPortfolioAnalysis', 'viewReportHistory',
            'viewReportDetail', 'showReportDetailInModal', 'closeReportHistoryModal',
            'closeReportDetailModal', 'deleteReport', 'analyzeCallAuction',
            'displayCallAuctionAnalysis', 'viewCallAuctionHistory', 'showCallAuctionDetailInModal',
            'closeCallAuctionHistoryModal', 'closeCallAuctionDetailModal', 'deleteCallAuctionAnalysis',
            'loadRiskWarnings', 'sendToAI', 'clearAIChat', 'generateMockAIResponse'
        ]
    },
    'market-data.js': {
        functions: [
            'loadMarketData', 'loadMarketIndices', 'loadMarketOverview', 'loadHotNews',
            'initNewsCategories', 'openNewsLink', 'loadTopGainersLosers',
            'loadChangeDistribution', 'loadPortfolioStats', 'loadSystemStats',
            'loadTradeTimeReminder', 'loadIndustryDistribution', 'updateStockData'
        ]
    },
    'stock-detail.js': {
        functions: [
            'showStockTooltip', 'closeStockTooltip', 'buildCompanyInfo',
            'fetchStockDetail', 'renderTooltipChart', 'bindTooltipPeriodButtons',
            'switchTooltipChartPeriod', 'initStockCodeHover'
        ]
    },
    'recommendation-manager.js': {
        functions: [
            'generateRecommendation', 'displayStockRecommendation', 'loadRecommendationByDate',
            'viewRecommendationHistory', 'showRecommendationDetailInModal',
            'closeRecommendationHistoryModal', 'closeRecommendationDetailModal',
            'deleteRecommendation', 'loadTodayRecommendation'
        ]
    },
    'trade-manager.js': {
        functions: [
            'openTradeRecordModal', 'closeTradeRecordModal', 'bindTradeAmountCalculation',
            'submitTradeRecord', 'viewTradeHistory', 'closeTradeHistoryModal',
            'deleteTradeOperation', 'bindStockCodeAutoFill'
        ]
    }
};

// 读取 main.js
const mainJsPath = path.join(__dirname, '../public/js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf-8');

// 提取函数代码的正则表达式
function extractFunction(content, functionName) {
    // 匹配 function 或 async function
    const pattern = new RegExp(
        `(async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)\\s*{`,
        'g'
    );

    const match = pattern.exec(content);
    if (!match) {
        console.log(`⚠️  未找到函数: ${functionName}`);
        return null;
    }

    const startIndex = match.index;
    let braceCount = 1;
    let currentIndex = startIndex + match[0].length;

    // 找到函数结束的}
    while (braceCount > 0 && currentIndex < content.length) {
        if (content[currentIndex] === '{') braceCount++;
        if (content[currentIndex] === '}') braceCount--;
        currentIndex++;
    }

    return content.substring(startIndex, currentIndex);
}

// 为每个模块生成代码
Object.keys(modules).forEach(moduleName => {
    const moduleConfig = modules[moduleName];
    let moduleContent = `// ==================== ${moduleName} ====================\n`;
    moduleContent += `// 自动生成的模块文件\n\n`;

    let functionsFound = 0;

    moduleConfig.functions.forEach(funcName => {
        const funcCode = extractFunction(mainJsContent, funcName);
        if (funcCode) {
            moduleContent += `// ${funcName}\n`;
            moduleContent += funcCode + '\n\n';
            functionsFound++;
        }
    });

    // 保存模块文件
    const modulePath = path.join(__dirname, '../public/js/modules', moduleName);
    fs.writeFileSync(modulePath, moduleContent, 'utf-8');

    console.log(`✅ ${moduleName} 创建成功 (${functionsFound}/${moduleConfig.functions.length} 个函数)`);
});

console.log('\n🎉 模块拆分完成！');
console.log('📝 下一步：更新 index.html 引入所有模块文件');
