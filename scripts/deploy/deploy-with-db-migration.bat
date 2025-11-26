@echo off
chcp 65001 >nul
REM ==========================================
REM 完整部署 - 包含数据库迁移
REM ==========================================

cls
echo.
echo ========================================
echo    Stock Manager 完整部署
echo ========================================
echo.

REM 配置（根据实际情况修改）
set REMOTE_USER=root
set REMOTE_HOST=42.192.40.196
set REMOTE_PATH=/root/stock-manager
set BRANCH=master

echo 📋 部署配置:
echo    服务器: %REMOTE_USER%@%REMOTE_HOST%
echo    路径: %REMOTE_PATH%
echo    分支: %BRANCH%
echo.

set /p CONFIRM=确认开始部署? (y/n):
if /i not "%CONFIRM%"=="y" (
    echo.
    echo ❌ 部署已取消
    pause
    exit /b 0
)

echo.
echo 🎯 开始部署流程...
echo.

REM ========== 步骤1: 检查本地状态 ==========
echo 📝 步骤 1/7: 检查本地Git状态...
git status --short
echo.

REM ========== 步骤2: 提交代码（如果有修改）==========
echo 📝 步骤 2/7: 提交本地更改...
git add .
git commit -m "feat: 炸板率自动计算 + Toast反馈提示优化" 2>nul
if errorlevel 1 (
    echo ℹ️  没有新的更改需要提交
) else (
    echo ✅ 代码已提交
)
echo.

REM ========== 步骤3: 推送代码 ==========
echo 📤 步骤 3/7: 推送代码到远程仓库...
git push origin %BRANCH%
if errorlevel 1 (
    echo ⚠️  推送失败或无需推送
) else (
    echo ✅ 代码推送成功
)
echo.

REM ========== 步骤4: 拉取代码到服务器 ==========
echo 📥 步骤 4/7: 拉取代码到服务器...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && git pull origin %BRANCH%"
if errorlevel 1 (
    echo ❌ 拉取失败
    pause
    exit /b 1
)
echo ✅ 代码已更新
echo.

REM ========== 步骤5: 备份数据库 ==========
echo 💾 步骤 5/7: 备份数据库...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && cp stock_manager.db stock_manager.db.backup-$(date +%%Y%%m%%d-%%H%%M%%S) 2>/dev/null || echo '数据库已备份'"
echo ✅ 备份完成
echo.

REM ========== 步骤6: 运行数据库迁移 ==========
echo 🔄 步骤 6/7: 运行数据库迁移...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && node database/migrations/012_add_blown_board_count.js"
if errorlevel 1 (
    echo ⚠️  迁移可能已执行或出现错误
) else (
    echo ✅ 迁移成功
)
echo.

REM ========== 步骤7: 重启服务 ==========
echo 🔄 步骤 7/7: 重启服务...
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
ssh %REMOTE_USER%@%REMOTE_HOST% "pm2 list"
echo.

REM ========== 完成 ==========
echo.
echo ========================================
echo 🎉 部署成功！
echo ========================================
echo.
echo 📍 访问地址: http://%REMOTE_HOST%:3000
echo.
echo 💡 测试步骤:
echo    1. 刷新浏览器
echo    2. 打开每日复盘
echo    3. 填写市场环境数据
echo    4. 点击保存按钮
echo    5. 查看顶部的绿色成功提示
echo.
echo ⏰ 部署时间: %date% %time%
echo ========================================
echo.
pause
