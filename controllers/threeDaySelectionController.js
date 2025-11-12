const { db } = require('../database/connection');
const axios = require('axios');
const stockCache = require('../stockCache');

/**
 * 三日选股法控制器
 * 实现连续三日上涨+量价配合的选股策略
 */

// ==================== 股票列表获取 ====================

/**
 * 获取所有A股股票列表
 */
async function getAllStocks(req, res) {
    try {
        console.log('📋 获取全部A股股票列表...');

        // 从新浪财经获取沪深A股列表
        let stocks = [];

        try {
            // 并发获取多页数据（避免单个请求超时）
            const maxPages = 60; // 最多获取60页，约5000只股票
            const pageSize = 80;

            console.log(`📡 开始并发获取股票列表（预计 ${maxPages} 页）...`);

            // 分批并发请求（每批10页）
            const batchSize = 10;
            for (let batchStart = 1; batchStart <= maxPages; batchStart += batchSize) {
                const batchEnd = Math.min(batchStart + batchSize - 1, maxPages);
                console.log(`📡 正在获取第 ${batchStart}-${batchEnd} 页...`);

                // 创建并发请求
                const promises = [];
                for (let page = batchStart; page <= batchEnd; page++) {
                    promises.push(
                        axios.get('http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData', {
                            params: {
                                page: page,
                                num: pageSize,
                                sort: 'symbol',
                                asc: 1,
                                node: 'hs_a',
                                symbol: '',
                                _s_r_a: 'page'
                            },
                            timeout: 10000
                        }).catch(err => {
                            console.warn(`⚠️ 第 ${page} 页请求失败: ${err.message}`);
                            return null;
                        })
                    );
                }

                // 等待这一批请求完成
                const responses = await Promise.all(promises);

                // 处理响应
                let hasData = false;
                for (const response of responses) {
                    if (response && response.data) {
                        try {
                            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

                            if (Array.isArray(data) && data.length > 0) {
                                hasData = true;
                                data.forEach(stock => {
                                    if (stock.code && stock.name && !stock.code.startsWith('bj')) {
                                        // 过滤掉北交所股票
                                        stocks.push({
                                            code: stock.code,
                                            name: stock.name,
                                            market: stock.code.startsWith('6') ? '沪市' : '深市'
                                        });
                                    }
                                });
                            }
                        } catch (e) {
                            console.warn(`⚠️ 数据解析失败: ${e.message}`);
                        }
                    }
                }

                console.log(`✅ 第 ${batchStart}-${batchEnd} 页完成，当前总计 ${stocks.length} 只股票`);

                // 如果这一批都没有数据，说明已经获取完毕
                if (!hasData) {
                    console.log(`✅ 所有数据已获取完毕，共 ${stocks.length} 只股票`);
                    break;
                }

                // 延迟避免API限流（批次之间延迟）
                if (batchEnd < maxPages) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (stocks.length > 0) {
                console.log(`📊 从API共获取到 ${stocks.length} 只股票`);
            } else {
                console.warn('⚠️ API返回数据格式不正确或无数据');
            }
        } catch (error) {
            console.error('❌ 获取股票列表失败:', error.message);
        }

        // 如果API失败，使用内置的完整股票列表
        if (stocks.length === 0) {
            console.log('⚠️ API失败，使用内置A股列表');
            stocks = getBuiltInStockList();
        }

        console.log(`✅ 成功获取 ${stocks.length} 只A股股票`);

        res.json({
            success: true,
            data: stocks,
            total: stocks.length
        });
    } catch (error) {
        console.error('❌ 获取股票列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取股票列表失败',
            error: error.message
        });
    }
}

// ==================== 配置管理 ====================

/**
 * 获取用户的所有配置
 */
async function getConfigs(req, res) {
    try {
        const userId = req.user.id;

        const configs = db.prepare(`
            SELECT * FROM three_day_selection_configs
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).all(userId);

        res.json({
            success: true,
            data: configs
        });
    } catch (error) {
        console.error('获取配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取配置失败',
            error: error.message
        });
    }
}

/**
 * 获取单个配置
 */
async function getConfig(req, res) {
    try {
        const userId = req.user.id;
        const configId = req.params.id;

        const config = db.prepare(`
            SELECT * FROM three_day_selection_configs
            WHERE id = ? AND user_id = ?
        `).get(configId, userId);

        if (!config) {
            return res.status(404).json({
                success: false,
                message: '配置不存在'
            });
        }

        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('获取配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取配置失败',
            error: error.message
        });
    }
}

/**
 * 创建配置
 */
async function createConfig(req, res) {
    try {
        const userId = req.user.id;
        const {
            config_name,
            min_price, max_price,
            min_daily_increase, max_daily_increase,
            volume_increase_required, min_volume_ratio, max_volume_ratio,
            require_macd_golden, require_above_ma5,
            rsi_min, rsi_max,
            min_market_cap, max_market_cap, exclude_st,
            included_sectors, excluded_sectors
        } = req.body;

        const now = new Date().toISOString();

        const result = db.prepare(`
            INSERT INTO three_day_selection_configs (
                user_id, config_name,
                min_price, max_price,
                min_daily_increase, max_daily_increase,
                volume_increase_required, min_volume_ratio, max_volume_ratio,
                require_macd_golden, require_above_ma5,
                rsi_min, rsi_max,
                min_market_cap, max_market_cap, exclude_st,
                included_sectors, excluded_sectors,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId, config_name,
            min_price, max_price,
            min_daily_increase, max_daily_increase,
            volume_increase_required, min_volume_ratio, max_volume_ratio,
            require_macd_golden, require_above_ma5,
            rsi_min, rsi_max,
            min_market_cap, max_market_cap, exclude_st,
            included_sectors, excluded_sectors,
            1, now, now
        );

        const newConfig = db.prepare(`
            SELECT * FROM three_day_selection_configs WHERE id = ?
        `).get(result.lastInsertRowid);

        res.json({
            success: true,
            message: '配置创建成功',
            data: newConfig
        });
    } catch (error) {
        console.error('创建配置失败:', error);
        res.status(500).json({
            success: false,
            message: '创建配置失败',
            error: error.message
        });
    }
}

/**
 * 更新配置
 */
async function updateConfig(req, res) {
    try {
        const userId = req.user.id;
        const configId = req.params.id;
        const updates = req.body;

        // 验证配置是否存在且属于当前用户
        const config = db.prepare(`
            SELECT * FROM three_day_selection_configs
            WHERE id = ? AND user_id = ?
        `).get(configId, userId);

        if (!config) {
            return res.status(404).json({
                success: false,
                message: '配置不存在'
            });
        }

        const now = new Date().toISOString();

        db.prepare(`
            UPDATE three_day_selection_configs SET
                config_name = COALESCE(?, config_name),
                min_price = COALESCE(?, min_price),
                max_price = COALESCE(?, max_price),
                min_daily_increase = COALESCE(?, min_daily_increase),
                max_daily_increase = COALESCE(?, max_daily_increase),
                volume_increase_required = COALESCE(?, volume_increase_required),
                min_volume_ratio = COALESCE(?, min_volume_ratio),
                max_volume_ratio = COALESCE(?, max_volume_ratio),
                require_macd_golden = COALESCE(?, require_macd_golden),
                require_above_ma5 = COALESCE(?, require_above_ma5),
                rsi_min = COALESCE(?, rsi_min),
                rsi_max = COALESCE(?, rsi_max),
                min_market_cap = COALESCE(?, min_market_cap),
                max_market_cap = COALESCE(?, max_market_cap),
                exclude_st = COALESCE(?, exclude_st),
                included_sectors = COALESCE(?, included_sectors),
                excluded_sectors = COALESCE(?, excluded_sectors),
                is_active = COALESCE(?, is_active),
                updated_at = ?
            WHERE id = ? AND user_id = ?
        `).run(
            updates.config_name,
            updates.min_price, updates.max_price,
            updates.min_daily_increase, updates.max_daily_increase,
            updates.volume_increase_required, updates.min_volume_ratio, updates.max_volume_ratio,
            updates.require_macd_golden, updates.require_above_ma5,
            updates.rsi_min, updates.rsi_max,
            updates.min_market_cap, updates.max_market_cap, updates.exclude_st,
            updates.included_sectors, updates.excluded_sectors,
            updates.is_active,
            now,
            configId, userId
        );

        const updatedConfig = db.prepare(`
            SELECT * FROM three_day_selection_configs WHERE id = ?
        `).get(configId);

        res.json({
            success: true,
            message: '配置更新成功',
            data: updatedConfig
        });
    } catch (error) {
        console.error('更新配置失败:', error);
        res.status(500).json({
            success: false,
            message: '更新配置失败',
            error: error.message
        });
    }
}

/**
 * 删除配置
 */
async function deleteConfig(req, res) {
    try {
        const userId = req.user.id;
        const configId = req.params.id;

        // 验证配置是否存在且属于当前用户
        const config = db.prepare(`
            SELECT * FROM three_day_selection_configs
            WHERE id = ? AND user_id = ?
        `).get(configId, userId);

        if (!config) {
            return res.status(404).json({
                success: false,
                message: '配置不存在'
            });
        }

        db.prepare(`
            DELETE FROM three_day_selection_configs
            WHERE id = ? AND user_id = ?
        `).run(configId, userId);

        res.json({
            success: true,
            message: '配置删除成功'
        });
    } catch (error) {
        console.error('删除配置失败:', error);
        res.status(500).json({
            success: false,
            message: '删除配置失败',
            error: error.message
        });
    }
}

// ==================== 选股核心逻辑 ====================

/**
 * 获取股票最近N天的K线数据
 */
async function getStockKlineData(stockCode, days = 10) {
    try {
        const fullCode = stockCode.startsWith('6') ? `sh${stockCode}` : `sz${stockCode}`;

        // 使用新浪财经API获取日K线数据
        const url = `http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${fullCode}&scale=240&datalen=${days}`;

        const response = await axios.get(url, {
            headers: {
                'Referer': 'https://finance.sina.com.cn'
            },
            timeout: 8000
        });

        if (!response.data || response.data === 'null') {
            return null;
        }

        const klineData = response.data.map(item => ({
            date: item.day,
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseInt(item.volume)
        }));

        return klineData;
    } catch (error) {
        console.error(`获取${stockCode}K线数据失败:`, error.message);
        return null;
    }
}

/**
 * 计算三日涨幅
 */
function calculateThreeDayIncrease(klineData) {
    if (!klineData || klineData.length < 3) {
        return null;
    }

    const recent3Days = klineData.slice(-3);
    const firstDay = recent3Days[0];
    const lastDay = recent3Days[2];

    const increase = ((lastDay.close - firstDay.open) / firstDay.open) * 100;

    return {
        day1: recent3Days[0],
        day2: recent3Days[1],
        day3: recent3Days[2],
        totalIncrease: increase
    };
}

/**
 * 检查是否满足连续三日上涨条件
 */
function checkThreeDayRising(day1, day2, day3) {
    // 检查每日是否上涨（收盘价 > 开盘价）
    const day1Rising = day1.close > day1.open;
    const day2Rising = day2.close > day2.open;
    const day3Rising = day3.close > day3.open;

    // 检查是否呈现逐日走高趋势
    const progressiveRising = day2.close > day1.close && day3.close > day2.close;

    return day1Rising && day2Rising && day3Rising && progressiveRising;
}

/**
 * 计算成交量比
 */
function calculateVolumeRatio(day1, day2, day3) {
    // 简化版：第三天成交量 / 前两天平均成交量
    const avgVolume = (day1.volume + day2.volume) / 2;
    if (avgVolume === 0) return 0;

    return day3.volume / avgVolume;
}

/**
 * 计算技术指标（简化版）
 */
function calculateIndicators(klineData) {
    if (!klineData || klineData.length < 10) {
        return null;
    }

    // 计算5日均线
    const last5Days = klineData.slice(-5);
    const ma5 = last5Days.reduce((sum, day) => sum + day.close, 0) / 5;

    // 计算10日均线
    const last10Days = klineData.slice(-10);
    const ma10 = last10Days.reduce((sum, day) => sum + day.close, 0) / 10;

    // 简化版RSI计算（使用最近14天）
    let rsi = 50; // 默认中性值
    if (klineData.length >= 14) {
        const last14Days = klineData.slice(-14);
        let gains = 0, losses = 0;

        for (let i = 1; i < last14Days.length; i++) {
            const change = last14Days[i].close - last14Days[i - 1].close;
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }

        const avgGain = gains / 14;
        const avgLoss = losses / 14;

        if (avgLoss === 0) {
            rsi = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsi = 100 - (100 / (1 + rs));
        }
    }

    const currentPrice = klineData[klineData.length - 1].close;

    return {
        ma5,
        ma10,
        rsi,
        aboveMA5: currentPrice > ma5,
        aboveMA10: currentPrice > ma10
    };
}

/**
 * 计算股票评分
 */
function calculateScore(threeDayData, volumeRatio, indicators, config) {
    let score = 0;

    // 1. 涨幅评分（30分）：涨幅在合理范围内得分更高
    const { totalIncrease } = threeDayData;
    if (totalIncrease >= config.min_daily_increase && totalIncrease <= config.max_daily_increase) {
        // 理想涨幅：3-5%
        if (totalIncrease >= 3 && totalIncrease <= 5) {
            score += 30;
        } else {
            score += 20;
        }
    } else {
        score += 10;
    }

    // 2. 量价配合评分（30分）
    if (volumeRatio >= config.min_volume_ratio && volumeRatio <= config.max_volume_ratio) {
        // 理想量比：1.5-2.0
        if (volumeRatio >= 1.5 && volumeRatio <= 2.0) {
            score += 30;
        } else {
            score += 20;
        }
    } else if (volumeRatio > config.min_volume_ratio) {
        score += 15;
    }

    // 3. 技术指标评分（40分）
    if (indicators) {
        // MA5支撑（15分）
        if (indicators.aboveMA5) {
            score += 15;
        }

        // MA10支撑（10分）
        if (indicators.aboveMA10) {
            score += 10;
        }

        // RSI健康区间（15分）
        if (indicators.rsi >= config.rsi_min && indicators.rsi <= config.rsi_max) {
            score += 15;
        } else if (indicators.rsi >= 40 && indicators.rsi <= 60) {
            score += 10;
        }
    }

    // 确定信心等级
    let confidenceLevel = 'low';
    if (score >= 80) {
        confidenceLevel = 'high';
    } else if (score >= 60) {
        confidenceLevel = 'medium';
    }

    return { score, confidenceLevel };
}

/**
 * 执行股票扫描（支持SSE实时进度）
 */
async function runScan(req, res) {
    try {
        const userId = req.user.id;
        const { configId, stockList } = req.body;
        const useStream = req.query.stream === 'true'; // 检查是否使用SSE

        // 获取配置
        const config = db.prepare(`
            SELECT * FROM three_day_selection_configs
            WHERE id = ? AND user_id = ?
        `).get(configId, userId);

        if (!config) {
            return res.status(404).json({
                success: false,
                message: '配置不存在'
            });
        }

        if (!stockList || !Array.isArray(stockList) || stockList.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供股票列表'
            });
        }

        // 如果使用SSE，设置响应头
        if (useStream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();
        }

        const scanDate = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();
        const results = [];
        let totalScanned = stockList.length;
        let totalSelected = 0;

        console.log(`🔍 开始扫描 ${totalScanned} 只股票...`);

        // 发送开始事件
        if (useStream) {
            res.write(`data: ${JSON.stringify({
                type: 'start',
                total: totalScanned,
                message: '开始扫描...'
            })}\n\n`);
        }

        let scannedCount = 0;

        // 扫描每只股票
        for (const stock of stockList) {
            try {
                const { stockCode, stockName } = stock;
                scannedCount++;

                const percent = ((scannedCount / totalScanned) * 100).toFixed(2);
                console.log(`📊 [${scannedCount}/${totalScanned}] ${percent}% - 正在扫描: ${stockCode} ${stockName}`);

                // 发送进度事件
                if (useStream) {
                    res.write(`data: ${JSON.stringify({
                        type: 'progress',
                        current: scannedCount,
                        total: totalScanned,
                        percent: parseFloat(percent),
                        stockCode,
                        stockName,
                        selected: totalSelected
                    })}\n\n`);
                }

                // 获取K线数据
                const klineData = await getStockKlineData(stockCode, 20);
                if (!klineData || klineData.length < 3) {
                    console.log(`⚠️ ${stockCode} ${stockName} K线数据不足`);
                    continue;
                }

                // 计算三日数据
                const threeDayData = calculateThreeDayIncrease(klineData);
                if (!threeDayData) {
                    continue;
                }

                const { day1, day2, day3, totalIncrease } = threeDayData;
                const currentPrice = day3.close;

                // 1. 检查价格范围
                if (currentPrice < config.min_price || currentPrice > config.max_price) {
                    continue;
                }

                // 2. 检查ST股票
                if (config.exclude_st && (stockName.includes('ST') || stockName.includes('*'))) {
                    continue;
                }

                // 3. 检查涨幅范围
                const dailyIncrease1 = ((day1.close - day1.open) / day1.open) * 100;
                const dailyIncrease2 = ((day2.close - day2.open) / day2.open) * 100;
                const dailyIncrease3 = ((day3.close - day3.open) / day3.open) * 100;

                if (dailyIncrease1 < config.min_daily_increase || dailyIncrease1 > config.max_daily_increase ||
                    dailyIncrease2 < config.min_daily_increase || dailyIncrease2 > config.max_daily_increase ||
                    dailyIncrease3 < config.min_daily_increase || dailyIncrease3 > config.max_daily_increase) {
                    continue;
                }

                // 4. 检查三日连续上涨
                if (!checkThreeDayRising(day1, day2, day3)) {
                    continue;
                }

                // 5. 计算成交量比
                const volumeRatio = calculateVolumeRatio(day1, day2, day3);
                if (config.volume_increase_required &&
                    (volumeRatio < config.min_volume_ratio || volumeRatio > config.max_volume_ratio)) {
                    continue;
                }

                // 6. 计算技术指标
                const indicators = calculateIndicators(klineData);

                // 检查MA5
                if (config.require_above_ma5 && indicators && !indicators.aboveMA5) {
                    continue;
                }

                // 检查RSI
                if (indicators && (indicators.rsi < config.rsi_min || indicators.rsi > config.rsi_max)) {
                    continue;
                }

                // 7. 计算评分
                const { score, confidenceLevel } = calculateScore(threeDayData, volumeRatio, indicators, config);

                // 保存结果
                const result = db.prepare(`
                    INSERT INTO three_day_selection_results (
                        user_id, config_id, scan_date,
                        stock_code, stock_name,
                        current_price, three_day_increase, volume_ratio,
                        day1_data, day2_data, day3_data,
                        indicators, score, confidence_level,
                        status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    userId, configId, scanDate,
                    stockCode, stockName,
                    currentPrice, totalIncrease, volumeRatio,
                    JSON.stringify(day1), JSON.stringify(day2), JSON.stringify(day3),
                    JSON.stringify(indicators), score, confidenceLevel,
                    'pending', now, now
                );

                results.push({
                    id: result.lastInsertRowid,
                    stockCode,
                    stockName,
                    currentPrice,
                    threeDayIncrease: totalIncrease,
                    volumeRatio,
                    score,
                    confidenceLevel
                });

                totalSelected++;
                console.log(`✅ ${stockCode} ${stockName} 符合条件，评分: ${score}`);

                // 发送选中事件
                if (useStream) {
                    res.write(`data: ${JSON.stringify({
                        type: 'selected',
                        stock: {
                            stockCode,
                            stockName,
                            currentPrice,
                            score
                        }
                    })}\n\n`);
                }

                // 延迟避免API限流
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`扫描${stock.stockCode}失败:`, error.message);
            }
        }

        // 更新统计数据
        const selectionRate = (totalSelected / totalScanned) * 100;

        db.prepare(`
            INSERT OR REPLACE INTO three_day_selection_stats (
                user_id, stat_date,
                total_scanned, total_selected, selection_rate,
                pending_signals, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId, scanDate,
            totalScanned, totalSelected, selectionRate,
            totalSelected, now
        );

        console.log(`🎉 扫描完成: ${totalScanned}只 -> 选中${totalSelected}只 (${selectionRate.toFixed(2)}%)`);

        // 根据是否使用SSE返回不同响应
        if (useStream) {
            // 发送完成事件
            res.write(`data: ${JSON.stringify({
                type: 'complete',
                totalScanned,
                totalSelected,
                selectionRate,
                results
            })}\n\n`);
            res.end();
        } else {
            // 传统JSON响应
            res.json({
                success: true,
                message: `扫描完成，选中 ${totalSelected} 只股票`,
                data: {
                    totalScanned,
                    totalSelected,
                    selectionRate,
                    results
                }
            });
        }

    } catch (error) {
        console.error('扫描失败:', error);

        if (req.query.stream === 'true') {
            // SSE错误响应
            res.write(`data: ${JSON.stringify({
                type: 'error',
                message: '扫描失败',
                error: error.message
            })}\n\n`);
            res.end();
        } else {
            // 传统JSON错误响应
            res.status(500).json({
                success: false,
                message: '扫描失败',
                error: error.message
            });
        }
    }
}

// ==================== 结果管理 ====================

/**
 * 获取选股结果列表
 */
async function getResults(req, res) {
    try {
        const userId = req.user.id;
        const { date, status, configId, page = 1, pageSize = 20 } = req.query;

        let sql = `
            SELECT * FROM three_day_selection_results
            WHERE user_id = ?
        `;
        const params = [userId];

        if (date) {
            sql += ` AND scan_date = ?`;
            params.push(date);
        }

        if (status) {
            sql += ` AND status = ?`;
            params.push(status);
        }

        if (configId) {
            sql += ` AND config_id = ?`;
            params.push(configId);
        }

        sql += ` ORDER BY score DESC, created_at DESC`;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

        const results = db.prepare(sql).all(...params);

        // 解析JSON字段
        const parsedResults = results.map(r => ({
            ...r,
            day1_data: JSON.parse(r.day1_data),
            day2_data: JSON.parse(r.day2_data),
            day3_data: JSON.parse(r.day3_data),
            indicators: r.indicators ? JSON.parse(r.indicators) : null
        }));

        // 获取总数
        let countSql = `SELECT COUNT(*) as total FROM three_day_selection_results WHERE user_id = ?`;
        const countParams = [userId];

        if (date) {
            countSql += ` AND scan_date = ?`;
            countParams.push(date);
        }

        if (status) {
            countSql += ` AND status = ?`;
            countParams.push(status);
        }

        if (configId) {
            countSql += ` AND config_id = ?`;
            countParams.push(configId);
        }

        const { total } = db.prepare(countSql).get(...countParams);

        res.json({
            success: true,
            data: {
                results: parsedResults,
                pagination: {
                    page: parseInt(page),
                    pageSize: parseInt(pageSize),
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            }
        });
    } catch (error) {
        console.error('获取结果失败:', error);
        res.status(500).json({
            success: false,
            message: '获取结果失败',
            error: error.message
        });
    }
}

/**
 * 更新选股结果状态
 */
async function updateResult(req, res) {
    try {
        const userId = req.user.id;
        const resultId = req.params.id;
        const updates = req.body;

        const result = db.prepare(`
            SELECT * FROM three_day_selection_results
            WHERE id = ? AND user_id = ?
        `).get(resultId, userId);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: '结果不存在'
            });
        }

        const now = new Date().toISOString();

        db.prepare(`
            UPDATE three_day_selection_results SET
                status = COALESCE(?, status),
                buy_date = COALESCE(?, buy_date),
                buy_price = COALESCE(?, buy_price),
                sell_date = COALESCE(?, sell_date),
                sell_price = COALESCE(?, sell_price),
                profit_rate = COALESCE(?, profit_rate),
                notes = COALESCE(?, notes),
                updated_at = ?
            WHERE id = ? AND user_id = ?
        `).run(
            updates.status,
            updates.buy_date, updates.buy_price,
            updates.sell_date, updates.sell_price,
            updates.profit_rate,
            updates.notes,
            now,
            resultId, userId
        );

        const updatedResult = db.prepare(`
            SELECT * FROM three_day_selection_results WHERE id = ?
        `).get(resultId);

        res.json({
            success: true,
            message: '结果更新成功',
            data: updatedResult
        });
    } catch (error) {
        console.error('更新结果失败:', error);
        res.status(500).json({
            success: false,
            message: '更新结果失败',
            error: error.message
        });
    }
}

/**
 * 删除选股结果
 */
async function deleteResult(req, res) {
    try {
        const userId = req.user.id;
        const resultId = req.params.id;

        const result = db.prepare(`
            SELECT * FROM three_day_selection_results
            WHERE id = ? AND user_id = ?
        `).get(resultId, userId);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: '结果不存在'
            });
        }

        db.prepare(`
            DELETE FROM three_day_selection_results
            WHERE id = ? AND user_id = ?
        `).run(resultId, userId);

        res.json({
            success: true,
            message: '结果删除成功'
        });
    } catch (error) {
        console.error('删除结果失败:', error);
        res.status(500).json({
            success: false,
            message: '删除结果失败',
            error: error.message
        });
    }
}

// ==================== 统计数据 ====================

/**
 * 获取统计数据
 */
async function getStats(req, res) {
    try {
        const userId = req.user.id;
        const { startDate, endDate } = req.query;

        let sql = `
            SELECT * FROM three_day_selection_stats
            WHERE user_id = ?
        `;
        const params = [userId];

        if (startDate) {
            sql += ` AND stat_date >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            sql += ` AND stat_date <= ?`;
            params.push(endDate);
        }

        sql += ` ORDER BY stat_date DESC`;

        const stats = db.prepare(sql).all(...params);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('获取统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取统计失败',
            error: error.message
        });
    }
}

/**
 * 获取内置的A股列表（生成所有可能的股票代码）
 */
function getBuiltInStockList() {
    const stocks = [];

    // 沪市主板 (600xxx, 601xxx, 603xxx, 605xxx)
    const shPrefixes = ['600', '601', '603', '605'];
    for (let prefix of shPrefixes) {
        for (let i = 0; i < 1000; i++) {
            const code = prefix + String(i).padStart(3, '0');
            stocks.push({
                code: code,
                name: `沪${code}`,
                market: '沪市'
            });
        }
    }

    // 科创板 (688xxx)
    for (let i = 0; i < 1000; i++) {
        const code = '688' + String(i).padStart(3, '0');
        stocks.push({
            code: code,
            name: `科创${code}`,
            market: '沪市'
        });
    }

    // 深市主板 (000xxx)
    for (let i = 0; i < 1000; i++) {
        const code = '000' + String(i).padStart(3, '0');
        stocks.push({
            code: code,
            name: `深${code}`,
            market: '深市'
        });
    }

    // 中小板 (002xxx)
    for (let i = 0; i < 1000; i++) {
        const code = '002' + String(i).padStart(3, '0');
        stocks.push({
            code: code,
            name: `中小${code}`,
            market: '深市'
        });
    }

    // 创业板 (300xxx, 301xxx)
    const cybPrefixes = ['300', '301'];
    for (let prefix of cybPrefixes) {
        for (let i = 0; i < 1000; i++) {
            const code = prefix + String(i).padStart(3, '0');
            stocks.push({
                code: code,
                name: `创业${code}`,
                market: '深市'
            });
        }
    }

    console.log(`📊 生成了 ${stocks.length} 个股票代码`);
    return stocks;
}

module.exports = {
    // 股票列表
    getAllStocks,

    // 配置管理
    getConfigs,
    getConfig,
    createConfig,
    updateConfig,
    deleteConfig,

    // 选股扫描
    runScan,

    // 结果管理
    getResults,
    updateResult,
    deleteResult,

    // 统计数据
    getStats
};
