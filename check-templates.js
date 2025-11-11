const { db } = require('./database/connection');

try {
    const result = db.prepare(`
        SELECT * FROM ai_prompt_templates
        WHERE scene_type IN ('trend_prediction', 'stock_trend_prediction')
    `).all();

    console.log('趋势预测模板数量:', result.length);

    if (result.length === 0) {
        console.log('❌ 未找到趋势预测模板');
    } else {
        result.forEach(r => {
            console.log(`\n模板: ${r.scene_name}`);
            console.log(`  场景类型: ${r.scene_type}`);
            console.log(`  是否启用: ${r.is_active ? '是' : '否'}`);
        });
    }
} catch (error) {
    console.error('❌ 查询失败:', error.message);
}
