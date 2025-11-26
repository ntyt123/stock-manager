/**
 * 买入点验证路由
 */

const express = require('express');
const buyPointValidationController = require('../controllers/buyPointValidationController');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 验证单个股票的买入点
    router.post('/validate', authenticateToken, buyPointValidationController.validateBuyPoint);

    // 批量验证多个股票
    router.post('/batch-validate', authenticateToken, buyPointValidationController.batchValidate);

    // 获取历史验证记录
    router.get('/history', authenticateToken, buyPointValidationController.getValidationHistory);

    // 获取验证配置
    router.get('/config', authenticateToken, buyPointValidationController.getValidationConfig);

    // 更新用户笔记
    router.post('/notes', authenticateToken, buyPointValidationController.updateUserNotes);

    // 标记是否跟随操作
    router.post('/follow', authenticateToken, buyPointValidationController.markAsFollowed);

    return router;
};
