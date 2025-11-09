/**
 * 数据库迁移管理器
 *
 * 用于管理数据库结构的版本控制和自动迁移
 * 确保开发环境和生产环境的数据库结构保持同步
 */

const fs = require('fs');
const path = require('path');
const { db } = require('./connection');

class DatabaseMigrator {
    constructor() {
        this.migrationsDir = path.join(__dirname, 'migrations');
        this.ensureMigrationsTable();
    }

    /**
     * 确保migrations跟踪表存在
     */
    ensureMigrationsTable() {
        db.prepare(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                execution_time_ms INTEGER
            )
        `).run();
    }

    /**
     * 获取所有迁移文件
     * 迁移文件命名格式: YYYYMMDDHHMMSS_description.sql
     * 例如: 20250122120000_initial_schema.sql
     */
    getMigrationFiles() {
        if (!fs.existsSync(this.migrationsDir)) {
            console.warn(`⚠️ 迁移目录不存在: ${this.migrationsDir}`);
            return [];
        }

        const files = fs.readdirSync(this.migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort(); // 按文件名排序，确保按时间顺序执行

        return files;
    }

    /**
     * 获取已执行的迁移记录
     */
    getExecutedMigrations() {
        const stmt = db.prepare('SELECT name FROM migrations ORDER BY name');
        const rows = stmt.all();
        return rows.map(row => row.name);
    }

    /**
     * 获取待执行的迁移
     */
    getPendingMigrations() {
        const allMigrations = this.getMigrationFiles();
        const executedMigrations = this.getExecutedMigrations();

        return allMigrations.filter(migration =>
            !executedMigrations.includes(migration)
        );
    }

    /**
     * 执行单个迁移文件
     */
    executeMigration(migrationFile) {
        const filePath = path.join(this.migrationsDir, migrationFile);
        const sql = fs.readFileSync(filePath, 'utf8');

        console.log(`📝 执行迁移: ${migrationFile}`);

        const startTime = Date.now();

        try {
            // 在事务中执行迁移
            db.transaction(() => {
                // 分割SQL语句（处理多个语句的情况）
                const statements = sql
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0);

                for (const statement of statements) {
                    db.prepare(statement).run();
                }

                // 记录迁移执行
                const executionTime = Date.now() - startTime;
                db.prepare(`
                    INSERT INTO migrations (name, execution_time_ms)
                    VALUES (?, ?)
                `).run(migrationFile, executionTime);

                console.log(`✅ 迁移完成: ${migrationFile} (${executionTime}ms)`);
            })();

            return { success: true, executionTime: Date.now() - startTime };
        } catch (error) {
            console.error(`❌ 迁移失败: ${migrationFile}`);
            console.error(`   错误信息: ${error.message}`);
            throw error;
        }
    }

    /**
     * 执行所有待处理的迁移
     */
    async runPendingMigrations() {
        const pending = this.getPendingMigrations();

        if (pending.length === 0) {
            console.log('✅ 数据库已是最新版本，无需迁移');
            return { migrated: 0, skipped: 0 };
        }

        console.log(`\n🔄 发现 ${pending.length} 个待执行的迁移:\n`);
        pending.forEach((file, index) => {
            console.log(`   ${index + 1}. ${file}`);
        });
        console.log('');

        let successCount = 0;
        let failedMigration = null;

        for (const migration of pending) {
            try {
                this.executeMigration(migration);
                successCount++;
            } catch (error) {
                failedMigration = migration;
                break; // 遇到错误停止执行后续迁移
            }
        }

        if (failedMigration) {
            console.error(`\n❌ 迁移过程中断于: ${failedMigration}`);
            console.error(`   已成功执行: ${successCount}/${pending.length}`);
            throw new Error(`迁移失败: ${failedMigration}`);
        }

        console.log(`\n✅ 所有迁移执行完成! 共执行 ${successCount} 个迁移\n`);
        return { migrated: successCount, skipped: 0 };
    }

    /**
     * 获取迁移状态
     */
    getStatus() {
        const allMigrations = this.getMigrationFiles();
        const executedMigrations = this.getExecutedMigrations();
        const pendingMigrations = this.getPendingMigrations();

        return {
            total: allMigrations.length,
            executed: executedMigrations.length,
            pending: pendingMigrations.length,
            pendingList: pendingMigrations,
            executedList: executedMigrations
        };
    }

    /**
     * 打印迁移状态
     */
    printStatus() {
        const status = this.getStatus();

        console.log('\n📊 数据库迁移状态:');
        console.log(`   总计迁移: ${status.total}`);
        console.log(`   已执行: ${status.executed}`);
        console.log(`   待执行: ${status.pending}`);

        if (status.pending > 0) {
            console.log('\n⏳ 待执行的迁移:');
            status.pendingList.forEach((migration, index) => {
                console.log(`   ${index + 1}. ${migration}`);
            });
        }

        console.log('');
    }

    /**
     * 创建新的迁移文件
     * @param {string} description - 迁移描述
     * @returns {string} - 创建的文件路径
     */
    createMigration(description) {
        const timestamp = new Date()
            .toISOString()
            .replace(/[-:T]/g, '')
            .split('.')[0]; // YYYYMMDDHHMMSS

        const fileName = `${timestamp}_${description.replace(/\s+/g, '_')}.sql`;
        const filePath = path.join(this.migrationsDir, fileName);

        const template = `-- Migration: ${description}
-- Created at: ${new Date().toISOString()}
--
-- 说明: 请在下方编写SQL语句
-- 注意:
--   1. 每个语句需要以分号(;)结尾
--   2. 支持多个SQL语句
--   3. 迁移会在事务中执行，失败会自动回滚
--   4. 请确保迁移是幂等的（可以多次执行不会出错）

-- 示例:
-- CREATE TABLE IF NOT EXISTS example (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     name TEXT NOT NULL
-- );

-- 您的SQL语句从这里开始:

`;

        fs.writeFileSync(filePath, template, 'utf8');
        console.log(`✅ 已创建迁移文件: ${fileName}`);
        console.log(`   路径: ${filePath}`);

        return filePath;
    }
}

// 导出单例
const migrator = new DatabaseMigrator();

module.exports = migrator;
