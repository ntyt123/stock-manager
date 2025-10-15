# GitHub 连接问题解决指南

> 📖 解决远程服务器无法连接 GitHub 的问题
>
> 📅 创建日期: 2025-10-14

---

## 🔍 问题描述

在远程服务器上克隆项目时出现以下错误：

```
fatal: unable to access 'https://github.com/ntyt123/stock-manager.git/':
Failed to connect to github.com port 443 after 136171 ms: Couldn't connect to server
```

**原因：** 服务器无法访问 GitHub 的 HTTPS 端口 (443)

---

## ✅ 解决方案（按推荐顺序）

### 方案一：使用 SSH 协议（最推荐）⭐

SSH 协议使用 22 端口，通常比 HTTPS (443端口) 更稳定。

#### 步骤1：检查或生成 SSH 密钥

```bash
# 检查是否已有 SSH 密钥
ls -la ~/.ssh/id_rsa.pub

# 如果没有，生成新密钥
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
# 一路回车使用默认设置

# 查看公钥
cat ~/.ssh/id_rsa.pub
```

#### 步骤2：添加 SSH 公钥到 GitHub

1. 复制上一步显示的公钥内容
2. 访问 GitHub: https://github.com/settings/keys
3. 点击 "New SSH key"
4. 粘贴公钥，保存

#### 步骤3：测试 SSH 连接

```bash
ssh -T git@github.com
# 第一次会询问是否信任，输入 yes
# 成功会显示：Hi username! You've successfully authenticated...
```

#### 步骤4：使用 SSH 地址克隆

在运行 `server-setup.sh` 时，使用 SSH 格式：

```bash
Git仓库地址: git@github.com:ntyt123/stock-manager.git
```

或手动克隆：

```bash
git clone git@github.com:ntyt123/stock-manager.git
```

---

### 方案二：配置 Git 使用代理

如果服务器需要通过代理访问外网：

```bash
# HTTP/HTTPS 代理
git config --global http.proxy http://proxy-server:port
git config --global https.proxy https://proxy-server:port

# SOCKS5 代理
git config --global http.proxy socks5://proxy-server:port
git config --global https.proxy socks5://proxy-server:port

# 查看配置
git config --global --list | grep proxy

# 取消代理（如果不需要）
git config --global --unset http.proxy
git config --global --unset https.proxy
```

---

### 方案三：修改 hosts 文件（针对 DNS 污染）

如果是 DNS 解析问题，可以手动指定 GitHub IP：

```bash
# 编辑 hosts 文件
sudo nano /etc/hosts

# 添加以下内容（IP地址可能需要更新）
140.82.113.4    github.com
140.82.114.9    codeload.github.com
199.232.69.194  github.global.ssl.fastly.net
185.199.108.153 assets-cdn.github.com
185.199.109.153 assets-cdn.github.com
185.199.110.153 assets-cdn.github.com
185.199.111.153 assets-cdn.github.com

# 保存并退出 (Ctrl+O, Enter, Ctrl+X)

# 刷新 DNS 缓存
sudo systemd-resolve --flush-caches

# 测试
ping github.com
```

💡 **获取最新 IP：** 访问 https://www.ipaddress.com/ 查询 github.com

---

### 方案四：使用 Gitee 镜像（国内服务器）

如果是中国大陆服务器，可以使用 Gitee 作为镜像：

#### 步骤1：在 Gitee 创建仓库镜像

1. 访问 https://gitee.com/
2. 点击"从 GitHub/GitLab 导入仓库"
3. 输入 GitHub 仓库地址
4. 创建镜像

#### 步骤2：使用 Gitee 地址克隆

```bash
git clone https://gitee.com/your-username/stock-manager.git
```

#### 步骤3：配置多个远程仓库

```bash
cd stock-manager

# 添加 GitHub 为远程仓库
git remote add github https://github.com/ntyt123/stock-manager.git

# 添加 Gitee 为远程仓库
git remote add gitee https://gitee.com/your-username/stock-manager.git

# 查看远程仓库
git remote -v

# 从 Gitee 拉取（快速）
git pull gitee master

# 推送到 GitHub（当网络好时）
git push github master
```

---

### 方案五：手动上传代码

如果以上方法都不行，可以手动上传：

```bash
# 在本地打包项目（排除 node_modules）
cd F:\Git\stock-manager
tar -czf stock-manager.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.db' \
  --exclude='logs' \
  .

# 使用 SCP 上传到服务器
scp stock-manager.tar.gz user@server-ip:~/

# 在服务器上解压
ssh user@server-ip
cd ~
mkdir -p stock-manager
tar -xzf stock-manager.tar.gz -C stock-manager
cd stock-manager

# 初始化 Git（可选）
git init
git remote add origin git@github.com:ntyt123/stock-manager.git
git fetch
git branch --set-upstream-to=origin/master master

# 安装依赖并启动
npm install --production
pm2 start ecosystem.config.js
```

---

### 方案六：增加超时时间

如果是网络慢导致超时：

```bash
# 增加 Git 超时时间（默认是几分钟）
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999
git config --global http.postBuffer 1048576000

# 然后重试克隆
git clone https://github.com/ntyt123/stock-manager.git
```

---

## 🔍 诊断工具

我已经创建了一个诊断脚本，可以帮助你快速定位问题：

```bash
# 上传诊断脚本到服务器
scp scripts/deploy/check-github-connection.sh user@server-ip:~/

# 在服务器上运行
ssh user@server-ip
chmod +x check-github-connection.sh
./check-github-connection.sh
```

诊断结果会告诉你：
- ✅ 网络是否正常
- ✅ DNS 解析是否正常
- ✅ 端口 443 是否可访问
- ✅ SSH 协议是否可用
- ✅ 当前代理配置

---

## 📋 常见问题

### 1. SSH 方式仍然失败

**错误信息：**
```
Permission denied (publickey)
```

**解决方法：**
- 确认 SSH 公钥已正确添加到 GitHub
- 检查 SSH 密钥权限：`chmod 600 ~/.ssh/id_rsa`
- 测试连接：`ssh -T git@github.com -v`（查看详细日志）

### 2. 防火墙阻止

**检查防火墙：**
```bash
# 检查防火墙状态
sudo ufw status

# 临时禁用防火墙测试（不推荐在生产环境）
sudo ufw disable

# 允许特定端口
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 443/tcp  # HTTPS
```

### 3. 企业网络限制

如果在企业内网，可能需要：
- 使用公司内部的 Git 镜像服务
- 配置企业代理服务器
- 联系网络管理员开放 GitHub 访问权限

---

## 🎯 推荐流程

根据你的情况选择：

1. **个人服务器 / VPS**
   - 首选：**方案一（SSH 协议）** ⭐
   - 备选：方案六（增加超时）

2. **中国大陆服务器**
   - 首选：**方案四（Gitee 镜像）** ⭐
   - 备选：方案三（修改 hosts）

3. **企业内网服务器**
   - 首选：**方案二（配置代理）** ⭐
   - 备选：方案五（手动上传）

4. **临时网络问题**
   - 首选：**方案六（增加超时）** ⭐
   - 备选：等待网络恢复或方案五（手动上传）

---

## 🔧 修改部署脚本

如果确定使用某种方案，可以修改 `deploy.bat` 中的默认行为：

**使用 SSH 协议：**

编辑 `scripts/deploy/deploy.bat`，找到部署命令部分，确保使用 SSH 地址：

```batch
REM 在服务器上拉取代码时，确保使用 SSH
ssh %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH% && git remote set-url origin git@github.com:ntyt123/stock-manager.git && git pull origin %BRANCH%"
```

---

## 📚 相关资源

- [GitHub SSH 配置文档](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [Git 代理配置指南](https://git-scm.com/docs/git-config#Documentation/git-config.txt-httpproxy)
- [Gitee 官方文档](https://gitee.com/help)

---

## ✅ 验证成功

完成配置后，运行以下命令验证：

```bash
# 测试克隆
git clone <你的仓库地址> test-clone
cd test-clone
ls -la

# 成功后删除测试目录
cd ..
rm -rf test-clone
```

---

**🎉 如果问题解决，记得更新部署文档中的仓库地址格式！**
