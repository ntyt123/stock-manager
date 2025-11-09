# 股票管理系统 (Stock Manager) - 项目结构文档

## 📋 目录

- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [核心功能模块](#核心功能模块)
- [数据库结构](#数据库结构)
- [API接口文档](#api接口文档)
- [前端页面结构](#前端页面结构)
- [快速定位指南](#快速定位指南)
- [开发指南](#开发指南)

---

## 项目概述

这是一个基于Node.js + Express + SQLite的股票管理系统，提供用户认证、持仓管理、自选股管理、AI智能分析等功能。

**主要特点：**
- 单页应用（SPA）架构，基于Tab切换
- RESTful API设计
- JWT身份认证
- 集成多个真实金融数据API
- AI分析功能（DeepSeek API）
- 完整的前后端分离

---

## 技术栈

### 后端
- **Node.js** + **Express.js** - Web框架
- **SQLite** + **better-sqlite3** - 数据库
- **JWT** (jsonwebtoken) - 身份认证
- **bcryptjs** - 密码加密
- **axios** - HTTP客户端
- **iconv-lite** - 字符编码转换
- **dotenv** - 环境变量管理

### 前端
- **原生JavaScript** (ES6+) - 无框架
- **Marked.js** - Markdown渲染
- **CSS3** - 样式（支持响应式和深色模式）

### 外部API
- **Sina Finance API** - 实时行情
- **NetEase Finance API** - 财务数据
- **East Money API** - 估值数据
- **DeepSeek API** - AI分析

---

## 目录结构

```
F:\Git\stock-manager\
│
├── server.js                          # 主服务器入口文件
├── package.json                       # 项目依赖配置
├── .env                              # 环境变量（API密钥等）
├── PROJECT_STRUCTURE.md              # 本文档
│
├── database/                         # 数据库相关
│   ├── init.js                       # 数据库初始化和表创建
│   ├── index.js                      # 数据库导出入口
│   └── models/                       # 数据模型层
│       ├── user.js                   # 用户模型
│       ├── position.js               # 持仓模型
│       ├── watchlist.js              # 自选股模型
│       ├── analysis.js               # 技术分析模型
│       └── fundamental.js            # 基本面分析模型
│
├── routes/                           # API路由
│   ├── auth.js                       # 认证相关API（注册/登录）
│   ├── position.js                   # 持仓管理API
│   ├── watchlist.js                  # 自选股管理API
│   ├── analysis.js                   # 技术分析API
│   └── fundamental.js                # 基本面分析API
│
├── controllers/                      # 控制器层
│   └── analysisController.js         # AI分析控制器（DeepSeek API调用）
│
├── utils/                            # 工具函数
│   └── fundamentalDataFetcher.js     # 基本面数据获取工具
│
├── public/                           # 静态资源（前端）
│   ├── index.html                    # 主页面（SPA单页）
│   │
│   ├── css/                          # 样式文件
│   │   ├── styles.css                # 全局样式
│   │   └── modules/                  # 模块样式
│   │       ├── position.css          # 持仓模块样式
│   │       ├── watchlist.css         # 自选股模块样式
│   │       ├── ai.css                # AI分析模块样式
│   │       └── fundamental.css       # 基本面分析模块样式
│   │
│   └── js/                           # JavaScript文件
│       ├── auth.js                   # 认证相关（登录/注册）
│       ├── app.js                    # 应用主逻辑（Tab切换等）
│       └── modules/                  # 功能模块
│           ├── position-manager.js   # 持仓管理模块
│           ├── watchlist-manager.js  # 自选股管理模块
│           ├── analysis-manager.js   # 技术分析管理模块
│           ├── fundamental-analysis.js # 基本面分析模块
│           └── ui-utils.js           # UI工具函数（通知等）
│
└── data/                             # 数据存储目录
    └── stock-manager.db              # SQLite数据库文件

```

---

## 核心功能模块

### 1. 用户认证模块
**涉及文件：**
- `routes/auth.js` - 注册/登录API
- `database/models/user.js` - 用户数据模型
- `public/js/auth.js` - 前端认证逻辑

**主要功能：**
- 用户注册（密码bcrypt加密）
- 用户登录（JWT token生成）
- Token验证中间件

### 2. 持仓管理模块
**涉及文件：**
- `routes/position.js` - 持仓API
- `database/models/position.js` - 持仓数据模型
- `public/js/modules/position-manager.js` - 前端持仓管理
- `public/css/modules/position.css` - 持仓样式

**主要功能：**
- 添加/编辑/删除持仓
- 持仓列表展示
- 盈亏计算
- 持仓统计

### 3. 自选股管理模块
**涉及文件：**
- `routes/watchlist.js` - 自选股API
- `database/models/watchlist.js` - 自选股数据模型
- `public/js/modules/watchlist-manager.js` - 前端自选股管理
- `public/css/modules/watchlist.css` - 自选股样式

**主要功能：**
- 添加/删除自选股
- 自选股列表展示
- 实时行情更新（可选）

### 4. 技术分析模块
**涉及文件：**
- `routes/analysis.js` - 技术分析API
- `database/models/analysis.js` - 技术分析数据模型
- `public/js/modules/analysis-manager.js` - 前端分析管理
- `controllers/analysisController.js` - AI分析控制器
- `public/css/modules/ai.css` - 分析模块样式

**主要功能：**
- 股票技术分析
- AI智能分析（DeepSeek）
- 分析历史记录
- K线图展示（TradingView组件）

### 5. 基本面分析模块
**涉及文件：**
- `routes/fundamental.js` - 基本面分析API
- `database/models/fundamental.js` - 基本面数据模型
- `public/js/modules/fundamental-analysis.js` - 前端基本面分析
- `utils/fundamentalDataFetcher.js` - 数据获取工具
- `public/css/modules/fundamental.css` - 基本面样式

**主要功能：**
- 获取真实基本面数据（多API源）
- AI智能分析基本面
- 财务数据展示（营收、利润、现金流等）
- 估值指标（PE、PB、PS等）
- 盈利能力指标（ROE、ROA等）
- 成长性指标（增长率、EPS等）
- 偿债能力指标（负债率、流动比率等）
- 从自选股快速选择
- 分析历史记录

---

## 数据库结构

数据库文件：`data/stock-manager.db`（SQLite）

### 表结构

#### 1. users（用户表）
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    created_at TEXT NOT NULL
)
```

#### 2. positions（持仓表）
```sql
CREATE TABLE positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stock_code TEXT NOT NULL,
    stock_name TEXT NOT NULL,
    buy_price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    buy_date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
)
```

#### 3. watchlist（自选股表）
```sql
CREATE TABLE watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stock_code TEXT NOT NULL,
    stock_name TEXT NOT NULL,
    added_at TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, stock_code)
)
```

#### 4. technical_analysis（技术分析表）
```sql
CREATE TABLE technical_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stock_code TEXT NOT NULL,
    stock_name TEXT NOT NULL,
    analysis_content TEXT NOT NULL,
    chart_data TEXT,
    analysis_type TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
)
```

#### 5. fundamental_analysis（基本面分析表）
```sql
CREATE TABLE fundamental_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stock_code TEXT NOT NULL,
    stock_name TEXT NOT NULL,
    fundamental_data TEXT NOT NULL,  -- JSON格式的基本面数据
    analysis_content TEXT NOT NULL,   -- AI分析结果
    analysis_type TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
)
```

---

## API接口文档

### 基础URL
`http://localhost:3000`

### 认证相关 `/api/auth`

#### POST `/api/auth/register` - 用户注册
**Request:**
```json
{
    "username": "testuser",
    "password": "password123",
    "email": "test@example.com"
}
```
**Response:**
```json
{
    "success": true,
    "message": "注册成功"
}
```

#### POST `/api/auth/login` - 用户登录
**Request:**
```json
{
    "username": "testuser",
    "password": "password123"
}
```
**Response:**
```json
{
    "success": true,
    "token": "jwt_token_here",
    "userId": 1,
    "username": "testuser"
}
```

### 持仓管理 `/api/positions`
**需要认证：所有接口需要 `Authorization: Bearer <token>` 头**

#### GET `/api/positions` - 获取持仓列表
**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "stock_code": "600519",
            "stock_name": "贵州茅台",
            "buy_price": 1800.50,
            "quantity": 100,
            "buy_date": "2024-01-01",
            "notes": "长期持有"
        }
    ]
}
```

#### POST `/api/positions` - 添加持仓
**Request:**
```json
{
    "stockCode": "600519",
    "stockName": "贵州茅台",
    "buyPrice": 1800.50,
    "quantity": 100,
    "buyDate": "2024-01-01",
    "notes": "长期持有"
}
```

#### PUT `/api/positions/:id` - 更新持仓
#### DELETE `/api/positions/:id` - 删除持仓

### 自选股管理 `/api/watchlist`
**需要认证**

#### GET `/api/watchlist` - 获取自选股列表
#### POST `/api/watchlist` - 添加自选股
**Request:**
```json
{
    "stockCode": "600519",
    "stockName": "贵州茅台",
    "notes": "重点关注"
}
```
#### DELETE `/api/watchlist/:id` - 删除自选股

### 技术分析 `/api/analysis`
**需要认证**

#### POST `/api/analysis` - AI技术分析
**Request:**
```json
{
    "query": "600519",
    "period": "daily",
    "indicators": ["MA", "MACD", "RSI"]
}
```
**Response:**
```json
{
    "success": true,
    "data": {
        "analysisId": 1,
        "analysis": "AI分析结果（Markdown格式）",
        "chartData": {...},
        "timestamp": "2024-01-01T00:00:00.000Z"
    }
}
```

#### GET `/api/analysis/history` - 获取分析历史
#### GET `/api/analysis/history/:id` - 获取单个分析详情
#### DELETE `/api/analysis/history/:id` - 删除分析记录

### 基本面分析 `/api/fundamental`
**需要认证**

#### GET `/api/fundamental/data?query=600519` - 获取基本面数据
**Response:**
```json
{
    "success": true,
    "data": {
        "stockCode": "600519",
        "stockName": "贵州茅台",
        "currentPrice": 1800.50,
        "changePercent": 2.5,
        "marketCap": "22500亿元",
        "revenue": "1200亿元",
        "netProfit": "500亿元",
        "pe": 45.5,
        "pb": 12.3,
        "roe": 25.5,
        "revenueGrowth": 15.5,
        "profitGrowth": 18.2,
        "debtRatio": 25.5
    }
}
```

#### POST `/api/fundamental/analyze` - AI基本面分析
**Request:**
```json
{
    "query": "600519"
}
```
**Response:**
```json
{
    "success": true,
    "data": {
        "analysisId": 1,
        "analysis": "AI分析报告（Markdown格式）",
        "fundamentalData": {...},
        "timestamp": "2024-01-01T00:00:00.000Z",
        "prompt": "发送给AI的提示词"
    }
}
```

#### GET `/api/fundamental/history` - 获取基本面分析历史
#### GET `/api/fundamental/history/:id` - 获取单个分析详情
#### DELETE `/api/fundamental/history/:id` - 删除分析记录
#### GET `/api/fundamental/watchlist` - 获取自选股列表（用于下拉选择）

---

## 前端页面结构

### 主页面 `index.html`

整个应用是**单页应用（SPA）**，所有功能通过Tab切换显示。

#### Tab结构：
1. **首页** (`#home-tab`)
2. **持仓管理** (`#positions-tab`)
3. **自选股** (`#watchlist-tab`)
4. **分析中心** (`#analysis-tab`)
   - 子Tab：技术分析 (`#analysis-technical`)
   - 子Tab：基本面分析 (`#analysis-fundamentals`)

#### 页面区域ID对照表：

| 功能区域 | DOM元素ID | 对应JS模块 |
|---------|----------|-----------|
| 登录表单 | `loginForm` | `auth.js` |
| 注册表单 | `registerForm` | `auth.js` |
| 持仓列表 | `positionsList` | `position-manager.js` |
| 持仓模态框 | `positionModal` | `position-manager.js` |
| 自选股列表 | `watchlistContainer` | `watchlist-manager.js` |
| 技术分析输入 | `stockInput` | `analysis-manager.js` |
| 技术分析结果 | `analysisContainer` | `analysis-manager.js` |
| 基本面输入 | `fundamentalStockInput` | `fundamental-analysis.js` |
| 基本面数据展示 | `fundamentalDataContainer` | `fundamental-analysis.js` |
| 基本面分析结果 | `fundamentalAnalysisContainer` | `fundamental-analysis.js` |
| 自选股下拉框 | `fundamentalWatchlistSelect` | `fundamental-analysis.js` |

---

## 快速定位指南

### 按功能查找文件

| 需要修改的功能 | 后端文件 | 前端文件 | 数据库模型 | 样式文件 |
|--------------|---------|---------|-----------|---------|
| 用户注册/登录 | `routes/auth.js` | `public/js/auth.js` | `database/models/user.js` | `public/css/styles.css` |
| 持仓管理 | `routes/position.js` | `public/js/modules/position-manager.js` | `database/models/position.js` | `public/css/modules/position.css` |
| 自选股管理 | `routes/watchlist.js` | `public/js/modules/watchlist-manager.js` | `database/models/watchlist.js` | `public/css/modules/watchlist.css` |
| 技术分析 | `routes/analysis.js` | `public/js/modules/analysis-manager.js` | `database/models/analysis.js` | `public/css/modules/ai.css` |
| 基本面分析 | `routes/fundamental.js` | `public/js/modules/fundamental-analysis.js` | `database/models/fundamental.js` | `public/css/modules/fundamental.css` |
| AI分析功能 | `controllers/analysisController.js` | - | - | - |
| 数据获取 | `utils/fundamentalDataFetcher.js` | - | - | - |

### 按问题类型查找文件

| 问题类型 | 相关文件 |
|---------|---------|
| 数据库表结构 | `database/init.js` |
| API路由注册 | `server.js` (line 78-100) |
| 数据库连接 | `database/index.js` |
| JWT认证中间件 | `server.js` (line 43-63) |
| Tab切换逻辑 | `public/js/app.js` |
| 全局样式 | `public/css/styles.css` |
| 通知提示 | `public/js/modules/ui-utils.js` |

---

## 开发指南

### 添加新功能模块的步骤

#### 1. 创建数据库模型
**文件位置：** `database/models/your-module.js`

```javascript
const db = require('../index').db;

const yourModel = {
    create: (data) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare('INSERT INTO your_table (...) VALUES (...)').run(...);
                resolve({ id: info.lastInsertRowid });
            } catch (err) {
                reject(err);
            }
        });
    },
    // ... 其他方法
};

module.exports = { yourModel };
```

**在 `database/init.js` 中添加表：**
```javascript
db.prepare(`CREATE TABLE IF NOT EXISTS your_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ...
)`).run();
```

**在 `database/index.js` 中导出：**
```javascript
const { yourModel } = require('./models/your-module');
module.exports = { ..., yourModel };
```

#### 2. 创建API路由
**文件位置：** `routes/your-module.js`

```javascript
const express = require('express');
const { yourModel } = require('../database');

module.exports = (authenticateToken) => {
    const router = express.Router();

    router.get('/data', authenticateToken, async (req, res) => {
        // 处理逻辑
        res.json({ success: true, data: ... });
    });

    return router;
};
```

**在 `server.js` 中注册路由：**
```javascript
const yourRoutes = require('./routes/your-module')(authenticateToken);
app.use('/api/your-module', yourRoutes);
```

#### 3. 创建前端模块
**文件位置：** `public/js/modules/your-module-manager.js`

```javascript
async function yourFunction() {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/your-module/data', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            displayData(result.data);
        }
    } catch (error) {
        console.error('错误:', error);
        showNotification('操作失败', 'error');
    }
}
```

**在 `index.html` 中引入：**
```html
<script src="/js/modules/your-module-manager.js"></script>
```

#### 4. 添加样式
**文件位置：** `public/css/modules/your-module.css`

```css
.your-module-container {
    /* 样式 */
}
```

**在 `index.html` 中引入：**
```html
<link rel="stylesheet" href="/css/modules/your-module.css">
```

#### 5. 在首页添加Tab（如需要）
**在 `index.html` 中添加Tab按钮和内容区：**
```html
<!-- Tab按钮 -->
<button class="tab-btn" data-tab="your-module">
    <span class="tab-icon">📊</span>
    <span class="tab-text">你的模块</span>
</button>

<!-- Tab内容 -->
<div id="your-module-tab" class="tab-content">
    <!-- 你的内容 -->
</div>
```

### 常见开发任务示例

#### 修改API返回格式
**文件：** `routes/your-module.js`
```javascript
// 修改此处的res.json()调用
res.json({
    success: true,
    data: yourData,
    message: '自定义消息'
});
```

#### 添加新的数据库字段
1. **修改** `database/init.js` 中的表创建SQL
2. **删除** `data/stock-manager.db` 文件
3. **重启服务器**（会自动重新创建数据库）

#### 修改前端显示样式
1. **定位元素：** 在浏览器开发者工具中找到元素的class或id
2. **查找样式文件：** 根据功能模块找到对应的CSS文件
3. **修改样式：** 直接编辑CSS文件
4. **刷新页面**查看效果

#### 调试AI分析问题
1. **查看提示词：** 打开浏览器控制台，AI分析会输出发送的提示词
2. **修改提示词：** 在 `routes/fundamental.js` (line 97-170) 或 `routes/analysis.js` 中修改
3. **查看API调用：** 在 `controllers/analysisController.js` 中添加console.log

---

## 常见问题

### 1. 数据库相关
**Q: 如何重置数据库？**
A: 删除 `data/stock-manager.db` 文件，重启服务器即可自动重新创建。

**Q: 如何查看数据库内容？**
A: 使用SQLite客户端（如DB Browser for SQLite）打开 `data/stock-manager.db`。

### 2. API相关
**Q: API返回401错误？**
A: 检查token是否过期或无效，前端需要重新登录获取新token。

**Q: 如何测试API？**
A: 使用Postman或curl，记得添加 `Authorization: Bearer <token>` 头。

### 3. 前端相关
**Q: 修改后页面没变化？**
A: 清除浏览器缓存或强制刷新（Ctrl+F5）。

**Q: 如何查看前端错误？**
A: 打开浏览器开发者工具（F12），查看Console标签。

### 4. 外部API相关
**Q: 获取基本面数据失败？**
A: 检查 `utils/fundamentalDataFetcher.js`，可能是外部API限流或网络问题。

**Q: AI分析失败？**
A: 检查 `.env` 文件中的 `DEEPSEEK_API_KEY` 是否正确配置。

---

## 总结

本文档提供了项目的完整结构概览，帮助开发者快速理解项目架构和定位需要修改的文件。

**开发建议：**
1. 修改功能前，先阅读本文档的快速定位指南
2. 遵循现有代码的命名规范和结构模式
3. 修改数据库结构后记得重置数据库
4. 添加新功能时参考开发指南的步骤
5. 遇到问题先查看常见问题部分

**关键文件优先级：**
- 🔴 高频修改：`routes/*`, `public/js/modules/*`, `public/css/modules/*`
- 🟡 中频修改：`database/models/*`, `index.html`
- 🟢 低频修改：`server.js`, `database/init.js`, `controllers/*`, `utils/*`

---

**文档版本：** 2.0
**最后更新：** 2025-10-17
**维护者：** AI Assistant
