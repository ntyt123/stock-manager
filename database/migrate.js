#!/usr/bin/env node

/**
 * 数据库迁移CLI工具
 *
 * 用法:
 *   node database/migrate.js status         # 查看迁移状态
 *   node database/migrate.js run            # 执行所有待处理的迁移
 *   node database/migrate.js create <name>  # 创建新的迁移文件
 *
 * 示例:
 *   node database/migrate.js create add_user_avatar_column
 */

const migrator = require('./migrator');

// 解析命令行参数
const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
    try {
        switch (command) {
            case 'status':
                // 查看迁移状态
                migrator.printStatus();
                break;

            case 'run':
                // 执行待处理的迁移
                console.log('🚀 开始执行数据库迁移...\n');
                const result = await migrator.runPendingMigrations();
                if (result.migrated > 0) {
                    console.log(`✅ 成功执行 ${result.migrated} 个迁移`);
                }
                break;

            case 'create':
                // 创建新的迁移文件
                if (args.length === 0) {
                    console.error('❌ 错误: 请提供迁移描述');
                    console.log('\n用法: node database/migrate.js create <description>');
                    console.log('示例: node database/migrate.js create add_user_avatar_column');
                    process.exit(1);
                }

                const description = args.join('_');
                const filePath = migrator.createMigration(description);
                console.log('\n💡 提示: 请编辑迁移文件，添加SQL语句后执行 migrate run');
                break;

            case 'help':
            case '--help':
            case '-h':
                printHelp();
                break;

            default:
                console.error(`❌ 未知命令: ${command}\n`);
                printHelp();
                process.exit(1);
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ 执行失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

function printHelp() {
    console.log(`
📚 数据库迁移工具使用说明

用法:
  node database/migrate.js <command> [options]

命令:
  status              查看迁移状态
  run                 执行所有待处理的迁移
  create <name>       创建新的迁移文件
  help                显示帮助信息

示例:
  # 查看当前迁移状态
  node database/migrate.js status

  # 执行所有待处理的迁移
  node database/migrate.js run

  # 创建新的迁移文件
  node database/migrate.js create add_user_avatar_column

  # 创建多个单词的迁移描述
  node database/migrate.js create add user avatar column

迁移文件规则:
  - 文件名格式: YYYYMMDDHHMMSS_description.sql
  - 放置在 database/migrations/ 目录下
  - 按文件名顺序执行
  - 每个迁移只会执行一次

更多信息请查看: database/migrations/README.md
`);
}

// 运行主函数
main();
