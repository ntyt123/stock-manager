const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'stock_manager.db');
const db = new Database(dbPath);

// 获取报告 ID 5 的完整内容
const report = db.prepare(`
    SELECT id, user_id, created_at, analysis_content
    FROM analysis_reports
    WHERE id = 5
`).get();

if (report) {
    console.log('========== 报告 ID 5 信息 ==========');
    console.log('报告ID:', report.id);
    console.log('用户ID:', report.user_id);
    console.log('创建时间:', report.created_at);
    console.log('内容长度:', report.analysis_content.length, '字符');

    // 检查是否包含新的Markdown标题格式
    const hasNewHeading = report.analysis_content.includes('## 【风险预警】');
    const hasOldMarker = report.analysis_content.includes('<!-- RISK_WARNING_START -->');

    console.log('\n========== 格式检查 ==========');
    console.log('包含新格式 (## 【风险预警】):', hasNewHeading);
    console.log('包含旧格式 (HTML注释):', hasOldMarker);

    if (hasNewHeading) {
        // 提取风险预警部分
        const match = report.analysis_content.match(/##\s*【风险预警】/);
        if (match) {
            const headingStart = match.index;
            const headingEnd = headingStart + match[0].length;
            const contentAfter = report.analysis_content.substring(headingEnd);
            const nextHeadingMatch = contentAfter.match(/\n##\s+/);

            let riskWarningText;
            if (nextHeadingMatch) {
                riskWarningText = contentAfter.substring(0, nextHeadingMatch.index);
            } else {
                riskWarningText = contentAfter.substring(0, 500); // 只显示前500字符
            }

            console.log('\n========== 风险预警内容预览 ==========');
            console.log('标题位置:', headingStart);
            console.log('内容:');
            console.log(riskWarningText.trim());
        }
    } else {
        console.log('\n⚠️ 报告中未包含新的Markdown标题格式！');
        console.log('\n前2000字符预览:');
        console.log(report.analysis_content.substring(0, 2000));
    }
} else {
    console.log('未找到报告 ID 5');
}

db.close();
