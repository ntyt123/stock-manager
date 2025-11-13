/**
 * 检查 positions 表的 UNIQUE 约束
 */

const { db } = require('./database');

console.log('=== 检查 positions 表约束 ===\n');

try {
    // 1. 查看表结构
    console.log('1️⃣ 查看 positions 表的索引和约束...');
    const indexes = db.prepare(`PRAGMA index_list(positions)`).all();

    if (indexes.length > 0) {
        console.log('   现有索引:');
        indexes.forEach(idx => {
            console.log(`      - ${idx.name} (unique: ${idx.unique ? '是' : '否'})`);

            // 查看索引详情
            const indexInfo = db.prepare(`PRAGMA index_info(${idx.name})`).all();
            indexInfo.forEach(col => {
                console.log(`         字段: ${col.name}`);
            });
        });
    } else {
        console.log('   ❌ 没有找到任何索引');
    }
    console.log();

    // 2. 查看表的 SQL 创建语句
    console.log('2️⃣ 查看表的创建语句...');
    const tableSql = db.prepare(`
        SELECT sql FROM sqlite_master
        WHERE type='table' AND name='positions'
    `).get();

    if (tableSql) {
        console.log(tableSql.sql);
        console.log();

        if (tableSql.sql.includes('UNIQUE')) {
            console.log('✅ 表定义中包含 UNIQUE 约束');
        } else {
            console.log('❌ 表定义中没有 UNIQUE 约束');
        }
    }
    console.log();

    // 3. 尝试插入重复数据测试
    console.log('3️⃣ 测试重复插入（使用测试数据）...');
    const testUserId = 9999;
    const testStockCode = 'TEST001';

    // 清理测试数据
    db.prepare('DELETE FROM positions WHERE user_id = ?').run(testUserId);

    try {
        // 第一次插入
        db.prepare(`
            INSERT INTO positions (user_id, stock_code, stock_name, quantity, cost_price, source)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(testUserId, testStockCode, '测试股票', 100, 10.0, 'manual');
        console.log('   ✅ 第一次插入成功');

        // 第二次插入相同的数据
        db.prepare(`
            INSERT INTO positions (user_id, stock_code, stock_name, quantity, cost_price, source)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(testUserId, testStockCode, '测试股票', 200, 12.0, 'manual');
        console.log('   ❌ 第二次插入也成功了 - 说明没有 UNIQUE 约束！');
    } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
            console.log('   ✅ 第二次插入失败 - UNIQUE 约束正常工作');
        } else {
            console.log(`   ❌ 插入失败，但原因不是 UNIQUE 约束: ${e.message}`);
        }
    }

    // 清理测试数据
    db.prepare('DELETE FROM positions WHERE user_id = ?').run(testUserId);
    console.log();

    console.log('=== 检查完成 ===');

} catch (error) {
    console.error('❌ 检查过程出错:', error);
    console.error('错误详情:', error.message);
}
