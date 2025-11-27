/**
 * 平台检测模块
 * 识别当前运行环境：浏览器、PWA、Capacitor APK
 */

class PlatformDetector {
  constructor() {
    this.info = this.detect();
    this.applyPlatformClass();
    this.log();
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
    const isWindows = /Windows/i.test(navigator.userAgent);
    const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/i.test(navigator.userAgent);

    // 确定平台类型
    let platform = 'web';
    if (isCapacitor) platform = 'app';
    else if (isPWA) platform = 'pwa';

    // 检测网络状态
    const isOnline = navigator.onLine;

    return {
      // 平台类型
      isCapacitor,
      isPWA,
      isBrowser,
      platform,
      platformName: this.getPlatformName(platform),

      // 设备类型
      isMobile,
      isDesktop: !isMobile,

      // 操作系统
      isAndroid,
      isIOS,
      isWindows,
      isMac,
      os: this.getOS(),

      // 功能支持
      canInstallPWA: isBrowser && isMobile && !isIOS, // iOS 安装方式不同
      canShowAppDownload: isBrowser && isAndroid,
      supportsNative: isCapacitor,
      supportsServiceWorker: 'serviceWorker' in navigator,
      supportsNotifications: 'Notification' in window,
      supportsShare: 'share' in navigator || isCapacitor,

      // 网络状态
      isOnline,

      // 浏览器信息
      userAgent: navigator.userAgent,
      language: navigator.language || navigator.userLanguage,

      // 屏幕信息
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1
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

  getOS() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua)) return 'macOS';
    return 'Unknown';
  }

  applyPlatformClass() {
    const body = document.body;

    // 如果body还不存在，等待DOM加载完成
    if (!body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.applyPlatformClass());
      }
      return;
    }

    // 添加平台类名
    body.classList.add(`platform-${this.info.platform}`);

    // 添加设备类名
    if (this.info.isMobile) body.classList.add('mobile');
    if (this.info.isDesktop) body.classList.add('desktop');

    // 添加操作系统类名
    if (this.info.isAndroid) body.classList.add('android');
    else if (this.info.isIOS) body.classList.add('ios');
    else if (this.info.isWindows) body.classList.add('windows');
    else if (this.info.isMac) body.classList.add('mac');

    // 添加网络状态类名
    if (this.info.isOnline) {
      body.classList.add('online');
      body.classList.remove('offline');
    } else {
      body.classList.add('offline');
      body.classList.remove('online');
    }

    // 监听网络状态变化
    window.addEventListener('online', () => {
      body.classList.add('online');
      body.classList.remove('offline');
      console.log('📶 网络已连接');
    });

    window.addEventListener('offline', () => {
      body.classList.add('offline');
      body.classList.remove('online');
      console.log('📴 网络已断开');
    });
  }

  log() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║          平台检测信息                   ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ 运行平台: ${this.info.platformName.padEnd(27)}║`);
    console.log(`║ 操作系统: ${this.info.os.padEnd(27)}║`);
    console.log(`║ 设备类型: ${(this.info.isMobile ? '移动设备' : '桌面设备').padEnd(27)}║`);
    console.log(`║ 网络状态: ${(this.info.isOnline ? '在线' : '离线').padEnd(27)}║`);
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ PWA 安装: ${(this.info.canInstallPWA ? '✅ 支持' : '❌ 不支持').padEnd(26)}║`);
    console.log(`║ APK 下载: ${(this.info.canShowAppDownload ? '✅ 支持' : '❌ 不支持').padEnd(26)}║`);
    console.log(`║ 原生功能: ${(this.info.supportsNative ? '✅ 支持' : '❌ 不支持').padEnd(26)}║`);
    console.log(`║ 通知功能: ${(this.info.supportsNotifications ? '✅ 支持' : '❌ 不支持').padEnd(26)}║`);
    console.log('╚════════════════════════════════════════╝');
  }

  /**
   * 刷新平台信息
   */
  refresh() {
    this.info = this.detect();
    this.applyPlatformClass();
  }
}

// 全局实例
window.Platform = new PlatformDetector();
