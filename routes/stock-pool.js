const express = require('express');
const axios = require('axios');
const { stockPoolModel, stockPoolItemModel, watchlistModel } = require('../database');

// 获取股票市场前缀（sh/sz）
function getMarketPrefix(stockCode) {
    if (!stockCode || stockCode.length !== 6) {
        return '';
    }

    // 6开头是上交所
    if (stockCode.startsWith('6')) {
        return 'sh';
    }
    // 0/3开头是深交所
    if (stockCode.startsWith('0') || stockCode.startsWith('3')) {
        return 'sz';
    }

    return 'sh'; // 默认上交所
}

// 获取股票实时价格的辅助函数
async function getStockPrice(stockCode) {
    try {
        // 添加市场前缀
        const marketCode = getMarketPrefix(stockCode) + stockCode;

        const response = await axios.get(`http://qt.gtimg.cn/q=${marketCode}`, {
            timeout: 3000
        });

        const data = response.data;
        const match = data.match(/="([^"]+)"/);

        if (match && match[1]) {
            const info = match[1].split('~');
            // info[3] 是当前价，info[4] 是昨收价
            let price = parseFloat(info[3]) || 0;

            // 如果当前价为0（非交易时间），使用昨日收盘价
            if (price === 0) {
                price = parseFloat(info[4]) || 0;
                console.log(`📊 股票 ${stockCode} 非交易时间，使用昨收价: ${price}`);
            }

            return price;
        }

        return 0;
    } catch (error) {
        console.warn(`获取股票 ${stockCode} 价格失败:`, error.message);
        return 0;
    }
}

module.exports = (authenticateToken) => {
    const router = express.Router();

    // ==================== 股票池管理 ====================

    // 获取用户的所有股票池
    router.get('/pools', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const pools = await stockPoolModel.findByUserId(userId);

            res.json({
                success: true,
                data: pools
            });

        } catch (error) {
            console.error('获取股票池列表错误:', error);
            res.status(500).json({
                success: false,
                error: '获取股票池列表失败'
            });
        }
    });

    // 根据ID获取股票池详情
    router.get('/pools/:poolId', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { poolId } = req.params;

            const pool = await stockPoolModel.findById(poolId, userId);
            if (!pool) {
                return res.status(404).json({
                    success: false,
                    error: '股票池不存在'
                });
            }

            // 获取股票池中的股票
            const stocks = await stockPoolItemModel.findByPoolId(poolId);

            res.json({
                success: true,
                data: {
                    pool,
                    stocks
                }
            });

        } catch (error) {
            console.error('获取股票池详情错误:', error);
            res.status(500).json({
                success: false,
                error: '获取股票池详情失败'
            });
        }
    });

    // 创建股票池
    router.post('/pools', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { name, description, pool_type, tags, filter_conditions } = req.body;

            // 验证必填字段
            if (!name || name.trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: '股票池名称不能为空'
                });
            }

            // 检查股票池名称是否已存在
            const exists = await stockPoolModel.existsByName(userId, name);
            if (exists) {
                return res.status(400).json({
                    success: false,
                    error: '股票池名称已存在'
                });
            }

            // 创建股票池
            const result = await stockPoolModel.create(userId, {
                name,
                description,
                pool_type,
                tags,
                filter_conditions
            });

            res.json({
                success: true,
                message: '创建股票池成功',
                data: {
                    id: result.id,
                    name
                }
            });

        } catch (error) {
            console.error('创建股票池错误:', error);
            res.status(500).json({
                success: false,
                error: '创建股票池失败'
            });
        }
    });

    // 更新股票池
    router.put('/pools/:poolId', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { poolId } = req.params;
            const { name, description, pool_type, tags, filter_conditions } = req.body;

            // 验证必填字段
            if (!name || name.trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: '股票池名称不能为空'
                });
            }

            // 检查股票池是否存在
            const pool = await stockPoolModel.findById(poolId, userId);
            if (!pool) {
                return res.status(404).json({
                    success: false,
                    error: '股票池不存在'
                });
            }

            // 检查股票池名称是否与其他股票池重复
            const exists = await stockPoolModel.existsByName(userId, name, poolId);
            if (exists) {
                return res.status(400).json({
                    success: false,
                    error: '股票池名称已被其他股票池使用'
                });
            }

            // 更新股票池
            const result = await stockPoolModel.update(poolId, userId, {
                name,
                description,
                pool_type,
                tags,
                filter_conditions
            });

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '更新失败，股票池不存在'
                });
            }

            res.json({
                success: true,
                message: '更新股票池成功'
            });

        } catch (error) {
            console.error('更新股票池错误:', error);
            res.status(500).json({
                success: false,
                error: '更新股票池失败'
            });
        }
    });

    // 删除股票池
    router.delete('/pools/:poolId', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { poolId } = req.params;

            // 删除股票池（会级联删除池中的股票）
            const result = await stockPoolModel.delete(poolId, userId);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '股票池不存在'
                });
            }

            res.json({
                success: true,
                message: '删除股票池成功'
            });

        } catch (error) {
            console.error('删除股票池错误:', error);
            res.status(500).json({
                success: false,
                error: '删除股票池失败'
            });
        }
    });

    // ==================== 股票池项目管理 ====================

    // 获取股票池中的所有股票
    router.get('/pools/:poolId/stocks', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { poolId } = req.params;

            // 验证股票池是否存在且属于当前用户
            const pool = await stockPoolModel.findById(poolId, userId);
            if (!pool) {
                return res.status(404).json({
                    success: false,
                    error: '股票池不存在'
                });
            }

            const stocks = await stockPoolItemModel.findByPoolId(poolId);

            res.json({
                success: true,
                data: stocks
            });

        } catch (error) {
            console.error('获取股票池股票列表错误:', error);
            res.status(500).json({
                success: false,
                error: '获取股票池股票列表失败'
            });
        }
    });

    // 添加股票到股票池
    router.post('/pools/:poolId/stocks', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { poolId } = req.params;
            const { stock_code, stock_name, tags, notes, stocks } = req.body;

            // 验证股票池是否存在且属于当前用户
            const pool = await stockPoolModel.findById(poolId, userId);
            if (!pool) {
                return res.status(404).json({
                    success: false,
                    error: '股票池不存在'
                });
            }

            // 批量添加
            if (stocks && Array.isArray(stocks)) {
                console.log('📊 批量添加股票到股票池，数量:', stocks.length);

                let successCount = 0;
                let skipCount = 0;
                let errorCount = 0;
                const results = [];

                for (const stock of stocks) {
                    try {
                        // 验证股票代码格式
                        if (!/^[0-9]{6}$/.test(stock.stock_code)) {
                            errorCount++;
                            results.push({
                                stock_code: stock.stock_code,
                                success: false,
                                error: `股票代码格式错误`
                            });
                            continue;
                        }

                        // 检查是否已存在
                        const exists = await stockPoolItemModel.exists(poolId, stock.stock_code);
                        if (exists) {
                            skipCount++;
                            results.push({
                                stock_code: stock.stock_code,
                                success: false,
                                skipped: true,
                                error: '股票已在股票池中'
                            });
                            continue;
                        }

                        // 添加股票到股票池
                        await stockPoolItemModel.add(poolId, stock);

                        // 同时添加到自选股（如果不存在）
                        try {
                            const watchlistExists = await watchlistModel.exists(userId, stock.stock_code);
                            if (!watchlistExists) {
                                await watchlistModel.add(userId, stock.stock_code, stock.stock_name);
                                console.log(`📌 自动添加到自选股: ${stock.stock_code} ${stock.stock_name}`);
                            }
                        } catch (err) {
                            console.warn(`⚠️ 添加到自选股失败（不影响股票池添加）: ${stock.stock_code}`, err.message);
                        }

                        successCount++;
                        results.push({
                            stock_code: stock.stock_code,
                            success: true
                        });

                    } catch (err) {
                        errorCount++;
                        results.push({
                            stock_code: stock.stock_code,
                            success: false,
                            error: err.message
                        });
                    }
                }

                return res.json({
                    success: true,
                    message: `批量添加完成：成功 ${successCount} 个，跳过 ${skipCount} 个，失败 ${errorCount} 个`,
                    data: {
                        successCount,
                        skipCount,
                        errorCount,
                        total: stocks.length,
                        results
                    }
                });
            }

            // 单个添加
            if (!stock_code || !stock_name) {
                return res.status(400).json({
                    success: false,
                    error: '股票代码和名称是必填的'
                });
            }

            // 验证股票代码格式
            if (!/^[0-9]{6}$/.test(stock_code)) {
                return res.status(400).json({
                    success: false,
                    error: '请输入正确的6位股票代码'
                });
            }

            // 检查股票是否已在股票池中
            const exists = await stockPoolItemModel.exists(poolId, stock_code);
            if (exists) {
                return res.status(400).json({
                    success: false,
                    error: '该股票已在股票池中'
                });
            }

            // 获取当前股票价格
            const currentPrice = await getStockPrice(stock_code);
            console.log(`💰 获取股票 ${stock_code} 当前价格: ${currentPrice}`);

            // 添加股票到股票池
            const result = await stockPoolItemModel.add(poolId, {
                stock_code,
                stock_name,
                added_price: currentPrice,
                tags,
                notes
            });

            // 同时添加到自选股（如果不存在）
            try {
                const watchlistExists = await watchlistModel.exists(userId, stock_code);
                if (!watchlistExists) {
                    await watchlistModel.add(userId, stock_code, stock_name);
                    console.log(`📌 自动添加到自选股: ${stock_code} ${stock_name}`);
                }
            } catch (err) {
                console.warn(`⚠️ 添加到自选股失败（不影响股票池添加）: ${stock_code}`, err.message);
            }

            res.json({
                success: true,
                message: '添加股票成功，已自动添加到自选股',
                data: {
                    id: result.id,
                    stock_code,
                    stock_name,
                    added_price: currentPrice
                }
            });

        } catch (error) {
            console.error('添加股票到股票池错误:', error);
            res.status(500).json({
                success: false,
                error: '添加股票失败'
            });
        }
    });

    // 更新股票池中的股票信息
    router.put('/pools/:poolId/stocks/:itemId', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { poolId, itemId } = req.params;
            const { stock_name, tags, notes } = req.body;

            // 验证股票池是否存在且属于当前用户
            const pool = await stockPoolModel.findById(poolId, userId);
            if (!pool) {
                return res.status(404).json({
                    success: false,
                    error: '股票池不存在'
                });
            }

            // 更新股票信息
            const result = await stockPoolItemModel.update(itemId, poolId, {
                stock_name,
                tags,
                notes
            });

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '股票不存在'
                });
            }

            res.json({
                success: true,
                message: '更新股票信息成功'
            });

        } catch (error) {
            console.error('更新股票信息错误:', error);
            res.status(500).json({
                success: false,
                error: '更新股票信息失败'
            });
        }
    });

    // 从股票池中删除股票
    router.delete('/pools/:poolId/stocks/:itemId', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { poolId, itemId } = req.params;

            // 验证股票池是否存在且属于当前用户
            const pool = await stockPoolModel.findById(poolId, userId);
            if (!pool) {
                return res.status(404).json({
                    success: false,
                    error: '股票池不存在'
                });
            }

            // 先获取股票信息（删除前）
            const stockItem = await stockPoolItemModel.findById(itemId, poolId);
            if (!stockItem) {
                return res.status(404).json({
                    success: false,
                    error: '股票不存在'
                });
            }

            const stockCode = stockItem.stock_code;
            console.log(`🗑️ 准备从股票池删除股票: ${stockCode} ${stockItem.stock_name}`);

            // 删除股票
            const result = await stockPoolItemModel.delete(itemId, poolId);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '股票不存在'
                });
            }

            // 检查该股票是否还存在于用户的其他股票池中
            const existsInOtherPools = await stockPoolItemModel.existsInUserPools(userId, stockCode);

            if (!existsInOtherPools) {
                // 如果不存在于任何股票池，则从自选股中删除
                try {
                    const watchlistExists = await watchlistModel.exists(userId, stockCode);
                    if (watchlistExists) {
                        await watchlistModel.remove(userId, stockCode);
                        console.log(`🔄 自动从自选股删除: ${stockCode} ${stockItem.stock_name}`);
                    }
                } catch (err) {
                    console.warn(`⚠️ 从自选股删除失败（不影响股票池删除）: ${stockCode}`, err.message);
                }
            } else {
                console.log(`ℹ️ 股票 ${stockCode} 仍存在于其他股票池中，保留在自选股`);
            }

            res.json({
                success: true,
                message: existsInOtherPools
                    ? '删除股票成功（该股票仍存在于其他股票池中）'
                    : '删除股票成功，已从自选股中移除'
            });

        } catch (error) {
            console.error('删除股票错误:', error);
            res.status(500).json({
                success: false,
                error: '删除股票失败'
            });
        }
    });

    // 清空股票池
    router.delete('/pools/:poolId/stocks', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { poolId } = req.params;

            // 验证股票池是否存在且属于当前用户
            const pool = await stockPoolModel.findById(poolId, userId);
            if (!pool) {
                return res.status(404).json({
                    success: false,
                    error: '股票池不存在'
                });
            }

            // 清空股票池
            const result = await stockPoolItemModel.clear(poolId);

            res.json({
                success: true,
                message: `成功清空股票池，共删除 ${result.changes} 只股票`
            });

        } catch (error) {
            console.error('清空股票池错误:', error);
            res.status(500).json({
                success: false,
                error: '清空股票池失败'
            });
        }
    });

    return router;
};
