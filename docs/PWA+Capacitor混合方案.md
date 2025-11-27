# PWA + Capacitor APK 混合方案 - 全平台覆盖

## 🎯 方案目标

**一份代码，支持所有访问方式：**

1. 🌐 **浏览器访问** - PC 和手机直接访问网页
2. 📱 **PWA 安装** - 添加到主屏幕（轻量级）
3. 📦 **APK 安装** - 真正的 Android 应用（原生功能）

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────┐
│         股票系统 Web 应用                │
│      (HTML + CSS + JavaScript)          │
└───────────────┬─────────────────────────┘
                │
        ┌───────┴────────┬──────────────┐
        │                │              │
   ┌────▼─────┐    ┌────▼────┐   ┌─────▼─────┐
   │浏览器访问│    │PWA 访问 │   │APK 访问   │
   └──────────┘    └─────────┘   └───────────┘
        │                │              │
        └────────────────┴──────────────┘
                         │
                    ┌────▼────┐
                    │后端 API │
                    └─────────┘
```

---

## 📦 目录结构

```
stock-manager/
├── public/                    # Web 应用（三种方式共享）
│   ├── index.html            # 主页面
│   ├── manifest.json         # PWA 配置
│   ├── service-worker.js     # PWA 离线缓存
│   ├── js/
│   │   ├── platform-detector.js  # 平台检测
│   │   ├── update-manager.js     # 统一更新管理
│   │   └── capacitor-bridge.js   # Capacitor 桥接
│   ├── css/
│   └── images/
│       ├── icon-192.png      # PWA 图标
│       └── icon-512.png
├── android/                   # Capacitor Android 项目
│   └── app/
├── capacitor.config.json     # Capacitor 配置
├── package.json
└── server.js                 # 后端服务器
```

---

## 🔧 实施步骤

### 第一步：安装依赖

```bash
# 安装 Capacitor（如果还没有）
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android

# 初始化 Capacitor
npx cap init "股票系统" "com.yourcompany.stockmanager" --web-dir=public

# 添加 Android 平台
npx cap add android
```

---

### 第二步：创建 PWA 配置文件

#### 1. manifest.json

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
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/images/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/images/screenshot-1.png",
      "sizes": "1080x1920",
      "type": "image/png"
    }
  ]
}
```

#### 2. service-worker.js

```javascript
const CACHE_NAME = 'stock-manager-v1.0.0';
const API_CACHE = 'stock-manager-api-v1';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/css/main.css',
  '/js/main.js',
  '/js/main-core.js',
  '/js/lib/chart.umd.min.js',
  '/js/lib/marked.min.js',
  '/js/lib/xlsx.full.min.js',
  '/js/lib/echarts.min.js',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// 安装 Service Worker
self.addEventListener('install', event => {
  console.log('[SW] 正在安装...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] 缓存静态资源');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting()) // 立即激活
  );
});

// 激活 Service Worker
self.addEventListener('activate', event => {
  console.log('[SW] 正在激活...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 清理旧版本缓存
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
            console.log('[SW] 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // 立即接管页面
  );
});

// 拦截网络请求
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API 请求：网络优先，失败则使用缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // 缓存 GET 请求的响应
          if (request.method === 'GET' && response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // 网络失败，尝试从缓存读取
          return caches.match(request);
        })
    );
    return;
  }

  // 静态资源：缓存优先，失败则请求网络
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) {
          // 后台更新缓存
          fetch(request).then(response => {
            if (response.status === 200) {
              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, response));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(request);
      })
  );
});

// 监听消息（用于强制更新）
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

---

### 第三步：创建平台检测模块

#### public/js/platform-detector.js

```javascript
/**
 * 平台检测模块
 * 识别当前运行环境：浏览器、PWA、Capacitor APK
 */

class PlatformDetector {
  constructor() {
    this.info = this.detect();
    this.applyPlatformClass();
  }

  detect() {
    // 检测 Capacitor
    const isCapacitor = window.Capacitor !== undefined;

    // 检测 PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  window.navigator.standalone === true;

    // 检测浏览器
    const isBrowser = !isCapacitor && !isPWA;

    // 检测移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // 检测操作系统
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    // 确定平台类型
    let platform = 'web';
    if (isCapacitor) platform = 'app';
    else if (isPWA) platform = 'pwa';

    return {
      isCapacitor,
      isPWA,
      isBrowser,
      isMobile,
      isAndroid,
      isIOS,
      platform,
      platformName: this.getPlatformName(platform),
      canInstallPWA: isBrowser && isMobile,
      canShowAppDownload: isBrowser && isAndroid,
      supportsNative: isCapacitor
    };
  }

  getPlatformName(platform) {
    const names = {
      'app': 'Android 应用',
      'pwa': 'PWA 应用',
      'web': '网页版'
    };
    return names[platform] || '未知';
  }

  applyPlatformClass() {
    // 添加平台类名到 body
    document.body.classList.add(`platform-${this.info.platform}`);

    if (this.info.isMobile) {
      document.body.classList.add('mobile');
    }

    if (this.info.isAndroid) {
      document.body.classList.add('android');
    } else if (this.info.isIOS) {
      document.body.classList.add('ios');
    }
  }

  log() {
    console.log('📱 平台信息:', this.info);
    console.log(`✅ 当前运行在: ${this.info.platformName}`);
  }
}

// 全局实例
window.Platform = new PlatformDetector();
```

---

### 第四步：创建统一更新管理器

#### public/js/update-manager.js

```javascript
/**
 * 统一更新管理器
 * 处理 PWA Service Worker 更新和 Capacitor 热更新
 */

class UpdateManager {
  constructor() {
    this.currentVersion = '1.0.0'; // 从配置读取
    this.init();
  }

  async init() {
    if (Platform.info.isPWA || Platform.info.isBrowser) {
      await this.initServiceWorker();
    }

    if (Platform.info.isCapacitor) {
      await this.initCapacitorUpdate();
    }
  }

  /**
   * 初始化 Service Worker（PWA）
   */
  async initServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.log('❌ 浏览器不支持 Service Worker');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('✅ Service Worker 已注册');

      // 监听更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('🔄 发现新版本');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.notifyUpdate('PWA');
          }
        });
      });

      // 检查更新
      setInterval(() => {
        registration.update();
      }, 60000); // 每分钟检查一次

    } catch (error) {
      console.error('❌ Service Worker 注册失败:', error);
    }
  }

  /**
   * 初始化 Capacitor 更新（APK）
   */
  async initCapacitorUpdate() {
    // 注意：这里使用纯在线模式，无需热更新插件
    // 如果需要离线支持，可以集成 capacitor-updater
    console.log('✅ Capacitor 模式（在线模式，自动更新）');

    // 可选：定期刷新页面以获取最新版本
    setInterval(() => {
      this.checkServerVersion();
    }, 300000); // 每5分钟检查一次
  }

  /**
   * 检查服务器版本
   */
  async checkServerVersion() {
    try {
      const response = await fetch('/api/version');
      const data = await response.json();

      if (data.version !== this.currentVersion) {
        console.log(`🆕 发现新版本: ${data.version}`);
        this.notifyUpdate('Server', data);
      }
    } catch (error) {
      console.error('检查版本失败:', error);
    }
  }

  /**
   * 通知用户更新
   */
  notifyUpdate(source, data = {}) {
    const messages = {
      'PWA': '发现新版本！是否立即刷新？',
      'Server': `发现新版本 ${data.version}！\n${data.notes || ''}\n\n是否立即更新？`
    };

    if (confirm(messages[source])) {
      if (source === 'PWA') {
        // PWA 更新：重新加载页面
        navigator.serviceWorker.controller.postMessage('SKIP_WAITING');
        window.location.reload();
      } else {
        // 服务器更新：清除缓存并刷新
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
        window.location.reload(true);
      }
    }
  }

  /**
   * 手动检查更新
   */
  async checkUpdate() {
    console.log('🔍 手动检查更新...');

    if (Platform.info.isPWA || Platform.info.isBrowser) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
      }
    }

    await this.checkServerVersion();
  }
}

// 全局实例
window.UpdateManager = new UpdateManager();
```

---

### 第五步：创建 Capacitor 桥接模块

#### public/js/capacitor-bridge.js

```javascript
/**
 * Capacitor 桥接模块
 * 提供统一的 API，自动适配不同平台
 */

class CapacitorBridge {
  constructor() {
    this.plugins = {};
    this.init();
  }

  async init() {
    if (Platform.info.isCapacitor) {
      // 动态加载 Capacitor 插件
      await this.loadPlugins();
    }
  }

  async loadPlugins() {
    try {
      // 核心插件
      const { App } = await import('https://cdn.jsdelivr.net/npm/@capacitor/app@latest/dist/esm/index.js');
      const { StatusBar } = await import('https://cdn.jsdelivr.net/npm/@capacitor/status-bar@latest/dist/esm/index.js');
      const { SplashScreen } = await import('https://cdn.jsdelivr.net/npm/@capacitor/splash-screen@latest/dist/esm/index.js');

      this.plugins = { App, StatusBar, SplashScreen };

      // 配置状态栏
      await StatusBar.setBackgroundColor({ color: '#2196F3' });
      await SplashScreen.hide();

      console.log('✅ Capacitor 插件已加载');
    } catch (error) {
      console.warn('⚠️ Capacitor 插件加载失败:', error);
    }
  }

  /**
   * 通知 - 统一接口
   */
  async notify(title, message, options = {}) {
    if (Platform.info.isCapacitor && this.plugins.LocalNotifications) {
      // APK：使用原生通知
      await this.plugins.LocalNotifications.schedule({
        notifications: [{
          title,
          body: message,
          id: Date.now(),
          ...options
        }]
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      // PWA/Web：使用 Web Notification
      new Notification(title, {
        body: message,
        icon: '/images/icon-192.png',
        ...options
      });
    } else {
      // 降级：使用 alert
      alert(`${title}\n\n${message}`);
    }
  }

  /**
   * 文件下载 - 统一接口
   */
  async downloadFile(blob, filename) {
    if (Platform.info.isCapacitor && this.plugins.Filesystem) {
      // APK：保存到手机存储
      const base64 = await this.blobToBase64(blob);
      await this.plugins.Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: 'DOCUMENTS'
      });
      await this.notify('下载成功', `文件已保存: ${filename}`);
    } else {
      // PWA/Web：浏览器下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  /**
   * 分享 - 统一接口
   */
  async share(data) {
    if (Platform.info.isCapacitor && this.plugins.Share) {
      // APK：使用原生分享
      await this.plugins.Share.share(data);
    } else if (navigator.share) {
      // PWA/Web：使用 Web Share API
      await navigator.share(data);
    } else {
      // 降级：复制到剪贴板
      await navigator.clipboard.writeText(data.text || data.url);
      alert('链接已复制到剪贴板');
    }
  }

  /**
   * 工具：Blob 转 Base64
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 返回键处理（仅 Android APK）
   */
  onBackButton(callback) {
    if (Platform.info.isCapacitor && this.plugins.App) {
      this.plugins.App.addListener('backButton', callback);
    }
  }
}

// 全局实例
window.Native = new CapacitorBridge();
```

---

### 第六步：修改 index.html

在 `<head>` 中添加：

```html
<!-- PWA 配置 -->
<link rel="manifest" href="/manifest.json">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="股票系统">
<link rel="apple-touch-icon" href="/images/icon-192.png">
<meta name="theme-color" content="#2196F3">

<!-- 平台检测和更新管理（必须在其他脚本之前） -->
<script src="/js/platform-detector.js"></script>
<script src="/js/update-manager.js"></script>
<script src="/js/capacitor-bridge.js"></script>
```

在 `<body>` 底部添加安装提示横幅：

```html
<!-- 安装提示横幅（仅浏览器显示） -->
<div id="installBanner" class="install-banner" style="display: none;">
  <div class="banner-content">
    <div class="banner-icon">📱</div>
    <div class="banner-text">
      <strong>安装股票系统</strong>
      <span>快速访问，离线使用</span>
    </div>
    <button id="installPWABtn" class="banner-btn">安装</button>
    <button id="downloadAPKBtn" class="banner-btn">下载APK</button>
    <button id="closeBannerBtn" class="banner-close">✕</button>
  </div>
</div>

<script>
// 安装提示逻辑
(function() {
  const banner = document.getElementById('installBanner');
  const installBtn = document.getElementById('installPWABtn');
  const downloadBtn = document.getElementById('downloadAPKBtn');
  const closeBtn = document.getElementById('closeBannerBtn');

  let deferredPrompt;

  // 仅在浏览器中显示
  if (Platform.info.isBrowser) {
    // 检查是否已经关闭过
    if (!localStorage.getItem('installBannerClosed')) {
      banner.style.display = 'block';
    }

    // 根据平台显示对应按钮
    if (Platform.info.canInstallPWA) {
      installBtn.style.display = 'inline-block';
    }
    if (Platform.info.canShowAppDownload) {
      downloadBtn.style.display = 'inline-block';
    }
  }

  // PWA 安装提示
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-block';
  });

  // 点击安装 PWA
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`用户选择: ${outcome}`);
      deferredPrompt = null;
    }
    banner.style.display = 'none';
  });

  // 点击下载 APK
  downloadBtn.addEventListener('click', () => {
    window.location.href = '/downloads/stock-manager.apk';
  });

  // 关闭横幅
  closeBtn.addEventListener('click', () => {
    banner.style.display = 'none';
    localStorage.setItem('installBannerClosed', 'true');
  });
})();
</script>
```

---

### 第七步：配置 Capacitor

#### capacitor.config.json

```json
{
  "appId": "com.yourcompany.stockmanager",
  "appName": "股票系统",
  "webDir": "public",
  "server": {
    "url": "https://your-domain.com",
    "cleartext": false,
    "allowNavigation": [
      "your-domain.com"
    ]
  },
  "android": {
    "buildOptions": {
      "keystorePath": "release-key.jks",
      "keystoreAlias": "stock-manager"
    }
  }
}
```

---

### 第八步：添加版本检查 API

#### 修改 server.js

```javascript
// 添加版本检查接口
app.get('/api/version', (req, res) => {
  res.json({
    version: '1.0.0',
    buildTime: '2025-01-15 10:00:00',
    notes: '初始版本'
  });
});

// 提供 APK 下载
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));
```

---

### 第九步：添加平台差异化样式

#### public/css/platform.css

```css
/* 平台通用样式 */
.install-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.2);
  z-index: 9999;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.banner-content {
  display: flex;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  gap: 16px;
}

.banner-icon {
  font-size: 32px;
}

.banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.banner-text strong {
  font-size: 16px;
  margin-bottom: 4px;
}

.banner-text span {
  font-size: 14px;
  opacity: 0.9;
}

.banner-btn {
  padding: 8px 20px;
  background: white;
  color: #667eea;
  border: none;
  border-radius: 20px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s;
}

.banner-btn:hover {
  transform: scale(1.05);
}

.banner-close {
  background: transparent;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0 8px;
}

/* APK 模式：隐藏安装横幅 */
body.platform-app .install-banner {
  display: none !important;
}

/* APK 模式：适配安全区域 */
body.platform-app {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

/* APK 模式：隐藏浏览器特定元素 */
body.platform-app .browser-only {
  display: none;
}

/* 移动端优化 */
body.mobile {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
```

在 index.html 中引入：
```html
<link rel="stylesheet" href="/css/platform.css">
```

---

## 🚀 构建和部署

### 构建 APK

```bash
# 同步代码
npx cap sync android

# 使用 Android Studio 构建
npx cap open android

# 或命令行构建
cd android
./gradlew assembleRelease

# 输出位置
# android/app/build/outputs/apk/release/app-release.apk
```

### 部署到服务器

```bash
# 1. 部署 Web 应用（包含 PWA）
npm run deploy

# 2. 上传 APK 到下载目录
mkdir -p downloads
cp android/app/build/outputs/apk/release/app-release.apk downloads/stock-manager.apk

# 3. 重启服务器
npm run pm2:restart
```

---

## 📊 功能对比表

| 功能 | 浏览器 | PWA | APK |
|------|--------|-----|-----|
| 安装方式 | ❌ 无需安装 | ✅ 添加到主屏幕 | ✅ APK 安装 |
| 桌面图标 | ❌ | ✅ | ✅ |
| 全屏显示 | ❌ | ✅ | ✅ |
| 离线使用 | ⚠️ 部分缓存 | ✅ 完整缓存 | ✅ 完整缓存 |
| 推送通知 | ✅ Web Push | ✅ Web Push | ✅ 原生通知 |
| 文件访问 | ⚠️ 有限 | ⚠️ 有限 | ✅ 完整权限 |
| 启动速度 | 🐌 慢 | ⚡ 快 | ⚡ 快 |
| 更新方式 | 刷新 | 自动更新 | 在线模式自动更新 |
| 应用商店 | ❌ | ❌ | ✅ 可上架 |

---

## 🎯 使用场景推荐

### 推荐浏览器用户：
- PC 办公场景
- 临时访问
- 大屏幕操作

### 推荐 PWA：
- 移动端高频使用
- 追求轻量级
- iOS 用户

### 推荐 APK：
- Android 深度用户
- 需要原生功能
- 追求最佳体验

---

## ✅ 实施检查清单

### PWA 部分
- [ ] 创建 manifest.json
- [ ] 创建 service-worker.js
- [ ] 修改 index.html 添加 PWA meta 标签
- [ ] 准备图标（192x192 和 512x512）
- [ ] 测试"添加到主屏幕"

### Capacitor 部分
- [ ] 安装 Capacitor 依赖
- [ ] 初始化 Android 项目
- [ ] 配置 capacitor.config.json
- [ ] 配置签名证书
- [ ] 构建 APK
- [ ] 测试 APK 安装和运行

### 通用部分
- [ ] 创建平台检测模块
- [ ] 创建更新管理器
- [ ] 创建 Capacitor 桥接
- [ ] 添加安装提示横幅
- [ ] 添加平台差异化样式
- [ ] 添加版本检查 API
- [ ] 配置 HTTPS
- [ ] 部署到生产环境

### 测试
- [ ] 测试浏览器访问
- [ ] 测试 PWA 安装和更新
- [ ] 测试 APK 安装和运行
- [ ] 测试跨平台数据同步
- [ ] 测试更新机制
- [ ] 测试离线功能

---

## 🎯 预计工作量

| 阶段 | 工作量 |
|------|--------|
| PWA 配置 | 1 天 |
| Capacitor 配置 | 1 天 |
| 平台适配代码 | 1-2 天 |
| 测试和优化 | 1 天 |
| **总计** | **4-5 天** |

---

## 📚 参考资源

- [PWA 官方文档](https://web.dev/progressive-web-apps/)
- [Capacitor 官方文档](https://capacitorjs.com/)
- [Service Worker 指南](https://developer.mozilla.org/zh-CN/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/zh-CN/docs/Web/Manifest)
