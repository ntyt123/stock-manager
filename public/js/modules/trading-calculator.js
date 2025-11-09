/**
 * 交易计算器模块
 * 提供买入、卖出、加仓、减仓、T+0等交易计算功能
 */

class TradingCalculator {
    constructor() {
        // 默认费率配置（可由用户修改）
        this.feeConfig = {
            commissionRate: 0.0003,  // 佣金率 0.03%
            minCommission: 5,         // 最低佣金 5元
            stampTaxRate: 0.001,      // 印花税率 0.1%（仅卖出）
            transferFeeRate: 0.00002  // 过户费率 0.002%
        };

        this.currentMode = 'buy';
        this.init();
    }

    /**
     * 初始化计算器
     */
    init() {
        this.setupModeSwitch();
        this.setupFeeInputs();
        this.setupCalculateButtons();
        this.loadFeeConfig();
    }

    /**
     * 设置模式切换
     */
    setupModeSwitch() {
        const modeTabs = document.querySelectorAll('.calculator-mode-tab');
        modeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.mode;
                this.switchMode(mode);
            });
        });
    }

    /**
     * 切换计算器模式
     */
    switchMode(mode) {
        this.currentMode = mode;

        // 更新标签页状态
        document.querySelectorAll('.calculator-mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        // 更新表单显示
        document.querySelectorAll('.calculator-form').forEach(form => {
            form.classList.toggle('active', form.dataset.mode === mode);
        });

        // 隐藏结果
        this.hideAllResults();
    }

    /**
     * 设置费率输入
     */
    setupFeeInputs() {
        const feeInputs = {
            'commissionRate': document.getElementById('commissionRate'),
            'minCommission': document.getElementById('minCommission'),
            'stampTaxRate': document.getElementById('stampTaxRate'),
            'transferFeeRate': document.getElementById('transferFeeRate')
        };

        Object.keys(feeInputs).forEach(key => {
            const input = feeInputs[key];
            if (input) {
                input.addEventListener('change', () => {
                    this.updateFeeConfig(key, parseFloat(input.value));
                });
            }
        });
    }

    /**
     * 更新费率配置
     */
    updateFeeConfig(key, value) {
        if (key === 'commissionRate' || key === 'stampTaxRate' || key === 'transferFeeRate') {
            this.feeConfig[key] = value / 100; // 转换为小数
        } else {
            this.feeConfig[key] = value;
        }
        this.saveFeeConfig();
    }

    /**
     * 保存费率配置到本地存储
     */
    saveFeeConfig() {
        localStorage.setItem('tradingCalculatorFeeConfig', JSON.stringify(this.feeConfig));
    }

    /**
     * 从本地存储加载费率配置
     */
    loadFeeConfig() {
        const saved = localStorage.getItem('tradingCalculatorFeeConfig');
        if (saved) {
            this.feeConfig = JSON.parse(saved);
            this.updateFeeInputs();
        }
    }

    /**
     * 更新费率输入框的值
     */
    updateFeeInputs() {
        const commissionInput = document.getElementById('commissionRate');
        const minCommissionInput = document.getElementById('minCommission');
        const stampTaxInput = document.getElementById('stampTaxRate');
        const transferFeeInput = document.getElementById('transferFeeRate');

        if (commissionInput) commissionInput.value = (this.feeConfig.commissionRate * 100).toFixed(3);
        if (minCommissionInput) minCommissionInput.value = this.feeConfig.minCommission;
        if (stampTaxInput) stampTaxInput.value = (this.feeConfig.stampTaxRate * 100).toFixed(2);
        if (transferFeeInput) transferFeeInput.value = (this.feeConfig.transferFeeRate * 100).toFixed(3);
    }

    /**
     * 设置计算按钮
     */
    setupCalculateButtons() {
        // 买入成本计算
        const buyBtn = document.getElementById('calculateBuyBtn');
        if (buyBtn) {
            buyBtn.addEventListener('click', () => this.calculateBuyCost());
        }

        // 卖出收益计算
        const sellBtn = document.getElementById('calculateSellBtn');
        if (sellBtn) {
            sellBtn.addEventListener('click', () => this.calculateSellProfit());
        }

        // 加仓成本计算
        const addBtn = document.getElementById('calculateAddBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.calculateAddPosition());
        }

        // 减仓收益计算
        const reduceBtn = document.getElementById('calculateReduceBtn');
        if (reduceBtn) {
            reduceBtn.addEventListener('click', () => this.calculateReducePosition());
        }

        // T+0盈亏计算
        const t0Btn = document.getElementById('calculateT0Btn');
        if (t0Btn) {
            t0Btn.addEventListener('click', () => this.calculateT0());
        }

        // 重置按钮
        document.querySelectorAll('.calculator-btn-secondary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.currentTarget.textContent.includes('重置')) {
                    this.resetCurrentForm();
                }
            });
        });
    }

    /**
     * 计算佣金
     */
    calculateCommission(amount) {
        const commission = amount * this.feeConfig.commissionRate;
        return Math.max(commission, this.feeConfig.minCommission);
    }

    /**
     * 计算印花税（仅卖出）
     */
    calculateStampTax(amount) {
        return amount * this.feeConfig.stampTaxRate;
    }

    /**
     * 计算过户费
     */
    calculateTransferFee(amount) {
        return amount * this.feeConfig.transferFeeRate;
    }

    /**
     * 计算买入成本
     */
    calculateBuyCost() {
        const price = parseFloat(document.getElementById('buyPrice').value);
        const shares = parseInt(document.getElementById('buyShares').value);

        if (!price || !shares || price <= 0 || shares <= 0) {
            alert('请输入有效的价格和股数！');
            return;
        }

        const amount = price * shares;
        const commission = this.calculateCommission(amount);
        const transferFee = this.calculateTransferFee(amount);
        const totalFee = commission + transferFee;
        const totalCost = amount + totalFee;
        const costPerShare = totalCost / shares;

        const result = {
            amount,
            commission,
            transferFee,
            totalFee,
            totalCost,
            costPerShare,
            shares
        };

        this.displayBuyResult(result);
    }

    /**
     * 显示买入成本结果
     */
    displayBuyResult(result) {
        const resultDiv = document.getElementById('buyResult');
        resultDiv.innerHTML = `
            <div class="result-title">
                💰 买入成本计算结果
            </div>
            <div class="result-grid">
                <div class="result-item">
                    <div class="result-item-label">交易金额</div>
                    <div class="result-item-value neutral">¥${result.amount.toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">佣金</div>
                    <div class="result-item-value">¥${result.commission.toFixed(2)}</div>
                    <div class="result-item-subtext">${(this.feeConfig.commissionRate * 100).toFixed(3)}%</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">过户费</div>
                    <div class="result-item-value">¥${result.transferFee.toFixed(2)}</div>
                    <div class="result-item-subtext">${(this.feeConfig.transferFeeRate * 100).toFixed(3)}%</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">总费用</div>
                    <div class="result-item-value negative">¥${result.totalFee.toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">总成本</div>
                    <div class="result-item-value neutral">¥${result.totalCost.toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">持仓成本价</div>
                    <div class="result-item-value neutral">¥${result.costPerShare.toFixed(3)}</div>
                    <div class="result-item-subtext">${result.shares}股</div>
                </div>
            </div>
        `;
        resultDiv.classList.add('show');
    }

    /**
     * 计算卖出收益
     */
    calculateSellProfit() {
        const buyPrice = parseFloat(document.getElementById('sellBuyPrice').value);
        const sellPrice = parseFloat(document.getElementById('sellPrice').value);
        const shares = parseInt(document.getElementById('sellShares').value);

        if (!buyPrice || !sellPrice || !shares || buyPrice <= 0 || sellPrice <= 0 || shares <= 0) {
            alert('请输入有效的买入价、卖出价和股数！');
            return;
        }

        // 买入成本
        const buyAmount = buyPrice * shares;
        const buyCommission = this.calculateCommission(buyAmount);
        const buyTransferFee = this.calculateTransferFee(buyAmount);
        const totalBuyCost = buyAmount + buyCommission + buyTransferFee;

        // 卖出收入
        const sellAmount = sellPrice * shares;
        const sellCommission = this.calculateCommission(sellAmount);
        const sellStampTax = this.calculateStampTax(sellAmount);
        const sellTransferFee = this.calculateTransferFee(sellAmount);
        const totalSellFee = sellCommission + sellStampTax + sellTransferFee;
        const netSellAmount = sellAmount - totalSellFee;

        // 盈亏
        const profit = netSellAmount - totalBuyCost;
        const profitRate = (profit / totalBuyCost) * 100;

        const result = {
            buyAmount,
            buyCommission,
            buyTransferFee,
            totalBuyCost,
            sellAmount,
            sellCommission,
            sellStampTax,
            sellTransferFee,
            totalSellFee,
            netSellAmount,
            profit,
            profitRate,
            shares
        };

        this.displaySellResult(result);
    }

    /**
     * 显示卖出收益结果
     */
    displaySellResult(result) {
        const resultDiv = document.getElementById('sellResult');
        const profitClass = result.profit >= 0 ? 'positive' : 'negative';
        const profitText = result.profit >= 0 ? '盈利' : '亏损';

        resultDiv.innerHTML = `
            <div class="result-title">
                📊 卖出收益计算结果
            </div>
            <div class="result-grid">
                <div class="result-item">
                    <div class="result-item-label">买入总成本</div>
                    <div class="result-item-value neutral">¥${result.totalBuyCost.toFixed(2)}</div>
                    <div class="result-item-subtext">含买入费用 ¥${(result.buyCommission + result.buyTransferFee).toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">卖出金额</div>
                    <div class="result-item-value neutral">¥${result.sellAmount.toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">卖出总费用</div>
                    <div class="result-item-value negative">¥${result.totalSellFee.toFixed(2)}</div>
                    <div class="result-item-subtext">佣金+印花税+过户费</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">卖出净收入</div>
                    <div class="result-item-value neutral">¥${result.netSellAmount.toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">${profitText}</div>
                    <div class="result-item-value ${profitClass}">¥${Math.abs(result.profit).toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">收益率</div>
                    <div class="result-item-value ${profitClass}">${result.profitRate.toFixed(2)}%</div>
                    <div class="result-item-subtext">${result.shares}股</div>
                </div>
            </div>
            <div class="result-details">
                <div class="result-details-title">📋 费用明细</div>
                <ul class="result-details-list">
                    <li class="result-details-item">
                        <span class="result-details-label">买入佣金</span>
                        <span class="result-details-value">¥${result.buyCommission.toFixed(2)}</span>
                    </li>
                    <li class="result-details-item">
                        <span class="result-details-label">买入过户费</span>
                        <span class="result-details-value">¥${result.buyTransferFee.toFixed(2)}</span>
                    </li>
                    <li class="result-details-item">
                        <span class="result-details-label">卖出佣金</span>
                        <span class="result-details-value">¥${result.sellCommission.toFixed(2)}</span>
                    </li>
                    <li class="result-details-item">
                        <span class="result-details-label">卖出印花税</span>
                        <span class="result-details-value">¥${result.sellStampTax.toFixed(2)}</span>
                    </li>
                    <li class="result-details-item">
                        <span class="result-details-label">卖出过户费</span>
                        <span class="result-details-value">¥${result.sellTransferFee.toFixed(2)}</span>
                    </li>
                </ul>
            </div>
        `;
        resultDiv.classList.add('show');
    }

    /**
     * 计算加仓成本
     */
    calculateAddPosition() {
        const originalPrice = parseFloat(document.getElementById('addOriginalPrice').value);
        const originalShares = parseInt(document.getElementById('addOriginalShares').value);
        const addPrice = parseFloat(document.getElementById('addPrice').value);
        const addShares = parseInt(document.getElementById('addShares').value);

        if (!originalPrice || !originalShares || !addPrice || !addShares ||
            originalPrice <= 0 || originalShares <= 0 || addPrice <= 0 || addShares <= 0) {
            alert('请输入有效的原始持仓和加仓信息！');
            return;
        }

        // 原始持仓成本
        const originalAmount = originalPrice * originalShares;

        // 加仓成本
        const addAmount = addPrice * addShares;
        const addCommission = this.calculateCommission(addAmount);
        const addTransferFee = this.calculateTransferFee(addAmount);
        const totalAddCost = addAmount + addCommission + addTransferFee;

        // 新的持仓成本
        const totalShares = originalShares + addShares;
        const totalCost = originalAmount + totalAddCost;
        const newCostPrice = totalCost / totalShares;

        const priceDiff = newCostPrice - originalPrice;
        const priceDiffRate = (priceDiff / originalPrice) * 100;

        const result = {
            originalPrice,
            originalShares,
            originalAmount,
            addPrice,
            addShares,
            addAmount,
            addCommission,
            addTransferFee,
            totalAddCost,
            totalShares,
            totalCost,
            newCostPrice,
            priceDiff,
            priceDiffRate
        };

        this.displayAddResult(result);
    }

    /**
     * 显示加仓结果
     */
    displayAddResult(result) {
        const resultDiv = document.getElementById('addResult');
        const diffClass = result.priceDiff >= 0 ? 'negative' : 'positive';
        const diffText = result.priceDiff >= 0 ? '上升' : '下降';

        resultDiv.innerHTML = `
            <div class="result-title">
                📈 加仓成本计算结果
            </div>
            <div class="result-grid">
                <div class="result-item">
                    <div class="result-item-label">原持仓成本</div>
                    <div class="result-item-value neutral">¥${result.originalPrice.toFixed(3)}</div>
                    <div class="result-item-subtext">${result.originalShares}股</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">加仓价格</div>
                    <div class="result-item-value neutral">¥${result.addPrice.toFixed(3)}</div>
                    <div class="result-item-subtext">${result.addShares}股</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">加仓费用</div>
                    <div class="result-item-value negative">¥${(result.addCommission + result.addTransferFee).toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">新持仓成本</div>
                    <div class="result-item-value neutral">¥${result.newCostPrice.toFixed(3)}</div>
                    <div class="result-item-subtext">${result.totalShares}股</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">成本变化</div>
                    <div class="result-item-value ${diffClass}">¥${Math.abs(result.priceDiff).toFixed(3)}</div>
                    <div class="result-item-subtext">${diffText} ${Math.abs(result.priceDiffRate).toFixed(2)}%</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">总成本</div>
                    <div class="result-item-value neutral">¥${result.totalCost.toFixed(2)}</div>
                </div>
            </div>
        `;
        resultDiv.classList.add('show');
    }

    /**
     * 计算减仓收益
     */
    calculateReducePosition() {
        const costPrice = parseFloat(document.getElementById('reduceCostPrice').value);
        const totalShares = parseInt(document.getElementById('reduceTotalShares').value);
        const sellPrice = parseFloat(document.getElementById('reducePrice').value);
        const sellShares = parseInt(document.getElementById('reduceShares').value);

        if (!costPrice || !totalShares || !sellPrice || !sellShares ||
            costPrice <= 0 || totalShares <= 0 || sellPrice <= 0 || sellShares <= 0) {
            alert('请输入有效的持仓和减仓信息！');
            return;
        }

        if (sellShares > totalShares) {
            alert('减仓股数不能大于总持仓！');
            return;
        }

        // 卖出收益计算
        const sellAmount = sellPrice * sellShares;
        const sellCommission = this.calculateCommission(sellAmount);
        const sellStampTax = this.calculateStampTax(sellAmount);
        const sellTransferFee = this.calculateTransferFee(sellAmount);
        const totalSellFee = sellCommission + sellStampTax + sellTransferFee;
        const netSellAmount = sellAmount - totalSellFee;

        // 卖出成本
        const sellCost = costPrice * sellShares;

        // 盈亏
        const profit = netSellAmount - sellCost;
        const profitRate = (profit / sellCost) * 100;

        // 剩余持仓
        const remainingShares = totalShares - sellShares;
        const remainingCost = costPrice * remainingShares;

        const result = {
            costPrice,
            totalShares,
            sellPrice,
            sellShares,
            sellAmount,
            totalSellFee,
            netSellAmount,
            sellCost,
            profit,
            profitRate,
            remainingShares,
            remainingCost
        };

        this.displayReduceResult(result);
    }

    /**
     * 显示减仓结果
     */
    displayReduceResult(result) {
        const resultDiv = document.getElementById('reduceResult');
        const profitClass = result.profit >= 0 ? 'positive' : 'negative';
        const profitText = result.profit >= 0 ? '盈利' : '亏损';

        resultDiv.innerHTML = `
            <div class="result-title">
                📉 减仓收益计算结果
            </div>
            <div class="result-grid">
                <div class="result-item">
                    <div class="result-item-label">持仓成本</div>
                    <div class="result-item-value neutral">¥${result.costPrice.toFixed(3)}</div>
                    <div class="result-item-subtext">原${result.totalShares}股</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">卖出价格</div>
                    <div class="result-item-value neutral">¥${result.sellPrice.toFixed(3)}</div>
                    <div class="result-item-subtext">减${result.sellShares}股</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">卖出费用</div>
                    <div class="result-item-value negative">¥${result.totalSellFee.toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">卖出净收入</div>
                    <div class="result-item-value neutral">¥${result.netSellAmount.toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">${profitText}</div>
                    <div class="result-item-value ${profitClass}">¥${Math.abs(result.profit).toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">收益率</div>
                    <div class="result-item-value ${profitClass}">${result.profitRate.toFixed(2)}%</div>
                </div>
            </div>
            <div class="result-details">
                <div class="result-details-title">📋 剩余持仓</div>
                <ul class="result-details-list">
                    <li class="result-details-item">
                        <span class="result-details-label">剩余股数</span>
                        <span class="result-details-value">${result.remainingShares}股</span>
                    </li>
                    <li class="result-details-item">
                        <span class="result-details-label">持仓成本</span>
                        <span class="result-details-value">¥${result.costPrice.toFixed(3)}</span>
                    </li>
                    <li class="result-details-item">
                        <span class="result-details-label">剩余市值</span>
                        <span class="result-details-value">¥${result.remainingCost.toFixed(2)}</span>
                    </li>
                </ul>
            </div>
        `;
        resultDiv.classList.add('show');
    }

    /**
     * 计算T+0盈亏
     */
    calculateT0() {
        const costPrice = parseFloat(document.getElementById('t0CostPrice').value);
        const totalShares = parseInt(document.getElementById('t0TotalShares').value);
        const buyPrice = parseFloat(document.getElementById('t0BuyPrice').value);
        const buyShares = parseInt(document.getElementById('t0BuyShares').value);
        const sellPrice = parseFloat(document.getElementById('t0SellPrice').value);
        const sellShares = parseInt(document.getElementById('t0SellShares').value);

        if (!costPrice || !totalShares || !buyPrice || !buyShares || !sellPrice || !sellShares ||
            costPrice <= 0 || totalShares <= 0 || buyPrice <= 0 || buyShares <= 0 || sellPrice <= 0 || sellShares <= 0) {
            alert('请输入有效的T+0操作信息！');
            return;
        }

        if (sellShares > totalShares) {
            alert('卖出股数不能大于原持仓！');
            return;
        }

        // 买入成本
        const buyAmount = buyPrice * buyShares;
        const buyCommission = this.calculateCommission(buyAmount);
        const buyTransferFee = this.calculateTransferFee(buyAmount);
        const totalBuyCost = buyAmount + buyCommission + buyTransferFee;

        // 卖出收入
        const sellAmount = sellPrice * sellShares;
        const sellCommission = this.calculateCommission(sellAmount);
        const sellStampTax = this.calculateStampTax(sellAmount);
        const sellTransferFee = this.calculateTransferFee(sellAmount);
        const totalSellFee = sellCommission + sellStampTax + sellTransferFee;
        const netSellAmount = sellAmount - totalSellFee;

        // T+0盈亏
        const t0Profit = netSellAmount - (costPrice * sellShares);

        // 新持仓计算
        const newTotalShares = totalShares + buyShares - sellShares;
        const originalCost = costPrice * totalShares;
        const newTotalCost = originalCost + totalBuyCost - netSellAmount;
        const newCostPrice = newTotalCost / newTotalShares;

        // 成本变化
        const costDiff = newCostPrice - costPrice;
        const costDiffRate = (costDiff / costPrice) * 100;

        const result = {
            costPrice,
            totalShares,
            buyPrice,
            buyShares,
            buyAmount,
            buyCommission,
            buyTransferFee,
            totalBuyCost,
            sellPrice,
            sellShares,
            sellAmount,
            sellCommission,
            sellStampTax,
            sellTransferFee,
            totalSellFee,
            netSellAmount,
            t0Profit,
            newTotalShares,
            newCostPrice,
            costDiff,
            costDiffRate
        };

        this.displayT0Result(result);
    }

    /**
     * 显示T+0结果
     */
    displayT0Result(result) {
        const resultDiv = document.getElementById('t0Result');
        const profitClass = result.t0Profit >= 0 ? 'positive' : 'negative';
        const profitText = result.t0Profit >= 0 ? '盈利' : '亏损';
        const costClass = result.costDiff >= 0 ? 'negative' : 'positive';
        const costText = result.costDiff >= 0 ? '上升' : '下降';

        resultDiv.innerHTML = `
            <div class="result-title">
                🔄 T+0盈亏计算结果
            </div>
            <div class="result-grid">
                <div class="result-item">
                    <div class="result-item-label">T+0${profitText}</div>
                    <div class="result-item-value ${profitClass}">¥${Math.abs(result.t0Profit).toFixed(2)}</div>
                    <div class="result-item-subtext">卖${result.sellShares}股 买${result.buyShares}股</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">原持仓成本</div>
                    <div class="result-item-value neutral">¥${result.costPrice.toFixed(3)}</div>
                    <div class="result-item-subtext">${result.totalShares}股</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">新持仓成本</div>
                    <div class="result-item-value neutral">¥${result.newCostPrice.toFixed(3)}</div>
                    <div class="result-item-subtext">${result.newTotalShares}股</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">成本变化</div>
                    <div class="result-item-value ${costClass}">¥${Math.abs(result.costDiff).toFixed(3)}</div>
                    <div class="result-item-subtext">${costText} ${Math.abs(result.costDiffRate).toFixed(2)}%</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">买入费用</div>
                    <div class="result-item-value negative">¥${(result.buyCommission + result.buyTransferFee).toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <div class="result-item-label">卖出费用</div>
                    <div class="result-item-value negative">¥${result.totalSellFee.toFixed(2)}</div>
                </div>
            </div>
            <div class="result-details">
                <div class="result-details-title">📋 操作明细</div>
                <ul class="result-details-list">
                    <li class="result-details-item">
                        <span class="result-details-label">买入金额</span>
                        <span class="result-details-value">¥${result.buyAmount.toFixed(2)}</span>
                    </li>
                    <li class="result-details-item">
                        <span class="result-details-label">买入总成本</span>
                        <span class="result-details-value">¥${result.totalBuyCost.toFixed(2)}</span>
                    </li>
                    <li class="result-details-item">
                        <span class="result-details-label">卖出金额</span>
                        <span class="result-details-value">¥${result.sellAmount.toFixed(2)}</span>
                    </li>
                    <li class="result-details-item">
                        <span class="result-details-label">卖出净收入</span>
                        <span class="result-details-value">¥${result.netSellAmount.toFixed(2)}</span>
                    </li>
                </ul>
            </div>
        `;
        resultDiv.classList.add('show');
    }

    /**
     * 重置当前表单
     */
    resetCurrentForm() {
        const currentForm = document.querySelector(`.calculator-form[data-mode="${this.currentMode}"]`);
        if (currentForm) {
            currentForm.querySelectorAll('input').forEach(input => {
                if (input.type === 'number' || input.type === 'text') {
                    input.value = '';
                }
            });
        }
        this.hideAllResults();
    }

    /**
     * 隐藏所有结果
     */
    hideAllResults() {
        document.querySelectorAll('.calculator-result').forEach(result => {
            result.classList.remove('show');
        });
    }
}

// 初始化交易计算器
let tradingCalculator;
document.addEventListener('DOMContentLoaded', () => {
    tradingCalculator = new TradingCalculator();
});
