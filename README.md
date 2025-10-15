# 个人股票信息系统

一个专业的股票投资管理与分析平台，提供实时行情、投资组合管理和智能提醒功能。

## 🚀 功能特性

- 📈 **实时行情** - 获取最新股票价格和走势数据
- 📊 **投资组合** - 管理股票持仓和收益分析
- 🔔 **智能提醒** - 价格预警和投资建议
- 📱 **响应式设计** - 支持各种设备访问
- 🔒 **安全可靠** - 专业的系统架构设计

## 🛠️ 技术栈

- **后端**: Node.js + Express.js
- **前端**: HTML5 + CSS3 + JavaScript
- **部署**: 支持Docker容器化部署
- **网络**: 支持多IP地址访问

## 📦 快速开始

### 环境要求

- Node.js 14.0 或更高版本
- npm 6.0 或更高版本

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <项目地址>
   cd stock-manager
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动服务**
   ```bash
   # 开发模式
   npm run dev
   
   # 生产模式
   npm start
   ```

4. **访问系统**
   - 本地访问: http://localhost:3000
   - 网络访问: http://<服务器IP>:3000

## 🌐 部署指南

### 本地部署

1. 确保服务器开放3000端口
2. 将项目文件上传到服务器
3. 安装Node.js环境
4. 执行安装和启动命令

### Docker部署（推荐）

```bash
# 构建镜像
docker build -t stock-manager .

# 运行容器
docker run -d -p 3000:3000 --name stock-manager stock-manager
```

### 云服务器部署

支持主流云服务商：
- AWS EC2
- 阿里云ECS
- 腾讯云CVM
- 华为云ECS

## 📊 系统架构

```
客户端浏览器
    ↓
负载均衡器 (可选)
    ↓
Express服务器 (端口3000)
    ↓
静态文件服务
    ↓
API接口服务
```

## 📁 项目结构

详细的项目目录结构说明请查看：[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)

快速预览：
- `controllers/` - 业务逻辑控制器
- `routes/` - API路由定义
- `public/` - 前端静态资源
- `scripts/` - 各类脚本（部署、测试、同步等）
- `docs/` - 项目文档（指南、设计、报告）
- `utils/` - 工具函数
- `tools/` - 开发工具

## 🔧 配置文件

### 环境变量配置

创建 `.env` 文件：
```env
PORT=3000
NODE_ENV=production
SERVER_IP=您的服务器IP
```

### 端口配置

系统默认使用3000端口，可通过环境变量修改：
```bash
PORT=8080 npm start
```

## 📈 访问方式

### 本地访问
```
http://localhost:3000
```

### 网络访问
```
http://<服务器公网IP>:3000
http://<服务器内网IP>:3000
```

### 域名访问（需配置域名解析）
```
http://stock.yourdomain.com
```

## 🚨 安全配置

### 防火墙设置
```bash
# 开放3000端口
sudo ufw allow 3000/tcp
sudo ufw enable
```

### Nginx反向代理（可选）
```nginx
server {
    listen 80;
    server_name stock.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📋 系统状态检查

访问健康检查接口：
```
GET /api/health
```

响应示例：
```json
{
    "status": "OK",
    "message": "个人股票信息系统运行正常",
    "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 🔄 更新日志

### v1.0.0 (2024-01-01)
- ✅ 基础系统架构搭建
- ✅ 美化首页界面
- ✅ 响应式设计支持
- ✅ 健康检查接口
- ✅ 多IP访问支持

## 📞 技术支持

### 📚 相关文档

- 📖 [部署指南](./docs/guides/DEPLOYMENT_GUIDE.md) - 完整的部署流程
- 🔧 [GitHub 连接故障排除](./docs/guides/GITHUB_CONNECTION_TROUBLESHOOTING.md) - 解决克隆失败问题
- 📁 [项目结构说明](./PROJECT_STRUCTURE.md) - 详细的目录结构

### 常见问题

- **登录出现 500 错误？** → 查看 [登录 500 错误修复指南](./docs/guides/LOGIN_ERROR_500_FIX.md) ⭐⭐
- **部署推送代码失败？** → 查看 [Git Push 错误修复指南](./docs/guides/DEPLOY_PUSH_ERROR_FIX.md) ⭐
- **部署后无法访问服务器？** → 查看 [服务器访问故障排除指南](./docs/guides/SERVER_ACCESS_TROUBLESHOOTING.md) ⭐
- **无法克隆 GitHub 项目？** → 查看 [GitHub 连接故障排除指南](./docs/guides/GITHUB_CONNECTION_TROUBLESHOOTING.md)
- **如何部署到服务器？** → 查看 [部署指南](./docs/guides/DEPLOYMENT_GUIDE.md)
- **项目文件在哪里？** → 查看 [项目结构说明](./PROJECT_STRUCTURE.md)

### 默认登录凭据

```
账号: admin
密码: admin
```

**⚠️ 重要：** 首次登录后请立即修改默认密码！

## 📄 许可证

MIT License - 详见 LICENSE 文件

---

**开始您的股票投资之旅！** 🎉