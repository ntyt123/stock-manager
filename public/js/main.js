// ==================== Main.js - 主入口文件 ====================
//
// 本文件已重构为模块化架构
// 所有功能模块已拆分到以下位置：
// - /js/main-core.js - 核心初始化逻辑
// - /js/modules/ui-utils.js - UI工具函数
// - /js/modules/position-manager.js - 持仓管理
// - /js/modules/watchlist-manager.js - 自选股管理
// - /js/modules/analysis-manager.js - 分析功能
// - /js/modules/market-data.js - 市场数据
// - /js/modules/stock-detail.js - 股票详情
// - /js/modules/recommendation-manager.js - 推荐管理
// - /js/modules/trade-manager.js - 交易管理
// - /js/modules/trading-plan-manager.js - 交易计划管理
// - /js/stockChart.js - 股票图表
//
// HTML文件引用顺序：
// 1. stockChart.js (图表组件)
// 2. ui-utils.js (基础工具)
// 3. position-manager.js, watchlist-manager.js, analysis-manager.js等（功能模块）
// 4. main-core.js (核心初始化)
//
// 重构完成时间: 2025-10
// 原文件已备份至: main.js.backup
// ========================================

console.log('✅ main.js已完成模块化重构');
console.log('📦 所有功能已拆分到独立模块中');
console.log('🚀 系统初始化由 main-core.js 负责');
