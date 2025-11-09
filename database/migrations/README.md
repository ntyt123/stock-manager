# 数据库迁移系统使用说明

## 概述

本系统使用基于SQL文件的数据库迁移管理机制，确保开发环境和生产环境的数据库结构保持同步。

## 核心特性

- ✅ **版本控制**: 所有数据库结构变更都有记录
- ✅ **自动执行**: 应用启动时自动执行待处理的迁移
- ✅ **事务保护**: 每个迁移在事务中执行，失败自动回滚
- ✅ **幂等性**: 支持安全重复执行
- ✅ **顺序执行**: 按文件名时间戳顺序执行

## 迁移文件命名规则

```
YYYYMMDDHHMMSS_description.sql
```

示例:
- `20250122120000_add_user_avatar_column.sql`
- `20250122130000_create_notifications_table.sql`

文件名前缀是时间戳（年月日时分秒），确保迁移按正确顺序执行。

## 使用CLI工具

### 查看迁移状态

```bash
node database/migrate.js status
```

输出示例:
```
📊 数据库迁移状态:
   总计迁移: 2
   已执行: 2
   待执行: 0
```

### 执行待处理的迁移

```bash
node database/migrate.js run
```

### 创建新的迁移文件

```bash
node database/migrate.js create add_user_avatar_column
```

这会创建一个新的迁移文件，例如: `20250122154530_add_user_avatar_column.sql`

### 查看帮助

```bash
node database/migrate.js help
```

## 编写迁移文件

### 基本结构

```sql
-- Migration: 迁移描述
-- Created at: 2025-01-22T12:00:00.000Z
--
-- 说明: 详细说明这个迁移的作用

-- 创建新表
CREATE TABLE IF NOT EXISTS example (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_example_name ON example(name);
```

### 最佳实践

1. **使用 IF NOT EXISTS**
   ```sql
   CREATE TABLE IF NOT EXISTS users (...);
   CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
   ```

2. **添加列时检查是否存在**
   ```sql
   -- 注意: SQLite 不支持 IF NOT EXISTS 添加列
   -- 需要先检查列是否存在（在应用代码中处理）
   ```

3. **使用事务（自动）**
   - 迁移系统会自动将每个迁移包装在事务中
   - 如果迁移失败，会自动回滚

4. **添加注释**
   ```sql
   -- 说明为什么需要这个迁移
   -- 列出相关的Issue或需求编号
   ```

## 自动执行

应用启动时会自动执行待处理的迁移。在 `server.js` 中：

```javascript
const migrator = require('./database/migrator');

// 启动时执行迁移
await migrator.runPendingMigrations();
```

## 迁移追踪

系统使用 `migrations` 表来追踪已执行的迁移：

```sql
CREATE TABLE migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER
);
```

## 常见场景

### 1. 添加新表

```bash
node database/migrate.js create add_notifications_table
```

编辑生成的文件：
```sql
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### 2. 添加索引

```bash
node database/migrate.js create add_index_on_user_email
```

```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### 3. 修改表结构

SQLite 对 ALTER TABLE 的支持有限，建议：

```bash
node database/migrate.js create add_user_phone_column
```

```sql
-- 添加新列
ALTER TABLE users ADD COLUMN phone TEXT;
```

## 生产环境部署流程

1. **开发环境**
   ```bash
   # 创建迁移
   node database/migrate.js create add_new_feature

   # 编辑迁移文件
   # 测试迁移
   node database/migrate.js run
   ```

2. **提交代码**
   ```bash
   git add database/migrations/
   git commit -m "Add database migration for new feature"
   git push
   ```

3. **生产环境**
   ```bash
   # 拉取最新代码
   git pull

   # 自动迁移（应用启动时）
   npm start

   # 或手动执行
   node database/migrate.js run
   ```

## 注意事项

### ⚠️ 不要做的事情

1. **不要修改已执行的迁移文件**
   - 已执行的迁移不会重新运行
   - 如需修改，创建新的迁移文件

2. **不要删除迁移文件**
   - 保留所有迁移文件作为历史记录
   - 这样新环境可以从头开始构建数据库

3. **不要跳过迁移**
   - 迁移按顺序执行
   - 确保时间戳正确

### ✅ 推荐做法

1. **测试迁移**
   - 在开发环境充分测试
   - 确保迁移可以安全回滚（如需要）

2. **备份数据库**
   - 生产环境执行迁移前备份数据库
   ```bash
   cp stock_manager.db stock_manager.db.backup_$(date +%Y%m%d%H%M%S)
   ```

3. **代码审查**
   - 将迁移文件纳入代码审查流程
   - 确保迁移逻辑正确

## 故障排除

### 迁移执行失败

1. 查看错误信息
2. 检查SQL语法
3. 手动回滚（如需要）
4. 修复迁移文件
5. 从 `migrations` 表中删除失败的记录
   ```sql
   DELETE FROM migrations WHERE name = '失败的迁移文件名.sql';
   ```
6. 重新执行

### 查看已执行的迁移

```sql
SELECT * FROM migrations ORDER BY executed_at DESC;
```

## 文件结构

```
database/
├── migrations/           # 迁移文件目录
│   ├── README.md        # 本文档
│   ├── 20250122000000_initial_schema.sql
│   └── 20250122000001_add_prediction_history.sql
├── migrator.js          # 迁移管理器
├── migrate.js           # CLI工具
├── connection.js        # 数据库连接
├── init.js              # 初始化脚本（废弃，使用迁移代替）
└── index.js             # 数据库模块入口
```

## 更多信息

如有问题，请查看：
- `database/migrator.js` - 迁移系统实现
- `database/migrate.js` - CLI工具实现
- 或联系开发团队
