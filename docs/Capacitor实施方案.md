# Capacitor 实施方案 - 生成真正的 APK 并支持热更新

## 🎯 方案概述

使用 Capacitor 将现有 Web 应用封装为 Android APK，并实现自托管热更新机制。

---

## 📦 安装依赖

```bash
# 安装 Capacitor CLI
npm install @capacitor/core @capacitor/cli

# 初始化 Capacitor
npx cap init "股票系统" "com.yourcompany.stockmanager" --web-dir=public

# 添加 Android 平台
npm install @capacitor/android
npx cap add android

# 安装热更新插件
npm install capacitor-updater
```

---

## 📝 配置文件修改

### 1. capacitor.config.json
```json
{
  "appId": "com.yourcompany.stockmanager",
  "appName": "股票系统",
  "webDir": "public",
  "bundledWebRuntime": false,
  "server": {
    "url": "https://your-domain.com",
    "cleartext": true
  },
  "plugins": {
    "CapacitorUpdater": {
      "autoUpdate": true,
      "updateUrl": "https://your-domain.com/api/app-updates/check"
    }
  }
}
```

### 2. 修改 server.js（添加热更新 API）
```javascript
// 添加版本检测��口
app.get('/api/app-updates/check', (req, res) => {
  const currentVersion = req.query.version;
  const latestVersion = '1.0.5'; // 可以从数据库读取

  if (currentVersion !== latestVersion) {
    res.json({
      version: latestVersion,
      url: 'https://your-domain.com/updates/latest.zip',
      notes: '修复了若干 BUG，优化了性能'
    });
  } else {
    res.json({ latest: true });
  }
});

// 提供更新包下载
app.use('/updates', express.static(path.join(__dirname, 'app-updates')));
```

### 3. 创建热更新逻辑（public/js/app-updater.js）
```javascript
import { CapacitorUpdater } from 'capacitor-updater';

async function checkForUpdates() {
  try {
    const response = await fetch('/api/app-updates/check?version=' + APP_VERSION);
    const data = await response.json();

    if (!data.latest) {
      console.log('发现新版本:', data.version);

      // 下载更新包
      const download = await CapacitorUpdater.download({
        url: data.url,
        version: data.version
      });

      // 提示用户
      if (confirm(`发现新版本 ${data.version}\n${data.notes}\n\n是否立即更新？`)) {
        await CapacitorUpdater.set({ id: download.id });
        window.location.reload();
      }
    }
  } catch (error) {
    console.error('检查更新失败:', error);
  }
}

// 每次启动时检查更新
if (window.Capacitor) {
  checkForUpdates();
}

// 每小时检查一次
setInterval(checkForUpdates, 3600000);
```

---

## 🔨 构建 APK

### 开发版本
```bash
# 同步代码到 Android 项目
npx cap sync

# 使用 Android Studio 打开项目
npx cap open android

# 或者使用命令行构建
cd android
./gradlew assembleDebug

# APK 输出路径：
# android/app/build/outputs/apk/debug/app-debug.apk
```

### 生产版本
```bash
cd android
./gradlew assembleRelease

# 需要配置签名：
# 编辑 android/app/build.gradle
signingConfigs {
    release {
        storeFile file("your-keystore.jks")
        storePassword "your-password"
        keyAlias "your-alias"
        keyPassword "your-password"
    }
}
```

---

## 🚀 热更新发布流程

### 1. 准备更新包
```bash
# 创建更新目录
mkdir -p app-updates

# 压缩需要更新的文件
cd public
zip -r ../app-updates/latest.zip \
  index.html \
  login.html \
  css/ \
  js/ \
  -x "*.map"

cd ..
```

### 2. 更新版本号
```javascript
// 在 public/js/config.js 中
const APP_VERSION = '1.0.5'; // 递增版本号
```

### 3. 部署到服务器
```bash
# 将 app-updates 目录上传到服务器
scp -r app-updates/ user@your-server:/path/to/stock-manager/
```

### 4. 用户自动更新
- 用户打开 APP
- 后台检测到新版本
- 自动下载更新包
- 提示用户重启应用
- **无需重新下载整个 APK**

---

## 📱 完整的热更新架构

```
┌─────────────────┐
│   用户打开 APP   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│ 检查版本更新 API │─────▶│ 后端返回版本 │
└────────┬────────┘      └──────────────┘
         │
         ▼
    有新版本？
         │
    ┌────┴────┐
    │   是    │   否 → 正常使用
    └────┬────┘
         │
         ▼
┌─────────────────┐
│ 下载更新包(.zip)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  解压并替换文件  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   重启应用生效   │
└─────────────────┘
```

---

## ⚡ 热更新 vs 应用商店更新对比

| 特性 | 热更新 | 应用商店 |
|------|--------|----------|
| 更新速度 | ⚡ 即时（分钟级） | 🐌 慢（需审核，数天） |
| 文件大小 | ✅ 小（仅变更文件） | ❌ 大（整个 APK） |
| 流量消耗 | ✅ 低（几 MB） | ❌ 高（几十 MB） |
| 用户操作 | ✅ 自动 | ❌ 需手动下载安装 |
| 可更新内容 | HTML/CSS/JS | 所有文件（含原生代码） |
| 限制 | ⚠️ 部分应用商店禁止 | 无限制 |

---

## 🎯 混合策略（推荐）

1. **小更新使用热更新**
   - UI 调整
   - 功能优化
   - BUG 修复

2. **大版本走应用商店**
   - 添加新的原生功能
   - 升级依赖库
   - 架构重构

---

## 🔐 安全性考虑

### 1. 更新包签名验证
```javascript
// 添加签名校验
async function verifyUpdate(zipFile, signature) {
  const hash = await calculateSHA256(zipFile);
  return hash === signature;
}

app.get('/api/app-updates/check', (req, res) => {
  res.json({
    version: '1.0.5',
    url: 'https://your-domain.com/updates/latest.zip',
    signature: 'sha256-hash-of-zip-file' // 防止篡改
  });
});
```

### 2. HTTPS 强制
```javascript
// capacitor.config.json
{
  "server": {
    "url": "https://your-domain.com",
    "cleartext": false // 禁止 HTTP
  }
}
```

---

## 📊 方案对比

| 功能 | PWA | Capacitor APK |
|------|-----|---------------|
| 安装方式 | 添加到主屏幕 | ✅ 真正的 APK |
| 应用商店 | ❌ 不支持 | ✅ 可上架 |
| 原生功能 | ⚠️ 有限 | ✅ 完整支持 |
| 热更新 | ✅ 100% 即时 | ✅ 自动下载 |
| 开发成本 | 🟢 低（1-2天） | 🟡 中（3-5天） |
| 维护成本 | 🟢 低 | 🟡 中 |

---

## ✅ 实施检查清单

- [ ] 安装 Capacitor CLI
- [ ] 添加 Android 平台
- [ ] 配置 capacitor.config.json
- [ ] 创建热更新 API
- [ ] 集成 capacitor-updater 插件
- [ ] 配置签名证书
- [ ] 构建 Release APK
- [ ] 测试热更新流程
- [ ] 部署到生产环境

---

## 🎯 预计工作量

- **初次配置**: 1 天
- **热更新集成**: 1-2 天
- **签名和打包**: 0.5 天
- **测试**: 1 天
- **总计**: 3-5 天

---

## 🚨 注意事项

1. **应用商店政策**
   - Google Play 允许热更新（仅限 Web 内容）
   - 华为/小米等国内应用商店可能有限制
   - 建议先咨询平台政策

2. **首次安装**
   - 用户需要从网站下载 APK 手动安装
   - 或者发布到应用商店

3. **版本管理**
   - 建议使用语义化版本（1.0.0）
   - 维护版本历史和回滚机制

---

## 📚 参考资源

- [Capacitor 官方文档](https://capacitorjs.com/)
- [capacitor-updater 插件](https://github.com/Cap-go/capacitor-updater)
- [Android 签名指南](https://developer.android.com/studio/publish/app-signing)
