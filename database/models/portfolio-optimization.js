const { db } = require('../connection');

/**
 * 组合优化模型
 */
const portfolioOptimizationModel = {
    /**
     * 创建组合优化记录
     */
    create(userId, analysisContent, portfolioSummary, optimizationType = 'manual') {
        const stmt = db.prepare(`
            INSERT INTO portfolio_optimizations
            (user_id, analysis_content, portfolio_summary, optimization_type, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            userId,
            analysisContent,
            JSON.stringify(portfolioSummary),
            optimizationType,
            new Date().toISOString()
        );

        return info.lastInsertRowid;
    },

    /**
     * 获取用户的组合优化记录列表
     */
    getByUserId(userId, limit = 30) {
        const stmt = db.prepare(`
            SELECT
                id,
                optimization_type,
                created_at
            FROM portfolio_optimizations
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `);

        return stmt.all(userId, limit);
    },

    /**
     * 获取单个组合优化记录详情
     */
    getById(id) {
        const stmt = db.prepare(`
            SELECT
                id,
                user_id,
                analysis_content,
                portfolio_summary,
                optimization_type,
                created_at
            FROM portfolio_optimizations
            WHERE id = ?
        `);

        return stmt.get(id);
    },

    /**
     * 删除组合优化记录
     */
    delete(id) {
        const stmt = db.prepare(`
            DELETE FROM portfolio_optimizations
            WHERE id = ?
        `);

        return stmt.run(id);
    },

    /**
     * 获取最新的组合优化记录
     */
    getLatest(userId) {
        const stmt = db.prepare(`
            SELECT
                id,
                user_id,
                analysis_content,
                portfolio_summary,
                optimization_type,
                created_at
            FROM portfolio_optimizations
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `);

        return stmt.get(userId);
    }
};

module.exports = { portfolioOptimizationModel };
