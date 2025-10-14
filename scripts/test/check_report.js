const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'stock_manager.db');
const db = new Database(dbPath);

// 获取最新的分析报告
const report = db.prepare(`
    SELECT id, user_id, created_at,
           substr(analysis_content, 1, 2000) as content_preview,
           length(analysis_content) as content_length
    FROM analysis_reports
    ORDER BY created_at DESC
    LIMIT 1
`).get();

if (report) {
    console.log('========== 最新报告信息 ==========');
    console.log('报告ID:', report.id);
    console.log('用户ID:', report.user_id);
    console.log('创建时间:', report.created_at);
    console.log('内容长度:', report.content_length, '字符');
    console.log('\n========== 内容预览（前2000字符） ==========');
    console.log(report.content_preview);
    console.log('\n========== 检查风险预警标记 ==========');

    // 获取完整内容
    const fullReport = db.prepare(`
        SELECT analysis_content
        FROM analysis_reports
        WHERE id = ?
    `).get(report.id);

    const content = fullReport.analysis_content;

    // 检查是否包含风险预警标记
    const hasStartMarker = content.includes('<!-- RISK_WARNING_START -->');
    const hasEndMarker = content.includes('<!-- RISK_WARNING_END -->');

    console.log('包含开始标记:', hasStartMarker);
    console.log('包含结束标记:', hasEndMarker);

    if (hasStartMarker && hasEndMarker) {
        const startIndex = content.indexOf('<!-- RISK_WARNING_START -->');
        const endIndex = content.indexOf('<!-- RISK_WARNING_END -->');
        const warningSection = content.substring(startIndex, endIndex + '<!-- RISK_WARNING_END -->'.length);
        console.log('\n========== 风险预警部分 ==========');
        console.log(warningSection);
    } else {
        console.log('\n⚠️ 未找到完整的风险预警标记！');

        // 搜索可能的风险预警相关内容
        if (content.includes('风险')) {
            console.log('\n========== 包含"风险"关键词的部分 ==========');
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                if (line.includes('风险')) {
                    console.log(`第${index + 1}行: ${line}`);
                }
            });
        }
    }
} else {
    console.log('未找到任何报告');
}

db.close();
