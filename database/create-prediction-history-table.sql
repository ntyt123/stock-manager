-- 创建预测历史记录表

CREATE TABLE IF NOT EXISTS prediction_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    prediction_type VARCHAR(50) NOT NULL,  -- market_prediction, trend_prediction, stock_trend_prediction, stock_risk_prediction, stock_sentiment_prediction, market_sentiment_prediction
    stock_code VARCHAR(10),  -- 股票代码或市场指数代码
    stock_name VARCHAR(100),  -- 股票名称或市场指数名称
    prediction_date DATE NOT NULL,  -- 预测的日期（YYYY-MM-DD），用于去重
    prediction_content TEXT NOT NULL,  -- 预测内容（Markdown格式）
    paipan_info TEXT,  -- 排盘信息（JSON格式）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, prediction_type, stock_code, prediction_date)  -- 唯一约束：同一用户、同一类型、同一股票、同一天只保留一条
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_prediction_history_user_id ON prediction_history(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_history_type ON prediction_history(prediction_type);
CREATE INDEX IF NOT EXISTS idx_prediction_history_date ON prediction_history(prediction_date);
CREATE INDEX IF NOT EXISTS idx_prediction_history_stock ON prediction_history(stock_code);
