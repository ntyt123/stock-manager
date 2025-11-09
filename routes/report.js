/**
 * 持仓报表路由
 */

const express = require('express');
const reportController = require('../controllers/reportController');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 获取持仓报表
    router.get('/position', authenticateToken, reportController.getPositionReport);

    // 获取交易报表
    router.get('/trade', authenticateToken, reportController.getTradeReport);

    // 获取盈亏报表
    router.get('/profit-loss', authenticateToken, reportController.getProfitLossReport);

    // 获取月度报表
    router.get('/monthly', authenticateToken, reportController.getMonthlyReport);

    // 获取年度报表
    router.get('/yearly', authenticateToken, reportController.getYearlyReport);

    return router;
};
