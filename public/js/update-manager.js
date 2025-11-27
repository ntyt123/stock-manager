/**
 * 统一更新管理器
 * 处理 PWA Service Worker 更新和 Capacitor 热更新
 */

class UpdateManager {
  constructor() {
    this.currentVersion = '1.0.0'; // 应用版本
    this.checkInterval = 60000; // 检查间隔（1分钟）
    this.registration = null;
    this.init();
  }

  async init() {
    console.log('🔄 初始化更新管理器...');

    // 根据平台初始化对应的更新机制
    if (Platform.info.isPWA || Platform.info.isBrowser) {
      await this.initServiceWorker();
    }

    if (Platform.info.isCapacitor) {
      await this.initCapacitorUpdate();
    }

    // 定期检查更新
    this.startPeriodicCheck();
  }

  /**
   * 初始化 Service Worker（PWA / 浏览器）
   */
  async initServiceWorker() {
    if (!Platform.info.supportsServiceWorker) {
      console.log('❌ 浏览器不支持 Service Worker');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('✅ Service Worker 已注册');

      // 监听安装状态
      if (this.registration.installing) {
        console.log('⏳ Service Worker 正在安装...');
      } else if (this.registration.waiting) {
        console.log('⏸️ Service Worker 等待激活');
        this.showUpdateAvailable();
      } else if (this.registration.active) {
        console.log('✅ Service Worker 已激活');
      }

      // 监听更新事件
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration.installing;
        console.log('🔄 发现新版本 Service Worker');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('✅ 新版本已下载，等待激活');
            this.showUpdateAvailable();
          }
        });
      });

      // 监听 Service Worker 控制器变化
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service Worker 控制器已更新');
        if (this.hasShownReloadPrompt) {
          window.location.reload();
        }
      });

    } catch (error) {
      console.error('❌ Service Worker 注册失败:', error);
    }
  }

  /**
   * 初始化 Capacitor 更新（APK 在线模式）
   */
  async initCapacitorUpdate() {
    console.log('✅ Capacitor 在线模式 - 自动获取最新版本');

    // 在线模式下，每次刷新都会获取最新内容
    // 可选：添加版本检查提示用户重启应用
    setTimeout(() => {
      this.checkServerVersion();
    }, 5000); // 启动5秒后检查一次
  }

  /**
   * 检查服务器版本
   */
  async checkServerVersion() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // 未登录，跳过版本检查
        return;
      }

      const response = await fetch('/api/version', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('版本检查失败');
      }

      const data = await response.json();

      // 比较版本号
      if (this.compareVersion(data.version, this.currentVersion) > 0) {
        console.log(`🆕 发现新版本: ${data.version} (当前: ${this.currentVersion})`);
        this.notifyUpdate('Server', data);
      } else {
        console.log('✅ 当前已是最新版本');
      }
    } catch (error) {
      console.warn('⚠️ 版本检查失败:', error.message);
    }
  }

  /**
   * 比较版本号
   * @returns {number} 1: v1 > v2, 0: v1 = v2, -1: v1 < v2
   */
  compareVersion(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;

      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }

    return 0;
  }

  /**
   * 显示更新可用提示
   */
  showUpdateAvailable() {
    this.notifyUpdate('PWA');
  }

  /**
   * 通知用户更新
   */
  notifyUpdate(source, data = {}) {
    // 防止重复提示
    if (this.hasShownReloadPrompt) {
      return;
    }
    this.hasShownReloadPrompt = true;

    const messages = {
      'PWA': '🎉 发现新版本！点击确定立即更新',
      'Server': `🆕 发现新版本 ${data.version}！\n\n${data.notes || '性能优化和BUG修复'}\n\n点击确定立即更新`
    };

    const message = messages[source] || '发现新版本！';

    // 创建更新提示
    this.showUpdatePrompt(message, () => {
      if (source === 'PWA') {
        // PWA: 激活新的 Service Worker
        if (this.registration && this.registration.waiting) {
          this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } else {
        // Server: 清除缓存并刷新
        this.clearCacheAndReload();
      }
    });
  }

  /**
   * 显示更新提示 UI
   */
  showUpdatePrompt(message, onConfirm) {
    // 检查是否存在自定义更新提示元素
    let updatePrompt = document.getElementById('updatePrompt');

    if (!updatePrompt) {
      // 创建更新提示元素
      updatePrompt = document.createElement('div');
      updatePrompt.id = 'updatePrompt';
      updatePrompt.className = 'update-prompt';
      updatePrompt.innerHTML = `
        <div class="update-prompt-content">
          <div class="update-prompt-icon">🔄</div>
          <div class="update-prompt-message"></div>
          <div class="update-prompt-buttons">
            <button class="update-btn-confirm">立即更新</button>
            <button class="update-btn-later">稍后</button>
          </div>
        </div>
      `;
      document.body.appendChild(updatePrompt);

      // 添加样式（如果还没有）
      if (!document.getElementById('updatePromptStyle')) {
        const style = document.createElement('style');
        style.id = 'updatePromptStyle';
        style.textContent = `
          .update-prompt {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            animation: fadeIn 0.3s ease-out;
          }
          .update-prompt-content {
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            animation: slideUp 0.3s ease-out;
          }
          .update-prompt-icon {
            font-size: 48px;
            text-align: center;
            margin-bottom: 16px;
          }
          .update-prompt-message {
            text-align: center;
            font-size: 16px;
            line-height: 1.6;
            color: #333;
            margin-bottom: 24px;
            white-space: pre-wrap;
          }
          .update-prompt-buttons {
            display: flex;
            gap: 12px;
          }
          .update-prompt-buttons button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
          }
          .update-btn-confirm {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .update-btn-confirm:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }
          .update-btn-later {
            background: #f0f0f0;
            color: #666;
          }
          .update-btn-later:hover {
            background: #e0e0e0;
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }
    }

    // 设置消息
    updatePrompt.querySelector('.update-prompt-message').textContent = message;

    // 绑定按钮事件
    const confirmBtn = updatePrompt.querySelector('.update-btn-confirm');
    const laterBtn = updatePrompt.querySelector('.update-btn-later');

    confirmBtn.onclick = () => {
      updatePrompt.remove();
      onConfirm();
    };

    laterBtn.onclick = () => {
      updatePrompt.remove();
      this.hasShownReloadPrompt = false; // 允许稍后再次提示
    };

    // 显示提示
    updatePrompt.style.display = 'flex';
  }

  /**
   * 清除缓存并重新加载
   */
  async clearCacheAndReload() {
    console.log('🧹 清除缓存...');

    try {
      // 清除所有缓存
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log(`🗑️ 删除缓存: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );

      // 卸载 Service Worker
      if (this.registration) {
        await this.registration.unregister();
        console.log('🗑️ Service Worker 已卸载');
      }

      console.log('✅ 缓存已清除，即将刷新...');

      // 强制刷新
      setTimeout(() => {
        window.location.reload(true);
      }, 500);

    } catch (error) {
      console.error('❌ 清除缓存失败:', error);
      // 即使失败也尝试刷新
      window.location.reload(true);
    }
  }

  /**
   * 开始定期检查更新
   */
  startPeriodicCheck() {
    console.log(`⏰ 每 ${this.checkInterval / 1000} 秒检查一次更新`);

    setInterval(async () => {
      console.log('🔍 定期检查更新...');

      // PWA: 更新 Service Worker
      if (this.registration) {
        await this.registration.update();
      }

      // Server: 检查服务器版本
      await this.checkServerVersion();

    }, this.checkInterval);
  }

  /**
   * 手动检查更新
   */
  async checkUpdate() {
    console.log('🔍 手动检查更新...');

    if (this.registration) {
      await this.registration.update();
      console.log('✅ Service Worker 更新检查完成');
    }

    await this.checkServerVersion();
  }

  /**
   * 获取当前版本信息
   */
  getVersionInfo() {
    return {
      version: this.currentVersion,
      platform: Platform.info.platform,
      platformName: Platform.info.platformName,
      updateMethod: Platform.info.isCapacitor ? '在线更新' : 'Service Worker'
    };
  }
}

// 全局实例
window.UpdateManager = new UpdateManager();
