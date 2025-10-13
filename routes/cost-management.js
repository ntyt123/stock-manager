// ==================== 持仓成本管理路由 ====================
const express = require('express');
const router = express.Router();
const costManagementController = require('../controllers/costManagementController');

module.exports = (authenticateToken) => {
    // 添加成本记录（买入/卖出）
    router.post('/records', authenticateToken, costManagementController.addCostRecord);

    // 获取成本记录
    router.get('/records', authenticateToken, costManagementController.getCostRecords);

    // 获取单个股票的成本汇总
    router.get('/summary', authenticateToken, costManagementController.getCostSummary);

    // 获取所有持仓的成本汇总列表
    router.get('/summaries', authenticateToken, costManagementController.getAllPositionsCostSummary);

    // 删除成本记录
    router.delete('/records/:recordId', authenticateToken, costManagementController.deleteCostRecord);

    // 添加成本调整记录（分红、送股、配股）
    router.post('/adjustments', authenticateToken, costManagementController.addCostAdjustment);

    // 获取成本调整记录
    router.get('/adjustments', authenticateToken, costManagementController.getCostAdjustments);

    // 删除成本调整记录
    router.delete('/adjustments/:adjustmentId', authenticateToken, costManagementController.deleteCostAdjustment);

    return router;
};
