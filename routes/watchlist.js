const express = require('express');
const { watchlistModel } = require('../database');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // 获取用户自选股列表
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;

            // 获取用户的自选股列表
            const watchlist = await watchlistModel.findByUserId(userId);

            res.json({
                success: true,
                data: watchlist
            });

        } catch (error) {
            console.error('获取自选股列表错误:', error);
            res.status(500).json({
                success: false,
                error: '获取自选股列表失败'
            });
        }
    });

    // 添加自选股（支持单个和批量）
    router.post('/', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;

            console.log('📥 收到自选股添加请求');
            console.log('📦 请求体:', JSON.stringify(req.body, null, 2));

            const { stockCode, stockName, stocks } = req.body;

            console.log('🔍 解析结果:');
            console.log('  - stockCode:', stockCode);
            console.log('  - stockName:', stockName);
            console.log('  - stocks:', stocks);
            console.log('  - stocks是数组?', Array.isArray(stocks));

            // 批量添加
            if (stocks && Array.isArray(stocks)) {
                console.log('📊 批量添加自选股，数量:', stocks.length);
                console.log('📝 股票列表:', JSON.stringify(stocks, null, 2));

                let successCount = 0;
                let skipCount = 0;
                let errorCount = 0;
                const results = [];

                for (const stock of stocks) {
                    try {
                        console.log('🔍 检查股票:', stock);

                        // 验证股票代码格式
                        if (!/^[0-9]{6}$/.test(stock.stockCode)) {
                            console.log(`❌ 股票代码格式错误: ${stock.stockCode} (类型: ${typeof stock.stockCode})`);
                            errorCount++;
                            results.push({
                                stockCode: stock.stockCode,
                                success: false,
                                error: `股票代码格式错误 (需要6位数字，收到: ${stock.stockCode})`
                            });
                            continue;
                        }

                        // 检查是否已存在
                        const exists = await watchlistModel.exists(userId, stock.stockCode);
                        console.log(`  检查 ${stock.stockCode} 是否存在: ${exists}`);

                        if (exists) {
                            skipCount++;
                            console.log(`  ⏭️ 跳过已存在的股票: ${stock.stockCode}`);
                            results.push({
                                stockCode: stock.stockCode,
                                success: false,
                                skipped: true,
                                error: '股票已在自选股列表中'
                            });
                            continue;
                        }

                        // 添加自选股
                        console.log(`  💾 添加自选股: ${stock.stockCode} ${stock.stockName}`);
                        await watchlistModel.add(userId, stock.stockCode, stock.stockName || '未知股票');
                        successCount++;
                        console.log(`  ✅ 成功添加: ${stock.stockCode}`);
                        results.push({
                            stockCode: stock.stockCode,
                            success: true
                        });

                    } catch (err) {
                        errorCount++;
                        results.push({
                            stockCode: stock.stockCode,
                            success: false,
                            error: err.message
                        });
                    }
                }

                const response = {
                    success: true,
                    message: `批量添加完成：成功 ${successCount} 个，跳过 ${skipCount} 个，失败 ${errorCount} 个`,
                    data: {
                        successCount,
                        skipCount,
                        errorCount,
                        total: stocks.length,
                        results
                    }
                };

                console.log('✅ 批量添加完成，返回结果:', JSON.stringify(response, null, 2));
                return res.json(response);
            }

            // 单个添加
            if (!stockCode) {
                return res.status(400).json({
                    success: false,
                    error: '股票代码是必填的'
                });
            }

            // 验证股票代码格式
            if (!/^[0-9]{6}$/.test(stockCode)) {
                return res.status(400).json({
                    success: false,
                    error: '请输入正确的6位股票代码'
                });
            }

            // 检查自选股是否已存在
            const exists = await watchlistModel.exists(userId, stockCode);
            if (exists) {
                return res.status(400).json({
                    success: false,
                    error: '该股票已在自选股列表中'
                });
            }

            // 添加自选股
            const result = await watchlistModel.add(userId, stockCode, stockName || '未知股票');

            res.json({
                success: true,
                message: '添加自选股成功',
                data: {
                    id: result.id,
                    stockCode,
                    stockName: stockName || '未知股票'
                }
            });

        } catch (error) {
            console.error('添加自选股错误:', error);
            res.status(500).json({
                success: false,
                error: '添加自选股失败'
            });
        }
    });

    // 删除自选股
    router.delete('/:stockCode', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { stockCode } = req.params;

            if (!stockCode) {
                return res.status(400).json({
                    success: false,
                    error: '股票代码是必填的'
                });
            }

            // 删除自选股
            const result = await watchlistModel.remove(userId, stockCode);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '自选股不存在'
                });
            }

            res.json({
                success: true,
                message: '删除自选股成功',
                data: {
                    deletedCount: result.changes
                }
            });

        } catch (error) {
            console.error('删除自选股错误:', error);
            res.status(500).json({
                success: false,
                error: '删除自选股失败'
            });
        }
    });

    return router;
};
