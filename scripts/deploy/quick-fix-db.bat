@echo off
chcp 65001 >nul
REM ==========================================
REM 快速修复远程数据库 - 添加炸板数字段
REM ==========================================

cls
echo.
echo ========================================
echo    快速修复远程数据库
echo ========================================
echo.

REM 配置（根据实际情况修改）
set REMOTE_USER=root
set REMOTE_HOST=42.192.40.196
set REMOTE_PATH=/root/stock-manager

echo 📋 目标服务器:
echo    %REMOTE_USER%@%REMOTE_HOST%
echo    路径: %REMOTE_PATH%
echo.

set /p CONFIRM=确认开始修复数据库? (y/n):
if /i not "%CONFIRM%"=="y" (
    echo.
    echo ❌ 操作已取消
    pause
    exit /b 0
)

echo.
echo 🎯 开始修复流程...
echo.

REM ========== 步骤1: 上传迁移脚本 ==========
echo 📤 步骤 1/4: 上传迁移脚本...
scp database/migrations/012_add_blown_board_count.js %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_PATH%/database/migrations/
if errorlevel 1 (
    echo ❌ 上传失败
    pause
    exit /b 1
)
echo ✅ 上传成功
echo.

REM ========== 步骤2: 备份数据库 ==========
echo 💾 步骤 2/4: 备份数据库...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && cp stock_manager.db stock_manager.db.backup-$(date +%%Y%%m%%d-%%H%%M%%S)"
echo ✅ 备份完成
echo.

REM ========== 步骤3: 运行迁移 ==========
echo 🔄 步骤 3/4: 运行数据库迁移...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && node database/migrations/012_add_blown_board_count.js"
if errorlevel 1 (
    echo ❌ 迁移失败
    pause
    exit /b 1
)
echo ✅ 迁移成功
echo.

REM ========== 步骤4: 重启服务 ==========
echo 🔄 步骤 4/4: 重启服务...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && pm2 restart stock-manager"
if errorlevel 1 (
    echo ⚠️  重启失败，请手动重启
) else (
    echo ✅ 服务已重启
)
echo.

REM ========== 完成 ==========
echo.
echo ========================================
echo 🎉 数据库修复完成！
echo ========================================
echo.
echo 现在可以刷新页面测试保存功能了
echo.
pause
