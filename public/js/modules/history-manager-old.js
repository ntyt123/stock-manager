// 预测历史记录管理模块

// 历史记录状态
let historyState = {
    currentOffset: 0,
    limit: 20,
    hasMore: false,
    currentFilters: {}
};

// 预测类型映射
const PREDICTION_TYPE_MAP = {
    'market_prediction': '大盘预测',
    'trend_prediction': '趋势分析',
    'stock_trend_prediction': '股票趋势预测',
    'stock_risk_prediction': '股票风险预测',
    'stock_sentiment_prediction': '个股情绪预测',
    'market_sentiment_prediction': '市场情绪预测'
};

// 预测类型图标映射
const PREDICTION_TYPE_ICON = {
    'market_prediction': '📈',
    'trend_prediction': '📊',
    'stock_trend_prediction': '🔮',
    'stock_risk_prediction': '⚠️',
    'stock_sentiment_prediction': '😊',
    'market_sentiment_prediction': '🌐'
};

// 加载预测历史记录
async function loadPredictionHistory(reset = true) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('请先登录', 'error');
            return;
        }

        // 重置状态
        if (reset) {
            historyState.currentOffset = 0;
            historyState.hasMore = false;
        }

        // 获取过滤条件
        const filters = {
            predictionType: document.getElementById('historyFilterType').value,
            stockCode: document.getElementById('historyFilterStock').value.trim(),
            startDate: document.getElementById('historyFilterStartDate').value,
            endDate: document.getElementById('historyFilterEndDate').value,
            limit: historyState.limit,
            offset: historyState.currentOffset
        };

        // 保存当前过滤条件
        historyState.currentFilters = filters;

        // 构建查询参数
        const params = new URLSearchParams();
        if (filters.predictionType) params.append('predictionType', filters.predictionType);
        if (filters.stockCode) params.append('stockCode', filters.stockCode);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        params.append('limit', filters.limit);
        params.append('offset', filters.offset);

        const response = await fetch(`/api/prediction/history?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            const { records, totalCount, hasMore } = result.data;

            // 更新状态
            historyState.hasMore = hasMore;

            // 显示记录
            if (reset) {
                displayHistoryRecords(records, totalCount);
            } else {
                appendHistoryRecords(records);
            }

            // 更新"加载更多"按钮
            const loadMoreContainer = document.getElementById('historyLoadMoreContainer');
            if (hasMore) {
                loadMoreContainer.style.display = 'block';
            } else {
                loadMoreContainer.style.display = 'none';
            }

        } else {
            showMessage('加载历史记录失败: ' + result.error, 'error');
        }

    } catch (error) {
        console.error('加载历史记录错误:', error);
        showMessage('加载历史记录失败: ' + error.message, 'error');
    }
}

// 显示历史记录列表
function displayHistoryRecords(records, totalCount) {
    const historyList = document.getElementById('historyList');
    const historyCount = document.getElementById('historyCount');

    // 更新总数
    historyCount.textContent = `共 ${totalCount} 条记录`;

    // 清空列表
    historyList.innerHTML = '';

    if (records.length === 0) {
        historyList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                <div>暂无历史记录</div>
            </div>
        `;
        return;
    }

    // 显示记录
    records.forEach(record => {
        const recordElement = createHistoryRecordElement(record);
        historyList.appendChild(recordElement);
    });
}

// 追加历史记录
function appendHistoryRecords(records) {
    const historyList = document.getElementById('historyList');

    records.forEach(record => {
        const recordElement = createHistoryRecordElement(record);
        historyList.appendChild(recordElement);
    });
}

// 创建历史记录元素
function createHistoryRecordElement(record) {
    const div = document.createElement('div');
    div.className = 'history-record-item';
    div.style.cssText = 'background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 10px; cursor: pointer; transition: all 0.3s;';

    const typeName = PREDICTION_TYPE_MAP[record.prediction_type] || record.prediction_type;
    const typeIcon = PREDICTION_TYPE_ICON[record.prediction_type] || '📋';
    const stockInfo = record.stock_code ? `${record.stock_code} - ${record.stock_name}` : record.stock_name;

    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 20px; margin-right: 8px;">${typeIcon}</span>
                    <span style="font-weight: 600; color: #00695c; font-size: 15px;">${typeName}</span>
                    <span style="margin-left: 10px; color: #78909c; font-size: 14px;">${stockInfo}</span>
                </div>
                <div style="display: flex; gap: 15px; color: #78909c; font-size: 13px;">
                    <span>📅 预测日期: ${record.prediction_date}</span>
                    <span>🕒 生成时间: ${new Date(record.created_at).toLocaleString('zh-CN')}</span>
                    ${record.updated_at !== record.created_at ?
                        `<span>🔄 更新时间: ${new Date(record.updated_at).toLocaleString('zh-CN')}</span>` :
                        ''}
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="viewHistoryDetail(${record.id}); event.stopPropagation();" class="btn-icon" style="padding: 8px 16px; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                    👁️ 查看
                </button>
                <button onclick="deleteHistoryRecord(${record.id}); event.stopPropagation();" class="btn-icon" style="padding: 8px 16px; background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                    🗑️ 删除
                </button>
            </div>
        </div>
    `;

    // 点击整行也可以查看详情
    div.onclick = () => viewHistoryDetail(record.id);

    // 鼠标悬停效果
    div.onmouseenter = () => {
        div.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        div.style.transform = 'translateY(-2px)';
    };
    div.onmouseleave = () => {
        div.style.boxShadow = 'none';
        div.style.transform = 'translateY(0)';
    };

    return div;
}

// 查看历史记录详情
async function viewHistoryDetail(recordId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('请先登录', 'error');
            return;
        }

        const response = await fetch(`/api/prediction/history/${recordId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            const record = result.data;

            const typeName = PREDICTION_TYPE_MAP[record.prediction_type] || record.prediction_type;
            const typeIcon = PREDICTION_TYPE_ICON[record.prediction_type] || '📋';
            const stockInfo = record.stock_code ? `${record.stock_code} - ${record.stock_name}` : record.stock_name;

            // 显示模态框
            const modal = document.getElementById('historyDetailModal');
            const title = document.getElementById('historyDetailTitle');
            const content = document.getElementById('historyDetailContent');

            title.innerHTML = `${typeIcon} ${typeName} - ${stockInfo}`;

            let detailHtml = `
                <div style="margin-bottom: 20px; padding: 15px; background: #f5f7fa; border-radius: 8px;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 14px;">
                        <div><strong>📅 预测日期:</strong> ${record.prediction_date}</div>
                        <div><strong>🕒 生成时间:</strong> ${new Date(record.created_at).toLocaleString('zh-CN')}</div>
                        ${record.updated_at !== record.created_at ?
                            `<div style="grid-column: 1 / -1;"><strong>🔄 更新时间:</strong> ${new Date(record.updated_at).toLocaleString('zh-CN')}</div>` :
                            ''}
                    </div>
                </div>
            `;

            // 如果有排盘信息，显示排盘信息
            if (record.paipan_info) {
                detailHtml += `
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; font-size: 16px; color: #00695c;">📊 排盘信息</h4>
                        <div class="paipan-display-area">
                            ${formatPaipanInfo(record.paipan_info)}
                        </div>
                    </div>
                `;
            }

            // 显示预测内容
            detailHtml += `
                <div>
                    <h4 style="margin: 0 0 10px 0; font-size: 16px; color: #00695c;">🔮 预测内容</h4>
                    <div class="prediction-markdown-content">
                        ${marked.parse(record.prediction_content)}
                    </div>
                </div>
            `;

            content.innerHTML = detailHtml;
            modal.style.display = 'flex';

        } else {
            showMessage('加载详情失败: ' + result.error, 'error');
        }

    } catch (error) {
        console.error('查看历史记录详情错误:', error);
        showMessage('查看详情失败: ' + error.message, 'error');
    }
}

// 格式化排盘信息
function formatPaipanInfo(paipanInfo) {
    if (typeof paipanInfo === 'string') {
        try {
            paipanInfo = JSON.parse(paipanInfo);
        } catch (e) {
            return paipanInfo;
        }
    }

    let html = `
        <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0;">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px;">
                <div><strong>📅 日期:</strong> ${paipanInfo.date || ''}</div>
                <div><strong>⏰ 时辰:</strong> ${paipanInfo.hourGanZhi || ''}</div>
                <div><strong>🌞 日干支:</strong> ${paipanInfo.dayGanZhi || ''}</div>
                <div><strong>🌙 月将:</strong> ${paipanInfo.monthJiang || ''}</div>
            </div>
    `;

    // 四课
    if (paipanInfo.siKe && paipanInfo.siKe.length > 0) {
        html += `
            <div style="margin-bottom: 15px;">
                <strong>📋 四课:</strong>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px;">
                    ${paipanInfo.siKe.map(ke => `
                        <div style="padding: 8px; background: #f5f7fa; border-radius: 4px; font-size: 13px;">
                            <strong>${ke.name}:</strong> ${ke.earthBranch}（地支） - ${ke.heavenlyStem}（天干）
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 三传
    if (paipanInfo.sanChuan) {
        html += `
            <div style="margin-bottom: 15px;">
                <strong>🔮 三传:</strong>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px;">
                    <div style="padding: 8px; background: #e8f5e9; border-radius: 4px; text-align: center; font-size: 13px;">
                        <strong>初传:</strong> ${paipanInfo.sanChuan.chu || ''}
                    </div>
                    <div style="padding: 8px; background: #e3f2fd; border-radius: 4px; text-align: center; font-size: 13px;">
                        <strong>中传:</strong> ${paipanInfo.sanChuan.zhong || ''}
                    </div>
                    <div style="padding: 8px; background: #fce4ec; border-radius: 4px; text-align: center; font-size: 13px;">
                        <strong>末传:</strong> ${paipanInfo.sanChuan.mo || ''}
                    </div>
                </div>
            </div>
        `;
    }

    // 十二神
    if (paipanInfo.twelveGods && paipanInfo.twelveGods.length > 0) {
        html += `
            <div>
                <strong>🎭 十二神:</strong>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px;">
                    ${paipanInfo.twelveGods.map(god => `
                        <div style="padding: 6px; background: #fff3e0; border-radius: 4px; text-align: center; font-size: 12px;">
                            ${god.position}位: ${god.god}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

// 关闭历史记录详情
function closeHistoryDetail() {
    const modal = document.getElementById('historyDetailModal');
    modal.style.display = 'none';
}

// 删除历史记录
async function deleteHistoryRecord(recordId) {
    if (!confirm('确定要删除这条历史记录吗？')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('请先登录', 'error');
            return;
        }

        const response = await fetch(`/api/prediction/history/${recordId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            showMessage('删除成功', 'success');
            // 重新加载列表
            loadPredictionHistory(true);
        } else {
            showMessage('删除失败: ' + result.error, 'error');
        }

    } catch (error) {
        console.error('删除历史记录错误:', error);
        showMessage('删除失败: ' + error.message, 'error');
    }
}

// 加载更多历史记录
function loadMoreHistory() {
    historyState.currentOffset += historyState.limit;
    loadPredictionHistory(false);
}

// 重置过滤器
function resetHistoryFilters() {
    document.getElementById('historyFilterType').value = '';
    document.getElementById('historyFilterStock').value = '';
    document.getElementById('historyFilterStartDate').value = '';
    document.getElementById('historyFilterEndDate').value = '';

    loadPredictionHistory(true);
}

// 模态框点击外部关闭
window.addEventListener('click', function(event) {
    const modal = document.getElementById('historyDetailModal');
    if (event.target === modal) {
        closeHistoryDetail();
    }
});

// 导出函数供全局使用
window.loadPredictionHistory = loadPredictionHistory;
window.viewHistoryDetail = viewHistoryDetail;
window.closeHistoryDetail = closeHistoryDetail;
window.deleteHistoryRecord = deleteHistoryRecord;
window.loadMoreHistory = loadMoreHistory;
window.resetHistoryFilters = resetHistoryFilters;
