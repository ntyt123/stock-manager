@echo off
chcp 65001 >nul
echo ========================================
echo   个人股票信息系统 - 依赖安装脚本
echo ========================================
echo.

:: 检查Node.js是否已安装
echo 步骤 1/3: 检查Node.js环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到Node.js
    echo 请先安装Node.js 14.0或更高版本
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js版本:
node --version
echo.

:: 检查npm是否可用
echo 步骤 2/3: 检查npm包管理器...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: npm不可用
    pause
    exit /b 1
)

echo ✅ npm版本:
npm --version
echo.

:: 安装项目依赖
echo 步骤 3/3: 开始安装项目依赖...
echo 这可能需要几分钟时间，请耐心等待...
echo.

npm install

if %errorlevel% neq 0 (
    echo.
    echo ⚠️ 部分依赖安装失败，尝试修复...
    echo.

    :: 检查是否是sqlite3编译失败
    npm list sqlite3 >nul 2>&1
    if %errorlevel% neq 0 (
        echo 检测到sqlite3安装失败，这通常是因为缺少C++编译环境
        echo 正在尝试安装预编译版本...
        echo.
        npm install --no-save --force sqlite3

        if %errorlevel% neq 0 (
            echo.
            echo ❌ sqlite3安装仍然失败！
            echo.
            echo 解决方案：
            echo 1. 安装 Windows Build Tools:
            echo    npm install --global windows-build-tools
            echo 2. 或者手动安装 Visual Studio Build Tools
            echo 3. 确保Python版本为3.9-3.11 ^(3.13缺少distutils模块^)
            echo.
            echo 临时方案：可以使用better-sqlite3替代
            echo    npm uninstall sqlite3
            echo    npm install better-sqlite3
            echo.
            pause
            exit /b 1
        )
    )

    echo.
    echo ✅ 依赖修复完成
)

echo.
echo ========================================
echo   ✅ 所有依赖安装完成！
echo ========================================
echo.
echo 已安装的依赖包括：
echo   - express         ^4.18.2  (Web服务框架)
echo   - sqlite3         ^5.1.7   (数据库)
echo   - bcryptjs        ^2.4.3   (密码加密)
echo   - jsonwebtoken    ^9.0.2   (JWT认证)
echo   - cors            ^2.8.5   (跨域支持)
echo   - express-fileupload ^1.5.2 (文件上传)
echo   - xlsx            ^0.18.5  (Excel解析)
echo   - exceljs         ^4.4.0   (Excel处理)
echo   - iconv-lite      ^0.7.0   (编码转换)
echo   - nodemon         ^3.0.1   (开发热重载)
echo.
echo 下一步操作：
echo   启动开发服务器: npm run dev
echo   启动生产服务器: npm start
echo.
pause
