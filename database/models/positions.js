/**
 * 统一持仓模型
 * 合并了原来的 position.js 和 trade.js 中的持仓管理功能
 */

const { db } = require('../index');

const PositionsModel = {
    /**
     * 获取用户的所有持仓
     * @param {number} userId - 用户ID
     * @param {string} source - 数据来源筛选 ('auto', 'manual', null=全部)
     */
    getAll(userId, source = null) {
        try {
            let sql = 'SELECT * FROM positions WHERE user_id = ? AND quantity > 0';
            let params = [userId];

            if (source) {
                sql += ' AND source = ?';
                params.push(source);
            }

            sql += ' ORDER BY updated_at DESC';

            const rows = db.prepare(sql).all(...params);
            return rows;
        } catch (error) {
            console.error('获取持仓列表失败:', error);
            throw error;
        }
    },

    /**
     * 根据股票代码获取持仓
     */
    getByStockCode(userId, stockCode) {
        try {
            const row = db.prepare(`
                SELECT * FROM positions
                WHERE user_id = ? AND stock_code = ?
            `).get(userId, stockCode);
            return row;
        } catch (error) {
            console.error('获取持仓详情失败:', error);
            throw error;
        }
    },

    /**
     * 创建或更新持仓
     * @param {object} data - 持仓数据
     */
    upsert(data) {
        try {
            const {
                user_id,
                stock_code,
                stock_name,
                quantity,
                cost_price,
                current_price = null,
                market_value = null,
                profit_loss = null,
                profit_loss_rate = null,
                buy_date = null,
                notes = null,
                source = 'manual'
            } = data;

            // 检查是否已存在
            const existing = this.getByStockCode(user_id, stock_code);

            if (existing) {
                // 更新现有记录
                const info = db.prepare(`
                    UPDATE positions SET
                        stock_name = ?,
                        quantity = ?,
                        cost_price = ?,
                        current_price = ?,
                        market_value = ?,
                        profit_loss = ?,
                        profit_loss_rate = ?,
                        buy_date = ?,
                        notes = ?,
                        source = ?,
                        updated_at = datetime('now', 'localtime')
                    WHERE user_id = ? AND stock_code = ?
                `).run(
                    stock_name,
                    quantity,
                    cost_price,
                    current_price,
                    market_value,
                    profit_loss,
                    profit_loss_rate,
                    buy_date,
                    notes,
                    source,
                    user_id,
                    stock_code
                );

                return { id: existing.id, changes: info.changes };
            } else {
                // 插入新记录
                const info = db.prepare(`
                    INSERT INTO positions (
                        user_id, stock_code, stock_name, quantity, cost_price,
                        current_price, market_value, profit_loss, profit_loss_rate,
                        buy_date, notes, source
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    user_id,
                    stock_code,
                    stock_name,
                    quantity,
                    cost_price,
                    current_price,
                    market_value,
                    profit_loss,
                    profit_loss_rate,
                    buy_date,
                    notes,
                    source
                );

                return { id: info.lastInsertRowid, changes: info.changes };
            }
        } catch (error) {
            console.error('保存持仓失败:', error);
            throw error;
        }
    },

    /**
     * 批量更新价格和盈亏信息（用于自动更新）
     * @param {number} userId - 用户ID
     * @param {Array} updates - 更新数据数组 [{stock_code, current_price, market_value, profit_loss, profit_loss_rate}]
     */
    batchUpdatePrices(userId, updates) {
        try {
            const updateStmt = db.prepare(`
                UPDATE positions SET
                    current_price = ?,
                    market_value = ?,
                    profit_loss = ?,
                    profit_loss_rate = ?,
                    updated_at = datetime('now', 'localtime')
                WHERE user_id = ? AND stock_code = ?
            `);

            const transaction = db.transaction((updates) => {
                for (const update of updates) {
                    updateStmt.run(
                        update.current_price,
                        update.market_value,
                        update.profit_loss,
                        update.profit_loss_rate,
                        userId,
                        update.stock_code
                    );
                }
            });

            transaction(updates);
            return { success: true, count: updates.length };
        } catch (error) {
            console.error('批量更新价格失败:', error);
            throw error;
        }
    },

    /**
     * 删除持仓
     */
    delete(userId, stockCode) {
        try {
            const info = db.prepare(`
                DELETE FROM positions
                WHERE user_id = ? AND stock_code = ?
            `).run(userId, stockCode);

            return { changes: info.changes };
        } catch (error) {
            console.error('删除持仓失败:', error);
            throw error;
        }
    },

    /**
     * 清空用户所有持仓
     */
    deleteAll(userId) {
        try {
            const info = db.prepare(`
                DELETE FROM positions WHERE user_id = ?
            `).run(userId);

            return { changes: info.changes };
        } catch (error) {
            console.error('清空持仓失败:', error);
            throw error;
        }
    },

    /**
     * 更新持仓数量（买入/卖出）
     * @param {object} data - 交易数据
     */
    updateQuantity(data) {
        try {
            const { user_id, stock_code, stock_name, quantity, price, action } = data;

            const existing = this.getByStockCode(user_id, stock_code);

            if (action === 'buy') {
                // 买入：增加持仓或创建新持仓
                if (existing) {
                    const newQuantity = existing.quantity + quantity;
                    const newCost = (existing.cost_price * existing.quantity + price * quantity) / newQuantity;

                    return this.upsert({
                        user_id,
                        stock_code,
                        stock_name,
                        quantity: newQuantity,
                        cost_price: newCost,
                        current_price: price,
                        source: existing.source
                    });
                } else {
                    return this.upsert({
                        user_id,
                        stock_code,
                        stock_name,
                        quantity,
                        cost_price: price,
                        current_price: price,
                        buy_date: new Date().toISOString().split('T')[0],
                        source: 'manual'
                    });
                }
            } else if (action === 'sell') {
                // 卖出：减少持仓
                if (existing) {
                    const newQuantity = existing.quantity - quantity;

                    if (newQuantity <= 0) {
                        // 全部卖出，删除持仓
                        return this.delete(user_id, stock_code);
                    } else {
                        // 部分卖出，更新数量
                        return this.upsert({
                            ...existing,
                            quantity: newQuantity,
                            current_price: price
                        });
                    }
                } else {
                    throw new Error('持仓不存在，无法卖出');
                }
            }
        } catch (error) {
            console.error('更新持仓数量失败:', error);
            throw error;
        }
    },

    /**
     * 获取持仓统计信息
     */
    getStats(userId) {
        try {
            const stats = db.prepare(`
                SELECT
                    COUNT(*) as total_count,
                    SUM(CASE WHEN source = 'auto' THEN 1 ELSE 0 END) as auto_count,
                    SUM(CASE WHEN source = 'manual' THEN 1 ELSE 0 END) as manual_count,
                    SUM(quantity) as total_quantity,
                    SUM(market_value) as total_market_value,
                    SUM(profit_loss) as total_profit_loss
                FROM positions
                WHERE user_id = ? AND quantity > 0
            `).get(userId);

            return stats;
        } catch (error) {
            console.error('获取持仓统计失败:', error);
            throw error;
        }
    }
};

module.exports = PositionsModel;
