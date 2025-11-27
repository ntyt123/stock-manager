/**
 * 数据库架构同步脚本
 * 检查并创建所有必需的表
 * 适用于远程服务器数据库同步
 */

const { db } = require('../database');
const fs = require('fs');
const path = require('path');

// 关键表列表（按依赖顺序）
const REQUIRED_TABLES = [
    'users',
    'positions',
    'stock_pools',
    'stock_pool_items',
    'trading_plans',
    'trading_logs',
    'short_term_pool',
    'stock_criteria_settings',
    'buy_point_validations',
    'validation_configs',
    'review_notes',
    'trading_plans_short',
    'three_day_selection_configs',
    'three_day_selection_results',
    'three_day_selection_stats'
];

// 检查表是否存在
function tableExists(tableName) {
    const result = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name = ?
    `).get(tableName);
    return !!result;
}

// 获取所有现有表
function getAllTables() {
    return db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    `).all().map(row => row.name);
}

// 运行迁移文件
function runMigration(migrationFile) {
    console.log(`  🔄 运行迁移: ${migrationFile}`);
    try {
        require(path.join(__dirname, '../database/migrations', migrationFile));
        console.log(`  ✅ 迁移成功`);
        return true;
    } catch (error) {
        console.error(`  ❌ 迁移失败:`, error.message);
        return false;
    }
}

// 获取所有迁移文件
function getAllMigrations() {
    const migrationsDir = path.join(__dirname, '../database/migrations');
    return fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.js'))
        .sort();
}

// 主同步函数
async function syncDatabaseSchema() {
    console.log('========================================');
    console.log('🔄 数据库架构同步');
    console.log('========================================\n');

    // 1. 检查现有表
    console.log('📊 检查现有表...');
    const existingTables = getAllTables();
    console.log(`  ✅ 找到 ${existingTables.length} 个表\n`);

    // 2. 检查缺失的关键表
    console.log('🔍 检查必需表...');
    const missingTables = REQUIRED_TABLES.filter(table => !tableExists(table));

    if (missingTables.length === 0) {
        console.log('  ✅ 所有必需表都存在\n');
        console.log('📋 现有表列表:');
        existingTables.forEach((table, index) => {
            console.log(`  ${(index + 1).toString().padStart(3)}. ${table}`);
        });
        console.log('\n========================================');
        console.log('✅ 数据库架构完整，无需同步');
        console.log('========================================\n');
        return { success: true, created: 0 };
    }

    console.log(`  ⚠️  缺少 ${missingTables.length} 个表:`);
    missingTables.forEach(table => {
        console.log(`     - ${table}`);
    });
    console.log('');

    // 3. 获取并运行所有迁移
    console.log('🚀 运行数据库迁移...\n');
    const migrations = getAllMigrations();
    let successCount = 0;
    let failCount = 0;

    for (const migration of migrations) {
        try {
            // 检查迁移是否已执行
            const executed = db.prepare(`
                SELECT * FROM migrations WHERE name = ?
            `).get(migration);

            if (executed) {
                console.log(`  ⏭️  跳过已执行的迁移: ${migration}`);
                continue;
            }

            // 运行迁移
            const success = runMigration(migration);
            if (success) {
                successCount++;
                // 记录迁移
                try {
                    db.prepare(`
                        INSERT INTO migrations (name, executed_at)
                        VALUES (?, datetime('now'))
                    `).run(migration);
                } catch (e) {
                    // migrations表可能不存在，忽略错误
                }
            } else {
                failCount++;
            }
        } catch (error) {
            console.error(`  ❌ 处理迁移失败: ${migration}`, error.message);
            failCount++;
        }
        console.log('');
    }

    // 4. 再次检查
    console.log('🔍 验证结果...');
    const finalMissingTables = REQUIRED_TABLES.filter(table => !tableExists(table));

    console.log('\n========================================');
    if (finalMissingTables.length === 0) {
        console.log('🎉 数据库架构同步完成！');
        console.log('========================================\n');
        console.log(`✅ 成功运行 ${successCount} 个迁移`);
        if (failCount > 0) {
            console.log(`⚠️  ${failCount} 个迁移失败（可能已存在或不适用）`);
        }
        console.log(`✅ 所有 ${REQUIRED_TABLES.length} 个必需表已就绪`);

        // 显示最终表列表
        const finalTables = getAllTables();
        console.log(`\n📊 数据库包含 ${finalTables.length} 个表`);

        return { success: true, created: successCount };
    } else {
        console.log('⚠️  数据库架构仍不完整');
        console.log('========================================\n');
        console.log(`⚠️  仍缺少 ${finalMissingTables.length} 个表:`);
        finalMissingTables.forEach(table => {
            console.log(`   - ${table}`);
        });
        console.log('\n💡 建议：手动检查这些表的创建语句');

        return { success: false, created: successCount, missing: finalMissingTables };
    }
}

// 执行同步
syncDatabaseSchema()
    .then((result) => {
        if (result.success) {
            console.log('\n✅ 脚本执行完成');
            process.exit(0);
        } else {
            console.log('\n⚠️  脚本执行完成，但仍有缺失表');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('\n❌ 脚本执行失败:', error);
        process.exit(1);
    });
