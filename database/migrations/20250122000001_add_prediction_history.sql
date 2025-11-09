-- Migration: Add Prediction History Table
-- Created at: 2025-01-22T00:00:01.000Z
--
-- 说明: 创建预测历史记录表和相关索引

-- 创建预测历史记录表
CREATE TABLE IF NOT EXISTS prediction_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    prediction_type VARCHAR(50) NOT NULL,
    stock_code VARCHAR(10),
    stock_name VARCHAR(100),
    prediction_date DATE NOT NULL,
    prediction_content TEXT NOT NULL,
    paipan_info TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, prediction_type, stock_code, prediction_date)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_prediction_history_user_id ON prediction_history(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_history_type ON prediction_history(prediction_type);
CREATE INDEX IF NOT EXISTS idx_prediction_history_date ON prediction_history(prediction_date);
CREATE INDEX IF NOT EXISTS idx_prediction_history_stock ON prediction_history(stock_code);
