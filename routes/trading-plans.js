// ==================== 交易计划路由 ====================
const express = require('express');
const router = express.Router();
const tradingPlanController = require('../controllers/tradingPlanController');

module.exports = (authenticateToken) => {
    // 创建交易计划
    router.post('/', authenticateToken, tradingPlanController.createPlan);

    // 获取今日计划列表
    router.get('/today', authenticateToken, tradingPlanController.getTodayPlans);

    // 获取计划列表（带筛选和分页）
    router.get('/', authenticateToken, tradingPlanController.getPlans);

    // 获取计划统计
    router.get('/statistics', authenticateToken, tradingPlanController.getStatistics);

    // 获取单个计划详情
    router.get('/:id', authenticateToken, tradingPlanController.getPlanById);

    // 更新计划
    router.put('/:id', authenticateToken, tradingPlanController.updatePlan);

    // 执行计划
    router.post('/:id/execute', authenticateToken, tradingPlanController.executePlan);

    // 取消计划
    router.post('/:id/cancel', authenticateToken, tradingPlanController.cancelPlan);

    // 删除计划
    router.delete('/:id', authenticateToken, tradingPlanController.deletePlan);

    // 批量操作
    router.post('/batch', authenticateToken, tradingPlanController.batchOperate);

    return router;
};
