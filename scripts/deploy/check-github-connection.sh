#!/bin/bash
# ==========================================
# GitHub 连接诊断脚本
# ==========================================

echo "=== GitHub 连接诊断 ==="
echo ""

echo "1️⃣ 测试网络连接..."
ping -c 3 github.com

echo ""
echo "2️⃣ 测试 DNS 解析..."
nslookup github.com

echo ""
echo "3️⃣ 测试端口 443 连接..."
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/github.com/443' && echo "✅ 端口 443 可访问" || echo "❌ 端口 443 不可访问"

echo ""
echo "4️⃣ 测试 SSH 协议 (端口 22)..."
timeout 5 ssh -T git@github.com 2>&1 | head -n 1

echo ""
echo "5️⃣ 当前 Git 配置..."
git config --global --list | grep -E "(http|proxy)" || echo "无代理配置"

echo ""
echo "=== 诊断完成 ==="
