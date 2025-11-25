const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始扩展每日复盘表...');

    // 检查现有字段
    const columns = db.prepare('PRAGMA table_info(daily_recap)').all();
    const columnNames = columns.map(col => col.name);

    // 需要添加的新字段
    const newColumns = [
        // 市场环境扩展
        ['market_emotion', 'TEXT'], // 市场情绪：冰点|冷清|正常|活跃|火热
        ['limit_up_count', 'INTEGER DEFAULT 0'], // 涨停数
        ['limit_down_count', 'INTEGER DEFAULT 0'], // 跌停数
        ['blown_board_rate', 'REAL'], // 炸板率
        ['active_themes', 'TEXT'], // JSON: 活跃题材
        ['market_notes', 'TEXT'], // 市场观察备注

        // 交易回顾明细
        ['trade_reflections', 'TEXT'], // JSON: 每笔交易的反思
        ['no_trade_reason', 'TEXT'], // 无交易原因

        // 持仓分析明细
        ['position_notes', 'TEXT'], // JSON: 每只股票的持仓备注

        // 复盘反思
        ['what_went_right', 'TEXT'], // JSON: 做对的事（复选框）
        ['what_went_wrong', 'TEXT'], // JSON: 犯的错误（复选框）
        ['error_details', 'TEXT'], // JSON: 错误详情展开
        ['reflection_notes', 'TEXT'], // 今日感悟
        ['self_rating', 'TEXT'], // JSON: 自我评分

        // 明日计划
        ['tomorrow_plans', 'TEXT'], // JSON: 明日计划列表
        ['tomorrow_notes', 'TEXT'], // 明日注意事项

        // 周月数据对比
        ['week_stats', 'TEXT'], // JSON: 本周统计
        ['month_stats', 'TEXT'], // JSON: 本月统计

        // 元数据
        ['completion_status', 'TEXT DEFAULT "draft"'], // 完成状态：draft|completed
        ['last_section_edited', 'TEXT'], // 最后编辑的模块
        ['draft_saved_at', 'DATETIME'] // 草稿保存时间
    ];

    // 添加不存在的字段
    let addedCount = 0;
    for (const [colName, colType] of newColumns) {
        if (!columnNames.includes(colName)) {
            console.log(`  ➕ 添加字段: ${colName}`);
            db.prepare(`ALTER TABLE daily_recap ADD COLUMN ${colName} ${colType}`).run();
            addedCount++;
        } else {
            console.log(`  ✓ 字段已存在: ${colName}`);
        }
    }

    if (addedCount > 0) {
        console.log(`✅ 成功添加 ${addedCount} 个新字段`);
    } else {
        console.log(`✅ 所有字段都已存在，无需添加`);
    }

    // 创建索引（如果不存在）
    const indexes = [
        ['idx_daily_recap_user_date', 'CREATE INDEX IF NOT EXISTS idx_daily_recap_user_date ON daily_recap(user_id, recap_date)'],
        ['idx_daily_recap_completion', 'CREATE INDEX IF NOT EXISTS idx_daily_recap_completion ON daily_recap(completion_status)'],
        ['idx_daily_recap_completed_at', 'CREATE INDEX IF NOT EXISTS idx_daily_recap_completed_at ON daily_recap(completed_at)']
    ];

    indexes.forEach(([name, sql]) => {
        try {
            db.prepare(sql).run();
            console.log(`  ✓ 索引: ${name}`);
        } catch (err) {
            console.log(`  ⚠️ 索引已存在或创建失败: ${name}`);
        }
    });

    console.log('✅ 每日复盘表扩展成功！');

} catch (error) {
    console.error('❌ 扩展每日复盘表失败:', error);
    throw error;
} finally {
    db.close();
}
