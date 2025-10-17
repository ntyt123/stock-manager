// ==================== AI提示词变量替换系统 ====================
// 负责获取动态数据并替换提示词中的变量

const AIPromptVariables = {
    // 获取所有可用的数据
    async getAllData() {
        const token = localStorage.getItem('token');
        if (!token) {
            return null;
        }

        try {
            // 并行获取所有数据
            const [positions, watchlist, totalCapital, tradeRecords, marketData] = await Promise.all([
                this.getPositions(),
                this.getWatchlist(),
                this.getTotalCapital(),
                this.getRecentTrades(),
                this.getMarketData()
            ]);

            return {
                positions,
                watchlist,
                total_capital: totalCapital,
                trade_records: tradeRecords,
                market_data: marketData,
                date: this.getCurrentDate(),
                time: this.getCurrentTime(),
                profit_loss: this.calculateProfitLoss(positions)
            };
        } catch (error) {
            console.error('获取数据失败:', error);
            return null;
        }
    },

    // 获取持仓数据
    async getPositions() {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('/api/positions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return [];

            const result = await response.json();
            if (!result.success) return [];

            const positions = result.data.positions || [];

            // 格式化持仓数据
            return positions.map(p => ({
                code: p.stockCode,
                name: p.stockName,
                quantity: p.quantity,
                cost: p.costPrice,
                current: p.currentPrice,
                value: p.marketValue,
                profit: p.profitLoss,
                profitRate: p.profitLossRate
            }));
        } catch (error) {
            console.error('获取持仓数据失败:', error);
            return [];
        }
    },

    // 获取自选股列表
    async getWatchlist() {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('/api/watchlist', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return [];

            const result = await response.json();
            if (!result.success) return [];

            return (result.data || []).map(item => ({
                code: item.stock_code,
                name: item.stock_name
            }));
        } catch (error) {
            console.error('获取自选股失败:', error);
            return [];
        }
    },

    // 获取总资金
    getTotalCapital() {
        if (window.CapitalManager) {
            return window.CapitalManager.getTotalCapital() || 0;
        }
        return 0;
    },

    // 获取最近交易记录
    async getRecentTrades(limit = 10) {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('/api/trade-operations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return [];

            const result = await response.json();
            if (!result.success) return [];

            const trades = result.data || [];

            // 返回最近的记录
            return trades.slice(0, limit).map(t => ({
                date: t.trade_date,
                type: t.trade_type,
                code: t.stock_code,
                name: t.stock_name,
                quantity: t.quantity,
                price: t.price,
                amount: t.amount
            }));
        } catch (error) {
            console.error('获取交易记录失败:', error);
            return [];
        }
    },

    // 获取市场数据
    async getMarketData() {
        try {
            // 获取主要市场指数
            const indices = await this.getMarketIndices();

            return {
                indices: indices,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('获取市场数据失败:', error);
            return { indices: [], timestamp: new Date().toISOString() };
        }
    },

    // 获取市场指数
    async getMarketIndices() {
        try {
            // 主要指数代码
            const indexCodes = ['000001', '399001', '399006'];
            const indices = [];

            for (const code of indexCodes) {
                try {
                    const quote = await this.getStockQuote(code);
                    if (quote) {
                        indices.push(quote);
                    }
                } catch (err) {
                    console.warn(`获取指数 ${code} 失败:`, err);
                }
            }

            return indices;
        } catch (error) {
            return [];
        }
    },

    // 获取单只股票行情
    async getStockQuote(code) {
        try {
            const response = await fetch(`/api/stock/quote/${code}`);
            if (!response.ok) return null;

            const result = await response.json();
            if (!result.success) return null;

            const quote = result.data;
            return {
                code: quote.code,
                name: quote.name,
                price: quote.now,
                change: quote.changepercent,
                open: quote.open,
                high: quote.high,
                low: quote.low
            };
        } catch (error) {
            return null;
        }
    },

    // 计算盈亏
    calculateProfitLoss(positions) {
        if (!positions || positions.length === 0) {
            return {
                total: 0,
                percentage: 0,
                details: []
            };
        }

        let totalProfit = 0;
        let totalCost = 0;

        const details = positions.map(p => {
            const profit = p.profit || 0;
            const cost = (p.cost || 0) * (p.quantity || 0);

            totalProfit += profit;
            totalCost += cost;

            return {
                code: p.code,
                name: p.name,
                profit: profit,
                profitRate: p.profitRate || 0
            };
        });

        return {
            total: totalProfit,
            percentage: totalCost > 0 ? (totalProfit / totalCost * 100).toFixed(2) : 0,
            details: details
        };
    },

    // 获取当前日期
    getCurrentDate() {
        const now = new Date();
        return now.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    },

    // 获取当前时间
    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    // 替换提示词中的变量
    async replaceVariables(template, customData = {}) {
        if (!template) return '';

        // 获取所有数据
        const data = await this.getAllData();
        if (!data) {
            console.warn('无法获取数据，使用空值替换');
        }

        // 合并自定义数据
        const allData = { ...(data || {}), ...customData };

        // 替换变量
        let result = template;

        // 持仓数据
        if (result.includes('{positions}')) {
            result = result.replace('{positions}', this.formatPositions(allData.positions || []));
        }

        // 自选股
        if (result.includes('{watchlist}')) {
            result = result.replace('{watchlist}', this.formatWatchlist(allData.watchlist || []));
        }

        // 总资金
        if (result.includes('{total_capital}')) {
            result = result.replace('{total_capital}', this.formatNumber(allData.total_capital || 0));
        }

        // 盈亏信息
        if (result.includes('{profit_loss}')) {
            result = result.replace('{profit_loss}', this.formatProfitLoss(allData.profit_loss));
        }

        // 交易记录
        if (result.includes('{trade_records}')) {
            result = result.replace('{trade_records}', this.formatTradeRecords(allData.trade_records || []));
        }

        // 市场数据
        if (result.includes('{market_data}')) {
            result = result.replace('{market_data}', this.formatMarketData(allData.market_data));
        }

        // 指数数据
        if (result.includes('{indices}')) {
            result = result.replace('{indices}', this.formatIndices(allData.market_data?.indices || []));
        }

        // 日期时间
        if (result.includes('{date}')) {
            result = result.replace('{date}', allData.date || '');
        }

        if (result.includes('{time}')) {
            result = result.replace('{time}', allData.time || '');
        }

        return result;
    },

    // 格式化持仓数据
    formatPositions(positions) {
        if (!positions || positions.length === 0) {
            return '当前无持仓';
        }

        let text = `持仓股票共 ${positions.length} 只：\n\n`;
        positions.forEach((p, index) => {
            text += `${index + 1}. ${p.name}(${p.code})\n`;
            text += `   持仓数量: ${p.quantity} 股\n`;
            text += `   成本价: ¥${p.cost?.toFixed(2)}\n`;
            text += `   当前价: ¥${p.current?.toFixed(2)}\n`;
            text += `   市值: ¥${p.value?.toFixed(2)}\n`;
            text += `   盈亏: ¥${p.profit?.toFixed(2)} (${p.profitRate?.toFixed(2)}%)\n\n`;
        });

        return text;
    },

    // 格式化自选股
    formatWatchlist(watchlist) {
        if (!watchlist || watchlist.length === 0) {
            return '当前无自选股';
        }

        let text = `自选股共 ${watchlist.length} 只：\n`;
        watchlist.forEach((w, index) => {
            text += `${index + 1}. ${w.name}(${w.code})\n`;
        });

        return text;
    },

    // 格式化盈亏信息
    formatProfitLoss(profitLoss) {
        if (!profitLoss) {
            return '暂无盈亏数据';
        }

        let text = `总盈亏: ¥${profitLoss.total?.toFixed(2)} (${profitLoss.percentage}%)\n\n`;

        if (profitLoss.details && profitLoss.details.length > 0) {
            text += '个股盈亏详情：\n';
            profitLoss.details.forEach(d => {
                text += `- ${d.name}(${d.code}): ¥${d.profit?.toFixed(2)} (${d.profitRate?.toFixed(2)}%)\n`;
            });
        }

        return text;
    },

    // 格式化交易记录
    formatTradeRecords(records) {
        if (!records || records.length === 0) {
            return '暂无交易记录';
        }

        let text = `最近 ${records.length} 笔交易：\n\n`;
        records.forEach((r, index) => {
            const typeText = { buy: '买入', sell: '卖出', add: '加仓', reduce: '减仓' }[r.type] || r.type;
            text += `${index + 1}. ${r.date} ${typeText} ${r.name}(${r.code})\n`;
            text += `   数量: ${r.quantity} 股, 价格: ¥${r.price}, 金额: ¥${r.amount?.toFixed(2)}\n\n`;
        });

        return text;
    },

    // 格式化市场数据
    formatMarketData(marketData) {
        if (!marketData) {
            return '暂无市场数据';
        }

        let text = `市场数据 (${marketData.timestamp}):\n\n`;

        if (marketData.indices && marketData.indices.length > 0) {
            text += this.formatIndices(marketData.indices);
        }

        return text;
    },

    // 格式化指数数据
    formatIndices(indices) {
        if (!indices || indices.length === 0) {
            return '暂无指数数据';
        }

        let text = '主要指数：\n';
        indices.forEach(idx => {
            const changeSign = idx.change >= 0 ? '+' : '';
            text += `- ${idx.name}(${idx.code}): ${idx.price} (${changeSign}${idx.change}%)\n`;
        });

        return text;
    },

    // 格式化数字
    formatNumber(num) {
        if (!num) return '0';
        return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
};

// 导出到全局
window.AIPromptVariables = AIPromptVariables;
