const { positionModel, tradeOperationModel, positionCostRecordModel } = require('../database');

/**
 * 盈亏分析控制器
 * 提供各种盈亏分析功能
 */

/**
 * 获取用户的总体盈亏统计
 */
async function getOverallProfitStats(req, res) {
    try {
        const userId = req.user.id;

        // 1. 获取当前持仓（未实现盈亏）
        const positions = await positionModel.findByUserId(userId);

        // 计算未实现盈亏
        let unrealizedProfit = 0;
        let unrealizedLoss = 0;
        let totalMarketValue = 0;
        let totalCost = 0;

        positions.forEach(pos => {
            const profitLoss = pos.profitLoss || 0;
            totalMarketValue += pos.marketValue || 0;
            totalCost += pos.quantity * pos.costPrice;

            if (profitLoss > 0) {
                unrealizedProfit += profitLoss;
            } else {
                unrealizedLoss += Math.abs(profitLoss);
            }
        });

        const unrealizedTotal = unrealizedProfit - unrealizedLoss;
        const unrealizedRate = totalCost > 0 ? (unrealizedTotal / totalCost * 100) : 0;

        // 2. 获取所有交易记录计算已实现盈亏
        const trades = await tradeOperationModel.findByUserId(userId, 10000, 0);

        // 按股票分组计算已实现盈亏
        const stockTrades = {};
        trades.forEach(trade => {
            if (!stockTrades[trade.stock_code]) {
                stockTrades[trade.stock_code] = {
                    stockCode: trade.stock_code,
                    stockName: trade.stock_name,
                    buyTrades: [],
                    sellTrades: []
                };
            }

            if (trade.trade_type === 'buy' || trade.trade_type === 'add') {
                stockTrades[trade.stock_code].buyTrades.push(trade);
            } else if (trade.trade_type === 'sell' || trade.trade_type === 'reduce') {
                stockTrades[trade.stock_code].sellTrades.push(trade);
            }
        });

        // 计算已实现盈亏（简化算法：FIFO先进先出）
        let realizedProfit = 0;
        let realizedLoss = 0;

        Object.values(stockTrades).forEach(stock => {
            let buyQueue = stock.buyTrades.map(t => ({
                price: t.price,
                quantity: t.quantity,
                amount: t.amount,
                fee: t.fee || 0,
                date: t.trade_date
            })).sort((a, b) => new Date(a.date) - new Date(b.date));

            stock.sellTrades.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));

            stock.sellTrades.forEach(sell => {
                let remainingQty = sell.quantity;
                const sellPrice = sell.price;
                const sellFee = sell.fee || 0;
                const sellPricePerShare = (sell.amount + sellFee) / sell.quantity;

                while (remainingQty > 0 && buyQueue.length > 0) {
                    const buy = buyQueue[0];
                    const matchedQty = Math.min(remainingQty, buy.quantity);

                    const buyPricePerShare = (buy.amount + buy.fee) / buy.quantity;
                    const profitLoss = (sellPricePerShare - buyPricePerShare) * matchedQty;

                    if (profitLoss > 0) {
                        realizedProfit += profitLoss;
                    } else {
                        realizedLoss += Math.abs(profitLoss);
                    }

                    buy.quantity -= matchedQty;
                    remainingQty -= matchedQty;

                    if (buy.quantity <= 0) {
                        buyQueue.shift();
                    }
                }
            });
        });

        const realizedTotal = realizedProfit - realizedLoss;

        // 3. 计算总盈亏
        const totalProfit = unrealizedProfit + realizedProfit;
        const totalLoss = unrealizedLoss + realizedLoss;
        const totalProfitLoss = realizedTotal + unrealizedTotal;
        const totalInvestment = totalCost + calculateTotalInvestedFromSells(trades);
        const totalReturn = totalInvestment > 0 ? (totalProfitLoss / totalInvestment * 100) : 0;

        // 4. 统计盈亏股票数量
        let profitStocks = 0;
        let lossStocks = 0;
        let flatStocks = 0;

        positions.forEach(pos => {
            if ((pos.profitLoss || 0) > 0) profitStocks++;
            else if ((pos.profitLoss || 0) < 0) lossStocks++;
            else flatStocks++;
        });

        res.json({
            success: true,
            data: {
                // 总体统计
                overview: {
                    totalProfitLoss,
                    totalReturn: parseFloat(totalReturn.toFixed(2)),
                    totalInvestment: parseFloat(totalInvestment.toFixed(2)),
                    totalProfit: parseFloat(totalProfit.toFixed(2)),
                    totalLoss: parseFloat(totalLoss.toFixed(2))
                },
                // 已实现盈亏
                realized: {
                    profit: parseFloat(realizedProfit.toFixed(2)),
                    loss: parseFloat(realizedLoss.toFixed(2)),
                    total: parseFloat(realizedTotal.toFixed(2))
                },
                // 未实现盈亏
                unrealized: {
                    profit: parseFloat(unrealizedProfit.toFixed(2)),
                    loss: parseFloat(unrealizedLoss.toFixed(2)),
                    total: parseFloat(unrealizedTotal.toFixed(2)),
                    rate: parseFloat(unrealizedRate.toFixed(2)),
                    marketValue: parseFloat(totalMarketValue.toFixed(2)),
                    cost: parseFloat(totalCost.toFixed(2))
                },
                // 持仓统计
                positionStats: {
                    total: positions.length,
                    profit: profitStocks,
                    loss: lossStocks,
                    flat: flatStocks,
                    profitRate: positions.length > 0 ? parseFloat((profitStocks / positions.length * 100).toFixed(2)) : 0
                }
            }
        });

    } catch (error) {
        console.error('获取总体盈亏统计错误:', error);
        res.status(500).json({
            success: false,
            error: '获取盈亏统计失败: ' + error.message
        });
    }
}

/**
 * 获取按股票的盈亏明细
 */
async function getStockProfitDetails(req, res) {
    try {
        const userId = req.user.id;

        // 获取当前持仓
        const positions = await positionModel.findByUserId(userId);

        // 获取所有交易记录
        const trades = await tradeOperationModel.findByUserId(userId, 10000, 0);

        // 按股票分组
        const stockMap = {};

        // 先添加当前持仓
        positions.forEach(pos => {
            stockMap[pos.stockCode] = {
                stockCode: pos.stockCode,
                stockName: pos.stockName,
                currentPosition: {
                    quantity: pos.quantity,
                    costPrice: pos.costPrice,
                    currentPrice: pos.currentPrice,
                    marketValue: pos.marketValue,
                    profitLoss: pos.profitLoss,
                    profitLossRate: pos.profitLossRate
                },
                unrealizedProfitLoss: pos.profitLoss || 0,
                realizedProfitLoss: 0,
                totalProfitLoss: pos.profitLoss || 0,
                trades: []
            };
        });

        // 添加交易记录并计算已实现盈亏
        const stockTrades = {};
        trades.forEach(trade => {
            if (!stockTrades[trade.stock_code]) {
                stockTrades[trade.stock_code] = {
                    stockCode: trade.stock_code,
                    stockName: trade.stock_name,
                    buyTrades: [],
                    sellTrades: []
                };
            }

            if (trade.trade_type === 'buy' || trade.trade_type === 'add') {
                stockTrades[trade.stock_code].buyTrades.push(trade);
            } else if (trade.trade_type === 'sell' || trade.trade_type === 'reduce') {
                stockTrades[trade.stock_code].sellTrades.push(trade);
            }
        });

        // 计算每只股票的已实现盈亏
        Object.values(stockTrades).forEach(stock => {
            let buyQueue = stock.buyTrades.map(t => ({
                price: t.price,
                quantity: t.quantity,
                amount: t.amount,
                fee: t.fee || 0,
                date: t.trade_date
            })).sort((a, b) => new Date(a.date) - new Date(b.date));

            stock.sellTrades.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));

            let realizedPL = 0;

            stock.sellTrades.forEach(sell => {
                let remainingQty = sell.quantity;
                const sellPricePerShare = (sell.amount + (sell.fee || 0)) / sell.quantity;

                while (remainingQty > 0 && buyQueue.length > 0) {
                    const buy = buyQueue[0];
                    const matchedQty = Math.min(remainingQty, buy.quantity);

                    const buyPricePerShare = (buy.amount + buy.fee) / buy.quantity;
                    const profitLoss = (sellPricePerShare - buyPricePerShare) * matchedQty;

                    realizedPL += profitLoss;

                    buy.quantity -= matchedQty;
                    remainingQty -= matchedQty;

                    if (buy.quantity <= 0) {
                        buyQueue.shift();
                    }
                }
            });

            // 更新或创建股票记录
            if (!stockMap[stock.stockCode]) {
                stockMap[stock.stockCode] = {
                    stockCode: stock.stockCode,
                    stockName: stock.stockName,
                    currentPosition: null,
                    unrealizedProfitLoss: 0,
                    realizedProfitLoss: realizedPL,
                    totalProfitLoss: realizedPL,
                    trades: []
                };
            } else {
                stockMap[stock.stockCode].realizedProfitLoss = realizedPL;
                stockMap[stock.stockCode].totalProfitLoss += realizedPL;
            }
        });

        // 转换为数组并排序
        const stockDetails = Object.values(stockMap).map(stock => ({
            ...stock,
            unrealizedProfitLoss: parseFloat((stock.unrealizedProfitLoss || 0).toFixed(2)),
            realizedProfitLoss: parseFloat((stock.realizedProfitLoss || 0).toFixed(2)),
            totalProfitLoss: parseFloat((stock.totalProfitLoss || 0).toFixed(2))
        })).sort((a, b) => b.totalProfitLoss - a.totalProfitLoss);

        res.json({
            success: true,
            data: stockDetails,
            count: stockDetails.length
        });

    } catch (error) {
        console.error('获取股票盈亏明细错误:', error);
        res.status(500).json({
            success: false,
            error: '获取股票盈亏明细失败: ' + error.message
        });
    }
}

/**
 * 获取盈亏趋势数据（按日期）
 */
async function getProfitTrend(req, res) {
    try {
        const userId = req.user.id;
        const { startDate, endDate, period = 'day' } = req.query; // period: day, week, month

        // 获取所有交易记录
        const trades = await tradeOperationModel.findByUserId(userId, 10000, 0);

        // 按日期分组统计
        const dateMap = {};

        trades.forEach(trade => {
            const date = trade.trade_date;
            if (!dateMap[date]) {
                dateMap[date] = {
                    date,
                    buyAmount: 0,
                    sellAmount: 0,
                    buyCount: 0,
                    sellCount: 0
                };
            }

            if (trade.trade_type === 'buy' || trade.trade_type === 'add') {
                dateMap[date].buyAmount += trade.amount;
                dateMap[date].buyCount += 1;
            } else if (trade.trade_type === 'sell' || trade.trade_type === 'reduce') {
                dateMap[date].sellAmount += trade.amount;
                dateMap[date].sellCount += 1;
            }
        });

        // 转换为数组并排序
        let trendData = Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));

        // 计算累计盈亏
        let cumulativeProfit = 0;
        trendData = trendData.map(item => {
            const dailyProfit = item.sellAmount - item.buyAmount;
            cumulativeProfit += dailyProfit;

            return {
                ...item,
                dailyProfit: parseFloat(dailyProfit.toFixed(2)),
                cumulativeProfit: parseFloat(cumulativeProfit.toFixed(2))
            };
        });

        res.json({
            success: true,
            data: trendData,
            count: trendData.length
        });

    } catch (error) {
        console.error('获取盈亏趋势错误:', error);
        res.status(500).json({
            success: false,
            error: '获取盈亏趋势失败: ' + error.message
        });
    }
}

/**
 * 获取盈亏排名（最赚钱和最亏钱的股票）
 */
async function getProfitRanking(req, res) {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 10;

        // 获取股票盈亏明细
        const positions = await positionModel.findByUserId(userId);

        // 排序
        const sortedByProfit = [...positions].sort((a, b) => (b.profitLoss || 0) - (a.profitLoss || 0));

        const topProfits = sortedByProfit.slice(0, limit).map(pos => ({
            stockCode: pos.stockCode,
            stockName: pos.stockName,
            profitLoss: pos.profitLoss,
            profitLossRate: pos.profitLossRate,
            quantity: pos.quantity,
            costPrice: pos.costPrice,
            currentPrice: pos.currentPrice
        }));

        const topLosses = sortedByProfit.slice(-limit).reverse().map(pos => ({
            stockCode: pos.stockCode,
            stockName: pos.stockName,
            profitLoss: pos.profitLoss,
            profitLossRate: pos.profitLossRate,
            quantity: pos.quantity,
            costPrice: pos.costPrice,
            currentPrice: pos.currentPrice
        }));

        res.json({
            success: true,
            data: {
                topProfits,
                topLosses
            }
        });

    } catch (error) {
        console.error('获取盈亏排名错误:', error);
        res.status(500).json({
            success: false,
            error: '获取盈亏排名失败: ' + error.message
        });
    }
}

/**
 * 获取盈亏分布统计
 */
async function getProfitDistribution(req, res) {
    try {
        const userId = req.user.id;

        const positions = await positionModel.findByUserId(userId);

        // 按盈亏范围分组
        const distribution = {
            'loss_over_20': 0,     // 亏损超过20%
            'loss_10_to_20': 0,    // 亏损10%-20%
            'loss_5_to_10': 0,     // 亏损5%-10%
            'loss_0_to_5': 0,      // 亏损0%-5%
            'flat': 0,             // 持平
            'profit_0_to_5': 0,    // 盈利0%-5%
            'profit_5_to_10': 0,   // 盈利5%-10%
            'profit_10_to_20': 0,  // 盈利10%-20%
            'profit_over_20': 0    // 盈利超过20%
        };

        positions.forEach(pos => {
            const rate = pos.profitLossRate || 0;

            if (rate < -20) distribution['loss_over_20']++;
            else if (rate < -10) distribution['loss_10_to_20']++;
            else if (rate < -5) distribution['loss_5_to_10']++;
            else if (rate < 0) distribution['loss_0_to_5']++;
            else if (rate === 0) distribution['flat']++;
            else if (rate < 5) distribution['profit_0_to_5']++;
            else if (rate < 10) distribution['profit_5_to_10']++;
            else if (rate < 20) distribution['profit_10_to_20']++;
            else distribution['profit_over_20']++;
        });

        res.json({
            success: true,
            data: distribution
        });

    } catch (error) {
        console.error('获取盈亏分布错误:', error);
        res.status(500).json({
            success: false,
            error: '获取盈亏分布失败: ' + error.message
        });
    }
}

/**
 * 辅助函数：从卖出交易中计算总投入
 */
function calculateTotalInvestedFromSells(trades) {
    let totalInvested = 0;

    const buyTrades = trades.filter(t => t.trade_type === 'buy' || t.trade_type === 'add');
    buyTrades.forEach(trade => {
        totalInvested += trade.amount;
    });

    return totalInvested;
}

module.exports = {
    getOverallProfitStats,
    getStockProfitDetails,
    getProfitTrend,
    getProfitRanking,
    getProfitDistribution
};
