// 数据库连接和初始化
const { db, closeDatabase } = require('./connection');
const { initDatabase } = require('./init');

// 导出数据库连接获取函数
function getDatabase() {
    return db;
}

// 导入所有模型
const { userModel } = require('./models/user');
const { positionModel, positionUpdateModel } = require('./models/position');
const { watchlistModel } = require('./models/watchlist');
const { analysisReportModel, callAuctionAnalysisModel, stockRecommendationModel } = require('./models/analysis');
const { manualPositionModel, tradeOperationModel } = require('./models/trade');
const { tradingPlanModel, planExecutionModel } = require('./models/trading-plan');
const { positionCostRecordModel, positionCostAdjustmentModel } = require('./models/cost');
const { fundAccountModel, fundTransactionModel } = require('./models/fund');
const { tradingLogModel } = require('./models/trading-log');
const { stockPoolModel, stockPoolItemModel } = require('./models/stock-pool');
const { aiPromptTemplateModel } = require('./models/ai-prompt');
const { portfolioOptimizationModel } = require('./models/portfolio-optimization');
const { riskControlRuleModel, riskWarningModel, riskEventModel } = require('./models/risk-control');
const { fundamentalAnalysisModel } = require('./models/fundamental');
const aiApiConfigModel = require('./models/ai-api-config');

// 导出所有模型和工具函数
module.exports = {
    db,
    getDatabase,
    initDatabase,
    closeDatabase,
    userModel,
    positionModel,
    positionUpdateModel,
    watchlistModel,
    analysisReportModel,
    callAuctionAnalysisModel,
    stockRecommendationModel,
    manualPositionModel,
    tradeOperationModel,
    tradingPlanModel,
    planExecutionModel,
    positionCostRecordModel,
    positionCostAdjustmentModel,
    fundAccountModel,
    fundTransactionModel,
    tradingLogModel,
    stockPoolModel,
    stockPoolItemModel,
    aiPromptTemplateModel,
    portfolioOptimizationModel,
    riskControlRuleModel,
    riskWarningModel,
    riskEventModel,
    fundamentalAnalysisModel,
    aiApiConfigModel
};
