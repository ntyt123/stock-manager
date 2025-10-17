const { db } = require('../connection');

// 持仓分析报告相关数据库操作
const analysisReportModel = {
    // 保存分析报告（自动删除同一天的旧报告）
    save: (userId, analysisContent, portfolioSummary, reportType = 'manual') => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const summaryJson = JSON.stringify(portfolioSummary);
                const today = currentTime.split('T')[0]; // 获取日期部分 YYYY-MM-DD

                // 使用事务：先删除当天的旧报告，再插入新报告
                const saveWithDeduplication = db.transaction(() => {
                    // 删除当天该用户的所有报告
                    const deleteStmt = db.prepare(`DELETE FROM analysis_reports
                        WHERE user_id = ? AND DATE(created_at) = ?`);
                    const deleteResult = deleteStmt.run(userId, today);

                    if (deleteResult.changes > 0) {
                        console.log(`🗑️ 删除了用户 ${userId} 在 ${today} 的 ${deleteResult.changes} 份旧报告`);
                    }

                    // 插入新报告
                    const insertStmt = db.prepare(`INSERT INTO analysis_reports
                        (user_id, analysis_content, portfolio_summary, report_type, created_at)
                        VALUES (?, ?, ?, ?, ?)`);
                    const info = insertStmt.run(userId, analysisContent, summaryJson, reportType, currentTime);

                    return { id: info.lastInsertRowid, created_at: currentTime, deletedCount: deleteResult.changes };
                });

                const result = saveWithDeduplication();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户的分析报告列表（按日期倒序）
    findByUserId: (userId, limit = 30, offset = 0) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT id, report_type, created_at FROM analysis_reports
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?`).all(userId, limit, offset);

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取完整的分析报告
    findById: (reportId) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM analysis_reports WHERE id = ?`).get(reportId);

                if (row && row.portfolio_summary) {
                    // 将JSON字符串转换为对象
                    row.portfolio_summary = JSON.parse(row.portfolio_summary);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户最新的分析报告
    getLatest: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM analysis_reports
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT 1`).get(userId);

                if (row && row.portfolio_summary) {
                    row.portfolio_summary = JSON.parse(row.portfolio_summary);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除分析报告
    delete: (reportId) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM analysis_reports WHERE id = ?`).run(reportId);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取报告总数
    getCount: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT COUNT(*) as count FROM analysis_reports WHERE user_id = ?`).get(userId);
                resolve(row.count);
            } catch (err) {
                reject(err);
            }
        });
    }
};

// 集合竞价分析相关数据库操作
const callAuctionAnalysisModel = {
    // 保存集合竞价分析
    save: (analysisDate, analysisContent, marketSummary, analysisType = 'manual') => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const summaryJson = JSON.stringify(marketSummary);

                const info = db.prepare(`INSERT OR REPLACE INTO call_auction_analysis
                    (analysis_date, analysis_content, market_summary, analysis_type, created_at)
                    VALUES (?, ?, ?, ?, ?)`)
                    .run(analysisDate, analysisContent, summaryJson, analysisType, currentTime);

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取所有分析记录列表（按日期倒序）
    findAll: (limit = 30, offset = 0) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT id, analysis_date, analysis_type, created_at FROM call_auction_analysis
                    ORDER BY analysis_date DESC
                    LIMIT ? OFFSET ?`).all(limit, offset);

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据日期获取分析记录
    findByDate: (analysisDate) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM call_auction_analysis WHERE analysis_date = ?`).get(analysisDate);

                if (row && row.market_summary) {
                    // 将JSON字符串转换为对象
                    row.market_summary = JSON.parse(row.market_summary);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取完整的分析记录
    findById: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM call_auction_analysis WHERE id = ?`).get(id);

                if (row && row.market_summary) {
                    row.market_summary = JSON.parse(row.market_summary);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取最新的分析记录
    getLatest: () => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM call_auction_analysis
                    ORDER BY analysis_date DESC
                    LIMIT 1`).get();

                if (row && row.market_summary) {
                    row.market_summary = JSON.parse(row.market_summary);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除分析记录
    delete: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM call_auction_analysis WHERE id = ?`).run(id);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取记录总数
    getCount: () => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT COUNT(*) as count FROM call_auction_analysis`).get();
                resolve(row.count);
            } catch (err) {
                reject(err);
            }
        });
    }
};

// 股票推荐相关数据库操作
const stockRecommendationModel = {
    // 保存股票推荐
    save: (recommendationDate, recommendationContent, marketData, recommendationType = 'manual') => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const dataJson = JSON.stringify(marketData);

                const info = db.prepare(`INSERT OR REPLACE INTO stock_recommendations
                    (recommendation_date, recommendation_content, market_data, recommendation_type, created_at)
                    VALUES (?, ?, ?, ?, ?)`)
                    .run(recommendationDate, recommendationContent, dataJson, recommendationType, currentTime);

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取所有推荐记录列表（按日期倒序）
    findAll: (limit = 30, offset = 0) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT id, recommendation_date, recommendation_type, created_at FROM stock_recommendations
                    ORDER BY recommendation_date DESC
                    LIMIT ? OFFSET ?`).all(limit, offset);

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据日期获取推荐记录
    findByDate: (recommendationDate) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM stock_recommendations WHERE recommendation_date = ?`).get(recommendationDate);

                if (row && row.market_data) {
                    // 将JSON字符串转换为对象
                    row.market_data = JSON.parse(row.market_data);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取完整的推荐记录
    findById: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM stock_recommendations WHERE id = ?`).get(id);

                if (row && row.market_data) {
                    row.market_data = JSON.parse(row.market_data);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取最新的推荐记录
    getLatest: () => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT * FROM stock_recommendations
                    ORDER BY recommendation_date DESC
                    LIMIT 1`).get();

                if (row && row.market_data) {
                    row.market_data = JSON.parse(row.market_data);
                }

                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除推荐记录
    delete: (id) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM stock_recommendations WHERE id = ?`).run(id);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取记录总数
    getCount: () => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT COUNT(*) as count FROM stock_recommendations`).get();
                resolve(row.count);
            } catch (err) {
                reject(err);
            }
        });
    }
};

module.exports = {
    analysisReportModel,
    callAuctionAnalysisModel,
    stockRecommendationModel
};
