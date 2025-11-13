# 持仓表合并指南

## 背景

当前系统有两个持仓表：
- `user_positions` - 自动管理的持仓（驼峰命名）
- `manual_positions` - 手动录入的持仓（下划线命名）

存在的问题：
1. **数据重复**：同一股票在两个表都有记录，导致盈亏计算错误（重复计算）
2. **查询复杂**：每次查询需要合并两个表的数据
3. **维护困难**：需要同时维护两套代码逻辑

## 解决方案

合并为一个统一的 `positions` 表，包含所有字段，用 `source` 字段区分数据来源。

### 新表结构

```sql
CREATE TABLE positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stock_code TEXT NOT NULL,
    stock_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    cost_price REAL NOT NULL,
    current_price REAL,              -- 当前价格
    market_value REAL,                -- 市值
    profit_loss REAL,                 -- 盈亏金额
    profit_loss_rate REAL,            -- 盈亏率
    buy_date TEXT,                    -- 买入日期（手动录入时使用）
    notes TEXT,                       -- 备注（手动录入时使用）
    source TEXT NOT NULL DEFAULT 'manual',  -- 'auto' 或 'manual'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, stock_code)       -- 同一用户的同一股票只有一条记录
)
```

### 优势

1. ✅ 消除重复数据
2. ✅ 简化查询逻辑
3. ✅ 统一字段命名（使用下划线规范）
4. ✅ 保留所有功能（自动更新 + 手动管理）
5. ✅ 提高查询性能

## 执行步骤

### 1. 备份数据库（重要！）

```bash
# 复制数据库文件
cp database/stock-manager.db database/stock-manager.backup.db
```

### 2. 运行合并脚本

```bash
node database/migrations/merge_positions_tables.js
```

脚本会：
- 创建新的 `positions` 表
- 迁移 `user_positions` 的数据（标记为 source='auto'）
- 迁移 `manual_positions` 的数据（标记为 source='manual'）
- 遇到重复股票时，**优先保留 user_positions 的数据**（跳过 manual_positions 中的重复项）
- 将旧表重命名为 `*_backup`

### 3. 更新代码

需要修改以下文件：

#### 主要文件：
1. `controllers/recapController.js` - 复盘控制器
2. `controllers/reportController.js` - 报告控制器
3. 其他使用这两个表的文件

#### 更新方式：

**原来的代码：**
```javascript
// 获取两个表的数据并合并
const userPositions = db.prepare('SELECT * FROM user_positions...').all();
const manualPositions = db.prepare('SELECT * FROM manual_positions...').all();
// ... 复杂的合并逻辑
```

**新代码：**
```javascript
const PositionsModel = require('../database/models/positions');

// 获取所有持仓（包含 auto 和 manual）
const positions = PositionsModel.getAll(userId);

// 或者只获取某种来源的持仓
const autoPositions = PositionsModel.getAll(userId, 'auto');
const manualPositions = PositionsModel.getAll(userId, 'manual');
```

### 4. 测试验证

测试以下功能：
- [ ] 首页持仓显示正常
- [ ] 每日复盘数据正确（盈亏不再重复计算）
- [ ] 手动添加/编辑/删除持仓正常
- [ ] 报告生成正常
- [ ] 交易记录关联正常

### 5. 清理备份表（可选）

确认一切正常后，可以删除备份表：

```sql
DROP TABLE user_positions_backup;
DROP TABLE manual_positions_backup;
```

## 迁移策略

### 处理重复数据

当同一股票在两个表都存在时：
- **优先级**：user_positions > manual_positions
- **原因**：user_positions 有更完整的实时价格和盈亏数据
- **结果**：保留 user_positions 的记录，跳过 manual_positions 中的重复项

### 数据映射关系

| 旧表 (user_positions) | 旧表 (manual_positions) | 新表 (positions) |
|---------------------|----------------------|----------------|
| stockCode           | stock_code           | stock_code     |
| stockName           | stock_name           | stock_name     |
| costPrice           | cost_price           | cost_price     |
| currentPrice        | current_price        | current_price  |
| marketValue         | -                    | market_value   |
| profitLoss          | -                    | profit_loss    |
| profitLossRate      | -                    | profit_loss_rate |
| -                   | buy_date             | buy_date       |
| -                   | notes                | notes          |
| (固定为 'auto')      | (固定为 'manual')     | source         |

## 回滚方案

如果出现问题需要回滚：

1. 恢复备份的数据库文件：
   ```bash
   cp database/stock-manager.backup.db database/stock-manager.db
   ```

2. 或者重命名备份表：
   ```sql
   DROP TABLE positions;
   ALTER TABLE user_positions_backup RENAME TO user_positions;
   ALTER TABLE manual_positions_backup RENAME TO manual_positions;
   ```

## 注意事项

1. ⚠️ 执行前务必备份数据库
2. ⚠️ 建议在非交易时间执行迁移
3. ⚠️ 迁移后需要全面测试
4. ⚠️ 确认无误后再删除备份表
5. ⚠️ 更新代码时注意字段命名变化（驼峰 → 下划线）

## 预期效果

迁移完成后，每日复盘显示：
- ✅ 今日盈亏：正确值（不再重复计算）
- ✅ 总盈亏：正确值（相对成本价）
- ✅ 持仓数量：实际持仓数（不再包含重复）

当前问题（今日盈亏 -388 vs 实际应为 -194）将被解决。
