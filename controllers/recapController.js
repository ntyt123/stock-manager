/**
 * 每日复盘控制器
 */

const { db } = require('../database');
const axios = require('axios');
const iconv = require('iconv-lite');
const stockCache = require('../stockCache');

// 初始化：添加新的分析字段（如果不存在）
(() => {
    try {
        const columns = db.prepare('PRAGMA table_info(daily_recap)').all();
        const columnNames = columns.map(col => col.name);

        const newColumns = [
            ['call_auction_analysis', 'TEXT'],
            ['call_auction_analyzed_at', 'DATETIME'],
            ['portfolio_analysis', 'TEXT'],
            ['portfolio_analyzed_at', 'DATETIME'],
            ['fundamental_analysis_data', 'TEXT'],
            ['trend_analysis_data', 'TEXT'],
            ['trading_logs_data', 'TEXT'],
            ['daily_summary', 'TEXT'],
            ['daily_summary_at', 'DATETIME'],
            ['no_trading_today', 'BOOLEAN DEFAULT 0']
        ];

        for (const [colName, colType] of newColumns) {
            if (!columnNames.includes(colName)) {
                console.log(`添加字段: ${colName} ${colType}`);
                db.prepare(`ALTER TABLE daily_recap ADD COLUMN ${colName} ${colType}`).run();
            }
        }

        console.log('✅ daily_recap表字段检查完成');
    } catch (error) {
        console.error('❌ 添加daily_recap表字段失败:', error.message);
    }
})();

/**
 * 生成复盘数据
 */
async function generateRecapData(req, res) {
    try {
        const { date } = req.body;
        const recapDate = date || new Date().toISOString().split('T')[0];
        const userId = req.user.id;

        // 1. 获取市场数据
        const marketData = await getMarketData(recapDate);

        // 2. 获取持仓数据（使用最新数据）
        const positionData = await getPositionData(recapDate, userId);

        // 3. 获取交易数据
        const tradeData = await getTradeData(recapDate, userId);

        // 4. 获取计划数据
        const planData = await getPlanData(recapDate, userId);

        // 5. 获取交易日志
        const tradingLogs = await getTradingLogs(recapDate, userId);

        // 检查是否已存在（按用户和日期）
        const existing = db.prepare(
            'SELECT * FROM daily_recap WHERE recap_date = ? AND user_id = ?'
        ).get(recapDate, userId);

        if (existing) {
            // 更新现有记录，刷新持仓和盈亏数据
            db.prepare(`
                UPDATE daily_recap SET
                    market_data = ?,
                    position_data = ?,
                    today_profit = ?,
                    total_profit = ?,
                    position_count = ?,
                    rise_count = ?,
                    fall_count = ?,
                    flat_count = ?,
                    trade_data = ?,
                    trade_count = ?,
                    buy_count = ?,
                    sell_count = ?,
                    plan_data = ?,
                    plan_count = ?,
                    plan_completed = ?,
                    plan_execution_rate = ?,
                    trading_logs_data = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE recap_date = ? AND user_id = ?
            `).run(
                JSON.stringify(marketData),
                JSON.stringify(positionData.positions),
                positionData.todayProfit,
                positionData.totalProfit,
                positionData.count,
                positionData.riseCount,
                positionData.fallCount,
                positionData.flatCount,
                JSON.stringify(tradeData.trades),
                tradeData.count,
                tradeData.buyCount,
                tradeData.sellCount,
                JSON.stringify(planData.plans),
                planData.count,
                planData.completed,
                planData.executionRate,
                JSON.stringify(tradingLogs.logs),
                recapDate,
                userId
            );

            const recap = db.prepare(
                'SELECT * FROM daily_recap WHERE recap_date = ? AND user_id = ?'
            ).get(recapDate, userId);

            return res.json({
                success: true,
                message: '复盘数据已更新',
                data: recap
            });
        }

        // 插入新复盘记录
        const result = db.prepare(`
            INSERT INTO daily_recap (
                recap_date,
                user_id,
                market_data,
                position_data,
                today_profit,
                total_profit,
                position_count,
                rise_count,
                fall_count,
                flat_count,
                trade_data,
                trade_count,
                buy_count,
                sell_count,
                plan_data,
                plan_count,
                plan_completed,
                plan_execution_rate,
                trading_logs_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            recapDate,
            userId,
            JSON.stringify(marketData),
            JSON.stringify(positionData.positions),
            positionData.todayProfit,
            positionData.totalProfit,
            positionData.count,
            positionData.riseCount,
            positionData.fallCount,
            positionData.flatCount,
            JSON.stringify(tradeData.trades),
            tradeData.count,
            tradeData.buyCount,
            tradeData.sellCount,
            JSON.stringify(planData.plans),
            planData.count,
            planData.completed,
            planData.executionRate,
            JSON.stringify(tradingLogs.logs)
        );

        const recap = db.prepare(
            'SELECT * FROM daily_recap WHERE id = ?'
        ).get(result.lastInsertRowid);

        res.json({
            success: true,
            message: '复盘数据生成成功',
            data: recap
        });
    } catch (error) {
        console.error('生成复盘数据失败:', error);
        res.status(500).json({
            success: false,
            message: '生成复盘数据失败',
            error: error.message
        });
    }
}

/**
 * 调用AI分析
 */
async function analyzeWithAI(req, res) {
    try {
        const { recap_id } = req.body;

        // 获取复盘数据
        const recap = db.prepare(
            'SELECT * FROM daily_recap WHERE id = ?'
        ).get(recap_id);

        if (!recap) {
            return res.status(404).json({
                success: false,
                message: '复盘记录不存在'
            });
        }

        // 构建AI提示词
        const marketData = JSON.parse(recap.market_data || '{}');
        const positionData = JSON.parse(recap.position_data || '[]');
        const tradeData = JSON.parse(recap.trade_data || '[]');
        const planData = JSON.parse(recap.plan_data || '[]');
        const tradingLogsData = JSON.parse(recap.trading_logs_data || '[]');

        const prompt = buildAIPrompt({
            date: recap.recap_date,
            market: marketData,
            positions: positionData,
            trades: tradeData,
            plans: planData,
            tradingLogs: tradingLogsData,
            todayProfit: recap.today_profit,
            totalProfit: recap.total_profit
        });

        // 调用AI API（这里使用现有的AI配置）
        const aiConfig = db.prepare(`
            SELECT * FROM ai_api_configs
            WHERE is_active = 1
            ORDER BY is_default DESC, id ASC
            LIMIT 1
        `).get();

        if (!aiConfig) {
            return res.status(400).json({
                success: false,
                message: '未找到可用的AI配置，请先配置AI API'
            });
        }

        const analysis = await callAIAPI(aiConfig, prompt);

        // 更新复盘记录
        db.prepare(`
            UPDATE daily_recap
            SET ai_analysis = ?,
                ai_analyzed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(analysis, recap_id);

        res.json({
            success: true,
            message: 'AI分析完成',
            data: {
                analysis
            }
        });
    } catch (error) {
        console.error('AI分析失败:', error);
        res.status(500).json({
            success: false,
            message: 'AI分析失败',
            error: error.message
        });
    }
}

/**
 * 获取复盘状态
 */
async function getRecapStatus(req, res) {
    try {
        const { date } = req.query;
        const recapDate = date || new Date().toISOString().split('T')[0];
        const userId = req.user.id;

        // 实时查询最新数据（不使用缓存）
        console.log(`🔄 实时查询 ${recapDate} 的复盘数据...`);

        // 1. 获取市场数据
        const marketData = await getMarketData(recapDate);

        // 2. 获取持仓数据
        const positionData = await getPositionData(recapDate, userId);

        // 3. 获取交易数据
        const tradeData = await getTradeData(recapDate, userId);

        // 4. 获取计划数据
        const planData = await getPlanData(recapDate, userId);

        // 5. 获取交易日志
        const tradingLogs = await getTradingLogs(recapDate, userId);

        // 检查是否已有复盘记录
        const existing = db.prepare(
            'SELECT * FROM daily_recap WHERE recap_date = ?'
        ).get(recapDate);

        let recap;

        if (existing) {
            // 更新现有记录的数据部分（保留 AI 分析、用户笔记等）
            db.prepare(`
                UPDATE daily_recap SET
                    market_data = ?,
                    position_data = ?,
                    today_profit = ?,
                    total_profit = ?,
                    position_count = ?,
                    rise_count = ?,
                    fall_count = ?,
                    flat_count = ?,
                    trade_data = ?,
                    trade_count = ?,
                    buy_count = ?,
                    sell_count = ?,
                    plan_data = ?,
                    plan_count = ?,
                    plan_completed = ?,
                    plan_execution_rate = ?,
                    trading_logs_data = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                JSON.stringify(marketData),
                JSON.stringify(positionData.positions),
                positionData.todayProfit,
                positionData.totalProfit,
                positionData.count,
                positionData.riseCount,
                positionData.fallCount,
                positionData.flatCount,
                JSON.stringify(tradeData.trades),
                tradeData.count,
                tradeData.buyCount,
                tradeData.sellCount,
                JSON.stringify(planData.plans),
                planData.count,
                planData.completed,
                planData.executionRate,
                JSON.stringify(tradingLogs.logs),
                existing.id
            );

            // 重新读取更新后的数据
            recap = db.prepare(
                'SELECT * FROM daily_recap WHERE id = ?'
            ).get(existing.id);

            console.log(`✅ 已更新复盘数据，包含 ${tradingLogs.count} 条交易操作`);
        } else {
            // 创建新记录
            const result = db.prepare(`
                INSERT INTO daily_recap (
                    recap_date,
                    market_data,
                    position_data,
                    today_profit,
                    total_profit,
                    position_count,
                    rise_count,
                    fall_count,
                    flat_count,
                    trade_data,
                    trade_count,
                    buy_count,
                    sell_count,
                    plan_data,
                    plan_count,
                    plan_completed,
                    plan_execution_rate,
                    trading_logs_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                recapDate,
                JSON.stringify(marketData),
                JSON.stringify(positionData.positions),
                positionData.todayProfit,
                positionData.totalProfit,
                positionData.count,
                positionData.riseCount,
                positionData.fallCount,
                positionData.flatCount,
                JSON.stringify(tradeData.trades),
                tradeData.count,
                tradeData.buyCount,
                tradeData.sellCount,
                JSON.stringify(planData.plans),
                planData.count,
                planData.completed,
                planData.executionRate,
                JSON.stringify(tradingLogs.logs)
            );

            recap = db.prepare(
                'SELECT * FROM daily_recap WHERE id = ?'
            ).get(result.lastInsertRowid);

            console.log(`✅ 已创建复盘数据，包含 ${tradingLogs.count} 条交易操作`);
        }

        res.json({
            success: true,
            data: {
                has_recap: true,
                is_completed: recap.is_completed,
                recap_id: recap.id,
                recap: recap
            }
        });
    } catch (error) {
        console.error('获取复盘状态失败:', error);
        res.status(500).json({
            success: false,
            message: '获取复盘状态失败',
            error: error.message
        });
    }
}

/**
 * 保存用户笔记
 */
async function saveNotes(req, res) {
    try {
        const { recap_id, notes } = req.body;

        db.prepare(`
            UPDATE daily_recap
            SET user_notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(notes, recap_id);

        res.json({
            success: true,
            message: '笔记保存成功'
        });
    } catch (error) {
        console.error('保存笔记失败:', error);
        res.status(500).json({
            success: false,
            message: '保存笔记失败',
            error: error.message
        });
    }
}

/**
 * 标记复盘已完成
 */
async function markAsCompleted(req, res) {
    try {
        const { recap_id } = req.body;
        const userId = req.user.id;

        // 仅允许用户标记自己的复盘记录
        db.prepare(`
            UPDATE daily_recap
            SET is_completed = 1,
                completed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `).run(recap_id, userId);

        res.json({
            success: true,
            message: '复盘已标记为完成'
        });
    } catch (error) {
        console.error('标记完成失败:', error);
        res.status(500).json({
            success: false,
            message: '标记完成失败',
            error: error.message
        });
    }
}

/**
 * 获取历史复盘记录
 */
async function getHistory(req, res) {
    try {
        const { limit = 10, offset = 0 } = req.query;
        const userId = req.user.id;

        const recaps = db.prepare(`
            SELECT * FROM daily_recap
            WHERE user_id = ?
            ORDER BY recap_date DESC
            LIMIT ? OFFSET ?
        `).all(userId, parseInt(limit), parseInt(offset));

        const total = db.prepare(
            'SELECT COUNT(*) as count FROM daily_recap WHERE user_id = ?'
        ).get(userId);

        res.json({
            success: true,
            data: recaps
        });
    } catch (error) {
        console.error('获取历史记录失败:', error);
        res.status(500).json({
            success: false,
            message: '获取历史记录失败',
            error: error.message
        });
    }
}

// ==================== 辅助函数 ====================

/**
 * 获取市场数据
 */
async function getMarketData(date) {
    try {
        // 调用新浪财经API获取指数数据
        const indices = ['sh000001', 'sz399001', 'sz399006']; // 上证指数、深证成指、创业板指
        const sinaUrl = `https://hq.sinajs.cn/list=${indices.join(',')}`;

        const response = await axios.get(sinaUrl, {
            headers: { 'Referer': 'https://finance.sina.com.cn' },
            timeout: 5000,
            responseType: 'arraybuffer'
        });

        const data = iconv.decode(Buffer.from(response.data), 'gbk');
        const lines = data.split('\n').filter(line => line.trim());

        const parseIndexData = (line) => {
            const match = line.match(/="(.+)"/);
            if (!match || !match[1]) return null;

            const values = match[1].split(',');
            if (values.length < 6) return null;

            const current = parseFloat(values[3]);
            const yesterday = parseFloat(values[2]);
            const change = current - yesterday;
            const changePercent = yesterday > 0 ? (change / yesterday * 100) : 0;

            return {
                name: values[0],
                current,
                yesterday,
                change,
                change_percent: parseFloat(changePercent.toFixed(2))
            };
        };

        const shIndex = parseIndexData(lines[0]) || { change: 0, change_percent: 0 };
        const szIndex = parseIndexData(lines[1]) || { change: 0, change_percent: 0 };
        const cyIndex = parseIndexData(lines[2]) || { change: 0, change_percent: 0 };

        console.log(`📊 获取市场数据成功：上证${shIndex.change_percent}%，深证${szIndex.change_percent}%，创业板${cyIndex.change_percent}%`);

        return {
            sh_index: { code: '000001', name: '上证指数', ...shIndex },
            sz_index: { code: '399001', name: '深证成指', ...szIndex },
            cy_index: { code: '399006', name: '创业板指', ...cyIndex },
            market_sentiment: shIndex.change_percent > 0 ? '上涨' : (shIndex.change_percent < 0 ? '下跌' : '震荡')
        };
    } catch (error) {
        console.error('⚠️ 获取市场数据失败，使用默认值:', error.message);
        return {
            sh_index: { code: '000001', name: '上证指数', change: 0, change_percent: 0 },
            sz_index: { code: '399001', name: '深证成指', change: 0, change_percent: 0 },
            cy_index: { code: '399006', name: '创业板指', change: 0, change_percent: 0 },
            market_sentiment: '震荡',
            note: '市场数据获取失败'
        };
    }
}

/**
 * 获取持仓数据（从统一的 positions 表获取）
 */
async function getPositionData(date, userId) {
    try {
        // 直接从统一的 positions 表获取所有持仓
        const positions = db.prepare(`
            SELECT
                stock_code as code,
                stock_name as name,
                quantity,
                cost_price,
                current_price,
                market_value,
                profit_loss as total_profit,
                profit_loss_rate as profit_rate,
                source
            FROM positions
            WHERE user_id = ? AND quantity > 0
            ORDER BY stock_code
        `).all(userId);

        // 去重：如果同一个股票代码有多条记录，只保留第一条
        const uniquePositions = [];
        const seenCodes = new Set();

        positions.forEach(pos => {
            if (!seenCodes.has(pos.code)) {
                seenCodes.add(pos.code);
                uniquePositions.push(pos);
            } else {
                console.log(`⚠️ 发现重复持仓记录: ${pos.code} ${pos.name}，已跳过`);
            }
        });

        if (uniquePositions.length < positions.length) {
            console.log(`🔧 去重：原始 ${positions.length} 条，去重后 ${uniquePositions.length} 条`);
            positions = uniquePositions;
        }

        // 计算 cost 字段（前端需要）
        positions.forEach(pos => {
            pos.cost = pos.cost_price * pos.quantity;
        });

        console.log(`📊 持仓数据: 共 ${positions.length} 条`);

        // 自动获取所有持仓股票的最新价格
        if (positions.length > 0) {
            try {
                const stockCodes = positions.map(pos => pos.code);
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

                // 将最新价格更新到持仓数据中
                positions.forEach(pos => {
                    const quote = quotes.find(q => q.stockCode === pos.code);
                    if (quote && quote.currentPrice > 0) {
                        // 获取昨日收盘价，优先使用API返回的值
                        let yesterdayClose = null;

                        // 1. 首选：使用API返回的昨日收盘价
                        if (quote.yesterdayClose && quote.yesterdayClose > 0) {
                            yesterdayClose = quote.yesterdayClose;
                        }
                        // 2. 备选：使用数据库中保存的当前价（作为前一次的价格）
                        else if (pos.current_price && pos.current_price > 0) {
                            yesterdayClose = pos.current_price;
                            console.log(`⚠️ [${pos.code}] API未返回昨收价，使用数据库价格 ¥${yesterdayClose}`);
                        }
                        // 3. 最后：使用当前价（这会导致今日盈亏为0）
                        else {
                            yesterdayClose = quote.currentPrice;
                            console.log(`⚠️ [${pos.code}] 无法获取昨收价，今日盈亏将为0`);
                        }

                        pos.yesterday_close = yesterdayClose;
                        pos.current_price = quote.currentPrice;

                        // 重新计算当前盈亏（总盈亏 = 当前价 - 成本价）
                        pos.total_profit = (quote.currentPrice - pos.cost_price) * pos.quantity;
                        pos.profit_rate = pos.cost_price > 0 ? (pos.total_profit / pos.cost) * 100 : 0;

                        // 计算今日盈亏（今日盈亏 = 当前价 - 昨日收盘价）
                        pos.today_profit = (quote.currentPrice - yesterdayClose) * pos.quantity;

                        // 添加调试日志
                        const todayChange = ((quote.currentPrice - yesterdayClose) / yesterdayClose * 100).toFixed(2);
                        console.log(`💰 [${pos.code} ${pos.name}] 当前=¥${quote.currentPrice}, 昨收=¥${yesterdayClose}(${todayChange}%), 成本=¥${pos.cost_price}, 今日盈亏=¥${pos.today_profit.toFixed(2)}, 总盈亏=¥${pos.total_profit.toFixed(2)}`);
                    }
                });

                console.log(`✅ 已更新 ${stockCodes.length} 个持仓的最新价格`);
            } catch (priceError) {
                console.error('⚠️ 获取最新价格失败，使用数据库中的价格:', priceError.message);
                // 获取价格失败不影响主流程，使用数据库中的价格
            }
        }

        // 查询今天的交易记录，正确计算今日盈亏
        const todayTrades = db.prepare(`
            SELECT stock_code, stock_name, trade_type, quantity, price, created_at
            FROM trade_operations
            WHERE user_id = ? AND DATE(trade_date) = ?
            ORDER BY created_at ASC
        `).all(userId, date);

        // 计算每只股票今天的交易变化
        const tradeMap = {};
        todayTrades.forEach(trade => {
            if (!tradeMap[trade.stock_code]) {
                tradeMap[trade.stock_code] = {
                    name: trade.stock_name,
                    buyQty: 0,
                    sellQty: 0,
                    buyAmount: 0, // 买入金额
                    sellAmount: 0  // 卖出金额
                };
            }

            if (trade.trade_type === 'buy' || trade.trade_type === 'add') {
                tradeMap[trade.stock_code].buyQty += trade.quantity;
                tradeMap[trade.stock_code].buyAmount += trade.quantity * trade.price;
            } else if (trade.trade_type === 'sell' || trade.trade_type === 'reduce') {
                tradeMap[trade.stock_code].sellQty += trade.quantity;
                tradeMap[trade.stock_code].sellAmount += trade.quantity * trade.price;
            }
        });

        let todayProfit = 0;
        let totalProfit = 0;
        let riseCount = 0;
        let fallCount = 0;
        let flatCount = 0;

        // 计算当前持仓的总盈亏和今日盈亏
        positions.forEach(pos => {
            const profit = pos.total_profit || 0;
            totalProfit += profit;

            let todayProfitValue = 0;
            const trade = tradeMap[pos.code];

            if (trade) {
                // 今天有交易的股票
                const yesterdayQty = pos.quantity - trade.buyQty + trade.sellQty;

                console.log(`📈 [${pos.code}] 有交易: 昨持${yesterdayQty}股, 今买${trade.buyQty}股, 今卖${trade.sellQty}股, 现持${pos.quantity}股`);

                // 1. 昨日持仓部分的今日盈亏（只计算仍持有的部分，已卖出的在"卖出盈亏"中计算）
                const yesterdayQtyStillHeld = Math.max(0, yesterdayQty - trade.sellQty);
                if (yesterdayQtyStillHeld > 0 && pos.yesterday_close) {
                    const oldHoldingProfit = (pos.current_price - pos.yesterday_close) * yesterdayQtyStillHeld;
                    todayProfitValue += oldHoldingProfit;
                    console.log(`   昨日持仓盈亏(仍持有${yesterdayQtyStillHeld}股): (${pos.current_price} - ${pos.yesterday_close}) × ${yesterdayQtyStillHeld} = ¥${oldHoldingProfit.toFixed(2)}`);
                }

                // 2. 今天新买入部分的盈亏
                if (trade.buyQty > 0) {
                    const avgBuyPrice = trade.buyAmount / trade.buyQty;
                    const newBuyProfit = (pos.current_price - avgBuyPrice) * trade.buyQty;
                    todayProfitValue += newBuyProfit;
                    console.log(`   新买入盈亏: (${pos.current_price} - ${avgBuyPrice.toFixed(2)}) × ${trade.buyQty} = ¥${newBuyProfit.toFixed(2)}`);
                }

                // 3. 今天卖出部分的盈亏
                if (trade.sellQty > 0 && pos.yesterday_close) {
                    const avgSellPrice = trade.sellAmount / trade.sellQty;
                    const sellProfit = (avgSellPrice - pos.yesterday_close) * trade.sellQty;
                    todayProfitValue += sellProfit;
                    console.log(`   卖出盈亏: (${avgSellPrice.toFixed(2)} - ${pos.yesterday_close}) × ${trade.sellQty} = ¥${sellProfit.toFixed(2)}`);
                }

                pos.today_profit = todayProfitValue;
                console.log(`   总今日盈亏: ¥${todayProfitValue.toFixed(2)}`);
            } else if (pos.today_profit) {
                // 今天没有交易的股票，使用已计算的today_profit
                todayProfitValue = pos.today_profit;
            }

            todayProfit += todayProfitValue;

            // 根据今日盈亏情况统计涨跌
            if (todayProfitValue > 0) riseCount++;
            else if (todayProfitValue < 0) fallCount++;
            else flatCount++;
        });

        // 处理今天清仓的股票（不在当前持仓中，但有今日盈亏）
        for (const [code, trade] of Object.entries(tradeMap)) {
            if (trade.sellQty > 0 && !positions.find(p => p.code === code)) {
                console.log(`🗑️ [${code}] 今日清仓: 卖出${trade.sellQty}股`);

                // 获取该股票的最新行情（用于获取昨收价）
                try {
                    let market = code.startsWith('6') ? 'sh' : 'sz';
                    const sinaUrl = `https://hq.sinajs.cn/list=${market}${code}`;
                    const response = await axios.get(sinaUrl, {
                        headers: { 'Referer': 'https://finance.sina.com.cn' },
                        timeout: 5000,
                        responseType: 'arraybuffer'
                    });

                    const data = iconv.decode(Buffer.from(response.data), 'gbk');
                    const match = data.match(/="(.+)"/);
                    if (match && match[1]) {
                        const values = match[1].split(',');
                        const yesterdayClose = parseFloat(values[2]);
                        const avgSellPrice = trade.sellAmount / trade.sellQty;

                        if (yesterdayClose > 0) {
                            const clearProfit = (avgSellPrice - yesterdayClose) * trade.sellQty;
                            todayProfit += clearProfit;
                            console.log(`   清仓盈亏: (${avgSellPrice.toFixed(2)} - ${yesterdayClose}) × ${trade.sellQty} = ¥${clearProfit.toFixed(2)}`);
                        }
                    }
                } catch (err) {
                    console.log(`   ⚠️ 无法获取${code}的行情数据`);
                }
            }
        }

        console.log(`💰 计算盈亏: 今日盈亏=¥${todayProfit.toFixed(2)}, 总盈亏=¥${totalProfit.toFixed(2)}`);

        return {
            positions,
            count: positions.length,
            todayProfit,
            totalProfit,
            riseCount,
            fallCount,
            flatCount
        };
    } catch (error) {
        console.error('获取持仓数据失败:', error);
        return {
            positions: [],
            count: 0,
            todayProfit: 0,
            totalProfit: 0,
            riseCount: 0,
            fallCount: 0,
            flatCount: 0
        };
    }
}

/**
 * 获取交易数据
 */
async function getTradeData(date, userId) {
    try {
        // 获取当天的交易记录（使用正确的表名 trade_operations）
        const trades = db.prepare(`
            SELECT * FROM trade_operations
            WHERE user_id = ? AND DATE(trade_date) = ?
            ORDER BY trade_date DESC
        `).all(userId, date);

        let buyCount = 0;
        let sellCount = 0;

        trades.forEach(trade => {
            if (trade.trade_type === 'buy') buyCount++;
            if (trade.trade_type === 'sell') sellCount++;
        });

        return {
            trades,
            count: trades.length,
            buyCount,
            sellCount
        };
    } catch (error) {
        console.error('获取交易数据失败:', error);
        return {
            trades: [],
            count: 0,
            buyCount: 0,
            sellCount: 0
        };
    }
}

/**
 * 获取计划数据
 */
async function getPlanData(date, userId) {
    // TODO: 如果有交易计划表，从这里获取
    // 目前先返回空数据
    return {
        plans: [],
        count: 0,
        completed: 0,
        executionRate: 0
    };
}

/**
 * 获取交易操作数据（原为获取交易日志，现改为获取实际交易操作）
 */
async function getTradingLogs(date, userId) {
    try {
        // 获取当天的所有交易操作
        const operations = db.prepare(`
            SELECT * FROM trade_operations
            WHERE user_id = ? AND DATE(trade_date) = ?
            ORDER BY created_at DESC
        `).all(userId, date);

        // 转换为前端期望的格式
        const logs = operations.map(op => ({
            id: op.id,
            log_type: op.trade_type, // buy/sell
            title: `${op.trade_type === 'buy' ? '买入' : '卖出'} ${op.stock_code} ${op.stock_name}`,
            content: `交易数量：${op.quantity}股\n交易价格：${op.price}元\n交易金额：${op.amount}元\n手续费：${op.fee || 0}元${op.notes ? '\n备注：' + op.notes : ''}`,
            related_stock_codes: op.stock_code,
            sentiment: null,
            profit_loss: op.trade_type === 'sell' ? (op.amount - op.fee) : null,
            created_at: op.created_at,
            // 保留原始数据
            _original: op
        }));

        // 按交易类型分类
        const byType = {
            buy: [],
            sell: [],
            daily_recap: [],
            decision_note: [],
            insight: [],
            error_analysis: [],
            success_case: []
        };

        logs.forEach(log => {
            const type = log.log_type;
            if (byType[type]) {
                byType[type].push(log);
            }
        });

        return {
            logs,
            count: logs.length,
            byType
        };
    } catch (error) {
        console.error('获取交易操作失败:', error);
        return {
            logs: [],
            count: 0,
            byType: {}
        };
    }
}

/**
 * 构建AI提示词
 */
function buildAIPrompt(data) {
    // 构建交易日志部分
    let tradingLogsSection = '';
    if (data.tradingLogs && data.tradingLogs.length > 0) {
        tradingLogsSection = '\n【今日操作记录】\n';
        data.tradingLogs.forEach((log, index) => {
            tradingLogsSection += `${index + 1}. [${getLogTypeLabel(log.log_type)}] ${log.title}\n`;
            tradingLogsSection += `   ${log.content.substring(0, 150)}${log.content.length > 150 ? '...' : ''}\n`;
            if (log.related_stock_codes) {
                tradingLogsSection += `   相关股票：${log.related_stock_codes}\n`;
            }
            if (log.sentiment) {
                tradingLogsSection += `   情绪：${getSentimentLabel(log.sentiment)}\n`;
            }
            tradingLogsSection += '\n';
        });
    }

    return `您是专业的股票投资顾问，请根据以下数据进行每日复盘分析。

【复盘数据】
📅 日期：${data.date}

📊 市场数据：
• 上证指数 ${data.market.sh_index?.change_percent >= 0 ? '📈' : '📉'} ${data.market.sh_index?.change_percent || 0}%
• 深证成指 ${data.market.sz_index?.change_percent >= 0 ? '📈' : '📉'} ${data.market.sz_index?.change_percent || 0}%
• 创业板指 ${data.market.cy_index?.change_percent >= 0 ? '📈' : '📉'} ${data.market.cy_index?.change_percent || 0}%

💼 持仓数据：
• 持仓数量：${data.positions.length}只
• 今日盈亏：${data.todayProfit >= 0 ? '📈' : '📉'} ¥${data.todayProfit.toFixed(2)}
• 累计盈亏：${data.totalProfit >= 0 ? '📈' : '📉'} ¥${data.totalProfit.toFixed(2)}

💰 交易数据：
• 今日交易：${data.trades.length}笔（买入${data.trades.filter(t => t.type === 'buy').length}笔，卖出${data.trades.filter(t => t.type === 'sell').length}笔）
${tradingLogsSection}

【分析要求】
请严格按照以下格式输出分析内容，每个部分必须包含：

## 📊 市场行情总结
今日市场${data.market.sh_index?.change_percent >= 0 ? '上涨' : '下跌'}，[分析市场整体走势、板块轮动、成交量变化等，50-80字]

## 💼 持仓表现点评
【整体表现】[总结持仓整体盈亏情况，30-50字]
【表现突出】[如有表现优秀的持仓，简要说明，30字]
【需要关注】[如有表现不佳或风险较高的持仓，提示注意，30字]

## 📝 交易质量评价
${data.trades.length > 0 ? `今日进行了${data.trades.length}笔交易，[评价交易时机、价格、仓位管理等是否合理，50-80字]` : '今日无交易操作。[根据市场情况评价是否应该有操作，30-50字]'}

## ⚠️ 风险提示
• [风险点1：如市场风险、个股风险、仓位风险等]
• [风险点2：具体需要关注的风险]
• [风险点3：如有其他风险]

## 💡 明日操作建议
【市场研判】[预测明日市场可能走势，30-50字]
【操作策略】[建议具体操作方向，如加仓、减仓、换股等，50-80字]
【关注重点】[明日需要重点关注的板块、个股或数据，30-50字]

【输出规范】
1. 严格使用markdown格式，保留所有emoji图标
2. 每个##标题必须单独成行
3. 内容简洁专业，突出关键信息
4. 数字和关键词使用粗体强调
5. 总字数控制在400-600字之间`;
}

/**
 * 获取日志类型标签
 */
function getLogTypeLabel(type) {
    const labels = {
        daily_recap: '每日复盘',
        decision_note: '决策笔记',
        insight: '交易洞察',
        error_analysis: '错误分析',
        success_case: '成功案例'
    };
    return labels[type] || type;
}

/**
 * 获取情绪标签
 */
function getSentimentLabel(sentiment) {
    const labels = {
        good: '积极😊',
        neutral: '中性😐',
        bad: '消极😞'
    };
    return labels[sentiment] || sentiment;
}

/**
 * 调用AI API
 */
async function callAIAPI(config, prompt) {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        // 添加API密钥
        if (config.api_key) {
            headers['Authorization'] = `Bearer ${config.api_key}`;
        }

        // 构建请求体
        const requestBody = {
            model: config.model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: config.temperature || 0.7,
            max_tokens: config.max_tokens || 2000
        };

        const response = await axios.post(config.api_url, requestBody, {
            headers,
            timeout: config.timeout || 30000
        });

        // 根据不同的API提供商解析响应
        if (config.provider === 'openai' || config.provider === 'deepseek') {
            if (response.data && response.data.choices && response.data.choices.length > 0) {
                return response.data.choices[0].message.content;
            }
        } else if (config.provider === 'qwen') {
            if (response.data && response.data.output) {
                return response.data.output.text;
            }
        }

        throw new Error('无法解析AI响应');
    } catch (error) {
        console.error('调用AI API失败:', error.message);
        throw error;
    }
}

/**
 * 保存分析结果
 */
async function saveAnalysisResult(req, res) {
    try {
        const { date, analysisType, analysisData, stockCode, stockName } = req.body;
        const recapDate = date || new Date().toISOString().split('T')[0];

        // 首先确保复盘记录存在
        let recap = db.prepare('SELECT * FROM daily_recap WHERE recap_date = ?').get(recapDate);

        if (!recap) {
            return res.status(404).json({
                success: false,
                message: '复盘记录不存在，请先生成复盘数据'
            });
        }

        // 根据分析类型更新不同的字段
        let updateSql;
        let params;

        switch (analysisType) {
            case 'call_auction':
                updateSql = `UPDATE daily_recap
                            SET call_auction_analysis = ?,
                                call_auction_analyzed_at = CURRENT_TIMESTAMP,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE recap_date = ?`;
                params = [analysisData, recapDate];
                break;

            case 'portfolio':
                updateSql = `UPDATE daily_recap
                            SET portfolio_analysis = ?,
                                portfolio_analyzed_at = CURRENT_TIMESTAMP,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE recap_date = ?`;
                params = [analysisData, recapDate];
                break;

            case 'fundamental':
                // 基本面分析是按股票保存的，需要读取现有数据，更新后再保存
                const existingFundamental = recap.fundamental_analysis_data
                    ? JSON.parse(recap.fundamental_analysis_data)
                    : {};
                existingFundamental[stockCode] = {
                    stockCode,
                    stockName,
                    analysis: analysisData,
                    analyzedAt: new Date().toISOString()
                };
                updateSql = `UPDATE daily_recap
                            SET fundamental_analysis_data = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE recap_date = ?`;
                params = [JSON.stringify(existingFundamental), recapDate];
                break;

            case 'trend':
                // 趋势分析也是按股票保存的
                const existingTrend = recap.trend_analysis_data
                    ? JSON.parse(recap.trend_analysis_data)
                    : {};
                existingTrend[stockCode] = {
                    stockCode,
                    stockName,
                    analysis: analysisData,
                    analyzedAt: new Date().toISOString()
                };
                updateSql = `UPDATE daily_recap
                            SET trend_analysis_data = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE recap_date = ?`;
                params = [JSON.stringify(existingTrend), recapDate];
                break;

            case 'daily_summary':
                updateSql = `UPDATE daily_recap
                            SET daily_summary = ?,
                                daily_summary_at = CURRENT_TIMESTAMP,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE recap_date = ?`;
                params = [analysisData, recapDate];
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: '无效的分析类型'
                });
        }

        db.prepare(updateSql).run(...params);

        res.json({
            success: true,
            message: '分析结果已保存'
        });

    } catch (error) {
        console.error('保存分析结果失败:', error);
        res.status(500).json({
            success: false,
            message: '保存分析结果失败: ' + error.message
        });
    }
}

/**
 * 标记今日无操作
 */
async function markNoTrading(req, res) {
    try {
        const { date } = req.body;
        const recapDate = date || new Date().toISOString().split('T')[0];
        const userId = req.user.id;

        console.log(`📝 标记今日无操作: ${recapDate} (用户ID: ${userId})`);

        // 检查是否已存在复盘记录
        const existing = db.prepare(
            'SELECT * FROM daily_recap WHERE recap_date = ? AND user_id = ?'
        ).get(recapDate, userId);

        if (existing) {
            // 更新现有记录
            db.prepare(`
                UPDATE daily_recap
                SET no_trading_today = 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE recap_date = ? AND user_id = ?
            `).run(recapDate, userId);

            console.log(`✅ 已更新复盘记录，标记为今日无操作`);
        } else {
            // 创建新记录
            // 获取市场数据（仍需要记录市场行情）
            const marketData = await getMarketData(recapDate);

            // 获取持仓数据
            const positionData = await getPositionData(recapDate, userId);

            db.prepare(`
                INSERT INTO daily_recap (
                    recap_date,
                    user_id,
                    market_data,
                    position_data,
                    today_profit,
                    total_profit,
                    position_count,
                    rise_count,
                    fall_count,
                    flat_count,
                    no_trading_today,
                    trade_count,
                    buy_count,
                    sell_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0)
            `).run(
                recapDate,
                userId,
                JSON.stringify(marketData),
                JSON.stringify(positionData.positions),  // 保存positions数组
                positionData.todayProfit || 0,           // 修正：todayProfit
                positionData.totalProfit || 0,           // 修正：totalProfit
                positionData.count || 0,                 // 修正：count
                positionData.riseCount || 0,             // 修正：riseCount
                positionData.fallCount || 0,             // 修正：fallCount
                positionData.flatCount || 0              // 修正：flatCount
            );

            console.log(`✅ 已创建复盘记录，标记为今日无操作`);
        }

        res.json({
            success: true,
            message: '已标记今日无操作'
        });

    } catch (error) {
        console.error('❌ 标记今日无操作失败:', error);
        res.status(500).json({
            success: false,
            message: '标记失败: ' + error.message
        });
    }
}

module.exports = {
    generateRecapData,
    analyzeWithAI,
    getRecapStatus,
    saveNotes,
    markAsCompleted,
    getHistory,
    saveAnalysisResult,
    markNoTrading
};
