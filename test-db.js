// 测试脚本：检查数据库表结构
const Database = require('better-sqlite3');
const db = new Database('./stock_manager.db');

console.log('📊 检查 analysis_reports 表结构:');
const columns = db.prepare(`PRAGMA table_info(analysis_reports)`).all();
console.log(columns);

console.log('\n📊 查询最新的分析报告:');
const latestReport = db.prepare(`
    SELECT id, user_id, report_type, created_at,
           CASE
               WHEN recommended_risk_rules IS NULL THEN 'NULL'
               WHEN recommended_risk_rules = '' THEN 'EMPTY'
               ELSE 'HAS DATA'
           END as rules_status,
           length(recommended_risk_rules) as rules_length
    FROM analysis_reports
    ORDER BY created_at DESC
    LIMIT 1
`).get();
console.log(latestReport);

if (latestReport && latestReport.rules_status === 'HAS DATA') {
    console.log('\n📊 查询完整的风险规则数据:');
    const fullReport = db.prepare(`
        SELECT recommended_risk_rules
        FROM analysis_reports
        WHERE id = ?
    `).get(latestReport.id);
    console.log('规则内容:', fullReport.recommended_risk_rules);
}

db.close();
