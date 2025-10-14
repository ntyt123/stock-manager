# 代码重构计划 - 文件拆分方案

## 目标
将超过2000行的文件拆分为模块化结构，提高代码可维护性。

## 当前状态
- ❌ **main.js**: 5133行 (超出156%)
- ❌ **server.js**: 4099行 (超出105%)
- ✅ **database.js**: 1073行 (符合要求)
- ✅ **stockCache.js**: 357行 (符合要求)
- ✅ **stockChart.js**: 628行 (符合要求)

---

## 📋 main.js 拆分方案 (5133行 → 8个模块)

### 模块1: ui-utils.js (~350行) ✅ 已创建
**功能**: UI基础工具
- showNotification
- updateNavbar
- initTabs, switchTab, switchSubTab
- initModalCloseOnBackgroundClick
- updateTime, goToLogin, goToAdmin, logout

### 模块2: position-manager.js (~900行)
**功能**: 持仓管理
- Excel上传: openExcelUploadModal, handleExcelFile, initExcelUpload
- 持仓显示: displayUploadedPositions, loadUserPositions
- 手动持仓: openManualPositionModal, submitManualPosition
- 数据清空: clearUploadedData

### 模块3: watchlist-manager.js (~500行)
**功能**: 自选股管理
- 列表管理: loadWatchlist, addToWatchlist, removeFromWatchlist
- 行情显示: loadWatchlistQuotes, loadOverviewWatchlistQuotes
- 批量操作: addPositionsToWatchlist

### 模块4: analysis-manager.js (~1200行)
**功能**: AI分析功能
- 持仓分析: analyzePortfolio, displayPortfolioAnalysis
- 集合竞价: analyzeCallAuction, displayCallAuctionAnalysis
- 报告管理: viewReportHistory, viewReportDetail, deleteReport
- 风险预警: loadRiskWarnings
- AI助手: sendToAI, clearAIChat

### 模块5: market-data.js (~800行)
**功能**: 市场数据
- 指数数据: loadMarketIndices, loadMarketOverview
- 新闻数据: loadHotNews, initNewsCategories, openNewsLink
- 统计数据: loadPortfolioStats, loadChangeDistribution, loadSystemStats
- 行业分布: loadIndustryDistribution
- 涨跌榜: loadTopGainersLosers
- 交易时间: loadTradeTimeReminder

### 模块6: stock-detail.js (~600行)
**功能**: 股票详情悬浮框
- 悬浮框: showStockTooltip, closeStockTooltip
- 数据获取: fetchStockDetail, buildCompanyInfo
- 图表渲染: renderTooltipChart, switchTooltipChartPeriod
- 事件绑定: initStockCodeHover, bindTooltipPeriodButtons

### 模块7: recommendation-manager.js (~500行)
**功能**: 股票推荐
- 推荐生成: generateRecommendation, displayStockRecommendation
- 推荐查询: loadRecommendationByDate, loadTodayRecommendation
- 历史管理: viewRecommendationHistory, deleteRecommendation

### 模块8: trade-manager.js (~600行)
**功能**: 交易记录
- 交易录入: openTradeRecordModal, submitTradeRecord
- 历史查看: viewTradeHistory, deleteTradeOperation
- 工具函数: bindTradeAmountCalculation, bindStockCodeAutoFill

### 模块9: main.js (保留 ~300行)
**功能**: 核心初始化
- DOMContentLoaded事件处理
- checkAuth身份验证
- 页面初始化流程
- 模块加载协调

---

## 🚀 server.js 拆分方案 (4099行 → 多个文件)

### routes/auth.js (~300行)
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### routes/positions.js (~400行)
- GET /api/positions
- POST /api/upload/positions
- DELETE /api/positions
- POST /api/manual-positions

### routes/watchlist.js (~200行)
- GET /api/watchlist
- POST /api/watchlist
- DELETE /api/watchlist/:code

### routes/stock.js (~600行)
- GET /api/stock/quote/:code
- POST /api/stock/quotes
- GET /api/stock/history/:code
- GET /api/stock/intraday/:code

### routes/analysis.js (~800行)
- POST /api/analysis/portfolio
- GET /api/analysis/reports
- POST /api/analysis/call-auction
- GET /api/analysis/industry-distribution
- GET /api/cache/stats

### routes/recommendations.js (~400行)
- POST /api/recommendations/generate
- GET /api/recommendations/:date
- GET /api/recommendations/list
- DELETE /api/recommendations/:id

### routes/trades.js (~300行)
- POST /api/trade-operations
- GET /api/trade-operations
- DELETE /api/trade-operations/:id

### controllers/ (~600行)
- aiController.js - AI调用逻辑
- stockController.js - 股票数据处理
- analysisController.js - 分析业务逻辑

### server.js (保留 ~500行)
- Express配置
- 中间件setup
- 路由注册
- 定时任务
- 数据库初始化
- 服务器启动

---

## 🔧 实施步骤

### 阶段1: 前端重构 (main.js)
1. ✅ 创建 modules 目录
2. ✅ 创建 ui-utils.js 模块
3. ⏳ 创建其余7个模块文件
4. ⏳ 更新 index.html 引入所有模块
5. ⏳ 简化 main.js 为核心初始化代码
6. ⏳ 测试所有功能

### 阶段2: 后端重构 (server.js)
1. 创建 routes 和 controllers 目录
2. 拆分路由到独立文件
3. 提取业务逻辑到控制器
4. 重构 server.js 为启动文件
5. 测试所有API

### 阶段3: 验证测试
1. 功能测试
2. 性能测试
3. 代码审查

---

## 📊 预期成果

### 前端文件结构
```
public/js/
├── main.js (300行) - 核心初始化
├── stockChart.js (628行) - 图表组件
└── modules/
    ├── ui-utils.js (350行) - UI工具
    ├── position-manager.js (900行) - 持仓管理
    ├── watchlist-manager.js (500行) - 自选股管理
    ├── analysis-manager.js (1200行) - 分析功能
    ├── market-data.js (800行) - 市场数据
    ├── stock-detail.js (600行) - 股票详情
    ├── recommendation-manager.js (500行) - 推荐功能
    └── trade-manager.js (600行) - 交易记录
```

### 后端文件结构
```
server/
├── server.js (500行) - 主文件
├── database.js (1073行) - 数据库
├── stockCache.js (357行) - 缓存
├── routes/
│   ├── auth.js (300行)
│   ├── positions.js (400行)
│   ├── watchlist.js (200行)
│   ├── stock.js (600行)
│   ├── analysis.js (800行)
│   ├── recommendations.js (400行)
│   └── trades.js (300行)
└── controllers/
    ├── aiController.js (200行)
    ├── stockController.js (200行)
    └── analysisController.js (200行)
```

---

## ⚠️ 注意事项

1. **向后兼容**: 确保重构不影响现有功能
2. **渐进式重构**: 每次只重构一个模块，完成后立即测试
3. **文档更新**: 同步更新README和API文档
4. **性能监控**: 重构后监控性能变化
5. **代码审查**: 每个模块完成后进行代码审查

---

## 当前进度

- ✅ 已完成: ui-utils.js模块创建
- ⏳ 进行中: 其余模块创建
- ⏳ 待完成: server.js重构

**最后更新**: 2025-10-10
