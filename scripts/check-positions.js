// 检查所有用户的持仓数据
const { db } = require('../database');

console.log('📊 检查所有用户的持仓数据...\n');

// 查询所有 user_positions 数据
const positions = db.prepare(`
    SELECT
        up.*,
        u.username
    FROM user_positions up
    JOIN users u ON up.user_id = u.id
    ORDER BY u.username, up.stockCode
`).all();

console.log(`找到 ${positions.length} 条持仓记录\n`);

if (positions.length === 0) {
    console.log('❌ user_positions 表为空！');
} else {
    positions.forEach((pos, index) => {
        console.log(`${index + 1}. ${pos.username} - ${pos.stockName} (${pos.stockCode})`);
        console.log(`   数量: ${pos.quantity}股`);
        console.log(`   成本价: ¥${pos.costPrice}`);
        console.log(`   现价: ¥${pos.currentPrice}`);
        console.log(`   市值: ¥${pos.marketValue}`);
        console.log(`   盈亏: ¥${pos.profitLoss} (${pos.profitLossRate}%)`);
        console.log(`   创建时间: ${pos.created_at}`);
        console.log(`   更新时间: ${pos.updated_at}\n`);
    });
}

// 查询所有 manual_positions 数据
console.log('\n================================\n');
console.log('📋 检查所有手动持仓数据...\n');

const manualPositions = db.prepare(`
    SELECT
        mp.*,
        u.username
    FROM manual_positions mp
    JOIN users u ON mp.user_id = u.id
    ORDER BY u.username, mp.stock_code
`).all();

console.log(`找到 ${manualPositions.length} 条手动持仓记录\n`);

if (manualPositions.length === 0) {
    console.log('❌ manual_positions 表为空！');
} else {
    manualPositions.forEach((pos, index) => {
        console.log(`${index + 1}. ${pos.username} - ${pos.stock_name} (${pos.stock_code})`);
        console.log(`   数量: ${pos.quantity}股`);
        console.log(`   成本价: ¥${pos.cost_price}`);
        console.log(`   现价: ¥${pos.current_price || 'null'}`);
        console.log(`   买入日期: ${pos.buy_date}`);
        console.log(`   备注: ${pos.notes || '无'}`);
        console.log(`   创建时间: ${pos.created_at}`);
        console.log(`   更新时间: ${pos.updated_at}\n`);
    });
}

process.exit(0);
