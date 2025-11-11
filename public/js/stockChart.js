/**
 * 股票图表模块 - 独立的分时图和K线图渲染组件
 * 支持分时图（线形图）和K线图（日线/周线/月线）
 *
 * 使用方法：
 * const chartManager = new StockChartManager();
 * chartManager.renderChart(canvasId, stockCode, 'intraday');  // 渲染分时图
 * chartManager.renderChart(canvasId, stockCode, 'day');       // 渲染日K线
 * chartManager.destroyChart(canvasId);                        // 销毁图表
 */

class StockChartManager {
    constructor() {
        // 存储所有图表实例
        this.chartInstances = {};
        // 跟踪每个canvas是否已经渲染过（用于控制动画）
        this.firstRenderFlags = {};
        // 跟踪每个canvas当前的图表类型（用于判断是否需要重建）
        this.chartTypes = {};
    }

    /**
     * 渲染股票图表
     * @param {string} canvasId - Canvas元素的ID
     * @param {string} stockCode - 股票代码（6位数字）
     * @param {string} period - 时间周期：'intraday'(分时), 'day'(日线), 'week'(周线), 'month'(月线)
     * @param {object} options - 可选配置参数
     * @returns {Promise<void>}
     */
    async renderChart(canvasId, stockCode, period = 'day', options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas元素 ${canvasId} 不存在`);
            return;
        }

        try {
            // 检查是否已有图表实例
            const existingChart = this.chartInstances[canvasId];
            const isFirstRender = !this.firstRenderFlags[canvasId];

            // 检测是否为分时数据
            const isIntraday = period === 'intraday';

            let historyData;

            if (isIntraday) {
                // 获取分时数据（5分钟级别）
                historyData = await this._fetchIntradayData(stockCode, options);
            } else {
                // 获取日线/周线/月线数据
                historyData = await this._fetchKLineData(stockCode, period, options);
            }

            if (!historyData || historyData.length === 0) {
                console.error(`股票 ${stockCode} ${period} 数据为空`);
                // 显示友好的错误提示
                const errorTitle = period === 'intraday' ? '暂无分时数据' : '暂无历史数据';
                const errorMessage = period === 'intraday'
                    ? '当前可能处于非交易时段，分时数据暂不可用'
                    : '该股票暂无历史行情数据';
                this._renderErrorMessage(canvas, errorTitle, errorMessage);
                return;
            }

            // 准备图表时间标签
            const labels = this._formatLabels(historyData, isIntraday, period);

            // 计算价格变化趋势
            const priceChange = historyData[historyData.length - 1].close - historyData[0].close;
            const isPositive = priceChange >= 0;

            // 检查图表类型是否改变
            const currentType = isIntraday ? 'intraday' : 'kline';
            const typeChanged = existingChart && this.chartTypes[canvasId] !== currentType;

            // 检查图表实例是否与预期类型匹配
            let needRebuild = isFirstRender || typeChanged || !existingChart;

            // 如果图表存在，进行额外的类型验证
            if (existingChart && !needRebuild) {
                const expectedDatasets = isIntraday ? 1 : 2;
                const actualDatasets = existingChart.data?.datasets?.length || 0;

                if (actualDatasets !== expectedDatasets) {
                    console.warn(`⚠️ 检测到图表类型不一致 (期望${expectedDatasets}个datasets，实际${actualDatasets}个)，强制重建`);
                    needRebuild = true;
                }
            }

            // 如果不需要重建，只更新数据
            if (!needRebuild) {
                this._updateChartData(existingChart, historyData, labels, isIntraday, isPositive);
            } else {
                // 需要重建图表
                this.destroyChart(canvasId);

                let chart;
                if (isIntraday) {
                    // 渲染分时图
                    chart = this._renderIntradayChart(canvas, historyData, labels, isPositive, options, isFirstRender);
                } else {
                    // 渲染K线图
                    chart = this._renderKLineChart(canvas, historyData, labels, isPositive, options, isFirstRender);
                }

                // 保存图表实例
                this.chartInstances[canvasId] = chart;

                // 保存图表类型
                this.chartTypes[canvasId] = currentType;

                // 标记为已渲染
                this.firstRenderFlags[canvasId] = true;
            }

        } catch (error) {
            console.error(`渲染股票 ${stockCode} 图表失败:`, error);
            // 显示友好的错误提示
            const errorTitle = '加载失败';
            const errorMessage = error.message || '数据加载失败，请稍后重试';
            this._renderErrorMessage(canvas, errorTitle, errorMessage);
        }
    }

    /**
     * 更新现有图表的数据（不重新创建图表）
     * @private
     */
    _updateChartData(chart, historyData, labels, isIntraday, isPositive) {
        if (!chart) return;

        // 更新标签
        chart.data.labels = labels;

        if (isIntraday) {
            // 更新分时图数据
            const closePrices = historyData.map(item => item.close);
            chart.data.datasets[0].data = closePrices;
            chart.data.datasets[0].borderColor = isPositive ? '#e74c3c' : '#27ae60';
            chart.data.datasets[0].backgroundColor = isPositive ? 'rgba(231, 76, 60, 0.1)' : 'rgba(39, 174, 96, 0.1)';
        } else {
            // 更新K线图数据
            const bodyData = historyData.map(item => [item.open, item.close]);
            const shadowData = historyData.map(item => [item.low, item.high]);
            const colorData = historyData.map(item => item.close >= item.open);

            chart.data.datasets[0].data = shadowData;
            chart.data.datasets[0].backgroundColor = colorData.map(isUp => isUp ? 'rgba(231, 76, 60, 0.8)' : 'rgba(39, 174, 96, 0.8)');
            chart.data.datasets[0].borderColor = colorData.map(isUp => isUp ? '#e74c3c' : '#27ae60');

            chart.data.datasets[1].data = bodyData;
            chart.data.datasets[1].backgroundColor = colorData.map(isUp => isUp ? 'rgba(231, 76, 60, 1)' : 'rgba(39, 174, 96, 1)');
            chart.data.datasets[1].borderColor = colorData.map(isUp => isUp ? '#e74c3c' : '#27ae60');
        }

        // 更新图表，不使用动画
        chart.update('none');
    }

    /**
     * 销毁指定的图表实例
     * @param {string} canvasId - Canvas元素的ID
     */
    destroyChart(canvasId) {
        // 方法1: 从我们的实例缓存中销毁
        if (this.chartInstances[canvasId]) {
            console.log(`📊 从缓存销毁图表: ${canvasId}`);
            this.chartInstances[canvasId].destroy();
            delete this.chartInstances[canvasId];
        }

        // 清理相关的跟踪数据
        delete this.chartTypes[canvasId];
        delete this.firstRenderFlags[canvasId];

        // 方法2: 从Chart.js全局注册表中查找并销毁
        // Chart.getChart可以接受canvas元素或ID字符串
        try {
            // 先尝试直接用ID字符串
            let existingChart = Chart.getChart(canvasId);

            // 如果没找到，尝试用canvas元素
            if (!existingChart) {
                const canvas = document.getElementById(canvasId);
                if (canvas) {
                    existingChart = Chart.getChart(canvas);
                }
            }

            if (existingChart) {
                console.log(`📊 销毁Canvas ${canvasId} 上的遗留图表 (Chart ID: ${existingChart.id})`);
                existingChart.destroy();
            }
        } catch (error) {
            console.log(`📊 销毁图表时出现错误（可忽略）:`, error.message);
        }
    }

    /**
     * 销毁所有图表实例
     */
    destroyAllCharts() {
        Object.keys(this.chartInstances).forEach(canvasId => {
            this.destroyChart(canvasId);
        });
    }

    /**
     * 获取分时数据
     * @private
     */
    async _fetchIntradayData(stockCode, options) {
        const limit = options.limit || 48;  // 默认48个5分钟数据点（4小时交易时间）
        const period = options.intradayPeriod || 5;  // 默认5分钟

        console.log(`📊 获取分时数据: ${stockCode} (${period}分钟K线)`);

        const response = await fetch(`/api/stock/intraday/${stockCode}?period=${period}&limit=${limit}`);

        if (!response.ok) {
            throw new Error('获取分时数据失败');
        }

        const result = await response.json();

        if (!result.success || !result.data.intraday || result.data.intraday.length === 0) {
            throw new Error(`股票 ${stockCode} 分时数据为空`);
        }

        console.log(`📊 ${stockCode} 分时数据: ${result.data.intraday.length} 条`);
        return result.data.intraday;
    }

    /**
     * 获取K线数据
     * @private
     */
    async _fetchKLineData(stockCode, period, options) {
        let days, displayCount;

        // 根据周期确定获取和显示的数据量
        switch(period) {
            case 'day':
                days = options.days || 60;
                displayCount = options.displayCount || 30;
                break;
            case 'week':
                days = options.days || 300;
                displayCount = options.displayCount || 24;
                break;
            case 'month':
                days = options.days || 300;
                displayCount = options.displayCount || 12;
                break;
            default:
                days = 60;
                displayCount = 30;
        }

        // 获取历史数据
        const response = await fetch(`/api/stock/history/${stockCode}?days=${days}`);

        if (!response.ok) {
            throw new Error('获取历史数据失败');
        }

        const result = await response.json();

        if (!result.success || !result.data.history || result.data.history.length === 0) {
            throw new Error(`股票 ${stockCode} 历史数据为空`);
        }

        let historyData = result.data.history;
        console.log(`📊 ${stockCode} ${period}线 - 原始数据: ${historyData.length} 条`);

        // 确保数据按时间正序排列（从旧到新）
        if (historyData.length > 1 && historyData[0].date > historyData[historyData.length - 1].date) {
            historyData = historyData.reverse();
            console.log(`📊 数据已反转为正序`);
        }

        // 根据周期聚合数据
        if (period === 'week') {
            historyData = this._aggregateToWeekly(historyData);
            console.log(`📊 聚合后周线数据: ${historyData.length} 条`);
        } else if (period === 'month') {
            historyData = this._aggregateToMonthly(historyData);
            console.log(`📊 聚合后月线数据: ${historyData.length} 条`);
        }

        // 只保留最近的指定数量K线
        if (historyData.length > displayCount) {
            historyData = historyData.slice(-displayCount);
            console.log(`📊 截取后显示: ${historyData.length} 条`);
        }

        return historyData;
    }

    /**
     * 格式化时间标签
     * @private
     */
    _formatLabels(historyData, isIntraday, period) {
        return historyData.map(item => {
            const timeStr = item.time || item.date;

            if (isIntraday) {
                // 分时数据格式: "2025-10-09 14:45:00" -> "14:45"
                if (timeStr.includes(' ')) {
                    return timeStr.split(' ')[1].substring(0, 5);
                }
                return timeStr;
            } else {
                // 日线数据格式处理
                if (timeStr.includes('-')) {
                    const parts = timeStr.split('-');
                    if (period === 'month') {
                        return `${parts[0]}/${parts[1]}`;
                    } else {
                        return `${parts[1]}/${parts[2]}`;
                    }
                } else {
                    if (period === 'month') {
                        return timeStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1/$2');
                    } else {
                        return timeStr.replace(/(\d{4})(\d{2})(\d{2})/, '$2/$3');
                    }
                }
            }
        });
    }

    /**
     * 在Canvas上渲染错误消息
     * @private
     */
    _renderErrorMessage(canvas, title, message) {
        const ctx = canvas.getContext('2d');
        const width = canvas.offsetWidth || canvas.width;
        const height = canvas.offsetHeight || canvas.height;

        // 设置Canvas尺寸
        canvas.width = width;
        canvas.height = height;

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        // 绘制背景
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);

        // 绘制边框
        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, width, height);

        // 绘制图标
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#95a5a6';
        ctx.fillText('📊', width / 2, height / 2 - 40);

        // 绘制标题
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#2c3e50';
        ctx.fillText(title, width / 2, height / 2 + 10);

        // 绘制消息
        ctx.font = '12px Arial';
        ctx.fillStyle = '#7f8c8d';

        // 如果消息太长，分行显示
        const maxWidth = width - 40;
        const words = message.split('');
        let line = '';
        let y = height / 2 + 35;

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i];
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && i > 0) {
                ctx.fillText(line, width / 2, y);
                line = words[i];
                y += 18;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, width / 2, y);

        console.log(`📊 已显示错误消息: ${title} - ${message}`);
    }

    /**
     * 渲染分时图（线形图）
     * @private
     */
    _renderIntradayChart(canvas, historyData, labels, isPositive, options, isFirstRender = true) {
        // 创建图表前的最后检查：确保canvas上没有遗留的图表
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            console.log(`⚠️ 创建分时图前发现遗留图表 (Chart ID: ${existingChart.id})，立即销毁`);
            existingChart.destroy();
        }

        const closePrices = historyData.map(item => item.close);

        return new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '价格',
                    data: closePrices,
                    borderColor: isPositive ? '#e74c3c' : '#27ae60',
                    backgroundColor: isPositive ? 'rgba(231, 76, 60, 0.1)' : 'rgba(39, 174, 96, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHitRadius: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: isFirstRender ? {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                } : false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: isPositive ? '#e74c3c' : '#27ae60',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `价格: ¥${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 8,
                            color: '#95a5a6',
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        display: true,
                        position: 'right',
                        beginAtZero: false,
                        grace: '2%',
                        grid: {
                            color: 'rgba(149, 165, 166, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#95a5a6',
                            font: {
                                size: 10
                            },
                            callback: function(value) {
                                return '¥' + value.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * 渲染K线图（日线/周线/月线）
     * @private
     */
    _renderKLineChart(canvas, historyData, labels, isPositive, options, isFirstRender = true) {
        // 创建图表前的最后检查：确保canvas上没有遗留的图表
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            console.log(`⚠️ 创建K线图前发现遗留图表 (Chart ID: ${existingChart.id})，立即销毁`);
            existingChart.destroy();
        }

        // 准备开盘收盘柱状图数据（蜡烛实体）
        const bodyData = historyData.map(item => {
            const isUp = item.close >= item.open;
            return {
                y: [item.open, item.close],
                open: item.open,
                close: item.close,
                high: item.high,
                low: item.low,
                isUp: isUp
            };
        });

        // 准备上下影线数据
        const shadowData = historyData.map(item => {
            return {
                y: [item.low, item.high],
                open: item.open,
                close: item.close,
                high: item.high,
                low: item.low,
                isUp: item.close >= item.open
            };
        });

        return new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '影线',
                        data: shadowData.map(d => d.y),
                        backgroundColor: shadowData.map(d => d.isUp ? 'rgba(231, 76, 60, 0.8)' : 'rgba(39, 174, 96, 0.8)'),
                        borderColor: shadowData.map(d => d.isUp ? '#e74c3c' : '#27ae60'),
                        borderWidth: 1,
                        barThickness: 2,
                        categoryPercentage: 0.8,
                        barPercentage: 0.9
                    },
                    {
                        label: '实体',
                        data: bodyData.map(d => d.y),
                        backgroundColor: bodyData.map(d => d.isUp ? 'rgba(231, 76, 60, 1)' : 'rgba(39, 174, 96, 1)'),
                        borderColor: bodyData.map(d => d.isUp ? '#e74c3c' : '#27ae60'),
                        borderWidth: 1.5,
                        barThickness: 10,
                        categoryPercentage: 0.8,
                        barPercentage: 0.9
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: isFirstRender ? {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                } : false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: isPositive ? '#e74c3c' : '#27ae60',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                const idx = context.dataIndex;
                                const data = historyData[idx];
                                return [
                                    `开盘: ¥${data.open.toFixed(2)}`,
                                    `最高: ¥${data.high.toFixed(2)}`,
                                    `最低: ¥${data.low.toFixed(2)}`,
                                    `收盘: ¥${data.close.toFixed(2)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 6,
                            color: '#95a5a6',
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        stacked: false,
                        display: true,
                        position: 'right',
                        beginAtZero: false,
                        grace: '5%',
                        grid: {
                            color: 'rgba(149, 165, 166, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#95a5a6',
                            font: {
                                size: 10
                            },
                            callback: function(value) {
                                return '¥' + value.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * 聚合为周线数据
     * @private
     */
    _aggregateToWeekly(dailyData) {
        const weeklyData = [];
        let currentWeek = null;

        dailyData.forEach(day => {
            let dateStr = day.date;
            if (!dateStr.includes('-')) {
                dateStr = dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
            }
            const date = new Date(dateStr);
            const weekNumber = this._getWeekNumber(date);

            if (!currentWeek || currentWeek.week !== weekNumber) {
                if (currentWeek) {
                    weeklyData.push(currentWeek.data);
                }
                currentWeek = {
                    week: weekNumber,
                    data: {
                        date: day.date,
                        open: day.open,
                        high: day.high,
                        low: day.low,
                        close: day.close,
                        volume: day.volume
                    }
                };
            } else {
                currentWeek.data.high = Math.max(currentWeek.data.high, day.high);
                currentWeek.data.low = Math.min(currentWeek.data.low, day.low);
                currentWeek.data.close = day.close;
                currentWeek.data.volume += day.volume;
                currentWeek.data.date = day.date;
            }
        });

        if (currentWeek) {
            weeklyData.push(currentWeek.data);
        }

        return weeklyData;
    }

    /**
     * 聚合为月线数据
     * @private
     */
    _aggregateToMonthly(dailyData) {
        const monthlyData = [];
        let currentMonth = null;

        dailyData.forEach(day => {
            let monthKey;
            if (day.date.includes('-')) {
                monthKey = day.date.substring(0, 7).replace('-', '');
            } else {
                monthKey = day.date.substring(0, 6);
            }

            if (!currentMonth || currentMonth.month !== monthKey) {
                if (currentMonth) {
                    monthlyData.push(currentMonth.data);
                }
                currentMonth = {
                    month: monthKey,
                    data: {
                        date: day.date,
                        open: day.open,
                        high: day.high,
                        low: day.low,
                        close: day.close,
                        volume: day.volume
                    }
                };
            } else {
                currentMonth.data.high = Math.max(currentMonth.data.high, day.high);
                currentMonth.data.low = Math.min(currentMonth.data.low, day.low);
                currentMonth.data.close = day.close;
                currentMonth.data.volume += day.volume;
                currentMonth.data.date = day.date;
            }
        });

        if (currentMonth) {
            monthlyData.push(currentMonth.data);
        }

        return monthlyData;
    }

    /**
     * 获取周数
     * @private
     */
    _getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
}

// 创建全局图表管理器实例
const stockChartManager = new StockChartManager();

// 兼容旧代码的全局函数
function renderStockChart(canvasId, stockCode, period = 'day') {
    return stockChartManager.renderChart(canvasId, stockCode, period);
}
