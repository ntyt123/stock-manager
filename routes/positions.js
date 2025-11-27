const express = require('express');
const path = require('path');
const axios = require('axios');
const iconv = require('iconv-lite');
const { spawn } = require('child_process');
const fs = require('fs');
const { positionModel, positionUpdateModel, manualPositionModel } = require('../database');
const { parseExcelFile, fixChineseCharacters, autoAddPositionsToWatchlist } = require('../controllers/positionController');
const stockCache = require('../stockCache');
const { calculatePositionProfit } = require('../utils/tradingFeeCalculator');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // Excel文件上传API - 解析持仓数据Excel文件
    router.post('/upload/positions', authenticateToken, async (req, res) => {
        try {
            // 检查是否有文件上传
            if (!req.files || !req.files.file) {
                return res.status(400).json({
                    success: false,
                    error: '请选择要上传的Excel文件'
                });
            }

            const file = req.files.file;

            // 检查文件类型
            if (!file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
                return res.status(400).json({
                    success: false,
                    error: '请上传Excel文件(.xls或.xlsx格式)'
                });
            }

            // 修复文件名中的中文字符乱码
            const fixedFileName = fixChineseCharacters(file.name);
            console.log('原始文件名:', file.name);
            console.log('修复后文件名:', fixedFileName);

            // 解析Excel文件
            const positions = await parseExcelFile(file.data);

            if (positions.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '未在Excel文件中找到有效的持仓数据'
                });
            }

            // 计算汇总信息
            const totalMarketValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
            const totalCost = positions.reduce((sum, pos) => sum + (pos.costPrice * pos.quantity), 0);
            const totalProfitLoss = positions.reduce((sum, pos) => sum + pos.profitLoss, 0);
            const totalProfitLossRate = totalCost > 0 ? (totalProfitLoss / totalCost * 100).toFixed(2) : 0;

            try {
                // 保存持仓数据到数据库
                const saveResult = await positionModel.saveOrUpdatePositions(req.user.id, positions);
                console.log(`✅ 持仓数据保存成功: ${saveResult.totalRecords}条记录`);

                // 自动添加到自选股
                await autoAddPositionsToWatchlist(req.user.id, positions);

                // 记录更新日志
                await positionUpdateModel.recordUpdate(
                    req.user.id,
                    fixedFileName,
                    'success',
                    null,
                    saveResult.totalRecords,
                    saveResult.totalRecords
                );

                // 获取最新的更新时间
                const latestUpdate = await positionUpdateModel.getLatestUpdate(req.user.id);

                res.json({
                    success: true,
                    message: 'Excel文件解析成功，数据已保存到数据库',
                    data: {
                        positions: positions,
                        summary: {
                            totalMarketValue: totalMarketValue,
                            totalProfitLoss: totalProfitLoss,
                            totalProfitLossRate: totalProfitLossRate,
                            positionCount: positions.length,
                            lastUpdate: latestUpdate ? latestUpdate.updateTime : new Date().toISOString(),
                            fileName: fixedFileName
                        }
                    }
                });

            } catch (dbError) {
                console.error('❌ 数据库保存失败:', dbError);

                // 记录失败日志
                await positionUpdateModel.recordUpdate(
                    req.user.id,
                    fixedFileName,
                    'failed',
                    dbError.message,
                    positions.length,
                    0
                );

                // 即使数据库保存失败，也返回解析的数据，让用户知道文件解析是成功的
                res.json({
                    success: true,
                    message: 'Excel文件解析成功，但数据保存到数据库失败',
                    warning: '数据仅显示在页面上，下次登录需要重新上传',
                    data: {
                        positions: positions,
                        summary: {
                            totalMarketValue: totalMarketValue,
                            totalProfitLoss: totalProfitLoss,
                            totalProfitLossRate: totalProfitLossRate,
                            positionCount: positions.length,
                            lastUpdate: new Date().toISOString(),
                            fileName: fixedFileName
                        }
                    }
                });
            }

        } catch (error) {
            console.error('Excel文件解析错误:', error);
            return res.status(500).json({
                success: false,
                error: '文件解析失败，请检查文件格式是否正确'
            });
        }
    });

    // 获取用户持仓数据
    router.get('/positions', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;

            // 获取用户的持仓数据
            const positions = await positionModel.findByUserId(userId);

            if (positions.length === 0) {
                // 如果没有持仓,直接返回空数据
                const latestUpdate = await positionUpdateModel.getLatestUpdate(userId);
                return res.json({
                    success: true,
                    data: {
                        positions: [],
                        summary: {
                            totalMarketValue: 0,
                            totalProfitLoss: 0,
                            totalProfitLossRate: 0,
                            positionCount: 0,
                            lastUpdate: latestUpdate ? latestUpdate.updateTime : null,
                            fileName: latestUpdate ? latestUpdate.fileName : null
                        },
                        updateHistory: latestUpdate ? {
                            status: latestUpdate.status,
                            totalRecords: latestUpdate.totalRecords,
                            successRecords: latestUpdate.successRecords,
                            errorMessage: latestUpdate.errorMessage
                        } : null
                    }
                });
            }

            // 自动获取所有持仓股票的最新价格
            try {
                const stockCodes = positions.map(pos => pos.stockCode);
                console.log(`📊 获取 ${stockCodes.length} 个持仓股票的最新价格...`);

                // 检查缓存，分离缓存命中和未命中的股票
                const cacheResult = stockCache.getQuotes(stockCodes);
                const quotes = cacheResult.cached.map(item => item.data);
                const missingCodes = cacheResult.missing;

                // 如果有未命中缓存的股票，批量获取最新价格
                if (missingCodes.length > 0) {
                    const fullCodes = missingCodes.map(code => {
                        let market;
                        if (code === '000001') {
                            market = 'sh';
                        } else if (code.startsWith('6')) {
                            market = 'sh';
                        } else {
                            market = 'sz';
                        }
                        return `${market}${code}`;
                    }).join(',');

                    const sinaUrl = `https://hq.sinajs.cn/list=${fullCodes}`;
                    const response = await axios.get(sinaUrl, {
                        headers: { 'Referer': 'https://finance.sina.com.cn' },
                        timeout: 5000,
                        responseType: 'arraybuffer'
                    });

                    const data = iconv.decode(Buffer.from(response.data), 'gbk');
                    const lines = data.split('\n').filter(line => line.trim());

                    for (let i = 0; i < missingCodes.length; i++) {
                        const line = lines[i];
                        if (!line) continue;

                        const match = line.match(/="(.+)"/);
                        if (!match || !match[1]) continue;

                        const values = match[1].split(',');
                        if (values.length < 32) continue;

                        const quote = {
                            stockCode: missingCodes[i],
                            stockName: values[0],
                            currentPrice: parseFloat(values[3]),
                            yesterdayClose: parseFloat(values[2]),
                            change: parseFloat(values[3]) - parseFloat(values[2]),
                            changePercent: ((parseFloat(values[3]) - parseFloat(values[2])) / parseFloat(values[2]) * 100).toFixed(2)
                        };

                        quotes.push(quote);
                    }

                    // 缓存新获取的数据
                    stockCache.setQuotes(quotes.filter(q => missingCodes.includes(q.stockCode)));
                }

                // 将最新价格更新到持仓数据中（计算盈亏时考虑交易手续费）
                positions.forEach(pos => {
                    const quote = quotes.find(q => q.stockCode === pos.stockCode);
                    if (quote && quote.currentPrice > 0) {
                        pos.currentPrice = quote.currentPrice;

                        // 使用费用计算器计算实际盈亏（包含买入时的手续费）
                        const profitCalc = calculatePositionProfit(
                            pos.costPrice,
                            pos.currentPrice,
                            pos.quantity
                        );

                        pos.marketValue = profitCalc.currentValue;
                        pos.profitLoss = profitCalc.profitLoss;
                        pos.profitLossRate = profitCalc.profitLossRate;
                    }
                });

                console.log(`✅ 已更新 ${stockCodes.length} 个持仓的最新价格`);
            } catch (priceError) {
                console.error('⚠️ 获取最新价格失败，使用数据库中的价格:', priceError.message);
                // 获取价格失败不影响主流程，使用数据库中的价格
            }

            // 获取最新的更新时间
            const latestUpdate = await positionUpdateModel.getLatestUpdate(userId);

            // 计算汇总信息（使用更新后的价格）
            const totalMarketValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
            const totalCost = positions.reduce((sum, pos) => sum + (pos.costPrice * pos.quantity), 0);
            const totalProfitLoss = positions.reduce((sum, pos) => sum + pos.profitLoss, 0);
            const totalProfitLossRate = totalCost > 0 ? (totalProfitLoss / totalCost * 100).toFixed(2) : 0;

            res.json({
                success: true,
                data: {
                    positions: positions,
                    summary: {
                        totalMarketValue: totalMarketValue,
                        totalProfitLoss: totalProfitLoss,
                        totalProfitLossRate: totalProfitLossRate,
                        positionCount: positions.length,
                        lastUpdate: latestUpdate ? latestUpdate.updateTime : null,
                        fileName: latestUpdate ? latestUpdate.fileName : null
                    },
                    updateHistory: latestUpdate ? {
                        status: latestUpdate.status,
                        totalRecords: latestUpdate.totalRecords,
                        successRecords: latestUpdate.successRecords,
                        errorMessage: latestUpdate.errorMessage
                    } : null,
                    priceUpdated: true // 标记价格已更新
                }
            });

        } catch (error) {
            console.error('获取持仓数据错误:', error);
            res.status(500).json({
                success: false,
                error: '获取持仓数据失败'
            });
        }
    });

    // 添加单个持仓
    router.post('/positions/add', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { stockCode, stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate } = req.body;

            // 验证必填字段
            if (!stockCode || !stockName || !quantity || !costPrice) {
                return res.status(400).json({
                    success: false,
                    error: '股票代码、名称、数量和成本价是必填的'
                });
            }

            // 验证股票代码格式
            if (!/^[0-9]{6}$/.test(stockCode)) {
                return res.status(400).json({
                    success: false,
                    error: '请输入正确的6位股票代码'
                });
            }

            // 检查持仓是否已存在
            const existingPosition = await positionModel.findByStockCode(userId, stockCode);
            if (existingPosition) {
                return res.status(400).json({
                    success: false,
                    error: '该股票持仓已存在，请使用更新功能'
                });
            }

            // 计算衍生字段（如果未提供），使用费用计算器计算实际盈亏
            const finalCurrentPrice = currentPrice || costPrice;

            // 使用费用计算器计算实际盈亏（包含买入时的手续费）
            const profitCalc = calculatePositionProfit(costPrice, finalCurrentPrice, quantity);

            const finalMarketValue = marketValue || profitCalc.currentValue;
            const finalProfitLoss = profitLoss !== undefined ? profitLoss : profitCalc.profitLoss;
            const finalProfitLossRate = profitLossRate !== undefined ? profitLossRate : profitCalc.profitLossRate;

            const positionData = {
                stockCode,
                stockName,
                quantity: parseFloat(quantity),
                costPrice: parseFloat(costPrice),
                currentPrice: finalCurrentPrice,
                marketValue: finalMarketValue,
                profitLoss: finalProfitLoss,
                profitLossRate: finalProfitLossRate
            };

            const result = await positionModel.addPosition(userId, positionData);

            console.log(`✅ 用户 ${userId} 添加持仓: ${stockName} (${stockCode})`);

            // 自动添加到自选股
            await autoAddPositionsToWatchlist(userId, [positionData]);

            res.json({
                success: true,
                message: '持仓添加成功',
                data: {
                    id: result.id,
                    ...positionData,
                    created_at: result.created_at
                }
            });

        } catch (error) {
            console.error('添加持仓错误:', error);
            res.status(500).json({
                success: false,
                error: '添加持仓失败: ' + error.message
            });
        }
    });

    // 更新单个持仓
    router.put('/positions/:stockCode', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { stockCode } = req.params;
            const { stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate } = req.body;

            // 验证持仓是否存在
            const position = await positionModel.findByStockCode(userId, stockCode);
            if (!position) {
                return res.status(404).json({
                    success: false,
                    error: '持仓不存在'
                });
            }

            // 验证必填字段
            if (!stockName || !quantity || !costPrice) {
                return res.status(400).json({
                    success: false,
                    error: '名称、数量和成本价是必填的'
                });
            }

            // 计算衍生字段（如果未提供），使用费用计算器计算实际盈亏
            const finalCurrentPrice = currentPrice || costPrice;

            // 使用费用计算器计算实际盈亏（包含买入时的手续费）
            const profitCalc = calculatePositionProfit(costPrice, finalCurrentPrice, quantity);

            const finalMarketValue = marketValue || profitCalc.currentValue;
            const finalProfitLoss = profitLoss !== undefined ? profitLoss : profitCalc.profitLoss;
            const finalProfitLossRate = profitLossRate !== undefined ? profitLossRate : profitCalc.profitLossRate;

            const positionData = {
                stockName,
                quantity: parseFloat(quantity),
                costPrice: parseFloat(costPrice),
                currentPrice: finalCurrentPrice,
                marketValue: finalMarketValue,
                profitLoss: finalProfitLoss,
                profitLossRate: finalProfitLossRate
            };

            await positionModel.updatePosition(userId, stockCode, positionData);

            console.log(`✅ 用户 ${userId} 更新持仓: ${stockName} (${stockCode})`);

            res.json({
                success: true,
                message: '持仓更新成功',
                data: {
                    stockCode,
                    ...positionData
                }
            });

        } catch (error) {
            console.error('更新持仓错误:', error);
            res.status(500).json({
                success: false,
                error: '更新持仓失败: ' + error.message
            });
        }
    });

    // 删除单个持仓
    router.delete('/positions/:stockCode', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { stockCode } = req.params;

            // 验证持仓是否存在
            const position = await positionModel.findByStockCode(userId, stockCode);
            if (!position) {
                return res.status(404).json({
                    success: false,
                    error: '持仓不存在'
                });
            }

            const result = await positionModel.deletePosition(userId, stockCode);

            console.log(`✅ 用户 ${userId} 删除持仓: ${position.stockName} (${stockCode})`);

            res.json({
                success: true,
                message: '持仓删除成功',
                deletedCount: result.changes
            });

        } catch (error) {
            console.error('删除持仓错误:', error);
            res.status(500).json({
                success: false,
                error: '删除持仓失败'
            });
        }
    });

    // 清空用户持仓数据
    router.delete('/positions', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;

            // 删除用户的所有持仓数据
            const result = await positionModel.deleteByUserId(userId);

            // 记录清空操作
            await positionUpdateModel.recordUpdate(
                userId,
                '手动清空',
                'cleared',
                null,
                0,
                0
            );

            res.json({
                success: true,
                message: '持仓数据已清空',
                deletedCount: result.changes
            });

        } catch (error) {
            console.error('清空持仓数据错误:', error);
            res.status(500).json({
                success: false,
                error: '清空持仓数据失败'
            });
        }
    });

    // 获取用户的所有手动持仓
    router.get('/manual-positions', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const positions = await manualPositionModel.findByUserId(userId);

            res.json({
                success: true,
                data: positions,
                count: positions.length
            });
        } catch (error) {
            console.error('获取手动持仓错误:', error);
            res.status(500).json({
                success: false,
                error: '获取手动持仓失败'
            });
        }
    });

    // 添加手动持仓
    router.post('/manual-positions', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { stockCode, stockName, quantity, costPrice, buyDate, currentPrice, notes } = req.body;

            // 验证必填字段
            if (!stockCode || !stockName || !quantity || !costPrice || !buyDate) {
                return res.status(400).json({
                    success: false,
                    error: '股票代码、名称、数量、成本价和买入日期是必填的'
                });
            }

            // 验证股票代码格式
            if (!/^[0-9]{6}$/.test(stockCode)) {
                return res.status(400).json({
                    success: false,
                    error: '请输入正确的6位股票代码'
                });
            }

            // 验证数量和价格
            if (parseFloat(quantity) <= 0 || parseFloat(costPrice) <= 0) {
                return res.status(400).json({
                    success: false,
                    error: '数量和成本价必须大于0'
                });
            }

            const positionData = {
                stockCode,
                stockName,
                quantity: parseFloat(quantity),
                costPrice: parseFloat(costPrice),
                buyDate,
                currentPrice: currentPrice ? parseFloat(currentPrice) : null,
                notes: notes || null
            };

            const result = await manualPositionModel.add(userId, positionData);

            console.log(`✅ 用户 ${userId} 添加手动持仓: ${stockName} (${stockCode})`);

            // 同步到普通持仓表（我的持仓）
            const finalCurrentPrice = positionData.currentPrice || positionData.costPrice;

            // 使用费用计算器计算实际盈亏（包含买入时的手续费）
            const profitCalc = calculatePositionProfit(
                positionData.costPrice,
                finalCurrentPrice,
                positionData.quantity
            );

            const finalMarketValue = profitCalc.currentValue;
            const finalProfitLoss = profitCalc.profitLoss;
            const finalProfitLossRate = profitCalc.profitLossRate;

            const syncPositionData = {
                stockCode: positionData.stockCode,
                stockName: positionData.stockName,
                quantity: positionData.quantity,
                costPrice: positionData.costPrice,
                currentPrice: finalCurrentPrice,
                marketValue: finalMarketValue,
                profitLoss: finalProfitLoss,
                profitLossRate: finalProfitLossRate
            };

            try {
                // 检查是否已存在，如果存在则更新，否则添加
                const existingPosition = await positionModel.findByStockCode(userId, stockCode);
                if (existingPosition) {
                    await positionModel.updatePosition(userId, stockCode, syncPositionData);
                    console.log(`  🔄 已同步更新到我的持仓: ${stockName} (${stockCode})`);
                } else {
                    await positionModel.addPosition(userId, syncPositionData);
                    console.log(`  ➕ 已同步添加到我的持仓: ${stockName} (${stockCode})`);
                }
            } catch (syncError) {
                console.error(`  ⚠️ 同步到我的持仓失败: ${syncError.message}`);
                // 同步失败不影响主流程
            }

            // 自动添加到自选股
            await autoAddPositionsToWatchlist(userId, [{ stockCode, stockName }]);

            // 自动创建成本记录
            try {
                const costManagementController = require('../controllers/costManagementController');
                const costRecordData = {
                    stockCode: positionData.stockCode,
                    stockName: positionData.stockName,
                    operationType: 'buy',
                    operationDate: positionData.buyDate,
                    quantity: positionData.quantity,
                    price: positionData.costPrice,
                    notes: positionData.notes
                };

                await costManagementController.addCostRecordInternal(userId, costRecordData);
                console.log(`  💰 已自动创建成本记录: ${stockName} (${stockCode})`);
            } catch (costError) {
                console.error(`  ⚠️ 创建成本记录失败: ${costError.message}`);
                // 创建成本记录失败不影响主流程
            }

            res.json({
                success: true,
                message: '持仓添加成功',
                data: {
                    id: result.id,
                    ...positionData,
                    created_at: result.created_at
                }
            });

        } catch (error) {
            console.error('添加手动持仓错误:', error);
            res.status(500).json({
                success: false,
                error: '添加持仓失败: ' + error.message
            });
        }
    });

    // 更新手动持仓
    router.put('/manual-positions/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const positionId = parseInt(req.params.id);
            const { stockCode, stockName, quantity, costPrice, buyDate, currentPrice, notes } = req.body;

            // 验证持仓所有权
            const position = await manualPositionModel.findById(positionId);
            if (!position) {
                return res.status(404).json({
                    success: false,
                    error: '持仓不存在'
                });
            }

            if (position.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    error: '无权修改此持仓'
                });
            }

            // 验证必填字段
            if (!stockCode || !stockName || !quantity || !costPrice || !buyDate) {
                return res.status(400).json({
                    success: false,
                    error: '股票代码、名称、数量、成本价和买入日期是必填的'
                });
            }

            const positionData = {
                stockCode,
                stockName,
                quantity: parseFloat(quantity),
                costPrice: parseFloat(costPrice),
                buyDate,
                currentPrice: currentPrice ? parseFloat(currentPrice) : null,
                notes: notes || null
            };

            await manualPositionModel.update(positionId, positionData);

            console.log(`✅ 用户 ${userId} 更新手动持仓 ID: ${positionId}`);

            // 同步到普通持仓表（我的持仓）
            const finalCurrentPrice = positionData.currentPrice || positionData.costPrice;

            // 使用费用计算器计算实际盈亏（包含买入时的手续费）
            const profitCalc2 = calculatePositionProfit(
                positionData.costPrice,
                finalCurrentPrice,
                positionData.quantity
            );

            const finalMarketValue = profitCalc2.currentValue;
            const finalProfitLoss = profitCalc2.profitLoss;
            const finalProfitLossRate = profitCalc2.profitLossRate;

            const syncPositionData = {
                stockName: positionData.stockName,
                quantity: positionData.quantity,
                costPrice: positionData.costPrice,
                currentPrice: finalCurrentPrice,
                marketValue: finalMarketValue,
                profitLoss: finalProfitLoss,
                profitLossRate: finalProfitLossRate
            };

            try {
                // 检查是否存在于普通持仓中
                const existingPosition = await positionModel.findByStockCode(userId, stockCode);
                if (existingPosition) {
                    await positionModel.updatePosition(userId, stockCode, syncPositionData);
                    console.log(`  🔄 已同步更新到我的持仓: ${positionData.stockName} (${stockCode})`);
                } else {
                    // 如果不存在，则添加到我的持仓（可能是之前手动删除导致不同步）
                    const fullSyncData = {
                        stockCode: stockCode,
                        ...syncPositionData
                    };
                    await positionModel.addPosition(userId, fullSyncData);
                    console.log(`  ➕ 已同步添加到我的持仓: ${positionData.stockName} (${stockCode})`);
                }
            } catch (syncError) {
                console.error(`  ⚠️ 同步到我的持仓失败: ${syncError.message}`);
                // 同步失败不影响主流程
            }

            res.json({
                success: true,
                message: '持仓更新成功',
                data: {
                    id: positionId,
                    ...positionData
                }
            });

        } catch (error) {
            console.error('更新手动持仓错误:', error);
            res.status(500).json({
                success: false,
                error: '更新持仓失败: ' + error.message
            });
        }
    });

    // 删除手动持仓
    router.delete('/manual-positions/:id', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const positionId = parseInt(req.params.id);

            // 验证持仓所有权
            const position = await manualPositionModel.findById(positionId);
            if (!position) {
                return res.status(404).json({
                    success: false,
                    error: '持仓不存在'
                });
            }

            if (position.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    error: '无权删除此持仓'
                });
            }

            const result = await manualPositionModel.delete(positionId);

            console.log(`✅ 用户 ${userId} 删除手动持仓 ID: ${positionId}`);

            // 同步删除普通持仓表（我的持仓）中的对应记录
            try {
                const stockCode = position.stock_code;
                const deleteResult = await positionModel.deletePosition(userId, stockCode);
                if (deleteResult.changes > 0) {
                    console.log(`  🗑️ 已从我的持仓中删除: ${position.stock_name} (${stockCode})`);
                } else {
                    console.log(`  ℹ️ 我的持仓中不存在该股票，无需删除: ${stockCode}`);
                }
            } catch (syncError) {
                console.error(`  ⚠️ 从我的持仓中删除失败: ${syncError.message}`);
                // 同步失败不影响主流程
            }

            res.json({
                success: true,
                message: '持仓删除成功',
                deletedCount: result.changes
            });

        } catch (error) {
            console.error('删除手动持仓错误:', error);
            res.status(500).json({
                success: false,
                error: '删除持仓失败'
            });
        }
    });

    // 使用 easytrader 同步券商持仓数据
    router.post('/positions/sync-ebroker', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            console.log(`🔄 用户 ${userId} 请求从券商同步持仓数据...`);

            // 检查 Python 脚本是否存在
            const scriptPath = path.join(__dirname, '..', 'ebroker_sync.py');
            if (!fs.existsSync(scriptPath)) {
                return res.status(500).json({
                    success: false,
                    error: '同步脚本不存在，请联系管理员'
                });
            }

            // 检查配置文件是否存在
            const configPath = path.join(__dirname, '..', 'account.json');
            if (!fs.existsSync(configPath)) {
                return res.status(400).json({
                    success: false,
                    error: '配置文件不存在，请先创建 account.json 配置文件',
                    hint: '运行命令: python ebroker_sync.py init'
                });
            }

            // 调用 Python 脚本同步持仓
            const python = spawn('python', [scriptPath, 'sync', configPath]);

            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(data.toString());
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
                console.error(data.toString());
            });

            python.on('close', async (code) => {
                if (code !== 0) {
                    console.error(`❌ Python 脚本执行失败，退出码: ${code}`);
                    console.error('错误输出:', stderr);

                    await positionUpdateModel.recordUpdate(
                        userId,
                        '券商同步',
                        'failed',
                        stderr || 'Python脚本执行失败',
                        0,
                        0
                    );

                    return res.status(500).json({
                        success: false,
                        error: 'easytrader 同步失败',
                        details: stderr || 'Python脚本执行失败',
                        stdout: stdout
                    });
                }

                try {
                    // 解析 Python 脚本的输出（JSON 格式）
                    const jsonMatch = stdout.match(/\{[\s\S]*"success"[\s\S]*\}/);
                    if (!jsonMatch) {
                        throw new Error('无法从Python脚本输出中找到JSON数据');
                    }

                    const result = JSON.parse(jsonMatch[0]);

                    if (!result.success || !result.data || result.data.length === 0) {
                        await positionUpdateModel.recordUpdate(
                            userId,
                            '券商同步',
                            'failed',
                            '未获取到持仓数据',
                            0,
                            0
                        );

                        return res.json({
                            success: false,
                            error: '未获取到持仓数据，可能账户无持仓或登录失败'
                        });
                    }

                    // 保存同步的持仓数据到数据库
                    const positions = result.data;
                    const saveResult = await positionModel.saveOrUpdatePositions(userId, positions);

                    console.log(`✅ 从券商同步 ${positions.length} 个持仓，已保存到数据库`);

                    // 自动添加到自选股
                    await autoAddPositionsToWatchlist(userId, positions);

                    // 记录同步成功
                    await positionUpdateModel.recordUpdate(
                        userId,
                        '券商同步 (easytrader)',
                        'success',
                        null,
                        positions.length,
                        positions.length
                    );

                    // 计算汇总信息
                    const totalMarketValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
                    const totalCost = positions.reduce((sum, pos) => sum + (pos.costPrice * pos.quantity), 0);
                    const totalProfitLoss = positions.reduce((sum, pos) => sum + pos.profitLoss, 0);
                    const totalProfitLossRate = totalCost > 0 ? (totalProfitLoss / totalCost * 100).toFixed(2) : 0;

                    res.json({
                        success: true,
                        message: '从券商同步持仓数据成功',
                        data: {
                            positions: positions,
                            summary: {
                                totalMarketValue: totalMarketValue,
                                totalProfitLoss: totalProfitLoss,
                                totalProfitLossRate: totalProfitLossRate,
                                positionCount: positions.length,
                                lastUpdate: new Date().toISOString(),
                                fileName: '券商同步 (easytrader)'
                            },
                            syncTime: result.summary.syncTime
                        }
                    });

                } catch (parseError) {
                    console.error('❌ 解析 Python 输出失败:', parseError);

                    await positionUpdateModel.recordUpdate(
                        userId,
                        '券商同步',
                        'failed',
                        parseError.message,
                        0,
                        0
                    );

                    res.status(500).json({
                        success: false,
                        error: '解析同步数据失败',
                        details: parseError.message,
                        stdout: stdout
                    });
                }
            });

        } catch (error) {
            console.error('❌ 券商同步错误:', error);
            res.status(500).json({
                success: false,
                error: '券商同步失败: ' + error.message
            });
        }
    });

    return router;
};
