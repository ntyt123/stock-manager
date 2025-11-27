/**
 * 确保远程服务器拥有所有必需的表
 * 此脚本会检查并创建缺失的关键表
 */

const { db } = require('../database');

// 表定义
const TABLE_DEFINITIONS = {
    short_term_pool: `
        CREATE TABLE IF NOT EXISTS short_term_pool (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stock_code VARCHAR(10) NOT NULL,
            stock_name VARCHAR(50),
            selection_method VARCHAR(20) DEFAULT 'three_day',
            day_status INTEGER DEFAULT 1,
            first_day_price REAL,
            second_day_price REAL,
            third_day_price REAL,
            buy_price REAL,
            current_price REAL,
            status VARCHAR(20) DEFAULT 'observing',
            notes TEXT,
            stock_type VARCHAR(20) DEFAULT 'unknown',
            board_shape VARCHAR(20),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `,

    stock_criteria_settings: `
        CREATE TABLE IF NOT EXISTS stock_criteria_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            criteria_name VARCHAR(50) DEFAULT 'default',
            volume_ratio_min REAL DEFAULT 1.5,
            volume_ratio_max REAL,
            turnover_rate_min REAL DEFAULT 3.0,
            turnover_rate_max REAL DEFAULT 8.0,
            change_percent_min REAL DEFAULT 3.0,
            change_percent_max REAL DEFAULT 7.0,
            amplitude_min REAL,
            amplitude_max REAL,
            price_min REAL,
            price_max REAL,
            enable_check BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, criteria_name),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `,

    buy_point_validations: `
        CREATE TABLE IF NOT EXISTS buy_point_validations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stock_code VARCHAR(10) NOT NULL,
            stock_name VARCHAR(50),
            validation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            stock_price REAL,
            total_score INTEGER,
            rating_level VARCHAR(20),
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
            indicators_data TEXT,
            recommendation TEXT,
            risk_warning TEXT,
            buy_price_range VARCHAR(50),
            stop_loss_price REAL,
            target_price REAL,
            position_advice VARCHAR(20),
            user_notes TEXT,
            is_followed BOOLEAN DEFAULT 0,
            actual_buy_price REAL,
            actual_buy_time DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `,

    validation_configs: `
        CREATE TABLE IF NOT EXISTS validation_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            config_name VARCHAR(50),
            is_default BOOLEAN DEFAULT 0,
            weights TEXT,
            thresholds TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `,

    review_notes: `
        CREATE TABLE IF NOT EXISTS review_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            review_date DATE NOT NULL,
            market_summary TEXT,
            today_operations TEXT,
            profit_loss REAL,
            lessons_learned TEXT,
            tomorrow_plan TEXT,
            mood_score INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, review_date),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `,

    trading_plans_short: `
        CREATE TABLE IF NOT EXISTS trading_plans_short (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stock_code VARCHAR(10) NOT NULL,
            stock_name VARCHAR(50),
            plan_type VARCHAR(20) NOT NULL,
            plan_date DATE NOT NULL,
            entry_price REAL,
            entry_price_range VARCHAR(50),
            quantity INTEGER,
            target_price REAL,
            stop_loss_price REAL,
            holding_days INTEGER,
            status VARCHAR(20) DEFAULT 'pending',
            result VARCHAR(20),
            actual_entry_price REAL,
            actual_entry_time DATETIME,
            actual_exit_price REAL,
            actual_exit_time DATETIME,
            actual_profit_loss REAL,
            execution_notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `,

    three_day_selection_configs: `
        CREATE TABLE IF NOT EXISTS three_day_selection_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            config_name VARCHAR(50) DEFAULT 'default',
            is_active BOOLEAN DEFAULT 1,
            first_day_criteria TEXT,
            second_day_criteria TEXT,
            third_day_criteria TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, config_name),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `,

    three_day_selection_results: `
        CREATE TABLE IF NOT EXISTS three_day_selection_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stock_code VARCHAR(10) NOT NULL,
            stock_name VARCHAR(50),
            selection_date DATE NOT NULL,
            day_number INTEGER NOT NULL,
            passed BOOLEAN DEFAULT 0,
            criteria_results TEXT,
            price REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `,

    three_day_selection_stats: `
        CREATE TABLE IF NOT EXISTS three_day_selection_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stat_date DATE NOT NULL,
            total_candidates INTEGER DEFAULT 0,
            passed_day1 INTEGER DEFAULT 0,
            passed_day2 INTEGER DEFAULT 0,
            passed_day3 INTEGER DEFAULT 0,
            avg_success_rate REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, stat_date),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `
};

// 索引定义
const INDEX_DEFINITIONS = {
    idx_buy_validations_user_stock: `
        CREATE INDEX IF NOT EXISTS idx_buy_validations_user_stock
        ON buy_point_validations(user_id, stock_code)
    `,
    idx_buy_validations_time: `
        CREATE INDEX IF NOT EXISTS idx_buy_validations_time
        ON buy_point_validations(validation_time)
    `,
    idx_buy_validations_score: `
        CREATE INDEX IF NOT EXISTS idx_buy_validations_score
        ON buy_point_validations(total_score DESC)
    `,
    idx_short_term_pool_user_method: `
        CREATE INDEX IF NOT EXISTS idx_short_term_pool_user_method
        ON short_term_pool(user_id, selection_method)
    `,
    idx_short_term_pool_status: `
        CREATE INDEX IF NOT EXISTS idx_short_term_pool_status
        ON short_term_pool(status, day_status)
    `
};

async function ensureRequiredTables() {
    try {
        console.log('========================================');
        console.log('🔧 确保数据库拥有所有必需表');
        console.log('========================================\n');

        // 1. 检查表状态
        console.log('📊 检查表状态...');
        const existingTables = db.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `).all().map(row => row.name);

        const requiredTables = Object.keys(TABLE_DEFINITIONS);
        const missingTables = requiredTables.filter(table => !existingTables.includes(table));

        console.log(`  ✅ 现有表: ${existingTables.length} 个`);
        console.log(`  📋 必需表: ${requiredTables.length} 个`);

        if (missingTables.length === 0) {
            console.log(`  ✅ 所有必需表都存在\n`);
        } else {
            console.log(`  ⚠️  缺少表: ${missingTables.length} 个`);
            missingTables.forEach(table => console.log(`     - ${table}`));
            console.log('');
        }

        // 2. 创建缺失的表
        if (missingTables.length > 0) {
            console.log('🔨 创建缺失的表...\n');

            for (const tableName of missingTables) {
                console.log(`  📝 创建表: ${tableName}`);
                try {
                    db.exec(TABLE_DEFINITIONS[tableName]);
                    console.log(`  ✅ 成功\n`);
                } catch (error) {
                    console.error(`  ❌ 失败:`, error.message, '\n');
                }
            }
        }

        // 3. 创建索引
        console.log('📑 创建索引...');
        let indexCreated = 0;
        for (const [indexName, indexSQL] of Object.entries(INDEX_DEFINITIONS)) {
            try {
                db.exec(indexSQL);
                indexCreated++;
            } catch (error) {
                // 索引可能已存在，忽略错误
            }
        }
        console.log(`  ✅ 成功创建/确认 ${indexCreated} 个索引\n`);

        // 4. 插入默认配置（如果需要）
        console.log('⚙️  检查默认配置...');

        // validation_configs 默认配置
        if (missingTables.includes('validation_configs')) {
            try {
                const existingConfig = db.prepare('SELECT COUNT(*) as count FROM validation_configs').get();
                if (existingConfig.count === 0) {
                    const defaultWeights = JSON.stringify({
                        technical: 40, trend: 15, volume: 10, indicator: 15,
                        pattern: 25, kline: 10, support: 15,
                        market: 20, index: 10, sector: 10,
                        risk: 15, position: 5, volatility: 5, signal: 5
                    });
                    const defaultThresholds = JSON.stringify({
                        excellent: 80, good: 60, neutral: 40, poor: 20
                    });
                    db.prepare(`
                        INSERT INTO validation_configs (user_id, config_name, is_default, weights, thresholds)
                        VALUES (1, '默认配置', 1, ?, ?)
                    `).run(defaultWeights, defaultThresholds);
                    console.log(`  ✅ 插入验证默认配置`);
                }
            } catch (error) {
                console.log(`  ℹ️  验证配置已存在或无需插入`);
            }
        }

        console.log('');

        // 5. 最终验证
        console.log('🔍 最终验证...');
        const finalTables = db.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `).all().map(row => row.name);

        const stillMissing = requiredTables.filter(table => !finalTables.includes(table));

        console.log('\n========================================');
        if (stillMissing.length === 0) {
            console.log('🎉 所有必需表已就绪！');
            console.log('========================================\n');
            console.log(`✅ 数据库包含 ${finalTables.length} 个表`);
            console.log(`✅ 所有 ${requiredTables.length} 个必需表已确认`);
            return { success: true };
        } else {
            console.log('⚠️  仍有缺失表');
            console.log('========================================\n');
            stillMissing.forEach(table => console.log(`  ❌ ${table}`));
            return { success: false, missing: stillMissing };
        }

    } catch (error) {
        console.error('\n❌ 错误:', error);
        throw error;
    }
}

// 执行
ensureRequiredTables()
    .then((result) => {
        if (result.success) {
            console.log('\n✅ 脚本执行完成');
            process.exit(0);
        } else {
            console.log('\n⚠️  脚本执行完成，但仍有缺失表');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('\n❌ 脚本执行失败:', error);
        process.exit(1);
    });
