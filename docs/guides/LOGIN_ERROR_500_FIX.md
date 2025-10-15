# 登录 500 错误修复指南

> 📖 解决登录时出现的 "500 Internal Server Error" 问题
>
> 📅 创建日期: 2025-10-14

---

## 🔍 问题描述

使用 admin/admin 登录时，浏览器控制台显示：

```
POST http://服务器IP:3000/api/auth/login 500 (Internal Server Error)
```

---

## 🎯 问题原因

数据库中的默认管理员密码哈希值不正确，导致密码验证失败，服务器返回 500 错误。

**技术原因：** database.js 中的默认密码哈希是一个占位符，不是真实的 bcrypt 哈希值，导致 bcrypt.compare() 无法正确验证密码。

---

## ✅ 解决方案

### 方案一：使用自动修复脚本（推荐）⭐

**在远程服务器上执行：**

```bash
# 1. SSH 登录到服务器
ssh user@服务器IP

# 2. 进入项目目录
cd ~/stock-manager

# 3. 运行修复脚本
chmod +x scripts/deploy/fix-login-remote.sh
./scripts/deploy/fix-login-remote.sh
```

脚本会自动：
- ✅ 检查数据库文件
- ✅ 查看错误日志
- ✅ 重置管理员密码为 `admin`
- ✅ 重启服务
- ✅ 测试登录

---

### 方案二：使用密码重置工具

```bash
# 在服务器上执行
cd ~/stock-manager

# 重置 admin 账号密码为 admin
node scripts/tools/reset-admin-password.js reset admin admin

# 或使用 npm 命令
npm run reset-password reset admin admin

# 重启服务
pm2 restart stock-manager
```

---

### 方案三：删除数据库重新初始化

**⚠️ 警告：此操作会删除所有数据！**

```bash
# 备份现有数据库（如果有重要数据）
cp stock_manager.db stock_manager.db.backup

# 删除数据库
rm stock_manager.db

# 重启服务（会自动创建新数据库）
pm2 restart stock-manager

# 或者手动初始化
NODE_ENV=production node -e "require('./database').initDatabase()"
```

---

### 方案四：更新代码并重新部署

如果本地代码已修复，重新部署即可：

```bash
# 在本地执行部署
npm run deploy:bat

# 或在服务器上手动更新
ssh user@服务器IP
cd ~/stock-manager
git pull origin master
pm2 restart stock-manager
```

---

## 🔍 验证修复

### 1. 查看 PM2 日志

```bash
pm2 logs stock-manager --lines 20
```

**应该看到：**
```
✅ 成功连接到SQLite数据库
✅ 数据库已存在用户数据
🚀 个人股票信息系统服务器已启动
```

### 2. 测试登录接口

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"admin","password":"admin"}' \
  -w "\nHTTP_CODE:%{http_code}\n"
```

**成功响应（HTTP 200）：**
```json
{
  "success": true,
  "message": "登录成功",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "account": "admin",
    "role": "super_admin"
  }
}
```

### 3. 在浏览器测试

访问：`http://服务器IP:3000`

使用以下凭据登录：
- **账号：** admin
- **密码：** admin

---

## 🛠️ 密码重置工具使用

我们提供了一个完整的密码管理工具：`scripts/tools/reset-admin-password.js`

### 基本用法

```bash
# 1. 重置指定账号密码
node scripts/tools/reset-admin-password.js reset <账号> <新密码>

# 示例：将 admin 密码重置为 admin123
node scripts/tools/reset-admin-password.js reset admin admin123

# 2. 列出所有用户
node scripts/tools/reset-admin-password.js list

# 3. 生成密码哈希（用于手动更新代码）
node scripts/tools/reset-admin-password.js hash <密码>
```

### 使用 npm 命令

```bash
# 重置密码
npm run reset-password reset admin admin

# 列出用户
npm run list-users
```

---

## 📊 错误日志分析

### 查看详细日志

```bash
# PM2 错误日志
pm2 logs stock-manager --err --lines 50

# PM2 输出日志
pm2 logs stock-manager --out --lines 50

# 实时查看日志
pm2 logs stock-manager
```

### 常见错误信息

**1. 密码哈希验证失败**
```
Error: data and hash arguments required
```
**原因：** 数据库中的密码哈希格式不正确

**解决：** 使用密码重置工具重置密码

---

**2. 数据库连接错误**
```
Error: SQLITE_CANTOPEN: unable to open database file
```
**原因：** 数据库文件不存在或权限不足

**解决：**
```bash
# 检查数据库文件
ls -la stock_manager.db

# 修改权限
chmod 644 stock_manager.db

# 如果文件不存在，重启服务自动创建
pm2 restart stock-manager
```

---

**3. 用户不存在**
```
用户 admin 不存在
```
**原因：** 数据库中没有默认用户

**解决：**
```bash
# 删除数据库重新初始化
rm stock_manager.db
pm2 restart stock-manager
```

---

## 🔐 安全建议

### 1. 修改默认密码

首次登录后，立即修改默认密码：

1. 登录系统
2. 进入 "个人中心"
3. 点击 "修改密码"
4. 设置强密码

### 2. 使用强密码

```bash
# 生成强密码（随机32字符）
openssl rand -base64 32

# 使用工具设置强密码
node scripts/tools/reset-admin-password.js reset admin "你的强密码"
```

### 3. 定期更换密码

建议每3个月更换一次管理员密码。

---

## 🔄 完整修复流程

### 新部署的服务器（推荐流程）

```bash
# 1. SSH 登录
ssh user@服务器IP

# 2. 进入项目目录
cd ~/stock-manager

# 3. 检查服务状态
pm2 status

# 4. 查看错误日志
pm2 logs stock-manager --err --lines 20

# 5. 运行自动修复脚本
chmod +x scripts/deploy/fix-login-remote.sh
./scripts/deploy/fix-login-remote.sh

# 6. 验证修复
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"admin","password":"admin"}'

# 7. 在浏览器测试登录
# 访问: http://服务器IP:3000
```

### 已有数据的服务器（谨慎操作）

```bash
# 1. 备份数据库
cp stock_manager.db backups/stock_manager_$(date +%Y%m%d_%H%M%S).db

# 2. 仅重置密码（不影响其他数据）
node scripts/tools/reset-admin-password.js reset admin admin

# 3. 重启服务
pm2 restart stock-manager

# 4. 测试登录
```

---

## 📞 仍需帮助？

如果以上方法都无法解决，请提供以下信息：

```bash
# 收集诊断信息
echo "=== 系统信息 ===" > diagnosis.log
node -v >> diagnosis.log
npm -v >> diagnosis.log
echo "" >> diagnosis.log

echo "=== 数据库文件 ===" >> diagnosis.log
ls -la stock_manager.db >> diagnosis.log
echo "" >> diagnosis.log

echo "=== PM2 状态 ===" >> diagnosis.log
pm2 status >> diagnosis.log
echo "" >> diagnosis.log

echo "=== PM2 错误日志 ===" >> diagnosis.log
pm2 logs stock-manager --err --lines 50 --nostream >> diagnosis.log 2>&1
echo "" >> diagnosis.log

echo "=== 用户列表 ===" >> diagnosis.log
node scripts/tools/reset-admin-password.js list >> diagnosis.log 2>&1

# 查看诊断信息
cat diagnosis.log
```

---

## 📋 快速参考

### 默认登录凭据

```
账号: admin
密码: admin
```

### 常用命令

```bash
# 重置密码
npm run reset-password reset admin admin

# 查看用户
npm run list-users

# 查看日志
pm2 logs stock-manager

# 重启服务
pm2 restart stock-manager

# 运行修复脚本
./scripts/deploy/fix-login-remote.sh
```

---

## ✅ 预防措施

### 首次部署检查清单

- [ ] 确认 database.js 中的密码哈希正确
- [ ] 首次启动后测试登录
- [ ] 登录成功后立即修改默认密码
- [ ] 备份数据库文件
- [ ] 记录管理员密码（安全保存）

---

**🎉 祝你顺利解决登录问题！**

如果还有其他问题，请查看：
- [服务器访问故障排除](./SERVER_ACCESS_TROUBLESHOOTING.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)
