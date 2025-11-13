/**
 * 清理 positions 表中的重复记录
 *
 * 对于每个 (user_id, stock_code) 组合，只保留 ID 最小的那条记录
 */

const { db } = require('../connection');

console.log('=== 开始清理 positions 表重复记录 ===\n');

try {
    // 1. 查找重复记录
    console.log('步骤 1: 查找重复记录...');
    const duplicates = db.prepare(`
        SELECT user_id, stock_code, stock_name, COUNT(*) as count
        FROM positions
        GROUP BY user_id, stock_code
        HAVING COUNT(*) > 1
    `).all();

    if (duplicates.length === 0) {
        console.log('✅ 没有发现重复记录，无需清理\n');
        process.exit(0);
    }

    console.log(`❌ 发现 ${duplicates.length} 个股票有重复记录：`);
    duplicates.forEach(dup => {
        console.log(`   - 用户ID: ${dup.user_id}, 股票: ${dup.stock_code} ${dup.stock_name} (${dup.count}条)`);
    });
    console.log();

    // 2. 对每个重复的股票，删除除了 ID 最小的记录外的所有记录
    console.log('步骤 2: 清理重复记录（保留ID最小的记录）...');

    let totalDeleted = 0;

    for (const dup of duplicates) {
        // 查找该用户+股票的所有记录
        const records = db.prepare(`
            SELECT id, quantity, cost_price, source
            FROM positions
            WHERE user_id = ? AND stock_code = ?
            ORDER BY id ASC
        `).all(dup.user_id, dup.stock_code);

        console.log(`\n   处理: ${dup.stock_code} ${dup.stock_name} (用户ID: ${dup.user_id})`);
        console.log(`   找到 ${records.length} 条记录:`);

        records.forEach((rec, i) => {
            console.log(`      ${i + 1}. ID:${rec.id}, 数量:${rec.quantity}, 成本:${rec.cost_price}, 来源:${rec.source}`);
        });

        // 保留第一条（ID最小），删除其他
        const keepId = records[0].id;
        const deleteIds = records.slice(1).map(r => r.id);

        if (deleteIds.length > 0) {
            console.log(`   ✅ 保留 ID: ${keepId}`);
            console.log(`   🗑️  删除 ID: ${deleteIds.join(', ')}`);

            for (const id of deleteIds) {
                const result = db.prepare('DELETE FROM positions WHERE id = ?').run(id);
                totalDeleted += result.changes;
            }
        }
    }

    console.log(`\n✅ 清理完成，共删除 ${totalDeleted} 条重复记录\n`);

    // 3. 验证清理结果
    console.log('步骤 3: 验证清理结果...');
    const remainingDuplicates = db.prepare(`
        SELECT user_id, stock_code, COUNT(*) as count
        FROM positions
        GROUP BY user_id, stock_code
        HAVING COUNT(*) > 1
    `).all();

    if (remainingDuplicates.length === 0) {
        console.log('✅ 验证通过，已无重复记录\n');
    } else {
        console.log(`❌ 验证失败，仍有 ${remainingDuplicates.length} 个股票存在重复\n`);
    }

    console.log('=== 清理完成 ===');

} catch (error) {
    console.error('❌ 清理过程出错:', error);
    console.error('错误详情:', error.message);
    process.exit(1);
}
