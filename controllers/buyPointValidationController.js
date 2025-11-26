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

    // 阳线
    if (lastClose > lastOpen) {
        klineScore += 3;
        const bodyRatio = (lastClose - lastOpen) / (lastHigh - lastLow);

        // 大阳线
        if (bodyRatio > 0.7) {
            klineScore += 4;
            klineDetails.push(`✅ 收出大阳线 (实体占比 ${(bodyRatio * 100).toFixed(1)}% > 70%)，多头力量强劲 (+7分)`);
        } else if (bodyRatio > 0.5) {
            klineScore += 2;
            klineDetails.push(`✅ 收出中阳线 (实体占比 ${(bodyRatio * 100).toFixed(1)}%)，买盘较强 (+5分)`);
        } else {
            klineDetails.push(`✅ 收阳线 (实体占比 ${(bodyRatio * 100).toFixed(1)}%)，略有上影线 (+3分)`);
        }
    } else if (lastClose < lastOpen) {
        klineDetails.push(`❌ 收阴线 (${lastClose.toFixed(2)} < ${lastOpen.toFixed(2)})，短期承压 (0分)`);
    } else {
        klineDetails.push(`⚠️ 收十字星，多空博弈激烈 (0分)`);
    }

    // 连续上涨
    let consecutive = 0;
    for (let i = len - 1; i > 0 && i > len - 4; i--) {
        if (closes[i] > closes[i - 1]) {
            consecutive++;
        } else {
            break;
        }
    }

    if (consecutive >= 2) {
        klineScore += 3;
        klineDetails.push(`✅ 连续${consecutive}日上涨，形成短期上升趋势 (+3分)`);
    } else if (consecutive === 1) {
        klineDetails.push(`⚠️ 仅1日上涨，趋势延续性待观察 (0分)`);
    } else {
        klineDetails.push(`❌ 未形成连续上涨，走势偏弱 (0分)`);
    }

    // 2. 支撑位得分 (15分)
    const currentPrice = closes[len - 1];

    // 寻找最近的支撑位（前期低点）
    const recentLows = lows.slice(-20);
    const lowestPrice = Math.min(...recentLows);
    const highestPrice = Math.max(...highs.slice(-20));

    // 距离底部的位置
    const pricePosition = (currentPrice - lowestPrice) / (highestPrice - lowestPrice);

    if (pricePosition <= 0.3) {
        supportScore += 8;
        supportDetails.push(`✅ 价格位于近期底部区域 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，上涨空间大 (+8分)`);
    } else if (pricePosition <= 0.5) {
        supportScore += 5;
        supportDetails.push(`✅ 价格处于中低位 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，有一定上涨空间 (+5分)`);
    } else if (pricePosition <= 0.7) {
        supportScore += 3;
        supportDetails.push(`⚠️ 价格处于中位 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，上涨空间一般 (+3分)`);
    } else {
        supportDetails.push(`❌ 价格位于相对高位 (相对位置 ${(pricePosition * 100).toFixed(1)}%)，追高风险较大 (0分)`);
    }

    // 回踩支撑位
    const ma20 = calculateSMA(closes, 20);
    if (ma20 && Math.abs(currentPrice - ma20) / ma20 < 0.02) {
        supportScore += 4;
        supportDetails.push(`✅ 价格回踩MA20均线支撑 (偏离度 ${(Math.abs(currentPrice - ma20) / ma20 * 100).toFixed(2)}%)，支撑有效 (+4分)`);
    } else if (ma20 && currentPrice > ma20) {
        const deviation = ((currentPrice - ma20) / ma20 * 100).toFixed(2);
        supportDetails.push(`⚠️ 价格高于MA20均线 ${deviation}%，未触及支撑位 (0分)`);
    } else if (ma20) {
        supportDetails.push(`❌ 价格跌破MA20均线支撑，支撑失效 (0分)`);
    }

    // 前期平台
    const recent10Closes = closes.slice(-10);
    const volatility = (Math.max(...recent10Closes) - Math.min(...recent10Closes)) / Math.min(...recent10Closes);
    if (volatility < 0.05) {
        supportScore += 3;
        supportDetails.push(`✅ 近10日窄幅整理 (波动率 ${(volatility * 100).toFixed(2)}% < 5%)，蓄势待发 (+3分)`);
    } else if (volatility < 0.1) {
        supportDetails.push(`⚠️ 近期波动率 ${(volatility * 100).toFixed(2)}%，整理幅度一般 (0分)`);
    } else {
        supportDetails.push(`❌ 近期波动较大 (波动率 ${(volatility * 100).toFixed(2)}%)，走势不稳定 (0分)`);
    }

    return {
        pattern_score: Math.min(25, klineScore + supportScore),
        kline_score: klineScore,
        support_score: supportScore,
        // 新增：详细评分说明
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

    // 1. 大盘得分 (10分)
    if (indexData && indexData.trend) {
        if (indexData.trend === 'up') {
            indexScore = 10;
        } else if (indexData.trend === 'neutral') {
            indexScore = 5;
        } else {
            indexScore = 2;
        }
    } else {
        // 默认给中性分数
        indexScore = 5;
    }

    // 2. 板块得分 (10分)
    if (sectorStrength) {
        if (sectorStrength >= 0.7) {
            sectorScore = 10;
        } else if (sectorStrength >= 0.5) {
            sectorScore = 7;
        } else if (sectorStrength >= 0.3) {
            sectorScore = 4;
        } else {
            sectorScore = 2;
        }
    } else {
        // 默认给中性分数
        sectorScore = 5;
    }

    return {
        market_score: indexScore + sectorScore,
        index_score: indexScore,
        sector_score: sectorScore
    };
}

/**
 * 计算风险控制得分 (15分)
 */
function calculateRiskScore(stockData, indicators) {
    let positionRisk = 0;      // 位置风险 (5分)
    let volatilityRisk = 0;    // 波动风险 (5分)
    let signalRisk = 0;        // 信号风险 (5分)

    const { closes, highs, lows } = stockData;
    const currentPrice = closes[closes.length - 1];

    // 1. 位置风险 (5分) - 越低风险越小
    const recent60Highs = highs.slice(-60);
    const recent60Lows = lows.slice(-60);
    const highest60 = Math.max(...recent60Highs);
    const lowest60 = Math.min(...recent60Lows);

    const pricePosition = (currentPrice - lowest60) / (highest60 - lowest60);

    if (pricePosition <= 0.3) {
        positionRisk = 5; // 低位，风险小
    } else if (pricePosition <= 0.5) {
        positionRisk = 4;
    } else if (pricePosition <= 0.7) {
        positionRisk = 3;
    } else if (pricePosition <= 0.85) {
        positionRisk = 2;
    } else {
        positionRisk = 1; // 高位，风险大
    }

    // 2. 波动风险 (5分) - 波动越小越好
    const recent20Closes = closes.slice(-20);
    const volatility = (Math.max(...recent20Closes) - Math.min(...recent20Closes)) / Math.min(...recent20Closes);

    if (volatility <= 0.1) {
        volatilityRisk = 5; // 低波动
    } else if (volatility <= 0.2) {
        volatilityRisk = 4;
    } else if (volatility <= 0.3) {
        volatilityRisk = 3;
    } else if (volatility <= 0.5) {
        volatilityRisk = 2;
    } else {
        volatilityRisk = 1; // 高波动
    }

    // 3. 信号风险 (5分) - 检查背离和超买
    const rsi = indicators.rsi;
    const { k } = indicators.kdj;

    if (rsi !== null && rsi > 80) {
        signalRisk = 1; // 严重超买
    } else if (rsi !== null && rsi > 70) {
        signalRisk = 3; // 超买
    } else if (k !== null && k > 90) {
        signalRisk = 2; // KDJ超买
    } else {
        signalRisk = 5; // 无明显风险信号
    }

    return {
        risk_score: positionRisk + volatilityRisk + signalRisk,
        position_risk: positionRisk,
        volatility_risk: volatilityRisk,
        signal_risk: signalRisk
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
