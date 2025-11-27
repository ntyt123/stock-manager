/**
 * 交易费用计算工具
 * 提供统一的交易手续费计算功能
 */

class TradingFeeCalculator {
    constructor(config = {}) {
        // 默认费率配置（可由用户修改）
        this.config = {
            commissionRate: config.commissionRate || 0.0003,  // 佣金率 0.03%
            minCommission: config.minCommission || 5,         // 最低佣金 5元
            stampTaxRate: config.stampTaxRate || 0.001,      // 印花税率 0.1%（仅卖出）
            transferFeeRate: config.transferFeeRate || 0.00002  // 过户费率 0.002%
        };
    }

    /**
     * 计算佣金
     * @param {number} amount - 交易金额
     * @returns {number} 佣金
     */
    calculateCommission(amount) {
        const commission = amount * this.config.commissionRate;
        return Math.max(commission, this.config.minCommission);
    }

    /**
     * 计算印花税（仅卖出）
     * @param {number} amount - 交易金额
     * @returns {number} 印花税
     */
    calculateStampTax(amount) {
        return amount * this.config.stampTaxRate;
    }

    /**
     * 计算过户费
     * @param {number} amount - 交易金额
     * @returns {number} 过户费
     */
    calculateTransferFee(amount) {
        return amount * this.config.transferFeeRate;
    }

    /**
     * 计算买入总费用
     * @param {number} amount - 买入金额（价格 * 数量）
     * @returns {object} { commission, transferFee, totalFee }
     */
    calculateBuyFees(amount) {
        const commission = this.calculateCommission(amount);
        const transferFee = this.calculateTransferFee(amount);
        const totalFee = commission + transferFee;

        return {
            commission,
            transferFee,
            totalFee
        };
    }

    /**
     * 计算卖出总费用
     * @param {number} amount - 卖出金额（价格 * 数量）
     * @returns {object} { commission, stampTax, transferFee, totalFee }
     */
    calculateSellFees(amount) {
        const commission = this.calculateCommission(amount);
        const stampTax = this.calculateStampTax(amount);
        const transferFee = this.calculateTransferFee(amount);
        const totalFee = commission + stampTax + transferFee;

        return {
            commission,
            stampTax,
            transferFee,
            totalFee
        };
    }

    /**
     * 计算买入的实际成本价（含手续费）
     * @param {number} price - 买入价格
     * @param {number} quantity - 买入数量
     * @returns {object} { amount, fees, totalCost, costPerShare }
     */
    calculateBuyCost(price, quantity) {
        const amount = price * quantity;
        const fees = this.calculateBuyFees(amount);
        const totalCost = amount + fees.totalFee;
        const costPerShare = totalCost / quantity;

        return {
            amount,
            commission: fees.commission,
            transferFee: fees.transferFee,
            totalFee: fees.totalFee,
            totalCost,
            costPerShare
        };
    }

    /**
     * 计算持仓盈亏（考虑买入费用）
     * @param {number} costPrice - 买入价格（不含手续费）
     * @param {number} currentPrice - 当前价格
     * @param {number} quantity - 持仓数量
     * @returns {object} { buyCost, buyFees, currentValue, profitLoss, profitLossRate }
     */
    calculatePositionProfit(costPrice, currentPrice, quantity) {
        // 计算买入成本（含手续费）
        const buyAmount = costPrice * quantity;
        const buyFees = this.calculateBuyFees(buyAmount);
        const totalBuyCost = buyAmount + buyFees.totalFee;

        // 计算当前市值
        const currentValue = currentPrice * quantity;

        // 计算盈亏
        const profitLoss = currentValue - totalBuyCost;
        const profitLossRate = totalBuyCost > 0 ? (profitLoss / totalBuyCost * 100) : 0;

        return {
            buyCost: totalBuyCost,
            buyFees: buyFees.totalFee,
            currentValue,
            profitLoss,
            profitLossRate,
            actualCostPrice: totalBuyCost / quantity // 实际成本价（含手续费）
        };
    }

    /**
     * 计算卖出收益（考虑买入和卖出费用）
     * @param {number} buyPrice - 买入价格
     * @param {number} sellPrice - 卖出价格
     * @param {number} quantity - 数量
     * @returns {object} 详细的收益计算结果
     */
    calculateSellProfit(buyPrice, sellPrice, quantity) {
        // 买入成本
        const buyAmount = buyPrice * quantity;
        const buyFees = this.calculateBuyFees(buyAmount);
        const totalBuyCost = buyAmount + buyFees.totalFee;

        // 卖出收入
        const sellAmount = sellPrice * quantity;
        const sellFees = this.calculateSellFees(sellAmount);
        const netSellAmount = sellAmount - sellFees.totalFee;

        // 盈亏
        const profit = netSellAmount - totalBuyCost;
        const profitRate = totalBuyCost > 0 ? (profit / totalBuyCost * 100) : 0;

        return {
            buyAmount,
            buyFees: buyFees.totalFee,
            totalBuyCost,
            sellAmount,
            sellFees: sellFees.totalFee,
            netSellAmount,
            profit,
            profitRate
        };
    }
}

// 创建默认实例
const defaultCalculator = new TradingFeeCalculator();

module.exports = {
    TradingFeeCalculator,
    default: defaultCalculator,

    // 便捷方法
    calculateBuyCost: (price, quantity) => defaultCalculator.calculateBuyCost(price, quantity),
    calculatePositionProfit: (costPrice, currentPrice, quantity) =>
        defaultCalculator.calculatePositionProfit(costPrice, currentPrice, quantity),
    calculateSellProfit: (buyPrice, sellPrice, quantity) =>
        defaultCalculator.calculateSellProfit(buyPrice, sellPrice, quantity)
};
