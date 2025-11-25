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

    // V2版本新增接口
    // 保存市场环境数据
    router.post('/save-market-env', authenticateToken, recapController.saveMarketEnvironment);

    // 保存交易反思数据
    router.post('/save-trade-reflections', authenticateToken, recapController.saveTradeReflections);

    // 保存持仓备注数据
    router.post('/save-position-notes', authenticateToken, recapController.savePositionNotes);

    // 保存复盘反思数据
    router.post('/save-reflection', authenticateToken, recapController.saveReflectionData);

    // 保存明日计划数据
    router.post('/save-tomorrow-plans', authenticateToken, recapController.saveTomorrowPlans);

    // 获取本周统计数据
    router.get('/week-stats', authenticateToken, recapController.getWeekStats);

    // 获取本月统计数据
    router.get('/month-stats', authenticateToken, recapController.getMonthStats);

    // 更新复盘完成状态
    router.post('/update-status', authenticateToken, recapController.updateCompletionStatus);

    return router;
};
