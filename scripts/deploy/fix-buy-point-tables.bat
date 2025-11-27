@echo off
chcp 65001 >nul
REM ==========================================
REM 修复远程服务器买入点验证表
REM ==========================================

cls
echo.
echo ========================================
echo    修复买入点验证功能数据库表
echo ========================================
echo.

REM 配置
set REMOTE_USER=root
set REMOTE_HOST=42.192.40.196
set REMOTE_PATH=/root/stock-manager
set BRANCH=master

echo 📋 修复配置:
echo    服务器: %REMOTE_USER%@%REMOTE_HOST%
echo    路径: %REMOTE_PATH%
echo.
echo 🎯 将执行以下操作:
echo    1. 推送修复脚本到 GitHub
echo    2. 在远程服务器拉取最新代码
echo    3. 备份数据库
echo    4. 运行数据库修复脚本
echo    5. 重启服务
echo.

set /p CONFIRM=确认开始修复? (y/n):
if /i not "%CONFIRM%"=="y" (
    echo.
    echo ❌ 修复已取消
    pause
    exit /b 0
)

echo.
echo 🎯 开始修复流程...
echo.

REM ========== 步骤1: 提交修复脚本 ==========
echo 📝 步骤 1/6: 提交修复脚本...
git add scripts/fix-remote-database.js scripts/DEPLOY_FIX.md scripts/deploy/fix-buy-point-tables.bat
git commit -m "fix: 添加远程服务器数据库修复脚本 - 创建买入点验证表" 2>nul
if errorlevel 1 (
    echo ℹ️  没有新的更改需要提交
) else (
    echo ✅ 修复脚本已提交
)
echo.

REM ========== 步骤2: 推送代码 ==========
echo 📤 步骤 2/6: 推送代码到远程仓库...
git push origin %BRANCH%
if errorlevel 1 (
    echo ⚠️  推送失败或无需推送
) else (
    echo ✅ 代码推送成功
)
echo.

REM ========== 步骤3: 拉取代码到服务器 ==========
echo 📥 步骤 3/6: 拉取代码到服务器...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && git pull origin %BRANCH%"
if errorlevel 1 (
    echo ❌ 拉取失败
    pause
    exit /b 1
)
echo ✅ 代码已更新
echo.

REM ========== 步骤4: 备份数据库 ==========
echo 💾 步骤 4/6: 备份数据库...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && cp stock_manager.db stock_manager.db.backup-before-buy-point-fix-$(date +%%Y%%m%%d-%%H%%M%%S) 2>/dev/null && echo '✅ 数据库已备份'"
echo.

REM ========== 步骤5: 运行修复脚本 ==========
echo 🔧 步骤 5/6: 运行数据库修复脚本...
echo.
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && node scripts/fix-remote-database.js"
if errorlevel 1 (
    echo.
    echo ❌ 修复失败！
    echo.
    echo 💡 故障排查建议:
    echo    1. 检查远程服务器 Node.js 是否正常运行
    echo    2. 检查数据库文件权限
    echo    3. 查看远程服务器日志: ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && pm2 logs stock-manager"
    echo.
    pause
    exit /b 1
)
echo.
echo ✅ 数据库修复完成
echo.

REM ========== 步骤6: 重启服务 ==========
echo 🔄 步骤 6/6: 重启服务...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && pm2 restart stock-manager"
if errorlevel 1 (
    echo ❌ 重启失败
    pause
    exit /b 1
)
echo ✅ 服务已重启
echo.

REM ========== 检查服务状态 ==========
echo 📊 检查服务状态...
ssh %REMOTE_USER%@%REMOTE_HOST% "pm2 list | grep stock-manager"
echo.

REM ========== 验证表结构 ==========
echo 🔍 验证数据库表...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && sqlite3 stock_manager.db \"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%%validation%%';\""
echo.

REM ========== 完成 ==========
echo.
echo ========================================
echo 🎉 修复成功！
echo ========================================
echo.
echo 📍 访问地址: http://%REMOTE_HOST%:3000
echo.
echo 💡 测试步骤:
echo    1. 刷新浏览器 (Ctrl+F5 强制刷新)
echo    2. 悬停任意股票代码查看详情弹窗
echo    3. 点击右上角的 ✅ 按钮
echo    4. 应该能看到 "验证买入点" 弹窗，不再报 500 错误
echo.
echo ⏰ 修复时间: %date% %time%
echo.
echo 📝 如果仍有问题，请查看:
echo    - 远程日志: ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && pm2 logs stock-manager --lines 50"
echo    - 部署文档: scripts\DEPLOY_FIX.md
echo.
echo ========================================
echo.
pause
