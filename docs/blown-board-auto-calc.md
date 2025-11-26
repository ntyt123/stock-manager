# 炸板率自动计算功能

## 功能说明

在每日复盘的"市场环境"模块中，炸板率现在支持自动计算。

### 使用方法

1. **输入数据**
   - 涨停数：输入当天的涨停股票数量
   - 炸板数：输入当天的炸板股票数量（从涨停板炸下来的数量）

2. **自动计算**
   - 炸板率会根据公式自动计算：**炸板率 = 炸板数 / (涨停数 + 炸板数) × 100%**
   - 炸板率字段为只读，无需手动输入

3. **实时更新**
   - 当你修改涨停数或炸板数时，炸板率会实时自动更新
   - 保存时会同时保存炸板数和计算后的炸板率

### 计算公式解释

炸板率反映了市场情绪的强弱：

- **炸板数**：封涨停后又打开的股票数量
- **涨停数**：当天仍然封住涨停的股票数量
- **炸板率** = 炸板数 / (涨停数 + 炸板数) × 100%

**示例：**
- 涨停数：50
- 炸板数：10
- 炸板率 = 10 / (50 + 10) × 100% = 16.7%

**市场情绪参考：**
- 炸板率 < 10%：市场情绪强，承接力好
- 炸板率 10%-20%：市场情绪正常
- 炸板率 20%-30%：市场情绪一般，追高需谨慎
- 炸板率 > 30%：市场情绪弱，承接力差

## 技术实现

### 前端
- 文件：`public/js/modules/recap-manager.js`
- 添加了炸板数输入框
- 炸板率改为只读显示框
- 实时监听涨停数和炸板数的变化，自动计算并更新炸板率

### 后端
- 文件：`controllers/recapController.js`
- 在 `saveMarketEnvironment` 函数中添加了 `blown_board_count` 字段处理
- 同时保存炸板数和炸板率到数据库

### 数据库
- 迁移文件：`database/migrations/012_add_blown_board_count.js`
- 新增字段：`blown_board_count` (INTEGER)
- 保留字段：`blown_board_rate` (REAL)

## 部署到远程服务器

如果你已经部署了应用到远程服务器，需要运行数据库迁移：

```bash
# 方法1：使用自动化脚本
powershell -ExecutionPolicy Bypass -File scripts/deploy-db-migration.ps1

# 方法2：手动SSH到服务器
ssh root@42.192.40.196
cd /root/stock-manager
node database/migrations/012_add_blown_board_count.js
pm2 restart stock-manager
```

详细部署指南请参考：[scripts/README-db-migration.md](../scripts/README-db-migration.md)

## 向后兼容

- 旧数据中没有炸板数的记录会显示为 0
- 已有的炸板率数据会被保留
- 新保存的数据会同时包含炸板数和炸板率
