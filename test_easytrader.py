#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
easytrader 测试脚本 - 用于诊断连接问题
"""

import sys
import os

# 设置 Windows 控制台编码
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'ignore')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'ignore')

print("=" * 60)
print("  easytrader 诊断测试")
print("=" * 60)

# 1. 检查 easytrader 版本
try:
    import easytrader
    print(f"\n✅ easytrader 已安装")
    print(f"   版本: {easytrader.__version__ if hasattr(easytrader, '__version__') else '未知'}")
except ImportError as e:
    print(f"\n❌ easytrader 未安装: {e}")
    sys.exit(1)

# 2. 检查配置文件
config_file = "account.json"
if not os.path.exists(config_file):
    print(f"\n❌ 配置文件不存在: {config_file}")
    sys.exit(1)

import json
with open(config_file, 'r', encoding='utf-8') as f:
    config = json.load(f)

print(f"\n✅ 配置文件加载成功")
print(f"   券商: {config.get('broker')}")
print(f"   账号: {config.get('account')}")
print(f"   客户端路径: {config.get('exe_path')}")

# 3. 检查客户端文件
exe_path = config.get('exe_path')
if not os.path.exists(exe_path):
    print(f"\n❌ 客户端文件不存在: {exe_path}")
    sys.exit(1)
else:
    print(f"\n✅ 客户端文件存在")

# 4. 尝试连接券商
print("\n" + "=" * 60)
print("  开始测试连接...")
print("=" * 60)

try:
    # 方法1: 使用 universal 模式
    print("\n📌 测试方法1: easytrader.use('universal')")
    user = easytrader.use('universal')
    print(f"   创建客户端对象成功: {type(user)}")

    # 尝试连接
    print(f"\n🔗 正在连接客户端: {exe_path}")
    print("   提示: 可能会弹出同花顺窗口，请手动登录...")

    user.connect(exe_path)
    print("   ✅ 连接成功!")

    # 尝试获取余额
    print("\n📊 正在获取账户信息...")
    try:
        balance = user.balance
        print(f"   余额信息: {balance}")
    except Exception as e:
        print(f"   ⚠️ 获取余额失败: {e}")

    # 尝试获取持仓
    print("\n📊 正在获取持仓信息...")
    try:
        positions = user.position
        if positions:
            print(f"   ✅ 获取到 {len(positions)} 个持仓")
            for i, pos in enumerate(positions[:3], 1):  # 只显示前3个
                print(f"   {i}. {pos}")
        else:
            print("   ⚠️ 未获取到持仓数据（可能账户无持仓）")
    except Exception as e:
        print(f"   ❌ 获取持仓失败: {e}")
        import traceback
        traceback.print_exc()

except Exception as e:
    print(f"\n❌ 连接失败: {e}")
    print("\n详细错误信息:")
    import traceback
    traceback.print_exc()

    # 提供诊断建议
    print("\n" + "=" * 60)
    print("  诊断建议:")
    print("=" * 60)
    print("1. 确认同花顺客户端可以正常启动")
    print("2. 尝试手动打开同花顺，用光大证券账号登录一次")
    print("3. 在同花顺中勾选'保存密码'")
    print("4. 确认没有其他程序占用同花顺进程")
    print("5. 尝试以管理员身份运行此脚本")
    print("\n可选方案:")
    print("- 如果同花顺版本太新，easytrader 可能不兼容")
    print("- 建议下载同花顺旧版本或使用其他客户端(大智慧/通达信)")
    print("- 或者使用Excel手动导入方式")

print("\n" + "=" * 60)
print("  测试完成")
print("=" * 60)
