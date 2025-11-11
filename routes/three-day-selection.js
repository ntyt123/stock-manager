// ==================== 三日选股法路由 ====================
const express = require('express');
const router = express.Router();
const threeDaySelectionController = require('../controllers/threeDaySelectionController');

module.exports = (authenticateToken) => {
    // ==================== 股票列表 ====================

    // 获取所有股票列表
    router.get('/all-stocks', authenticateToken, threeDaySelectionController.getAllStocks);

    // ==================== 配置管理 ====================

    // 获取所有配置
    router.get('/configs', authenticateToken, threeDaySelectionController.getConfigs);

    // 获取单个配置
    router.get('/configs/:id', authenticateToken, threeDaySelectionController.getConfig);

    // 创建配置
    router.post('/configs', authenticateToken, threeDaySelectionController.createConfig);

    // 更新配置
    router.put('/configs/:id', authenticateToken, threeDaySelectionController.updateConfig);

    // 删除配置
    router.delete('/configs/:id', authenticateToken, threeDaySelectionController.deleteConfig);

    // ==================== 选股扫描 ====================

    // 执行扫描
    router.post('/scan', authenticateToken, threeDaySelectionController.runScan);

    // ==================== 结果管理 ====================

    // 获取选股结果列表
    router.get('/results', authenticateToken, threeDaySelectionController.getResults);

    // 更新选股结果
    router.put('/results/:id', authenticateToken, threeDaySelectionController.updateResult);

    // 删除选股结果
    router.delete('/results/:id', authenticateToken, threeDaySelectionController.deleteResult);

    // ==================== 统计数据 ====================

    // 获取统计数据
    router.get('/stats', authenticateToken, threeDaySelectionController.getStats);

    return router;
};
