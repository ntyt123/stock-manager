#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
检查 easytrader 支持的券商类型
"""

import sys

# 设置 Windows 控制台编码
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'ignore')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'ignore')

try:
    import easytrader
    print("=" * 60)
    print("  easytrader 支持的券商类型")
    print("=" * 60)

    # 检查 easytrader 的源码
    import inspect

    # 查看 use 函数的实现
    print("\neasytrader.use() 函数定义:")
    print(inspect.getsource(easytrader.use))

except Exception as e:
    print(f"错误: {e}")
    import traceback
    traceback.print_exc()
