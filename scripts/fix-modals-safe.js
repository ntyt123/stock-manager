const fs = require('fs');
const path = require('path');

// 需要修复的文件列表
const files = [
    'position-manager.js',
    'analysis-manager.js',
    'recommendation-manager.js',
    'trade-manager.js',
    'trading-plan-manager.js',
    'stock-pool-manager.js',
    'portfolio-optimization-manager.js',
    'history-manager.js',
    'recap-manager.js',
    'report-manager.js'
];

const modulesPath = 'f:\\Git\\stock-manager\\public\\js\\modules';

files.forEach(file => {
    const filePath = path.join(modulesPath, file);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ 文件不存在: ${file}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 只替换明确的模态框控制语句
    // 匹配: getElementById('xxxModal').style.display = 'block'|'flex'|'none'
    const modalDisplayRegex = /getElementById\((['"]\w+Modal['"])\)\.style\.display\s*=\s*(['"])(block|flex|none)\2/g;

    content = content.replace(modalDisplayRegex, (match, modalId, quote, displayValue) => {
        changed = true;
        if (displayValue === 'none') {
            return `getElementById(${modalId}).classList.remove('show')`;
        } else {
            return `getElementById(${modalId}).classList.add('show')`;
        }
    });

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ 已修复: ${file}`);
    } else {
        console.log(`⏭️  跳过: ${file} (无需修改)`);
    }
});

console.log('\n✅ 安全修复完成！');
