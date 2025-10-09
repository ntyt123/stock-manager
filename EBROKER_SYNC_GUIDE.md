# 光大证券持仓数据同步指南 (easytrader)

## 📋 方案概述

本方案使用 **easytrader** Python 库通过同花顺/大智慧等第三方客户端自动获取光大证券的持仓数据，并同步到系统数据库中。

## ⚠️ 重要说明

1. **光大证券未在 easytrader 官方支持列表中**，需要通过"通用客户端"模式使用
2. **需要安装第三方交易软件**（同花顺/大智慧/通达信）
3. **首次使用需要手动登录**，建议在客户端中保存密码
4. **本方案属于实验性质**，稳定性可能不如官方 API

## 🚀 快速开始

### 步骤 1: 安装 Python 环境

确保您的系统已安装 Python 3.7+：

```bash
python --version
```

如果未安装，请前往 [Python 官网](https://www.python.org/downloads/) 下载安装。

### 步骤 2: 安装 easytrader

```bash
pip install easytrader
```

或使用国内镜像加速：

```bash
pip install easytrader -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 步骤 3: 安装第三方交易客户端

下载并安装以下客户端之一：

- **同花顺** (推荐): https://www.10jqka.com.cn/
- **大智慧**: http://www.gw.com.cn/
- **通达信**: http://www.tdx.com.cn/

安装后，使用光大证券账号登录一次，**确保勾选"保存密码"**。

### 步骤 4: 创建配置文件

在项目根目录运行：

```bash
python ebroker_sync.py init
```

这将创建 `account.json` 配置文件模板。

### 步骤 5: 编辑配置文件

打开 `account.json`，填入您的账户信息：

```json
{
  "broker": "universal",
  "account": "您的资金账号",
  "password": "您的交易密码",
  "exe_path": "C:\\同花顺\\xiadan.exe",
  "注释": {
    "broker": "券商类型，光大证券使用 universal",
    "account": "您的资金账号",
    "password": "交易密码",
    "exe_path": "同花顺客户端路径，例如: C:\\同花顺\\xiadan.exe"
  }
}
```

**配置说明：**

- `broker`: 固定为 `"universal"` (通用客户端)
- `account`: 您的光大证券资金账号
- `password`: 交易密码
- `exe_path`: 同花顺客户端的可执行文件路径
  - Windows 默认路径通常为: `C:\同花顺\xiadan.exe`
  - 如果使用大智慧或通达信，请修改为对应路径

### 步骤 6: 测试同步

在命令行测试同步功能：

```bash
python ebroker_sync.py sync
```

**预期输出：**

```
==================================================
  光大证券持仓数据同步工具 (基于 easytrader)
==================================================
✅ 配置文件加载成功
   券商: universal
   账号: 您的账号

🔗 正在连接券商...
   请在弹出的同花顺窗口中手动登录...
✅ 连接成功

📊 正在获取持仓数据...
✅ 获取到 5 个持仓
   600036 招商银行: ¥50000.00 (+2000.00)
   000858 五粮液: ¥30000.00 (-500.00)
   ...

==================================================
📈 同步完成!
   持仓股票: 5 只
   总市值: ¥150,000.00
==================================================
```

如果成功，将在当前目录生成 `positions_sync.json` 文件。

## 🌐 通过 Web 界面同步

### 方式 1: 使用 API 接口

发送 POST 请求到同步接口：

```bash
curl -X POST http://localhost:3000/api/positions/sync-ebroker \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### 方式 2: 前端页面调用 (需要前端开发)

在您的前端页面添加"从券商同步"按钮：

```javascript
async function syncFromBroker() {
  try {
    const response = await fetch('/api/positions/sync-ebroker', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      alert(`同步成功! 共同步 ${result.data.summary.positionCount} 个持仓`);
      // 刷新持仓列表
      loadPositions();
    } else {
      alert(`同步失败: ${result.error}`);
    }
  } catch (error) {
    alert(`同步失败: ${error.message}`);
  }
}
```

## 📖 Python 脚本命令

```bash
# 查看支持的券商
python ebroker_sync.py list

# 创建配置文件模板
python ebroker_sync.py init

# 同步持仓数据（使用默认配置文件 account.json）
python ebroker_sync.py sync

# 使用指定配置文件同步
python ebroker_sync.py sync my_account.json
```

## 🔧 常见问题

### 1. 提示"easytrader 未安装"

**解决方案：**
```bash
pip install easytrader -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 2. 提示"连接券商失败"

**可能原因：**
- 客户端路径配置错误
- 客户端未安装或版本不兼容
- 客户端被防火墙拦截

**解决方案：**
1. 检查 `exe_path` 路径是否正确
2. 手动打开客户端，确认可以正常启动
3. 关闭防火墙或添加客户端到白名单

### 3. 提示"未获取到持仓数据"

**可能原因：**
- 账户确实无持仓
- 登录失败
- 客户端界面未正确识别

**解决方案：**
1. 确认账户中有持仓
2. 手动登录客户端一次，勾选"保存密码"
3. 检查客户端版本是否过旧

### 4. 获取的数据不准确

**说明：**
easytrader 依赖于客户端界面元素识别，客户端更新可能导致识别失败。

**解决方案：**
1. 更新 easytrader 到最新版: `pip install --upgrade easytrader`
2. 使用方案一（手动导出 Excel）作为备选

### 5. 同步速度慢

**说明：**
easytrader 需要启动客户端并模拟操作，速度较慢是正常现象。

**优化建议：**
- 保持客户端在后台运行
- 减少同步频率，建议每天同步 1-2 次

## 🔒 安全建议

1. **配置文件安全**
   - `account.json` 包含敏感信息，请妥善保管
   - 不要将配置文件提交到 Git 仓库
   - 建议将 `account.json` 添加到 `.gitignore`

2. **密码安全**
   - 建议在客户端中保存密码，避免在配置文件中明文存储
   - 定期修改交易密码

3. **网络安全**
   - 仅在可信网络环境下使用
   - 不建议在公共网络或他人电脑上运行

## 📊 数据格式

同步的持仓数据格式：

```json
{
  "success": true,
  "data": [
    {
      "stockCode": "600036",
      "stockName": "招商银行",
      "quantity": 1000,
      "costPrice": 45.50,
      "currentPrice": 47.50,
      "marketValue": 47500.00,
      "profitLoss": 2000.00,
      "profitLossRate": 4.40
    }
  ],
  "summary": {
    "totalStocks": 5,
    "totalMarketValue": 150000.00,
    "syncTime": "2025-10-09T10:30:00.000Z"
  }
}
```

## 🆚 方案对比

| 特性 | 方案二 (easytrader) | 方案一 (Excel导入) | 方案一 (官方API) |
|------|---------------------|-------------------|------------------|
| **实时性** | 高 | 低 | 高 |
| **自动化程度** | 中 | 低 | 高 |
| **稳定性** | 中 | 高 | 高 |
| **配置难度** | 中 | 低 | 高 |
| **维护成本** | 中 | 低 | 低 |
| **安全性** | 中 | 高 | 高 |
| **推荐指数** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

## 💡 最佳实践

1. **混合使用**
   - 日常使用：Excel 手动导入（稳定可靠）
   - 定期自动化：easytrader 自动同步（配合定时任务）
   - 长期目标：申请官方 API（最稳定方案）

2. **定时同步**
   - 建议同步时间：每个交易日收盘后（15:30 - 16:00）
   - 可使用系统定时任务或 cron 自动执行

3. **数据备份**
   - 定期导出持仓数据备份
   - 保留历史 Excel 文件作为备份

## 📞 技术支持

如遇到问题，请按以下顺序排查：

1. 查看本文档的"常见问题"部分
2. 查看 Python 脚本的详细错误输出
3. 查看 easytrader GitHub Issues: https://github.com/shidenggui/easytrader/issues
4. 联系系统管理员

## 🔗 相关链接

- easytrader GitHub: https://github.com/shidenggui/easytrader
- easytrader 文档: https://github.com/shidenggui/easytrader/blob/master/README.md
- 同花顺官网: https://www.10jqka.com.cn/
- Python 官网: https://www.python.org/

---

**最后更新**: 2025-10-09
**适用版本**: stock-manager v1.0.0
**easytrader 版本**: 推荐 0.25.0+
