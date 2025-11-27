# PWA 实施方案 - 将股票系统改造为类原生 APP

## 📋 需要添加的文件

### 1. manifest.json（应用配置文件）
```json
{
  "name": "个人股票信息系统",
  "short_name": "股票系统",
  "description": "个人股票信息管理与分析系统",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2196F3",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/images/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/images/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 2. service-worker.js（离线缓存和即时更新）
```javascript
const CACHE_NAME = 'stock-manager-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/css/main.css',
  '/js/main.js',
  '/js/lib/chart.umd.min.js',
  '/js/lib/marked.min.js',
  '/js/lib/xlsx.full.min.js',
  '/js/lib/echarts.min.js'
];

// 安装 Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // 立即激活新版本
});

// 拦截网络请求
self.addEventListener('fetch', event => {
  event.respondWith(
    // 网络优先策略（确保即时更新）
    fetch(event.request)
      .then(response => {
        // 更新缓存
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseToCache));
        return response;
      })
      .catch(() => {
        // 网络失败时使用缓存
        return caches.match(event.request);
      })
  );
});

// 清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
```

### 3. 修改 index.html（注册 Service Worker）
在 `<head>` 标签中添加：
```html
<link rel="manifest" href="/manifest.json">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="股票系统">
<link rel="apple-touch-icon" href="/images/icon-192.png">

<script>
// 注册 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('✅ Service Worker 已注册'))
      .catch(err => console.error('❌ Service Worker 注册失败:', err));
  });
}

// 检测更新并提示用户刷新
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (confirm('发现新版本！是否立即刷新？')) {
    window.location.reload();
  }
});
</script>
```

---

## 📱 用户使用流程

### Android（Chrome/Edge）
1. 用户访问 `https://你的域名.com`
2. Chrome 自动提示"添加到主屏幕"
3. 点击后生成桌面图标，像 APP 一样打开
4. **每次打开都会自动检查更新**

### iOS（Safari）
1. 用户访问网站
2. 点击底部分享按钮 → "添加到主屏幕"
3. 设置图标名称
4. 像 APP 一样从主屏幕打开

---

## 🚀 即时更新机制

### 自动更新流程
```
用户打开 APP
    ↓
Service Worker 检测到新文件
    ↓
后台下载更新
    ↓
弹出提示："发现新版本！"
    ↓
用户确认刷新 → 立即更新完成
```

### 强制更新策略（可选）
```javascript
// 在 main.js 中添加版本检测
const APP_VERSION = '1.0.5';

fetch('/api/version')
  .then(res => res.json())
  .then(data => {
    if (data.version !== APP_VERSION) {
      alert('系统已更新，即将刷新...');
      window.location.reload();
    }
  });
```

---

## ⚡ 优势总结

1. **即时更新** - 无需重新下载 APK，刷新即可
2. **无需审核** - 绕过应用商店审核流程
3. **跨平台** - Android、iOS、桌面端通用
4. **体积小** - 没有原生代码，加载速度快
5. **易维护** - 不需要维护多个平台的代码

---

## 🔧 服务端配置（HTTPS 必须）

PWA 必须在 HTTPS 环境下运行：

```nginx
# Nginx 配置示例
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

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

---

## 📦 可选增强功能

### 1. 推送通知
```javascript
// 请求通知权限
Notification.requestPermission().then(permission => {
  if (permission === 'granted') {
    // 可以发送止损提醒、价格预警等
    new Notification('价格提醒', {
      body: '茅台跌破1500元！',
      icon: '/images/icon-192.png'
    });
  }
});
```

### 2. 离线使用
Service Worker 自动缓存资源，断网也能查看历史数据

### 3. 添加安装提示横幅
```javascript
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // 显示自定义安装按钮
  document.getElementById('installBtn').style.display = 'block';
});

document.getElementById('installBtn').addEventListener('click', () => {
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('用户已安装 APP');
    }
  });
});
```

---

## ✅ 实施检查清单

- [ ] 添加 `manifest.json`
- [ ] 创建 `service-worker.js`
- [ ] 修改 `index.html` 注册 Service Worker
- [ ] 准备 192x192 和 512x512 图标
- [ ] 配置 HTTPS
- [ ] 测试安装流程
- [ ] 测试更新机制
- [ ] 测试离线功能

---

## 🎯 预计工作量

- **开发时间**: 1-2 天
- **测试时间**: 半天
- **总计**: 最多 2-3 天即可完成

---

## 📚 参考资源

- [PWA 官方文档](https://web.dev/progressive-web-apps/)
- [MDN Service Worker](https://developer.mozilla.org/zh-CN/docs/Web/API/Service_Worker_API)
- [manifest.json 生成器](https://app-manifest.firebaseapp.com/)
