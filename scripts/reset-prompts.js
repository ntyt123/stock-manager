// 重置AI提示词模板
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('🔄 开始重置AI提示词模板...');

    // 删除所有现有模板
    const deleteStmt = db.prepare('DELETE FROM ai_prompt_templates');
    const deleteResult = deleteStmt.run();
    console.log(`✅ 已删除 ${deleteResult.changes} 个旧模板`);

    // 重新初始化默认模板
    const { aiPromptTemplateModel } = require('../database/models/ai-prompt');
    aiPromptTemplateModel.initDefaultTemplates();

    console.log('✅ AI提示词模板重置完成！');

    // 验证
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM ai_prompt_templates');
    const count = countStmt.get();
    console.log(`📊 当前模板数量: ${count.count}`);

} catch (error) {
    console.error('❌ 重置失败:', error.message);
} finally {
    db.close();
}
