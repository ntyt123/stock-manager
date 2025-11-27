/**
 * Capacitor 桥接模块
 * 提供统一的原生功能 API，自动适配不同平台
 */

class CapacitorBridge {
  constructor() {
    this.plugins = {};
    this.isReady = false;
    this.init();
  }

  async init() {
    console.log('🔌 初始化 Capacitor 桥接...');

    if (Platform.info.isCapacitor) {
      await this.loadPlugins();
      this.setupEventListeners();
    }

    this.isReady = true;
    console.log('✅ Capacitor 桥接就绪');
  }

  /**
   * 加载 Capacitor 插件
   */
  async loadPlugins() {
    try {
      // 从全局 Capacitor 对象获取插件
      if (window.Capacitor && window.Capacitor.Plugins) {
        this.plugins = window.Capacitor.Plugins;
        console.log('✅ Capacitor 插件已加载');

        // 配置状态栏（Android）
        if (this.plugins.StatusBar) {
          await this.plugins.StatusBar.setBackgroundColor({ color: '#2196F3' });
          await this.plugins.StatusBar.setStyle({ style: 'DARK' });
        }

        // 隐藏启动屏幕
        if (this.plugins.SplashScreen) {
          setTimeout(() => {
            this.plugins.SplashScreen.hide();
          }, 1000);
        }
      }
    } catch (error) {
      console.warn('⚠️ Capacitor 插件加载失败:', error);
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 应用状态监听
    if (this.plugins.App) {
      this.plugins.App.addListener('appStateChange', ({ isActive }) => {
        console.log(`📱 应用状态: ${isActive ? '前台' : '后台'}`);
        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('app-state-change', { detail: { isActive } }));
      });

      this.plugins.App.addListener('appUrlOpen', (data) => {
        console.log('🔗 打开 URL:', data.url);
        // 处理深度链接
      });
    }

    // 网络状态监听
    if (this.plugins.Network) {
      this.plugins.Network.addListener('networkStatusChange', (status) => {
        console.log('📶 网络状态:', status);
        window.dispatchEvent(new CustomEvent('network-status-change', { detail: status }));
      });
    }
  }

  /**
   * 通知 - 统一接口
   * @param {string} title 标题
   * @param {string} message 消息内容
   * @param {object} options 额外选项
   */
  async notify(title, message, options = {}) {
    try {
      if (Platform.info.isCapacitor && this.plugins.LocalNotifications) {
        // APK：使用原生本地通知
        const permission = await this.plugins.LocalNotifications.checkPermissions();

        if (permission.display === 'granted' || permission.display === 'prompt') {
          await this.plugins.LocalNotifications.schedule({
            notifications: [{
              title,
              body: message,
              id: Date.now(),
              sound: 'default',
              ...options
            }]
          });
          return true;
        } else {
          console.warn('⚠️ 通知权限未授予');
          return false;
        }
      } else if (Platform.info.supportsNotifications) {
        // PWA/Web：使用 Web Notification API
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body: message,
            icon: '/images/icon-192.png',
            badge: '/images/icon-192.png',
            ...options
          });
          return true;
        } else if (Notification.permission !== 'denied') {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            return this.notify(title, message, options);
          }
        }
        return false;
      } else {
        // 降级：使用 alert
        alert(`${title}\n\n${message}`);
        return true;
      }
    } catch (error) {
      console.error('❌ 通知发送失败:', error);
      return false;
    }
  }

  /**
   * 文件下载 - 统一接口
   * @param {Blob} blob 文件内容
   * @param {string} filename 文件名
   */
  async downloadFile(blob, filename) {
    try {
      if (Platform.info.isCapacitor && this.plugins.Filesystem) {
        // APK：保存到手机存储
        const base64 = await this.blobToBase64(blob);

        const result = await this.plugins.Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: 'DOCUMENTS'
        });

        console.log('✅ 文件已保存:', result.uri);
        await this.notify('下载成功', `文件已保存: ${filename}`);
        return result.uri;

      } else {
        // PWA/Web：浏览器下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return url;
      }
    } catch (error) {
      console.error('❌ 文件下载失败:', error);
      throw error;
    }
  }

  /**
   * 分享 - 统一接口
   * @param {object} data 分享数据 { title, text, url }
   */
  async share(data) {
    try {
      if (Platform.info.isCapacitor && this.plugins.Share) {
        // APK：使用原生分享
        await this.plugins.Share.share({
          title: data.title,
          text: data.text,
          url: data.url,
          dialogTitle: '分享到'
        });
        return true;

      } else if (navigator.share) {
        // PWA/Web：使用 Web Share API
        await navigator.share(data);
        return true;

      } else {
        // 降级：复制到剪贴板
        const textToCopy = data.text || data.url || data.title;
        await navigator.clipboard.writeText(textToCopy);
        alert('内容已复制到剪贴板！');
        return true;
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('❌ 分享失败:', error);
      }
      return false;
    }
  }

  /**
   * Toast 提示 - 统一接口
   * @param {string} message 提示信息
   * @param {string} duration 'short' | 'long'
   */
  async toast(message, duration = 'short') {
    try {
      if (Platform.info.isCapacitor && this.plugins.Toast) {
        // APK：使用原生 Toast
        await this.plugins.Toast.show({
          text: message,
          duration: duration
        });
      } else {
        // PWA/Web：使用自定义 Toast
        this.showWebToast(message, duration === 'long' ? 3000 : 2000);
      }
    } catch (error) {
      console.error('❌ Toast 显示失败:', error);
      // 降级到 console
      console.log('Toast:', message);
    }
  }

  /**
   * Web Toast 实现
   */
  showWebToast(message, duration) {
    // 创建 Toast 元素
    const toast = document.createElement('div');
    toast.className = 'web-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // 添加样式（如果还没有）
    if (!document.getElementById('webToastStyle')) {
      const style = document.createElement('style');
      style.id = 'webToastStyle';
      style.textContent = `
        .web-toast {
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 12px 24px;
          border-radius: 24px;
          font-size: 14px;
          z-index: 99999;
          animation: toastFadeIn 0.3s ease-out;
          max-width: 80%;
          text-align: center;
        }
        @keyframes toastFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toastFadeOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to { opacity: 0; transform: translateX(-50%) translateY(20px); }
        }
      `;
      document.head.appendChild(style);
    }

    // 自动移除
    setTimeout(() => {
      toast.style.animation = 'toastFadeOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * 震动 - 统一接口
   * @param {number} duration 震动时长（毫秒）
   */
  async vibrate(duration = 200) {
    try {
      if (Platform.info.isCapacitor && this.plugins.Haptics) {
        // APK：使用原生震动
        await this.plugins.Haptics.vibrate({ duration });
      } else if ('vibrate' in navigator) {
        // PWA/Web：使用 Vibration API
        navigator.vibrate(duration);
      }
    } catch (error) {
      console.error('❌ 震动失败:', error);
    }
  }

  /**
   * 返回键处理（仅 Android APK）
   * @param {function} callback 回调函数
   */
  onBackButton(callback) {
    if (Platform.info.isCapacitor && this.plugins.App) {
      this.plugins.App.addListener('backButton', (event) => {
        console.log('🔙 返回键按下');
        callback(event);
      });
    }
  }

  /**
   * 获取设备信息
   */
  async getDeviceInfo() {
    if (Platform.info.isCapacitor && this.plugins.Device) {
      return await this.plugins.Device.getInfo();
    }
    return {
      platform: Platform.info.platform,
      operatingSystem: Platform.info.os,
      model: 'Web Browser',
      manufacturer: 'Unknown'
    };
  }

  /**
   * 检查权限
   * @param {string} permission 权限名称
   */
  async checkPermission(permission) {
    if (Platform.info.isCapacitor) {
      // 根据权限类型检查
      switch (permission) {
        case 'notifications':
          if (this.plugins.LocalNotifications) {
            const result = await this.plugins.LocalNotifications.checkPermissions();
            return result.display === 'granted';
          }
          break;
        case 'camera':
          if (this.plugins.Camera) {
            const result = await this.plugins.Camera.checkPermissions();
            return result.camera === 'granted';
          }
          break;
      }
    }
    return false;
  }

  /**
   * 请求权限
   * @param {string} permission 权限名称
   */
  async requestPermission(permission) {
    if (Platform.info.isCapacitor) {
      switch (permission) {
        case 'notifications':
          if (this.plugins.LocalNotifications) {
            const result = await this.plugins.LocalNotifications.requestPermissions();
            return result.display === 'granted';
          }
          break;
        case 'camera':
          if (this.plugins.Camera) {
            const result = await this.plugins.Camera.requestPermissions();
            return result.camera === 'granted';
          }
          break;
      }
    } else if (permission === 'notifications' && Platform.info.supportsNotifications) {
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
    return false;
  }

  /**
   * 工具：Blob 转 Base64
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // 移除 data:xxx;base64, 前缀
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 打开外部链接
   * @param {string} url 链接地址
   */
  async openExternal(url) {
    if (Platform.info.isCapacitor && this.plugins.Browser) {
      await this.plugins.Browser.open({ url });
    } else {
      window.open(url, '_blank');
    }
  }
}

// 全局实例
window.Native = new CapacitorBridge();
