@echo off
REM ==========================================
REM 查看服务器状态脚本
REM ==========================================

chcp 65001 >nul

REM ========== 配置（与deploy.bat保持一致） ==========
set REMOTE_HOST=your-server-ip
set REMOTE_USER=ubuntu
set REMOTE_PORT=22

REM ================================================

cls
echo.
echo ========================================
echo    Stock Manager 服务器状态
echo ========================================
echo.

REM 检查配置
if "%REMOTE_HOST%"=="your-server-ip" (
    echo ❌ 错误: 请先在 deploy.bat 中配置服务器信息
    pause
    exit /b 1
)

echo 📋 服务器: %REMOTE_USER%@%REMOTE_HOST%
echo.

echo 🔍 正在获取服务状态...
echo.

ssh -p %REMOTE_PORT% %REMOTE_USER%@%REMOTE_HOST% "echo '========== PM2 进程状态 ==========' && pm2 status && echo. && echo '========== Stock Manager 详情 ==========' && pm2 info stock-manager && echo. && echo '========== 系统资源 ==========' && echo 'CPU使用率:' && top -bn1 | grep 'Cpu(s)' && echo '内存使用:' && free -h | grep -E 'Mem|内存' && echo '磁盘使用:' && df -h | grep -E '/$|Filesystem' && echo. && echo '========== 端口监听 ==========' && netstat -tlnp 2>/dev/null | grep ':3000' || ss -tlnp | grep ':3000'"

echo.
echo ========================================
echo 💡 其他操作:
echo    deploy.bat  - 重新部署
echo    logs.bat    - 查看日志
echo ========================================
echo.
pause
