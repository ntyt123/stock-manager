const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../stock_manager.db');
const db = new Database(dbPath);

try {
    console.log('📊 开始创建买入点验证相关表...');

    // 创建买入点验证记录表
    db.exec(`
        CREATE TABLE IF NOT EXISTS buy_point_validations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stock_code VARCHAR(10) NOT NULL,
            stock_name VARCHAR(50),

            -- 验证信息
            validation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            stock_price REAL,

            -- 评分详情
            total_score INTEGER,
            rating_level VARCHAR(20),

            -- 分维度评分
            technical_score INTEGER,
            trend_score INTEGER,
            volume_score INTEGER,
            indicator_score INTEGER,

            pattern_score INTEGER,
            kline_score INTEGER,
            support_score INTEGER,

            market_score INTEGER,
            index_score INTEGER,
            sector_score INTEGER,

            risk_score INTEGER,
            position_risk INTEGER,
            volatility_risk INTEGER,
            signal_risk INTEGER,

            -- 指标数据快照
            indicators_data TEXT,

            -- 建议信息
            recommendation TEXT,
            risk_warning TEXT,
            buy_price_range VARCHAR(50),
            stop_loss_price REAL,
            target_price REAL,
            position_advice VARCHAR(20),

            -- 用户操作
            user_notes TEXT,
            is_followed BOOLEAN DEFAULT 0,
            actual_buy_price REAL,
            actual_buy_time DATETIME,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    console.log('✅ 创建 buy_point_validations 表成功');

    // 创建索引
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_buy_validations_user_stock
        ON buy_point_validations(user_id, stock_code);
    `);
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_buy_validations_time
        ON buy_point_validations(validation_time);
    `);
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_buy_validations_score
        ON buy_point_validations(total_score DESC);
    `);
    console.log('✅ 创建索引成功');

    // 创建验证配置表
    db.exec(`
        CREATE TABLE IF NOT EXISTS validation_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            config_name VARCHAR(50),
            is_default BOOLEAN DEFAULT 0,

            -- 权重配置 (JSON)
            weights TEXT,

            -- 阈值配置 (JSON)
            thresholds TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    console.log('✅ 创建 validation_configs 表成功');

    // 插入默认配置
    const existingConfig = db.prepare('SELECT COUNT(*) as count FROM validation_configs').get();
    if (existingConfig.count === 0) {
        const defaultWeights = JSON.stringify({
            technical: 40,
            trend: 15,
            volume: 10,
            indicator: 15,
            pattern: 25,
            kline: 10,
            support: 15,
            market: 20,
            index: 10,
            sector: 10,
            risk: 15,
            position: 5,
            volatility: 5,
            signal: 5
        });

        const defaultThresholds = JSON.stringify({
            excellent: 80,
            good: 60,
            neutral: 40,
            poor: 20
        });

        db.prepare(`
            INSERT INTO validation_configs (user_id, config_name, is_default, weights, thresholds)
            VALUES (1, '默认配置', 1, ?, ?)
        `).run(defaultWeights, defaultThresholds);

        console.log('✅ 插入默认配置成功');
    }

    console.log('✅ 买入点验证表创建完成！');

} catch (error) {
    console.error('❌ 创建买入点验证表失败:', error);
    throw error;
} finally {
    db.close();
}
