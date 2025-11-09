// 测试AI提示词管理功能

const { db } = require('./database/connection');

console.log('🧪 测试AI提示词管理功能\n');

// 1. 查看所有提示词模板
console.log('📋 所有提示词模板:');
console.log('─'.repeat(80));

const templates = db.prepare(`
    SELECT
        id,
        scene_type,
        scene_name,
        category,
        is_active,
        description
    FROM ai_prompt_templates
    ORDER BY category, scene_name
`).all();

templates.forEach((t, index) => {
    const status = t.is_active ? '✅ 已启用' : '🚫 已禁用';
    console.log(`${index + 1}. [${status}] ${t.scene_name}`);
    console.log(`   场景类型: ${t.scene_type}`);
    console.log(`   类别: ${t.category}`);
    console.log(`   描述: ${t.description || '无'}`);
    console.log('');
});

// 2. 重点查看趋势分析相关的提示词
console.log('\n🎯 趋势分析相关提示词:');
console.log('─'.repeat(80));

const trendTemplates = db.prepare(`
    SELECT
        scene_type,
        scene_name,
        variables,
        LENGTH(system_prompt) as system_length,
        LENGTH(user_prompt_template) as user_length
    FROM ai_prompt_templates
    WHERE scene_type IN ('trend_prediction', 'stock_trend_prediction')
`).all();

trendTemplates.forEach(t => {
    console.log(`\n📊 ${t.scene_name} (${t.scene_type})`);
    console.log(`   系统提示词长度: ${t.system_length} 字符`);
    console.log(`   用户提示词长度: ${t.user_length} 字符`);

    const vars = JSON.parse(t.variables);
    console.log(`   变量数量: ${vars.length}`);
    console.log(`   变量列表: ${vars.map(v => v.key).join(', ')}`);
});

// 3. 验证变量配置的完整性
console.log('\n\n🔍 验证变量配置:');
console.log('─'.repeat(80));

const expectedVars = {
    'trend_prediction': ['stock_code', 'stock_name', 'prediction_date', 'trading_day_status'],
    'stock_trend_prediction': ['stock_code', 'stock_name', 'prediction_time', 'day_ganzhi', 'hour_ganzhi', 'month_jiang', 'sike', 'sanchuan', 'twelve_gods']
};

let allValid = true;

Object.entries(expectedVars).forEach(([sceneType, expectedKeys]) => {
    const template = db.prepare('SELECT variables FROM ai_prompt_templates WHERE scene_type = ?').get(sceneType);

    if (!template) {
        console.log(`❌ ${sceneType}: 模板不存在`);
        allValid = false;
        return;
    }

    const actualVars = JSON.parse(template.variables);
    const actualKeys = actualVars.map(v => v.key);

    const missing = expectedKeys.filter(k => !actualKeys.includes(k));
    const extra = actualKeys.filter(k => !expectedKeys.includes(k));

    if (missing.length === 0 && extra.length === 0) {
        console.log(`✅ ${sceneType}: 变量配置正确`);
    } else {
        console.log(`⚠️  ${sceneType}:`);
        if (missing.length > 0) {
            console.log(`   缺少变量: ${missing.join(', ')}`);
        }
        if (extra.length > 0) {
            console.log(`   多余变量: ${extra.join(', ')}`);
        }
        allValid = false;
    }
});

// 4. 检查提示词模板的质量
console.log('\n\n📏 提示词质量检查:');
console.log('─'.repeat(80));

const qualityCheck = db.prepare(`
    SELECT
        scene_type,
        scene_name,
        LENGTH(system_prompt) as sys_len,
        LENGTH(user_prompt_template) as user_len,
        description,
        is_active
    FROM ai_prompt_templates
    WHERE scene_type IN ('trend_prediction', 'stock_trend_prediction')
`).all();

qualityCheck.forEach(t => {
    console.log(`\n${t.scene_name}:`);

    // 检查系统提示词长度
    if (t.sys_len < 50) {
        console.log('  ⚠️  系统提示词过短 (建议至少50字符)');
    } else {
        console.log(`  ✅ 系统提示词长度: ${t.sys_len} 字符`);
    }

    // 检查用户提示词长度
    if (t.user_len < 100) {
        console.log('  ⚠️  用户提示词过短 (建议至少100字符)');
    } else {
        console.log(`  ✅ 用户提示词长度: ${t.user_len} 字符`);
    }

    // 检查描述
    if (!t.description || t.description.length < 10) {
        console.log('  ⚠️  缺少描述或描述过短');
    } else {
        console.log(`  ✅ 描述: ${t.description}`);
    }

    // 检查启用状态
    if (t.is_active) {
        console.log('  ✅ 状态: 已启用');
    } else {
        console.log('  ⚠️  状态: 已禁用');
    }
});

// 5. 测试总结
console.log('\n\n' + '='.repeat(80));
if (allValid) {
    console.log('✅ 所有测试通过！AI提示词管理功能配置正确。');
} else {
    console.log('⚠️  发现一些问题，请检查上述输出。');
}
console.log('='.repeat(80));

console.log('\n\n💡 提示:');
console.log('  - 在浏览器中访问: http://localhost:3000');
console.log('  - 登录后进入"设置" → "AI提示词管理"');
console.log('  - 可以查看、编辑和管理所有AI提示词模板');
console.log('  - 详细说明请查看: AI提示词管理说明.md');
