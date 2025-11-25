/**
 * 定时任务：每天14:59捕获市场统计数据
 * 在收盘前一分钟获取市场涨跌统计，保存到数据库供非交易时间查看
 */

const cron = require('node-cron');
const axios = require('axios');
const { db } = require('../database/connection');

// 保存市场统计数据到数据库
const saveMarketStats = (upCount, downCount, flatCount, total) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        // 使用 INSERT OR REPLACE 确保每天只有一条记录
        db.prepare(`
            INSERT OR REPLACE INTO market_stats
            (trade_date, up_count, down_count, flat_count, total_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?,
                COALESCE((SELECT created_at FROM market_stats WHERE trade_date = ?), ?),
                ?)
        `).run(today, upCount, downCount, flatCount, total, today, now, now);

        console.log(`✅ [定时任务] 市场统计已保存: ${today}, 上涨${upCount}, 下跌${downCount}, 平盘${flatCount}`);
        return true;
    } catch (error) {
        console.error('❌ [定时任务] 保存市场统计失败:', error.message);
        return false;
    }
};

// 从API获取市场统计数据
const fetchMarketStats = async () => {
    console.log('📊 [定时任务] 开始获取市场统计数据...');

    // 方法1: 使用网易财经沪深市场概况API
    try {
        console.log('📊 [定时任务] 尝试网易财经市场概况API...');

        const url163 = 'http://api.money.126.net/data/feed/0000001,1399001,money.api';
        const response163 = await axios.get(url163, {
            timeout: 8000,
            headers: {
                'Referer': 'http://quotes.money.163.com/'
            }
        });

        if (response163.data) {
            // 解析JSONP格式: _ntes_quote_callback({"0000001":{...},"1399001":{...}});
            const jsonMatch = response163.data.match(/_ntes_quote_callback\((.+)\)/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[1]);

                // 上证指数数据
                const sh = data['0000001'];
                // 深证成指数据
                const sz = data['1399001'];

                if (sh && sz) {
                    // 网易API字段: upNum=上涨家数, downNum=下跌家数
                    const shUp = parseInt(sh.upNum) || 0;
                    const shDown = parseInt(sh.downNum) || 0;
                    const szUp = parseInt(sz.upNum) || 0;
                    const szDown = parseInt(sz.downNum) || 0;

                    const totalUp = shUp + szUp;
                    const totalDown = shDown + szDown;

                    if (totalUp > 10 && totalDown > 10) {
                        console.log(`✅ [定时任务] 网易API获取成功: 上涨${totalUp}, 下跌${totalDown}`);
                        saveMarketStats(totalUp, totalDown, 0, totalUp + totalDown);
                        return true;
                    } else {
                        console.warn(`⚠️ [定时任务] 网易数据不合理: 上涨${totalUp}, 下跌${totalDown}`);
                    }
                }
            }
        }
    } catch (error163) {
        console.warn('⚠️ [定时任务] 网易财经API失败:', error163.message);
    }

    // 方法2: 使用东方财富股票列表API获取所有A股并统计
    try {
        console.log('📊 [定时任务] 尝试东方财富A股列表统计...');

        const response = await axios.get('http://push2.eastmoney.com/api/qt/clist/get', {
            params: {
                pn: 1,
                pz: 5000,
                po: 1,
                np: 1,
                ut: 'bd1d9ddb04089700cf9c27f6f7426281',
                fltt: 2,
                invt: 2,
                fid: 'f3',
                fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23',
                fields: 'f3',
                _: Date.now()
            },
            timeout: 10000
        });

        if (response.data && response.data.data) {
            const data = response.data.data;
            const stocks = data.diff || [];

            console.log(`📊 [定时任务] 东方财富API: 返回${stocks.length}支股票`);

            // API限制导致只返回部分数据，不能作为全市场统计
            if (stocks.length < 1000) {
                console.warn(`⚠️ [定时任务] 返回数据不足（${stocks.length}支），跳过此方法`);
            } else {
                let upCount = 0, downCount = 0, flatCount = 0;

                stocks.forEach(stock => {
                    const changePercent = parseFloat(stock.f3);
                    if (changePercent > 0) upCount++;
                    else if (changePercent < 0) downCount++;
                    else flatCount++;
                });

                const total = upCount + downCount + flatCount;
                console.log(`✅ [定时任务] 东方财富统计成功: 上涨${upCount}, 下跌${downCount}, 平盘${flatCount}, 总计${total}支`);

                saveMarketStats(upCount, downCount, flatCount, total);
                return true;
            }
        }
    } catch (listError) {
        console.warn('⚠️ [定时任务] 东方财富列表API失败:', listError.message);
    }

    console.error('❌ [定时任务] 所有API都失败，未能保存今日市场统计');
    return false;
};

// 启动定时任务
const startScheduledTask = () => {
    // 每天14:59执行（收盘前一分钟）
    // 格式: 分 时 日 月 星期
    // 59 14 * * 1-5 表示：周一到周五的14:59
    const task = cron.schedule('59 14 * * 1-5', async () => {
        console.log('🕐 [定时任务] 触发市场统计捕获任务 (14:59)');
        await fetchMarketStats();
    }, {
        timezone: 'Asia/Shanghai'
    });

    console.log('✅ 市场统计定时任务已启动 (每个交易日14:59执行)');

    return task;
};

module.exports = { startScheduledTask, fetchMarketStats };
