/**
 * 检查所有持仓相关表的结构
 */

const { db } = require('./database');

console.log('=== 检查表结构 ===\n');

try {
    const tables = ['user_positions', 'manual_positions', 'positions'];

    tables.forEach(tableName => {
        console.log(`📋 ${tableName} 表结构:`);
        try {
            const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
            if (columns.length > 0) {
                columns.forEach(col => {
                    console.log(`   - ${col.name} (${col.type})${col.pk ? ' PRIMARY KEY' : ''}`);
                });
            } else {
                console.log('   （表不存在或无字段）');
            }
        } catch (e) {
            console.log(`   ❌ 错误: ${e.message}`);
        }
        console.log();
    });

    // 查询每个表的记录数
    console.log('📊 记录数统计:');
    tables.forEach(tableName => {
        try {
            const result = db.prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE user_id = 4`).get();
            console.log(`   ${tableName}: ${result.count} 条`);
        } catch (e) {
            console.log(`   ${tableName}: 查询失败 (${e.message})`);
        }
    });
    console.log();

    console.log('=== 检查完成 ===');

} catch (error) {
    console.error('❌ 检查过程出错:', error);
}
