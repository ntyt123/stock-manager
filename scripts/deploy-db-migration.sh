#!/bin/bash

# 远程服务器数据库迁移脚本
# 用于在远程服务器上运行 V2 版本的数据库迁移

echo "🚀 开始远程数据库迁移..."
echo ""

# 远程服务器配置（请根据实际情况修改）
REMOTE_USER="root"
REMOTE_HOST="42.192.40.196"
REMOTE_PATH="/root/stock-manager"

echo "📋 检查远程服务器数据库结构..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && node scripts/check-remote-db.js"

echo ""
read -p "是否继续运行迁移脚本？(y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "📤 正在运行迁移..."
    ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && node database/migrations/010_extend_daily_recap_for_v2.js"

    echo ""
    echo "✅ 迁移完成！再次检查数据库结构..."
    ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && node scripts/check-remote-db.js"

    echo ""
    echo "🔄 重启远程服务..."
    ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && pm2 restart stock-manager"

    echo ""
    echo "✅ 部署完成！"
else
    echo "❌ 取消迁移"
fi
