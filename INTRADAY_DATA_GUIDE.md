# A股分时数据实时获取完整方案

## ✅ 实施状态

**最后更新**: 2025-10-09
**实施状态**: ✅ 已完成并测试通过

### 已实现功能

✅ **分时数据 API 接口** (`GET /api/stock/intraday/:stockCode`)
- 基于新浪财经 API
- 支持 5/15/30/60 分钟周期
- 支持上海和深圳市场
- 返回标准 OHLCV 格式数据
- 已集成到 server.js (第1117-1205行)
- 测试通过：招商银行(600036)、五粮液(000858)

### 测试结果

```bash
# 5分钟数据测试
✅ GET /api/stock/intraday/600036?period=5&limit=5
返回: 5条数据，格式正确

# 15分钟数据测试
✅ GET /api/stock/intraday/000858?period=15&limit=3
返回: 3条数据，格式正确
```

### 快速开始

```bash
# 获取招商银行最近100条5分钟K线数据
curl "http://localhost:3000/api/stock/intraday/600036?period=5&limit=100"

# 获取五粮液最近50条15分钟K线数据
curl "http://localhost:3000/api/stock/intraday/000858?period=15&limit=50"
```

---

## 📋 目录

1. [方案概览](#方案概览)
2. [免费接口方案](#免费接口方案)
3. [技术实现](#技术实现)
4. [接口对比](#接口对比)
5. [使用示例](#使用示例)
6. [注意事项](#注意事项)

---

## 方案概览

### 什么是分时数据？

**分时数据**是指股票在交易日内按时间间隔（如1分钟、5分钟）统计的行情数据，包括：
- 开盘价、收盘价、最高价、最低价
- 成交量、成交额
- 时间戳

### 应用场景

- ✅ 绘制分时图（K线图）
- ✅ 实时监控股票价格变化
- ✅ 量化交易策略回测
- ✅ 技术指标计算（MACD、KDJ等）
- ✅ 盘中异动监控

---

## 免费接口方案

### 方案对比

| 方案 | 时间粒度 | 实时性 | 稳定性 | 限制 | 推荐指数 |
|------|----------|--------|--------|------|----------|
| **新浪财经** | 实时Tick | 秒级更新 | ⭐⭐⭐⭐ | 无明显限制 | ⭐⭐⭐⭐⭐ |
| **腾讯财经** | 1/5/15/30/60分钟 | 分钟级 | ⭐⭐⭐⭐⭐ | 无明显限制 | ⭐⭐⭐⭐⭐ |
| **东方财富** | 1/5/15/30/60分钟 | 分钟级 | ⭐⭐⭐⭐ | 频率限制 | ⭐⭐⭐⭐ |
| **麦蕊智数** | 5/15/30/60分钟 | 分钟级 | ⭐⭐⭐ | 需注册 | ⭐⭐⭐ |
| **AkShare** | 1/5/15/30/60分钟 | 分钟级 | ⭐⭐⭐⭐ | Python库 | ⭐⭐⭐⭐ |

---

## 方案一：新浪财经 - 实时Tick数据（推荐）

### 📌 特点

- ✅ **完全免费**：无需注册，无调用限制
- ✅ **实时更新**：交易时间内实时更新（秒级）
- ✅ **数据丰富**：包含当前价、涨跌幅、成交量等
- ✅ **已集成**：您的系统已在使用

### 🔧 API 说明

```javascript
// 单个股票
GET https://hq.sinajs.cn/list=sh600036

// 批量获取（逗号分隔）
GET https://hq.sinajs.cn/list=sh600036,sz000858,sh601318

// 市场代码规则
// sh = 上海（6开头的股票）
// sz = 深圳（0/3开头的股票）
```

### 📊 返回数据格式

```javascript
var hq_str_sh600036="招商银行,47.50,47.80,47.60,47.90,47.40,47.50,47.52,12345678,587654321,100,47.50,200,47.49,300,47.48,400,47.47,500,47.46,100,47.52,200,47.53,300,47.54,400,47.55,500,47.56,2025-01-09,15:00:00,00";

// 数据字段说明：
// 0: 股票名称
// 1: 今日开盘价
// 2: 昨日收盘价
// 3: 当前价格
// 4: 今日最高价
// 5: 今日最低价
// 6: 买一价
// 7: 卖一价
// 8: 成交股数
// 9: 成交金额
// 10-29: 买卖五档
// 30: 日期
// 31: 时间
```

### ✅ 您的系统已实现

```javascript
// server.js:973
app.get('/api/stock/quote/:stockCode', async (req, res) => {
    const sinaUrl = `https://hq.sinajs.cn/list=${fullCode}`;
    // ... 已实现实时行情获取
});
```

---

## 方案二：腾讯财经 - 分钟K线数据（强烈推荐）

### 📌 特点

- ✅ **完全免费**：无需注册
- ✅ **多种周期**：支持 1/5/15/30/60 分钟
- ✅ **历史数据**：可获取历史分时数据
- ✅ **数据完整**：开高低收量齐全
- ✅ **已集成**：您的系统已在使用（日线）

### 🔧 API 说明

```javascript
// API 地址
GET https://web.ifzq.gtimg.cn/appstock/app/fqkline/get

// 参数说明
param={股票代码},{周期},{起始日期},{结束日期},{数量},{复权类型}

// 周期类型
- day: 日线
- week: 周线
- month: 月线
- m1: 1分钟
- m5: 5分钟
- m15: 15分钟
- m30: 30分钟
- m60: 60分钟

// 复权类型
- qfq: 前复权
- hfq: 后复权
- (空): 不复权

// 示例：获取招商银行最近100个5分钟K线
https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600036,m5,,,100,qfq
```

### 📊 返回数据格式

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "sh600036": {
      "qt": {
        "sh600036": ["招商银行", "600036", ...]
      },
      "mx1440": [],  // 1分钟
      "mx300": [],   // 5分钟
      "mx900": [],   // 15分钟
      "mx1800": [],  // 30分钟
      "mx3600": [],  // 60分钟
      "m5": [        // 5分钟数据
        ["2025010909:35", "47.50", "47.60", "47.40", "47.55", "123456"],
        // [时间, 开盘, 收盘, 最高, 最低, 成交量]
      ]
    }
  }
}
```

### ✅ 扩展实现（基于现有代码）

您的系统已有日线数据获取，只需修改周期参数即可获取分时数据。

---

## 方案三：东方财富 - 分钟数据

### 📌 特点

- ✅ 数据准确：官方数据源
- ⚠️ 有频率限制：过于频繁会被限制
- ✅ 支持多周期：1/5/15/30/60分钟

### 🔧 API 说明

```javascript
// 分时数据接口
GET http://push2his.eastmoney.com/api/qt/stock/kline/get

// 参数
secid: 市场.股票代码（1.000858 或 0.600036）
       0 = 深圳，1 = 上海
klt: 时间周期
     1 = 1分钟
     5 = 5分钟
     15 = 15分钟
     30 = 30分钟
     60 = 60分钟
     101 = 日线
fqt: 复权类型（0=不复权，1=前复权，2=后复权）
lmt: 返回数量

// 示例：获取招商银行5分钟数据
http://push2his.eastmoney.com/api/qt/stock/kline/get?secid=0.600036&klt=5&fqt=1&lmt=100
```

---

## 方案四：AkShare - Python库（开发推荐）

### 📌 特点

- ✅ **开源免费**：Python库
- ✅ **功能强大**：支持多种数据源
- ✅ **易于使用**：简洁的API
- ⚠️ **需要Python**：需要Python环境

### 🔧 使用示例

```python
import akshare as ak

# 获取股票分时数据（1分钟）
df = ak.stock_zh_a_hist_min_em(
    symbol="600036",
    period="1",      # 1/5/15/30/60
    adjust="qfq",    # 前复权
    start_date="2025-01-09 09:30:00",
    end_date="2025-01-09 15:00:00"
)

print(df)
#           时间     开盘    收盘    最高    最低    成交量    成交额
# 2025-01-09 09:31  47.50  47.55  47.60  47.48  12345  5867543
# 2025-01-09 09:32  47.55  47.52  47.58  47.50  23456  11234567
# ...
```

---

## 技术实现

### ✅ 已实现：分时数据 API

**状态**: 已成功实现并测试通过 ✓

**接口地址**: `GET /api/stock/intraday/:stockCode`

**接口说明**:
- 基于新浪财经API
- 支持多种时间周期（5/15/30/60 分钟）
- 返回标准格式的 OHLCV 数据

**使用示例**:
```bash
# 获取招商银行5分钟分时数据
curl "http://localhost:3000/api/stock/intraday/600036?period=5&limit=100"

# 获取五粮液15分钟分时数据
curl "http://localhost:3000/api/stock/intraday/000858?period=15&limit=50"
```

**参数说明**:
- `stockCode`: 股票代码（6位数字）
- `period`: 时间周期（可选值：5, 15, 30, 60），默认5分钟
- `limit`: 返回数据条数，默认100条

**返回格式**:
```json
{
  "success": true,
  "data": {
    "stockCode": "600036",
    "stockName": "招商银行",
    "period": "5",
    "count": 100,
    "intraday": [
      {
        "time": "2025-10-09 14:45:00",
        "open": 40.36,
        "high": 40.38,
        "low": 40.35,
        "close": 40.36,
        "volume": 1274700
      }
    ]
  }
}
```

---

### 方法一：扩展现有 API（已实现）

以下是 `server.js` 中的实现代码：

```javascript
// 获取股票分时数据（分钟K线）
// 位置: server.js 第1117-1205行
app.get('/api/stock/intraday/:stockCode', async (req, res) => {
    try {
        const { stockCode } = req.params;
        const { period = '5', limit = 100 } = req.query;

        console.log(`📊 获取 ${stockCode} 的 ${period} 分钟分时数据`);

        // 判断股票市场
        const market = stockCode.startsWith('6') ? 'sh' : 'sz';
        const fullCode = `${market}${stockCode}`;

        // 周期映射
        const periodMap = {
            '1': '1',      // 1分钟（可能不稳定）
            '5': '5',      // 5分钟
            '15': '15',    // 15分钟
            '30': '30',    // 30分钟
            '60': '60',    // 60分钟（1小时）
            '240': '240'   // 240分钟（日线）
        };

        const scale = periodMap[period] || '5';

        // 使用新浪财经API获取分时数据
        const sinaUrl = `http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${fullCode}&scale=${scale}&datalen=${limit}`;

        const response = await axios.get(sinaUrl, {
            headers: {
                'Referer': 'https://finance.sina.com.cn'
            },
            timeout: 10000
        });

        // 检查响应
        if (!response.data || response.data === 'null' || (Array.isArray(response.data) && response.data.length === 0)) {
            return res.status(404).json({
                success: false,
                error: '未找到分时数据（可能当前无交易或数据源暂无此周期数据）'
            });
        }

        // 解析并格式化数据
        const intradayData = response.data;
        const formattedData = intradayData.map(item => ({
            time: item.day,                    // 时间
            open: parseFloat(item.open),       // 开盘价
            high: parseFloat(item.high),       // 最高价
            low: parseFloat(item.low),         // 最低价
            close: parseFloat(item.close),     // 收盘价
            volume: parseInt(item.volume)      // 成交量
        }));

        // 获取股票名称（从实时行情）
        let stockName = '';
        try {
            const cached = stockCache.getQuote(stockCode);
            if (cached) {
                stockName = cached.stockName;
            }
        } catch (e) {
            // 忽略错误
        }

        const result = {
            stockCode: stockCode,
            stockName: stockName,
            period: period,
            scale: scale,
            count: formattedData.length,
            intraday: formattedData
        };

        console.log(`✅ 获取到 ${formattedData.length} 条 ${period} 分钟数据`);

        res.json({
            success: true,
            data: result,
            cached: false
        });

    } catch (error) {
        console.error('获取分时数据错误:', error.message);
        res.status(500).json({
            success: false,
            error: '获取分时数据失败: ' + error.message
        });
    }
});
```

**实现说明**:
- ✅ 已集成到 server.js
- ✅ 使用新浪财经 API（测试验证可用）
- ✅ 支持上海和深圳市场
- ✅ 返回标准 JSON 格式
- ✅ 包含完整的 OHLCV 数据

### 方法二：使用实时Tick数据生成分时图

```javascript
// 获取实时分时数据（当日分时走势）
app.get('/api/stock/today-tick/:stockCode', async (req, res) => {
    try {
        const { stockCode } = req.params;

        // 使用新浪财经获取实时数据
        const market = stockCode.startsWith('6') ? 'sh' : 'sz';
        const fullCode = `${market}${stockCode}`;

        // 获取当日分时数据（需要新浪的分时接口）
        const sinaUrl = `https://hq.sinajs.cn/rn=${Date.now()}&list=${fullCode}`;

        const response = await axios.get(sinaUrl, {
            headers: {
                'Referer': 'https://finance.sina.com.cn'
            },
            timeout: 5000,
            responseType: 'arraybuffer'
        });

        const data = iconv.decode(Buffer.from(response.data), 'gbk');

        // 解析实时数据
        const match = data.match(/="(.+)"/);
        if (!match || !match[1]) {
            return res.status(404).json({
                success: false,
                error: '未找到实时数据'
            });
        }

        const values = match[1].split(',');

        res.json({
            success: true,
            data: {
                stockCode: stockCode,
                stockName: values[0],
                currentPrice: parseFloat(values[3]),
                yesterdayClose: parseFloat(values[2]),
                time: `${values[30]} ${values[31]}`,
                change: parseFloat(values[3]) - parseFloat(values[2]),
                changePercent: ((parseFloat(values[3]) - parseFloat(values[2])) / parseFloat(values[2]) * 100).toFixed(2)
            }
        });

    } catch (error) {
        console.error('获取实时数据错误:', error.message);
        res.status(500).json({
            success: false,
            error: '获取实时数据失败'
        });
    }
});
```

### 方法三：Python 脚本获取（使用 AkShare）

```python
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
获取股票分时数据
"""

import sys
import json
import akshare as ak
from datetime import datetime, timedelta

def get_intraday_data(stock_code, period='5', days=1):
    """
    获取分时数据

    Args:
        stock_code: 股票代码（不带市场前缀）
        period: 周期（1/5/15/30/60分钟）
        days: 获取天数
    """
    try:
        # 计算日期范围
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        # 获取分时数据
        df = ak.stock_zh_a_hist_min_em(
            symbol=stock_code,
            period=period,
            adjust="qfq",
            start_date=start_date.strftime("%Y-%m-%d 09:30:00"),
            end_date=end_date.strftime("%Y-%m-%d 15:00:00")
        )

        # 转换为JSON格式
        data = []
        for index, row in df.iterrows():
            data.append({
                'time': row['时间'],
                'open': float(row['开盘']),
                'close': float(row['收盘']),
                'high': float(row['最高']),
                'low': float(row['最低']),
                'volume': int(row['成交量']),
                'amount': float(row['成交额'])
            })

        result = {
            'success': True,
            'data': {
                'stockCode': stock_code,
                'period': period,
                'count': len(data),
                'intraday': data
            }
        }

        # 输出JSON
        print(json.dumps(result, ensure_ascii=False))
        return result

    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_result, ensure_ascii=False))
        return None

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python get_intraday.py <股票代码> [周期] [天数]")
        print("示例: python get_intraday.py 600036 5 1")
        sys.exit(1)

    stock_code = sys.argv[1]
    period = sys.argv[2] if len(sys.argv) > 2 else '5'
    days = int(sys.argv[3]) if len(sys.argv) > 3 else 1

    get_intraday_data(stock_code, period, days)
```

---

## 使用示例

### 前端调用示例

```javascript
// 获取5分钟分时数据
async function getIntradayData(stockCode, period = '5') {
    try {
        const response = await fetch(
            `/api/stock/intraday/${stockCode}?period=${period}&limit=100`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const result = await response.json();

        if (result.success) {
            console.log(`获取到 ${result.data.count} 条分时数据`);

            // 绘制K线图
            drawCandlestickChart(result.data.intraday);

            // 或者显示在表格中
            displayIntradayTable(result.data.intraday);
        }

    } catch (error) {
        console.error('获取分时数据失败:', error);
    }
}

// 绘制K线图示例（使用 ECharts）
function drawCandlestickChart(data) {
    const option = {
        title: {
            text: '股票分时K线图'
        },
        xAxis: {
            data: data.map(item => item.time)
        },
        yAxis: {},
        series: [{
            type: 'candlestick',
            data: data.map(item => [
                item.open,
                item.close,
                item.low,
                item.high
            ])
        }]
    };

    // 渲染到图表
    echarts.init(document.getElementById('chart')).setOption(option);
}
```

### 定时刷新实时数据

```javascript
// 每10秒刷新一次实时价格
let refreshTimer = null;

function startRealTimeMonitor(stockCode) {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }

    // 立即执行一次
    updateRealTimePrice(stockCode);

    // 每10秒更新一次
    refreshTimer = setInterval(() => {
        updateRealTimePrice(stockCode);
    }, 10000);
}

async function updateRealTimePrice(stockCode) {
    try {
        const response = await fetch(`/api/stock/quote/${stockCode}`);
        const result = await response.json();

        if (result.success) {
            const data = result.data;

            // 更新页面显示
            document.getElementById('current-price').textContent = data.currentPrice;
            document.getElementById('change-percent').textContent =
                `${data.change >= 0 ? '+' : ''}${data.changePercent}%`;

            // 更新颜色（红涨绿跌）
            const color = data.change >= 0 ? '#f5222d' : '#52c41a';
            document.getElementById('current-price').style.color = color;
        }

    } catch (error) {
        console.error('更新实时价格失败:', error);
    }
}

// 停止监控
function stopRealTimeMonitor() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}
```

---

## 接口对比详解

### 数据源特性对比

| 特性 | 新浪财经 | 腾讯财经 | 东方财富 | AkShare |
|------|----------|----------|----------|---------|
| **注册要求** | 无 | 无 | 无 | 无 |
| **调用限制** | 宽松 | 宽松 | 较严格 | 无 |
| **数据延迟** | <1秒 | 1-5秒 | 1-5秒 | 1-5秒 |
| **历史数据** | 有限 | 丰富 | 丰富 | 丰富 |
| **数据准确性** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **接口稳定性** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **文档完善度** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### 推荐使用场景

```
┌─────────────────────────────────────────────┐
│ 实时监控（秒级更新）                          │
│ → 使用新浪财经实时接口                        │
│   GET /api/stock/quote/:stockCode           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 分时K线图（1/5/15/30/60分钟）                 │
│ → 使用腾讯财经分时接口                        │
│   GET /api/stock/intraday/:stockCode        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 量化策略开发                                  │
│ → 使用 AkShare Python 库                     │
│   df = ak.stock_zh_a_hist_min_em()          │
└─────────────────────────────────────────────┘
```

---

## 注意事项

### ⚠️ 交易时间限制

```
A股交易时间：
- 开盘集合竞价：09:15 - 09:25
- 连续竞价（上午）：09:30 - 11:30
- 连续竞价（下午）：13:00 - 15:00
- 收盘集合竞价：14:57 - 15:00

注意：
1. 非交易时间获取的是上一个交易日的收盘数据
2. 集合竞价时段数据可能不准确
3. 停牌股票无法获取实时数据
```

### ⚠️ 频率控制

```javascript
// 建议的请求频率
实时价格（Tick）：每10秒-30秒请求一次
1分钟K线：每1分钟请求一次
5分钟K线：每5分钟请求一次
日线数据：每日请求一次

// 避免被限制
- 不要并发大量请求
- 使用缓存减少重复请求
- 添加请求间隔（建议100ms以上）
```

### ⚠️ 数据准确性

```
1. 免费接口可能存在延迟（通常<5秒）
2. 分时数据仅供参考，以券商实际成交为准
3. 历史分时数据可能有缺失
4. 复权数据需要根据实际情况选择
```

### ⚠️ 法律合规

```
1. 仅用于个人学习和研究
2. 不得用于商业用途
3. 不得转售数据
4. 遵守数据源的使用条款
```

---

## 完整实现示例

### 创建分时数据服务模块

创建文件 `F:\Git\stock-manager\intradayService.js`:

```javascript
const axios = require('axios');
const iconv = require('iconv-lite');

class IntradayService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30秒缓存
    }

    /**
     * 获取股票分时K线数据
     * @param {string} stockCode - 股票代码
     * @param {string} period - 周期（1/5/15/30/60）
     * @param {number} limit - 数量限制
     */
    async getIntradayKline(stockCode, period = '5', limit = 100) {
        const cacheKey = `kline_${stockCode}_${period}_${limit}`;

        // 检查缓存
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.time < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const market = stockCode.startsWith('6') ? 'sh' : 'sz';
            const fullCode = `${market}${stockCode}`;

            const periodMap = {
                '1': 'm1',
                '5': 'm5',
                '15': 'm15',
                '30': 'm30',
                '60': 'm60'
            };

            const periodType = periodMap[period] || 'm5';

            const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${fullCode},${periodType},,,${limit},qfq`;

            const response = await axios.get(url, {
                headers: { 'Referer': 'https://gu.qq.com' },
                timeout: 10000
            });

            if (response.data.code !== 0 || !response.data.data || !response.data.data[fullCode]) {
                throw new Error('未找到分时数据');
            }

            const data = response.data.data[fullCode];
            const dataKey = `m${period}`;
            const rawData = data[dataKey] || [];

            const formattedData = rawData.map(item => ({
                time: item[0],
                open: parseFloat(item[1]),
                close: parseFloat(item[2]),
                high: parseFloat(item[3]),
                low: parseFloat(item[4]),
                volume: parseInt(item[5])
            }));

            const result = {
                stockCode,
                stockName: data.qt ? data.qt[fullCode][1] : '',
                period,
                count: formattedData.length,
                data: formattedData
            };

            // 缓存结果
            this.cache.set(cacheKey, {
                time: Date.now(),
                data: result
            });

            return result;

        } catch (error) {
            console.error(`获取分时数据失败 [${stockCode}]:`, error.message);
            throw error;
        }
    }

    /**
     * 获取实时价格
     * @param {string} stockCode - 股票代码
     */
    async getRealTimePrice(stockCode) {
        const cacheKey = `price_${stockCode}`;

        // 检查缓存（10秒）
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.time < 10000) {
                return cached.data;
            }
        }

        try {
            const market = stockCode.startsWith('6') ? 'sh' : 'sz';
            const fullCode = `${market}${stockCode}`;

            const url = `https://hq.sinajs.cn/list=${fullCode}`;

            const response = await axios.get(url, {
                headers: { 'Referer': 'https://finance.sina.com.cn' },
                timeout: 5000,
                responseType: 'arraybuffer'
            });

            const data = iconv.decode(Buffer.from(response.data), 'gbk');
            const match = data.match(/="(.+)"/);

            if (!match || !match[1]) {
                throw new Error('未找到实时数据');
            }

            const values = match[1].split(',');

            const result = {
                stockCode,
                stockName: values[0],
                currentPrice: parseFloat(values[3]),
                yesterdayClose: parseFloat(values[2]),
                change: parseFloat(values[3]) - parseFloat(values[2]),
                changePercent: ((parseFloat(values[3]) - parseFloat(values[2])) / parseFloat(values[2]) * 100).toFixed(2),
                time: `${values[30]} ${values[31]}`
            };

            // 缓存结果
            this.cache.set(cacheKey, {
                time: Date.now(),
                data: result
            });

            return result;

        } catch (error) {
            console.error(`获取实时价格失败 [${stockCode}]:`, error.message);
            throw error;
        }
    }

    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
    }
}

module.exports = new IntradayService();
```

---

## 总结

### ✅ 推荐方案

**综合推荐：腾讯财经API + 新浪财经API**

- **腾讯财经**：获取分时K线（1/5/15/30/60分钟）
- **新浪财经**：获取实时价格（秒级更新）

### 📝 实施步骤

1. ✅ 在 `server.js` 中添加分时数据接口
2. ✅ 创建 `intradayService.js` 模块
3. ✅ 前端添加分时图表组件
4. ✅ 实现实时监控功能

### 🎯 后续优化

- 添加 WebSocket 实现真正的实时推送
- 使用 Redis 缓存提升性能
- 实现分时数据的数据库存储
- 添加技术指标计算（MACD、KDJ、RSI等）

---

**最后更新**: 2025-01-09
**适用版本**: stock-manager v1.0.0
**测试状态**: 已验证可用
