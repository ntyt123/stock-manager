/**
 * 手动刷新复盘数据
 */

const { db } = require('./database');
const axios = require('axios');
const iconv = require('iconv-lite');

async function refreshRecapData() {
    console.log('=== 手动刷新复盘数据 ===\n');

    const userId = 4;
    const today = new Date().toISOString().split('T')[0];

    try {
        // 1. 从 positions 表获取持仓
        const positions = db.prepare(`
            SELECT
                stock_code as code,
                stock_name as name,
                quantity,
                cost_price,
                current_price,
                source
            FROM positions
            WHERE user_id = ? AND quantity > 0
            ORDER BY stock_code
        `).all(userId);

        console.log(`✅ 获取到 ${positions.length} 只持仓\n`);

        // 2. 获取最新价格
        if (positions.length > 0) {
            const stockCodes = positions.map(pos => pos.code);
            const fullCodes = stockCodes.map(code => {
                let market = code.startsWith('6') ? 'sh' : 'sz';
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

            positions.forEach((pos, i) => {
                const line = lines[i];
                if (!line) return;

                const match = line.match(/="(.+)"/);
                if (!match || !match[1]) return;

                const values = match[1].split(',');
                if (values.length < 32) return;

                const currentPrice = parseFloat(values[3]);
                const yesterdayClose = parseFloat(values[2]);

                pos.yesterday_close = yesterdayClose;
                pos.current_price = currentPrice;
                pos.total_profit = (currentPrice - pos.cost_price) * pos.quantity;
                pos.today_profit = (currentPrice - yesterdayClose) * pos.quantity;
                pos.cost = pos.cost_price * pos.quantity;

                console.log(`${pos.name} (${pos.code})`);
                console.log(`  当前价: ¥${currentPrice}, 昨收: ¥${yesterdayClose}`);
                console.log(`  今日盈亏: ¥${pos.today_profit.toFixed(2)}, 总盈亏: ¥${pos.total_profit.toFixed(2)}`);
            });

            console.log('\n');
        }

        // 3. 计算汇总
        let todayProfit = 0;
        let totalProfit = 0;
        let riseCount = 0;
        let fallCount = 0;
        let flatCount = 0;

        positions.forEach(pos => {
            todayProfit += (pos.today_profit || 0);
            totalProfit += (pos.total_profit || 0);

            if ((pos.today_profit || 0) > 0) riseCount++;
            else if ((pos.today_profit || 0) < 0) fallCount++;
            else flatCount++;
        });

        console.log('=== 汇总数据 ===');
        console.log(`今日盈亏: ¥${todayProfit.toFixed(2)}`);
        console.log(`总盈亏: ¥${totalProfit.toFixed(2)}`);
        console.log(`上涨: ${riseCount}, 平盘: ${flatCount}, 下跌: ${fallCount}\n`);

        // 4. 更新 daily_recap 表
        const existing = db.prepare('SELECT * FROM daily_recap WHERE recap_date = ?').get(today);

        if (existing) {
            db.prepare(`
                UPDATE daily_recap SET
                    position_data = ?,
                    today_profit = ?,
                    total_profit = ?,
                    position_count = ?,
                    rise_count = ?,
                    fall_count = ?,
                    flat_count = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE recap_date = ?
            `).run(
                JSON.stringify(positions),
                todayProfit,
                totalProfit,
                positions.length,
                riseCount,
                fallCount,
                flatCount,
                today
            );

            console.log('✅ 已更新 daily_recap 表');
        } else {
            console.log('⚠️ 没有找到今天的复盘记录');
        }

        console.log('\n请刷新浏览器查看更新后的数据！');

    } catch (error) {
        console.error('❌ 刷新失败:', error.message);
    }
}

refreshRecapData();
