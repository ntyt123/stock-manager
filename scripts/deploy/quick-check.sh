#!/bin/bash
# ==========================================
# 快速检查脚本（简化版）
# ==========================================
# 只检查最关键的几项，快速定位问题

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}========================================"
echo "  Stock Manager 快速诊断"
echo -e "========================================${NC}\n"

# 1. 检查 PM2 服务状态
echo -e "${YELLOW}1️⃣ PM2 服务状态${NC}"
if command -v pm2 &> /dev/null; then
    pm2 list | grep stock-manager
    if pm2 list | grep -q "stock-manager.*online"; then
        echo -e "${GREEN}✅ 服务运行中${NC}"
    else
        echo -e "${RED}❌ 服务未运行或状态异常${NC}"
        echo -e "${YELLOW}💡 运行: pm2 restart stock-manager${NC}"
    fi
else
    echo -e "${RED}❌ PM2 未安装${NC}"
fi

echo ""

# 2. 检查端口监听
echo -e "${YELLOW}2️⃣ 端口 3000 监听状态${NC}"
if netstat -tuln 2>/dev/null | grep -q ":3000"; then
    LISTEN_INFO=$(netstat -tuln | grep ":3000")
    echo "$LISTEN_INFO"

    if echo "$LISTEN_INFO" | grep -q "0.0.0.0:3000"; then
        echo -e "${GREEN}✅ 正确监听所有接口 (0.0.0.0)${NC}"
    elif echo "$LISTEN_INFO" | grep -q "127.0.0.1:3000"; then
        echo -e "${RED}❌ 仅监听本地 (127.0.0.1)，外部无法访问！${NC}"
        echo -e "${YELLOW}💡 需要更新代码并重启服务${NC}"
    fi
else
    echo -e "${RED}❌ 端口 3000 未监听${NC}"
    echo -e "${YELLOW}💡 服务可能未启动${NC}"
fi

echo ""

# 3. 测试本地访问
echo -e "${YELLOW}3️⃣ 本地访问测试${NC}"
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://localhost:3000 2>/dev/null)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
        echo -e "${GREEN}✅ 本地访问成功 (HTTP $HTTP_CODE)${NC}"
        echo -e "${YELLOW}💡 服务正常，问题可能在防火墙或安全组${NC}"
    else
        echo -e "${RED}❌ 本地访问失败 (HTTP $HTTP_CODE)${NC}"
        echo -e "${YELLOW}💡 查看日志: pm2 logs stock-manager${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  curl 未安装，跳过${NC}"
fi

echo ""

# 4. 检查防火墙
echo -e "${YELLOW}4️⃣ 系统防火墙状态${NC}"
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status 2>/dev/null)

    if echo "$UFW_STATUS" | grep -q "Status: active"; then
        echo -e "${YELLOW}⚠️  UFW 防火墙已启用${NC}"

        if echo "$UFW_STATUS" | grep -q "3000"; then
            echo -e "${GREEN}✅ 端口 3000 已开放${NC}"
        else
            echo -e "${RED}❌ 端口 3000 未开放${NC}"
            echo -e "${YELLOW}💡 运行: sudo ufw allow 3000/tcp${NC}"
        fi
    else
        echo -e "${GREEN}✅ UFW 未启用，不影响访问${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  UFW 未安装${NC}"
fi

echo ""

# 5. 获取服务器 IP
echo -e "${YELLOW}5️⃣ 服务器 IP 地址${NC}"
if command -v hostname &> /dev/null; then
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -n "$LOCAL_IP" ]; then
        echo -e "内网 IP: ${GREEN}$LOCAL_IP${NC}"
    fi
fi

echo ""

# 6. 云安全组提示
echo -e "${YELLOW}6️⃣ ⭐ 重要提示${NC}"
echo -e "${RED}如果以上检查都通过，但仍无法访问，${NC}"
echo -e "${RED}最可能的原因是：云服务商安全组未开放端口！${NC}"
echo ""
echo "请在云控制台检查安全组规则："
echo "  - 阿里云: 实例 → 安全组 → 配置规则"
echo "  - 腾讯云: 实例 → 安全组 → 修改规则"
echo "  - AWS:    Security Groups → Inbound Rules"
echo ""
echo "添加入站规则："
echo "  协议: TCP"
echo "  端口: 3000"
echo "  源: 0.0.0.0/0"

echo ""
echo -e "${YELLOW}========================================"
echo "  检查完成"
echo -e "========================================${NC}"
echo ""
echo "💡 快速修复命令："
echo "  pm2 restart stock-manager    # 重启服务"
echo "  pm2 logs stock-manager        # 查看日志"
echo "  sudo ufw allow 3000/tcp       # 开放防火墙"
echo ""
