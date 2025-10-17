const { db } = require('../connection');

// 股票池相关数据库操作
const stockPoolModel = {
    // 获取用户的所有股票池
    findByUserId: (userId) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`
                    SELECT
                        sp.*,
                        COUNT(spi.id) as stock_count
                    FROM stock_pools sp
                    LEFT JOIN stock_pool_items spi ON sp.id = spi.pool_id
                    WHERE sp.user_id = ?
                    GROUP BY sp.id
                    ORDER BY sp.created_at DESC
                `).all(userId);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取股票池详情
    findById: (poolId, userId) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`
                    SELECT * FROM stock_pools
                    WHERE id = ? AND user_id = ?
                `).get(poolId, userId);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 创建股票池
    create: (userId, poolData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const { name, description, pool_type, tags, filter_conditions } = poolData;

                const info = db.prepare(`
                    INSERT INTO stock_pools (
                        user_id, name, description, pool_type, tags,
                        filter_conditions, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    userId,
                    name,
                    description || '',
                    pool_type || 'custom',
                    tags || '',
                    filter_conditions || '',
                    currentTime,
                    currentTime
                );

                resolve({ id: info.lastInsertRowid });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新股票池
    update: (poolId, userId, poolData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const { name, description, pool_type, tags, filter_conditions } = poolData;

                const info = db.prepare(`
                    UPDATE stock_pools
                    SET name = ?, description = ?, pool_type = ?,
                        tags = ?, filter_conditions = ?, updated_at = ?
                    WHERE id = ? AND user_id = ?
                `).run(
                    name,
                    description || '',
                    pool_type || 'custom',
                    tags || '',
                    filter_conditions || '',
                    currentTime,
                    poolId,
                    userId
                );

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 删除股票池
    delete: (poolId, userId) => {
        return new Promise((resolve, reject) => {
            try {
                // 先删除股票池中的所有股票
                db.prepare(`DELETE FROM stock_pool_items WHERE pool_id = ?`).run(poolId);

                // 再删除股票池
                const info = db.prepare(`
                    DELETE FROM stock_pools
                    WHERE id = ? AND user_id = ?
                `).run(poolId, userId);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 检查股票池名称是否已存在
    existsByName: (userId, name, excludePoolId = null) => {
        return new Promise((resolve, reject) => {
            try {
                let query = `SELECT COUNT(*) as count FROM stock_pools WHERE user_id = ? AND name = ?`;
                let params = [userId, name];

                if (excludePoolId) {
                    query += ` AND id != ?`;
                    params.push(excludePoolId);
                }

                const row = db.prepare(query).get(...params);
                resolve(row.count > 0);
            } catch (err) {
                reject(err);
            }
        });
    }
};

// 股票池项目相关数据库操作
const stockPoolItemModel = {
    // 获取股票池中的所有股票
    findByPoolId: (poolId) => {
        return new Promise((resolve, reject) => {
            try {
                const rows = db.prepare(`
                    SELECT * FROM stock_pool_items
                    WHERE pool_id = ?
                    ORDER BY added_at DESC
                `).all(poolId);
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 添加股票到股票池
    add: (poolId, stockData) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const { stock_code, stock_name, added_price, tags, notes } = stockData;

                const info = db.prepare(`
                    INSERT INTO stock_pool_items (
                        pool_id, stock_code, stock_name, added_price, tags, notes, added_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    poolId,
                    stock_code,
                    stock_name,
                    added_price || 0,
                    tags || '',
                    notes || '',
                    currentTime
                );

                resolve({ id: info.lastInsertRowid });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 批量添加股票到股票池
    batchAdd: (poolId, stocks) => {
        return new Promise((resolve, reject) => {
            try {
                const currentTime = new Date().toISOString();
                const stmt = db.prepare(`
                    INSERT INTO stock_pool_items (
                        pool_id, stock_code, stock_name, tags, notes, added_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `);

                const results = [];
                for (const stock of stocks) {
                    try {
                        const info = stmt.run(
                            poolId,
                            stock.stock_code,
                            stock.stock_name,
                            stock.tags || '',
                            stock.notes || '',
                            currentTime
                        );
                        results.push({ id: info.lastInsertRowid, success: true });
                    } catch (err) {
                        results.push({ stock_code: stock.stock_code, success: false, error: err.message });
                    }
                }

                resolve(results);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 更新股票池项目
    update: (itemId, poolId, stockData) => {
        return new Promise((resolve, reject) => {
            try {
                const { stock_name, tags, notes } = stockData;

                const info = db.prepare(`
                    UPDATE stock_pool_items
                    SET stock_name = ?, tags = ?, notes = ?
                    WHERE id = ? AND pool_id = ?
                `).run(
                    stock_name,
                    tags || '',
                    notes || '',
                    itemId,
                    poolId
                );

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 从股票池中删除股票
    delete: (itemId, poolId) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`
                    DELETE FROM stock_pool_items
                    WHERE id = ? AND pool_id = ?
                `).run(itemId, poolId);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据股票代码删除
    deleteByStockCode: (poolId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`
                    DELETE FROM stock_pool_items
                    WHERE pool_id = ? AND stock_code = ?
                `).run(poolId, stockCode);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 检查股票是否在股票池中
    exists: (poolId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`
                    SELECT COUNT(*) as count
                    FROM stock_pool_items
                    WHERE pool_id = ? AND stock_code = ?
                `).get(poolId, stockCode);

                resolve(row.count > 0);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 清空股票池
    clear: (poolId) => {
        return new Promise((resolve, reject) => {
            try {
                const info = db.prepare(`
                    DELETE FROM stock_pool_items WHERE pool_id = ?
                `).run(poolId);

                resolve({ changes: info.changes });
            } catch (err) {
                reject(err);
            }
        });
    },

    // 检查股票是否存在于用户的任何股票池中
    existsInUserPools: (userId, stockCode) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`
                    SELECT COUNT(*) as count
                    FROM stock_pool_items spi
                    INNER JOIN stock_pools sp ON spi.pool_id = sp.id
                    WHERE sp.user_id = ? AND spi.stock_code = ?
                `).get(userId, stockCode);

                resolve(row.count > 0);
            } catch (err) {
                reject(err);
            }
        });
    },

    // 根据ID获取股票项详情
    findById: (itemId, poolId) => {
        return new Promise((resolve, reject) => {
            try {
                const row = db.prepare(`
                    SELECT * FROM stock_pool_items
                    WHERE id = ? AND pool_id = ?
                `).get(itemId, poolId);
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    }
};

module.exports = { stockPoolModel, stockPoolItemModel };
