-- Migration: Create daily_recap table
-- Created at: 2025-11-01
--
-- 创建每日复盘记录表

CREATE TABLE IF NOT EXISTS daily_recap (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recap_date DATE NOT NULL,
    user_id INTEGER DEFAULT 1,

    -- 市场数据（JSON）
    market_data TEXT,

    -- 持仓数据（JSON）
    position_data TEXT,
    today_profit REAL DEFAULT 0,
    total_profit REAL DEFAULT 0,
    position_count INTEGER DEFAULT 0,
    rise_count INTEGER DEFAULT 0,
    fall_count INTEGER DEFAULT 0,
    flat_count INTEGER DEFAULT 0,

    -- 交易数据（JSON）
    trade_data TEXT,
    trade_count INTEGER DEFAULT 0,
    buy_count INTEGER DEFAULT 0,
    sell_count INTEGER DEFAULT 0,

    -- 计划数据（JSON）
    plan_data TEXT,
    plan_count INTEGER DEFAULT 0,
    plan_completed INTEGER DEFAULT 0,
    plan_execution_rate REAL DEFAULT 0,

    -- AI分析
    ai_analysis TEXT,
    ai_analyzed_at DATETIME,

    -- 用户笔记
    user_notes TEXT,

    -- 状态
    is_completed BOOLEAN DEFAULT 0,
    completed_at DATETIME,

    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- 唯一约束
    UNIQUE(user_id, recap_date)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_daily_recap_date ON daily_recap(recap_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_recap_user_date ON daily_recap(user_id, recap_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_recap_completed ON daily_recap(is_completed, recap_date DESC);
