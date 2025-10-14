# Stock Manager 项目结构说明

> 📁 项目目录结构详细说明文档
>
> 📅 最后更新: 2025-10-13

---

## 📂 目录结构总览

```
stock-manager/
├── 📁 controllers/          业务逻辑控制器
├── 📁 routes/               API路由定义
├── 📁 utils/                工具函数和辅助模块
├── 📁 public/               前端静态资源
├── 📁 tools/                开发工具脚本
├── 📁 scripts/              各类脚本文件
│   ├── 📁 deploy/          部署相关脚本
│   ├── 📁 broker-sync/     券商同步脚本
│   ├── 📁 migration/       数据库迁移脚本
│   └── 📁 test/            测试脚本
├── 📁 docs/                 项目文档
│   ├── 📁 guides/          使用指南
│   ├── 📁 design/          设计文档
│   └── 📁 reports/         开发报告
├── 📁 test_data/           测试数据
├── 📄 server.js            主服务器文件
├── 📄 database.js          数据库配置和初始化
├── 📄 stockCache.js        股票数据缓存模块
├── 📄 ecosystem.config.js  PM2进程管理配置
├── 📄 package.json         NPM项目配置
├── 📄 Dockerfile           Docker容器配置
├── 📄 install.bat          Windows安装脚本
├── 📄 README.md            项目说明文档
├── 📄 .env.development     开发环境配置
├── 📄 .env.production.example  生产环境配置模板
└── 📄 .gitignore           Git忽略文件配置
```

---

## 📋 详细说明

### 🎯 核心目录

#### `controllers/` - 业务逻辑控制器
存放所有业务逻辑处理代码，每个控制器负责特定的业务模块。

```
controllers/
├── analysisController.js       # 分析功能控制器
├── costManagementController.js # 成本管理控制器
├── positionController.js       # 持仓管理控制器
├── profitAnalysisController.js # 盈亏分析控制器
├── stockController.js          # 股票数据控制器
└── tradingPlanController.js    # 交易计划控制器
```

**用途：** 处理业务逻辑，与路由层分离，提高代码可维护性。

#### `routes/` - API路由定义
定义所有RESTful API路由和接口。

```
routes/
├── ai.js                # AI相关接口
├── analysis.js          # 分析接口
├── auth.js              # 认证接口
├── cache.js             # 缓存管理接口
├── cost-management.js   # 成本管理接口
├── news.js              # 新闻接口
├── positions.js         # 持仓接口
├── profit-analysis.js   # 盈亏分析接口
├── recommendations.js   # 推荐接口
├── stock.js             # 股票数据接口
├── trades.js            # 交易操作接口
├── trading-plans.js     # 交易计划接口
└── watchlist.js         # 自选股接口
```

**用途：** 定义API端点，处理HTTP请求，调用控制器处理业务逻辑。

#### `utils/` - 工具函数
通用工具函数和辅助模块。

```
utils/
├── stockQuoteHelper.js   # 股票行情辅助函数
└── tradingCalendar.js    # 交易日历工具
```

**用途：** 提供可复用的工具函数，避免代码重复。

#### `public/` - 前端静态资源
前端HTML、CSS、JavaScript文件。

```
public/
├── css/                  # 样式文件
├── js/                   # JavaScript脚本
├── index.html            # 主页面
├── login.html            # 登录页面
├── admin.html            # 管理页面
└── README.md             # 前端说明文档
```

**用途：** 存放所有前端静态资源，由Express静态文件服务提供。

---

### 🔧 脚本目录

#### `scripts/deploy/` - 部署脚本
所有部署相关的脚本和工具。

```
scripts/deploy/
├── deploy.js             # Node.js部署脚本（交互式）
├── deploy.bat            # Windows批处理部署脚本
├── logs.bat              # 查看服务器日志脚本
├── status.bat            # 查看服务状态脚本
└── server-setup.sh       # 服务器初始化脚本（Ubuntu）
```

**用途：**
- `deploy.js` - 交互式配置和部署到远程服务器
- `deploy.bat` - 快速一键部署
- `logs.bat` - 远程查看PM2日志
- `status.bat` - 查看远程服务器状态
- `server-setup.sh` - 自动化配置Ubuntu服务器环境

**使用方法：**
```bash
# 部署到生产环境
npm run deploy

# 或使用批处理脚本
npm run deploy:bat

# 查看日志
npm run logs

# 查看状态
npm run status
```

#### `scripts/broker-sync/` - 券商同步脚本
与券商系统对接的Python脚本。

```
scripts/broker-sync/
├── ebroker_sync.py       # 券商数据同步主脚本
├── check_brokers.py      # 券商连接检查
├── test_easytrader.py    # Easytrader测试脚本
└── test_sync_manual.py   # 手动同步测试
```

**用途：** 自动从券商系统同步持仓、交易数据。

**相关文档：** `docs/guides/EBROKER_SYNC_GUIDE.md`

#### `scripts/migration/` - 数据库迁移脚本
数据库结构变更和数据迁移脚本。

```
scripts/migration/
└── migrate-add-total-capital.js  # 添加总资金字段迁移
```

**用途：** 管理数据库schema变更，保持数据一致性。

#### `scripts/test/` - 测试脚本
各种测试和调试脚本。

```
scripts/test/
├── check_new_report.js   # 检查新报告
├── check_report.js       # 检查报告
├── get_user.js           # 获取用户信息
└── test_new_prompt.js    # 测试新提示
```

**用途：** 用于开发阶段的功能测试和调试。

---

### 📚 文档目录

#### `docs/guides/` - 使用指南
面向用户和开发者的使用指南文档。

```
docs/guides/
├── DEPLOYMENT_GUIDE.md   # 部署指南（完整）
├── EBROKER_SYNC_GUIDE.md # 券商同步指南
└── GUANGDA_API_GUIDE.md  # 光大证券API指南
```

**用途：** 提供详细的使用说明和操作指南。

#### `docs/design/` - 设计文档
系统设计和架构文档。

```
docs/design/
├── TRADING_PLAN_DESIGN.md  # 交易计划设计文档
├── REFACTORING_PLAN.md     # 重构计划
└── 系统架构图.txt           # 系统架构说明
```

**用途：** 记录系统设计思路和架构决策。

#### `docs/reports/` - 开发报告
开发过程中的各种总结和报告。

```
docs/reports/
├── API分时数据优化说明.md
├── CSS_REFACTORING_SUMMARY.md
├── IMPLEMENTATION_SUMMARY.md
├── INTRADAY_DATA_GUIDE.md
├── OPTIMIZATION_SUMMARY.md
├── REFACTOR.md
├── RISK_WARNING_BEAUTIFICATION.md
└── TEST_REPORT.md
```

**用途：** 记录优化过程、重构总结、测试报告等。

---

### 🗄️ 数据和工具

#### `test_data/` - 测试数据
用于开发和测试的示例数据。

```
test_data/
└── 我的持仓.xls           # 测试用持仓数据
```

**用途：** 提供测试数据，用于功能验证。

#### `tools/` - 开发工具
开发辅助工具脚本。

```
tools/
├── split-main-js.js         # JS文件拆分工具
└── testTradingCalendar.js   # 交易日历测试工具
```

**用途：** 开发过程中的辅助工具。

---

## 🔑 核心文件说明

### `server.js`
主服务器文件，Express应用的入口点。

**功能：**
- 初始化Express应用
- 加载环境变量配置
- 注册所有路由
- 配置中间件
- 启动HTTP服务器
- 配置定时任务

**启动方式：**
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### `database.js`
数据库配置和初始化。

**功能：**
- 连接SQLite数据库
- 创建数据表结构
- 数据库迁移
- 导出数据库操作接口

### `stockCache.js`
股票数据缓存模块。

**功能：**
- 缓存股票行情数据
- 减少API调用频率
- 提高系统响应速度
- 支持缓存过期策略

### `ecosystem.config.js`
PM2进程管理配置。

**功能：**
- 定义PM2进程配置
- 设置自动重启策略
- 配置日志输出
- 环境变量管理

**使用方式：**
```bash
pm2 start ecosystem.config.js
pm2 reload ecosystem.config.js
pm2 status
```

### `package.json`
NPM项目配置文件。

**包含：**
- 项目依赖包
- NPM脚本命令
- 项目元信息

**常用脚本：**
```bash
npm run dev          # 开发模式
npm start            # 生产模式
npm run deploy       # 部署
npm run logs         # 查看日志
npm run status       # 查看状态
```

---

## 🔐 配置文件

### `.env.development`
本地开发环境配置。

**包含：**
- NODE_ENV=development
- PORT=3000
- JWT_SECRET（开发用）
- DB_PATH=./stock_manager_dev.db

**特点：** 使用独立的开发数据库，避免污染生产数据。

### `.env.production.example`
生产环境配置模板。

**包含：**
- NODE_ENV=production
- PORT=3000
- JWT_SECRET（需替换为强密钥）
- DB_PATH=./stock_manager.db

**使用方法：**
1. 复制为 `.env.production`
2. 修改JWT_SECRET为强随机密钥
3. 根据需要调整其他配置

### `.gitignore`
Git忽略文件配置。

**主要排除：**
- node_modules/
- *.db（数据库文件）
- .env, .env.production（环境配置）
- logs/（日志文件）
- backups/（备份文件）
- .deploy-config.json（部署配置）

---

## 📝 开发指南

### 添加新功能

1. **创建路由** - 在 `routes/` 目录添加新路由文件
2. **创建控制器** - 在 `controllers/` 目录添加业务逻辑
3. **更新server.js** - 注册新路由
4. **添加前端页面** - 在 `public/` 目录添加HTML/JS/CSS
5. **测试功能** - 编写测试脚本放在 `scripts/test/`
6. **更新文档** - 在 `docs/` 目录添加相关文档

### 目录命名规范

- **小写字母** - 目录名使用小写字母和连字符
- **复数形式** - 集合类目录使用复数（如 controllers, routes）
- **语义化** - 目录名应清晰表达其用途
- **避免缩写** - 除非是广为人知的缩写

### 文件命名规范

- **驼峰命名** - JavaScript文件使用驼峰命名法（如 stockController.js）
- **短横线分隔** - 配置文件使用短横线（如 cost-management.js）
- **大写Markdown** - 文档文件使用大写字母和下划线（如 DEPLOYMENT_GUIDE.md）

---

## 🔄 变更历史

### 2025-10-13 - 目录结构重构
- ✅ 创建 `scripts/` 目录，整理所有脚本文件
- ✅ 创建 `docs/` 子目录，分类整理文档
- ✅ 移动部署脚本到 `scripts/deploy/`
- ✅ 移动测试脚本到 `scripts/test/`
- ✅ 移动券商同步脚本到 `scripts/broker-sync/`
- ✅ 移动数据库迁移脚本到 `scripts/migration/`
- ✅ 更新 `package.json` 中的脚本路径
- ✅ 根目录更加清爽，易于维护

**变更原因：** 原根目录下有15+个文档文件和多个脚本，难以管理和查找。

**变更影响：**
- 路径更新已完成，所有功能正常工作
- 部署脚本使用 `npm run deploy` 调用，无需关心路径
- 文档分类清晰，查找更方便

---

## 🔍 快速查找

### 我想...

**部署到服务器**
→ 查看 `docs/guides/DEPLOYMENT_GUIDE.md`
→ 使用 `scripts/deploy/deploy.bat`

**配置券商同步**
→ 查看 `docs/guides/EBROKER_SYNC_GUIDE.md`
→ 使用 `scripts/broker-sync/` 中的脚本

**修改API接口**
→ 编辑 `routes/` 中的路由文件
→ 编辑 `controllers/` 中的控制器

**修改前端页面**
→ 编辑 `public/` 中的HTML/JS/CSS文件

**查看系统设计**
→ 查看 `docs/design/` 目录

**运行测试**
→ 使用 `scripts/test/` 中的测试脚本

**添加新功能**
→ 参考上方"开发指南"章节

---

## 💡 最佳实践

### 文件放置建议

| 文件类型 | 放置位置 | 示例 |
|---------|---------|------|
| API路由 | `routes/` | `routes/stock.js` |
| 业务逻辑 | `controllers/` | `controllers/stockController.js` |
| 工具函数 | `utils/` | `utils/stockQuoteHelper.js` |
| 前端资源 | `public/` | `public/js/main.js` |
| 部署脚本 | `scripts/deploy/` | `scripts/deploy/deploy.bat` |
| 测试脚本 | `scripts/test/` | `scripts/test/check_report.js` |
| 使用指南 | `docs/guides/` | `docs/guides/DEPLOYMENT_GUIDE.md` |
| 设计文档 | `docs/design/` | `docs/design/TRADING_PLAN_DESIGN.md` |
| 开发报告 | `docs/reports/` | `docs/reports/TEST_REPORT.md` |

### 保持整洁

1. **定期清理** - 删除不再使用的文件
2. **及时归档** - 将旧文档移到 `docs/reports/`
3. **避免堆积** - 不要在根目录创建临时文件
4. **使用.gitignore** - 排除临时文件和敏感信息
5. **更新文档** - 修改结构后及时更新本文档

---

## 📞 需要帮助？

如果对项目结构有任何疑问：

1. 📖 查看 `README.md` - 项目总体说明
2. 📋 查看 `docs/guides/` - 详细使用指南
3. 🔍 使用项目搜索功能找到相关文件

---

**祝开发愉快！** 🎉
