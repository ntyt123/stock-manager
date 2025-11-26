# 数据库迁移部署指南

## 问题描述

本地服务正常，但部署到远程服务器后保存市场环境失败，错误信息：
```
POST http://42.192.40.196:3000/api/recap/save-market-env 500 (Internal Server Error)
```

## 原因分析

远程服务器的数据库缺少 V2 版本的字段（`market_emotion`, `limit_up_count`, `blown_board_rate` 等），导致 SQL UPDATE 语句失败。

## 解决方案

### 方法一：使用自动化脚本（推荐）

#### Windows 系统 - 使用 PowerShell

```powershell
# 在项目根目录运行
powershell -ExecutionPolicy Bypass -File scripts/deploy-db-migration.ps1
```

#### Windows 系统 - 使用批处理

```cmd
# 在项目根目录运行
scripts\deploy-db-migration.bat
```

#### Linux/Mac 系统

```bash
# 在项目根目录运行
bash scripts/deploy-db-migration.sh
```

### 方法二：手动执行（如果自动化脚本失败）

1. **SSH 连接到远程服务器**
   ```bash
   ssh root@42.192.40.196
   ```

2. **进入项目目录**
   ```bash
   cd /root/stock-manager
   ```

3. **检查当前数据库结构**
   ```bash
   node scripts/check-remote-db.js
   ```

4. **如果有缺失字段，运行迁移脚本**
   ```bash
   node database/migrations/010_extend_daily_recap_for_v2.js
   node database/migrations/012_add_blown_board_count.js
   ```

5. **验证迁移结果**
   ```bash
   node scripts/check-remote-db.js
   ```

6. **重启服务**
   ```bash
   pm2 restart stock-manager
   ```

### 方法三：一键命令（适合熟悉 SSH 的用户）

```bash
ssh root@42.192.40.196 "cd /root/stock-manager && node database/migrations/010_extend_daily_recap_for_v2.js && pm2 restart stock-manager"
```

## 验证修复

1. 打开应用：http://42.192.40.196:3000
2. 进入每日复盘页面
3. 点击"保存市场环境"按钮
4. 应该显示"市场环境已保存"的成功提示

## 预防措施

### 将迁移脚本加入部署流程

编辑 `scripts/deploy/deploy.bat`，在部署时自动运行迁移：

```batch
@echo off
echo 📦 开始部署...

REM 部署代码
git pull origin master

REM 安装依赖
npm install

REM ⭐ 运行数据库迁移（新增）
echo 🔄 运行数据库迁移...
node database/migrations/010_extend_daily_recap_for_v2.js

REM 重启服务
pm2 restart stock-manager

echo ✅ 部署完成！
```

## 相关文件

- `scripts/check-remote-db.js` - 数据库结构检查脚本
- `database/migrations/010_extend_daily_recap_for_v2.js` - V2 迁移脚本
- `controllers/recapController.js:1343` - saveMarketEnvironment 函数

## 技术细节

V2 版本新增的 `daily_recap` 表字段：

- `market_emotion` - 市场情绪
- `limit_up_count` - 涨停数
- `limit_down_count` - 跌停数
- `blown_board_rate` - 炸板率
- `active_themes` - 活跃题材（JSON）
- `market_notes` - 市场观察备注
- `trade_reflections` - 交易反思（JSON）
- `position_notes` - 持仓备注（JSON）
- `what_went_right` / `what_went_wrong` - 复盘反思
- `tomorrow_plans` - 明日计划（JSON）
- `completion_status` - 完成状态
- `last_section_edited` - 最后编辑模块
- `draft_saved_at` - 草稿保存时间

## 常见问题

**Q: 脚本执行失败怎么办？**
A: 检查 SSH 连接是否正常，远程服务器的 Node.js 是否安装，数据库文件路径是否正确。

**Q: 迁移后数据会丢失吗？**
A: 不会。迁移脚本只添加新字段，不会删除或修改现有数据。

**Q: 需要备份数据库吗？**
A: 建议备份，但迁移脚本是安全的，只做 `ALTER TABLE ADD COLUMN` 操作。
