/**
 * 数据库迁移：添加AI API配置的联网搜索开关字段
 * 用于支持DeepSeek、SiliconFlow等AI服务的联网搜索功能
 */

const { db } = require('../connection');

function up() {
    console.log('🔄 开始迁移: 添加AI API配置的联网搜索字段...');

    try {
        // 检查字段是否已存在
        const tableInfo = db.prepare('PRAGMA table_info(ai_api_configs)').all();
        const hasWebSearchField = tableInfo.some(col => col.name === 'enable_web_search');

        if (hasWebSearchField) {
            console.log('✅ enable_web_search 字段已存在，跳过迁移');
            return;
        }

        // 添加 enable_web_search 字段
        db.prepare(`
            ALTER TABLE ai_api_configs
            ADD COLUMN enable_web_search INTEGER DEFAULT 0
        `).run();

        console.log('✅ 成功添加 enable_web_search 字段');

    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        throw error;
    }
}

function down() {
    console.log('⏪ 开始回滚: 移除enable_web_search字段...');

    try {
        // SQLite不支持直接删除列，需要重建表
        // 这里简化处理，只输出提示
        console.log('⚠️  SQLite不支持直接删除列，如需回滚请手动处理');
    } catch (error) {
        console.error('❌ 回滚失败:', error.message);
        throw error;
    }
}

// 如果直接运行此文件
if (require.main === module) {
    try {
        up();
        console.log('✅ 迁移完成');
        process.exit(0);
    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        process.exit(1);
    }
}

module.exports = { up, down };
