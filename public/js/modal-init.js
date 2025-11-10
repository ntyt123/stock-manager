/**
 * 模态框统一初始化脚本
 * 功能：页面加载完成后，将所有模态框移动到body根部，避免父容器CSS限制导致的显示问题
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 开始初始化模态框...');

    // 查找所有class包含'modal'的元素
    const allModals = document.querySelectorAll('.modal');

    let movedCount = 0;
    allModals.forEach(modal => {
        // 如果模态框不在body的直接子级，则移动到body
        if (modal.parentElement && modal.parentElement.tagName !== 'BODY') {
            document.body.appendChild(modal);
            movedCount++;
            console.log(`✅ 已移动模态框: ${modal.id || '(无ID)'}`);
        }
    });

    if (movedCount > 0) {
        console.log(`✅ 模态框初始化完成，共移动 ${movedCount} 个模态框到body根部`);
    } else {
        console.log('✅ 模态框初始化完成，所有模态框已在正确位置');
    }
});
