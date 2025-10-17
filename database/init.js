const { db } = require('./connection');

// 初始化数据库表
function initDatabase() {
    return new Promise((resolve, reject) => {
        try {
            // 创建用户表
            db.prepare(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                account TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                avatar TEXT,
                role TEXT NOT NULL DEFAULT 'user',
                total_capital REAL DEFAULT 0,
                registerTime TEXT NOT NULL,
                lastLogin TEXT NOT NULL
            )`).run();

            // 创建用户持仓数据表
            db.prepare(`CREATE TABLE IF NOT EXISTS user_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stockCode TEXT NOT NULL,
                stockName TEXT NOT NULL,
                quantity REAL NOT NULL,
                costPrice REAL NOT NULL,
                currentPrice REAL NOT NULL,
                marketValue REAL NOT NULL,
                profitLoss REAL NOT NULL,
                profitLossRate REAL NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, stockCode)
            )`).run();

            // 创建用户持仓更新时间记录表
            db.prepare(`CREATE TABLE IF NOT EXISTS user_position_updates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                updateTime TEXT NOT NULL,
                fileName TEXT,
                status TEXT NOT NULL DEFAULT 'success',
                errorMessage TEXT,
                totalRecords INTEGER DEFAULT 0,
                successRecords INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建用户自选股表
            db.prepare(`CREATE TABLE IF NOT EXISTS user_watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stock_code TEXT NOT NULL,
                stock_name TEXT NOT NULL,
                added_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, stock_code)
            )`).run();

            // 创建持仓分析报告表
            db.prepare(`CREATE TABLE IF NOT EXISTS analysis_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                analysis_content TEXT NOT NULL,
                portfolio_summary TEXT NOT NULL,
                report_type TEXT NOT NULL DEFAULT 'manual',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建集合竞价分析表
            db.prepare(`CREATE TABLE IF NOT EXISTS call_auction_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_date TEXT NOT NULL UNIQUE,
                analysis_content TEXT NOT NULL,
                market_summary TEXT NOT NULL,
                analysis_type TEXT NOT NULL DEFAULT 'manual',
                created_at TEXT NOT NULL
            )`).run();

            // 创建股票推荐表
            db.prepare(`CREATE TABLE IF NOT EXISTS stock_recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recommendation_date TEXT NOT NULL UNIQUE,
                recommendation_content TEXT NOT NULL,
                market_data TEXT NOT NULL,
                recommendation_type TEXT NOT NULL DEFAULT 'manual',
                created_at TEXT NOT NULL
            )`).run();

            // 创建手动持仓表
            db.prepare(`CREATE TABLE IF NOT EXISTS manual_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stock_code TEXT NOT NULL,
                stock_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                cost_price REAL NOT NULL,
                buy_date TEXT NOT NULL,
                current_price REAL,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建交易操作记录表
            db.prepare(`CREATE TABLE IF NOT EXISTS trade_operations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                trade_type TEXT NOT NULL,
                trade_date TEXT NOT NULL,
                stock_code TEXT NOT NULL,
                stock_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                price REAL NOT NULL,
                fee REAL DEFAULT 0,
                amount REAL NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建交易计划表
            db.prepare(`CREATE TABLE IF NOT EXISTS trading_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stock_code TEXT NOT NULL,
                stock_name TEXT NOT NULL,
                plan_type TEXT NOT NULL,
                plan_status TEXT NOT NULL DEFAULT 'pending',
                target_price REAL NOT NULL,
                current_price REAL,
                stop_profit_price REAL,
                stop_loss_price REAL,
                quantity REAL,
                estimated_amount REAL,
                plan_date TEXT NOT NULL,
                created_at TEXT NOT NULL,
                executed_at TEXT,
                reason TEXT,
                notes TEXT,
                priority INTEGER DEFAULT 3,
                alert_enabled INTEGER DEFAULT 1,
                alert_range REAL DEFAULT 0.02,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建计划执行记录表
            db.prepare(`CREATE TABLE IF NOT EXISTS plan_executions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                execution_type TEXT NOT NULL,
                execution_price REAL NOT NULL,
                execution_quantity REAL NOT NULL,
                execution_amount REAL NOT NULL,
                execution_time TEXT NOT NULL,
                price_deviation REAL,
                notes TEXT,
                FOREIGN KEY (plan_id) REFERENCES trading_plans (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建持仓成本记录表 (用于记录每笔买入/卖出交易)
            db.prepare(`CREATE TABLE IF NOT EXISTS position_cost_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stock_code TEXT NOT NULL,
                stock_name TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                operation_date TEXT NOT NULL,
                quantity REAL NOT NULL,
                price REAL NOT NULL,
                amount REAL NOT NULL,
                commission_fee REAL DEFAULT 0,
                stamp_duty REAL DEFAULT 0,
                transfer_fee REAL DEFAULT 0,
                total_fee REAL DEFAULT 0,
                remaining_quantity REAL NOT NULL,
                t_plus_n_date TEXT NOT NULL,
                is_sellable INTEGER DEFAULT 0,
                notes TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建成本调整记录表 (用于记录分红、送股、配股等调整)
            db.prepare(`CREATE TABLE IF NOT EXISTS position_cost_adjustments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stock_code TEXT NOT NULL,
                stock_name TEXT NOT NULL,
                adjustment_type TEXT NOT NULL,
                adjustment_date TEXT NOT NULL,
                quantity_before REAL NOT NULL,
                quantity_after REAL NOT NULL,
                cost_before REAL NOT NULL,
                cost_after REAL NOT NULL,
                dividend_amount REAL DEFAULT 0,
                bonus_shares REAL DEFAULT 0,
                rights_shares REAL DEFAULT 0,
                rights_price REAL DEFAULT 0,
                description TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建资金账户表 (用于记录账户资金状态)
            db.prepare(`CREATE TABLE IF NOT EXISTS fund_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                total_assets REAL DEFAULT 0,
                cash_balance REAL DEFAULT 0,
                position_value REAL DEFAULT 0,
                frozen_funds REAL DEFAULT 0,
                available_funds REAL DEFAULT 0,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建资金流水记录表 (用于记录所有资金变动)
            db.prepare(`CREATE TABLE IF NOT EXISTS fund_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                transaction_type TEXT NOT NULL,
                amount REAL NOT NULL,
                balance_before REAL NOT NULL,
                balance_after REAL NOT NULL,
                transaction_date TEXT NOT NULL,
                stock_code TEXT,
                stock_name TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建交易日志表 (用于记录交易复盘、心得、分析等)
            db.prepare(`CREATE TABLE IF NOT EXISTS trading_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                log_date TEXT NOT NULL,
                log_type TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                tags TEXT,
                related_stock_codes TEXT,
                sentiment TEXT DEFAULT 'neutral',
                profit_loss REAL,
                is_important INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建股票池表 (用于管理不同类型的股票池)
            db.prepare(`CREATE TABLE IF NOT EXISTS stock_pools (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                pool_type TEXT NOT NULL DEFAULT 'custom',
                tags TEXT,
                filter_conditions TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, name)
            )`).run();

            // 创建股票池项目表 (用于存储股票池中的股票)
            db.prepare(`CREATE TABLE IF NOT EXISTS stock_pool_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pool_id INTEGER NOT NULL,
                stock_code TEXT NOT NULL,
                stock_name TEXT NOT NULL,
                added_price REAL DEFAULT 0,
                tags TEXT,
                notes TEXT,
                added_at TEXT NOT NULL,
                FOREIGN KEY (pool_id) REFERENCES stock_pools (id) ON DELETE CASCADE,
                UNIQUE(pool_id, stock_code)
            )`).run();

            // 为现有stock_pool_items表添加added_price字段（如果不存在）
            try {
                const columns = db.prepare(`PRAGMA table_info(stock_pool_items)`).all();
                const hasAddedPrice = columns.some(col => col.name === 'added_price');
                if (!hasAddedPrice) {
                    db.prepare(`ALTER TABLE stock_pool_items ADD COLUMN added_price REAL DEFAULT 0`).run();
                    console.log('✅ 已添加 added_price 字段到 stock_pool_items 表');
                }
            } catch (err) {
                console.log('⚠️ 添加 added_price 字段时出错（可能已存在）:', err.message);
            }

            // 创建AI提示词模板表 (用于管理各种AI场景的提示词)
            db.prepare(`CREATE TABLE IF NOT EXISTS ai_prompt_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scene_type TEXT NOT NULL UNIQUE,
                scene_name TEXT NOT NULL,
                category TEXT NOT NULL,
                system_prompt TEXT NOT NULL,
                user_prompt_template TEXT NOT NULL,
                variables TEXT,
                description TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )`).run();

            // 创建组合优化分析表 (用于记录投资组合优化建议)
            db.prepare(`CREATE TABLE IF NOT EXISTS portfolio_optimizations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                analysis_content TEXT NOT NULL,
                portfolio_summary TEXT NOT NULL,
                optimization_type TEXT NOT NULL DEFAULT 'manual',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建风险控制规则表 (用于存储用户的风险控制配置)
            db.prepare(`CREATE TABLE IF NOT EXISTS risk_control_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                rules_config TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建风险预警表 (用于记录触发的风险预警)
            db.prepare(`CREATE TABLE IF NOT EXISTS risk_warnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                warning_type TEXT NOT NULL,
                warning_level TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                related_stock_code TEXT,
                related_stock_name TEXT,
                trigger_value REAL,
                threshold_value REAL,
                is_read INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 创建风险事件表 (用于记录历史风险事件)
            db.prepare(`CREATE TABLE IF NOT EXISTS risk_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                event_level TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                related_stock_code TEXT,
                related_stock_name TEXT,
                event_data TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`).run();

            // 初始化默认AI提示词模板
            const { aiPromptTemplateModel } = require('./models/ai-prompt');
            aiPromptTemplateModel.initDefaultTemplates();

            // 检查是否需要插入默认用户
            const row = db.prepare("SELECT COUNT(*) as count FROM users").get();

            if (row.count === 0) {
                // 插入默认管理员用户
                const defaultUsers = [
                    {
                        username: 'admin',
                        account: 'admin',
                        password: '$2a$10$B8axSY5g4BF.1uT8c2sJh.xIQSuECdTn..wQe4Edi0TdpDZGcfZca', // admin
                        email: 'admin@stock.com',
                        avatar: '/assets/avatars/admin.png',
                        role: 'super_admin',
                        registerTime: new Date('2024-01-01').toISOString(),
                        lastLogin: new Date().toISOString()
                    },
                    {
                        username: '测试管理员',
                        account: 'manager',
                        password: '$2a$10$B8axSY5g4BF.1uT8c2sJh.xIQSuECdTn..wQe4Edi0TdpDZGcfZca', // admin
                        email: 'manager@stock.com',
                        avatar: '/assets/avatars/user2.png',
                        role: 'admin',
                        registerTime: new Date('2024-01-02').toISOString(),
                        lastLogin: new Date().toISOString()
                    }
                ];

                const stmt = db.prepare(`INSERT INTO users
                    (username, account, password, email, avatar, role, registerTime, lastLogin)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

                defaultUsers.forEach(user => {
                    stmt.run(
                        user.username,
                        user.account,
                        user.password,
                        user.email,
                        user.avatar,
                        user.role,
                        user.registerTime,
                        user.lastLogin
                    );
                });

                console.log('✅ 默认用户数据初始化完成');
            } else {
                console.log('✅ 数据库已存在用户数据');
            }

            resolve();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { initDatabase };
