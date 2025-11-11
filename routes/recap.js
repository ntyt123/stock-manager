/**
 * 每日复盘路由
 */

const express = require('express');
const recapController = require('../controllers/recapController');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 生成复盘数据
    router.post('/generate', authenticateToken, recapController.generateRecapData);

    // 调用AI分析
    router.post('/analyze', authenticateToken, recapController.analyzeWithAI);

    // 获取复盘状态
    router.get('/status', authenticateToken, recapController.getRecapStatus);

    // 保存用户笔记
    router.post('/notes', authenticateToken, recapController.saveNotes);

    // 标记已完成
    router.post('/complete', authenticateToken, recapController.markAsCompleted);

    // 获取历史复盘
    router.get('/history', authenticateToken, recapController.getHistory);

    // 保存分析结果
    router.post('/save-analysis', authenticateToken, recapController.saveAnalysisResult);

    // 标记今日无操作
    router.post('/no-trading', authenticateToken, recapController.markNoTrading);

    return router;
};
