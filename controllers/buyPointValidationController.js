/**
 * 买入点验证控制器
 * 提供股票买入点评分和验证功能
 */

const { db } = require('../database/connection');
const axios = require('axios');
const stockCache = require('../stockCache');

// ==================== 技术指标计算 ====================

/**
 * 计算简单移动平均线 (SMA)
 */
function calculateSMA(data, period) {
    if (data.length < period) return null;

    const sum = data.slice(-period).reduce((acc, val) => acc + val, 0);
    return sum / period;
}

/**
 * 计算指数移动平均线 (EMA)
 */
function calculateEMA(data, period) {
    if (data.length < period) return null;

    const multiplier = 2 / (period + 1);
    let ema = calculateSMA(data.slice(0, period), period);

    for (let i = period; i < data.length; i++) {
        ema = (data[i] - ema) * multiplier + ema;
    }

    return ema;
}

/**
 * 计算 MACD 指标
 */
function calculateMACD(closes) {
    if (closes.length < 26) {
        return { dif: null, dea: null, macd: null };
    }

    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);

    if (!ema12 || !ema26) {
        return { dif: null, dea: null, macd: null };
    }

    const dif = ema12 - ema26;

    // 计算 DEA (DIF的9日EMA)
    const difValues = [];
    for (let i = 26; i <= closes.length; i++) {
        const subCloses = closes.slice(0, i);
        const subEma12 = calculateEMA(subCloses, 12);
        const subEma26 = calculateEMA(subCloses, 26);
        if (subEma12 && subEma26) {
            difValues.push(subEma12 - subEma26);
        }
    }

    const dea = calculateEMA(difValues, 9);
    const macd = dea ? (dif - dea) * 2 : null;

    return { dif, dea, macd };
}

/**
 * 计算 KDJ 指标
 */
function calculateKDJ(highs, lows, closes, period = 9) {
    if (closes.length < period) {
        return { k: null, d: null, j: null };
    }

    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    let rsv = 50; // 默认值
    if (highestHigh !== lowestLow) {
        rsv = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    }

    // 简化计算：K = 2/3 * 前K + 1/3 * RSV
    // D = 2/3 * 前D + 1/3 * K
    // 这里使用最后一个周期的简化值
    const k = rsv;
    const d = rsv; // 简化处理
    const j = 3 * k - 2 * d;

    return { k, d, j };
}

/**
 * 计算 RSI 指标
 */
function calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) {
        return null;
    }

    let gains = 0;
    let losses = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
}

/**
 * 计算成交量移动平均
 */
function calculateVolumeMA(volumes, period) {
    return calculateSMA(volumes, period);
}

// ==================== 评分计算 ====================

/**
 * 计算技术分析得分 (40分)
 */
function calculateTechnicalScore(stockData, indicators) {
    let trendScore = 0;      // 趋势得分 (15分)
    let volumeScore = 0;     // 成交量得分 (10分)
    let indicatorScore = 0;  // 指标得分 (15分)

    // 详细评分说明
    const trendDetails = [];
    const volumeDetails = [];
    const indicatorDetails = [];

    const { closes, volumes, highs, lows } = stockData;
    const currentPrice = closes[closes.length - 1];

    // 1. 趋势得分 (15分)
    // 均线排列
    const ma5 = calculateSMA(closes, 5);
    const ma10 = calculateSMA(closes, 10);
    const ma20 = calculateSMA(closes, 20);
    const ma60 = calculateSMA(closes, 60);

    if (ma5 && ma10 && ma20) {
        // 多头排列：MA5 > MA10 > MA20
        if (ma5 > ma10 && ma10 > ma20) {
            trendScore += 8;
            trendDetails.push(`✅ 均线呈多头排列 (MA5 ${ma5.toFixed(2)} > MA10 ${ma10.toFixed(2)} > MA20 ${ma20.toFixed(2)})，趋势向上明确 (+8分)`);
        } else if (ma5 > ma10) {
            trendScore += 4;
            trendDetails.push(`⚠️ 短期均线金叉 (MA5 ${ma5.toFixed(2)} > MA10 ${ma10.toFixed(2)})，但未形成完整多头排列 (+4分)`);
        } else {
            trendDetails.push(`❌ 均线未形成多头排列，趋势偏弱 (0分)`);
        }

        // 价格在均线之上
        if (currentPrice > ma5) {
            trendScore += 3;
            trendDetails.push(`✅ 价格 ${currentPrice.toFixed(2)} 在MA5均线 ${ma5.toFixed(2)} 之上，短期趋势强劲 (+3分)`);
        } else {
            trendDetails.push(`❌ 价格 ${currentPrice.toFixed(2)} 在MA5均线 ${ma5.toFixed(2)} 之下，短期趋势偏弱 (0分)`);
        }

        if (currentPrice > ma10) {
            trendScore += 2;
            trendDetails.push(`✅ 价格在MA10均线 ${ma10.toFixed(2)} 之上 (+2分)`);
        } else {
            trendDetails.push(`❌ 价格在MA10均线 ${ma10.toFixed(2)} 之下 (0分)`);
        }

        if (currentPrice > ma20) {
            trendScore += 2;
            trendDetails.push(`✅ 价格在MA20均线 ${ma20.toFixed(2)} 之上 (+2分)`);
        } else {
            trendDetails.push(`❌ 价格在MA20均线 ${ma20.toFixed(2)} 之下 (0分)`);
        }
    } else {
        trendDetails.push('⚠️ 数据不足，无法计算完整趋势得分');
    }

    // 2. 成交量得分 (10分)
    const vol5 = calculateVolumeMA(volumes, 5);
    const vol10 = calculateVolumeMA(volumes, 10);
    const currentVol = volumes[volumes.length - 1];

    if (vol5 && vol10) {
        // 量能放大
        const volRatio = (currentVol / vol5).toFixed(2);
        if (currentVol > vol5 * 1.5) {
            volumeScore += 5;
            volumeDetails.push(`✅ 成交量大幅放大，当前量能是5日均量的 ${volRatio} 倍，表明资金积极介入 (+5分)`);
        } else if (currentVol > vol5) {
            volumeScore += 3;
            volumeDetails.push(`✅ 成交量温和放大 (${volRatio} 倍5日均量)，有资金关注 (+3分)`);
        } else {
            volumeDetails.push(`❌ 成交量未放大 (${volRatio} 倍5日均量)，资金参与度不足 (0分)`);
        }

        // 量能趋势向上
        const volTrendRatio = (vol5 / vol10).toFixed(2);
        if (vol5 > vol10) {
            volumeScore += 3;
            volumeDetails.push(`✅ 量能趋势向上 (5日均量 ${volTrendRatio} 倍于10日均量)，市场活跃度提升 (+3分)`);
        } else {
            volumeDetails.push(`❌ 量能趋势走弱 (5日均量仅为10日均量的 ${volTrendRatio} 倍) (0分)`);
        }

        // 价量配合
        const priceChange = (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2];
        const volumeChange = (volumes[volumes.length - 1] - volumes[volumes.length - 2]) / volumes[volumes.length - 2];
        if (priceChange > 0 && volumeChange > 0) {
            volumeScore += 2;
            volumeDetails.push(`✅ 价涨量增，价量配合良好 (价格涨幅 ${(priceChange * 100).toFixed(2)}%，量能增幅 ${(volumeChange * 100).toFixed(2)}%) (+2分)`);
        } else if (priceChange > 0) {
            volumeDetails.push(`⚠️ 价格上涨但成交量未配合，上涨动能可能不足 (0分)`);
        } else if (volumeChange > 0) {
            volumeDetails.push(`⚠️ 成交量放大但价格下跌，可能存在资金分歧 (0分)`);
        } else {
            volumeDetails.push(`❌ 价格和成交量均走弱，市场观望情绪浓厚 (0分)`);
        }
    } else {
        volumeDetails.push('⚠️ 数据不足，无法计算完整成交量得分');
    }

    // 3. 指标得分 (15分)
    const { dif, dea, macd } = indicators.macd;
    const { k, d, j } = indicators.kdj;
    const rsi = indicators.rsi;

    // MACD 金叉和正值
    if (dif !== null && dea !== null && macd !== null) {
        if (dif > dea && macd > 0) {
            indicatorScore += 5;
            indicatorDetails.push(`✅ MACD金叉且柱状图为正 (DIF ${dif.toFixed(3)} > DEA ${dea.toFixed(3)}, MACD ${macd.toFixed(3)})，多头趋势确立 (+5分)`);
        } else if (dif > dea) {
            indicatorScore += 3;
            indicatorDetails.push(`⚠️ MACD形成金叉 (DIF ${dif.toFixed(3)} > DEA ${dea.toFixed(3)})，但柱状图仍为负值，多头力量偏弱 (+3分)`);
        } else {
            indicatorDetails.push(`❌ MACD死叉 (DIF ${dif.toFixed(3)} < DEA ${dea.toFixed(3)})，空头占优 (0分)`);
        }
    } else {
        indicatorDetails.push('⚠️ MACD数据不足 (0分)');
    }

    // KDJ 低位金叉
    if (k !== null && d !== null) {
        if (k > d && k < 50) {
            indicatorScore += 5;
            indicatorDetails.push(`✅ KDJ低位金叉 (K ${k.toFixed(2)} > D ${d.toFixed(2)}，K值 < 50)，底部启动信号强烈 (+5分)`);
        } else if (k > d) {
            indicatorScore += 3;
            indicatorDetails.push(`✅ KDJ形成金叉 (K ${k.toFixed(2)} > D ${d.toFixed(2)})，但K值偏高 (${k.toFixed(2)})，追高风险增加 (+3分)`);
        } else if (k < 20) {
            indicatorDetails.push(`⚠️ KDJ处于超卖区 (K ${k.toFixed(2)} < D ${d.toFixed(2)})，存在反弹机会，但尚未形成金叉 (0分)`);
        } else {
            indicatorDetails.push(`❌ KDJ死叉 (K ${k.toFixed(2)} < D ${d.toFixed(2)})，短期偏弱 (0分)`);
        }
    } else {
        indicatorDetails.push('⚠️ KDJ数据不足 (0分)');
    }

    // RSI 适中区域
    if (rsi !== null) {
        if (rsi >= 40 && rsi <= 70) {
            indicatorScore += 5;
            indicatorDetails.push(`✅ RSI指标健康 (${rsi.toFixed(2)})，处于合理区间 (40-70)，既无超买也无超卖 (+5分)`);
        } else if (rsi >= 30 && rsi <= 80) {
            indicatorScore += 3;
            indicatorDetails.push(`✅ RSI指标尚可 (${rsi.toFixed(2)})，处于可接受区间 (30-80) (+3分)`);
        } else if (rsi > 80) {
            indicatorDetails.push(`❌ RSI严重超买 (${rsi.toFixed(2)} > 80)，短期调整压力大 (0分)`);
        } else if (rsi < 30) {
            indicatorDetails.push(`⚠️ RSI超卖 (${rsi.toFixed(2)} < 30)，可能存在反弹机会，但需等待企稳信号 (0分)`);
        } else {
            indicatorDetails.push(`⚠️ RSI指标边缘值 (${rsi.toFixed(2)}) (0分)`);
        }
    } else {
        indicatorDetails.push('⚠️ RSI数据不足 (0分)');
    }

    return {
        technical_score: Math.min(40, trendScore + volumeScore + indicatorScore),
        trend_score: trendScore,
        volume_score: volumeScore,
        indicator_score: indicatorScore,
        // 新增：详细评分说明
        trend_details: trendDetails,
        volume_details: volumeDetails,
        indicator_details: indicatorDetails
    };
}

/**
 * 计算形态位置得分 (25分)
 */
function calculatePatternScore(stockData) {
    let klineScore = 0;      // K线形态得分 (10分)
    let supportScore = 0;    // 支撑位得分 (15分)

    // 详细评分说明
    const klineDetails = [];
    const supportDetails = [];

    const { closes, highs, lows, opens } = stockData;
    const len = closes.length;

    if (len < 3) {
        return {
            pattern_score: 0,
            kline_score: 0,
            support_score: 0,
            kline_details: ['⚠️ 数据不足，无法分析K线形态'],
            support_details: ['⚠️ 数据不足，无法分析支撑位']
        };
    }

    // 1. K线形态得分 (10分)
    const lastClose = closes[len - 1];
    const lastOpen = opens[len - 1];
    const lastHigh = highs[len - 1];
    const lastLow = lows[len - 1];

    // 1.1 单根K线形态分析
    const bodySize = Math.abs(lastClose - lastOpen);
    const totalRange = lastHigh - lastLow;
    const bodyRatio = totalRange > 0 ? bodySize / totalRange : 0;
    const upperShadow = lastHigh - Math.max(lastOpen, lastClose);
    const lowerShadow = Math.min(lastOpen, lastClose) - lastLow;
    const shadowRatio = totalRange > 0 ? (upperShadow + lowerShadow) / totalRange : 0;

    // 阳线分析
    if (lastClose > lastOpen) {
        klineScore += 3;

        // 大阳线（实体占比>70%）
        if (bodyRatio > 0.7) {
            klineScore += 4;
            klineDetails.push(`✅ 收出大阳线，实体占比 ${(bodyRatio * 100).toFixed(1)}% > 70%，多头力量强劲，买盘积极 (+7分)`);

            // 光头光脚大阳线（影线极短）
            if (shadowRatio < 0.1) {
                klineDetails.push(`🌟 光头光脚大阳线！影线极短 (${(shadowRatio * 100).toFixed(1)}%)，多头完全控盘，强势突破信号`);
            }
        } else if (bodyRatio > 0.5) {
            klineScore += 2;
            klineDetails.push(`✅ 收出中阳线，实体占比 ${(bodyRatio * 100).toFixed(1)}%，买盘较强 (+5分)`);

            // 分析上下影线
            if (upperShadow > bodySize) {
                klineDetails.push(`⚠️ 上影线较长 (${upperShadow.toFixed(2)})，上方存在一定抛压`);
            }
            if (lowerShadow > bodySize) {
                klineDetails.push(`✅ 下影线较长 (${lowerShadow.toFixed(2)})，下方支撑强劲，多头反击有力`);
            }
        } else {
            klineDetails.push(`✅ 收小阳线，实体占比 ${(bodyRatio * 100).toFixed(1)}%，略有上影线 (+3分)`);

            // 锤子线（下影线长，上影线短，实体小）
            if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5) {
                klineDetails.push(`🔨 形成锤子线形态！下影线长度是实体的 ${(lowerShadow / bodySize).toFixed(1)} 倍，底部反转信号`);
            }
        }
    }
    // 阴线分析
    else if (lastClose < lastOpen) {
        klineDetails.push(`❌ 收阴线 (收盘 ${lastClose.toFixed(2)} < 开盘 ${lastOpen.toFixed(2)})，短期承压 (0分)`);

        // 阴线的详细分析
        if (bodyRatio > 0.7) {
            klineDetails.push(`⚠️ 大阴线 (实体占比 ${(bodyRatio * 100).toFixed(1)}%)，空头力量强劲，需谨慎`);
        } else if (lowerShadow > bodySize * 2) {
            klineDetails.push(`💡 虽收阴线，但下影线很长 (${lowerShadow.toFixed(2)})，表明下方有强支撑，可能是假跌`);
        }
    }
    // 十字星分析
    else {
        klineDetails.push(`⚠️ 收十字星 (开盘 ${lastOpen.toFixed(2)} = 收盘 ${lastClose.toFixed(2)})，多空博弈激烈，方向不明 (0分)`);

        // 十字星位置分析
        const recentLows = lows.slice(-20);
        const recentHighs = highs.slice(-20);
        const lowestPrice = Math.min(...recentLows);
        const highestPrice = Math.max(...recentHighs);
        const position = (lastClose - lowestPrice) / (highestPrice - lowestPrice);

        if (position < 0.3) {
            klineDetails.push(`🌟 十字星出现在底部区域 (相对位置 ${(position * 100).toFixed(1)}%)，可能是见底信号`);
        } else if (position > 0.7) {
            klineDetails.push(`⚠️ 十字星出现在高位 (相对位置 ${(position * 100).toFixed(1)}%)，警惕见顶风险`);
        }
    }

    // 1.2 连续K线形态分析
    let consecutive = 0;
    for (let i = len - 1; i > 0 && i > len - 4; i--) {
        if (closes[i] > closes[i - 1]) {
            consecutive++;
        } else {
            break;
        }
    }

    if (consecutive >= 3) {
        klineScore += 3;
        klineDetails.push(`✅ 连续${consecutive}日阳线，形成明显的上升通道，多头趋势强劲 (+3分)`);
    } else if (consecutive >= 2) {
        klineScore += 3;
        klineDetails.push(`✅ 连续${consecutive}日上涨，短期上升趋势初步形成 (+3分)`);
    } else if (consecutive === 1) {
        klineDetails.push(`⚠️ 仅1日上涨，趋势延续性待观察，需关注后续走势 (0分)`);
    } else {
        klineDetails.push(`❌ 未形成连续上涨，走势偏弱，建议等待企稳信号 (0分)`);
    }

    // 1.3 特殊K线形态识别
    if (len >= 3) {
        const prevClose2 = closes[len - 3];
        const prevClose1 = closes[len - 2];

        // 早晨之星（底部三根K线：大阴线+小十字星+大阳线）
        if (prevClose2 < opens[len - 3] && // 第一根是阴线
            Math.abs(prevClose1 - opens[len - 2]) < bodySize * 0.3 && // 第二根是小实体
            lastClose > lastOpen && bodyRatio > 0.6) { // 第三根是大阳线
            klineDetails.push(`🌅 疑似形成"早晨之星"形态，底部反转信号强烈！`);
        }

        // 红三兵（连续三根阳线，逐步上涨）
        if (len >= 3 &&
            closes[len - 3] > opens[len - 3] &&
            closes[len - 2] > opens[len - 2] &&
            lastClose > lastOpen &&
            closes[len - 2] > closes[len - 3] &&
            lastClose > closes[len - 2]) {
            klineDetails.push(`🎖️ 形成"红三兵"形态，连续三根阳线步步高升，多方力量强大！`);
        }
    }

    // 2. 支撑位得分 (15分)
    const currentPrice = closes[len - 1];

    // 2.1 相对位置分析（近20日）
    const recentLows = lows.slice(-20);
    const lowestPrice = Math.min(...recentLows);
    const highestPrice = Math.max(...highs.slice(-20));
    const priceRange = highestPrice - lowestPrice;
    const pricePosition = priceRange > 0 ? (currentPrice - lowestPrice) / priceRange : 0.5;

    if (pricePosition <= 0.2) {
        supportScore += 8;
        supportDetails.push(`✅ 价格位于近20日极低位 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，安全边际极高，上涨空间巨大 (+8分)`);
        supportDetails.push(`📊 当前价 ¥${currentPrice.toFixed(2)}，20日最低 ¥${lowestPrice.toFixed(2)}，20日最高 ¥${highestPrice.toFixed(2)}`);
    } else if (pricePosition <= 0.3) {
        supportScore += 8;
        supportDetails.push(`✅ 价格位于近期底部区域 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，安全边际较高，上涨空间大 (+8分)`);
    } else if (pricePosition <= 0.5) {
        supportScore += 5;
        supportDetails.push(`✅ 价格处于中低位 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，有一定上涨空间，风险适中 (+5分)`);
    } else if (pricePosition <= 0.7) {
        supportScore += 3;
        supportDetails.push(`⚠️ 价格处于中位 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，上涨空间一般，需谨慎评估 (+3分)`);
    } else if (pricePosition <= 0.85) {
        supportDetails.push(`⚠️ 价格处于相对高位 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，追高风险增加，建议等待回调 (0分)`);
    } else {
        supportDetails.push(`❌ 价格位于近期高位区域 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，追高风险较大，不建议此时介入 (0分)`);
    }

    // 2.2 均线支撑分析
    const ma5 = calculateSMA(closes, 5);
    const ma10 = calculateSMA(closes, 10);
    const ma20 = calculateSMA(closes, 20);
    const ma60 = calculateSMA(closes, 60);

    // MA20支撑分析
    if (ma20) {
        const ma20Deviation = Math.abs(currentPrice - ma20) / ma20;

        if (ma20Deviation < 0.01) {
            supportScore += 4;
            supportDetails.push(`✅ 价格精准触及MA20均线支撑 (偏离度仅 ${(ma20Deviation * 100).toFixed(2)}%)，支撑有效性极高 (+4分)`);
            supportDetails.push(`📍 MA20 = ¥${ma20.toFixed(2)}，当前价 = ¥${currentPrice.toFixed(2)}`);
        } else if (ma20Deviation < 0.02) {
            supportScore += 4;
            supportDetails.push(`✅ 价格回踩MA20均线支撑 (偏离度 ${(ma20Deviation * 100).toFixed(2)}%)，支撑有效 (+4分)`);
        } else if (currentPrice > ma20 && ma20Deviation < 0.05) {
            supportScore += 2;
            supportDetails.push(`✅ 价格在MA20均线附近运行 (高于MA20 ${((currentPrice - ma20) / ma20 * 100).toFixed(2)}%)，支撑可靠 (+2分)`);
        } else if (currentPrice > ma20) {
            const deviation = ((currentPrice - ma20) / ma20 * 100).toFixed(2);
            supportDetails.push(`⚠️ 价格高于MA20均线 ${deviation}%，未触及支撑位，可等待回调 (0分)`);
        } else {
            const breakdownPercent = ((ma20 - currentPrice) / ma20 * 100).toFixed(2);
            supportDetails.push(`❌ 价格跌破MA20均线 ${breakdownPercent}%，支撑失效，需等待重新站上 (0分)`);
        }
    }

    // MA60支撑分析（长期支撑）
    if (ma60 && currentPrice > ma60 * 0.95 && currentPrice < ma60 * 1.05) {
        supportDetails.push(`💡 价格在MA60半年线附近 (MA60 = ¥${ma60.toFixed(2)})，长期支撑位，关注度高`);
    }

    // 2.3 前期平台整理分析
    const recent10Closes = closes.slice(-10);
    const recent10High = Math.max(...recent10Closes);
    const recent10Low = Math.min(...recent10Closes);
    const volatility = recent10Low > 0 ? (recent10High - recent10Low) / recent10Low : 0;

    if (volatility < 0.03) {
        supportScore += 3;
        supportDetails.push(`✅ 近10日极窄幅整理 (波动率 ${(volatility * 100).toFixed(2)}% < 3%)，充分蓄势，随时可能突破 (+3分)`);
        supportDetails.push(`📐 10日振幅: ¥${(recent10High - recent10Low).toFixed(2)} (${(volatility * 100).toFixed(2)}%)`);
    } else if (volatility < 0.05) {
        supportScore += 3;
        supportDetails.push(`✅ 近10日窄幅整理 (波动率 ${(volatility * 100).toFixed(2)}% < 5%)，蓄势待发，形态良好 (+3分)`);
    } else if (volatility < 0.08) {
        supportScore += 1;
        supportDetails.push(`⚠️ 近期小幅震荡 (波动率 ${(volatility * 100).toFixed(2)}%)，整理幅度一般，需继续观察 (+1分)`);
    } else if (volatility < 0.15) {
        supportDetails.push(`⚠️ 近期波动率 ${(volatility * 100).toFixed(2)}%，震荡幅度较大，走势不够稳定 (0分)`);
    } else {
        supportDetails.push(`❌ 近期波动较大 (波动率 ${(volatility * 100).toFixed(2)}%)，走势不稳定，风险较高 (0分)`);
    }

    // 2.4 突破整理平台分析
    if (len >= 20) {
        const recent20High = Math.max(...closes.slice(-20, -1)); // 前19日最高
        const recent20Low = Math.min(...closes.slice(-20, -1));  // 前19日最低

        if (currentPrice > recent20High) {
            const breakoutPercent = ((currentPrice - recent20High) / recent20High * 100).toFixed(2);
            supportDetails.push(`🚀 突破近20日平台高点！(突破幅度 ${breakoutPercent}%)，形态向上突破，追涨信号`);
        }
    }

    // 2.5 黄金分割位分析
    const fibonacciLevels = {
        '0.236': lowestPrice + priceRange * 0.236,
        '0.382': lowestPrice + priceRange * 0.382,
        '0.500': lowestPrice + priceRange * 0.500,
        '0.618': lowestPrice + priceRange * 0.618
    };

    for (const [level, price] of Object.entries(fibonacciLevels)) {
        const deviation = Math.abs(currentPrice - price) / price;
        if (deviation < 0.02) {
            supportDetails.push(`📐 价格位于黄金分割 ${level} 位 (¥${price.toFixed(2)})，关键支撑/压力位`);
            break;
        }
    }

    return {
        pattern_score: Math.min(25, klineScore + supportScore),
        kline_score: klineScore,
        support_score: supportScore,
        // 详细评分说明
        kline_details: klineDetails,
        support_details: supportDetails
    };
}

/**
 * 计算市场环境得分 (20分)
 */
function calculateMarketScore(indexData, sectorStrength) {
    let indexScore = 0;      // 大盘得分 (10分)
    let sectorScore = 0;     // 板块得分 (10分)

    // 详细评分说明
    const indexDetails = [];
    const sectorDetails = [];

    // 1. 大盘得分 (10分)
    if (indexData && indexData.trend) {
        if (indexData.trend === 'up') {
            indexScore = 10;
            indexDetails.push(`✅ 大盘趋势向上，市场情绪乐观，有利于个股表现 (+10分)`);

            // 详细分析大盘强度
            if (indexData.changePercent && indexData.changePercent > 2) {
                indexDetails.push(`🚀 大盘涨幅 ${indexData.changePercent.toFixed(2)}% > 2%，强势上涨，做多氛围浓厚`);
            } else if (indexData.changePercent && indexData.changePercent > 1) {
                indexDetails.push(`📈 大盘温和上涨 ${indexData.changePercent.toFixed(2)}%，市场稳健向好`);
            }

            // 分析成交量
            if (indexData.volumeRatio && indexData.volumeRatio > 1.2) {
                indexDetails.push(`📊 大盘成交量放大 (量比 ${indexData.volumeRatio.toFixed(2)})，资金积极入场，上涨动能充足`);
            }
        } else if (indexData.trend === 'neutral') {
            indexScore = 5;
            indexDetails.push(`⚠️ 大盘横盘震荡，市场观望情绪浓厚，结构性机会为主 (+5分)`);

            // 详细分析震荡区间
            if (indexData.changePercent !== undefined) {
                indexDetails.push(`📊 大盘涨跌幅 ${indexData.changePercent > 0 ? '+' : ''}${indexData.changePercent.toFixed(2)}%，窄幅波动`);
            }

            if (indexData.volumeRatio && indexData.volumeRatio < 0.8) {
                indexDetails.push(`⚠️ 大盘成交量萎缩 (量比 ${indexData.volumeRatio.toFixed(2)})，场外资金观望，需等待方向选择`);
            }
        } else {
            indexScore = 2;
            indexDetails.push(`❌ 大盘趋势向下，市场情绪偏弱，不利于操作 (+2分)`);

            // 详细分析下跌程度
            if (indexData.changePercent && indexData.changePercent < -2) {
                indexDetails.push(`⚠️ 大盘大幅下跌 ${indexData.changePercent.toFixed(2)}%，市场恐慌情绪蔓延，建议空仓观望`);
            } else if (indexData.changePercent && indexData.changePercent < -1) {
                indexDetails.push(`📉 大盘调整 ${indexData.changePercent.toFixed(2)}%，市场承压，需谨慎操作`);
            }

            // 分析是否超跌
            if (indexData.oversold) {
                indexDetails.push(`💡 大盘处于超卖区域，短期存在技术性反弹机会，但需确认企稳信号`);
            }
        }
    } else {
        // 默认给中性分数，并说明原因
        indexScore = 5;
        indexDetails.push(`⚠️ 大盘数据暂缺，按中性环境评估 (+5分)`);
        indexDetails.push(`💡 建议查看上证指数、深证成指、创业板指等主要指数走势，判断市场整体环境`);
    }

    // 补充大盘技术位分析
    if (indexData && indexData.position) {
        if (indexData.position === 'low') {
            indexDetails.push(`🔽 大盘位于相对低位，安全边际较高，适合布局优质个股`);
        } else if (indexData.position === 'high') {
            indexDetails.push(`🔼 大盘位于相对高位，追高需谨慎，注意控制仓位`);
        } else {
            indexDetails.push(`📍 大盘位于中位，保持观察，根据个股强弱决定操作`);
        }
    }

    // 2. 板块得分 (10分)
    if (sectorStrength !== null && sectorStrength !== undefined) {
        if (sectorStrength >= 0.7) {
            sectorScore = 10;
            sectorDetails.push(`✅ 所属板块强势领涨 (板块强度 ${(sectorStrength * 100).toFixed(0)}%)，热点效应明显，个股易受关注 (+10分)`);
            sectorDetails.push(`🔥 板块强度 >= 70%，资金高度集中，做多情绪高涨，适合积极参与`);
        } else if (sectorStrength >= 0.5) {
            sectorScore = 7;
            sectorDetails.push(`✅ 所属板块表现良好 (板块强度 ${(sectorStrength * 100).toFixed(0)}%)，有一定资金关注 (+7分)`);
            sectorDetails.push(`📊 板块强度 50-70%，板块热度适中，个股机会较多，可适度参与`);
        } else if (sectorStrength >= 0.3) {
            sectorScore = 4;
            sectorDetails.push(`⚠️ 所属板块表现一般 (板块强度 ${(sectorStrength * 100).toFixed(0)}%)，资金关注度不高 (+4分)`);
            sectorDetails.push(`💡 板块强度 30-50%，板块跟随市场，需精选个股，择优参与`);
        } else {
            sectorScore = 2;
            sectorDetails.push(`❌ 所属板块表现疲弱 (板块强度 ${(sectorStrength * 100).toFixed(0)}%)，资金流出明显 (+2分)`);
            sectorDetails.push(`⚠️ 板块强度 < 30%，板块整体承压，个股逆势上涨难度大，建议观望`);
        }

        // 补充板块资金流向分析
        sectorDetails.push(`💰 板块强度反映了板块内个股的整体表现，强度越高代表板块资金越活跃`);
    } else {
        // 默认给中性分数
        sectorScore = 5;
        sectorDetails.push(`⚠️ 板块数据暂缺，按中性环境评估 (+5分)`);
        sectorDetails.push(`💡 建议关注个股所属行业和概念板块的表现，判断板块热度和资金流向`);
        sectorDetails.push(`📌 热门板块如新能源、半导体、医药、消费等通常资金关注度更高`);
    }

    // 补充市场环境综合建议
    const marketDetails = [];

    if (indexScore >= 8 && sectorScore >= 8) {
        marketDetails.push(`🌟 市场环境极佳！大盘和板块双双强势，当前是绝佳的做多窗口`);
    } else if (indexScore >= 5 && sectorScore >= 5) {
        marketDetails.push(`✅ 市场环境尚可，具备一定操作机会，注意控制仓位和风险`);
    } else if (indexScore < 5 || sectorScore < 5) {
        marketDetails.push(`⚠️ 市场环境偏弱，操作难度较大，建议降低仓位或空仓观望`);
    }

    if (indexScore >= 8 && sectorScore < 5) {
        marketDetails.push(`💡 大盘强但板块弱，可能是板块轮动，关注其他强势板块的机会`);
    } else if (indexScore < 5 && sectorScore >= 8) {
        marketDetails.push(`💡 大盘弱但板块强，个股存在逆市机会，但需严格止损`);
    }

    return {
        market_score: indexScore + sectorScore,
        index_score: indexScore,
        sector_score: sectorScore,
        // 详细评分说明
        index_details: indexDetails,
        sector_details: sectorDetails,
        market_details: marketDetails
    };
}

/**
 * 计算风险控制得分 (15分)
 */
function calculateRiskScore(stockData, indicators) {
    let positionRisk = 0;      // 位置风险 (5分)
    let volatilityRisk = 0;    // 波动风险 (5分)
    let signalRisk = 0;        // 信号风险 (5分)

    // 详细评分说明
    const positionRiskDetails = [];
    const volatilityRiskDetails = [];
    const signalRiskDetails = [];

    const { closes, highs, lows } = stockData;
    const currentPrice = closes[closes.length - 1];

    // 1. 位置风险分析 (5分) - 价格相对位置越低，风险越小
    const recent60Highs = highs.slice(-60);
    const recent60Lows = lows.slice(-60);
    const highest60 = Math.max(...recent60Highs);
    const lowest60 = Math.min(...recent60Lows);
    const priceRange60 = highest60 - lowest60;
    const pricePosition = priceRange60 > 0 ? (currentPrice - lowest60) / priceRange60 : 0.5;

    if (pricePosition <= 0.2) {
        positionRisk = 5;
        positionRiskDetails.push(`✅ 价格位于近60日极低位 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，安全边际极高 (+5分)`);
        positionRiskDetails.push(`🛡️ 当前价 ¥${currentPrice.toFixed(2)} vs 60日最低 ¥${lowest60.toFixed(2)} vs 60日最高 ¥${highest60.toFixed(2)}`);
        positionRiskDetails.push(`💡 处于历史低位，下跌空间有限，上涨潜力大，风险控制优秀`);
    } else if (pricePosition <= 0.3) {
        positionRisk = 5;
        positionRiskDetails.push(`✅ 价格位于近60日低位区域 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，安全边际高 (+5分)`);
        positionRiskDetails.push(`📊 60日振幅 ¥${priceRange60.toFixed(2)} (${(priceRange60 / lowest60 * 100).toFixed(1)}%)，当前接近底部`);
    } else if (pricePosition <= 0.5) {
        positionRisk = 4;
        positionRiskDetails.push(`✅ 价格位于近60日中低位 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，风险适中 (+4分)`);
        positionRiskDetails.push(`💡 距离60日低点 ${((currentPrice - lowest60) / lowest60 * 100).toFixed(1)}%，距离高点 ${((highest60 - currentPrice) / currentPrice * 100).toFixed(1)}%`);
    } else if (pricePosition <= 0.7) {
        positionRisk = 3;
        positionRiskDetails.push(`⚠️ 价格位于近60日中高位 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，需警惕回调风险 (+3分)`);
        positionRiskDetails.push(`📍 已上涨 ${((currentPrice - lowest60) / lowest60 * 100).toFixed(1)}%，需关注阻力位`);
    } else if (pricePosition <= 0.85) {
        positionRisk = 2;
        positionRiskDetails.push(`⚠️ 价格位于近60日高位 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，追高风险较大 (+2分)`);
        positionRiskDetails.push(`🔴 距离60日高点仅 ${((highest60 - currentPrice) / currentPrice * 100).toFixed(1)}%，上方压力较重`);
        positionRiskDetails.push(`💡 建议等待回调至中位再介入，降低持仓成本`);
    } else {
        positionRisk = 1;
        positionRiskDetails.push(`❌ 价格位于近60日极高位 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，风险极高 (+1分)`);
        positionRiskDetails.push(`⚠️ 当前价格接近或创出60日新高，回调风险大，不建议追高`);
        positionRiskDetails.push(`💡 高位买入容易被套，建议等待明确回调后的支撑确认`);
    }

    // 补充止损位建议
    const ma20 = calculateSMA(closes, 20);
    if (ma20) {
        const stopLossPrice = (ma20 * 0.95).toFixed(2);
        const stopLossPercent = ((currentPrice - ma20 * 0.95) / currentPrice * 100).toFixed(1);
        positionRiskDetails.push(`🎯 建议止损位: ¥${stopLossPrice} (MA20下方5%)，止损空间约 ${stopLossPercent}%`);
    }

    // 2. 波动风险分析 (5分) - 价格波动越小，风险越小
    const recent20Closes = closes.slice(-20);
    const high20 = Math.max(...recent20Closes);
    const low20 = Math.min(...recent20Closes);
    const volatility = low20 > 0 ? (high20 - low20) / low20 : 0;

    if (volatility <= 0.1) {
        volatilityRisk = 5;
        volatilityRiskDetails.push(`✅ 近20日波动率极低 (${(volatility * 100).toFixed(2)}% ≤ 10%)，走势稳健 (+5分)`);
        volatilityRiskDetails.push(`📊 20日振幅仅 ¥${(high20 - low20).toFixed(2)}，价格稳定，适合稳健型投资者`);
        volatilityRiskDetails.push(`💡 低波动表明筹码锁定良好，突破后往往爆发力强`);
    } else if (volatility <= 0.15) {
        volatilityRisk = 5;
        volatilityRiskDetails.push(`✅ 近20日波动率较低 (${(volatility * 100).toFixed(2)}% ≤ 15%)，风险可控 (+5分)`);
        volatilityRiskDetails.push(`📐 20日振幅 ¥${(high20 - low20).toFixed(2)}，整理充分`);
    } else if (volatility <= 0.2) {
        volatilityRisk = 4;
        volatilityRiskDetails.push(`✅ 近20日波动率正常 (${(volatility * 100).toFixed(2)}% ≤ 20%)，风险适中 (+4分)`);
        volatilityRiskDetails.push(`📊 波动幅度在合理范围内，价格有一定弹性`);
    } else if (volatility <= 0.3) {
        volatilityRisk = 3;
        volatilityRiskDetails.push(`⚠️ 近20日波动率偏高 (${(volatility * 100).toFixed(2)}% ≤ 30%)，需注意风险 (+3分)`);
        volatilityRiskDetails.push(`📈 价格震荡幅度较大，短线波动风险增加，建议控制仓位`);
    } else if (volatility <= 0.5) {
        volatilityRisk = 2;
        volatilityRiskDetails.push(`⚠️ 近20日波动率较大 (${(volatility * 100).toFixed(2)}% ≤ 50%)，风险较高 (+2分)`);
        volatilityRiskDetails.push(`🔴 价格大幅震荡，高抛低吸难度大，不适合稳健投资者`);
        volatilityRiskDetails.push(`💡 高波动意味着高风险高收益，需有较强的风险承受能力`);
    } else {
        volatilityRisk = 1;
        volatilityRiskDetails.push(`❌ 近20日波动率极大 (${(volatility * 100).toFixed(2)}% > 50%)，风险极高 (+1分)`);
        volatilityRiskDetails.push(`⚠️ 价格剧烈波动，可能存在重大消息或主力操控，极易造成亏损`);
        volatilityRiskDetails.push(`🚨 建议观望，等待价格稳定后再考虑介入`);
    }

    // 补充日内波动分析
    if (closes.length >= 5) {
        const recent5Volatility = (Math.max(...closes.slice(-5)) - Math.min(...closes.slice(-5))) / Math.min(...closes.slice(-5));
        if (recent5Volatility > volatility * 1.5) {
            volatilityRiskDetails.push(`⚠️ 近5日波动率 ${(recent5Volatility * 100).toFixed(2)}% 远超20日均值，短期波动加剧`);
        } else if (recent5Volatility < volatility * 0.5) {
            volatilityRiskDetails.push(`✅ 近5日波动收敛 (${(recent5Volatility * 100).toFixed(2)}%)，价格趋于稳定`);
        }
    }

    // 3. 技术信号风险分析 (5分) - 检查超买超卖和背离
    const rsi = indicators.rsi;
    const { k, d } = indicators.kdj;
    const { dif, dea } = indicators.macd;

    let riskSignalCount = 0;
    let warningSignalCount = 0;

    // RSI超买超卖分析
    if (rsi !== null) {
        if (rsi > 80) {
            signalRisk = 1;
            riskSignalCount++;
            signalRiskDetails.push(`❌ RSI严重超买 (${rsi.toFixed(2)} > 80)，短期调整压力极大 (+1分)`);
            signalRiskDetails.push(`🔴 超买区域持续时间过长，随时可能引发获利回吐，建议减仓或止盈`);
        } else if (rsi > 70) {
            signalRisk = Math.max(signalRisk, 3);
            warningSignalCount++;
            signalRiskDetails.push(`⚠️ RSI超买 (${rsi.toFixed(2)} > 70)，存在短期回调风险 (+3分)`);
            signalRiskDetails.push(`💡 超买但未达极值，可持股观望，但需设好止盈位`);
        } else if (rsi >= 50 && rsi <= 70) {
            if (signalRisk < 4) signalRisk = 4;
            signalRiskDetails.push(`✅ RSI健康区间 (${rsi.toFixed(2)}, 50-70)，多头强势但未超买 (+4分)`);
        } else if (rsi >= 30 && rsi < 50) {
            if (signalRisk < 5) signalRisk = 5;
            signalRiskDetails.push(`✅ RSI中性偏弱 (${rsi.toFixed(2)}, 30-50)，技术面无风险信号 (+5分)`);
        } else if (rsi >= 20 && rsi < 30) {
            if (signalRisk < 5) signalRisk = 5;
            signalRiskDetails.push(`💡 RSI接近超卖 (${rsi.toFixed(2)}, 20-30)，存在反弹机会，风险可控 (+5分)`);
        } else {
            if (signalRisk < 5) signalRisk = 5;
            signalRiskDetails.push(`🌟 RSI深度超卖 (${rsi.toFixed(2)} < 20)，底部区域，反弹概率大 (+5分)`);
        }
    }

    // KDJ超买超卖分析
    if (k !== null && d !== null) {
        if (k > 90 && d > 80) {
            if (rsi === null || rsi <= 80) {
                signalRisk = Math.min(signalRisk, 2);
            }
            riskSignalCount++;
            signalRiskDetails.push(`⚠️ KDJ严重超买 (K=${k.toFixed(2)}, D=${d.toFixed(2)})，短期有调整需求`);
        } else if (k > 80) {
            warningSignalCount++;
            signalRiskDetails.push(`⚠️ KDJ进入超买区 (K=${k.toFixed(2)})，注意高位震荡风险`);
        } else if (k < 20 && d < 30) {
            signalRiskDetails.push(`💡 KDJ超卖 (K=${k.toFixed(2)}, D=${d.toFixed(2)})，底部反弹机会，降低风险`);
        } else if (k >= 20 && k <= 80) {
            signalRiskDetails.push(`✅ KDJ健康区间 (K=${k.toFixed(2)})，指标无异常信号`);
        }

        // KDJ钝化分析
        if (k > 90 && closes.length >= 5) {
            let overboughtDays = 0;
            // 检查KDJ高位钝化（简化逻辑）
            if (k > 85 && d > 75) {
                overboughtDays = 3; // 假设
                signalRiskDetails.push(`⚠️ KDJ高位钝化迹象，强势上涨，但需警惕突然转向`);
            }
        }
    }

    // MACD背离分析
    if (dif !== null && dea !== null && closes.length >= 10) {
        const currentDif = dif;
        const priceChange = (closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5];

        // 顶背离：价格创新高，但DIF未创新高
        if (priceChange > 0.05 && currentDif < dea) {
            riskSignalCount++;
            signalRiskDetails.push(`⚠️ 疑似MACD顶背离，价格新高但指标走弱，警惕见顶风险`);
        }

        // 底背离：价格创新低，但DIF未创新低
        if (priceChange < -0.05 && currentDif > dea) {
            signalRiskDetails.push(`💡 疑似MACD底背离，价格新低但指标走强，可能见底反弹`);
        }

        // MACD红柱收缩
        if (dif > dea && (dif - dea) < 0.1) {
            signalRiskDetails.push(`💡 MACD红柱缩短，上涨动能减弱，注意观察是否转弱`);
        }
    }

    // 无风险信号时的默认得分
    if (signalRisk === 0) {
        signalRisk = 5;
        signalRiskDetails.push(`✅ 技术指标无明显风险信号，安全性较高 (+5分)`);
    }

    // 综合风险评估
    const riskDetails = [];
    const totalRisk = positionRisk + volatilityRisk + signalRisk;

    if (totalRisk >= 13) {
        riskDetails.push(`🛡️ 综合风险控制优秀 (${totalRisk}/15分)，当前是较安全的买入时机`);
    } else if (totalRisk >= 10) {
        riskDetails.push(`✅ 综合风险控制良好 (${totalRisk}/15分)，风险处于可控范围`);
    } else if (totalRisk >= 7) {
        riskDetails.push(`⚠️ 综合风险适中 (${totalRisk}/15分)，需做好止损准备`);
    } else {
        riskDetails.push(`🔴 综合风险偏高 (${totalRisk}/15分)，建议谨慎操作或降低仓位`);
    }

    if (riskSignalCount >= 2) {
        riskDetails.push(`⚠️ 检测到 ${riskSignalCount} 个高风险信号，强烈建议控制仓位或观望`);
    } else if (warningSignalCount >= 2) {
        riskDetails.push(`💡 检测到 ${warningSignalCount} 个预警信号，建议谨慎操作`);
    } else if (riskSignalCount === 0 && warningSignalCount === 0) {
        riskDetails.push(`✅ 未检测到明显风险信号，技术面健康`);
    }

    return {
        risk_score: positionRisk + volatilityRisk + signalRisk,
        position_risk: positionRisk,
        volatility_risk: volatilityRisk,
        signal_risk: signalRisk,
        // 详细评分说明
        position_risk_details: positionRiskDetails,
        volatility_risk_details: volatilityRiskDetails,
        signal_risk_details: signalRiskDetails,
        risk_details: riskDetails
    };
}

/**
 * 生成买入建议
 */
function generateRecommendation(totalScore, scores, stockData, indicators) {
    const currentPrice = stockData.closes[stockData.closes.length - 1];
    const ma20 = calculateSMA(stockData.closes, 20);

    let recommendation = '';
    let riskWarning = '';
    let buyPriceRange = '';
    let stopLossPrice = null;
    let targetPrice = null;
    let positionAdvice = '';

    // 根据总分给出建议
    if (totalScore >= 80) {
        recommendation = '强烈推荐买入。该股票当前处于理想买入点，技术形态良好，市场环境支持，风险可控。建议积极关注并考虑建仓。';
        positionAdvice = '可考虑30-50%仓位';
        buyPriceRange = `${(currentPrice * 0.98).toFixed(2)} - ${(currentPrice * 1.02).toFixed(2)}`;
        stopLossPrice = ma20 ? (ma20 * 0.95).toFixed(2) : (currentPrice * 0.92).toFixed(2);
        targetPrice = (currentPrice * 1.15).toFixed(2);
    } else if (totalScore >= 60) {
        recommendation = '推荐买入。该股票具备较好的买入价值，技术面表现良好，但需关注部分风险因素。建议适当建仓。';
        positionAdvice = '可考虑20-30%仓位';
        buyPriceRange = `${(currentPrice * 0.98).toFixed(2)} - ${(currentPrice * 1.01).toFixed(2)}`;
        stopLossPrice = ma20 ? (ma20 * 0.96).toFixed(2) : (currentPrice * 0.93).toFixed(2);
        targetPrice = (currentPrice * 1.10).toFixed(2);
    } else if (totalScore >= 40) {
        recommendation = '谨慎观察。该股票当前买入价值一般，存在一定风险。建议继续观察，等待更好的买入时机。';
        positionAdvice = '建议观察，若买入不超过10%仓位';
        buyPriceRange = `建议等待回调至 ${(currentPrice * 0.95).toFixed(2)} 附近`;
        stopLossPrice = (currentPrice * 0.94).toFixed(2);
        targetPrice = (currentPrice * 1.08).toFixed(2);
    } else {
        recommendation = '不建议买入。该股票当前不具备买入价值，风险较大或时机不佳。建议等待更好的机会。';
        positionAdvice = '不建议买入';
        buyPriceRange = '不建议当前价位买入';
        stopLossPrice = null;
        targetPrice = null;
    }

    // 风险提示
    const warnings = [];

    if (scores.risk_score < 8) {
        warnings.push('风险控制得分偏低，需警惕回调风险');
    }

    if (scores.position_risk < 3) {
        warnings.push('价格位置偏高，追高风险较大');
    }

    if (indicators.rsi > 70) {
        warnings.push('RSI超买，短期可能面临调整');
    }

    if (scores.market_score < 10) {
        warnings.push('市场环境一般，需关注大盘走势');
    }

    if (warnings.length > 0) {
        riskWarning = warnings.join('；');
    } else {
        riskWarning = '当前风险可控，但仍需做好止损准备';
    }

    return {
        recommendation,
        riskWarning,
        buyPriceRange,
        stopLossPrice,
        targetPrice,
        positionAdvice
    };
}

/**
 * 获取评级等级
 */
function getRatingLevel(score) {
    if (score >= 80) return '优秀';
    if (score >= 60) return '良好';
    if (score >= 40) return '一般';
    return '较差';
}

// ==================== 股票数据获取 ====================

/**
 * 获取股票历史K线数据
 */
async function fetchStockKlineData(stockCode, days = 120) {
    try {
        // 构建市场代码前缀
        const marketPrefix = stockCode.startsWith('6') ? 'sh' : 'sz';
        const fullCode = `${marketPrefix}${stockCode}`;

        // 从腾讯财经获取日K线数据
        const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get`;

        const response = await axios.get(url, {
            params: {
                param: `${fullCode},day,,,${days},qfq`,
                _var: `kline_day${fullCode}`
            },
            headers: {
                'Referer': 'https://gu.qq.com',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 10000
        });

        let jsonData = response.data;

        // 解析 JSONP 格式
        if (typeof jsonData === 'string') {
            const match = jsonData.match(/=({.+})/);
            if (match && match[1]) {
                jsonData = JSON.parse(match[1]);
            }
        }

        if (!jsonData || !jsonData.data || !jsonData.data[fullCode] || !jsonData.data[fullCode].qfqday) {
            throw new Error('获取K线数据失败');
        }

        const klineData = jsonData.data[fullCode].qfqday;

        // 提取 OHLCV 数据
        const opens = [];
        const highs = [];
        const lows = [];
        const closes = [];
        const volumes = [];

        klineData.forEach(item => {
            // item format: ["2024-01-01", "100.00", "102.00", "99.00", "101.00", "1000000"]
            // [date, open, close, high, low, volume]
            opens.push(parseFloat(item[1]));
            closes.push(parseFloat(item[2]));
            highs.push(parseFloat(item[3]));
            lows.push(parseFloat(item[4]));
            volumes.push(parseFloat(item[5]));
        });

        return {
            opens,
            highs,
            lows,
            closes,
            volumes,
            dates: klineData.map(item => item[0])
        };

    } catch (error) {
        console.error(`获取股票 ${stockCode} K线数据失败:`, error.message);
        throw error;
    }
}

/**
 * 获取当前股价
 */
async function fetchCurrentPrice(stockCode) {
    try {
        const marketPrefix = stockCode.startsWith('6') ? 'sh' : 'sz';
        const fullCode = `${marketPrefix}${stockCode}`;

        const response = await axios.get(`https://qt.gtimg.cn/q=${fullCode}`, {
            headers: {
                'Referer': 'https://gu.qq.com',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 5000
        });

        const data = response.data.split('~');
        return parseFloat(data[3]); // 当前价格

    } catch (error) {
        console.error(`获取股票 ${stockCode} 当前价格失败:`, error.message);
        return null;
    }
}

// ==================== API 端点处理器 ====================

/**
 * 验证单个股票的买入点
 */
async function validateBuyPoint(req, res) {
    try {
        const userId = req.user.id;
        const { stockCode, stockName } = req.body;

        if (!stockCode) {
            return res.status(400).json({
                success: false,
                message: '股票代码不能为空'
            });
        }

        console.log(`📊 开始验证股票 ${stockCode} (${stockName}) 的买入点...`);

        // 1. 获取股票历史数据
        const stockData = await fetchStockKlineData(stockCode);

        // 2. 计算技术指标
        const macd = calculateMACD(stockData.closes);
        const kdj = calculateKDJ(stockData.highs, stockData.lows, stockData.closes);
        const rsi = calculateRSI(stockData.closes);

        const indicators = { macd, kdj, rsi };

        // 3. 计算各维度得分
        const technicalScores = calculateTechnicalScore(stockData, indicators);
        const patternScores = calculatePatternScore(stockData);
        const marketScores = calculateMarketScore(null, null); // 暂时使用默认值
        const riskScores = calculateRiskScore(stockData, indicators);

        // 4. 计算总分
        const totalScore =
            technicalScores.technical_score +
            patternScores.pattern_score +
            marketScores.market_score +
            riskScores.risk_score;

        const allScores = {
            ...technicalScores,
            ...patternScores,
            ...marketScores,
            ...riskScores
        };

        // 5. 生成建议
        const advice = generateRecommendation(totalScore, allScores, stockData, indicators);
        const ratingLevel = getRatingLevel(totalScore);

        // 6. 获取当前股价
        const currentPrice = await fetchCurrentPrice(stockCode);

        // 7. 保存验证记录
        const stmt = db.prepare(`
            INSERT INTO buy_point_validations (
                user_id, stock_code, stock_name, validation_time, stock_price,
                total_score, rating_level,
                technical_score, trend_score, volume_score, indicator_score,
                pattern_score, kline_score, support_score,
                market_score, index_score, sector_score,
                risk_score, position_risk, volatility_risk, signal_risk,
                indicators_data,
                recommendation, risk_warning, buy_price_range,
                stop_loss_price, target_price, position_advice
            ) VALUES (
                ?, ?, ?, datetime('now', 'localtime'), ?,
                ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?,
                ?, ?, ?,
                ?, ?, ?
            )
        `);

        const indicatorsData = JSON.stringify({
            macd: {
                dif: macd.dif ? macd.dif.toFixed(3) : null,
                dea: macd.dea ? macd.dea.toFixed(3) : null,
                macd: macd.macd ? macd.macd.toFixed(3) : null
            },
            kdj: {
                k: kdj.k ? kdj.k.toFixed(2) : null,
                d: kdj.d ? kdj.d.toFixed(2) : null,
                j: kdj.j ? kdj.j.toFixed(2) : null
            },
            rsi: rsi ? rsi.toFixed(2) : null,
            ma5: calculateSMA(stockData.closes, 5)?.toFixed(2),
            ma10: calculateSMA(stockData.closes, 10)?.toFixed(2),
            ma20: calculateSMA(stockData.closes, 20)?.toFixed(2),
            ma60: calculateSMA(stockData.closes, 60)?.toFixed(2)
        });

        const result = stmt.run(
            userId, stockCode, stockName, currentPrice,
            totalScore, ratingLevel,
            allScores.technical_score, allScores.trend_score, allScores.volume_score, allScores.indicator_score,
            allScores.pattern_score, allScores.kline_score, allScores.support_score,
            allScores.market_score, allScores.index_score, allScores.sector_score,
            allScores.risk_score, allScores.position_risk, allScores.volatility_risk, allScores.signal_risk,
            indicatorsData,
            advice.recommendation, advice.riskWarning, advice.buyPriceRange,
            advice.stopLossPrice, advice.targetPrice, advice.positionAdvice
        );

        console.log(`✅ 股票 ${stockCode} 验证完成，总分: ${totalScore}，评级: ${ratingLevel}`);

        res.json({
            success: true,
            data: {
                id: result.lastInsertRowid,
                stockCode,
                stockName,
                currentPrice,
                totalScore,
                ratingLevel,
                scores: allScores,
                indicators: JSON.parse(indicatorsData),
                advice
            }
        });

    } catch (error) {
        console.error('❌ 验证买入点失败:', error);
        res.status(500).json({
            success: false,
            message: '验证买入点失败',
            error: error.message
        });
    }
}

/**
 * 批量验证多个股票
 */
async function batchValidate(req, res) {
    try {
        const userId = req.user.id;
        const { stocks } = req.body; // [{stockCode, stockName}, ...]

        if (!Array.isArray(stocks) || stocks.length === 0) {
            return res.status(400).json({
                success: false,
                message: '股票列表不能为空'
            });
        }

        console.log(`📊 开始批量验证 ${stocks.length} 只股票...`);

        const results = [];
        const errors = [];

        for (const stock of stocks) {
            try {
                // 调用单个验证逻辑
                const stockData = await fetchStockKlineData(stock.stockCode);

                const macd = calculateMACD(stockData.closes);
                const kdj = calculateKDJ(stockData.highs, stockData.lows, stockData.closes);
                const rsi = calculateRSI(stockData.closes);
                const indicators = { macd, kdj, rsi };

                const technicalScores = calculateTechnicalScore(stockData, indicators);
                const patternScores = calculatePatternScore(stockData);
                const marketScores = calculateMarketScore(null, null);
                const riskScores = calculateRiskScore(stockData, indicators);

                const totalScore =
                    technicalScores.technical_score +
                    patternScores.pattern_score +
                    marketScores.market_score +
                    riskScores.risk_score;

                const ratingLevel = getRatingLevel(totalScore);

                results.push({
                    stockCode: stock.stockCode,
                    stockName: stock.stockName,
                    totalScore,
                    ratingLevel,
                    success: true
                });

                // 延迟避免API限流
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`验证股票 ${stock.stockCode} 失败:`, error.message);
                errors.push({
                    stockCode: stock.stockCode,
                    stockName: stock.stockName,
                    error: error.message
                });
            }
        }

        // 按总分排序
        results.sort((a, b) => b.totalScore - a.totalScore);

        console.log(`✅ 批量验证完成，成功 ${results.length} 只，失败 ${errors.length} 只`);

        res.json({
            success: true,
            data: {
                results,
                errors,
                total: stocks.length,
                successCount: results.length,
                errorCount: errors.length
            }
        });

    } catch (error) {
        console.error('❌ 批量验证失败:', error);
        res.status(500).json({
            success: false,
            message: '批量验证失败',
            error: error.message
        });
    }
}

/**
 * 获取历史验证记录
 */
async function getValidationHistory(req, res) {
    try {
        const userId = req.user.id;
        const { stockCode, limit = 20, offset = 0 } = req.query;

        let query = `
            SELECT * FROM buy_point_validations
            WHERE user_id = ?
        `;
        const params = [userId];

        if (stockCode) {
            query += ` AND stock_code = ?`;
            params.push(stockCode);
        }

        query += ` ORDER BY validation_time DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const records = db.prepare(query).all(...params);

        // 解析 JSON 字段
        records.forEach(record => {
            if (record.indicators_data) {
                record.indicators = JSON.parse(record.indicators_data);
                delete record.indicators_data;
            }
        });

        // 获取总数
        let countQuery = `SELECT COUNT(*) as total FROM buy_point_validations WHERE user_id = ?`;
        const countParams = [userId];

        if (stockCode) {
            countQuery += ` AND stock_code = ?`;
            countParams.push(stockCode);
        }

        const { total } = db.prepare(countQuery).get(...countParams);

        res.json({
            success: true,
            data: {
                records,
                total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error('❌ 获取历史记录失败:', error);
        res.status(500).json({
            success: false,
            message: '获取历史记录失败',
            error: error.message
        });
    }
}

/**
 * 获取验证配置
 */
async function getValidationConfig(req, res) {
    try {
        const userId = req.user.id;

        const config = db.prepare(`
            SELECT * FROM validation_configs
            WHERE user_id = ? AND is_default = 1
        `).get(userId);

        if (!config) {
            // 返回系统默认配置
            return res.json({
                success: true,
                data: {
                    weights: {
                        technical: 40,
                        pattern: 25,
                        market: 20,
                        risk: 15
                    },
                    thresholds: {
                        excellent: 80,
                        good: 60,
                        neutral: 40,
                        poor: 20
                    }
                }
            });
        }

        res.json({
            success: true,
            data: {
                id: config.id,
                name: config.config_name,
                weights: JSON.parse(config.weights),
                thresholds: JSON.parse(config.thresholds)
            }
        });

    } catch (error) {
        console.error('❌ 获取配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取配置失败',
            error: error.message
        });
    }
}

/**
 * 更新用户笔记
 */
async function updateUserNotes(req, res) {
    try {
        const userId = req.user.id;
        const { validationId, notes } = req.body;

        const stmt = db.prepare(`
            UPDATE buy_point_validations
            SET user_notes = ?
            WHERE id = ? AND user_id = ?
        `);

        stmt.run(notes, validationId, userId);

        res.json({
            success: true,
            message: '笔记更新成功'
        });

    } catch (error) {
        console.error('❌ 更新笔记失败:', error);
        res.status(500).json({
            success: false,
            message: '更新笔记失败',
            error: error.message
        });
    }
}

/**
 * 标记是否跟随操作
 */
async function markAsFollowed(req, res) {
    try {
        const userId = req.user.id;
        const { validationId, isFollowed, actualBuyPrice } = req.body;

        const stmt = db.prepare(`
            UPDATE buy_point_validations
            SET is_followed = ?,
                actual_buy_price = ?,
                actual_buy_time = datetime('now', 'localtime')
            WHERE id = ? AND user_id = ?
        `);

        stmt.run(isFollowed ? 1 : 0, actualBuyPrice, validationId, userId);

        res.json({
            success: true,
            message: '更新成功'
        });

    } catch (error) {
        console.error('❌ 更新失败:', error);
        res.status(500).json({
            success: false,
            message: '更新失败',
            error: error.message
        });
    }
}

module.exports = {
    validateBuyPoint,
    batchValidate,
    getValidationHistory,
    getValidationConfig,
    updateUserNotes,
    markAsFollowed
};
