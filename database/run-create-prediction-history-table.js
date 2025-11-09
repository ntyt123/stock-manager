// 运行创建预测历史记录表的SQL脚本

const fs = require('fs');
const path = require('path');
const { db } = require('./connection');

async function runSQL() {
    try {
        console.log('🚀 开始创建预测历史记录表...');

        // 读取SQL文件
        const sqlPath = path.join(__dirname, 'create-prediction-history-table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // 执行SQL
        db.exec(sql);

        console.log('✅ 预测历史记录表创建成功！');

        // 验证表是否创建
        const tableExists = db.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='prediction_history'
        `).get();

        if (tableExists) {
            console.log('📊 验证成功: prediction_history 表已创建');

            // 查看表结构
            const columns = db.prepare(`PRAGMA table_info(prediction_history)`).all();
            console.log('\n表结构:');
            columns.forEach(col => {
                console.log(`  - ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
            });
        } else {
            console.error('❌ 验证失败：表未创建');
        }

    } catch (error) {
        console.error('❌ 执行失败:', error.message);
        process.exit(1);
    }
}

// 运行
runSQL();
