/**
 * 定时任务：交易时间内每5分钟监控止盈止损价格提醒
 * 检查所有启用的止盈止损设置，对比当前价格，触发条件时发送提醒
 */

const cron = require('node-cron');
const axios = require('axios');
const { db } = require('../database/connection');

// 批量获取股票实时价格（新浪API）
const fetchStockPrices = async (stockCodes) => {
    if (!stockCodes || stockCodes.length === 0) {
        return {};
    }

    try {
        // 转换股票代码格式: 600000 -> sh600000, 000001 -> sz000001
        const codes = stockCodes.map(code => {
            const prefix = code.startsWith('6') ? 'sh' : 'sz';
            return prefix + code;
        });

        const url = `https://hq.sinajs.cn/list=${codes.join(',')}`;
        const response = await axios.get(url, {
            timeout: 8000,
            headers: {
                'Referer': 'https://finance.sina.com.cn/'
            }
        });

        const prices = {};
        const lines = response.data.split('\n');

        lines.forEach(line => {
            const match = line.match(/var hq_str_([a-z]{2})(\d{6})="([^"]+)"/);
            if (match) {
                const stockCode = match[2];
                const data = match[3].split(',');
                const currentPrice = parseFloat(data[3]); // 当前价格

                if (currentPrice > 0) {
                    prices[stockCode] = currentPrice;
                }
            }
        });

        console.log(`📊 [价格监控] 获取了 ${Object.keys(prices).length} 支股票价格`);
        return prices;
    } catch (error) {
        console.error('❌ [价格监控] 获取股票价格失败:', error.message);
        return {};
    }
};

// 检查止盈止损条件并创建提醒
const checkStopLossConditions = async () => {
    try {
        console.log('🔍 [价格监控] 开始检查止盈止损条件...');

        // 获取所有启用提醒的止盈止损设置
        const settings = db.prepare(`
            SELECT * FROM stop_loss_settings
            WHERE status = 'active' AND alert_enabled = 1
        `).all();

        if (settings.length === 0) {
            console.log('📊 [价格监控] 没有启用提醒的止盈止损设置');
            return;
        }

        console.log(`📊 [价格监控] 找到 ${settings.length} 条启用的设置`);

        // 获取所有股票的当前价格
        const stockCodes = settings.map(s => s.stock_code);
        const prices = await fetchStockPrices(stockCodes);

        if (Object.keys(prices).length === 0) {
            console.warn('⚠️ [价格监控] 无法获取股票价格，跳过本次检查');
            return;
        }

        let alertCount = 0;
        const now = new Date().toISOString();
        const today = now.split('T')[0];

        // 检查每个设置
        for (const setting of settings) {
            const currentPrice = prices[setting.stock_code];
            if (!currentPrice) {
                continue; // 没有价格数据，跳过
            }

            // 计算止损止盈价格
            const stopLossPrice = setting.stop_loss_price ||
                (setting.cost_price * (1 + setting.stop_loss_percent / 100));
            const stopProfitPrice = setting.stop_profit_price ||
                (setting.cost_price * (1 + setting.stop_profit_percent / 100));

            let alertType = null;
            let alertMessage = null;
            let targetPrice = null;

            // 检查是否触发止损
            if (currentPrice <= stopLossPrice) {
                alertType = 'stop_loss';
                targetPrice = stopLossPrice;
                const lossPercent = ((currentPrice - setting.cost_price) / setting.cost_price * 100).toFixed(2);
                alertMessage = `${setting.stock_name}(${setting.stock_code}) 已触发止损！当前价 ¥${currentPrice.toFixed(2)}，止损价 ¥${stopLossPrice.toFixed(2)}，亏损 ${lossPercent}%`;
            }
            // 检查是否触发止盈
            else if (currentPrice >= stopProfitPrice) {
                alertType = 'stop_profit';
                targetPrice = stopProfitPrice;
                const profitPercent = ((currentPrice - setting.cost_price) / setting.cost_price * 100).toFixed(2);
                alertMessage = `${setting.stock_name}(${setting.stock_code}) 已达到止盈目标！当前价 ¥${currentPrice.toFixed(2)}，止盈价 ¥${stopProfitPrice.toFixed(2)}，盈利 ${profitPercent}%`;
            }
            // 检查是否接近止损（距离止损5%以内）
            else if (currentPrice < setting.cost_price) {
                const distanceToStopLoss = (currentPrice - stopLossPrice) / setting.cost_price * 100;
                if (distanceToStopLoss < 2.0) { // 距离止损线不到2个百分点
                    alertType = 'warning';
                    targetPrice = stopLossPrice;
                    const lossPercent = ((currentPrice - setting.cost_price) / setting.cost_price * 100).toFixed(2);
                    alertMessage = `${setting.stock_name}(${setting.stock_code}) 接近止损线！当前价 ¥${currentPrice.toFixed(2)}，止损价 ¥${stopLossPrice.toFixed(2)}，当前亏损 ${lossPercent}%`;
                }
            }

            // 如果有告警，检查是否今天已经发过同类型告警（避免重复）
            if (alertType && alertMessage) {
                const existingAlert = db.prepare(`
                    SELECT id FROM price_alerts
                    WHERE user_id = ?
                    AND stock_code = ?
                    AND alert_type = ?
                    AND DATE(created_at) = ?
                `).get(setting.user_id, setting.stock_code, alertType, today);

                if (!existingAlert) {
                    // 创建告警记录
                    db.prepare(`
                        INSERT INTO price_alerts
                        (user_id, stock_code, stock_name, alert_type, trigger_price, target_price, cost_price, alert_message, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        setting.user_id,
                        setting.stock_code,
                        setting.stock_name,
                        alertType,
                        currentPrice,
                        targetPrice,
                        setting.cost_price,
                        alertMessage,
                        now
                    );

                    console.log(`🔔 [价格监控] 创建告警: ${alertMessage}`);
                    alertCount++;
                } else {
                    console.log(`⏭️ [价格监控] ${setting.stock_code} 今天已有 ${alertType} 告警，跳过`);
                }
            }
        }

        console.log(`✅ [价格监控] 检查完成，本次创建 ${alertCount} 条告警`);
    } catch (error) {
        console.error('❌ [价格监控] 检查失败:', error);
    }
};

// 启动定时任务
const startScheduledTask = () => {
    // 交易时间内每5分钟执行一次
    // 上午: 9:30-11:30
    // 下午: 13:00-15:00

    // 每5分钟执行一次，但只在交易时间内有效
    const task = cron.schedule('*/5 * * * *', async () => {
        const now = new Date();
        const day = now.getDay(); // 0=周日, 1-5=周一到周五, 6=周六
        const hour = now.getHours();
        const minute = now.getMinutes();

        // 跳过周末
        if (day === 0 || day === 6) {
            return;
        }

        // 检查是否在交易时间
        const morningTrade = (hour === 9 && minute >= 30) || (hour === 10) || (hour === 11 && minute < 30);
        const afternoonTrade = (hour === 13) || (hour === 14);

        if (morningTrade || afternoonTrade) {
            console.log(`🕐 [价格监控] 触发检查任务 (${hour}:${minute.toString().padStart(2, '0')})`);
            await checkStopLossConditions();
        }
    }, {
        timezone: 'Asia/Shanghai'
    });

    console.log('✅ 价格监控定时任务已启动 (交易时间每5分钟检查)');

    return task;
};

module.exports = { startScheduledTask, checkStopLossConditions };
