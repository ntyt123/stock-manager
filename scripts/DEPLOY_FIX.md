# 远程服务器数据库修复指南

## 问题描述
远程服务器上验证买入点功能报 500 错误，原因是缺少以下数据库表：
- `buy_point_validations` - 买入点验证记录表
- `validation_configs` - 验证配置表

## 修复步骤

### 方式1：在远程服务器上直接运行修复脚本（推荐）

1. 确保远程服务器代码已更新到最新版本：
```bash
cd /root/stock-manager
git pull
```

2. 运行修复脚本：
```bash
node scripts/fix-remote-database.js
```

3. 确认输出显示 "✅ 远程数据库修复完成！"

4. 重启服务（如果需要）：
```bash
pm2 restart stock-manager
```

### 方式2：集成到自动部署流程

修改 `scripts/deploy/deploy.bat` 文件，在部署后自动运行此脚本。

## 验证修复

修复完成后，访问股票管理系统，点击股票详情悬浮框中的 "✅ 验证买入点" 按钮，应该正常弹出验证窗口，不再报 500 错误。

## 脚本说明

- **脚本路径**: `scripts/fix-remote-database.js`
- **幂等性**: 可以安全地多次运行，不会重复创建表或数据
- **检查功能**: 自动检测表是否存在，只创建缺失的表
- **默认配置**: 自动插入验证功能所需的默认配置

## 创建的表结构

### buy_point_validations
存储买入点验证历史记录，包括：
- 评分信息（总分、技术分、趋势分、成交量分等）
- 技术指标快照
- 买入建议和风险提示
- 用户笔记和跟踪信息

### validation_configs
存储用户的验证配置，包括：
- 评分权重配置
- 评分阈值配置
- 默认配置

## 本地测试结果

```
✅ 成功连接到SQLite数据库
========================================
🔧 开始修复远程数据库...
========================================

📊 检查数据库表状态...
  现有表: buy_point_validations, validation_configs

✅ 所有表都已存在，无需修复！
✅ 脚本执行完成
```

## 常见问题

**Q: 如果远程服务器没有安装 git 怎么办？**
A: 可以手动上传 `fix-remote-database.js` 文件到远程服务器的 `scripts/` 目录。

**Q: 运行脚本后仍然报 500 错误？**
A: 检查远程服务器的 Node.js 进程是否已重启，确保新的代码已生效。

**Q: 如何确认表已成功创建？**
A: 可以登录远程服务器，运行：
```bash
sqlite3 stock_manager.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%validation%';"
```
应该能看到 `buy_point_validations` 和 `validation_configs` 两个表。
