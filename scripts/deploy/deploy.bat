@echo off
REM ==========================================
REM Stock Manager 一键部署工具 (Windows批处理版本)
REM ==========================================
REM 功能：简化版部署脚本，适合快速部署
REM 使用：双击运行或执行 deploy.bat
REM ==========================================

chcp 65001 >nul

REM ========== 配置区域 ==========
REM 首次使用请修改以下配置

set REMOTE_HOST=http://42.192.40.196/
set REMOTE_USER=ubuntu
set REMOTE_PORT=22
set REMOTE_PATH=/opt/stock-manager
set BRANCH=master

REM ==============================

cls
echo.
echo ========================================
echo    Stock Manager 一键部署工具
echo ========================================
echo.

REM 检查配置
if "%REMOTE_HOST%"=="your-server-ip" (
    echo ❌ 错误: 请先配置服务器信息！
    echo.
    echo 📝 配置步骤：
    echo    1. 用文本编辑器打开 deploy.bat
    echo    2. 修改配置区域的以下变量：
    echo       - REMOTE_HOST  = 服务器IP地址
    echo       - REMOTE_USER  = SSH登录用户名
    echo       - REMOTE_PATH  = 服务器上的项目路径
    echo.
    pause
    exit /b 1
)

echo 📋 部署配置:
echo    服务器: %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_PORT%
echo    路径: %REMOTE_PATH%
echo    分支: %BRANCH%
echo.

set /p CONFIRM=确认开始部署? (y/n):
if /i not "%CONFIRM%"=="y" (
    echo.
    echo ❌ 部署已取消
    exit /b 0
)

echo.
echo 🎯 开始部署流程...
echo.

REM ==================== 步骤1: 检查Git状态 ====================
echo 📝 步骤 1/5: 检查本地代码状态...
git status --short
if errorlevel 1 (
    echo ⚠️  未检测到Git仓库
) else (
    echo ✅ Git仓库检查完成
)
echo.

REM ==================== 步骤2: 推送代码 ====================
echo 📤 步骤 2/5: 推送代码到远程仓库...
git push origin %BRANCH%
if errorlevel 1 (
    echo ❌ 代码推送失败
    echo.
    echo 💡 可能的原因：
    echo    1. 没有未提交的更改
    echo    2. Git仓库配置问题
    echo    3. 网络连接问题
    echo.
    set /p CONTINUE=继续部署? (y/n):
    if /i not "!CONTINUE!"=="y" (
        echo 部署已终止
        pause
        exit /b 1
    )
) else (
    echo ✅ 代码推送成功
)
echo.

REM ==================== 步骤3: 测试SSH连接 ====================
echo 🔌 步骤 3/5: 测试SSH连接...
ssh -p %REMOTE_PORT% -o ConnectTimeout=5 %REMOTE_USER%@%REMOTE_HOST% "echo SSH连接成功"
if errorlevel 1 (
    echo ❌ SSH连接失败
    echo.
    echo 💡 故障排查：
    echo    1. 确认服务器IP地址正确
    echo    2. 确认SSH服务已启动
    echo    3. 检查防火墙设置
    echo    4. 验证SSH密钥配置
    echo.
    pause
    exit /b 1
) else (
    echo ✅ SSH连接正常
)
echo.

REM ==================== 步骤4: 备份数据库 ====================
echo 💾 步骤 4/5: 备份生产数据库...
ssh -p %REMOTE_PORT% %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && mkdir -p backups && cp stock_manager.db backups/stock_manager_$(date +%%Y%%m%%d_%%H%%M%%S).db 2>/dev/null || echo '跳过备份（数据库不存在）'"
echo ✅ 备份步骤完成
echo.

REM ==================== 步骤5: 部署到服务器 ====================
echo 🚀 步骤 5/5: 部署到服务器...
echo.

ssh -p %REMOTE_PORT% %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && echo '📥 拉取代码...' && git pull origin %BRANCH% && echo '📦 安装依赖...' && npm install --production && echo '🔄 重启服务...' && (pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js) && pm2 save && echo '📊 服务状态:' && pm2 list"

if errorlevel 1 (
    echo.
    echo ❌ 部署失败
    echo.
    echo 💡 故障排查：
    echo    1. 检查远程路径是否正确
    echo    2. 确认服务器上已安装 Node.js 和 Git
    echo    3. 验证PM2是否已全局安装
    echo    4. 检查Git仓库权限
    echo.
    pause
    exit /b 1
)

REM ==================== 部署完成 ====================
echo.
echo ========================================
echo 🎉 部署成功！
echo ========================================
echo 📍 访问地址: http://%REMOTE_HOST%:3000
echo.
echo 💡 常用命令:
echo    logs.bat           - 查看服务器日志
echo    status.bat         - 查看服务状态
echo.
echo ⏰ 部署时间: %date% %time%
echo ========================================
echo.
pause
