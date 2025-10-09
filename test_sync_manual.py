#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
手动测试 easytrader 连接
需要先手动打开同花顺并登录
"""

import sys
import os
import json
import time

# 设置 Windows 控制台编码
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'ignore')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'ignore')

print("=" * 60)
print("  easytrader 手动连接测试")
print("=" * 60)

# 读取配置
with open('account.json', 'r', encoding='utf-8') as f:
    config = json.load(f)

print(f"\n配置信息:")
print(f"  券商: {config['broker']}")
print(f"  账号: {config['account']}")
print(f"  客户端: {config['exe_path']}")

# 提示用户手动启动同花顺
print("\n" + "=" * 60)
print("  重要提示:")
print("=" * 60)
print("1. 请先手动打开同花顺客户端")
print("2. 使用光大证券账号登录")
print("3. 登录成功后，回到此窗口")
print("4. 按 Enter 键继续...")
print("=" * 60)

input("\n准备好后按 Enter 键继续...")

# 尝试连接
try:
    import easytrader

    print("\n正在连接同花顺...")
    user = easytrader.use(config['broker'])

    # 方法1: 尝试使用 prepare 方法（如果支持）
    try:
        print("  尝试方法1: prepare()")
        user.prepare(config['exe_path'])
        print("  ✅ prepare() 成功")
    except Exception as e1:
        print(f"  方法1失败: {e1}")

        # 方法2: 尝试使用 connect 方法
        try:
            print("\n  尝试方法2: connect()")
            user.connect(config['exe_path'])
            print("  ✅ connect() 成功")
        except Exception as e2:
            print(f"  方法2失败: {e2}")
            raise Exception("所有连接方法均失败")

    print("\n✅ 连接成功!")

    # 获取账户信息
    print("\n" + "=" * 60)
    print("  获取账户信息:")
    print("=" * 60)

    # 获取余额
    try:
        print("\n正在获取余额...")
        balance = user.balance
        print(f"余额信息:")
        if isinstance(balance, list):
            for item in balance:
                print(f"  {item}")
        else:
            print(f"  {balance}")
    except Exception as e:
        print(f"获取余额失败: {e}")

    # 获取持仓
    try:
        print("\n正在获取持仓...")
        positions = user.position

        if positions and len(positions) > 0:
            print(f"\n✅ 获取到 {len(positions)} 个持仓:")
            print("-" * 60)

            for i, pos in enumerate(positions, 1):
                print(f"\n持仓 {i}:")
                for key, value in pos.items():
                    print(f"  {key}: {value}")

            # 保存到文件
            output = {
                "success": True,
                "data": positions,
                "summary": {
                    "totalStocks": len(positions),
                    "syncTime": time.strftime("%Y-%m-%d %H:%M:%S")
                }
            }

            with open('positions_sync.json', 'w', encoding='utf-8') as f:
                json.dump(output, f, ensure_ascii=False, indent=2)

            print("\n" + "=" * 60)
            print("✅ 持仓数据已保存到: positions_sync.json")
            print("=" * 60)

        else:
            print("\n⚠️ 未获取到持仓数据（可能账户无持仓）")

    except Exception as e:
        print(f"\n❌ 获取持仓失败: {e}")
        import traceback
        traceback.print_exc()

except Exception as e:
    print(f"\n❌ 连接失败: {e}")
    import traceback
    traceback.print_exc()

    print("\n诊断建议:")
    print("1. 确认同花顺已经打开并登录")
    print("2. 确认使用的是光大证券账号")
    print("3. 尝试关闭同花顺重新登录")
    print("4. 检查是否有防火墙拦截")

print("\n" + "=" * 60)
print("  测试完成")
print("=" * 60)
