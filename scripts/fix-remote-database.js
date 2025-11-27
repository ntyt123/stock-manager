/**
 * 修复远程服务器数据库 - 创建买入点验证相关表
 * 运行方式: node scripts/fix-remote-database.js
 *
 * 用途: 在远程服务器上创建缺失的表结构
 * 说明: 此脚本是幂等的，可以安全地多次运行
 */

const { db } = require('../database');

async function fixRemoteDatabase() {
    try {
        console.log('========================================');
        console.log('🔧 开始修复远程数据库...');
        console.log('========================================\n');

        // 1. 检查表是否存在
        console.log('📊 检查数据库表状态...');

        const tables = db.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='table'
            AND name IN ('buy_point_validations', 'validation_configs')
        `).all();

        const existingTables = tables.map(t => t.name);
        console.log(`  现有表: ${existingTables.length > 0 ? existingTables.join(', ') : '无'}`);

        const needsBuyPointValidations = !existingTables.includes('buy_point_validations');
        const needsValidationConfigs = !existingTables.includes('validation_configs');

        if (!needsBuyPointValidations && !needsValidationConfigs) {
            console.log('\n✅ 所有表都已存在，无需修复！');
            return;
        }

        console.log(`  需要创建: ${[
            needsBuyPointValidations ? 'buy_point_validations' : null,
            needsValidationConfigs ? 'validation_configs' : null
        ].filter(Boolean).join(', ')}\n`);

        // 2. 创建 buy_point_validations 表
        if (needsBuyPointValidations) {
            console.log('📝 创建 buy_point_validations 表...');
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
            console.log('  ✅ buy_point_validations 表创建成功');

            // 创建索引
            console.log('  📑 创建索引...');
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_buy_validations_user_stock
                ON buy_point_validations(user_id, stock_code)
            `);
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_buy_validations_time
                ON buy_point_validations(validation_time)
            `);
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_buy_validations_score
                ON buy_point_validations(total_score DESC)
            `);
            console.log('  ✅ 索引创建成功\n');
        }

        // 3. 创建 validation_configs 表
        if (needsValidationConfigs) {
            console.log('📝 创建 validation_configs 表...');
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
            console.log('  ✅ validation_configs 表创建成功\n');
        }

        // 4. 插入默认配置（如果不存在）
        console.log('⚙️  检查默认配置...');
        const existingConfig = db.prepare('SELECT COUNT(*) as count FROM validation_configs').get();

        if (existingConfig.count === 0) {
            console.log('  📝 插入默认配置...');

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

            console.log('  ✅ 默认配置插入成功');
        } else {
            console.log(`  ℹ️  已存在 ${existingConfig.count} 个配置，跳过插入`);
        }

        // 5. 验证结果
        console.log('\n📊 验证修复结果...');
        const finalTables = db.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='table'
            AND name IN ('buy_point_validations', 'validation_configs')
        `).all();

        const finalTableNames = finalTables.map(t => t.name);
        console.log(`  ✅ 当前表: ${finalTableNames.join(', ')}`);

        const indexes = db.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='index'
            AND name LIKE 'idx_buy_validations_%'
        `).all();
        console.log(`  ✅ 索引数量: ${indexes.length}`);

        const configCount = db.prepare('SELECT COUNT(*) as count FROM validation_configs').get();
        console.log(`  ✅ 配置数量: ${configCount.count}`);

        console.log('\n========================================');
        console.log('✅ 远程数据库修复完成！');
        console.log('========================================\n');

    } catch (error) {
        console.error('\n========================================');
        console.error('❌ 修复失败:', error);
        console.error('========================================\n');
        throw error;
    }
}

// 执行修复
fixRemoteDatabase()
    .then(() => {
        console.log('✅ 脚本执行完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ 脚本执行失败:', error);
        process.exit(1);
    });
