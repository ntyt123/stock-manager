#!/bin/bash
# ==========================================
# 远程服务器登录问题修复脚本
# ==========================================
# 用途：修复远程服务器上的登录500错误

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================"
echo "  登录问题修复脚本"
echo -e "========================================${NC}\n"

# 1. 检查数据库文件
echo -e "${YELLOW}1️⃣ 检查数据库文件${NC}"
if [ -f "stock_manager.db" ]; then
    echo -e "${GREEN}✅ 找到数据库文件${NC}"
    ls -lh stock_manager.db
else
    echo -e "${RED}❌ 数据库文件不存在${NC}"
    echo -e "${YELLOW}正在初始化数据库...${NC}"
    NODE_ENV=production node -e "require('./database').initDatabase().then(() => console.log('✅ 数据库初始化完成')).catch(e => console.error('❌ 初始化失败:', e))"
fi

echo ""

# 2. 检查PM2日志中的错误
echo -e "${YELLOW}2️⃣ 检查PM2错误日志${NC}"
if command -v pm2 &> /dev/null; then
    pm2 logs stock-manager --err --lines 10 --nostream 2>/dev/null | tail -20
else
    echo -e "${YELLOW}⚠️  PM2 未安装${NC}"
fi

echo ""

# 3. 重置管理员密码
echo -e "${YELLOW}3️⃣ 重置管理员密码${NC}"
echo -e "${YELLOW}正在将 admin 账号的密码重置为 'admin'...${NC}"

# 使用 Node.js 重置密码
node scripts/tools/reset-admin-password.js reset admin admin 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 密码重置成功${NC}"
else
    echo -e "${RED}❌ 密码重置失败${NC}"
    echo -e "${YELLOW}请检查错误信息${NC}"
fi

echo ""

# 4. 重启服务
echo -e "${YELLOW}4️⃣ 重启服务${NC}"
if command -v pm2 &> /dev/null; then
    pm2 restart stock-manager
    echo -e "${GREEN}✅ 服务已重启${NC}"
else
    echo -e "${YELLOW}⚠️  请手动重启服务${NC}"
fi

echo ""

# 5. 测试登录
echo -e "${YELLOW}5️⃣ 测试登录接口${NC}"
if command -v curl &> /dev/null; then
    echo "正在测试登录..."
    RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"account":"admin","password":"admin"}' \
        -w "\nHTTP_CODE:%{http_code}")

    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ 登录测试成功 (HTTP $HTTP_CODE)${NC}"
        echo "$RESPONSE" | grep -v "HTTP_CODE:" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE" | grep -v "HTTP_CODE:"
    else
        echo -e "${RED}❌ 登录测试失败 (HTTP $HTTP_CODE)${NC}"
        echo "$RESPONSE" | grep -v "HTTP_CODE:"
    fi
else
    echo -e "${YELLOW}⚠️  curl 未安装，跳过登录测试${NC}"
fi

echo ""
echo -e "${BLUE}========================================"
echo "  修复完成"
echo -e "========================================${NC}"
echo ""
echo -e "${GREEN}📝 登录信息：${NC}"
echo "   账号: admin"
echo "   密码: admin"
echo ""
echo -e "${YELLOW}💡 提示：${NC}"
echo "   - 如果仍无法登录，请查看 PM2 日志: pm2 logs stock-manager"
echo "   - 确保数据库文件权限正确: chmod 644 stock_manager.db"
echo "   - 查看所有用户: npm run list-users"
echo ""
