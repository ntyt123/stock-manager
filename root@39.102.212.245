#!/bin/bash
# ==========================================
# 服务器访问问题诊断脚本
# ==========================================
# 用途：系统化排查服务无法访问的问题

set +e  # 允许命令失败继续执行

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${YELLOW}📋 $1${NC}"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" &> /dev/null
}

print_header "Stock Manager 服务诊断"

# ==================== 1. 检查服务状态 ====================
print_header "1️⃣ 检查 PM2 服务状态"

if command_exists pm2; then
    print_info "PM2 已安装，版本: $(pm2 -v)"
    echo ""
    pm2 status
    echo ""

    # 检查 stock-manager 进程
    if pm2 status | grep -q "stock-manager"; then
        STATUS=$(pm2 jlist | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

        if [ "$STATUS" = "online" ]; then
            print_success "stock-manager 进程运行中"
        else
            print_error "stock-manager 进程状态异常: $STATUS"
            print_info "尝试重启: pm2 restart stock-manager"
        fi
    else
        print_error "未找到 stock-manager 进程"
        print_info "请运行: pm2 start ecosystem.config.js"
    fi
else
    print_error "PM2 未安装"
    print_info "请运行: sudo npm install -g pm2"
fi

# ==================== 2. 检查端口监听 ====================
print_header "2️⃣ 检查端口 3000 监听状态"

if command_exists netstat; then
    LISTEN=$(netstat -tuln | grep ":3000")
    if [ -n "$LISTEN" ]; then
        print_success "端口 3000 正在监听"
        echo "$LISTEN"

        # 检查监听地址
        if echo "$LISTEN" | grep -q "0.0.0.0:3000"; then
            print_success "监听所有网络接口 (0.0.0.0) - 正确"
        elif echo "$LISTEN" | grep -q "127.0.0.1:3000"; then
            print_error "仅监听本地回环 (127.0.0.1) - 外部无法访问！"
            print_info "需要修改 server.js，使用 0.0.0.0 监听"
        fi
    else
        print_error "端口 3000 未监听"
        print_info "服务可能未启动或启动失败"
    fi
elif command_exists ss; then
    LISTEN=$(ss -tuln | grep ":3000")
    if [ -n "$LISTEN" ]; then
        print_success "端口 3000 正在监听"
        echo "$LISTEN"
    else
        print_error "端口 3000 未监听"
    fi
else
    print_warning "netstat 和 ss 命令均未找到，跳过端口检查"
fi

# ==================== 3. 测试本地访问 ====================
print_header "3️⃣ 测试本地访问 (localhost:3000)"

if command_exists curl; then
    echo "正在请求 http://localhost:3000 ..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost:3000)

    if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "302" ]; then
        print_success "本地访问成功 (HTTP $RESPONSE)"
        print_info "服务本身运行正常，问题可能在防火墙或网络配置"
    else
        print_error "本地访问失败 (HTTP $RESPONSE)"
        print_info "服务可能未正常启动，请查看日志"
    fi
else
    print_warning "curl 未安装，跳过本地访问测试"
fi

# ==================== 4. 检查防火墙状态 ====================
print_header "4️⃣ 检查防火墙状态"

# 检查 UFW
if command_exists ufw; then
    print_info "检测到 UFW 防火墙"
    UFW_STATUS=$(sudo ufw status 2>/dev/null)

    if echo "$UFW_STATUS" | grep -q "Status: active"; then
        print_warning "UFW 防火墙已启用"

        if echo "$UFW_STATUS" | grep -q "3000"; then
            print_success "端口 3000 已在 UFW 中开放"
            echo "$UFW_STATUS" | grep "3000"
        else
            print_error "端口 3000 未在 UFW 中开放！"
            print_info "运行此命令开放端口: sudo ufw allow 3000/tcp"
        fi
    else
        print_info "UFW 防火墙未启用"
    fi

    echo ""
    echo "完整 UFW 状态："
    sudo ufw status numbered 2>/dev/null || echo "无法获取 UFW 状态"
fi

# 检查 iptables
if command_exists iptables; then
    print_info "检查 iptables 规则..."
    IPTABLES_RULES=$(sudo iptables -L -n 2>/dev/null | grep -i "3000\|INPUT")
    if [ -n "$IPTABLES_RULES" ]; then
        echo "$IPTABLES_RULES"
    else
        print_info "iptables 中未发现特定规则"
    fi
fi

# ==================== 5. 检查网络接口 ====================
print_header "5️⃣ 检查网络接口和 IP 地址"

print_info "服务器网络接口："
if command_exists ip; then
    ip addr show | grep -E "inet " | grep -v "127.0.0.1"
else
    ifconfig | grep -E "inet " | grep -v "127.0.0.1"
fi

echo ""
print_info "外网 IP 地址："
curl -s ifconfig.me || curl -s ipinfo.io/ip || echo "无法获取外网 IP"

# ==================== 6. 检查云服务商安全组 ====================
print_header "6️⃣ 云服务商安全组检查"

print_warning "如果使用云服务器，需要在云控制台检查安全组规则："
echo ""
echo "  阿里云 ECS: 控制台 → 实例 → 安全组 → 配置规则"
echo "  腾讯云 CVM: 控制台 → 实例 → 安全组 → 规则设置"
echo "  AWS EC2:    Console → Security Groups → Inbound Rules"
echo "  华为云 ECS: 控制台 → 安全组 → 入方向规则"
echo ""
print_info "确保添加入站规则："
echo "  协议: TCP"
echo "  端口: 3000"
echo "  源地址: 0.0.0.0/0 (允许所有IP访问)"

# ==================== 7. 查看应用日志 ====================
print_header "7️⃣ 查看应用日志 (最近 30 行)"

if command_exists pm2; then
    echo ""
    echo "=== PM2 错误日志 ==="
    pm2 logs stock-manager --err --lines 30 --nostream 2>/dev/null || echo "无法读取错误日志"

    echo ""
    echo "=== PM2 输出日志 ==="
    pm2 logs stock-manager --out --lines 30 --nostream 2>/dev/null || echo "无法读取输出日志"
else
    print_warning "PM2 未安装，无法查看日志"
fi

# ==================== 8. 环境变量检查 ====================
print_header "8️⃣ 检查环境变量配置"

if [ -f ".env.production" ]; then
    print_success "找到 .env.production 文件"
    echo ""
    echo "配置内容（隐藏敏感信息）："
    grep -v "SECRET\|PASSWORD" .env.production 2>/dev/null || cat .env.production
else
    print_error "未找到 .env.production 文件"
    print_info "请创建配置文件: cp .env.production.example .env.production"
fi

# ==================== 9. 快速修复建议 ====================
print_header "🔧 快速修复建议"

echo "根据上述诊断结果，尝试以下步骤："
echo ""
echo "1️⃣ 如果服务未运行："
echo "   cd ~/stock-manager"
echo "   pm2 restart stock-manager"
echo "   # 或重新启动"
echo "   pm2 delete stock-manager && pm2 start ecosystem.config.js"
echo ""
echo "2️⃣ 如果端口未开放："
echo "   sudo ufw allow 3000/tcp"
echo "   sudo ufw reload"
echo ""
echo "3️⃣ 如果监听地址错误："
echo "   # 检查 server.js 中的 app.listen 配置"
echo "   # 应该是 app.listen(PORT, '0.0.0.0', ...)"
echo ""
echo "4️⃣ 查看详细日志："
echo "   pm2 logs stock-manager"
echo "   pm2 monit  # 实时监控"
echo ""
echo "5️⃣ 测试本地访问："
echo "   curl http://localhost:3000"
echo ""
echo "6️⃣ 在本地测试远程访问："
echo "   curl http://$(curl -s ifconfig.me):3000"
echo ""

print_header "✅ 诊断完成"

echo "如果问题仍未解决，请将以上诊断信息提供给技术支持。"
echo ""
