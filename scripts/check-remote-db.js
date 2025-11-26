/**
 * 检查远程数据库表结构
 * 用于诊断表结构不一致问题
 */

const Database = require('better-sqlite3');
const path = require('path');

// 修改此路径为你的数据库文件路径
const dbPath = path.join(__dirname, '../stock_manager.db');

console.log('📊 检查 daily_recap 表结构...\n');

try {
    const db = new Database(dbPath);

    // 获取所有字段信息
    const columns = db.prepare('PRAGMA table_info(daily_recap)').all();

    // V2版本需要的字段
    const requiredV2Columns = [
        'market_emotion',
        'limit_up_count',
        'limit_down_count',
        'blown_board_count',      // V2.1新增：炸板数
        'blown_board_rate',
        'active_themes',
        'market_notes',
        'trade_reflections',
        'no_trade_reason',
        'position_notes',
        'what_went_right',
        'what_went_wrong',
        'error_details',
        'reflection_notes',
        'self_rating',
        'tomorrow_plans',
        'tomorrow_notes',
        'week_stats',
        'month_stats',
        'completion_status',
        'last_section_edited',
        'draft_saved_at'
    ];

    const existingColumns = columns.map(col => col.name);
    const missingColumns = requiredV2Columns.filter(col => !existingColumns.includes(col));

    console.log('✅ 已存在的 V2 字段:');
    requiredV2Columns.forEach(col => {
        if (existingColumns.includes(col)) {
            const colInfo = columns.find(c => c.name === col);
            console.log(`   ✓ ${col} (${colInfo.type})`);
        }
    });

    if (missingColumns.length > 0) {
        console.log('\n❌ 缺失的 V2 字段:');
        missingColumns.forEach(col => {
            console.log(`   ✗ ${col}`);
        });
        console.log('\n⚠️ 警告: 数据库缺少 V2 版本的字段！');
        console.log('💡 解决方法: 运行迁移脚本');
        console.log('   node database/migrations/010_extend_daily_recap_for_v2.js\n');
    } else {
        console.log('\n✅ 所有 V2 字段都已存在！');
        console.log('📝 数据库表结构完整。\n');
    }

    db.close();

} catch (error) {
    console.error('❌ 检查失败:', error.message);
    process.exit(1);
}
