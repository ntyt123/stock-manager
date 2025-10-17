const { db } = require('../connection');

// 持仓成本记录相关数据库操作
const positionCostRecordModel = {
    // 添加成本记录
    add: (userId, recordData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const {
                    stockCode, stockName, operationType, operationDate, quantity, price, amount,
                    commissionFee, stampDuty, transferFee, totalFee, remainingQuantity,
                    tPlusNDate, isSellable, notes
                } = recordData;

                const info = db.prepare(`INSERT INTO position_cost_records
                    (user_id, stock_code, stock_name, operation_type, operation_date, quantity, price, amount,
                     commission_fee, stamp_duty, transfer_fee, total_fee, remaining_quantity,
                     t_plus_n_date, is_sellable, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                    userId, stockCode, stockName, operationType, operationDate, quantity, price, amount,
                    commissionFee || 0, stampDuty || 0, transferFee || 0, totalFee || 0, remainingQuantity,
                    tPlusNDate, isSellable ? 1 : 0, notes || null, currentTime
                );

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户某只股票的所有成本记录
    findByStockCode: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM position_cost_records
                    WHERE user_id = ? AND stock_code = ?
                    ORDER BY operation_date DESC, created_at DESC`).all(userId, stockCode);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户所有持仓的成本记录
    findByUserId: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM position_cost_records
                    WHERE user_id = ?
                    ORDER BY operation_date DESC, created_at DESC`).all(userId);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新记录的剩余数量
    updateRemainingQuantity: (recordId, remainingQuantity, isSellable) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`UPDATE position_cost_records
                    SET remaining_quantity = ?, is_sellable = ?
                    WHERE id = ?`).run(remainingQuantity, isSellable ? 1 : 0, recordId);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除成本记录
    delete: (recordId) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM position_cost_records WHERE id = ?`).run(recordId);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 计算加权平均成本
    calculateWeightedAverage: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`SELECT
                    SUM(remaining_quantity) as total_quantity,
                    SUM((price * remaining_quantity) + total_fee) / NULLIF(SUM(remaining_quantity), 0) as avg_cost
                    FROM position_cost_records
                    WHERE user_id = ? AND stock_code = ? AND remaining_quantity > 0`).get(userId, stockCode);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    }
};

// 成本调整记录相关数据库操作
const positionCostAdjustmentModel = {
    // 添加调整记录
    add: (userId, adjustmentData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const {
                    stockCode, stockName, adjustmentType, adjustmentDate,
                    quantityBefore, quantityAfter, costBefore, costAfter,
                    dividendAmount, bonusShares, rightsShares, rightsPrice, description
                } = adjustmentData;

                const info = db.prepare(`INSERT INTO position_cost_adjustments
                    (user_id, stock_code, stock_name, adjustment_type, adjustment_date,
                     quantity_before, quantity_after, cost_before, cost_after,
                     dividend_amount, bonus_shares, rights_shares, rights_price, description, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                    userId, stockCode, stockName, adjustmentType, adjustmentDate,
                    quantityBefore, quantityAfter, costBefore, costAfter,
                    dividendAmount || 0, bonusShares || 0, rightsShares || 0, rightsPrice || 0,
                    description || null, currentTime
                );

                resolve({ id: info.lastInsertRowid, created_at: currentTime });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户某只股票的调整记录
    findByStockCode: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM position_cost_adjustments
                    WHERE user_id = ? AND stock_code = ?
                    ORDER BY adjustment_date DESC`).all(userId, stockCode);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 获取用户所有的调整记录
    findByUserId: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`SELECT * FROM position_cost_adjustments
                    WHERE user_id = ?
                    ORDER BY adjustment_date DESC`).all(userId);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除调整记录
    delete: (adjustmentId) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`DELETE FROM position_cost_adjustments WHERE id = ?`).run(adjustmentId);
                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    }
};

module.exports = {
    positionCostRecordModel,
    positionCostAdjustmentModel
};
