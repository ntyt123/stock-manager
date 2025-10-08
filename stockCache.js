// 股票数据缓存模块
class StockCache {
    constructor() {
        // 缓存存储：{ stockCode: { data, timestamp, expiresAt } }
        this.quoteCache = new Map();
        this.historyCache = new Map();
    }

    /**
     * 判断当前是否为交易时间
     * 交易日：周一至周五
     * 交易时间：9:30-11:30, 13:00-15:00
     */
    isTradeTime() {
        const now = new Date();
        const day = now.getDay(); // 0=周日, 1=周一, ..., 6=周六

        // 周末不是交易时间
        if (day === 0 || day === 6) {
            return false;
        }

        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeInMinutes = hours * 60 + minutes;

        // 上午交易时间：9:30-11:30 (570-690分钟)
        const morningStart = 9 * 60 + 30;  // 570
        const morningEnd = 11 * 60 + 30;   // 690

        // 下午交易时间：13:00-15:00 (780-900分钟)
        const afternoonStart = 13 * 60;     // 780
        const afternoonEnd = 15 * 60;       // 900

        return (timeInMinutes >= morningStart && timeInMinutes <= morningEnd) ||
               (timeInMinutes >= afternoonStart && timeInMinutes <= afternoonEnd);
    }

    /**
     * 计算缓存过期时间
     * 交易时间：30秒后过期
     * 非交易时间：缓存到下一个交易时段开始
     */
    getCacheExpireTime() {
        const now = new Date();

        if (this.isTradeTime()) {
            // 交易时间：缓存30秒
            return now.getTime() + 30 * 1000;
        } else {
            // 非交易时间：缓存到下一个交易时段
            return this.getNextTradeTimeStart();
        }
    }

    /**
     * 获取下一个交易时段的开始时间
     */
    getNextTradeTimeStart() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const day = now.getDay();

        // 克隆当前时间用于计算
        let nextTradeTime = new Date(now);

        // 如果是工作日
        if (day >= 1 && day <= 5) {
            // 早于9:30，返回今天9:30
            if (hours < 9 || (hours === 9 && minutes < 30)) {
                nextTradeTime.setHours(9, 30, 0, 0);
                return nextTradeTime.getTime();
            }
            // 11:30-13:00之间，返回今天13:00
            else if ((hours === 11 && minutes >= 30) || (hours === 12) || (hours === 13 && minutes === 0)) {
                nextTradeTime.setHours(13, 0, 0, 0);
                return nextTradeTime.getTime();
            }
            // 15:00之后，返回下一个工作日9:30
            else if (hours >= 15) {
                nextTradeTime = this.getNextWorkday(nextTradeTime);
                nextTradeTime.setHours(9, 30, 0, 0);
                return nextTradeTime.getTime();
            }
        }

        // 周末，返回下周一9:30
        if (day === 0 || day === 6) {
            nextTradeTime = this.getNextWorkday(nextTradeTime);
            nextTradeTime.setHours(9, 30, 0, 0);
            return nextTradeTime.getTime();
        }

        // 默认返回明天9:30（不应该到这里）
        nextTradeTime.setDate(nextTradeTime.getDate() + 1);
        nextTradeTime.setHours(9, 30, 0, 0);
        return nextTradeTime.getTime();
    }

    /**
     * 获取下一个工作日
     */
    getNextWorkday(date) {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        // 如果是周六，跳到周一
        if (nextDay.getDay() === 6) {
            nextDay.setDate(nextDay.getDate() + 2);
        }
        // 如果是周日，跳到周一
        else if (nextDay.getDay() === 0) {
            nextDay.setDate(nextDay.getDate() + 1);
        }

        return nextDay;
    }

    /**
     * 获取实时行情缓存
     */
    getQuote(stockCode) {
        const cached = this.quoteCache.get(stockCode);

        if (!cached) {
            return null;
        }

        const now = Date.now();

        // 检查是否过期
        if (now > cached.expiresAt) {
            this.quoteCache.delete(stockCode);
            return null;
        }

        console.log(`📦 使用缓存的行情数据: ${stockCode}, 剩余有效时间: ${Math.floor((cached.expiresAt - now) / 1000)}秒`);
        return cached.data;
    }

    /**
     * 设置实时行情缓存
     */
    setQuote(stockCode, data) {
        const expiresAt = this.getCacheExpireTime();
        const now = Date.now();
        const ttl = Math.floor((expiresAt - now) / 1000);

        this.quoteCache.set(stockCode, {
            data,
            timestamp: now,
            expiresAt
        });

        console.log(`💾 缓存行情数据: ${stockCode}, 有效期: ${ttl}秒 (${this.isTradeTime() ? '交易时间' : '非交易时间'})`);
    }

    /**
     * 批量获取行情缓存
     */
    getQuotes(stockCodes) {
        const result = {
            cached: [],
            missing: []
        };

        for (const code of stockCodes) {
            const cached = this.getQuote(code);
            if (cached) {
                result.cached.push({ stockCode: code, data: cached });
            } else {
                result.missing.push(code);
            }
        }

        return result;
    }

    /**
     * 批量设置行情缓存
     */
    setQuotes(quotes) {
        for (const quote of quotes) {
            this.setQuote(quote.stockCode, quote);
        }
    }

    /**
     * 获取历史数据缓存
     */
    getHistory(stockCode, days) {
        const key = `${stockCode}_${days}`;
        const cached = this.historyCache.get(key);

        if (!cached) {
            return null;
        }

        const now = Date.now();

        // 检查是否过期
        if (now > cached.expiresAt) {
            this.historyCache.delete(key);
            return null;
        }

        console.log(`📦 使用缓存的历史数据: ${stockCode} (${days}天), 剩余有效时间: ${Math.floor((cached.expiresAt - now) / 1000)}秒`);
        return cached.data;
    }

    /**
     * 设置历史数据缓存
     */
    setHistory(stockCode, days, data) {
        const key = `${stockCode}_${days}`;
        const expiresAt = this.getCacheExpireTime();
        const now = Date.now();
        const ttl = Math.floor((expiresAt - now) / 1000);

        this.historyCache.set(key, {
            data,
            timestamp: now,
            expiresAt
        });

        console.log(`💾 缓存历史数据: ${stockCode} (${days}天), 有效期: ${ttl}秒 (${this.isTradeTime() ? '交易时间' : '非交易时间'})`);
    }

    /**
     * 清空所有缓存
     */
    clearAll() {
        this.quoteCache.clear();
        this.historyCache.clear();
        console.log('🗑️ 已清空所有缓存');
    }

    /**
     * 清理过期缓存（定期调用）
     */
    cleanExpired() {
        const now = Date.now();
        let cleanedCount = 0;

        // 清理过期的行情缓存
        for (const [key, value] of this.quoteCache.entries()) {
            if (now > value.expiresAt) {
                this.quoteCache.delete(key);
                cleanedCount++;
            }
        }

        // 清理过期的历史数据缓存
        for (const [key, value] of this.historyCache.entries()) {
            if (now > value.expiresAt) {
                this.historyCache.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`🧹 清理了 ${cleanedCount} 条过期缓存`);
        }
    }

    /**
     * 获取缓存统计信息
     */
    getStats() {
        return {
            quoteCount: this.quoteCache.size,
            historyCount: this.historyCache.size,
            isTradeTime: this.isTradeTime()
        };
    }
}

// 创建单例
const stockCache = new StockCache();

// 每5分钟清理一次过期缓存
setInterval(() => {
    stockCache.cleanExpired();
}, 5 * 60 * 1000);

module.exports = stockCache;
