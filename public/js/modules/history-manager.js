// 预测历史记录管理模块（升级版）

// 当前查看的预测类型
let currentPredictionType = null;
let currentRecords = [];

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

// 打开某个模块的历史记录
function openModuleHistory(predictionType) {
    currentPredictionType = predictionType;
    const typeName = PREDICTION_TYPE_MAP[predictionType] || predictionType;

    // 显示弹窗标题
    const title = document.getElementById('historyModuleTitle');
    if (title) {
        title.textContent = `📚 ${typeName} - 历史记录`;
    }

    // 显示弹窗
    const modal = document.getElementById('historyModuleModal');
    if (modal) {
        modal.style.display = 'flex';

        // 加载历史记录
        loadModuleHistory();
    }
}

// 加载模块历史记录
async function loadModuleHistory() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('请先登录', 'error');
            return;
        }

        const stockCode = document.getElementById('historyModuleFilterStock')?.value.trim() || '';
        const startDate = document.getElementById('historyModuleFilterStartDate')?.value || '';
        const endDate = document.getElementById('historyModuleFilterEndDate')?.value || '';

        // 构建查询参数
        const params = new URLSearchParams();
        params.append('predictionType', currentPredictionType);
        if (stockCode) params.append('stockCode', stockCode);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('limit', 100);  // 一次加载更多
        params.append('offset', 0);

        const response = await fetch(`/api/prediction/history?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            currentRecords = result.data.records;
            displayModuleHistory(currentRecords, result.data.totalCount);
        } else {
            showMessage('加载历史记录失败: ' + result.error, 'error');
        }

    } catch (error) {
        console.error('加载历史记录错误:', error);
        showMessage('加载历史记录失败: ' + error.message, 'error');
    }
}

// 显示模块历史记录
function displayModuleHistory(records, totalCount) {
    const listElement = document.getElementById('historyModuleList');
    const countElement = document.getElementById('historyModuleCount');

    if (!listElement) return;

    // 更新总数
    if (countElement) {
        countElement.textContent = `共 ${totalCount} 条记录`;
    }

    // 清空列表
    listElement.innerHTML = '';

    if (records.length === 0) {
        listElement.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                <div>暂无历史记录</div>
            </div>
        `;
        return;
    }

    // 显示记录
    records.forEach(record => {
        const div = document.createElement('div');
        div.style.cssText = 'background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; margin-bottom: 10px; cursor: pointer; transition: all 0.3s;';

        const stockInfo = record.stock_code ? `${record.stock_code} - ${record.stock_name}` : (record.stock_name || '');

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; margin-bottom: 6px;">
                        <span style="font-weight: 600; color: #00695c; font-size: 14px;">${stockInfo || '市场预测'}</span>
                    </div>
                    <div style="display: flex; gap: 15px; color: #78909c; font-size: 12px;">
                        <span>📅 ${record.prediction_date}</span>
                        <span>🕒 ${new Date(record.created_at).toLocaleString('zh-CN')}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="viewHistoryDetail(${record.id}); event.stopPropagation();" style="padding: 6px 14px; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        👁️ 查看
                    </button>
                    <button onclick="deleteHistoryRecord(${record.id}); event.stopPropagation();" style="padding: 6px 14px; background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        🗑️ 删除
                    </button>
                </div>
            </div>
        `;

        div.onclick = () => viewHistoryDetail(record.id);
        div.onmouseenter = () => {
            div.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
            div.style.transform = 'translateY(-2px)';
        };
        div.onmouseleave = () => {
            div.style.boxShadow = 'none';
            div.style.transform = 'translateY(0)';
        };

        listElement.appendChild(div);
    });
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

            const modal = document.getElementById('historyDetailModal');
            const title = document.getElementById('historyDetailTitle');
            const content = document.getElementById('historyDetailContent');

            if (!modal || !title || !content) return;

            title.innerHTML = `${typeIcon} ${typeName} - ${stockInfo}`;

            let detailHtml = `
                <div style="margin-bottom: 15px; padding: 12px; background: #f5f7fa; border-radius: 8px;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 13px;">
                        <div><strong>📅 预测日期:</strong> ${record.prediction_date}</div>
                        <div><strong>🕒 生成时间:</strong> ${new Date(record.created_at).toLocaleString('zh-CN')}</div>
                    </div>
                </div>
            `;

            if (record.paipan_info) {
                detailHtml += `
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; font-size: 15px; color: #00695c;">📊 排盘信息</h4>
                        <div class="paipan-display-area">${formatPaipanInfo(record.paipan_info)}</div>
                    </div>
                `;
            }

            detailHtml += `
                <div>
                    <h4 style="margin: 0 0 10px 0; font-size: 15px; color: #00695c;">🔮 预测内容</h4>
                    <div class="prediction-markdown-content">${marked.parse(record.prediction_content)}</div>
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
        <div style="background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0;">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; font-size: 12px;">
                <div><strong>📅 日期:</strong> ${paipanInfo.date || ''}</div>
                <div><strong>⏰ 时辰:</strong> ${paipanInfo.hourGanZhi || ''}</div>
                <div><strong>🌞 日干支:</strong> ${paipanInfo.dayGanZhi || ''}</div>
                <div><strong>🌙 月将:</strong> ${paipanInfo.monthJiang || ''}</div>
            </div>
    `;

    if (paipanInfo.siKe && paipanInfo.siKe.length > 0) {
        html += `
            <div style="margin-bottom: 12px;">
                <strong style="font-size: 12px;">📋 四课:</strong>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 6px;">
                    ${paipanInfo.siKe.map(ke => `
                        <div style="padding: 6px; background: #f5f7fa; border-radius: 4px; font-size: 11px;">
                            <strong>${ke.name}:</strong> ${ke.earthBranch} - ${ke.heavenlyStem}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    if (paipanInfo.sanChuan) {
        html += `
            <div style="margin-bottom: 12px;">
                <strong style="font-size: 12px;">🔮 三传:</strong>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px;">
                    <div style="padding: 6px; background: #e8f5e9; border-radius: 4px; text-align: center; font-size: 11px;">
                        <strong>初传:</strong> ${paipanInfo.sanChuan.chu || ''}
                    </div>
                    <div style="padding: 6px; background: #e3f2fd; border-radius: 4px; text-align: center; font-size: 11px;">
                        <strong>中传:</strong> ${paipanInfo.sanChuan.zhong || ''}
                    </div>
                    <div style="padding: 6px; background: #fce4ec; border-radius: 4px; text-align: center; font-size: 11px;">
                        <strong>末传:</strong> ${paipanInfo.sanChuan.mo || ''}
                    </div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

// 关闭模块历史记录弹窗
function closeModuleHistoryModal() {
    const modal = document.getElementById('historyModuleModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 关闭详情弹窗
function closeHistoryDetail() {
    const modal = document.getElementById('historyDetailModal');
    if (modal) {
        modal.style.display = 'none';
    }
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
            loadModuleHistory();  // 重新加载列表
        } else {
            showMessage('删除失败: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('删除历史记录错误:', error);
        showMessage('删除失败: ' + error.message, 'error');
    }
}

// 重置筛选条件
function resetModuleHistoryFilters() {
    const stockInput = document.getElementById('historyModuleFilterStock');
    const startDateInput = document.getElementById('historyModuleFilterStartDate');
    const endDateInput = document.getElementById('historyModuleFilterEndDate');

    if (stockInput) stockInput.value = '';
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';

    loadModuleHistory();
}

// 导出为Excel
function exportModuleHistoryToExcel() {
    try {
        if (currentRecords.length === 0) {
            showMessage('暂无数据可导出', 'warning');
            return;
        }

        // 准备数据
        const data = currentRecords.map(record => {
            return {
                '预测类型': PREDICTION_TYPE_MAP[record.prediction_type] || record.prediction_type,
                '股票代码': record.stock_code || '',
                '股票名称': record.stock_name || '',
                '预测日期': record.prediction_date,
                '创建时间': new Date(record.created_at).toLocaleString('zh-CN'),
                '更新时间': new Date(record.updated_at).toLocaleString('zh-CN')
            };
        });

        // 创建工作簿
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        // 设置列宽
        ws['!cols'] = [
            { wch: 15 },  // 预测类型
            { wch: 10 },  // 股票代码
            { wch: 15 },  // 股票名称
            { wch: 12 },  // 预测日期
            { wch: 20 },  // 创建时间
            { wch: 20 }   // 更新时间
        ];

        XLSX.utils.book_append_sheet(wb, ws, "预测历史记录");

        // 生成文件名
        const typeName = PREDICTION_TYPE_MAP[currentPredictionType] || '预测';
        const filename = `${typeName}_历史记录_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`;

        // 导出
        XLSX.writeFile(wb, filename);

        showMessage('导出成功', 'success');
    } catch (error) {
        console.error('导出Excel错误:', error);
        showMessage('导出失败: ' + error.message, 'error');
    }
}

// 模态框点击外部关闭
window.addEventListener('click', function(event) {
    const moduleModal = document.getElementById('historyModuleModal');
    const detailModal = document.getElementById('historyDetailModal');

    if (event.target === moduleModal) {
        closeModuleHistoryModal();
    }
    if (event.target === detailModal) {
        closeHistoryDetail();
    }
});

// 导出函数供全局使用
window.openModuleHistory = openModuleHistory;
window.loadModuleHistory = loadModuleHistory;
window.closeModuleHistoryModal = closeModuleHistoryModal;
window.viewHistoryDetail = viewHistoryDetail;
window.closeHistoryDetail = closeHistoryDetail;
window.deleteHistoryRecord = deleteHistoryRecord;
window.resetModuleHistoryFilters = resetModuleHistoryFilters;
window.exportModuleHistoryToExcel = exportModuleHistoryToExcel;
