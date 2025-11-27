# 手机 PWA 安装指南

## 📱 问题：Chrome 不显示安装图标

### 原因
PWA 需要 HTTPS 才能在手机上安装，HTTP 连接会被 Chrome 阻止。

---

## ✅ 解决方案

### 方法一：Chrome Flags（推荐，最简单）

#### Android Chrome

1. 在 Chrome 地址栏输入：
   ```
   chrome://flags/#unsafely-treat-insecure-origin-as-secure
   ```

2. 找到 **"Insecure origins treated as secure"**

3. 下拉框选择 **"Enabled"**

4. 在文本框中添加您的服务器地址：
   ```
   http://192.168.8.166:3000
   ```
   （替换为您实际的IP地址）

5. 点击 **"Relaunch"** 重启浏览器

6. 重新访问网站，应该能看到安装图标了

#### iOS Safari（不支持 chrome:// flags）

iOS Safari 对 PWA 的支持较弱，需要使用其他方法：

1. 访问网站
2. 点击底部分享按钮
3. 选择"添加到主屏幕"
4. 设置名称，点击"添加"

---

### 方法二：使用 ngrok（推荐，获得真实HTTPS）

#### 安装 ngrok

1. 访问 https://ngrok.com/download
2. 下载并安装
3. 注册账号（免费）
4. 按照指示配置 authtoken

#### 使用 ngrok

在服务器运行的电脑上执行：

```bash
ngrok http 3000
```

会看到类似输出：
```
Session Status                online
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

使用 `https://abc123.ngrok.io` 这个地址在手机上访问即可！

**优点：**
- ✅ 真正的 HTTPS
- ✅ 无需配置
- ✅ 可以从任何网络访问（不仅限局域网）
- ✅ 方便演示和测试

**缺点：**
- ⚠️ 免费版每次运行URL会变化
- ⚠️ 需要保持 ngrok 运行

---

### 方法三：配置本地 HTTPS（适合长期开发）

如果您需要长期开发PWA，可以配置本地HTTPS证书。

#### 使用 mkcert 生成本地证书

```bash
# 1. 安装 mkcert
# Windows: choco install mkcert
# Mac: brew install mkcert

# 2. 安装本地CA
mkcert -install

# 3. 生成证书
cd f:/Git/stock-manager
mkcert localhost 192.168.8.166 127.0.0.1 ::1

# 4. 会生成两个文件：
# localhost+3.pem (证书)
# localhost+3-key.pem (私钥)
```

#### 修改 server.js 支持 HTTPS

在 server.js 顶部添加：

```javascript
const https = require('https');
const fs = require('fs');

// ... 其他代码 ...

// 在 app.listen() 之前添加：
if (process.env.NODE_ENV === 'development') {
  const options = {
    key: fs.readFileSync('localhost+3-key.pem'),
    cert: fs.readFileSync('localhost+3.pem')
  };

  https.createServer(options, app).listen(3000, '0.0.0.0', () => {
    console.log('🔒 HTTPS 服务器运行在 https://localhost:3000');
    console.log('🔒 局域网访问: https://192.168.8.166:3000');
  });
} else {
  // 生产环境使用HTTP（由nginx等处理HTTPS）
  app.listen(PORT, '0.0.0.0', () => {
    // ... 原有代码
  });
}
```

---

## 🔍 检查清单

安装前请确认：

### 1. 文件检查
```bash
# 检查图标
ls public/images/icon-192.png
ls public/images/icon-512.png

# 检查配置
ls public/manifest.json
ls public/service-worker.js
```

### 2. 服务器检查
- ✅ 服务器正在运行
- ✅ 可以通过浏览器访问
- ✅ 手机和电脑在同一WiFi

### 3. Chrome DevTools 检查（电脑上）

打开 http://localhost:3000，按F12：

**Application → Manifest**
- ✅ 显示应用名称、图标等信息
- ❌ 如果显示错误，检查 manifest.json

**Application → Service Workers**
- ✅ 状态显示"activated and is running"
- ❌ 如果注册失败，检查 service-worker.js

**Console**
- ✅ 应该看到"平台检测信息"
- ✅ "Service Worker 已注册"
- ❌ 如果有错误，查看具体错误信息

---

## 📊 PWA 安装要求

Chrome 判断是否显示安装提示的条件：

1. ✅ **Web App Manifest**
   - name 或 short_name
   - icons（至少192x192）
   - start_url
   - display: standalone 或 fullscreen

2. ✅ **Service Worker**
   - 已注册且激活
   - 至少有 fetch 事件处理

3. ✅ **HTTPS** 或 localhost
   - 生产环境必须 HTTPS
   - 开发环境可用 localhost

4. ⚠️ **用户参与度**
   - 用户至少访问2次
   - 两次访问间隔至少5分钟
   - （不同Chrome版本要求可能不同）

---

## 🎯 测试成功标志

### 安装前
- 浏览器地址栏显示⊕图标
- 或页面底部显示安装横幅

### 安装后
- 手机主屏幕出现应用图标
- 点击图标打开应用
- 应用全屏运行（无地址栏）
- 控制台显示"运行平台: PWA 应用"

---

## 🚨 常见错误

### 错误1: "No matching service worker detected"

**原因**: Service Worker 未注册或路径错误

**解决**:
1. 检查 service-worker.js 是否在 public/ 目录
2. 检查 index.html 中是否正确引入 update-manager.js
3. 清除浏览器缓存重试

### 错误2: "Manifest: Line X, column Y, Syntax error"

**原因**: manifest.json 格式错误

**解决**:
1. 使用 JSON 验证工具检查 manifest.json
2. 确保所有属性名和值都正确引用
3. 检查是否有多余的逗号

### 错误3: "Site cannot be installed: no matching service worker detected"

**原因**: Service Worker 未正确注册到 manifest 的 scope

**解决**:
1. 确保 manifest.json 中的 start_url 是 "/"
2. 确保 Service Worker 注册路径是 "/service-worker.js"
3. 清除浏览器缓存和 Service Worker

---

## 💡 提示

1. **测试时清除缓存**
   - Chrome DevTools → Application → Storage
   - 点击 "Clear site data"

2. **查看详细错误**
   - Chrome DevTools → Console
   - Application → Manifest（查看警告）

3. **强制更新**
   - Chrome DevTools → Application → Service Workers
   - 勾选 "Update on reload"

4. **移除已安装的PWA**
   - Android: 长按应用图标 → 卸载
   - iOS: 长按应用图标 → 删除

---

## 📚 参考资源

- [Web.dev PWA 指南](https://web.dev/progressive-web-apps/)
- [MDN Service Worker API](https://developer.mozilla.org/zh-CN/docs/Web/API/Service_Worker_API)
- [Chrome PWA 安装标准](https://web.dev/install-criteria/)
- [ngrok 文档](https://ngrok.com/docs)
