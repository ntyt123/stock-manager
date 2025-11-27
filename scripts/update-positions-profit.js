/**
 * 更新所有持仓的盈亏计算
 * 使用新的费用计算器重新计算所有持仓的盈亏（包含交易手续费）
 */

const { db } = require('../database');
const { calculatePositionProfit } = require('../utils/tradingFeeCalculator');

async function updateAllPositionsProfit() {
    try {
        console.log('========================================');
        console.log('开始更新所有持仓的盈亏计算...');
        console.log('========================================\n');

        // 获取所有持仓
        const positions = db.prepare(`
            SELECT * FROM positions WHERE quantity > 0
        `).all();

        console.log(`📊 找到 ${positions.length} 条持仓记录\n`);

        if (positions.length === 0) {
            console.log('✅ 没有需要更新的持仓记录');
            return;
        }

        let updatedCount = 0;
        const updateStmt = db.prepare(`
            UPDATE positions SET
                market_value = ?,
                profit_loss = ?,
                profit_loss_rate = ?,
                updated_at = datetime('now', 'localtime')
            WHERE id = ?
        `);

        // 开始事务
        const updateTransaction = db.transaction(() => {
            positions.forEach((pos, index) => {
                const stockCode = pos.stock_code;
                const stockName = pos.stock_name;
                const costPrice = pos.cost_price;
                const currentPrice = pos.current_price || pos.cost_price;
                const quantity = pos.quantity;

                // 使用费用计算器重新计算盈亏（包含买入时的手续费）
                const profitCalc = calculatePositionProfit(costPrice, currentPrice, quantity);

                const oldProfitLoss = pos.profit_loss || 0;
                const oldProfitLossRate = pos.profit_loss_rate || 0;

                // 更新数据库
                updateStmt.run(
                    profitCalc.currentValue,
                    profitCalc.profitLoss,
                    profitCalc.profitLossRate,
                    pos.id
                );

                updatedCount++;

                console.log(`[${index + 1}/${positions.length}] ${stockCode} ${stockName}`);
                console.log(`  持仓：${quantity}股 @ ¥${costPrice.toFixed(2)}`);
                console.log(`  当前价：¥${currentPrice.toFixed(2)}`);
                console.log(`  旧盈亏：¥${oldProfitLoss.toFixed(2)} (${oldProfitLossRate.toFixed(2)}%)`);
                console.log(`  新盈亏：¥${profitCalc.profitLoss.toFixed(2)} (${profitCalc.profitLossRate.toFixed(2)}%)`);

                if (Math.abs(profitCalc.profitLoss - oldProfitLoss) > 0.01) {
                    const diff = profitCalc.profitLoss - oldProfitLoss;
                    console.log(`  📊 差异：${diff >= 0 ? '+' : ''}¥${diff.toFixed(2)}`);
                }
                console.log('');
            });
        });

        // 执行事务
        updateTransaction();

        console.log('========================================');
        console.log(`✅ 成功更新 ${updatedCount} 条持仓记录的盈亏计算`);
        console.log('========================================\n');

        // 显示更新后的汇总
        const summary = db.prepare(`
            SELECT
                COUNT(*) as total_count,
                SUM(market_value) as total_market_value,
                SUM(profit_loss) as total_profit_loss,
                SUM(cost_price * quantity) as total_cost
            FROM positions
            WHERE quantity > 0
        `).get();

        const totalProfitLossRate = summary.total_cost > 0
            ? (summary.total_profit_loss / summary.total_cost * 100).toFixed(2)
            : '0.00';

        console.log('📈 持仓汇总（更新后）：');
        console.log(`  总持仓数：${summary.total_count} 个`);
        console.log(`  总市值：¥${summary.total_market_value.toFixed(2)}`);
        console.log(`  总盈亏：${summary.total_profit_loss >= 0 ? '+' : ''}¥${summary.total_profit_loss.toFixed(2)}`);
        console.log(`  总盈亏率：${summary.total_profit_loss >= 0 ? '+' : ''}${totalProfitLossRate}%`);
        console.log('');

    } catch (error) {
        console.error('❌ 更新失败:', error);
        throw error;
    }
}

// 执行更新
updateAllPositionsProfit()
    .then(() => {
        console.log('✅ 脚本执行完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ 脚本执行失败:', error);
        process.exit(1);
    });
