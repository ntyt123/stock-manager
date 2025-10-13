const express = require('express');
const profitAnalysisController = require('../controllers/profitAnalysisController');

/**
 * 盈亏分析路由
 * 提供各种盈亏分析API端点
 */
module.exports = (authenticateToken) => {
    const router = express.Router();

    /**
     * GET /api/profit-analysis/overall
     * 获取总体盈亏统计
     * 返回：已实现盈亏、未实现盈亏、总盈亏、收益率等
     */
    router.get('/overall', authenticateToken, profitAnalysisController.getOverallProfitStats);

    /**
     * GET /api/profit-analysis/stocks
     * 获取按股票的盈亏明细
     * 返回：每只股票的已实现盈亏、未实现盈亏、总盈亏
     */
    router.get('/stocks', authenticateToken, profitAnalysisController.getStockProfitDetails);

    /**
     * GET /api/profit-analysis/trend
     * 获取盈亏趋势数据
     * 查询参数：
     *   - startDate: 开始日期（可选）
     *   - endDate: 结束日期（可选）
     *   - period: 统计周期 day/week/month（可选，默认day）
     */
    router.get('/trend', authenticateToken, profitAnalysisController.getProfitTrend);

    /**
     * GET /api/profit-analysis/ranking
     * 获取盈亏排名（最赚钱和最亏钱的股票）
     * 查询参数：
     *   - limit: 返回数量（可选，默认10）
     */
    router.get('/ranking', authenticateToken, profitAnalysisController.getProfitRanking);

    /**
     * GET /api/profit-analysis/distribution
     * 获取盈亏分布统计
     * 返回：按盈亏范围分组的股票数量
     */
    router.get('/distribution', authenticateToken, profitAnalysisController.getProfitDistribution);

    return router;
};
