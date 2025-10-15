# 服务器访问故障排除指南

> 📖 解决远程服务器安装后无法访问 IP:3000 的问题
>
> 📅 创建日期: 2025-10-14

---

## 🔍 问题描述

服务器安装完成后，通过浏览器访问 `http://服务器IP:3000` 无响应或连接超时。

---

## 🎯 快速诊断

我们提供了两个诊断脚本：

### 方式1: 快速检查脚本（推荐，30秒完成）⭐

只检查最关键的6项，快速定位问题，不会卡住：

```bash
# 在服务器上运行
cd ~/stock-manager
chmod +x scripts/deploy/quick-check.sh
./scripts/deploy/quick-check.sh
```

**检查内容：**
- ✅ PM2 服务状态
- ✅ 端口监听情况（是否为 0.0.0.0）
- ✅ 本地访问测试
- ✅ UFW 防火墙状态
- ✅ 服务器 IP 地址
- ✅ 云安全组提示

### 方式2: 完整诊断脚本（详细诊断）

检查所有可能的问题，提供详细报告：

```bash
# 在服务器上运行
cd ~/stock-manager
chmod +x scripts/deploy/diagnose-server.sh
./scripts/deploy/diagnose-server.sh
```

**检查内容：**
- ✅ PM2 服务状态
- ✅ 端口监听情况
- ✅ 本地访问测试
- ✅ 防火墙配置（UFW + iptables）
- ✅ 网络接口状态
- ✅ 外网 IP 地址（现已添加超时，不会卡住）
- ✅ 应用日志
- ✅ 环境变量配置

**注意：** 如果脚本在"外网IP地址"处卡住，说明服务器无法访问外网的IP查询服务。这不影响系统功能，脚本会在5秒后自动跳过。

### 方式3: 手动快速检查

如果脚本无法运行，可以手动执行以下命令：

```bash
# 1. 检查服务状态
pm2 status | grep stock-manager

# 2. 检查端口监听（最重要）
sudo netstat -tuln | grep 3000
# 应该显示: 0.0.0.0:3000 而非 127.0.0.1:3000

# 3. 测试本地访问
curl -I http://localhost:3000
# 应该返回 HTTP/1.1 200 OK

# 4. 检查防火墙
sudo ufw status | grep 3000

# 5. 查看日志
pm2 logs stock-manager --lines 20
```

---

## 🔧 逐步排查（手动方式）

如果无法使用自动诊断脚本，请按以下步骤手动排查：

### 步骤 1: 检查服务是否运行

```bash
# 检查 PM2 状态
pm2 status

# 查看详细信息
pm2 info stock-manager

# 查看实时日志
pm2 logs stock-manager
```

**预期结果：**
- `status` 应该显示为 `online`
- 如果是 `stopped` 或 `errored`，说明服务未正常启动

**如果服务未运行：**
```bash
# 重启服务
pm2 restart stock-manager

# 如果重启失败，查看错误日志
pm2 logs stock-manager --err

# 删除并重新启动
pm2 delete stock-manager
pm2 start ecosystem.config.js
pm2 save
```

---

### 步骤 2: 检查端口监听

```bash
# 方法1: 使用 netstat
sudo netstat -tuln | grep 3000

# 方法2: 使用 ss
sudo ss -tuln | grep 3000

# 方法3: 使用 lsof
sudo lsof -i :3000
```

**预期结果：**
```
tcp   0   0 0.0.0.0:3000   0.0.0.0:*   LISTEN
```

**关键检查点：**
- ✅ `0.0.0.0:3000` - 正确，监听所有网络接口
- ❌ `127.0.0.1:3000` - 错误！只监听本地，外部无法访问

**如果显示 127.0.0.1：**
- 需要修改 `server.js`，确保使用 `app.listen(PORT, '0.0.0.0', ...)`
- 本项目已修复此问题

**如果端口未监听：**
- 服务未成功启动，返回步骤1检查服务状态

---

### 步骤 3: 测试本地访问

在服务器上测试本地访问：

```bash
# 使用 curl 测试
curl http://localhost:3000

# 或查看 HTTP 响应码
curl -I http://localhost:3000
```

**预期结果：**
- 返回 HTML 内容或 HTTP 200 状态码

**如果本地访问成功：**
- ✅ 说明服务本身正常
- ❌ 问题在于防火墙或网络配置（继续步骤4）

**如果本地访问失败：**
- ❌ 服务本身有问题
- 检查日志：`pm2 logs stock-manager`
- 检查配置：`cat .env.production`

---

### 步骤 4: 检查系统防火墙（UFW）

大多数 Ubuntu 系统使用 UFW 防火墙：

```bash
# 查看防火墙状态
sudo ufw status

# 如果防火墙已启用，检查是否开放 3000 端口
sudo ufw status | grep 3000
```

**如果端口未开放：**
```bash
# 开放 3000 端口
sudo ufw allow 3000/tcp

# 重新加载防火墙
sudo ufw reload

# 验证规则
sudo ufw status numbered
```

**如果防火墙未启用：**
- 防火墙不是问题，继续下一步

---

### 步骤 5: 检查云服务商安全组 ⭐

**这是最常见的问题！** 即使系统防火墙开放了端口，云服务商的安全组也必须配置。

#### 阿里云 ECS

1. 登录 [阿里云控制台](https://ecs.console.aliyun.com/)
2. 找到你的 ECS 实例
3. 点击 "安全组" → "配置规则"
4. 添加入方向规则：
   - 协议类型: TCP
   - 端口范围: 3000/3000
   - 授权对象: 0.0.0.0/0
   - 优先级: 1
   - 描述: Stock Manager

#### 腾讯云 CVM

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/cvm)
2. 找到你的 CVM 实例
3. 点击 "安全组" → "修改规则"
4. 添加入站规则：
   - 类型: 自定义TCP
   - 来源: 0.0.0.0/0
   - 协议端口: TCP:3000

#### AWS EC2

1. 登录 [AWS Console](https://console.aws.amazon.com/ec2/)
2. 选择你的实例
3. Security → Security Groups → Edit inbound rules
4. Add rule:
   - Type: Custom TCP
   - Port range: 3000
   - Source: 0.0.0.0/0 (或 Anywhere-IPv4)

#### 华为云 ECS

1. 登录 [华为云控制台](https://console.huaweicloud.com/ecm/)
2. 找到你的 ECS 实例
3. 点击 "安全组" → "配置规则" → "入方向规则"
4. 添加规则：
   - 协议: TCP
   - 端口: 3000
   - 源地址: 0.0.0.0/0

---

### 步骤 6: 检查 iptables 规则

有些系统可能使用 iptables：

```bash
# 查看 iptables 规则
sudo iptables -L -n -v

# 查看 INPUT 链
sudo iptables -L INPUT -n -v

# 如果需要添加规则
sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT

# 保存规则（Ubuntu/Debian）
sudo netfilter-persistent save
```

---

### 步骤 7: 检查网络连接

从本地电脑测试到服务器的连接：

```bash
# 测试端口是否可达（在本地电脑运行）
telnet 服务器IP 3000

# 或使用 nc (netcat)
nc -zv 服务器IP 3000

# 或使用 curl
curl http://服务器IP:3000
```

**预期结果：**
- `Connected to 服务器IP` - 连接成功
- `Connection timed out` - 防火墙/安全组问题
- `Connection refused` - 服务未监听该端口

---

### 步骤 8: 检查环境变量配置

```bash
# 查看生产环境配置
cd ~/stock-manager
cat .env.production

# 验证端口配置
grep PORT .env.production
```

**确认配置：**
```env
NODE_ENV=production
PORT=3000
```

---

### 步骤 9: 查看应用日志

```bash
# 查看 PM2 日志
pm2 logs stock-manager

# 只看错误日志
pm2 logs stock-manager --err --lines 50

# 实时监控
pm2 monit

# 查看 PM2 日志文件
cat ~/.pm2/logs/stock-manager-error.log
cat ~/.pm2/logs/stock-manager-out.log
```

**常见错误：**

1. **端口已被占用：**
   ```
   Error: listen EADDRINUSE: address already in use :::3000
   ```
   解决：
   ```bash
   # 找到占用端口的进程
   sudo lsof -i :3000
   # 终止进程
   sudo kill -9 <PID>
   ```

2. **数据库权限错误：**
   ```
   Error: SQLITE_CANTOPEN: unable to open database file
   ```
   解决：
   ```bash
   # 检查数据库文件权限
   ls -la stock_manager.db
   # 修改权限
   chmod 644 stock_manager.db
   ```

3. **模块未找到：**
   ```
   Error: Cannot find module 'xxx'
   ```
   解决：
   ```bash
   npm install --production
   pm2 restart stock-manager
   ```

---

## 📋 常见问题和解决方案

### Q1: 服务状态显示 online 但无法访问

**原因：** 通常是防火墙或安全组配置问题

**解决：**
1. ✅ 检查云服务商安全组（最常见）
2. ✅ 检查系统防火墙 UFW
3. ✅ 确认服务监听 0.0.0.0 而非 127.0.0.1
4. ✅ 在服务器上测试：`curl http://localhost:3000`

---

### Q2: 提示 "Connection refused"

**原因：** 服务未在该端口监听

**解决：**
```bash
# 1. 检查服务是否运行
pm2 status

# 2. 检查端口监听
sudo netstat -tuln | grep 3000

# 3. 重启服务
pm2 restart stock-manager

# 4. 查看启动日志
pm2 logs stock-manager --lines 100
```

---

### Q3: 提示 "Connection timed out"

**原因：** 防火墙阻止了连接

**解决（按优先级）：**
1. 🔥 **云服务商安全组**（90%的问题都在这里！）
2. 🔥 系统防火墙 UFW
3. 🔥 iptables 规则
4. 🔥 网络连接问题

---

### Q4: 使用 HTTPS 访问失败

**原因：** 服务运行在 HTTP 而非 HTTPS

**解决：**
- 使用 `http://服务器IP:3000` 而非 `https://`
- 如需 HTTPS，需配置 Nginx 反向代理和 SSL 证书

---

### Q5: 只能在本地访问，外部无法访问

**原因：** 服务只监听 127.0.0.1

**解决：**
```bash
# 检查监听地址
sudo netstat -tuln | grep 3000

# 如果显示 127.0.0.1:3000，需修改代码
# 本项目已修复，确保使用最新版本
cd ~/stock-manager
git pull origin master
pm2 restart stock-manager
```

---

## 🛠️ 快速修复命令集合

```bash
# ========== 服务管理 ==========
pm2 restart stock-manager       # 重启服务
pm2 logs stock-manager          # 查看日志
pm2 monit                       # 实时监控
pm2 delete stock-manager        # 删除进程
pm2 start ecosystem.config.js   # 重新启动

# ========== 端口检查 ==========
sudo netstat -tuln | grep 3000  # 检查端口监听
sudo lsof -i :3000              # 查看端口占用
curl http://localhost:3000      # 本地测试

# ========== 防火墙管理 ==========
sudo ufw status                 # 查看防火墙状态
sudo ufw allow 3000/tcp         # 开放端口
sudo ufw reload                 # 重新加载规则
sudo ufw status numbered        # 查看规则编号

# ========== 进程管理 ==========
ps aux | grep node              # 查看 Node 进程
sudo kill -9 <PID>              # 强制终止进程

# ========== 日志查看 ==========
pm2 logs --lines 100            # 查看所有日志
pm2 logs stock-manager --err    # 只看错误日志
tail -f ~/.pm2/logs/stock-manager-out.log  # 实时输出日志

# ========== 网络测试 ==========
curl -I http://localhost:3000   # 查看 HTTP 头
ping 服务器IP                   # 测试网络连通性
telnet 服务器IP 3000            # 测试端口连通性
```

---

## ✅ 完整验证流程

完成修复后，按此流程验证：

```bash
# 1. 在服务器上检查服务状态
ssh user@server-ip
pm2 status
# 确认 stock-manager 状态为 online

# 2. 检查端口监听
sudo netstat -tuln | grep 3000
# 确认显示 0.0.0.0:3000

# 3. 测试本地访问
curl http://localhost:3000
# 应该返回 HTML 内容

# 4. 在本地电脑测试远程访问
curl http://服务器IP:3000
# 应该返回相同的 HTML 内容

# 5. 在浏览器测试
# 访问: http://服务器IP:3000
# 应该看到系统首页
```

---

## 📊 问题优先级排查顺序

根据经验，按此顺序排查效率最高：

1. 🔥 **云服务商安全组** ← 90% 的问题在这里！
2. 🔥 **PM2 服务状态** ← 检查是否正常运行
3. 🔥 **系统防火墙 UFW** ← 检查端口是否开放
4. 🔧 **端口监听地址** ← 确认监听 0.0.0.0
5. 🔧 **应用日志** ← 查看启动错误
6. 🔧 **环境配置** ← 检查 .env.production
7. 🔧 **网络连接** ← 测试服务器可达性
8. 🔧 **iptables 规则** ← 高级防火墙配置

---

## 📞 仍需帮助？

如果按照以上步骤仍无法解决：

1. **运行完整诊断：**
   ```bash
   cd ~/stock-manager
   ./scripts/deploy/diagnose-server.sh > diagnosis.log 2>&1
   ```

2. **收集以下信息：**
   - 诊断日志内容
   - `pm2 logs stock-manager` 输出
   - 云服务商类型（阿里云/腾讯云/AWS等）
   - Ubuntu 版本：`cat /etc/os-release`

3. **检查文档：**
   - [部署指南](./DEPLOYMENT_GUIDE.md)
   - [项目结构](../../PROJECT_STRUCTURE.md)

---

## 🎯 预防性检查清单

部署新服务器时，请确认以下项目：

- [ ] PM2 服务已启动且状态为 online
- [ ] 端口 3000 正在监听（`netstat -tuln | grep 3000`）
- [ ] 监听地址为 0.0.0.0 而非 127.0.0.1
- [ ] 本地访问测试成功（`curl localhost:3000`）
- [ ] UFW 防火墙已开放 3000 端口
- [ ] 云服务商安全组已配置入站规则
- [ ] .env.production 文件配置正确
- [ ] 服务器公网 IP 正确且可访问
- [ ] 从本地电脑可以 ping 通服务器
- [ ] 浏览器可以访问 http://服务器IP:3000

---

**✅ 祝你部署顺利！**

如有其他问题，请参考 [部署指南](./DEPLOYMENT_GUIDE.md) 或查看项目文档。
