# 光大证券程序化交易接口申请完整指南

## 📋 目录

1. [方案概览](#方案概览)
2. [方案一：QMT/Ptrade 量化交易系统](#方案一qmtptrade-量化交易系统-推荐)
3. [方案二：官方 API 接口](#方案二官方-api-接口)
4. [申请流程详解](#申请流程详解)
5. [费用说明](#费用说明)
6. [技术对接指南](#技术对接指南)
7. [常见问题](#常见问题)

---

## 方案概览

| 方案 | 资金门槛 | 费用 | 功能 | 适用对象 | 推荐指数 |
|------|----------|------|------|----------|----------|
| **QMT/Ptrade** | 50万元 | 免费 | 量化交易、条件单 | 个人投资者 | ⭐⭐⭐⭐⭐ |
| **官方 API** | 300万+ | 需咨询 | 完整 API 权限 | 机构/高净值 | ⭐⭐⭐⭐ |
| **Excel 导入** | 无 | 免费 | 手动同步 | 所有用户 | ⭐⭐⭐ |

---

## 方案一：QMT/Ptrade 量化交易系统 (推荐)

### 📌 方案介绍

QMT (Quantitative Mini Terminal) 和 Ptrade 是**迅投科技**开发的量化交易平台，光大证券支持这两个系统，为个人投资者提供**类API接口**的量化交易功能。

### ✅ 优势

- **资金门槛低**：仅需 50 万元（远低于官方 API 的 300 万）
- **免费使用**：满足资金要求即可免费开通
- **功能强大**：
  - 支持 Python 策略开发
  - 实时行情数据接口
  - 自动化交易下单
  - 条件单、网格交易
  - 回测系统
- **稳定可靠**：由券商官方支持，比第三方工具更稳定
- **文档完善**：有详细的 API 文档和示例代码

### 💰 费用说明

- **软件费用**：免费（满足 50 万资金要求）
- **交易佣金**：约万 2.5（可与客户经理协商更低）
- **数据费用**：Level-1 行情免费，Level-2 需付费

### 📋 申请条件

1. **资金要求**
   - 证券账户资产 ≥ 50 万元
   - 需保持在光大证券账户

2. **开户要求**
   - 已在光大证券开户
   - 账户状态正常

3. **风险评级**
   - 需完成风险测评
   - 具备一定的投资经验

### 🚀 申请流程

#### 第一步：联系光大证券客户经理

```
方式一：致电客服热线
- 电话：95525
- 说明：申请开通 QMT/Ptrade 量化交易权限
- 咨询：当前佣金费率、开通条件

方式二：联系客户经理
- 通过同花顺 APP 联系客户经理
- 或到光大证券营业部现场咨询
```

#### 第二步：准备申请材料

```
所需材料：
1. 身份证
2. 证券账户信息
3. 资金证明（账户余额截图）
4. 风险测评结果
```

#### 第三步：提交申请

```
提交方式：
- 线上：通过客户经理提交
- 线下：到营业部填写申请表

审核时间：
- 一般 1-3 个工作日
```

#### 第四步：下载安装

```
下载地址：
- QMT：https://www.xuntou.net/
- Ptrade：https://www.xuntou.net/

安装要求：
- Windows 7 及以上
- 4GB+ 内存
- 稳定的网络连接
```

#### 第五步：登录配置

```
登录信息：
- 使用光大证券账号登录
- 首次登录需完成初始化配置
- 设置策略运行环境
```

### 🔧 技术对接

#### Python API 示例

```python
# 1. 导入 QMT API
from xtquant import xtdata
from xtquant import xttrader

# 2. 连接账户
account = xttrader.StockAccount('您的资金账号')

# 3. 查询持仓
positions = account.query_stock_positions()
for pos in positions:
    print(f"股票代码: {pos.stock_code}")
    print(f"持仓数量: {pos.volume}")
    print(f"成本价: {pos.avg_price}")
    print(f"当前价: {pos.last_price}")
    print(f"盈亏: {pos.unrealized_pnl}")
    print("-" * 50)

# 4. 获取实时行情
quote = xtdata.get_market_data(['600036.SH'], period='1d')
print(f"招商银行当前价: {quote['close'][-1]}")

# 5. 下单交易
# 市价买入
order_id = account.order_stock(
    stock_code='600036.SH',
    order_type=xttrader.ORDER_TYPE_BUY,
    order_volume=100,
    price_type=xttrader.PRICE_TYPE_MARKET
)

# 6. 查询委托
orders = account.query_stock_orders()
print(f"委托订单: {orders}")
```

#### 与现有系统集成

```python
# 定时同步持仓到您的股票管理系统
import requests
import json

def sync_positions_to_system():
    """同步 QMT 持仓到股票管理系统"""

    # 1. 从 QMT 获取持仓
    positions = account.query_stock_positions()

    # 2. 格式化数据
    formatted_positions = []
    for pos in positions:
        formatted_positions.append({
            "stockCode": pos.stock_code.split('.')[0],  # 去掉市场后缀
            "stockName": pos.stock_name,
            "quantity": pos.volume,
            "costPrice": pos.avg_price,
            "currentPrice": pos.last_price,
            "marketValue": pos.market_value,
            "profitLoss": pos.unrealized_pnl,
            "profitLossRate": (pos.unrealized_pnl / (pos.avg_price * pos.volume)) * 100
        })

    # 3. 调用您系统的 API 保存数据
    response = requests.post(
        'http://localhost:3000/api/positions/sync-qmt',
        headers={'Authorization': f'Bearer {YOUR_TOKEN}'},
        json={'positions': formatted_positions}
    )

    print(f"同步结果: {response.json()}")

# 每天定时执行
import schedule
schedule.every().day.at("15:30").do(sync_positions_to_system)
```

---

## 方案二：官方 API 接口

### 📌 方案介绍

光大证券官方提供的程序化交易 API 接口，适用于机构投资者或高净值个人投资者。

### 📋 申请条件

1. **资金要求**
   - 机构：300 万 - 500 万元起
   - 个人：通常需要更高门槛（建议咨询）

2. **合规要求**
   - 通过券商风控审核
   - 签署程序化交易协议
   - 接受监管要求

3. **技术要求**
   - 具备开发能力
   - 有风险管理系统
   - 通过技术测试

### 💰 费用说明

- **接口费用**：部分券商收取年费（几千到几万不等）
- **交易佣金**：可协商，通常低于普通散户
- **数据费用**：Level-2 行情可能需要付费

### 🚀 申请流程

#### 第一步：咨询了解

```
联系方式：
- 客服热线：95525
- 营业部：光大证券各地营业部
- 官网：https://www.ebchina.com/

咨询内容：
1. 当前 API 接口类型（REST/FIX/私有协议）
2. 资金门槛要求
3. 费用明细
4. 申请流程和周期
```

#### 第二步：提交申请

```
所需材料：
1. 公司/个人基本信息
2. 营业执照（机构）/ 身份证（个人）
3. 资金证明
4. 交易策略说明
5. 风险管理方案
6. 技术方案书
```

#### 第三步：审核流程

```
审核步骤：
1. 资格审核（3-5 工作日）
2. 风控审核（5-10 工作日）
3. 技术测试（1-2 周）
4. 正式开通

预计周期：1-2 个月
```

#### 第四步：技术对接

```
对接内容：
1. 获取 API 文档
2. 申请测试环境
3. 开发调试
4. 生产环境上线
5. 运维监控
```

### 🔧 可能的技术方案

根据不同券商，API 类型可能包括：

1. **REST API**（推荐）
   - 基于 HTTP/HTTPS
   - 易于开发和调试
   - 适合中低频交易

2. **FIX 协议**
   - 金融信息交换标准协议
   - 适合高频交易
   - 技术门槛较高

3. **私有协议**
   - 券商自有协议
   - 性能最优
   - 需要专门对接

---

## 申请流程详解

### 📞 联系光大证券

#### 方式一：客服热线（推荐首选）

```
电话：95525

话术参考：
"您好，我想咨询开通程序化交易权限的事宜：
1. 我的账户资产约 XX 万元
2. 想了解 QMT/Ptrade 量化交易系统的开通条件
3. 请问需要什么材料？开通流程是怎样的？
4. 交易佣金是多少？可以协商吗？
5. 能否帮我转接客户经理？"
```

#### 方式二：营业部现场

```
携带材料：
- 身份证
- 银行卡
- 证券账户信息

咨询内容：
- QMT/Ptrade 开通条件
- 当前优惠政策
- 现场办理流程
```

#### 方式三：在线客服

```
渠道：
- 光大证券官网在线客服
- 同花顺 APP 内联系客户经理
- 微信公众号咨询
```

### 📝 准备材料清单

#### 个人投资者

```
必备材料：
✓ 身份证原件及复印件
✓ 证券账户卡
✓ 银行卡
✓ 资金证明（账户余额截图）

补充材料（可能需要）：
✓ 风险测评结果
✓ 投资经历证明
✓ 学历证明（部分情况）
```

#### 机构投资者

```
必备材料：
✓ 营业执照
✓ 组织机构代码证
✓ 法人身份证
✓ 公司章程
✓ 股东名册
✓ 财务报表
✓ 交易策略说明
✓ 风险管理制度
```

---

## 费用说明

### 💵 QMT/Ptrade 费用明细

| 项目 | 费用 | 说明 |
|------|------|------|
| **软件使用费** | 免费 | 满足 50 万资金要求 |
| **交易佣金** | 万 2.5 左右 | 可协商更低（万 1.5 - 万 2） |
| **印花税** | 千分之一 | 国家规定，卖出时收取 |
| **过户费** | 万分之 0.2 | 双向收取 |
| **Level-1 行情** | 免费 | 基础行情数据 |
| **Level-2 行情** | 约 300-500元/月 | 深度行情（可选） |

### 💰 佣金协商技巧

```
协商要点：
1. 资金量越大，佣金越低
2. 提及其他券商的优惠政策
3. 强调长期合作意向
4. 可要求赠送 Level-2 行情

参考话术：
"我看到 XX 券商可以给到万 1.5 的佣金，
 光大证券能否给一个有竞争力的价格？
 我的资金量有 XX 万，打算长期持有。"

预期结果：
- 50 万资金：万 2 - 万 2.5
- 100 万资金：万 1.5 - 万 2
- 300 万+ 资金：万 1 - 万 1.5
```

---

## 技术对接指南

### 🔧 在您的系统中添加 QMT 同步功能

#### 1. 安装 QMT Python SDK

```bash
# QMT 官方 Python SDK
pip install xtquant
```

#### 2. 创建同步脚本

创建文件 `F:\Git\stock-manager\qmt_sync.py`:

```python
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
QMT 持仓数据同步脚本
"""

import json
import sys
from datetime import datetime

try:
    from xtquant import xtdata
    from xtquant import xttrader
except ImportError:
    print("错误: 请先安装 xtquant")
    print("安装命令: pip install xtquant")
    sys.exit(1)

def sync_positions(account_id, password=None):
    """同步 QMT 持仓数据"""

    print("=" * 60)
    print("  QMT 持仓数据同步")
    print("=" * 60)

    try:
        # 1. 连接账户
        print(f"\n正在连接账户: {account_id}")
        account = xttrader.StockAccount(account_id, password)

        # 2. 查询持仓
        print("正在获取持仓数据...")
        positions = account.query_stock_positions()

        if not positions:
            print("未获取到持仓数据")
            return {
                "success": True,
                "data": [],
                "summary": {
                    "totalStocks": 0,
                    "totalMarketValue": 0,
                    "syncTime": datetime.now().isoformat()
                }
            }

        # 3. 格式化数据
        formatted_positions = []
        total_market_value = 0

        for pos in positions:
            stock_data = {
                "stockCode": pos.stock_code.split('.')[0],
                "stockName": pos.stock_name,
                "quantity": float(pos.volume),
                "costPrice": float(pos.avg_price),
                "currentPrice": float(pos.last_price),
                "marketValue": float(pos.market_value),
                "profitLoss": float(pos.unrealized_pnl),
                "profitLossRate": float((pos.unrealized_pnl / (pos.avg_price * pos.volume)) * 100) if pos.volume > 0 else 0
            }

            formatted_positions.append(stock_data)
            total_market_value += stock_data['marketValue']

            print(f"  {stock_data['stockCode']} {stock_data['stockName']}: "
                  f"¥{stock_data['marketValue']:,.2f} "
                  f"({'+' if stock_data['profitLoss'] >= 0 else ''}{stock_data['profitLoss']:,.2f})")

        # 4. 构建返回数据
        result = {
            "success": True,
            "data": formatted_positions,
            "summary": {
                "totalStocks": len(formatted_positions),
                "totalMarketValue": total_market_value,
                "syncTime": datetime.now().isoformat()
            }
        }

        print(f"\n✅ 同步完成！")
        print(f"   持仓股票: {len(formatted_positions)} 只")
        print(f"   总市值: ¥{total_market_value:,.2f}")

        # 5. 保存到文件
        with open('positions_qmt.json', 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        print(f"\n数据已保存到: positions_qmt.json")

        # 6. 输出 JSON（供 Node.js 调用）
        print("\n" + json.dumps(result, ensure_ascii=False))

        return result

    except Exception as e:
        print(f"\n❌ 同步失败: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python qmt_sync.py <资金账号> [密码]")
        sys.exit(1)

    account_id = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else None

    sync_positions(account_id, password)
```

#### 3. 在 server.js 中添加 API

```javascript
// QMT 同步接口
app.post('/api/positions/sync-qmt', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { qmtAccount, qmtPassword } = req.body;

        console.log(`🔄 用户 ${userId} 请求从 QMT 同步持仓...`);

        const { spawn } = require('child_process');
        const fs = require('fs');

        // 调用 Python 脚本
        const args = [qmtAccount];
        if (qmtPassword) args.push(qmtPassword);

        const python = spawn('python', ['qmt_sync.py', ...args]);

        let stdout = '';
        let stderr = '';

        python.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        python.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        python.on('close', async (code) => {
            if (code !== 0) {
                return res.status(500).json({
                    success: false,
                    error: 'QMT 同步失败',
                    details: stderr
                });
            }

            try {
                // 解析 JSON 输出
                const jsonMatch = stdout.match(/\{[\s\S]*"success"[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('无法解析 QMT 输出');
                }

                const result = JSON.parse(jsonMatch[0]);

                if (result.success && result.data.length > 0) {
                    // 保存到数据库
                    await positionModel.saveOrUpdatePositions(userId, result.data);

                    await positionUpdateModel.recordUpdate(
                        userId,
                        'QMT 同步',
                        'success',
                        null,
                        result.data.length,
                        result.data.length
                    );

                    res.json({
                        success: true,
                        message: '从 QMT 同步持仓成功',
                        data: result
                    });
                } else {
                    res.json({
                        success: false,
                        error: '未获取到持仓数据'
                    });
                }
            } catch (parseError) {
                res.status(500).json({
                    success: false,
                    error: '解析 QMT 数据失败',
                    details: parseError.message
                });
            }
        });

    } catch (error) {
        console.error('QMT 同步错误:', error);
        res.status(500).json({
            success: false,
            error: 'QMT 同步失败: ' + error.message
        });
    }
});
```

---

## 常见问题

### Q1: 我的资金不足 50 万，有其他方案吗？

**A:** 有以下替代方案：

1. **Excel 手动导入**（当前已实现）
   - 无资金门槛
   - 操作简单可靠

2. **其他券商 QMT**
   - 部分券商门槛更低（10万-30万）
   - 可考虑开设第二证券账户

3. **模拟交易练习**
   - 先用 QMT 模拟盘熟悉
   - 积累到 50 万再开通实盘

### Q2: QMT 和官方 API 有什么区别？

| 特性 | QMT/Ptrade | 官方 API |
|------|------------|----------|
| 资金门槛 | 50 万 | 300 万+ |
| 适用对象 | 个人投资者 | 机构/高净值 |
| 开发难度 | 中等（有 SDK） | 较高（需深度对接） |
| 功能完整性 | 80% | 100% |
| 稳定性 | 高 | 很高 |
| 文档支持 | 完善 | 专业 |

### Q3: 开通后多久可以使用？

- QMT/Ptrade: 1-3 个工作日
- 官方 API: 1-2 个月

### Q4: 佣金可以协商到多低？

- 50 万资金：万 2 - 万 2.5
- 100 万资金：万 1.5 - 万 2
- 300 万资金：万 1 - 万 1.5
- 协商技巧：提及竞品、长期合作、资金量

### Q5: QMT 支持哪些编程语言？

- **Python**（推荐，文档最完善）
- **C++**
- **C#**
- **JavaScript**（部分功能）

### Q6: 如果账户资金低于 50 万会怎样？

- 已开通的权限会保留一段时间（通常 1-3 个月）
- 但建议保持资金量以持续使用

---

## 📞 联系方式

### 光大证券官方

- **客服热线**: 95525
- **官网**: https://www.ebchina.com/
- **微信公众号**: 光大证券

### 技术支持

- **QMT 社区**: https://www.xuntou.net/
- **客户经理**: 通过 95525 转接

---

## 📚 参考资源

1. [迅投 QMT 官网](https://www.xuntou.net/)
2. [QMT Python API 文档](https://dict.thsus.com/qmtApi/index.html)
3. [光大证券官网](https://www.ebchina.com/)

---

**最后更新**: 2025-01-09
**适用版本**: stock-manager v1.0.0
**QMT 版本**: 建议使用最新版
