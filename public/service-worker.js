/**
 * Service Worker - PWA 离线缓存和更新管理
 * 策略：静态资源缓存优先，API 网络优先
 */

const CACHE_VERSION = '1.0.0';
const CACHE_NAME = `stock-manager-v${CACHE_VERSION}`;
const API_CACHE = `stock-manager-api-v${CACHE_VERSION}`;
const IMAGE_CACHE = `stock-manager-images-v${CACHE_VERSION}`;

// 需要立即缓存的核心资源
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/css/main.css',
  '/js/main.js',
  '/js/main-core.js',
  '/js/platform-detector.js',
  '/js/update-manager.js',
  '/js/capacitor-bridge.js',
  '/manifest.json'
];

// 需要缓存的库文件
const LIB_ASSETS = [
  '/js/lib/chart.umd.min.js',
  '/js/lib/marked.min.js',
  '/js/lib/xlsx.full.min.js',
  '/js/lib/echarts.min.js'
];

// 需要缓存的模块文件
const MODULE_ASSETS = [
  '/js/modal-init.js',
  '/js/stockChart.js',
  '/js/modules/position-manager.js',
  '/js/modules/watchlist-manager.js',
  '/js/modules/stock-detail.js',
  '/js/modules/analysis-manager.js',
  '/js/modules/recommendation-manager.js',
  '/js/modules/trade-manager.js',
  '/js/modules/trading-plan-manager.js',
  '/js/modules/cost-management.js',
  '/js/modules/profit-analysis-manager.js',
  '/js/modules/fund-management.js',
  '/js/modules/trading-log-manager.js',
  '/js/modules/stock-pool-manager.js',
  '/js/modules/ai-prompt-manager.js',
  '/js/modules/risk-control-manager.js',
  '/js/modules/fundamental-analysis.js',
  '/js/modules/prediction-manager.js',
  '/js/modules/history-manager.js',
  '/js/modules/settings-manager.js',
  '/js/modules/capital-manager.js',
  '/js/modules/ui-utils.js',
  '/js/modules/market-data.js',
  '/js/modules/recap-manager.js',
  '/js/modules/report-manager.js',
  '/js/modules/three-day-selection-manager.js',
  '/js/modules/short-term.js',
  '/js/modules/stock-selection.js',
  '/js/modules/buy-point-validation-manager.js'
];

// 所有需要预缓存的资源
const PRECACHE_ASSETS = [
  ...CORE_ASSETS,
  ...LIB_ASSETS,
  ...MODULE_ASSETS
];

/**
 * 安装事件 - 预缓存资源
 */
self.addEventListener('install', event => {
  console.log('[SW] 🔧 正在安装 Service Worker v' + CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] 📦 预缓存核心资源...');
        // 分批缓存，避免一次性失败
        return Promise.allSettled(
          PRECACHE_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`[SW] ⚠️ 缓存失败: ${url}`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] ✅ 预缓存完成');
        // 立即激活新的 Service Worker
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] ❌ 预缓存失败:', error);
      })
  );
});

/**
 * 激活事件 - 清理旧缓存
 */
self.addEventListener('activate', event => {
  console.log('[SW] ✅ 激活 Service Worker v' + CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // 删除旧版本的缓存
            if (cacheName.startsWith('stock-manager-') &&
                cacheName !== CACHE_NAME &&
                cacheName !== API_CACHE &&
                cacheName !== IMAGE_CACHE) {
              console.log('[SW] 🗑️ 删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] 🎉 Service Worker 已激活并接管页面');
        // 立即接管所有页面
        return self.clients.claim();
      })
  );
});

/**
 * 拦截网络请求 - 实现缓存策略
 */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 跨域请求：直接放行
  if (url.origin !== location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // API 请求：网络优先策略
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // 图片资源：缓存优先策略
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }

  // 静态资源：缓存优先，后台更新
  event.respondWith(staleWhileRevalidateStrategy(request, CACHE_NAME));
});

/**
 * 缓存策略：网络优先（适用于 API）
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    // 尝试从网络获取
    const networkResponse = await fetch(request);

    // 仅缓存成功的 GET 请求
    if (request.method === 'GET' && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // 网络失败，尝试从缓存获取
    console.warn('[SW] ⚠️ 网络请求失败，尝试使用缓存:', request.url);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // 如果是 HTML 页面请求失败，返回离线页面
    if (request.destination === 'document') {
      return caches.match('/index.html');
    }

    // 其他情况返回错误
    throw error;
  }
}

/**
 * 缓存策略：缓存优先（适用于图片等静态资源）
 */
async function cacheFirstStrategy(request, cacheName) {
  // 先从缓存查找
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // 缓存未命中，从网络获取
  try {
    const networkResponse = await fetch(request);

    // 缓存成功的响应
    if (networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] ❌ 资源加载失败:', request.url);
    throw error;
  }
}

/**
 * 缓存策略：缓存优先 + 后台更新（适用于静态资源）
 */
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);

  // 后台更新缓存
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.status === 200) {
        const cache = caches.open(cacheName);
        cache.then(c => c.put(request, networkResponse.clone()));
      }
      return networkResponse;
    })
    .catch(error => {
      console.warn('[SW] ⚠️ 后台更新失败:', request.url);
    });

  // 如果有缓存，立即返回；否则等待网络请求
  return cachedResponse || fetchPromise;
}

/**
 * 监听消息 - 处理更新请求
 */
self.addEventListener('message', event => {
  console.log('[SW] 📨 收到消息:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] ⏩ 跳过等待，立即激活');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] 🧹 清除所有缓存');
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_VERSION
    });
  }
});

/**
 * 后台同步 - 离线时的操作队列
 */
self.addEventListener('sync', event => {
  console.log('[SW] 🔄 后台同步:', event.tag);

  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineData());
  }
});

/**
 * 同步离线数据
 */
async function syncOfflineData() {
  // 从 IndexedDB 读取离线操作队列
  // 这里可以实现离线操作的同步逻辑
  console.log('[SW] 📤 同步离线数据...');
}

/**
 * 推送通知
 */
self.addEventListener('push', event => {
  console.log('[SW] 📬 收到推送通知');

  const options = {
    body: event.data ? event.data.text() : '您有新消息',
    icon: '/images/icon-192.png',
    badge: '/images/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('股票系统', options)
  );
});

/**
 * 通知点击事件
 */
self.addEventListener('notificationclick', event => {
  console.log('[SW] 👆 通知被点击');

  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

/**
 * 错误处理
 */
self.addEventListener('error', event => {
  console.error('[SW] ❌ Service Worker 错误:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] ❌ 未处理的 Promise 拒绝:', event.reason);
});

console.log('[SW] 🚀 Service Worker 脚本已加载 v' + CACHE_VERSION);
