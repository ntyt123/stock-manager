# Stock Manager 部署指南

> 📖 完整的开发/生产环境部署方案
>
> 📅 最后更新: 2025-10-14

---

## 📋 目录

- [项目结构](#项目结构)
- [架构概述](#架构概述)
- [前置要求](#前置要求)
- [首次部署](#首次部署)
- [日常部署](#日常部署)
- [常见问题](#常见问题)
- [维护指南](#维护指南)

---

## 📁 项目结构

**重要说明：** 项目已重新整理，所有部署相关文件位于 `scripts/deploy/` 目录。

### 快速导航

```
stock-manager/
├── scripts/
│   └── deploy/              # 🎯 所有部署脚本都在这里
│       ├── deploy.js        # Node.js部署脚本
│       ├── deploy.bat       # Windows批处理脚本
│       ├── logs.bat         # 日志查看脚本
│       ├── status.bat       # 状态查看脚本
│       └── server-setup.sh  # 服务器初始化脚本
├── docs/
│   └── guides/              # 📚 本文档位置
│       ├── DEPLOYMENT_GUIDE.md        # (当前文档)
│       ├── EBROKER_SYNC_GUIDE.md      # 券商同步指南
│       └── GUANGDA_API_GUIDE.md       # 光大API指南
├── .env.development         # 开发环境配置
├── .env.production.example  # 生产环境配置模板
└── ecosystem.config.js      # PM2配置
```

### 使用NPM命令（推荐）

**无需记住文件路径**，直接使用npm命令：

```bash
npm run deploy       # 等同于: node scripts/deploy/deploy.js
npm run deploy:bat   # 等同于: scripts/deploy/deploy.bat
npm run logs         # 等同于: scripts/deploy/logs.bat
npm run status       # 等同于: scripts/deploy/status.bat
```

**📖 完整项目结构说明：** 查看根目录的 [PROJECT_STRUCTURE.md](../../PROJECT_STRUCTURE.md)

---

## 🏗️ 架构概述

### 环境分离

```
┌─────────────────────────────────────────────────────────────┐
│                       本地开发环境                            │
│  ✅ nodemon 热重载                                           │
│  ✅ 独立开发数据库 (stock_manager_dev.db)                    │
│  ✅ 端口: 3000                                               │
│  ✅ 环境变量: .env.development                               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ npm run deploy (一键部署)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              远程Ubuntu服务器 (生产环境)                      │
│  ✅ PM2 进程守护                                             │
│  ✅ 生产数据库 (stock_manager.db)                           │
│  ✅ 端口: 3000 (IP:3000访问)                                │
│  ✅ 环境变量: .env.production                               │
│  ✅ 自动重启、日志管理、进程监控                             │
└─────────────────────────────────────────────────────────────┘
```

### 部署流程

```
本地开发 → Git提交 → Git推送 → 执行部署脚本
→ SSH连接服务器 → 拉取代码 → 安装依赖 → PM2重启
```

---

## 🔧 前置要求

### 本地环境 (Windows)

- ✅ Node.js 16.x 或更高版本
- ✅ Git 已安装并配置
- ✅ SSH客户端 (Windows 10/11自带)
- ✅ 配置SSH密钥认证（推荐）

### 远程服务器 (Ubuntu)

- ✅ Ubuntu 18.04 或更高版本
- ✅ Node.js 18.x 或更高版本
- ✅ PM2 全局安装
- ✅ Git 已安装
- ✅ SSH访问权限

---

## 🚀 首次部署

### 步骤1: 准备远程服务器

#### 方式A: 使用自动化脚本（推荐）

1. **上传初始化脚本到服务器**

```bash
# 在本地执行（将脚本上传到服务器）
scp scripts/deploy/server-setup.sh user@your-server-ip:~/
```

2. **SSH登录服务器并运行脚本**

```bash
ssh user@your-server-ip
chmod +x server-setup.sh
./server-setup.sh
```

脚本会自动完成：
- 安装Node.js、PM2、Git
- 克隆项目代码
- 安装项目依赖
- 创建生产环境配置
- 启动PM2服务

#### 方式B: 手动配置

如果自动化脚本失败，可以手动执行以下步骤：

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. 安装PM2
sudo npm install -g pm2

# 4. 克隆项目
cd ~
git clone https://github.com/your-username/stock-manager.git
cd stock-manager

# 5. 安装依赖
npm install --production

# 6. 创建生产环境配置
cp .env.production.example .env.production
nano .env.production  # 编辑配置文件

# 7. 创建目录
mkdir -p logs backups

# 8. 启动服务
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 步骤2: 配置本地部署脚本

编辑 `scripts/deploy/deploy.bat` 文件，修改配置区域：

```batch
set REMOTE_HOST=192.168.1.100        # 替换为你的服务器IP
set REMOTE_USER=ubuntu                # 替换为SSH用户名
set REMOTE_PORT=22                    # SSH端口
set REMOTE_PATH=/home/ubuntu/stock-manager  # 服务器项目路径
set BRANCH=master                     # Git分支
```

同样修改 `scripts/deploy/logs.bat` 和 `scripts/deploy/status.bat` 中的配置。

**💡 提示：** 部署脚本已整理到 `scripts/deploy/` 目录，但通过npm命令调用时无需关心具体路径。

### 步骤3: 配置SSH密钥认证（推荐）

**为什么需要？**
- 避免每次部署都输入密码
- 提高安全性
- 支持自动化部署

**配置步骤：**

```bash
# 1. 本地生成SSH密钥（如果还没有）
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 2. 复制公钥到服务器
ssh-copy-id user@your-server-ip

# 3. 测试免密登录
ssh user@your-server-ip
```

### 步骤4: 首次部署

```bash
# 方式1: 使用Node.js脚本（交互式）
npm run deploy

# 方式2: 使用批处理脚本（简单快速）
npm run deploy:bat
# 或直接双击 deploy.bat
```

---

## 🔄 日常部署

### 标准开发流程

```bash
# 1. 本地开发
npm run dev

# 2. 测试功能
# ... 在浏览器中测试 ...

# 3. 提交代码
git add .
git commit -m "feat: 添加新功能"

# 4. 一键部署到生产
npm run deploy:bat
```

### 快速部署命令

```bash
# 完整部署流程（推荐）
npm run deploy:bat

# 使用Node.js脚本（带交互式配置）
npm run deploy

# 重新配置部署参数
node scripts/deploy/deploy.js --config
```

---

## 📊 管理和监控

### 查看服务状态

```bash
# 本地查看远程服务器状态
npm run status

# 或使用SSH直接查看
ssh user@server-ip "pm2 status"
```

### 查看日志

```bash
# 本地查看远程日志（交互式菜单）
npm run logs

# 或直接通过SSH
ssh user@server-ip "pm2 logs stock-manager"
```

### PM2 常用命令

在服务器上执行：

```bash
# 查看服务状态
pm2 status

# 查看实时日志
pm2 logs stock-manager

# 重启服务
pm2 restart stock-manager

# 停止服务
pm2 stop stock-manager

# 零停机重启
pm2 reload stock-manager

# 查看详细信息
pm2 info stock-manager

# 实时监控
pm2 monit

# 删除服务
pm2 delete stock-manager
```

---

## 🗂️ 文件说明

### 配置文件

| 文件 | 说明 | 是否提交到Git |
|------|------|---------------|
| `.env.development` | 本地开发环境配置 | ❌ 否 |
| `.env.production` | 生产环境配置（实际使用） | ❌ 否 |
| `.env.production.example` | 生产环境配置模板 | ✅ 是 |
| `ecosystem.config.js` | PM2进程管理配置 | ✅ 是 |
| `.deploy-config.json` | 部署脚本配置缓存 | ❌ 否 |

### 脚本文件

所有部署相关脚本位于 `scripts/deploy/` 目录：

| 文件 | 路径 | 说明 | 用途 |
|------|------|------|------|
| `deploy.js` | `scripts/deploy/` | Node.js部署脚本 | 交互式部署 |
| `deploy.bat` | `scripts/deploy/` | Windows批处理脚本 | 快速部署 |
| `logs.bat` | `scripts/deploy/` | 日志查看脚本 | 查看远程日志 |
| `status.bat` | `scripts/deploy/` | 状态查看脚本 | 查看服务状态 |
| `server-setup.sh` | `scripts/deploy/` | 服务器初始化脚本 | 首次环境搭建 |

**💡 使用提示：** 通过npm命令调用这些脚本时，无需记住具体路径：
- `npm run deploy` 或 `npm run deploy:bat` - 部署
- `npm run logs` - 查看日志
- `npm run status` - 查看状态

---

## ⚙️ 环境变量说明

### 开发环境 (.env.development)

```env
NODE_ENV=development        # 环境类型
PORT=3000                   # 服务端口
JWT_SECRET=xxx              # JWT密钥（开发用）
DB_PATH=./stock_manager_dev.db  # 开发数据库
LOG_LEVEL=debug             # 日志级别
```

### 生产环境 (.env.production)

```env
NODE_ENV=production         # 环境类型
PORT=3000                   # 服务端口
JWT_SECRET=xxx              # JWT密钥（必须修改为强密钥！）
DB_PATH=./stock_manager.db  # 生产数据库
LOG_LEVEL=info              # 日志级别
CORS_ORIGIN=*               # CORS设置
```

**⚠️ 安全提示：**
- 生产环境的 `JWT_SECRET` 必须使用强随机密钥
- 生成方法: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- 切勿将生产环境配置文件提交到Git

---

## 🐛 常见问题

### 0. 部署后无法访问 IP:3000 ⭐⭐⭐

**问题：** 服务器安装完成，但浏览器访问 `http://服务器IP:3000` 无响应

**这是最最常见的问题！** 90% 的情况是云服务商安全组配置问题。

📖 **完整故障排除指南：** [SERVER_ACCESS_TROUBLESHOOTING.md](./SERVER_ACCESS_TROUBLESHOOTING.md)

**快速诊断：**
```bash
# 在服务器上运行自动诊断脚本
cd ~/stock-manager
./scripts/deploy/diagnose-server.sh
```

**快速检查清单：**
1. ✅ 检查 PM2 服务状态：`pm2 status`
2. ✅ 检查端口监听：`sudo netstat -tuln | grep 3000`
3. ✅ 测试本地访问：`curl http://localhost:3000`
4. 🔥 **检查云服务商安全组**（最重要！）
5. ✅ 检查系统防火墙：`sudo ufw status`

**最常见原因：云服务商安全组未开放 3000 端口**
- 阿里云：控制台 → 安全组 → 配置规则 → 添加入方向规则
- 腾讯云：控制台 → 安全组 → 修改规则 → 添加入站规则
- AWS EC2：Security Groups → Edit inbound rules → Add rule

### 0.1. GitHub 克隆失败

**问题：** `Failed to connect to github.com port 443` 或 `Connection timed out`

**解决方案：**

📖 **详细指南：** [GITHUB_CONNECTION_TROUBLESHOOTING.md](./GITHUB_CONNECTION_TROUBLESHOOTING.md)

**快速解决：**

```bash
# 推荐方案：使用 SSH 协议而非 HTTPS
# 1. 生成 SSH 密钥（如果还没有）
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 2. 查看公钥并添加到 GitHub
cat ~/.ssh/id_rsa.pub
# 访问 https://github.com/settings/keys 添加公钥

# 3. 测试连接
ssh -T git@github.com

# 4. 使用 SSH 地址克隆
git clone git@github.com:ntyt123/stock-manager.git
```

其他解决方案：
- 🔧 配置代理
- 🌏 使用 Gitee 镜像（中国大陆服务器）
- 🔨 修改 hosts 文件
- 📦 手动上传代码

### 1. 部署时SSH连接失败

**问题：** `Connection refused` 或 `Connection timed out`

**解决方案：**
```bash
# 检查SSH服务状态
ssh user@server-ip "sudo systemctl status ssh"

# 检查防火墙
ssh user@server-ip "sudo ufw status"

# 允许SSH端口
ssh user@server-ip "sudo ufw allow 22/tcp"

# 测试连接
ssh -v user@server-ip
```

### 2. PM2服务启动失败

**问题：** 服务无法启动或频繁重启

**解决方案：**
```bash
# 查看详细错误日志
pm2 logs stock-manager --err

# 检查端口占用
netstat -tlnp | grep :3000

# 手动测试启动
NODE_ENV=production node server.js

# 重新初始化PM2
pm2 delete stock-manager
pm2 start ecosystem.config.js
pm2 save
```

### 3. 代码拉取失败

**问题：** `git pull` 失败或权限不足

**解决方案：**
```bash
# 检查Git状态
cd /path/to/project
git status

# 重置本地更改
git reset --hard origin/master

# 配置Git凭据
git config --global credential.helper store

# 使用SSH克隆（推荐）
git remote set-url origin git@github.com:user/repo.git
```

### 4. 依赖安装失败

**问题：** `npm install` 报错

**解决方案：**
```bash
# 清除npm缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules package-lock.json
npm install --production

# 检查Node版本
node -v  # 应该是 v16.x 或更高

# 如果是Python相关错误（better-sqlite3）
sudo apt install -y python3 build-essential
```

### 5. 数据库文件权限问题

**问题：** `EACCES: permission denied`

**解决方案：**
```bash
# 修改数据库文件权限
chmod 644 stock_manager.db

# 确保目录权限正确
chmod 755 /path/to/project

# 检查文件所有者
ls -la stock_manager.db
```

### 6. 端口已被占用

**问题：** `Port 3000 is already in use`

**解决方案：**
```bash
# 查找占用端口的进程
sudo lsof -i :3000
# 或
sudo netstat -tlnp | grep :3000

# 终止进程
sudo kill -9 <PID>

# 或修改端口（在.env.production中）
PORT=3001
```

---

## 🔐 安全建议

### 1. 保护敏感信息

- ✅ 永远不要将 `.env.production` 提交到Git
- ✅ 使用强JWT密钥（至少32字节）
- ✅ 定期更换密钥
- ✅ 限制数据库文件权限

### 2. SSH安全

- ✅ 使用SSH密钥认证，禁用密码登录
- ✅ 修改SSH默认端口（22 → 其他端口）
- ✅ 配置fail2ban防暴力破解
- ✅ 定期更新系统补丁

### 3. 防火墙配置

```bash
# 启用UFW防火墙
sudo ufw enable

# 允许SSH
sudo ufw allow 22/tcp

# 允许应用端口
sudo ufw allow 3000/tcp

# 查看防火墙状态
sudo ufw status
```

### 4. 定期备份

```bash
# 手动备份数据库
cp stock_manager.db backups/stock_manager_$(date +%Y%m%d).db

# 或使用cron自动备份
crontab -e
# 添加：每天凌晨2点备份
0 2 * * * cd /path/to/project && cp stock_manager.db backups/stock_manager_$(date +\%Y\%m\%d).db
```

---

## 📈 性能优化

### 1. PM2集群模式（可选）

如果需要更高性能，可以启用集群模式：

编辑 `ecosystem.config.js`:
```javascript
{
  instances: 'max',  // 使用所有CPU核心
  exec_mode: 'cluster'
}
```

### 2. Nginx反向代理（推荐）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. 启用HTTPS

```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com
```

---

## 📚 进阶主题

### 自动化部署（CI/CD）

使用GitHub Actions实现自动部署：

创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ master ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /path/to/stock-manager
            git pull origin master
            npm install --production
            pm2 reload ecosystem.config.js
```

### 数据库迁移

如果需要在服务器间迁移数据：

```bash
# 导出数据库
scp user@old-server:/path/stock_manager.db ./backup.db

# 导入到新服务器
scp ./backup.db user@new-server:/path/stock_manager.db
```

---

## 🆘 获取帮助

### 相关文档

- [Node.js官方文档](https://nodejs.org/docs/)
- [PM2文档](https://pm2.keymetrics.io/docs/)
- [Express文档](https://expressjs.com/)

### 日志位置

- PM2日志: `~/stock-manager/logs/pm2-*.log`
- PM2系统日志: `~/.pm2/logs/`
- 应用日志: `console.log` 输出到PM2日志

### 常用调试命令

```bash
# 服务器系统信息
uname -a
node -v
npm -v
pm2 -v

# 服务状态
pm2 status
pm2 info stock-manager

# 实时日志
pm2 logs stock-manager --lines 100

# 系统资源
pm2 monit
htop
```

---

## ✅ 部署检查清单

### 首次部署

- [ ] 服务器已安装Node.js、PM2、Git
- [ ] 本地已配置SSH密钥认证
- [ ] 已修改 `scripts/deploy/deploy.bat` 中的服务器配置
- [ ] 已创建.env.production并配置强JWT密钥
- [ ] 已运行 `scripts/deploy/server-setup.sh` 初始化服务器
- [ ] 已测试SSH连接正常
- [ ] 已在服务器上成功克隆代码
- [ ] PM2服务已启动并运行正常
- [ ] 可以通过IP:3000访问系统

### 日常部署

- [ ] 本地代码已提交到Git
- [ ] 已推送到远程仓库
- [ ] 运行 `npm run deploy:bat` 执行部署
- [ ] 部署脚本执行成功无报错
- [ ] 服务器服务已自动重启
- [ ] 访问系统确认新功能正常

---

## 📝 更新日志

### 2025-10-14
- ✅ 更新文档以反映新的目录结构
- ✅ 部署脚本移至 `scripts/deploy/` 目录
- ✅ 项目文档整理到 `docs/` 目录

### 2025-10-13
- ✅ 创建完整的部署系统
- ✅ 添加自动化部署脚本
- ✅ 实现开发/生产环境分离
- ✅ 配置PM2进程管理
- ✅ 编写部署指南文档

---

**📍 需要帮助？**

如遇到问题，请检查：
1. 📋 本文档的"常见问题"章节
2. 📊 使用 `npm run logs` 查看服务器日志
3. 🔍 使用 `npm run status` 查看服务状态

---

**🎉 祝部署顺利！**
