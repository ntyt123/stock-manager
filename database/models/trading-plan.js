const { db } = require('../connection');
const { getNextTradingDay, isTradingDay } = require('../../utils/tradingCalendar');

// 交易计划相关数据库操作
const tradingPlanModel = {
    // 创建交易计划
    create: (userId, planData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const {
                    stock_code, stock_name, plan_type, plan_date,
                    target_price, current_price, stop_profit_price, stop_loss_price,
                    quantity, estimated_amount, reason, notes, priority,
                    alert_enabled, alert_range
                } = planData;

                const info = db.prepare(`INSERT INTO trading_plans
                    (user_id, stock_code, stock_name, plan_type, plan_status, target_price, current_price,
                     stop_profit_price, stop_loss_price, quantity, estimated_amount, plan_date, created_at,
                     reason, notes, priority, alert_enabled, alert_range)
                    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                    userId, stock_code, stock_name, plan_type, target_price, current_price || null,
                    stop_profit_price || null, stop_loss_price || null, quantity || null,
                    estimated_amount || null, plan_date, currentTime, reason || null, notes || null,
                    priority || 3, alert_enabled !== false ? 1 : 0, alert_range || 0.02
                );

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户的所有计划（带筛选和分页）
    findByUserId: (userId, filters = {}) => {
        return new Promise((resolve, reject) => {
            try {
                const { status, planType, stockCode, startDate, endDate, limit = 100, offset = 0 } = filters;

                let query = 'SELECT * FROM trading_plans WHERE user_id = ?';
                const params = [userId];

                if (status) {
                    query += ' AND plan_status = ?';
                    params.push(status);
                }
                if (planType) {
                    query += ' AND plan_type = ?';
                    params.push(planType);
                }
                if (stockCode) {
                    query += ' AND stock_code = ?';
                    params.push(stockCode);
                }
                if (startDate) {
                    query += ' AND plan_date >= ?';
                    params.push(startDate);
                }
                if (endDate) {
                    query += ' AND plan_date <= ?';
                    params.push(endDate);
                }

                query += ' ORDER BY plan_date DESC, priority DESC, created_at DESC LIMIT ? OFFSET ?';
                params.push(limit, offset);

                const rows = db.prepare(query).all(...params);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取今日计划（实际为下一个交易日的计划）
    getTodayPlans: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                // 判断今天是否为交易日
                const now = new Date();
                const today = now.toISOString().split('T')[0];
                let targetDate;

                if (isTradingDay(now)) {
                    // 如果今天是交易日，返回今天的计划
                    targetDate = today;
                } else {
                    // 如果今天不是交易日（周末或节假日），返回下一个交易日的计划
                    const nextTradingDay = getNextTradingDay(now);
                    targetDate = nextTradingDay.toISOString().split('T')[0];
                }

                console.log(`📅 获取交易计划 - 今天: ${today}, 目标日期: ${targetDate}`);

                const rows = db.prepare(`SELECT * FROM trading_plans
                    WHERE user_id = ? AND plan_date = ? AND plan_status = 'pending'
                    ORDER BY priority DESC, created_at ASC`).all(userId, targetDate);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取计划
    findById: (planId) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare('SELECT * FROM trading_plans WHERE id = ?').get(planId);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新计划
    update: (planId, planData) => {
        return new Promise((resolve, reject) => {
            try {
                const fields = [];
                const values = [];

                const allowedFields = [
                    'stock_code', 'stock_name', 'plan_type', 'plan_date', 'target_price',
                    'current_price', 'stop_profit_price', 'stop_loss_price', 'quantity',
                    'estimated_amount', 'reason', 'notes', 'priority', 'alert_enabled', 'alert_range'
                ];

                allowedFields.forEach(field => {
                    if (planData[field] !== undefined) {
                        fields.push(`${field} = ?`);
                        values.push(planData[field]);
                    }
                });

                if (fields.length === 0) {
                    resolve({ changes: 0 });
                    return;
                }

                values.push(planId);
                const query = `UPDATE trading_plans SET ${fields.join(', ')} WHERE id = ?`;
                const info = db.prepare(query).run(...values);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 执行计划
    execute: (planId, userId, executionData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const { executionType, executionPrice, executionQuantity, notes } = executionData;

                // 开始事务
                const executeTransaction = db.transaction(() => {
                    // 1. 更新计划状态为已执行
                    db.prepare(`UPDATE trading_plans SET plan_status = 'executed', executed_at = ? WHERE id = ?`)
                        .run(currentTime, planId);

                    // 2. 获取计划信息计算偏差
                    const plan = db.prepare('SELECT * FROM trading_plans WHERE id = ?').get(planId);
                    const executionAmount = executionPrice * executionQuantity;
                    const priceDeviation = ((executionPrice - plan.target_price) / plan.target_price * 100);

                    // 3. 插入执行记录
                    const info = db.prepare(`INSERT INTO plan_executions
                        (plan_id, user_id, execution_type, execution_price, execution_quantity,
                         execution_amount, execution_time, price_deviation, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                        planId, userId, executionType, executionPrice, executionQuantity,
                        executionAmount, currentTime, priceDeviation, notes || null
                    );

                    return {
                        executionId: info.lastInsertRowid,
                        plan: plan,
                        execution: {
                            id: info.lastInsertRowid,
                            execution_price: executionPrice,
                            execution_quantity: executionQuantity,
                            execution_amount: executionAmount,
                            price_deviation: priceDeviation,
                            execution_time: currentTime
                        }
                    };
                });

                const result = executeTransaction();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 取消计划
    cancel: (planId, reason) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`UPDATE trading_plans
                    SET plan_status = 'cancelled', notes = ?
                    WHERE id = ?`).run(reason || '用户取消', planId);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除计划
    delete: (planId) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare('DELETE FROM trading_plans WHERE id = ?').run(planId);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 批量操作
    batchOperate: (planIds, action, reason) => {
        return new Promise((resolve, reject) => {
            try {
                const batchTransaction = db.transaction(() => {
                    let processed = 0;
                    let failed = 0;

                    planIds.forEach(planId => {
                        try {
                            if (action === 'cancel') {
                                db.prepare(`UPDATE trading_plans SET plan_status = 'cancelled', notes = ? WHERE id = ?`)
                                    .run(reason || '批量取消', planId);
                            } else if (action === 'delete') {
                                db.prepare('DELETE FROM trading_plans WHERE id = ?').run(planId);
                            }
                            processed++;
                        } catch (err) {
                            failed++;
                        }
                    });

                    return { processed, failed };
                });

                const result = batchTransaction();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取计划统计
    getStatistics: (userId, days = 30) => {
        return new Promise((resolve, reject) => {
            try {
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                const startDateStr = startDate.toISOString().split('T')[0];

                // 总计划数和状态分布
                const statusStats = db.prepare(`SELECT plan_status, COUNT(*) as count
                    FROM trading_plans
                    WHERE user_id = ? AND created_at >= ?
                    GROUP BY plan_status`).all(userId, startDateStr);

                // 计划类型分布
                const typeStats = db.prepare(`SELECT plan_type, COUNT(*) as count
                    FROM trading_plans
                    WHERE user_id = ? AND created_at >= ?
                    GROUP BY plan_type`).all(userId, startDateStr);

                // 执行统计
                const executionStats = db.prepare(`SELECT
                    COUNT(*) as total_executions,
                    AVG(price_deviation) as avg_price_deviation,
                    MAX(price_deviation) as max_positive_deviation,
                    MIN(price_deviation) as max_negative_deviation
                    FROM plan_executions
                    WHERE user_id = ? AND execution_time >= ?`).get(userId, startDateStr);

                resolve({
                    statusStats,
                    typeStats,
                    executionStats
                });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 标记过期计划
    markExpiredPlans: () => {
        return new Promise((resolve, reject) => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const info = db.prepare(`UPDATE trading_plans
                    SET plan_status = 'expired'
                    WHERE plan_status = 'pending' AND plan_date < ?`).run(today);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    }
};

// 计划执行记录相关数据库操作
const planExecutionModel = {
    // 获取计划的所有执行记录
    findByPlanId: (planId) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM plan_executions
                    WHERE plan_id = ?
                    ORDER BY execution_time DESC`).all(planId);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户的所有执行记录
    findByUserId: (userId, limit = 50) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT pe.*, tp.stock_code, tp.stock_name, tp.plan_type
                    FROM plan_executions pe
                    JOIN trading_plans tp ON pe.plan_id = tp.id
                    WHERE pe.user_id = ?
                    ORDER BY pe.execution_time DESC
                    LIMIT ?`).all(userId, limit);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    }
};

module.exports = {
    tradingPlanModel,
    planExecutionModel
};
