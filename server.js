// ==================== 核心服务器文件 (精简版) ====================
// 所有路由已拆分到 routes/ 目录
// 所有业务逻辑已拆分到 controllers/ 目录

// 加载环境变量配置
require('dotenv').config({
    path: process.env.NODE_ENV === 'production'
        ? '.env.production'
        : '.env.development'
});

const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fileUpload = require('express-fileupload');
const cron = require('node-cron');
const { initDatabase, closeDatabase } = require('./database');
const migrator = require('./database/migrator');
const stockCache = require('./stockCache');
const { isTradingDay, getTodayString } = require('./utils/tradingCalendar');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'stock-manager-secret-key';

// ==================== 中间件配置 ====================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));

// JWT认证中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: '未提供认证令牌'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: '认证令牌无效或已过期'
            });
        }
        req.user = user;
        next();
    });
}

// ==================== 路由注册 ====================
// 注意：路由文件需要接收authenticateToken中间件作为参数
const authRoutes = require('./routes/auth')(JWT_SECRET);
const positionRoutes = require('./routes/positions')(authenticateToken);
const watchlistRoutes = require('./routes/watchlist')(authenticateToken);
const stockRoutes = require('./routes/stock')(authenticateToken);
const analysisRoutes = require('./routes/analysis')(authenticateToken);
const recommendationRoutes = require('./routes/recommendations')(authenticateToken);
const tradeRoutes = require('./routes/trades')(authenticateToken);
const newsRoutes = require('./routes/news')();
const cacheRoutes = require('./routes/cache')();
const aiRoutes = require('./routes/ai')(authenticateToken);
const tradingPlanRoutes = require('./routes/trading-plans')(authenticateToken);
const costManagementRoutes = require('./routes/cost-management')(authenticateToken);
const profitAnalysisRoutes = require('./routes/profit-analysis')(authenticateToken);
const fundManagementRoutes = require('./routes/fund-management')(authenticateToken);
const tradingLogsRoutes = require('./routes/trading-logs')(authenticateToken);
const stockPoolRoutes = require('./routes/stock-pool')(authenticateToken);
const marketSentimentRoutes = require('./routes/market-sentiment')(authenticateToken);
const aiPromptsRoutes = require('./routes/ai-prompts')(authenticateToken);
const riskControlRoutes = require('./routes/risk-control')(authenticateToken);
const fundamentalRoutes = require('./routes/fundamental')(authenticateToken);
const predictionRoutes = require('./routes/prediction')(authenticateToken);
const aiApiConfigRoutes = require('./routes/ai-api-config')(authenticateToken);
const recapRoutes = require('./routes/recap')(authenticateToken);
const reportRoutes = require('./routes/report')(authenticateToken);
const threeDaySelectionRoutes = require('./routes/three-day-selection')(authenticateToken);
const stopLossRoutes = require('./routes/stop-loss')(authenticateToken);
const priceAlertsRoutes = require('./routes/price-alerts')(authenticateToken);
const shortTermPoolRoutes = require('./routes/short-term-pool')(authenticateToken);
const shortTermRoutes = require('./routes/short-term')(authenticateToken);
const marketDataRoutes = require('./routes/market-data')(authenticateToken);
const buyPointValidationRoutes = require('./routes/buy-point-validation')(authenticateToken);

// 挂载路由
app.use('/api/auth', authRoutes);
app.use('/api', positionRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/trade-operations', tradeRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/trading-plans', tradingPlanRoutes);
app.use('/api/cost-management', costManagementRoutes);
app.use('/api/profit-analysis', profitAnalysisRoutes);
app.use('/api/fund-management', fundManagementRoutes);
app.use('/api/trading-logs', tradingLogsRoutes);
app.use('/api/stock-pool', stockPoolRoutes);
app.use('/api/market-sentiment', marketSentimentRoutes);
app.use('/api/ai-prompts', aiPromptsRoutes);
app.use('/api/risk-control', riskControlRoutes);
app.use('/api/fundamental', fundamentalRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/ai-api', aiApiConfigRoutes);
app.use('/api/recap', recapRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/three-day-selection', threeDaySelectionRoutes);
app.use('/api/stop-loss', stopLossRoutes);
app.use('/api/price-alerts', priceAlertsRoutes);
app.use('/api/short-term-pool', shortTermPoolRoutes);
app.use('/api/short-term', shortTermRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/buy-point-validation', buyPointValidationRoutes);

// ==================== 定时任务 ====================
// 每天下午5点自动分析持仓（仅A股交易日）
cron.schedule('0 17 * * 1-5', async () => {
    const today = getTodayString();

    // 检查是否为交易日
    if (!isTradingDay()) {
        console.log(`⏰ ${today} 不是交易日，跳过持仓分析`);
        return;
    }

    console.log(`⏰ ${today} 开始定时持仓分析...`);
    try {
        // 调用持仓分析任务（需要从controllers导入）
        const { runScheduledPortfolioAnalysis } = require('./controllers/analysisController');
        await runScheduledPortfolioAnalysis();
    } catch (error) {
        console.error('❌ 定时持仓分析失败:', error.message);
    }
});

// 每天早上9:30自动分析集合竞价（仅A股交易日）
cron.schedule('30 9 * * 1-5', async () => {
    const today = getTodayString();

    // 检查是否为交易日
    if (!isTradingDay()) {
        console.log(`⏰ ${today} 不是交易日，跳过集合竞价分析`);
        return;
    }

    console.log(`⏰ ${today} 开始定时集合竞价分析...`);
    try {
        const { runScheduledCallAuctionAnalysis } = require('./controllers/analysisController');
        await runScheduledCallAuctionAnalysis();
    } catch (error) {
        console.error('❌ 定时集合竞价分析失败:', error.message);
    }
});

// 每天下午2:59捕获市场统计数据（收盘前一分钟，仅A股交易日）
cron.schedule('59 14 * * 1-5', async () => {
    const today = getTodayString();

    // 检查是否为交易日
    if (!isTradingDay()) {
        console.log(`⏰ ${today} 不是交易日，跳过市场统计捕获`);
        return;
    }

    console.log(`⏰ ${today} 14:59 开始捕获市场统计数据...`);
    try {
        const { fetchMarketStats } = require('./scheduled-tasks/capture-market-stats');
        await fetchMarketStats();
    } catch (error) {
        console.error('❌ 定时捕获市场统计失败:', error.message);
    }
}, {
    timezone: 'Asia/Shanghai'
});

// 交易时间内每5分钟检查止盈止损条件
cron.schedule('*/5 * * * *', async () => {
    const now = new Date();
    const day = now.getDay(); // 0=周日, 1-5=周一到周五, 6=周六
    const hour = now.getHours();
    const minute = now.getMinutes();

    // 跳过周末
    if (day === 0 || day === 6) {
        return;
    }

    // 检查是否在交易时间（9:30-11:30, 13:00-15:00）
    const morningTrade = (hour === 9 && minute >= 30) || (hour === 10) || (hour === 11 && minute < 30);
    const afternoonTrade = (hour === 13) || (hour === 14);

    if (morningTrade || afternoonTrade) {
        try {
            const { checkStopLossConditions } = require('./scheduled-tasks/monitor-stop-loss');
            await checkStopLossConditions();
        } catch (error) {
            console.error('❌ 价格监控检查失败:', error.message);
        }
    }
}, {
    timezone: 'Asia/Shanghai'
});

// ==================== 数据库初始化和服务器启动 ====================
(async () => {
    try {
        // 执行数据库迁移
        console.log('📦 检查数据库迁移...');
        await migrator.runPendingMigrations();

        // 初始化数据库（包含默认数据和AI提示词）
        await initDatabase();

        // 启动服务器 - 监听所有网络接口
        app.listen(PORT, '0.0.0.0', () => {
            console.log('🚀 个人股票信息系统服务器已启动');
            console.log(`📍 本地访问: http://localhost:${PORT}`);
            console.log(`🌐 网络访问: http://<服务器IP>:${PORT}`);
            console.log(`🔌 监听地址: 0.0.0.0:${PORT} (所有网络接口)`);
            console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}`);
            console.log(`💾 数据存储: SQLite数据库 (stock_manager.db)`);
            console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('❌ 服务器启动失败:', error.message);
        process.exit(1);
    }
})();

// ==================== 优雅退出 ====================
process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭服务器...');
    closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 正在关闭服务器...');
    closeDatabase();
    process.exit(0);
});

// 导出app供测试使用
module.exports = app;
