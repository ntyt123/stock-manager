/**
 * 持仓报表控制器
 */

const { db } = require('../database');
const axios = require('axios');

/**
 * 获取持仓报表数据
 */
async function getPositionReport(req, res) {
    try {
        const userId = req.user.id;

        // 获取用户所有持仓数据
        const positions = db.prepare(`
            SELECT
                stock_code as stockCode,
                stock_name as stockName,
                quantity,
                cost_price as costPrice,
                current_price as currentPrice,
                market_value as marketValue,
                profit_loss as profitLoss,
                profit_loss_rate as profitLossRate
            FROM positions
            WHERE user_id = ?
            ORDER BY market_value DESC
        `).all(userId);

        if (!positions || positions.length === 0) {
            return res.json({
                success: true,
                data: {
                    summary: {
                        totalPositions: 0,
                        totalMarketValue: 0,
                        totalCostValue: 0,
                        totalProfitLoss: 0,
                        totalProfitLossRate: 0,
                        profitPositions: 0,
                        lossPositions: 0
                    },
                    positions: [],
                    industryDistribution: [],
                    positionRatios: [],
                    costAnalysis: [],
                    profitLossStats: []
                }
            });
        }

        // 1. 持仓明细汇总
        const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
        const totalCostValue = positions.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
        const totalProfitLoss = positions.reduce((sum, p) => sum + p.profitLoss, 0);
        const totalProfitLossRate = totalCostValue > 0 ? (totalProfitLoss / totalCostValue) * 100 : 0;
        const profitPositions = positions.filter(p => p.profitLoss > 0).length;
        const lossPositions = positions.filter(p => p.profitLoss < 0).length;

        const summary = {
            totalPositions: positions.length,
            totalMarketValue,
            totalCostValue,
            totalProfitLoss,
            totalProfitLossRate,
            profitPositions,
            lossPositions
        };

        // 2. 获取行业信息（使用新浪财经接口）
        const positionsWithIndustry = await enrichPositionsWithIndustry(positions);

        // 3. 行业分布统计
        const industryDistribution = calculateIndustryDistribution(positionsWithIndustry, totalMarketValue);

        // 4. 仓位占比分析
        const positionRatios = calculatePositionRatios(positionsWithIndustry, totalMarketValue);

        // 5. 持仓成本分析
        const costAnalysis = calculateCostAnalysis(positionsWithIndustry);

        // 6. 浮动盈亏统计
        const profitLossStats = calculateProfitLossStats(positionsWithIndustry);

        res.json({
            success: true,
            data: {
                summary,
                positions: positionsWithIndustry,
                industryDistribution,
                positionRatios,
                costAnalysis,
                profitLossStats
            }
        });

    } catch (error) {
        console.error('获取持仓报表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取持仓报表失败',
            error: error.message
        });
    }
}

/**
 * 为持仓数据添加行业信息
 */
async function enrichPositionsWithIndustry(positions) {
    const enrichedPositions = [];

    for (const position of positions) {
        try {
            // 使用新浪财经接口获取股票详细信息
            const industry = await getStockIndustry(position.stockCode);
            enrichedPositions.push({
                ...position,
                industry: industry || '未知行业'
            });
        } catch (error) {
            console.error(`获取股票 ${position.stockCode} 行业信息失败:`, error.message);
            enrichedPositions.push({
                ...position,
                industry: '未知行业'
            });
        }
    }

    return enrichedPositions;
}

/**
 * 获取股票行业信息
 */
async function getStockIndustry(stockCode) {
    // 尝试从缓存中获取
    const cached = industryCache.get(stockCode);
    if (cached) {
        return cached;
    }

    // 简化的行业映射（实际应用中可以从API获取或维护更完整的映射表）
    // 这里使用股票代码前缀进行简单分类
    const codePrefix = stockCode.substring(0, 3);
    let industry = '其他';

    // 根据股票代码段进行简单分类
    if (codePrefix === '600' || codePrefix === '601' || codePrefix === '603') {
        // 沪市主板
        industry = await fetchIndustryFromAPI(stockCode) || '沪市股票';
    } else if (codePrefix === '000' || codePrefix === '001') {
        // 深市主板
        industry = await fetchIndustryFromAPI(stockCode) || '深市股票';
    } else if (codePrefix === '002') {
        // 中小板
        industry = await fetchIndustryFromAPI(stockCode) || '中小板股票';
    } else if (codePrefix === '300') {
        // 创业板
        industry = await fetchIndustryFromAPI(stockCode) || '创业板股票';
    } else if (codePrefix === '688') {
        // 科创板
        industry = await fetchIndustryFromAPI(stockCode) || '科创板股票';
    }

    // 缓存结果
    industryCache.set(stockCode, industry);
    return industry;
}

// 行业信息缓存
const industryCache = new Map();

/**
 * 从API获取行业信息（简化版本）
 */
async function fetchIndustryFromAPI(stockCode) {
    try {
        // 注意：这里可以接入真实的股票数据API
        // 例如：新浪财经、东方财富、腾讯财经等
        // 为简化实现，这里返回基于代码的分类

        // 可以后续对接真实API，例如：
        // const response = await axios.get(`https://api.example.com/stock/${stockCode}/industry`);
        // return response.data.industry;

        return null; // 暂时返回null，使用默认分类
    } catch (error) {
        console.error('从API获取行业信息失败:', error.message);
        return null;
    }
}

/**
 * 计算行业分布
 */
function calculateIndustryDistribution(positions, totalMarketValue) {
    const industryMap = new Map();

    positions.forEach(pos => {
        const industry = pos.industry || '未知行业';
        if (!industryMap.has(industry)) {
            industryMap.set(industry, {
                industry,
                count: 0,
                marketValue: 0,
                profitLoss: 0,
                positions: []
            });
        }

        const industryData = industryMap.get(industry);
        industryData.count++;
        industryData.marketValue += pos.marketValue;
        industryData.profitLoss += pos.profitLoss;
        industryData.positions.push({
            stockCode: pos.stockCode,
            stockName: pos.stockName,
            marketValue: pos.marketValue
        });
    });

    return Array.from(industryMap.values())
        .map(item => ({
            ...item,
            ratio: totalMarketValue > 0 ? (item.marketValue / totalMarketValue) * 100 : 0,
            profitLossRate: item.marketValue > 0 ? (item.profitLoss / (item.marketValue - item.profitLoss)) * 100 : 0
        }))
        .sort((a, b) => b.marketValue - a.marketValue);
}

/**
 * 计算仓位占比
 */
function calculatePositionRatios(positions, totalMarketValue) {
    return positions.map(pos => ({
        stockCode: pos.stockCode,
        stockName: pos.stockName,
        industry: pos.industry,
        marketValue: pos.marketValue,
        ratio: totalMarketValue > 0 ? (pos.marketValue / totalMarketValue) * 100 : 0,
        profitLoss: pos.profitLoss,
        profitLossRate: pos.profitLossRate
    })).sort((a, b) => b.ratio - a.ratio);
}

/**
 * 计算持仓成本分析
 */
function calculateCostAnalysis(positions) {
    return positions.map(pos => {
        const costValue = pos.costPrice * pos.quantity;
        const priceChange = pos.currentPrice - pos.costPrice;
        const priceChangeRate = pos.costPrice > 0 ? (priceChange / pos.costPrice) * 100 : 0;

        return {
            stockCode: pos.stockCode,
            stockName: pos.stockName,
            industry: pos.industry,
            quantity: pos.quantity,
            costPrice: pos.costPrice,
            currentPrice: pos.currentPrice,
            costValue,
            marketValue: pos.marketValue,
            priceChange,
            priceChangeRate,
            profitLoss: pos.profitLoss,
            profitLossRate: pos.profitLossRate
        };
    }).sort((a, b) => b.profitLossRate - a.profitLossRate);
}

/**
 * 计算浮动盈亏统计
 */
function calculateProfitLossStats(positions) {
    const stats = {
        totalPositions: positions.length,
        profitPositions: [],
        lossPositions: [],
        flatPositions: [],
        maxProfit: null,
        maxLoss: null,
        avgProfitLossRate: 0
    };

    positions.forEach(pos => {
        const item = {
            stockCode: pos.stockCode,
            stockName: pos.stockName,
            industry: pos.industry,
            profitLoss: pos.profitLoss,
            profitLossRate: pos.profitLossRate,
            marketValue: pos.marketValue
        };

        if (pos.profitLoss > 0.01) {
            stats.profitPositions.push(item);
        } else if (pos.profitLoss < -0.01) {
            stats.lossPositions.push(item);
        } else {
            stats.flatPositions.push(item);
        }

        // 找出最大盈利和最大亏损
        if (!stats.maxProfit || pos.profitLoss > stats.maxProfit.profitLoss) {
            stats.maxProfit = item;
        }
        if (!stats.maxLoss || pos.profitLoss < stats.maxLoss.profitLoss) {
            stats.maxLoss = item;
        }
    });

    // 按盈亏排序
    stats.profitPositions.sort((a, b) => b.profitLoss - a.profitLoss);
    stats.lossPositions.sort((a, b) => a.profitLoss - b.profitLoss);

    // 计算平均盈亏率
    if (positions.length > 0) {
        stats.avgProfitLossRate = positions.reduce((sum, p) => sum + p.profitLossRate, 0) / positions.length;
    }

    return stats;
}

/**
 * 获取交易报表数据
 */
async function getTradeReport(req, res) {
    try {
        const userId = req.user.id;
        const { startDate, endDate } = req.query;

        // 构建基础查询
        let whereClause = 'WHERE user_id = ?';
        let params = [userId];

        if (startDate && endDate) {
            whereClause += ' AND trade_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        // 获取所有交易记录
        const trades = db.prepare(`
            SELECT * FROM trade_operations
            ${whereClause}
            ORDER BY trade_date DESC, created_at DESC
        `).all(...params);

        if (!trades || trades.length === 0) {
            return res.json({
                success: true,
                data: {
                    summary: {
                        totalTrades: 0,
                        buyTrades: 0,
                        sellTrades: 0,
                        totalFee: 0,
                        avgFee: 0,
                        totalAmount: 0
                    },
                    tradeRecords: [],
                    feeStats: {},
                    frequencyAnalysis: [],
                    successRate: {}
                }
            });
        }

        console.log('=== 交易报表汇总统计 调试 ===');
        console.log('原始交易数据:', trades.map(t => ({
            date: t.trade_date,
            type: t.trade_type,
            code: t.stock_code,
            name: t.stock_name,
            qty: t.quantity,
            price: t.price,
            amount: t.amount,
            fee: t.fee
        })));

        // 1. 交易次数统计
        const totalTrades = trades.length;
        const buyCount = trades.filter(t => t.trade_type === 'buy').length;
        const sellCount = trades.filter(t => t.trade_type === 'sell').length;

        console.log(`交易次数统计: 总计=${totalTrades}, 买入=${buyCount}, 卖出=${sellCount}`);
        console.log(`验证: ${buyCount} + ${sellCount} = ${buyCount + sellCount} (应该等于 ${totalTrades})`);
        if (buyCount + sellCount !== totalTrades) {
            console.error('❌ 交易次数统计错误！买入+卖出 ≠ 总计');
        }

        // 2. 金额统计
        const buyAmount = trades.filter(t => t.trade_type === 'buy').reduce((sum, t) => sum + t.amount, 0);
        const sellAmount = trades.filter(t => t.trade_type === 'sell').reduce((sum, t) => sum + t.amount, 0);
        const totalAmount = buyAmount + sellAmount;

        console.log(`金额统计: 买入金额=¥${buyAmount.toFixed(2)}, 卖出金额=¥${sellAmount.toFixed(2)}, 总金额=¥${totalAmount.toFixed(2)}`);
        console.log(`验证: ¥${buyAmount.toFixed(2)} + ¥${sellAmount.toFixed(2)} = ¥${(buyAmount + sellAmount).toFixed(2)} (应该等于 ¥${totalAmount.toFixed(2)})`);

        // 3. 手续费统计
        const totalFees = trades.reduce((sum, t) => sum + (t.fee || 0), 0);
        const buyFees = trades.filter(t => t.trade_type === 'buy').reduce((sum, t) => sum + (t.fee || 0), 0);
        const sellFees = trades.filter(t => t.trade_type === 'sell').reduce((sum, t) => sum + (t.fee || 0), 0);

        console.log(`手续费统计: 总手续费=¥${totalFees.toFixed(2)}, 买入手续费=¥${buyFees.toFixed(2)}, 卖出手续费=¥${sellFees.toFixed(2)}`);
        console.log(`验证: ¥${buyFees.toFixed(2)} + ¥${sellFees.toFixed(2)} = ¥${(buyFees + sellFees).toFixed(2)} (应该等于 ¥${totalFees.toFixed(2)})`);

        // 4. 股票数量统计
        const stockSet = new Set(trades.map(t => t.stock_code));
        const stockCount = stockSet.size;

        console.log(`股票统计: 涉及 ${stockCount} 只股票: ${Array.from(stockSet).join(', ')}`);

        const summary = {
            totalTrades,
            buyCount,
            sellCount,
            buyAmount,
            sellAmount,
            totalFees,
            stockCount,
            avgTradeAmount: totalTrades > 0 ? totalAmount / totalTrades : 0
        };

        console.log('汇总统计:', JSON.stringify(summary, null, 2));
        console.log('=== 交易报表汇总统计 调试结束 ===');

        // 3. 买卖记录汇总（按股票分组）
        const tradeRecords = calculateTradeRecordsByStock(trades);

        // 4. 手续费统计（按类型、按股票）
        const feeStats = calculateFeeStats(trades);

        // 5. 交易频率分析（按日期、按月）
        const frequencyAnalysis = calculateTradeFrequency(trades);

        // 6. 操作成功率（基于配对的买卖计算盈亏）
        const successRate = calculateSuccessRate(trades);

        res.json({
            success: true,
            data: {
                summary,
                tradeRecords,
                feeStats,
                frequencyAnalysis,
                successRate
            }
        });

    } catch (error) {
        console.error('获取交易报表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取交易报表失败',
            error: error.message
        });
    }
}

/**
 * 按股票计算交易记录
 */
function calculateTradeRecordsByStock(trades) {
    const stockMap = new Map();

    trades.forEach(trade => {
        const code = trade.stock_code;
        if (!stockMap.has(code)) {
            stockMap.set(code, {
                stockCode: code,
                stockName: trade.stock_name,
                buyCount: 0,
                sellCount: 0,
                buyQuantity: 0,
                sellQuantity: 0,
                buyAmount: 0,
                sellAmount: 0,
                totalFees: 0,
                trades: []
            });
        }

        const stock = stockMap.get(code);
        if (trade.trade_type === 'buy') {
            stock.buyCount++;
            stock.buyQuantity += trade.quantity;
            stock.buyAmount += trade.amount;
        } else {
            stock.sellCount++;
            stock.sellQuantity += trade.quantity;
            stock.sellAmount += trade.amount;
        }
        stock.totalFees += trade.fee || 0;
        stock.trades.push({
            date: trade.trade_date,
            type: trade.trade_type,
            quantity: trade.quantity,
            price: trade.price,
            amount: trade.amount,
            fee: trade.fee
        });
    });

    const records = Array.from(stockMap.values()).map(record => ({
        ...record,
        totalTrades: record.buyCount + record.sellCount
    }));

    return records.sort((a, b) =>
        (b.buyAmount + b.sellAmount) - (a.buyAmount + a.sellAmount)
    );
}

/**
 * 计算手续费统计
 */
function calculateFeeStats(trades) {
    const buyFees = trades.filter(t => t.trade_type === 'buy').reduce((sum, t) => sum + (t.fee || 0), 0);
    const sellFees = trades.filter(t => t.trade_type === 'sell').reduce((sum, t) => sum + (t.fee || 0), 0);
    const totalFees = buyFees + sellFees;

    const buyCount = trades.filter(t => t.trade_type === 'buy').length;
    const sellCount = trades.filter(t => t.trade_type === 'sell').length;
    const totalCount = trades.length;

    // 按股票统计手续费
    const feeByStock = {};
    trades.forEach(trade => {
        const code = trade.stock_code;
        if (!feeByStock[code]) {
            feeByStock[code] = {
                stockCode: code,
                stockName: trade.stock_name,
                totalFees: 0,
                buyFees: 0,
                sellFees: 0,
                tradeCount: 0
            };
        }
        const fee = trade.fee || 0;
        feeByStock[code].totalFees += fee;
        feeByStock[code].tradeCount++;
        if (trade.trade_type === 'buy') {
            feeByStock[code].buyFees += fee;
        } else {
            feeByStock[code].sellFees += fee;
        }
    });

    return {
        totalFees,
        buyFees,
        sellFees,
        buyCount,
        sellCount,
        avgFeePerTrade: totalCount > 0 ? totalFees / totalCount : 0,
        byStock: Object.values(feeByStock).sort((a, b) => b.totalFees - a.totalFees)
    };
}

/**
 * 计算交易频率
 */
function calculateTradeFrequency(trades) {
    // 按日期统计
    const dailyMap = new Map();
    const monthlyMap = new Map();

    trades.forEach(trade => {
        const date = trade.trade_date;
        const month = date.substring(0, 7); // YYYY-MM

        // 日统计
        if (!dailyMap.has(date)) {
            dailyMap.set(date, { date, count: 0, buyCount: 0, sellCount: 0, totalAmount: 0, totalFees: 0 });
        }
        const daily = dailyMap.get(date);
        daily.count++;
        daily.totalAmount += trade.amount;
        daily.totalFees += trade.fee || 0;
        if (trade.trade_type === 'buy') {
            daily.buyCount++;
        } else {
            daily.sellCount++;
        }

        // 月统计
        if (!monthlyMap.has(month)) {
            monthlyMap.set(month, { month, count: 0, buyCount: 0, sellCount: 0, totalAmount: 0, totalFees: 0 });
        }
        const monthly = monthlyMap.get(month);
        monthly.count++;
        monthly.totalAmount += trade.amount;
        monthly.totalFees += trade.fee || 0;
        if (trade.trade_type === 'buy') {
            monthly.buyCount++;
        } else {
            monthly.sellCount++;
        }
    });

    // 日统计汇总
    const dailyData = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    const totalDays = dailyData.length;
    const totalTradesDays = dailyData.reduce((sum, d) => sum + d.count, 0);
    const mostActiveDay = dailyData.length > 0 ? dailyData.reduce((max, d) => d.count > max.count ? d : max) : null;

    // 月统计汇总
    const monthlyData = Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month));
    const totalMonths = monthlyData.length;
    const totalTradesMonths = monthlyData.reduce((sum, m) => sum + m.count, 0);
    const mostActiveMonth = monthlyData.length > 0 ? monthlyData.reduce((max, m) => m.count > max.count ? m : max) : null;

    return {
        daily: {
            totalDays,
            avgTradesPerDay: totalDays > 0 ? totalTradesDays / totalDays : 0,
            mostActiveDate: mostActiveDay ? mostActiveDay.date : null,
            maxTradesInDay: mostActiveDay ? mostActiveDay.count : 0,
            byDate: dailyData
        },
        monthly: {
            totalMonths,
            avgTradesPerMonth: totalMonths > 0 ? totalTradesMonths / totalMonths : 0,
            mostActiveMonth: mostActiveMonth ? mostActiveMonth.month : null,
            maxTradesInMonth: mostActiveMonth ? mostActiveMonth.count : 0,
            byMonth: monthlyData
        }
    };
}

/**
 * 计算操作成功率
 */
function calculateSuccessRate(trades) {
    // 按股票分组配对买卖交易
    const stockMap = new Map();

    trades.forEach(trade => {
        const code = trade.stock_code;
        if (!stockMap.has(code)) {
            stockMap.set(code, { buys: [], sells: [] });
        }
        const stock = stockMap.get(code);
        if (trade.trade_type === 'buy') {
            stock.buys.push(trade);
        } else {
            stock.sells.push(trade);
        }
    });

    let profitableTradesCount = 0;
    let lossTradesCount = 0;
    let totalProfit = 0;
    const pairedTrades = [];

    // 配对计算（简化版：FIFO先进先出）
    stockMap.forEach((stock, code) => {
        stock.buys.sort((a, b) => a.trade_date.localeCompare(b.trade_date));
        stock.sells.sort((a, b) => a.trade_date.localeCompare(b.trade_date));

        let buyIndex = 0;
        let sellIndex = 0;
        let buyRemaining = 0;
        let sellRemaining = 0; // 新增：追踪卖出剩余数量，不修改原始数据

        while (buyIndex < stock.buys.length && sellIndex < stock.sells.length) {
            const buy = stock.buys[buyIndex];
            const sell = stock.sells[sellIndex];

            if (buyRemaining === 0) {
                buyRemaining = buy.quantity;
            }
            if (sellRemaining === 0) {
                sellRemaining = sell.quantity;
            }

            const matchQty = Math.min(buyRemaining, sellRemaining);
            const buyValue = matchQty * buy.price;
            const sellValue = matchQty * sell.price;

            // 按比例分摊手续费
            const buyFeeShare = (buy.fee || 0) * (matchQty / buy.quantity);
            const sellFeeShare = (sell.fee || 0) * (matchQty / sell.quantity);

            const profit = sellValue - buyValue - buyFeeShare - sellFeeShare;

            // 计算持有天数
            const buyDate = new Date(buy.trade_date);
            const sellDate = new Date(sell.trade_date);
            const holdDays = Math.floor((sellDate - buyDate) / (1000 * 60 * 60 * 24));

            pairedTrades.push({
                stockCode: code,
                stockName: buy.stock_name,
                buyDate: buy.trade_date,
                sellDate: sell.trade_date,
                quantity: matchQty,
                buyPrice: buy.price,
                sellPrice: sell.price,
                profit,
                profitRate: buyValue > 0 ? (profit / buyValue) * 100 : 0,
                holdDays: holdDays > 0 ? holdDays : 0
            });

            if (profit > 0) {
                profitableTradesCount++;
            } else if (profit < 0) {
                lossTradesCount++;
            }
            totalProfit += profit;

            buyRemaining -= matchQty;
            sellRemaining -= matchQty;

            if (buyRemaining === 0) {
                buyIndex++;
            }
            if (sellRemaining === 0) {
                sellIndex++;
            }
        }
    });

    const totalPairedTrades = profitableTradesCount + lossTradesCount;
    const successRatePercent = totalPairedTrades > 0 ? (profitableTradesCount / totalPairedTrades) * 100 : 0;

    return {
        totalPairedTrades,
        profitableTrades: profitableTradesCount,
        lossTrades: lossTradesCount,
        successRatePercent,
        totalProfit,
        avgProfit: totalPairedTrades > 0 ? totalProfit / totalPairedTrades : 0,
        pairedTrades: pairedTrades.sort((a, b) => b.profitRate - a.profitRate)
    };
}

/**
 * 获取盈亏报表数据
 */
async function getProfitLossReport(req, res) {
    try {
        const userId = req.user.id;

        // 1. 获取所有交易记录用于计算已实现盈亏
        const trades = db.prepare(`
            SELECT * FROM trade_operations
            WHERE user_id = ?
            ORDER BY trade_date ASC, created_at ASC
        `).all(userId);

        // 2. 获取当前持仓用于计算未实现盈亏
        const positions = db.prepare(`
            SELECT
                stock_code as stockCode,
                stock_name as stockName,
                quantity,
                cost_price as costPrice,
                current_price as currentPrice,
                market_value as marketValue,
                profit_loss as profitLoss,
                profit_loss_rate as profitLossRate
            FROM positions WHERE user_id = ?
        `).all(userId);

        // 3. 计算已实现盈亏（通过配对买卖计算）
        const realizedProfitLoss = calculateRealizedProfitLoss(trades);

        // 4. 计算未实现盈亏（当前持仓的浮动盈亏）
        const unrealizedProfitLoss = calculateUnrealizedProfitLoss(positions);

        // 5. 总盈亏汇总
        const totalSummary = {
            realizedProfit: realizedProfitLoss.totalProfit,
            unrealizedProfit: unrealizedProfitLoss.totalProfit,
            totalProfit: realizedProfitLoss.totalProfit + unrealizedProfitLoss.totalProfit,
            realizedTrades: realizedProfitLoss.trades.length,
            unrealizedPositions: unrealizedProfitLoss.positions.length
        };

        // 6. 收益率曲线（按时间累计）
        const profitCurve = calculateProfitCurve(trades, positions);

        // 7. 盈亏分布分析
        const profitDistribution = calculateProfitDistribution([
            ...realizedProfitLoss.trades,
            ...unrealizedProfitLoss.positions
        ]);

        res.json({
            success: true,
            data: {
                realizedProfitLoss,
                unrealizedProfitLoss,
                totalSummary,
                profitCurve,
                profitDistribution
            }
        });

    } catch (error) {
        console.error('获取盈亏报表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取盈亏报表失败',
            error: error.message
        });
    }
}

/**
 * 计算已实现盈亏（配对买卖）
 */
function calculateRealizedProfitLoss(trades) {
    const stockMap = new Map();

    // 按股票分组
    trades.forEach(trade => {
        const code = trade.stock_code;
        if (!stockMap.has(code)) {
            stockMap.set(code, { buys: [], sells: [] });
        }
        const stock = stockMap.get(code);
        if (trade.trade_type === 'buy') {
            stock.buys.push(trade);
        } else {
            stock.sells.push(trade);
        }
    });

    const realizedTrades = [];
    let totalProfit = 0;
    let profitableCount = 0;
    let lossCount = 0;

    // FIFO配对计算
    stockMap.forEach((stock, code) => {
        stock.buys.sort((a, b) => a.trade_date.localeCompare(b.trade_date));
        stock.sells.sort((a, b) => a.trade_date.localeCompare(b.trade_date));

        let buyIndex = 0;
        let sellIndex = 0;
        let buyRemaining = 0;
        let sellRemaining = 0; // 新增：追踪卖出剩余数量，不修改原始数据

        while (buyIndex < stock.buys.length && sellIndex < stock.sells.length) {
            const buy = stock.buys[buyIndex];
            const sell = stock.sells[sellIndex];

            if (buyRemaining === 0) {
                buyRemaining = buy.quantity;
            }
            if (sellRemaining === 0) {
                sellRemaining = sell.quantity;
            }

            const matchQty = Math.min(buyRemaining, sellRemaining);
            const buyValue = matchQty * buy.price;
            const sellValue = matchQty * sell.price;

            // 按比例分摊手续费
            const buyFeeShare = (buy.fee || 0) * (matchQty / buy.quantity);
            const sellFeeShare = (sell.fee || 0) * (matchQty / sell.quantity);

            const profit = sellValue - buyValue - buyFeeShare - sellFeeShare;
            const profitRate = buyValue > 0 ? (profit / buyValue) * 100 : 0;

            console.log(`计算盈亏: ${code}, matchQty=${matchQty}, buyValue=${buyValue}, sellValue=${sellValue}, buyFeeShare=${buyFeeShare}, sellFeeShare=${sellFeeShare}, profit=${profit}`);

            realizedTrades.push({
                stockCode: code,
                stockName: buy.stock_name,
                buyDate: buy.trade_date,
                sellDate: sell.trade_date,
                quantity: matchQty,
                buyPrice: buy.price,
                sellPrice: sell.price,
                profit,
                profitRate
            });

            totalProfit += profit;
            if (profit > 0) profitableCount++;
            else if (profit < 0) lossCount++;

            buyRemaining -= matchQty;
            sellRemaining -= matchQty;

            if (buyRemaining === 0) buyIndex++;
            if (sellRemaining === 0) sellIndex++;
        }
    });

    return {
        trades: realizedTrades.sort((a, b) => b.sellDate.localeCompare(a.sellDate)),
        totalProfit,
        profitCount: profitableCount,
        lossCount,
        avgProfit: realizedTrades.length > 0 ? totalProfit / realizedTrades.length : 0
    };
}

/**
 * 计算未实现盈亏（当前持仓）
 */
function calculateUnrealizedProfitLoss(positions) {
    const unrealizedPositions = positions.map(pos => {
        const profit = (pos.currentPrice - pos.costPrice) * pos.quantity;
        const profitRate = pos.costPrice > 0 ? ((pos.currentPrice - pos.costPrice) / pos.costPrice) * 100 : 0;

        return {
            stockCode: pos.stockCode,
            stockName: pos.stockName,
            quantity: pos.quantity,
            costPrice: pos.costPrice,
            currentPrice: pos.currentPrice,
            profit,
            profitRate
        };
    });

    const totalProfit = unrealizedPositions.reduce((sum, p) => sum + p.profit, 0);
    const profitableCount = unrealizedPositions.filter(p => p.profit > 0).length;
    const lossCount = unrealizedPositions.filter(p => p.profit < 0).length;

    return {
        positions: unrealizedPositions.sort((a, b) => b.profitRate - a.profitRate),
        totalProfit,
        profitCount: profitableCount,
        lossCount,
        avgProfit: unrealizedPositions.length > 0 ? totalProfit / unrealizedPositions.length : 0
    };
}

/**
 * 计算收益率曲线
 */
function calculateProfitCurve(trades, positions) {
    console.log('=== calculateProfitCurve 调试 ===');
    console.log('trades 数量:', trades.length);
    console.log('positions 数量:', positions.length);

    // 按日期计算累计盈亏
    const dateMap = new Map();

    // 先处理已实现的盈亏
    const realized = calculateRealizedProfitLoss(trades);
    console.log('已实现交易数量:', realized.trades.length);
    console.log('已实现总盈亏:', realized.totalProfit);

    realized.trades.forEach(trade => {
        const date = trade.sellDate;
        if (!dateMap.has(date)) {
            dateMap.set(date, { date, realizedProfit: 0, totalProfit: 0 });
        }
        dateMap.get(date).realizedProfit += trade.profit;
    });

    // 按日期排序并计算累计
    const sortedDates = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    let cumulativeProfit = 0;

    const curveData = sortedDates.map(item => {
        cumulativeProfit += item.realizedProfit;
        return {
            date: item.date,
            profit: item.realizedProfit,
            cumulativeProfit
        };
    });

    console.log('curveData (已实现):', JSON.stringify(curveData, null, 2));

    // 添加当前未实现盈亏
    const unrealized = calculateUnrealizedProfitLoss(positions);
    console.log('未实现盈亏:', unrealized.totalProfit);

    const today = new Date().toISOString().split('T')[0];
    const unrealizedPoint = {
        date: today,
        profit: unrealized.totalProfit,
        cumulativeProfit: cumulativeProfit + unrealized.totalProfit,
        isUnrealized: true
    };
    console.log('未实现盈亏点:', JSON.stringify(unrealizedPoint, null, 2));

    curveData.push(unrealizedPoint);

    console.log('最终 curveData:', JSON.stringify(curveData, null, 2));
    console.log('=== calculateProfitCurve 调试结束 ===');

    return curveData;
}

/**
 * 计算盈亏分布
 */
function calculateProfitDistribution(profitLossItems) {
    console.log('=== calculateProfitDistribution 调试 ===');
    console.log('profitLossItems 数量:', profitLossItems.length);
    console.log('profitLossItems 盈亏率:', profitLossItems.map(i => i.profitRate));

    // 定义盈亏区间
    const ranges = [
        { label: '亏损>20%', min: -Infinity, max: -20, count: 0, items: [] },
        { label: '亏损10-20%', min: -20, max: -10, count: 0, items: [] },
        { label: '亏损5-10%', min: -10, max: -5, count: 0, items: [] },
        { label: '亏损0-5%', min: -5, max: 0, count: 0, items: [] },
        { label: '盈利0-5%', min: 0, max: 5, count: 0, items: [] },
        { label: '盈利5-10%', min: 5, max: 10, count: 0, items: [] },
        { label: '盈利10-20%', min: 10, max: 20, count: 0, items: [] },
        { label: '盈利>20%', min: 20, max: Infinity, count: 0, items: [] }
    ];

    profitLossItems.forEach(item => {
        const profitRate = item.profitRate;
        let matched = false;

        for (let i = 0; i < ranges.length; i++) {
            const range = ranges[i];
            let inRange = false;

            // 第一个区间：亏损>20% (profitRate < -20)
            if (i === 0) {
                inRange = profitRate < range.max;
            }
            // 最后一个区间：盈利>20% (profitRate >= 20)
            else if (i === ranges.length - 1) {
                inRange = profitRate >= range.min;
            }
            // 中间区间：左闭右开 [min, max)
            else {
                inRange = profitRate >= range.min && profitRate < range.max;
            }

            if (inRange) {
                range.count++;
                range.items.push(item);
                matched = true;
                console.log(`盈亏率 ${profitRate.toFixed(2)}% 归入区间: ${range.label}`);
                break;
            }
        }

        if (!matched) {
            console.warn(`警告：盈亏率 ${profitRate} 未匹配任何区间！`);
        }
    });

    const result = ranges.map(r => ({
        label: r.label,
        count: r.count,
        percentage: profitLossItems.length > 0 ? (r.count / profitLossItems.length) * 100 : 0
    }));

    console.log('盈亏分布结果:', JSON.stringify(result, null, 2));
    console.log('=== calculateProfitDistribution 调试结束 ===');

    return result;
}

/**
 * 获取月度报表数据
 */
async function getMonthlyReport(req, res) {
    try {
        const userId = req.user.id;

        // 1. 获取所有交易记录
        const trades = db.prepare(`
            SELECT * FROM trade_operations
            WHERE user_id = ?
            ORDER BY trade_date ASC
        `).all(userId);

        // 2. 获取当前持仓
        const positions = db.prepare(`
            SELECT
                stock_code as stockCode,
                stock_name as stockName,
                quantity,
                cost_price as costPrice,
                current_price as currentPrice,
                market_value as marketValue,
                profit_loss as profitLoss,
                profit_loss_rate as profitLossRate
            FROM positions WHERE user_id = ?
        `).all(userId);

        // 3. 计算月度收益统计
        const monthlyProfit = calculateMonthlyProfit(trades, positions);

        // 4. 计算月度交易次数
        const monthlyTrades = calculateMonthlyTrades(trades);

        // 5. 计算月度盈亏对比
        const monthlyComparison = calculateMonthlyComparison(monthlyProfit);

        // 6. 找出最佳/最差月份
        const bestWorstMonths = findBestWorstMonths(monthlyProfit);

        // 7. 月度操作回顾
        const monthlyReview = calculateMonthlyReview(trades, monthlyProfit);

        res.json({
            success: true,
            data: {
                monthlyProfit,
                monthlyTrades,
                monthlyComparison,
                bestWorstMonths,
                monthlyReview
            }
        });

    } catch (error) {
        console.error('获取月度报表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取月度报表失败',
            error: error.message
        });
    }
}

/**
 * 计算月度收益统计
 */
function calculateMonthlyProfit(trades, positions) {
    const monthlyData = new Map();

    // 1. 计算已实现盈亏（基于卖出交易）
    const realized = calculateRealizedProfitLoss(trades);
    realized.trades.forEach(trade => {
        const month = trade.sellDate.substring(0, 7); // YYYY-MM
        if (!monthlyData.has(month)) {
            monthlyData.set(month, {
                month,
                realizedProfit: 0,
                unrealizedProfit: 0,
                totalProfit: 0,
                tradeCount: 0,
                profitableTrades: 0,
                lossTrades: 0
            });
        }
        const data = monthlyData.get(month);
        data.realizedProfit += trade.profit;
        data.tradeCount++;
        if (trade.profit > 0) data.profitableTrades++;
        else if (trade.profit < 0) data.lossTrades++;
    });

    // 2. 将未实现盈亏添加到当前月
    const currentMonth = new Date().toISOString().substring(0, 7);
    const unrealized = calculateUnrealizedProfitLoss(positions);
    if (!monthlyData.has(currentMonth)) {
        monthlyData.set(currentMonth, {
            month: currentMonth,
            realizedProfit: 0,
            unrealizedProfit: 0,
            totalProfit: 0,
            tradeCount: 0,
            profitableTrades: 0,
            lossTrades: 0
        });
    }
    monthlyData.get(currentMonth).unrealizedProfit = unrealized.totalProfit;

    // 3. 计算总盈亏
    monthlyData.forEach(data => {
        data.totalProfit = data.realizedProfit + data.unrealizedProfit;
    });

    // 4. 按月份排序
    return Array.from(monthlyData.values()).sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * 计算月度交易次数
 */
function calculateMonthlyTrades(trades) {
    const monthlyData = new Map();

    trades.forEach(trade => {
        const month = trade.trade_date.substring(0, 7);
        if (!monthlyData.has(month)) {
            monthlyData.set(month, {
                month,
                totalTrades: 0,
                buyTrades: 0,
                sellTrades: 0,
                buyAmount: 0,
                sellAmount: 0,
                totalFees: 0,
                stocks: new Set()
            });
        }
        const data = monthlyData.get(month);
        data.totalTrades++;
        data.totalFees += trade.fee || 0;
        data.stocks.add(trade.stock_code);

        if (trade.trade_type === 'buy') {
            data.buyTrades++;
            data.buyAmount += trade.amount;
        } else {
            data.sellTrades++;
            data.sellAmount += trade.amount;
        }
    });

    return Array.from(monthlyData.values())
        .map(data => ({
            ...data,
            stockCount: data.stocks.size,
            stocks: undefined // 移除Set对象
        }))
        .sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * 计算月度盈亏对比
 */
function calculateMonthlyComparison(monthlyProfit) {
    if (monthlyProfit.length < 2) {
        return [];
    }

    const comparisons = [];
    for (let i = 0; i < monthlyProfit.length - 1; i++) {
        const current = monthlyProfit[i];
        const previous = monthlyProfit[i + 1];

        const profitChange = current.totalProfit - previous.totalProfit;
        const profitChangeRate = previous.totalProfit !== 0
            ? (profitChange / Math.abs(previous.totalProfit)) * 100
            : 0;

        comparisons.push({
            currentMonth: current.month,
            previousMonth: previous.month,
            currentProfit: current.totalProfit,
            previousProfit: previous.totalProfit,
            profitChange,
            profitChangeRate,
            trend: profitChange > 0 ? 'up' : profitChange < 0 ? 'down' : 'flat'
        });
    }

    return comparisons;
}

/**
 * 找出最佳/最差月份
 */
function findBestWorstMonths(monthlyProfit) {
    if (monthlyProfit.length === 0) {
        return {
            bestMonth: null,
            worstMonth: null
        };
    }

    let bestMonth = monthlyProfit[0];
    let worstMonth = monthlyProfit[0];

    monthlyProfit.forEach(data => {
        if (data.totalProfit > bestMonth.totalProfit) {
            bestMonth = data;
        }
        if (data.totalProfit < worstMonth.totalProfit) {
            worstMonth = data;
        }
    });

    return {
        bestMonth: {
            month: bestMonth.month,
            profit: bestMonth.totalProfit,
            tradeCount: bestMonth.tradeCount,
            profitableTrades: bestMonth.profitableTrades,
            successRate: bestMonth.tradeCount > 0 ? (bestMonth.profitableTrades / bestMonth.tradeCount) * 100 : 0
        },
        worstMonth: {
            month: worstMonth.month,
            profit: worstMonth.totalProfit,
            tradeCount: worstMonth.tradeCount,
            profitableTrades: worstMonth.profitableTrades,
            lossTrades: worstMonth.lossTrades,
            lossRate: worstMonth.tradeCount > 0 ? (worstMonth.lossTrades / worstMonth.tradeCount) * 100 : 0
        }
    };
}

/**
 * 计算月度操作回顾
 */
function calculateMonthlyReview(trades, monthlyProfit) {
    console.log('=== calculateMonthlyReview 调试 ===');
    console.log('monthlyProfit 数量:', monthlyProfit.length);
    console.log('monthlyProfit 数据:', JSON.stringify(monthlyProfit, null, 2));

    const reviews = monthlyProfit.map(data => {
        // 获取该月的所有交易
        const monthTrades = trades.filter(t => t.trade_date.startsWith(data.month));

        // 按股票分组
        const stockStats = new Map();
        monthTrades.forEach(trade => {
            const code = trade.stock_code;
            if (!stockStats.has(code)) {
                stockStats.set(code, {
                    stockCode: code,
                    stockName: trade.stock_name,
                    buyCount: 0,
                    sellCount: 0,
                    buyAmount: 0,
                    sellAmount: 0
                });
            }
            const stats = stockStats.get(code);
            if (trade.trade_type === 'buy') {
                stats.buyCount++;
                stats.buyAmount += trade.amount;
            } else {
                stats.sellCount++;
                stats.sellAmount += trade.amount;
            }
        });

        // 找出最活跃的股票
        const mostActiveStock = Array.from(stockStats.values())
            .sort((a, b) => (b.buyCount + b.sellCount) - (a.buyCount + a.sellCount))[0] || null;

        return {
            month: data.month,
            totalProfit: data.totalProfit,
            tradeCount: monthTrades.length,
            stockCount: stockStats.size,
            mostActiveStock,
            summary: {
                profitableTrades: data.profitableTrades,
                lossTrades: data.lossTrades,
                successRate: data.tradeCount > 0 ? (data.profitableTrades / data.tradeCount) * 100 : 0
            }
        };
    });

    const sortedReviews = reviews.sort((a, b) => b.month.localeCompare(a.month));
    console.log('返回的 reviews 数量:', sortedReviews.length);
    console.log('返回的 reviews 月份:', sortedReviews.map(r => r.month));
    console.log('=== calculateMonthlyReview 调试结束 ===');

    return sortedReviews;
}

/**
 * 获取年度报表数据
 */
async function getYearlyReport(req, res) {
    try {
        const userId = req.user.id;
        const { year } = req.query;

        // 如果没有指定年份，使用当前年份
        const targetYear = year || new Date().getFullYear().toString();

        // 1. 获取该年度的所有交易记录
        const trades = db.prepare(`
            SELECT * FROM trade_operations
            WHERE user_id = ?
            AND strftime('%Y', trade_date) = ?
            ORDER BY trade_date ASC
        `).all(userId, targetYear);

        // 2. 获取当前持仓（仅当查询当前年度时需要）
        const currentYear = new Date().getFullYear().toString();
        const positions = targetYear === currentYear ? db.prepare(`
            SELECT
                stock_code as stockCode,
                stock_name as stockName,
                quantity,
                cost_price as costPrice,
                current_price as currentPrice,
                market_value as marketValue,
                profit_loss as profitLoss,
                profit_loss_rate as profitLossRate
            FROM positions WHERE user_id = ?
        `).all(userId) : [];

        // 3. 年度收益总结
        const yearlySummary = calculateYearlySummary(trades, positions);

        // 4. 年度交易统计
        const yearlyTrades = calculateYearlyTrades(trades);

        // 5. 年度盈亏分析
        const yearlyProfitLoss = calculateYearlyProfitLoss(trades, positions);

        // 6. 最佳/最差操作
        const bestWorstTrades = findBestWorstTrades(trades);

        // 7. 年度投资回顾
        const yearlyReview = calculateYearlyReview(trades, yearlySummary);

        // 8. 获取所有年份列表（用于年份选择）
        const allYears = db.prepare(`
            SELECT DISTINCT strftime('%Y', trade_date) as year
            FROM trade_operations
            WHERE user_id = ?
            ORDER BY year DESC
        `).all(userId).map(row => row.year);

        res.json({
            success: true,
            data: {
                year: targetYear,
                yearlySummary,
                yearlyTrades,
                yearlyProfitLoss,
                bestWorstTrades,
                yearlyReview,
                availableYears: allYears
            }
        });

    } catch (error) {
        console.error('获取年度报表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取年度报表失败',
            error: error.message
        });
    }
}

/**
 * 计算年度收益总结
 */
function calculateYearlySummary(trades, positions) {
    // 计算已实现盈亏
    const realized = calculateRealizedProfitLoss(trades);

    // 计算未实现盈亏（仅当有持仓数据时）
    const unrealized = positions.length > 0 ? calculateUnrealizedProfitLoss(positions) : {
        totalProfit: 0,
        profitCount: 0,
        lossCount: 0,
        positions: []
    };

    // 计算总投入和总产出
    const totalInvestment = trades
        .filter(t => t.trade_type === 'buy')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalRevenue = trades
        .filter(t => t.trade_type === 'sell')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalFees = trades.reduce((sum, t) => sum + (t.fee || 0), 0);

    // 总收益 = 已实现收益 + 未实现收益
    const totalProfit = realized.totalProfit + unrealized.totalProfit;

    // 收益率 = (总收益 / 总投入) * 100
    const returnRate = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

    return {
        totalProfit,
        realizedProfit: realized.totalProfit,
        unrealizedProfit: unrealized.totalProfit,
        totalInvestment,
        totalRevenue,
        totalFees,
        returnRate,
        profitableTrades: realized.profitCount + unrealized.profitCount,
        lossTrades: realized.lossCount + unrealized.lossCount,
        successRate: (realized.trades.length > 0)
            ? (realized.profitCount / realized.trades.length) * 100
            : 0
    };
}

/**
 * 计算年度交易统计
 */
function calculateYearlyTrades(trades) {
    const buyTrades = trades.filter(t => t.trade_type === 'buy');
    const sellTrades = trades.filter(t => t.trade_type === 'sell');

    const buyAmount = buyTrades.reduce((sum, t) => sum + t.amount, 0);
    const sellAmount = sellTrades.reduce((sum, t) => sum + t.amount, 0);
    const totalFees = trades.reduce((sum, t) => sum + (t.fee || 0), 0);

    // 按股票统计
    const stockMap = new Map();
    trades.forEach(trade => {
        const code = trade.stock_code;
        if (!stockMap.has(code)) {
            stockMap.set(code, {
                stockCode: code,
                stockName: trade.stock_name,
                buyCount: 0,
                sellCount: 0,
                buyQuantity: 0,
                sellQuantity: 0,
                buyAmount: 0,
                sellAmount: 0,
                fees: 0
            });
        }
        const stock = stockMap.get(code);
        if (trade.trade_type === 'buy') {
            stock.buyCount++;
            stock.buyQuantity += trade.quantity;
            stock.buyAmount += trade.amount;
        } else {
            stock.sellCount++;
            stock.sellQuantity += trade.quantity;
            stock.sellAmount += trade.amount;
        }
        stock.fees += trade.fee || 0;
    });

    // 按月份统计
    const monthlyMap = new Map();
    trades.forEach(trade => {
        const month = trade.trade_date.substring(5, 7); // MM
        if (!monthlyMap.has(month)) {
            monthlyMap.set(month, {
                month: parseInt(month),
                monthName: `${month}月`,
                count: 0,
                buyCount: 0,
                sellCount: 0,
                amount: 0
            });
        }
        const monthly = monthlyMap.get(month);
        monthly.count++;
        monthly.amount += trade.amount;
        if (trade.trade_type === 'buy') {
            monthly.buyCount++;
        } else {
            monthly.sellCount++;
        }
    });

    return {
        totalTrades: trades.length,
        buyCount: buyTrades.length,
        sellCount: sellTrades.length,
        buyAmount,
        sellAmount,
        totalAmount: buyAmount + sellAmount,
        totalFees,
        avgTradeAmount: trades.length > 0 ? (buyAmount + sellAmount) / trades.length : 0,
        stockCount: stockMap.size,
        byStock: Array.from(stockMap.values())
            .sort((a, b) => (b.buyAmount + b.sellAmount) - (a.buyAmount + a.sellAmount)),
        byMonth: Array.from(monthlyMap.values())
            .sort((a, b) => a.month - b.month),
        mostActiveMonth: Array.from(monthlyMap.values())
            .sort((a, b) => b.count - a.count)[0] || null
    };
}

/**
 * 计算年度盈亏分析
 */
function calculateYearlyProfitLoss(trades, positions) {
    // 已实现盈亏
    const realized = calculateRealizedProfitLoss(trades);

    // 未实现盈亏
    const unrealized = positions.length > 0 ? calculateUnrealizedProfitLoss(positions) : {
        totalProfit: 0,
        profitCount: 0,
        lossCount: 0,
        positions: []
    };

    // 盈亏分布
    const allProfitLossItems = [
        ...realized.trades,
        ...unrealized.positions
    ];
    const profitDistribution = calculateProfitDistribution(allProfitLossItems);

    // 按月份的盈亏统计
    const monthlyProfitMap = new Map();
    realized.trades.forEach(trade => {
        const month = trade.sellDate.substring(5, 7);
        if (!monthlyProfitMap.has(month)) {
            monthlyProfitMap.set(month, {
                month: parseInt(month),
                monthName: `${month}月`,
                profit: 0,
                count: 0,
                profitableCount: 0,
                lossCount: 0
            });
        }
        const monthly = monthlyProfitMap.get(month);
        monthly.profit += trade.profit;
        monthly.count++;
        if (trade.profit > 0) {
            monthly.profitableCount++;
        } else if (trade.profit < 0) {
            monthly.lossCount++;
        }
    });

    return {
        totalProfit: realized.totalProfit + unrealized.totalProfit,
        realizedProfit: realized.totalProfit,
        unrealizedProfit: unrealized.totalProfit,
        profitableCount: realized.profitCount + unrealized.profitCount,
        lossCount: realized.lossCount + unrealized.lossCount,
        profitDistribution,
        byMonth: Array.from(monthlyProfitMap.values())
            .sort((a, b) => a.month - b.month),
        topProfitTrades: realized.trades
            .filter(t => t.profit > 0)
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 10),
        topLossTrades: realized.trades
            .filter(t => t.profit < 0)
            .sort((a, b) => a.profit - b.profit)
            .slice(0, 10)
    };
}

/**
 * 找出最佳/最差操作
 */
function findBestWorstTrades(trades) {
    const realized = calculateRealizedProfitLoss(trades);

    if (realized.trades.length === 0) {
        return {
            bestTrade: null,
            worstTrade: null,
            bestProfitRate: null,
            worstProfitRate: null,
            longestHold: null,
            shortestHold: null
        };
    }

    // 最高收益交易
    const bestTrade = realized.trades.reduce((max, trade) =>
        trade.profit > max.profit ? trade : max
    );

    // 最大亏损交易
    const worstTrade = realized.trades.reduce((min, trade) =>
        trade.profit < min.profit ? trade : min
    );

    // 最高收益率交易
    const bestProfitRate = realized.trades.reduce((max, trade) =>
        trade.profitRate > max.profitRate ? trade : max
    );

    // 最低收益率交易
    const worstProfitRate = realized.trades.reduce((min, trade) =>
        trade.profitRate < min.profitRate ? trade : min
    );

    // 计算持有时间并找出最长/最短持有
    const tradesWithHoldDays = realized.trades.map(trade => {
        const buyDate = new Date(trade.buyDate);
        const sellDate = new Date(trade.sellDate);
        const holdDays = Math.floor((sellDate - buyDate) / (1000 * 60 * 60 * 24));
        return { ...trade, holdDays };
    });

    const longestHold = tradesWithHoldDays.reduce((max, trade) =>
        trade.holdDays > max.holdDays ? trade : max
    );

    const shortestHold = tradesWithHoldDays.reduce((min, trade) =>
        trade.holdDays < min.holdDays ? trade : min
    );

    return {
        bestTrade,
        worstTrade,
        bestProfitRate,
        worstProfitRate,
        longestHold,
        shortestHold
    };
}

/**
 * 计算年度投资回顾
 */
function calculateYearlyReview(trades, yearlySummary) {
    // 按季度统计
    const quarterMap = new Map([
        ['Q1', { quarter: 'Q1', name: '第一季度', months: ['01', '02', '03'], profit: 0, trades: 0, stocks: new Set() }],
        ['Q2', { quarter: 'Q2', name: '第二季度', months: ['04', '05', '06'], profit: 0, trades: 0, stocks: new Set() }],
        ['Q3', { quarter: 'Q3', name: '第三季度', months: ['07', '08', '09'], profit: 0, trades: 0, stocks: new Set() }],
        ['Q4', { quarter: 'Q4', name: '第四季度', months: ['10', '11', '12'], profit: 0, trades: 0, stocks: new Set() }]
    ]);

    const realized = calculateRealizedProfitLoss(trades);

    // 统计每个季度的数据
    trades.forEach(trade => {
        const month = trade.trade_date.substring(5, 7);
        for (const [q, data] of quarterMap) {
            if (data.months.includes(month)) {
                data.trades++;
                data.stocks.add(trade.stock_code);
                break;
            }
        }
    });

    realized.trades.forEach(trade => {
        const month = trade.sellDate.substring(5, 7);
        for (const [q, data] of quarterMap) {
            if (data.months.includes(month)) {
                data.profit += trade.profit;
                break;
            }
        }
    });

    // 转换为数组并移除Set对象
    const quarterlyData = Array.from(quarterMap.values()).map(q => ({
        quarter: q.quarter,
        name: q.name,
        profit: q.profit,
        trades: q.trades,
        stockCount: q.stocks.size,
        avgProfit: q.trades > 0 ? q.profit / q.trades : 0
    }));

    // 找出最活跃的股票
    const stockActivityMap = new Map();
    trades.forEach(trade => {
        const code = trade.stock_code;
        if (!stockActivityMap.has(code)) {
            stockActivityMap.set(code, {
                stockCode: code,
                stockName: trade.stock_name,
                tradeCount: 0,
                totalAmount: 0,
                profit: 0
            });
        }
        const stock = stockActivityMap.get(code);
        stock.tradeCount++;
        stock.totalAmount += trade.amount;
    });

    // 添加盈亏数据
    realized.trades.forEach(trade => {
        if (stockActivityMap.has(trade.stockCode)) {
            stockActivityMap.get(trade.stockCode).profit += trade.profit;
        }
    });

    const mostActiveStocks = Array.from(stockActivityMap.values())
        .sort((a, b) => b.tradeCount - a.tradeCount)
        .slice(0, 10);

    return {
        quarterly: quarterlyData,
        mostActiveStocks,
        summary: {
            totalProfit: yearlySummary.totalProfit,
            returnRate: yearlySummary.returnRate,
            successRate: yearlySummary.successRate,
            totalTrades: trades.length,
            stockCount: stockActivityMap.size
        },
        bestQuarter: quarterlyData.reduce((max, q) => q.profit > max.profit ? q : max),
        worstQuarter: quarterlyData.reduce((min, q) => q.profit < min.profit ? q : min)
    };
}

module.exports = {
    getPositionReport,
    getTradeReport,
    getProfitLossReport,
    getMonthlyReport,
    getYearlyReport
};
