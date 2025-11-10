# 部署和故障排查指南

## 常见问题：自选股行情一直加载

### 问题描述
部署到远程服务器后，自选股行情页面一直显示"正在加载自选股行情..."，无法正常显示数据。

### 根本原因
远程服务器无法访问新浪财经API（`https://hq.sinajs.cn`），导致行情数据获取失败或超时。

---

## 解决方案

### 方案1：测试API连接（推荐首先执行）

在远程服务器上运行测试脚本：

```bash
node test-api-connection.js
```

**预期输出（成功）：**
```
✅ API连接成功！
⏱️  响应时间: 127ms
✅ 测试通过！远程服务器可以正常访问新浪财经API
```

**如果失败**，会显示具体的错误原因和解决建议。

---

### 方案2：配置代理（如果服务器在中国大陆境外）

如果服务器在境外或有网络限制，可能需要配置代理。

#### 2.1 修改 `routes/stock.js`

在文件顶部添加代理配置：

```javascript
const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');

// 配置代理（如果需要）
const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
const httpsAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
```

在 axios 请求中使用代理：

```javascript
const response = await axios.get(sinaUrl, {
    headers: { 'Referer': 'https://finance.sina.com.cn' },
    timeout: 10000,
    responseType: 'arraybuffer',
    httpsAgent: httpsAgent  // 添加这一行
});
```

#### 2.2 设置环境变量

在 `.env.development` 或 `.env.production` 中添加：

```bash
HTTP_PROXY=http://your-proxy-server:port
HTTPS_PROXY=http://your-proxy-server:port
```

#### 2.3 安装依赖

```bash
npm install https-proxy-agent
```

---

### 方案3：增加超时时间

如果网络较慢，可以适当增加超时时间：

修改 `routes/stock.js` 第212行：

```javascript
const response = await axios.get(sinaUrl, {
    headers: { 'Referer': 'https://finance.sina.com.cn' },
    timeout: 30000,  // 从10秒改为30秒
    responseType: 'arraybuffer'
});
```

同时修改前端 `public/js/modules/watchlist-manager.js` 第193行：

```javascript
const timeoutId = setTimeout(() => controller.abort(), 35000);  // 从15秒改为35秒
```

⚠️ **注意**：前端超时时间应该比后端超时时间长5秒左右。

---

### 方案4：使用备用API

如果新浪财经API完全无法访问，可以考虑使用其他数据源：

#### 选项1：东方财富网API
- URL: `http://push2.eastmoney.com/api/qt/stock/get`
- 文档: 需要研究具体参数

#### 选项2：腾讯财经API
- URL: `http://qt.gtimg.cn/q=`
- 格式类似新浪

#### 选项3：缓存优先策略

修改 `routes/stock.js`，当API失败时返回缓存数据：

```javascript
try {
    // 尝试获取新数据
    const response = await axios.get(sinaUrl, { ... });
    // ...
} catch (error) {
    console.error('API调用失败，尝试使用缓存数据');

    // 如果有缓存数据，返回缓存
    if (cacheResult.cached.length > 0) {
        return res.json({
            success: true,
            data: cacheResult.cached.map(item => item.data),
            cached: true,
            warning: 'API暂时不可用，显示缓存数据'
        });
    }

    // 完全失败
    throw error;
}
```

---

## 部署检查清单

### 1. 环境准备

- [ ] Node.js 版本 >= 14.0.0
- [ ] npm 已安装
- [ ] 所有依赖已安装 (`npm install`)
- [ ] 数据库文件已复制或初始化

### 2. 网络测试

```bash
# 测试DNS解析
nslookup hq.sinajs.cn

# 测试网络连接
curl -I https://hq.sinajs.cn/list=sh000001

# 运行应用测试脚本
node test-api-connection.js
```

### 3. 防火墙设置

确保服务器允许访问以下端口和地址：

- **出站**：443端口（HTTPS）到 `hq.sinajs.cn`
- **入站**：3000端口（应用端口）

### 4. 环境变量

检查 `.env.development` 或 `.env.production`：

```bash
# 基本设置
PORT=3000
NODE_ENV=production

# 数据库
DATABASE_PATH=./stock_manager.db

# JWT密钥
JWT_SECRET=your-secret-key

# 代理（如果需要）
# HTTP_PROXY=http://proxy:port
# HTTPS_PROXY=http://proxy:port
```

### 5. 启动服务

```bash
# 开发环境
npm start

# 生产环境（推荐使用PM2）
npm install -g pm2
pm2 start server.js --name stock-manager
pm2 save
pm2 startup
```

---

## 常见错误和解决方法

### 错误1：`ECONNABORTED` 或 `ETIMEDOUT`

**原因**：网络超时

**解决**：
1. 检查网络连接：`ping hq.sinajs.cn`
2. 增加超时时间（见方案3）
3. 配置代理（见方案2）

---

### 错误2：`ENOTFOUND` 或 `EAI_AGAIN`

**原因**：DNS解析失败

**解决**：
1. 检查DNS服务器设置
2. 使用公共DNS（如Google的8.8.8.8）
3. 在 `/etc/hosts` 中添加手动解析

```bash
# /etc/hosts
123.125.88.12 hq.sinajs.cn
```

---

### 错误3：`certificate` 相关错误

**原因**：SSL证书验证失败

**临时解决**（不推荐用于生产）：

```javascript
const response = await axios.get(sinaUrl, {
    // ...
    rejectUnauthorized: false  // 跳过SSL验证
});
```

**推荐解决**：更新系统证书

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install ca-certificates

# CentOS/RHEL
sudo yum install ca-certificates
```

---

### 错误4：`403 Forbidden`

**原因**：IP被封禁或需要特定Header

**解决**：
1. 确保设置了正确的Referer header
2. 降低请求频率
3. 使用代理轮换IP

---

## 监控和日志

### 查看服务器日志

```bash
# 实时查看
pm2 logs stock-manager

# 查看错误日志
pm2 logs stock-manager --err

# 清空日志
pm2 flush
```

### 设置日志轮转

编辑 `pm2` 配置文件 `ecosystem.config.js`：

```javascript
module.exports = {
    apps: [{
        name: 'stock-manager',
        script: './server.js',
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        max_memory_restart: '500M'
    }]
};
```

### 浏览器调试

1. 打开开发者工具（F12）
2. 切换到 Network 标签
3. 刷新页面
4. 查找失败的请求（红色）
5. 查看 Console 标签的错误信息

---

## 性能优化建议

### 1. 使用Redis缓存（生产环境推荐）

```bash
npm install redis
```

修改缓存策略使用Redis替代内存缓存。

### 2. 启用Gzip压缩

```javascript
// server.js
const compression = require('compression');
app.use(compression());
```

### 3. 使用CDN加速静态资源

将 `public/js/lib/` 中的第三方库改用CDN：

```html
<!-- 使用CDN -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

---

## 联系和支持

如果以上方法都无法解决问题，请：

1. 收集以下信息：
   - 服务器操作系统和版本
   - Node.js 版本 (`node -v`)
   - 测试脚本输出 (`node test-api-connection.js`)
   - 浏览器控制台错误截图
   - 服务器日志

2. 提交 Issue 到项目仓库

---

## 更新日志

- **2025-01-10**: 添加前端超时处理（15秒）
- **2025-01-10**: 增强服务端错误日志
- **2025-01-10**: 创建 API 连接测试脚本
