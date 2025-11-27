================================================================================
远程服务器数据库问题修复指南
================================================================================

问题症状:
1. 验证买入点功能报 500 错误
2. 短线选股功能报 500 错误
3. 三日选股法加载失败
4. 前端报错: Platform is not defined

根本原因:
- 远程服务器数据库缺少必需的表
- JavaScript加载时机问题导致Platform对象未定义

================================================================================
已修复的问题
================================================================================

✅ Platform检测脚本 - 修复DOM加载前执行导致的错误
✅ 数据库表完整性 - 自动创建9个必需表:
   1. short_term_pool - 短线股票池
   2. stock_criteria_settings - 选股标准配置
   3. buy_point_validations - 买入点验证记录
   4. validation_configs - 验证配置
   5. review_notes - 复盘笔记
   6. trading_plans_short - 短线交易计划
   7. three_day_selection_configs - 三日选股配置
   8. three_day_selection_results - 三日选股结果
   9. three_day_selection_stats - 三日选股统计

================================================================================
快速修复方式（推荐）
================================================================================

方式1: 运行自动化脚本
------------------------------------------
1. 在本地Windows环境下打开命令行
2. 进入项目目录: cd f:\Git\stock-manager
3. 运行: scripts\deploy\fix-buy-point-tables.bat
4. 按 y 确认执行
5. 等待完成提示

方式2: 手动SSH执行
------------------------------------------
1. SSH登录远程服务器:
   ssh root@42.192.40.196

2. 进入项目目录:
   cd /root/stock-manager

3. 拉取最新代码:
   git pull origin master

4. 备份数据库（可选但推荐）:
   cp stock_manager.db stock_manager.db.backup-$(date +%Y%m%d-%H%M%S)

5. 运行修复脚本:
   node scripts/ensure-required-tables.js

6. 重启服务:
   pm2 restart stock-manager

7. 验证服务:
   pm2 logs stock-manager --lines 20

================================================================================
验证修复是否成功
================================================================================

1. 前端错误检查:
   - 打开浏览器访问: http://42.192.40.196:3000
   - 按 F12 打开开发者工具
   - 查看Console，应该没有 "Platform is not defined" 错误
   - 应该能看到 "平台检测信息" 日志

2. 买入点验证功能:
   - 悬停任意股票代码查看详情弹窗
   - 点击右上角 ✅ 按钮
   - 应该能看到验证窗口，不再报 500 错误

3. 短线选股功能:
   - 打开短线交易页面
   - 应该能正常加载选股标准配置
   - 三日选股法应该能正常显示

4. 服务器日志检查:
   ssh root@42.192.40.196 "pm2 logs stock-manager --lines 50 --nostream"

   应该没有数据库表不存在的错误

================================================================================
已推送的文件（GitHub master分支）
================================================================================

前端修复:
✅ public/js/platform-detector.js - 修复DOM加载问题

数据库工具:
✅ scripts/ensure-required-tables.js - 确保所有必需表存在（主要）
✅ scripts/fix-remote-database.js - 只创建买入点验证表（旧版）
✅ scripts/list-tables.js - 列出所有数据库表
✅ scripts/sync-database-schema.js - 数据库架构同步

部署脚本:
✅ scripts/deploy/fix-buy-point-tables.bat - 自动化部署脚本
✅ scripts/DEPLOY_FIX.md - 详细部署文档

最新Commits:
- 137051f - fix: 修复platform-detector在DOM加载前执行导致的错误
- 0a3ec5c - feat: 添加数据库表完整性检查和修复脚本
- 4ff04ae - chore: 更新部署脚本使用新的数据库修复工具

================================================================================
故障排查
================================================================================

问题1: 脚本运行后仍然报 500 错误
解决方案:
1. 检查表是否创建成功:
   ssh root@42.192.40.196
   cd /root/stock-manager
   node scripts/list-tables.js | grep "short_term_pool\|stock_criteria\|validation"

2. 如果表不存在，手动创建:
   node scripts/ensure-required-tables.js

3. 重启服务:
   pm2 restart stock-manager

问题2: Platform is not defined 错误
解决方案:
1. 确认已拉取最新代码:
   git pull origin master

2. 清除浏览器缓存（Ctrl+Shift+Delete）

3. 强制刷新页面（Ctrl+F5）

问题3: 部署脚本无法连接SSH
解决方案:
1. 检查SSH密钥配置
2. 使用手动SSH执行方式（见上文）

问题4: 数据库备份失败
说明: 备份失败不影响修复过程，可以忽略该错误继续执行

================================================================================
技术细节
================================================================================

修复的JavaScript错误:
- platform-detector.js:103 - Cannot read properties of null (reading 'classList')
  原因: document.body在脚本执行时为null
  修复: 添加DOM就绪检查，等待DOMContentLoaded事件

- update-manager.js:18 - Platform is not defined
  原因: Platform对象在其他模块加载前未初始化
  修复: 确保platform-detector.js正确初始化Platform对象

数据库表结构:
- 所有表都包含user_id外键关联到users表
- 使用AUTOINCREMENT主键
- 包含created_at和updated_at时间戳
- 合适的索引以提高查询性能

索引:
- idx_buy_validations_user_stock: 用户+股票代码复合索引
- idx_buy_validations_time: 验证时间索引
- idx_buy_validations_score: 评分排序索引
- idx_short_term_pool_user_method: 用户+选股方法复合索引
- idx_short_term_pool_status: 状态+天数复合索引

================================================================================

最后更新: 2025-11-27 (修复Platform错误 + 数据库表完整性)
版本: v2.0 - 全面修复版
