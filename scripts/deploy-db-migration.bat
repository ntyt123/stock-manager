@echo off
chcp 65001 >nul
echo 🚀 远程数据库迁移部署脚本
echo.

REM 远程服务器配置（请根据实际情况修改）
set REMOTE_USER=root
set REMOTE_HOST=42.192.40.196
set REMOTE_PATH=/root/stock-manager

echo 📋 步骤1: 上传检查脚本到远程服务器...
scp scripts/check-remote-db.js %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_PATH%/scripts/
if errorlevel 1 (
    echo ❌ 上传失败！请检查 SSH 连接
    pause
    exit /b 1
)

echo.
echo 📋 步骤2: 检查远程服务器数据库结构...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && node scripts/check-remote-db.js"
if errorlevel 1 (
    echo ⚠️ 检查脚本执行失败
)

echo.
set /p CONTINUE="是否继续运行迁移脚本？(y/n): "
if /i not "%CONTINUE%"=="y" (
    echo ❌ 取消迁移
    pause
    exit /b 0
)

echo.
echo 📤 步骤3: 运行远程迁移脚本...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && node database/migrations/010_extend_daily_recap_for_v2.js"
if errorlevel 1 (
    echo ❌ 迁移失败！
    pause
    exit /b 1
)

echo.
echo 📋 步骤4: 再次检查数据库结构...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && node scripts/check-remote-db.js"

echo.
echo 🔄 步骤5: 重启远程服务...
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && pm2 restart stock-manager"

echo.
echo ✅ 部署完成！
echo.
pause
