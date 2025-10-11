const express = require('express');
const stockCache = require('../stockCache');

module.exports = () => {
    const router = express.Router();

    // 获取缓存统计信息
    router.get('/stats', (req, res) => {
        const stats = stockCache.getStats();
        res.json({
            success: true,
            data: {
                ...stats,
                message: stats.isTradeTime ?
                    '当前为交易时间，缓存有效期30秒' :
                    '当前为非交易时间，缓存到下一个交易时段'
            }
        });
    });

    // 清空所有缓存（需要管理员权限）
    router.post('/clear', (req, res) => {
        stockCache.clearAll();
        res.json({
            success: true,
            message: '缓存已清空'
        });
    });

    return router;
};
