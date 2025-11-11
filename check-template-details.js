const { db } = require('./database/connection');
const { aiPromptTemplateModel } = require('./database');

try {
    console.log('检查 trend_prediction 模板:');
    const template1 = aiPromptTemplateModel.findBySceneType('trend_prediction');

    if (template1) {
        console.log('✅ 找到模板');
        console.log('ID:', template1.id);
        console.log('场景类型:', template1.scene_type);
        console.log('场景名称:', template1.scene_name);
        console.log('是否启用:', template1.is_active);
        console.log('is_active 类型:', typeof template1.is_active);
        console.log('判断结果 (is_active == 1):', template1.is_active == 1);
        console.log('判断结果 (is_active === 1):', template1.is_active === 1);
        console.log('判断结果 (!template || !template.is_active):', !template1 || !template1.is_active);
    } else {
        console.log('❌ 未找到模板');
    }

    console.log('\n查询原始SQL:');
    const raw = db.prepare('SELECT * FROM ai_prompt_templates WHERE scene_type = ?').get('trend_prediction');
    console.log('Raw query result:', raw);

} catch (error) {
    console.error('❌ 查询失败:', error.message);
    console.error(error.stack);
}
