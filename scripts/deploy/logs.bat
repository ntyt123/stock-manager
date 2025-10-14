@echo off
REM ==========================================
REM 查看服务器日志脚本
REM ==========================================

chcp 65001 >nul

REM ========== 配置（与deploy.bat保持一致） ==========
set REMOTE_HOST=your-server-ip
set REMOTE_USER=ubuntu
set REMOTE_PORT=22
set REMOTE_PATH=/home/ubuntu/stock-manager

REM ================================================

echo.
echo ========================================
echo    Stock Manager 服务器日志
echo ========================================
echo.

REM 检查配置
if "%REMOTE_HOST%"=="your-server-ip" (
    echo ❌ 错误: 请先在 deploy.bat 中配置服务器信息
    pause
    exit /b 1
)

echo 📋 连接到: %REMOTE_USER%@%REMOTE_HOST%
echo.

REM 显示菜单
echo 选择查看方式：
echo   1. 实时日志（最新100行，持续更新）
echo   2. 错误日志（最近50行）
echo   3. 所有日志（最近200行）
echo   4. 服务状态
echo.

set /p CHOICE=请选择 (1-4):

if "%CHOICE%"=="1" (
    echo.
    echo 📊 实时日志 (按 Ctrl+C 退出)...
    echo.
    ssh -p %REMOTE_PORT% %REMOTE_USER%@%REMOTE_HOST% "pm2 logs stock-manager --lines 100"
) else if "%CHOICE%"=="2" (
    echo.
    echo ❌ 错误日志...
    echo.
    ssh -p %REMOTE_PORT% %REMOTE_USER%@%REMOTE_HOST% "pm2 logs stock-manager --err --lines 50 --nostream"
    pause
) else if "%CHOICE%"=="3" (
    echo.
    echo 📄 所有日志...
    echo.
    ssh -p %REMOTE_PORT% %REMOTE_USER%@%REMOTE_HOST% "pm2 logs stock-manager --lines 200 --nostream"
    pause
) else if "%CHOICE%"=="4" (
    echo.
    echo 📊 服务状态...
    echo.
    ssh -p %REMOTE_PORT% %REMOTE_USER%@%REMOTE_HOST% "pm2 status && echo. && pm2 info stock-manager"
    pause
) else (
    echo.
    echo ❌ 无效选择
    pause
    exit /b 1
)
