#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
光大证券持仓数据同步脚本
使用 easytrader 库自动获取持仓信息并导出为 JSON 格式
"""

import json
import sys
import os
from datetime import datetime

# 设置 Windows 控制台编码为 UTF-8
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'ignore')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'ignore')

def install_requirements():
    """检查并安装依赖"""
    try:
        import easytrader
        print("✅ easytrader 已安装")
    except ImportError:
        print("📦 正在安装 easytrader...")
        os.system("pip install easytrader -i https://pypi.tuna.tsinghua.edu.cn/simple")
        try:
            import easytrader
            print("✅ easytrader 安装成功")
        except ImportError:
            print("❌ easytrader 安装失败，请手动执行: pip install easytrader")
            sys.exit(1)

def get_available_brokers():
    """获取支持的券商列表"""
    import easytrader

    print("\n📋 easytrader 支持的券商:")
    print("=" * 50)

    # easytrader 支持的券商
    brokers = [
        "ht_client / 华泰客户端 (华泰证券)",
        "yh_client / 银河客户端 (银河证券)",
        "gf_client / 广发客户端 (广发证券)",
        "gj_client / 国金客户端 (国金证券)",
        "htzq_client / 海通证券客户端 (海通证券)",
        "wk_client / 五矿客户端 (五矿证券)",
        "ths / 同花顺客户端 (通用同花顺)",
        "universal_client / 通用同花顺客户端 (推荐 - 支持光大证券)",
        "xq / 雪球 (雪球模拟交易)",
        "miniqmt (迅投QMT客户端)"
    ]

    for broker in brokers:
        print(f"  - {broker}")

    print("=" * 50)
    print("\n💡 提示: 光大证券请使用 'universal_client' (通用同花顺客户端)")
    print("         需要先安装同花顺客户端")

def sync_positions_ths(account_file="account.json"):
    """
    使用同花顺客户端登录光大证券并获取持仓

    Args:
        account_file: 账户配置文件路径

    Returns:
        dict: 持仓数据
    """
    try:
        import easytrader
    except ImportError:
        print("❌ 请先安装 easytrader: pip install easytrader")
        return None

    print("\n🚀 开始同步光大证券持仓数据...")
    print("=" * 50)

    # 检查配置文件
    if not os.path.exists(account_file):
        print(f"❌ 配置文件不存在: {account_file}")
        print("\n📝 请创建配置文件 account.json，内容如下:")
        print(json.dumps({
            "broker": "universal",  # 使用通用客户端
            "account": "您的资金账号",
            "password": "您的交易密码",
            "exe_path": "C:\\同花顺\\xiadan.exe"  # 同花顺客户端路径
        }, indent=2, ensure_ascii=False))
        return None

    # 读取配置
    try:
        with open(account_file, 'r', encoding='utf-8') as f:
            config = json.load(f)

        print(f"✅ 配置文件加载成功")
        print(f"   券商: {config.get('broker', 'universal')}")
        print(f"   账号: {config.get('account', '未配置')}")

    except Exception as e:
        print(f"❌ 配置文件读取失败: {e}")
        return None

    # 连接券商
    try:
        print("\n🔗 正在连接券商...")

        broker_type = config.get('broker', 'universal_client')

        # 创建 trader 对象
        user = easytrader.use(broker_type)
        print(f"   创建 {broker_type} 对象成功")

        # 连接客户端
        print(f"   正在启动客户端: {config.get('exe_path')}")
        user.connect(config.get('exe_path'))

        print("   ✅ 客户端连接成功")
        print("   💡 提示: 如果弹出登录窗口，请手动登录")
        print("          (建议在同花顺中保存密码以便自动登录)")

        # 等待用户登录
        import time
        print("\n   ⏳ 等待5秒，给您时间登录...")
        time.sleep(5)

    except Exception as e:
        print(f"❌ 连接券商失败: {e}")
        print("\n💡 可能的原因:")
        print("   1. 客户端路径不正确")
        print("   2. 客户端未安装或版本不兼容")
        print("   3. 客户端被防火墙拦截")
        return None

    # 获取持仓
    try:
        print("\n📊 正在获取持仓数据...")

        # 获取持仓
        positions = user.position

        if not positions:
            print("⚠️ 未获取到持仓数据（可能账户无持仓）")
            return {
                "success": True,
                "data": [],
                "summary": {
                    "totalStocks": 0,
                    "totalMarketValue": 0,
                    "syncTime": datetime.now().isoformat()
                }
            }

        print(f"✅ 获取到 {len(positions)} 个持仓")

        # 格式化持仓数据
        formatted_positions = []
        total_market_value = 0

        for pos in positions:
            # easytrader 返回的持仓字段可能因客户端而异，需要适配
            stock_data = {
                "stockCode": str(pos.get('证券代码', pos.get('stock_code', ''))).zfill(6),
                "stockName": pos.get('证券名称', pos.get('stock_name', '')),
                "quantity": float(pos.get('股票余额', pos.get('enable_amount', 0))),
                "costPrice": float(pos.get('成本价', pos.get('cost_price', 0))),
                "currentPrice": float(pos.get('最新价', pos.get('current_price', 0))),
                "marketValue": float(pos.get('市值', pos.get('market_value', 0))),
                "profitLoss": float(pos.get('浮动盈亏', pos.get('profit_loss', 0))),
                "profitLossRate": float(pos.get('盈亏比例', pos.get('profit_loss_rate', 0)))
            }

            # 如果缺少市值，计算市值
            if stock_data['marketValue'] == 0:
                stock_data['marketValue'] = stock_data['quantity'] * stock_data['currentPrice']

            # 如果缺少盈亏，计算盈亏
            if stock_data['profitLoss'] == 0:
                cost = stock_data['quantity'] * stock_data['costPrice']
                stock_data['profitLoss'] = stock_data['marketValue'] - cost

            # 如果缺少盈亏率，计算盈亏率
            if stock_data['profitLossRate'] == 0 and stock_data['costPrice'] > 0:
                stock_data['profitLossRate'] = ((stock_data['currentPrice'] - stock_data['costPrice']) / stock_data['costPrice']) * 100

            formatted_positions.append(stock_data)
            total_market_value += stock_data['marketValue']

            print(f"   {stock_data['stockCode']} {stock_data['stockName']}: "
                  f"¥{stock_data['marketValue']:.2f} "
                  f"({'+' if stock_data['profitLoss'] >= 0 else ''}{stock_data['profitLoss']:.2f})")

        # 构建返回数据
        result = {
            "success": True,
            "data": formatted_positions,
            "summary": {
                "totalStocks": len(formatted_positions),
                "totalMarketValue": total_market_value,
                "syncTime": datetime.now().isoformat()
            }
        }

        print("\n" + "=" * 50)
        print(f"📈 同步完成!")
        print(f"   持仓股票: {len(formatted_positions)} 只")
        print(f"   总市值: ¥{total_market_value:,.2f}")
        print("=" * 50)

        return result

    except Exception as e:
        print(f"❌ 获取持仓数据失败: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """主函数"""
    print("=" * 50)
    print("  光大证券持仓数据同步工具 (基于 easytrader)")
    print("=" * 50)

    # 检查参数
    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "list":
            # 显示支持的券商
            get_available_brokers()
            return

        elif command == "sync":
            # 同步持仓
            install_requirements()

            account_file = sys.argv[2] if len(sys.argv) > 2 else "account.json"
            result = sync_positions_ths(account_file)

            if result:
                # 输出 JSON 格式（供 Node.js 调用）
                print("\n" + json.dumps(result, ensure_ascii=False, indent=2))

                # 保存到文件
                output_file = "positions_sync.json"
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)
                print(f"\n✅ 数据已保存到: {output_file}")
            else:
                sys.exit(1)

        elif command == "init":
            # 创建示例配置文件
            config_template = {
                "broker": "universal_client",
                "account": "您的资金账号",
                "password": "您的交易密码",
                "exe_path": "C:\\同花顺\\xiadan.exe",
                "注释": {
                    "broker": "券商类型，光大证券使用 universal_client",
                    "account": "您的资金账号",
                    "password": "交易密码（可选，建议在客户端保存）",
                    "exe_path": "同花顺客户端路径，例如: C:\\同花顺\\xiadan.exe"
                }
            }

            with open("account.json", 'w', encoding='utf-8') as f:
                json.dump(config_template, f, ensure_ascii=False, indent=2)

            print("配置文件模板已创建: account.json")
            print("请编辑 account.json 填入您的账户信息")

        else:
            print(f"❌ 未知命令: {command}")
            show_usage()

    else:
        show_usage()

def show_usage():
    """显示使用说明"""
    print("\n📖 使用说明:")
    print("=" * 50)
    print("  python ebroker_sync.py list              # 查看支持的券商")
    print("  python ebroker_sync.py init              # 创建配置文件模板")
    print("  python ebroker_sync.py sync              # 同步持仓数据")
    print("  python ebroker_sync.py sync account.json # 使用指定配置文件")
    print("=" * 50)
    print("\n⚠️ 重要提示:")
    print("  1. 需要安装同花顺/大智慧/通达信等第三方客户端")
    print("  2. 首次使用需要在客户端中手动登录一次")
    print("  3. 建议在客户端中保存密码以便自动登录")
    print("  4. 确保已安装 easytrader: pip install easytrader")

if __name__ == "__main__":
    main()
