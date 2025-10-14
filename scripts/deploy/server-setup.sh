#!/bin/bash
# ==========================================
# Stock Manager 服务器环境初始化脚本
# ==========================================
# 功能：在Ubuntu服务器上自动安装和配置运行环境
# 使用：
#   1. 上传此脚本到服务器
#   2. chmod +x server-setup.sh
#   3. ./server-setup.sh
# ==========================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_header() {
    echo -e "\n${BLUE}=========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}=========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}📋 $1${NC}"
}

# ⚠️  警告：root用户检测已禁用
# 注意：使用root用户运行此脚本可能导致：
# - 文件权限问题（项目文件将归root所有）
# - PM2配置位置错误（保存在/root/.pm2而非用户目录）
# - 部署和维护困难（需要root权限访问文件）
# 建议：尽可能使用普通用户运行此脚本
#
# check_root() {
#     if [ "$EUID" -eq 0 ]; then
#         print_error "请不要使用root用户运行此脚本"
#         print_info "建议使用普通用户运行，脚本会在需要时提示输入sudo密码"
#         exit 1
#     fi
# }

# 主程序开始
print_header "Stock Manager 服务器环境初始化"

# check_root  # 已禁用root用户检测

# 询问配置
print_info "请提供以下配置信息："
echo ""

read -p "Git仓库地址 (例: https://github.com/user/stock-manager.git): " GIT_REPO
read -p "项目安装路径 [默认: $HOME/stock-manager]: " PROJECT_DIR
PROJECT_DIR=${PROJECT_DIR:-"$HOME/stock-manager"}

read -p "生产环境JWT密钥 [留空自动生成]: " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    print_info "已自动生成JWT密钥"
fi

echo ""
print_info "配置确认："
echo "  Git仓库: $GIT_REPO"
echo "  安装路径: $PROJECT_DIR"
echo "  JWT密钥: ${JWT_SECRET:0:10}..."
echo ""

read -p "确认开始安装? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    print_error "安装已取消"
    exit 0
fi

# ==================== 步骤1: 更新系统 ====================
print_header "步骤 1/8: 更新系统包"
sudo apt update && sudo apt upgrade -y
print_success "系统更新完成"

# ==================== 步骤2: 安装基础工具 ====================
print_header "步骤 2/8: 安装基础工具"
sudo apt install -y curl wget git build-essential python3 python3-pip
print_success "基础工具安装完成"

# ==================== 步骤3: 安装Node.js ====================
print_header "步骤 3/8: 安装Node.js 18.x"

# 检查是否已安装
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_info "检测到已安装Node.js版本: $NODE_VERSION"
    read -p "是否重新安装? (y/n): " REINSTALL
    if [ "$REINSTALL" != "y" ]; then
        print_info "跳过Node.js安装"
    else
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

print_success "Node.js版本: $(node -v)"
print_success "npm版本: $(npm -v)"

# ==================== 步骤4: 安装PM2 ====================
print_header "步骤 4/8: 安装PM2进程管理器"

if command -v pm2 &> /dev/null; then
    print_info "PM2已安装: $(pm2 -v)"
else
    sudo npm install -g pm2
    print_success "PM2安装完成"
fi

# ==================== 步骤5: 克隆项目 ====================
print_header "步骤 5/8: 克隆项目代码"

if [ -d "$PROJECT_DIR" ]; then
    print_info "目录已存在: $PROJECT_DIR"
    read -p "是否删除并重新克隆? (y/n): " RECLONE
    if [ "$RECLONE" = "y" ]; then
        rm -rf "$PROJECT_DIR"
        git clone "$GIT_REPO" "$PROJECT_DIR"
        print_success "代码克隆完成"
    else
        print_info "使用现有目录"
    fi
else
    git clone "$GIT_REPO" "$PROJECT_DIR"
    print_success "代码克隆完成"
fi

cd "$PROJECT_DIR"

# ==================== 步骤6: 安装依赖 ====================
print_header "步骤 6/8: 安装项目依赖"
npm install --production
print_success "依赖安装完成"

# ==================== 步骤7: 配置生产环境 ====================
print_header "步骤 7/8: 配置生产环境"

# 创建.env.production文件
cat > .env.production << EOF
# ==========================================
# 生产环境配置
# ==========================================
# 自动生成于: $(date)

NODE_ENV=production
PORT=3000
JWT_SECRET=$JWT_SECRET
DB_PATH=./stock_manager.db
LOG_LEVEL=info
CORS_ORIGIN=*
EOF

print_success ".env.production 创建完成"

# 创建日志目录
mkdir -p logs
print_success "日志目录创建完成"

# 创建备份目录
mkdir -p backups
print_success "备份目录创建完成"

# ==================== 步骤8: 启动服务 ====================
print_header "步骤 8/8: 启动服务"

# 停止可能存在的旧进程
pm2 delete stock-manager 2>/dev/null || true

# 启动新服务
pm2 start ecosystem.config.js
pm2 save
pm2 startup

print_success "服务启动完成"

# ==================== 配置防火墙（可选） ====================
print_header "配置防火墙（可选）"

if command -v ufw &> /dev/null; then
    print_info "检测到UFW防火墙"
    read -p "是否开放3000端口? (y/n): " OPEN_PORT
    if [ "$OPEN_PORT" = "y" ]; then
        sudo ufw allow 3000/tcp
        print_success "端口3000已开放"
    fi
else
    print_info "未检测到UFW防火墙，请手动配置防火墙规则"
fi

# ==================== 安装完成 ====================
print_header "安装完成！"

# 获取服务器IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo -e "${GREEN}"
echo "========================================="
echo "  🎉 安装成功！"
echo "========================================="
echo ""
echo "📍 访问地址: http://$SERVER_IP:3000"
echo "📁 项目路径: $PROJECT_DIR"
echo "💾 数据库: $PROJECT_DIR/stock_manager.db"
echo "📋 日志目录: $PROJECT_DIR/logs"
echo ""
echo "常用命令："
echo "  pm2 status        - 查看服务状态"
echo "  pm2 logs          - 查看日志"
echo "  pm2 restart all   - 重启服务"
echo "  pm2 monit         - 实时监控"
echo "  pm2 stop all      - 停止服务"
echo ""
echo "部署命令："
echo "  cd $PROJECT_DIR"
echo "  git pull origin master"
echo "  npm install --production"
echo "  pm2 reload ecosystem.config.js"
echo ""
echo "========================================="
echo -e "${NC}"

# 显示服务状态
echo ""
pm2 status

print_info "安装脚本执行完毕"
