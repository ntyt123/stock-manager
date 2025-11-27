/**
 * 列出数据库中的所有表
 */

const { db } = require('../database');

try {
    const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    `).all();

    console.log(`\n数据库中的表 (共${tables.length}个):\n`);
    tables.forEach((table, index) => {
        console.log(`${(index + 1).toString().padStart(3)}. ${table.name}`);
    });
    console.log('');
} catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
}
