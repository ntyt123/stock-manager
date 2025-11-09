const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'stock_manager.db');
const createTablePath = path.join(__dirname, 'migrations', '20251101000004_create_daily_recap.sql');
const migrationPath = path.join(__dirname, 'migrations', '20251104000001_add_analysis_fields_to_daily_recap.sql');

const db = new Database(dbPath);

try {
    console.log('开始执行数据库迁移...');

    // 检查表是否存在
    const tableExists = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='daily_recap'
    `).get();

    if (!tableExists) {
        console.log('表不存在，先创建daily_recap表...');
        const createTableSql = fs.readFileSync(createTablePath, 'utf8');
        const createStatements = createTableSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        db.transaction(() => {
            for (const statement of createStatements) {
                console.log(`执行: ${statement.substring(0, 50)}...`);
                db.prepare(statement).run();
            }
        })();
        console.log('✅ daily_recap表创建成功！');
    }

    // 检查字段是否已经存在
    const columns = db.prepare('PRAGMA table_info(daily_recap)').all();
    const columnNames = columns.map(col => col.name);

    if (columnNames.includes('call_auction_analysis')) {
        console.log('ℹ️ 字段已存在，跳过迁移。');
        db.close();
        return;
    }

    // 执行migration
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // 分割SQL语句（按分号分割）
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    db.transaction(() => {
        for (const statement of statements) {
            console.log(`执行: ${statement.substring(0, 50)}...`);
            db.prepare(statement).run();
        }
    })();

    console.log('✅ 数据库迁移成功！');

} catch (error) {
    console.error('❌ 数据库迁移失败:', error.message);
    process.exit(1);
} finally {
    db.close();
}
