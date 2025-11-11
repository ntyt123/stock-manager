-- Migration: 三日选股法数据库表
-- Created at: 2025-11-11T14:21:00.000Z
--
-- 说明: 创建三日选股法功能所需的数据库表
-- 功能: 实现连续三日上涨选股策略的配置、结果和统计管理

-- 1. 选股策略配置表
CREATE TABLE IF NOT EXISTS three_day_selection_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    config_name TEXT NOT NULL,

    -- 价格条件
    min_price REAL DEFAULT 3.0,
    max_price REAL DEFAULT 300.0,
    min_daily_increase REAL DEFAULT 1.0,
    max_daily_increase REAL DEFAULT 7.0,

    -- 成交量条件
    volume_increase_required INTEGER DEFAULT 1,
    min_volume_ratio REAL DEFAULT 1.2,
    max_volume_ratio REAL DEFAULT 3.0,

    -- 技术指标条件
    require_macd_golden INTEGER DEFAULT 0,
    require_above_ma5 INTEGER DEFAULT 1,
    rsi_min REAL DEFAULT 30,
    rsi_max REAL DEFAULT 70,

    -- 市值条件
    min_market_cap REAL DEFAULT 10,
    max_market_cap REAL DEFAULT 1000,
    exclude_st INTEGER DEFAULT 1,

    -- 行业过滤
    included_sectors TEXT,
    excluded_sectors TEXT,

    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 2. 选股结果表
CREATE TABLE IF NOT EXISTS three_day_selection_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    config_id INTEGER,
    scan_date TEXT NOT NULL,

    stock_code TEXT NOT NULL,
    stock_name TEXT NOT NULL,

    -- 选中时的数据
    current_price REAL NOT NULL,
    three_day_increase REAL NOT NULL,
    volume_ratio REAL NOT NULL,

    -- K线数据（JSON）
    day1_data TEXT NOT NULL,
    day2_data TEXT NOT NULL,
    day3_data TEXT NOT NULL,

    -- 技术指标（JSON）
    indicators TEXT,

    -- 评分系统
    score REAL DEFAULT 0,
    confidence_level TEXT DEFAULT 'medium',

    -- 后续跟踪
    status TEXT DEFAULT 'pending',
    buy_date TEXT,
    buy_price REAL,
    sell_date TEXT,
    sell_price REAL,
    profit_rate REAL,

    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (config_id) REFERENCES three_day_selection_configs (id) ON DELETE SET NULL
);

-- 3. 选股历史统计表
CREATE TABLE IF NOT EXISTS three_day_selection_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stat_date TEXT NOT NULL,

    -- 选股统计
    total_scanned INTEGER DEFAULT 0,
    total_selected INTEGER DEFAULT 0,
    selection_rate REAL DEFAULT 0,

    -- 收益统计
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate REAL DEFAULT 0,
    avg_profit_rate REAL DEFAULT 0,
    max_profit_rate REAL DEFAULT 0,
    max_loss_rate REAL DEFAULT 0,

    -- 持仓统计
    current_holdings INTEGER DEFAULT 0,
    pending_signals INTEGER DEFAULT 0,

    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, stat_date)
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_three_day_results_user_date
ON three_day_selection_results(user_id, scan_date);

CREATE INDEX IF NOT EXISTS idx_three_day_results_stock_code
ON three_day_selection_results(stock_code);

CREATE INDEX IF NOT EXISTS idx_three_day_results_status
ON three_day_selection_results(status);

-- 5. 插入默认配置（稳健型）
-- 注意：这里使用 INSERT OR IGNORE 来确保幂等性
INSERT OR IGNORE INTO three_day_selection_configs (
    user_id, config_name,
    min_price, max_price,
    min_daily_increase, max_daily_increase,
    volume_increase_required, min_volume_ratio, max_volume_ratio,
    require_macd_golden, require_above_ma5,
    rsi_min, rsi_max,
    min_market_cap, max_market_cap, exclude_st,
    is_active, created_at, updated_at
)
SELECT
    id,
    '稳健型（默认）',
    5.0, 100.0,
    1.0, 5.0,
    1, 1.2, 2.5,
    0, 1,
    35, 65,
    20, 500, 1,
    1,
    datetime('now'),
    datetime('now')
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM three_day_selection_configs
    WHERE three_day_selection_configs.user_id = users.id
    AND three_day_selection_configs.config_name = '稳健型（默认）'
);
