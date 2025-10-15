# Git Push 错误修复指南

> 📖 解决 "fatal: invalid refspec" 错误
>
> 📅 创建日期: 2025-10-15

---

## 🔍 问题描述

在执行 `npm run deploy` 时出现以下错误：

```
🚀 推送代码...
fatal: invalid refspec 'https://github.com/ntyt123/stock-manager.git'
❌ 推送代码 失败: Command failed: git push origin https://github.com/ntyt123/stock-manager.git
```

---

## 🎯 问题原因

部署配置文件 `.deploy-config.json` 中的 `branch` 字段被错误地设置为了**完整的仓库URL**，而不是**分支名**。

**错误配置：**
```json
{
  "branch": "https://github.com/ntyt123/stock-manager.git"  // ❌ 错误
}
```

**正确配置：**
```json
{
  "branch": "master"  // ✅ 正确
}
```

---

## ✅ 解决方案

### 方案一：手动修复配置文件（已修复）

配置文件已经修复，`branch` 字段现在是 `"master"`。直接重新运行部署即可：

```bash
npm run deploy
```

### 方案二：重新配置

如果需要重新配置所有参数：

```bash
npm run deploy -- --config
```

然后在配置向导中：
- **Git分支名** 输入：`master` 或 `main`（只输入分支名，不要输入完整URL）

---

## 📋 正确的配置说明

在配置向导中，各项应该这样填写：

```
服务器IP: 39.102.212.245
SSH用户名: root
SSH端口: 22
远程项目路径: /opt/stock-manager
Git分支名: master           ← 只填分支名！
```

**⚠️ 常见错误：**
- ❌ 不要输入：`https://github.com/ntyt123/stock-manager.git`
- ❌ 不要输入：`git@github.com:ntyt123/stock-manager.git`
- ✅ 正确输入：`master` 或 `main`

---

## 🔧 配置文件位置

部署配置保存在：
```
scripts/deploy/.deploy-config.json
```

可以手动编辑这个文件来修改配置。

---

## 📖 完整配置示例

正确的 `.deploy-config.json` 文件内容：

```json
{
  "remoteHost": "39.102.212.245",
  "remoteUser": "root",
  "remotePort": "22",
  "remotePath": "/opt/stock-manager",
  "branch": "master",
  "skipGitCheck": false
}
```

---

## 💡 预防措施

为了防止这个问题再次发生，最新版本的 `deploy.js` 已经添加了验证：

- 如果输入的分支名包含 `://` 或 `@`，会提示错误并要求重新输入
- 配置向导中添加了更清晰的提示：`Git分支名 (如: master, main)`

---

## 🚀 部署流程

完整的部署流程应该是这样的：

```bash
# 1. 确保本地代码已提交
git add .
git commit -m "你的提交信息"

# 2. 运行部署脚本
npm run deploy

# 3. 按照提示操作
# - 确认使用现有配置（如果配置正确）
# - 或者重新配置部署参数
# - 确认开始部署

# 4. 等待部署完成
# 脚本会自动：
# - 推送代码到 GitHub
# - SSH 连接到服务器
# - 在服务器上拉取代码
# - 安装依赖
# - 重启服务
```

---

## 🔄 重新配置所有参数

如果需要完全重新配置：

```bash
# 删除配置文件
rm scripts/deploy/.deploy-config.json

# 重新运行部署（会启动配置向导）
npm run deploy
```

或者使用命令行参数：

```bash
npm run deploy -- --config
```

---

## 📞 相关命令

```bash
# 部署到服务器
npm run deploy

# 重新配置
npm run deploy -- --config

# 查看帮助
node scripts/deploy/deploy.js --help

# 查看服务器日志
npm run logs

# 查看服务状态
npm run status
```

---

## ✅ 验证修复

修复后，运行 `npm run deploy`，应该看到：

```
📤 步骤 2/5: 推送代码到远程仓库...
🚀 推送代码...
✅ 推送代码 完成
```

而不是错误信息。

---

**🎉 现在你可以正常部署了！**

如果还有其他问题，请查看：
- [部署指南](./DEPLOYMENT_GUIDE.md)
- [GitHub 连接故障排除](./GITHUB_CONNECTION_TROUBLESHOOTING.md)
