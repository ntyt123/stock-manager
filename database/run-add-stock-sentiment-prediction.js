// 运行添加六壬股票情绪预测提示词的SQL脚本

const fs = require('fs');
const path = require('path');
const { db } = require('./connection');

async function runSQL() {
    try {
        console.log('🚀 开始添加六壬股票情绪预测提示词模板...');

        // 读取SQL文件
        const sqlPath = path.join(__dirname, 'add-stock-sentiment-prediction-prompt.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // 执行SQL
        db.exec(sql);

        console.log('✅ 六壬股票情绪预测提示词模板添加成功！');

        // 验证数据
        const result = db.prepare(`SELECT * FROM ai_prompt_templates WHERE scene_type = 'stock_sentiment_prediction'`).get();
        if (result) {
            console.log('📊 验证数据:');
            console.log('  - 场景类型:', result.scene_type);
            console.log('  - 场景名称:', result.scene_name);
            console.log('  - 类别:', result.category);
            console.log('  - 是否激活:', result.is_active ? '是' : '否');
            console.log('  - 变量数:', JSON.parse(result.variables).length);
        } else {
            console.error('❌ 验证失败：未找到插入的数据');
        }

    } catch (error) {
        console.error('❌ 执行失败:', error.message);
        process.exit(1);
    }
}

// 运行
runSQL();
