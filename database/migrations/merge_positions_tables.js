/**
 * 合并 user_positions 和 manual_positions 为一个统一的 positions 表
 *
 * 新表结构：
 * - 包含两个表的所有字段
 * - 添加 source 字段区分数据来源（'auto', 'manual'）
 * - 使用下划线命名规范统一字段名
 */

const { db } = require('../index');

function mergePositionsTables() {
    console.log('开始合并持仓表...\n');

    try {
        db.exec('BEGIN TRANSACTION');

        // 1. 创建新的统一持仓表
        console.log('步骤 1: 创建新的 positions 表...');
        db.exec(`
            CREATE TABLE IF NOT EXISTS positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stock_code TEXT NOT NULL,
                stock_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                cost_price REAL NOT NULL,
                current_price REAL,
                market_value REAL,
                profit_loss REAL,
                profit_loss_rate REAL,
                buy_date TEXT,
                notes TEXT,
                source TEXT NOT NULL DEFAULT 'manual',  -- 'auto' 或 'manual'
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                UNIQUE(user_id, stock_code),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ positions 表创建成功\n');

        // 2. 迁移 user_positions 的数据
        console.log('步骤 2: 迁移 user_positions 数据...');
        const userPositions = db.prepare(`
            SELECT
                user_id,
                stockCode as stock_code,
                stockName as stock_name,
                quantity,
                costPrice as cost_price,
                currentPrice as current_price,
                marketValue as market_value,
                profitLoss as profit_loss,
                profitLossRate as profit_loss_rate,
                created_at,
                updated_at
            FROM user_positions
            WHERE quantity > 0
        `).all();

        const insertFromUser = db.prepare(`
            INSERT OR IGNORE INTO positions (
                user_id, stock_code, stock_name, quantity, cost_price,
                current_price, market_value, profit_loss, profit_loss_rate,
                source, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto', ?, ?)
        `);

        let userCount = 0;
        for (const pos of userPositions) {
            insertFromUser.run(
                pos.user_id, pos.stock_code, pos.stock_name, pos.quantity, pos.cost_price,
                pos.current_price, pos.market_value, pos.profit_loss, pos.profit_loss_rate,
                pos.created_at, pos.updated_at
            );
            userCount++;
        }
        console.log(`✅ 已迁移 ${userCount} 条 user_positions 数据\n`);

        // 3. 迁移 manual_positions 的数据（如果股票已存在则跳过）
        console.log('步骤 3: 迁移 manual_positions 数据...');
        const manualPositions = db.prepare(`
            SELECT
                user_id, stock_code, stock_name, quantity, cost_price,
                current_price, buy_date, notes, created_at, updated_at
            FROM manual_positions
            WHERE quantity > 0
        `).all();

        const insertFromManual = db.prepare(`
            INSERT OR IGNORE INTO positions (
                user_id, stock_code, stock_name, quantity, cost_price,
                current_price, buy_date, notes, source, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
        `);

        let manualCount = 0;
        let skippedCount = 0;
        for (const pos of manualPositions) {
            const result = insertFromManual.run(
                pos.user_id, pos.stock_code, pos.stock_name, pos.quantity, pos.cost_price,
                pos.current_price, pos.buy_date, pos.notes, pos.created_at, pos.updated_at
            );
            if (result.changes > 0) {
                manualCount++;
            } else {
                skippedCount++;
                console.log(`  ⚠️ 跳过重复股票: ${pos.stock_code} ${pos.stock_name}`);
            }
        }
        console.log(`✅ 已迁移 ${manualCount} 条 manual_positions 数据`);
        console.log(`⚠️ 跳过 ${skippedCount} 条重复数据（这些股票已在 user_positions 中存在）\n`);

        // 4. 备份旧表
        console.log('步骤 4: 备份旧表...');
        db.exec(`
            ALTER TABLE user_positions RENAME TO user_positions_backup;
            ALTER TABLE manual_positions RENAME TO manual_positions_backup;
        `);
        console.log('✅ 旧表已重命名为 *_backup\n');

        // 5. 创建索引以提高查询性能
        console.log('步骤 5: 创建索引...');
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
            CREATE INDEX IF NOT EXISTS idx_positions_stock_code ON positions(stock_code);
            CREATE INDEX IF NOT EXISTS idx_positions_source ON positions(source);
        `);
        console.log('✅ 索引创建成功\n');

        db.exec('COMMIT');

        console.log('=== 合并完成 ===');
        console.log(`✅ 共迁移 ${userCount + manualCount} 条持仓数据`);
        console.log(`✅ 旧表已备份为 user_positions_backup 和 manual_positions_backup`);
        console.log(`⚠️ 请更新代码后测试，确认无误后可删除备份表\n`);

        // 显示新表数据统计
        const stats = db.prepare(`
            SELECT
                source,
                COUNT(*) as count,
                SUM(quantity) as total_quantity
            FROM positions
            GROUP BY source
        `).all();

        console.log('新表数据统计:');
        console.table(stats);

        return true;
    } catch (error) {
        db.exec('ROLLBACK');
        console.error('❌ 合并失败:', error.message);
        console.error(error);
        return false;
    }
}

// 如果直接运行此文件，执行合并
if (require.main === module) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('⚠️ 警告：此操作将合并 user_positions 和 manual_positions 表');
    console.log('旧表将被重命名为 *_backup，但请务必先备份数据库！\n');

    rl.question('确认继续？(yes/no): ', (answer) => {
        if (answer.toLowerCase() === 'yes') {
            mergePositionsTables();
        } else {
            console.log('操作已取消');
        }
        rl.close();
    });
}

module.exports = { mergePositionsTables };
