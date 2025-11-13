#!/bin/bash
# 在远程服务器上检查 positions 表中的重复数据

echo "=== 远程服务器数据库检查 ==="
echo ""

cd /opt/stock-manager || exit 1

# 创建检查脚本
cat > /tmp/check-positions.js << 'CHECKSCRIPT'
const sqlite3 = require('better-sqlite3');
const db = sqlite3('stock_manager.db');

const userId = 4; // 你的用户ID

console.log('1️⃣ 检查 positions 表中的所有记录...');
const positions = db.prepare(`
    SELECT id, stock_code, stock_name, quantity, cost_price, current_price, source
    FROM positions
    WHERE user_id = ?
    ORDER BY stock_code, id
`).all(userId);

console.log(`   总记录数: ${positions.length}`);
console.log('');

console.log('2️⃣ 检查重复的股票代码...');
const duplicates = db.prepare(`
    SELECT stock_code, COUNT(*) as count
    FROM positions
    WHERE user_id = ?
    GROUP BY stock_code
    HAVING COUNT(*) > 1
`).all(userId);

if (duplicates.length > 0) {
    console.log(`   ❌ 发现 ${duplicates.length} 个股票有重复记录：`);
    duplicates.forEach(dup => {
        console.log(`      ${dup.stock_code}: ${dup.count} 条记录`);

        // 显示该股票的所有记录
        const records = positions.filter(p => p.stock_code === dup.stock_code);
        records.forEach(r => {
            console.log(`         - ID: ${r.id}, 数量: ${r.quantity}, 成本: ${r.cost_price}, 来源: ${r.source}`);
        });
    });
    console.log('');

    console.log('3️⃣ 修复方案：');
    console.log('   对于每个重复的股票，保留一条记录并删除其他记录。');
    console.log('');
} else {
    console.log('   ✅ 没有发现重复记录');
    console.log('');
}

console.log('4️⃣ 所有持仓列表:');
positions.forEach((pos, i) => {
    console.log(`   [${i + 1}] ${pos.stock_code} ${pos.stock_name} - 数量: ${pos.quantity}, ID: ${pos.id}`);
});

db.close();
CHECKSCRIPT

# 运行检查脚本
echo "运行检查脚本..."
node /tmp/check-positions.js

echo ""
echo "=== 检查完成 ==="
