/**
 * 独立行情分析模块
 */

const IndependentAnalysisManager = {
    currentStock: null,
    charts: {
        stock: null,
        index: null,
        sector: null,
        concept: null,
        independent: null
    },

    /**
     * 初始化模块
     */
    init() {
        console.log('📊 初始化独立行情分析模块');
        this.bindEvents();
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        const input = document.getElementById('independentStockInput');
        const analyzeBtn = document.getElementById('independentAnalyzeBtn');

        // 输入框事件
        if (input) {
            input.addEventListener('input', this.handleSearchInput.bind(this));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.startAnalysis();
                }
            });
        }

        // 分析按钮事件
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.startAnalysis());
        }
    },

    /**
     * 处理搜索输入
     */
    async handleSearchInput(e) {
        const keyword = e.target.value.trim();

        if (keyword.length < 2) {
            this.hideSuggestions();
            return;
        }

        try {
            const response = await fetch(`/api/stock/search?keyword=${encodeURIComponent(keyword)}`, {
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                }
            });

            const data = await response.json();

            if (data.success && data.data && data.data.length > 0) {
                this.showSuggestions(data.data);
            } else {
                this.hideSuggestions();
            }
        } catch (error) {
            console.error('搜索股票失败:', error);
            this.hideSuggestions();
        }
    },

    /**
     * 显示搜索建议
     */
    showSuggestions(stocks) {
        const container = document.getElementById('independentStockSuggestions');

        container.innerHTML = stocks.slice(0, 10).map(stock => `
            <div class="suggestion-item" data-code="${stock.code}" data-name="${stock.name}">
                <span class="suggestion-name">${stock.name}</span>
                <span class="suggestion-code">${stock.code}</span>
            </div>
        `).join('');

        // 绑定点击事件
        container.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const code = e.currentTarget.dataset.code;
                const name = e.currentTarget.dataset.name;
                document.getElementById('independentStockInput').value = `${name} (${code})`;
                this.hideSuggestions();
            });
        });

        container.classList.add('show');
    },

    /**
     * 隐藏搜索建议
     */
    hideSuggestions() {
        const container = document.getElementById('independentStockSuggestions');
        container.classList.remove('show');
        container.innerHTML = '';
    },

    /**
     * 开始分析
     */
    async startAnalysis() {
        const input = document.getElementById('independentStockInput').value.trim();

        if (!input) {
            showNotification('请输入股票代码或名称', 'warning');
            return;
        }

        // 提取股票代码
        let stockCode = input;
        const match = input.match(/\((\d{6})\)/);
        if (match) {
            stockCode = match[1];
        } else if (/^\d{6}$/.test(input)) {
            stockCode = input;
        } else {
            // 如果不是6位数字，需要先搜索
            showNotification('请输入正确的股票代码', 'warning');
            return;
        }

        this.showLoading(true);

        try {
            // 获取股票信息和分时数据
            const response = await fetch(`/api/stock/independent-analysis/${stockCode}`, {
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                }
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || '获取数据失败');
            }

            this.currentStock = data.data;
            this.renderStockInfo(data.data.stock);
            this.renderCharts(data.data);

        } catch (error) {
            console.error('分析失败:', error);
            showNotification(error.message || '分析失败，请重试', 'error');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * 渲染股票信息
     */
    renderStockInfo(stock) {
        document.getElementById('stockInfoName').textContent = stock.name;
        document.getElementById('stockInfoCode').textContent = stock.code;

        // 渲染板块
        const sectorsHtml = stock.sectors && stock.sectors.length > 0
            ? stock.sectors.map(s => `<span class="info-tag">${s}</span>`).join('')
            : '<span class="info-tag">暂无数据</span>';
        document.getElementById('stockSectors').innerHTML = sectorsHtml;

        // 渲染概念
        const conceptsHtml = stock.concepts && stock.concepts.length > 0
            ? stock.concepts.map(c => `<span class="info-tag">${c}</span>`).join('')
            : '<span class="info-tag">暂无数据</span>';
        document.getElementById('stockConcepts').innerHTML = conceptsHtml;

        // 显示信息区域
        document.getElementById('independentStockInfo').style.display = 'block';
        document.getElementById('independentChartsArea').style.display = 'grid';
    },

    /**
     * 渲染所有图表
     */
    renderCharts(data) {
        // 更新图表标题
        document.getElementById('stockChartTitle').textContent = `${data.stock.name} 分时`;
        if (data.sector) {
            document.getElementById('sectorChartTitle').textContent = `${data.sector.name} 分时`;
        }
        if (data.concept) {
            document.getElementById('conceptChartTitle').textContent = `${data.concept.name} 分时`;
        }

        // 绘制分时图
        this.drawMinuteChart('stockMinuteChart', data.stock.minuteData, data.stock.name);
        this.drawMinuteChart('indexMinuteChart', data.index.minuteData, '上证指数');

        if (data.sector) {
            this.drawMinuteChart('sectorMinuteChart', data.sector.minuteData, data.sector.name);
        }

        if (data.concept) {
            this.drawMinuteChart('conceptMinuteChart', data.concept.minuteData, data.concept.name);
        }

        // 计算并绘制独立涨跌
        this.calculateAndDrawIndependent(data);
    },

    /**
     * 绘制分时图
     */
    drawMinuteChart(canvasId, data, title) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // 销毁旧图表
        const chartKey = canvasId.replace('MinuteChart', '').replace('Chart', '');
        if (this.charts[chartKey]) {
            this.charts[chartKey].destroy();
        }

        // 准备数据
        const labels = data.map(d => d.time);
        const prices = data.map(d => d.price);
        const avgPrices = data.map(d => d.avgPrice);

        // 计算涨跌幅
        const yesterdayClose = data[0].yesterdayClose;
        const changePercents = prices.map(p => ((p - yesterdayClose) / yesterdayClose * 100).toFixed(2));

        // 创建图表
        this.charts[chartKey] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '价格',
                        data: prices,
                        borderColor: prices[prices.length - 1] >= yesterdayClose ? '#f44336' : '#4caf50',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0
                    },
                    {
                        label: '均价',
                        data: avgPrices,
                        borderColor: '#FFA726',
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        tension: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                const idx = context.dataIndex;
                                if (context.datasetIndex === 0) {
                                    return `价格: ¥${prices[idx]} (${changePercents[idx] >= 0 ? '+' : ''}${changePercents[idx]}%)`;
                                } else {
                                    return `均价: ¥${avgPrices[idx]}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        ticks: {
                            maxTicksLimit: 6,
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        display: true,
                        position: 'right',
                        ticks: {
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
    },

    /**
     * 计算并绘制独立涨跌 - 只对比大盘
     */
    calculateAndDrawIndependent(data) {
        const stockData = data.stock.minuteData;
        const indexData = data.index.minuteData;
        const sectorData = data.sector ? data.sector.minuteData : null;
        const conceptData = data.concept ? data.concept.minuteData : null;

        // 确保所有数据长度一致
        const minLength = Math.min(
            stockData.length,
            indexData.length,
            sectorData ? sectorData.length : Infinity,
            conceptData ? conceptData.length : Infinity
        );

        // 只计算相对于大盘的独立涨跌
        const labels = [];
        const independentVsIndex = [];      // 相对于大盘的独立走势

        for (let i = 0; i < minLength; i++) {
            labels.push(stockData[i].time);

            // 计算股票和大盘相对于昨收的涨跌幅
            const stockChange = (stockData[i].price - stockData[0].yesterdayClose) / stockData[0].yesterdayClose * 100;
            const indexChange = (indexData[i].price - indexData[0].yesterdayClose) / indexData[0].yesterdayClose * 100;

            // 独立涨跌 = 股票涨跌 - 大盘涨跌
            independentVsIndex.push(stockChange - indexChange);
        }

        // 计算统计数据
        const finalIndependentChange = independentVsIndex[independentVsIndex.length - 1];

        // 计算相关系数
        const indexCorr = this.calculateCorrelation(stockData, indexData);
        const sectorCorr = sectorData ? this.calculateCorrelation(stockData, sectorData) : 0;
        const conceptCorr = conceptData ? this.calculateCorrelation(stockData, conceptData) : 0;

        // 更新统计信息
        document.getElementById('independentChangePercent').textContent =
            (finalIndependentChange >= 0 ? '+' : '') + finalIndependentChange.toFixed(2) + '%';
        document.getElementById('independentChangePercent').className =
            'stat-value ' + (finalIndependentChange >= 0 ? 'positive' : 'negative');

        document.getElementById('indexCorrelation').textContent = indexCorr.toFixed(3);
        document.getElementById('sectorCorrelation').textContent = sectorCorr.toFixed(3);
        document.getElementById('conceptCorrelation').textContent = conceptCorr.toFixed(3);

        // 绘制独立涨跌图（只传入大盘对比数据）
        this.drawIndependentChart(labels, {
            vsIndex: independentVsIndex
        }, {
            sectorName: data.sector ? data.sector.name : null,
            conceptName: data.concept ? data.concept.name : null
        });
    },

    /**
     * 绘制独立涨跌图表 - 只对比大盘
     */
    drawIndependentChart(labels, dataLines, names) {
        const canvas = document.getElementById('independentChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // 销毁旧图表
        if (this.charts.independent) {
            this.charts.independent.destroy();
        }

        // 获取股票涨跌数据
        const stockData = this.currentStock.stock.minuteData;
        const stockChanges = stockData.map((item, index) => {
            return ((item.price - stockData[0].yesterdayClose) / stockData[0].yesterdayClose * 100);
        });

        // 阈值：如果独立涨跌幅度小于0.5%，认为是同步走势
        const threshold = 0.5;

        const datasets = [];

        // 创建一条连续的线，根据与大盘的关系动态改变颜色
        datasets.push({
            label: '股票走势',
            data: stockChanges,
            segment: {
                borderColor: ctx => {
                    const idx = ctx.p0DataIndex;
                    if (!idx && idx !== 0) return '#9E9E9E';

                    const vsIndex = dataLines.vsIndex[idx];

                    // 根据相对大盘的独立走势使用不同颜色
                    if (vsIndex >= threshold) {
                        return '#f44336';  // 红色 - 强于大盘
                    } else if (vsIndex <= -threshold) {
                        return '#4caf50';  // 绿色 - 弱于大盘
                    } else {
                        return '#9E9E9E';  // 灰色 - 同步大盘
                    }
                },
                borderWidth: ctx => {
                    const idx = ctx.p0DataIndex;
                    if (!idx && idx !== 0) return 2.5;

                    const vsIndex = dataLines.vsIndex[idx];

                    // 独立走势时线条更粗
                    if (Math.abs(vsIndex) >= threshold) {
                        return 3.5;
                    } else {
                        return 2.5;
                    }
                }
            },
            backgroundColor: 'transparent',
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            fill: false,
            tension: 0.2
        });

        // 注册背景色插件
        const backgroundColorPlugin = {
            id: 'backgroundColorPlugin',
            beforeDraw: (chart) => {
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;
                const yAxis = chart.scales.y;

                // 绘制0轴上方和下方的背景色（股票涨跌区）
                const zeroY = yAxis.getPixelForValue(0);

                // 0轴以上 - 浅红色背景（股票上涨）
                ctx.fillStyle = 'rgba(244, 67, 54, 0.03)';
                ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, zeroY - chartArea.top);

                // 0轴以下 - 浅绿色背景（股票下跌）
                ctx.fillStyle = 'rgba(76, 175, 80, 0.03)';
                ctx.fillRect(chartArea.left, zeroY, chartArea.right - chartArea.left, chartArea.bottom - zeroY);
            }
        };

        this.charts.independent = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'center',
                        labels: {
                            usePointStyle: false,
                            boxWidth: 40,
                            boxHeight: 4,
                            padding: 25,
                            font: {
                                size: 14,
                                weight: 'bold',
                                family: "'Microsoft YaHei', 'Arial', sans-serif"
                            },
                            color: '#000000',
                            generateLabels: function(chart) {
                                return [
                                    {
                                        text: '同步大盘',
                                        fillStyle: '#9E9E9E',
                                        strokeStyle: '#9E9E9E',
                                        lineWidth: 3,
                                        hidden: false,
                                        fontColor: '#000000'
                                    },
                                    {
                                        text: '强于大盘',
                                        fillStyle: '#f44336',
                                        strokeStyle: '#f44336',
                                        lineWidth: 3,
                                        hidden: false,
                                        fontColor: '#000000'
                                    },
                                    {
                                        text: '弱于大盘',
                                        fillStyle: '#4caf50',
                                        strokeStyle: '#4caf50',
                                        lineWidth: 3,
                                        hidden: false,
                                        fontColor: '#000000'
                                    }
                                ];
                            }
                        },
                        onClick: function(e, legendItem, legend) {
                            // 禁用图例点击，因为现在图例只是颜色说明
                            return false;
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        titleFont: {
                            size: 13,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 12
                        },
                        padding: 12,
                        displayColors: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true,
                        callbacks: {
                            title: function(context) {
                                return '时间: ' + context[0].label;
                            },
                            label: function(context) {
                                const value = context.parsed.y;
                                const idx = context.dataIndex;
                                const prefix = value >= 0 ? '+' : '';
                                const vsIndex = dataLines.vsIndex[idx];

                                // 判断当前状态
                                let status;
                                if (vsIndex >= threshold) {
                                    status = '强于大盘';
                                } else if (vsIndex <= -threshold) {
                                    status = '弱于大盘';
                                } else {
                                    status = '同步大盘';
                                }

                                return [
                                    `股票涨跌: ${prefix}${value.toFixed(2)}%`,
                                    `独立幅度: ${vsIndex >= 0 ? '+' : ''}${vsIndex.toFixed(2)}%`,
                                    `状态: ${status}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 8,
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        display: true,
                        position: 'right',
                        grid: {
                            color: function(context) {
                                // 0轴用更明显的颜色
                                if (context.tick.value === 0) {
                                    return 'rgba(0, 0, 0, 0.3)';
                                }
                                return 'rgba(0, 0, 0, 0.05)';
                            },
                            lineWidth: function(context) {
                                // 0轴用更粗的线
                                if (context.tick.value === 0) {
                                    return 2;
                                }
                                return 1;
                            }
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
                            }
                        }
                    }
                }
            },
            plugins: [backgroundColorPlugin]
        });
    },

    /**
     * 计算两组数据的相关系数
     */
    calculateCorrelation(data1, data2) {
        const minLength = Math.min(data1.length, data2.length);

        const changes1 = [];
        const changes2 = [];

        for (let i = 0; i < minLength; i++) {
            changes1.push((data1[i].price - data1[0].yesterdayClose) / data1[0].yesterdayClose);
            changes2.push((data2[i].price - data2[0].yesterdayClose) / data2[0].yesterdayClose);
        }

        // 计算均值
        const mean1 = changes1.reduce((a, b) => a + b, 0) / changes1.length;
        const mean2 = changes2.reduce((a, b) => a + b, 0) / changes2.length;

        // 计算协方差和标准差
        let cov = 0, std1 = 0, std2 = 0;

        for (let i = 0; i < minLength; i++) {
            const diff1 = changes1[i] - mean1;
            const diff2 = changes2[i] - mean2;
            cov += diff1 * diff2;
            std1 += diff1 * diff1;
            std2 += diff2 * diff2;
        }

        cov /= minLength;
        std1 = Math.sqrt(std1 / minLength);
        std2 = Math.sqrt(std2 / minLength);

        // 相关系数
        return cov / (std1 * std2);
    },

    /**
     * 显示/隐藏加载提示
     */
    showLoading(show) {
        const loading = document.getElementById('independentLoadingTip');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }
};

// 导出到全局
window.IndependentAnalysisManager = IndependentAnalysisManager;
