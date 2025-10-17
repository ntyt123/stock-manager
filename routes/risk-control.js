const express = require('express');
const {
    riskControlRuleModel,
    riskWarningModel,
    riskEventModel,
    positionModel,
    userModel
} = require('../database');
const { getStockIndustry } = require('../controllers/analysisController');

module.exports = (authenticateToken) => {
    const router = express.Router();

    // ==================== 风险控制规则API ====================

    // 获取用户的风险控制规则
    router.get('/rules', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const rules = riskControlRuleModel.getRulesConfig(userId);

            res.json({
                success: true,
                data: { rules }
            });
        } catch (error) {
            console.error('❌ 获取风险控制规则错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取风险控制规则失败'
            });
        }
    });

    // 保存风险控制规则
    router.post('/rules', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { rules } = req.body;

            if (!rules) {
                return res.status(400).json({
                    success: false,
                    error: '规则配置不能为空'
                });
            }

            const result = riskControlRuleModel.saveOrUpdate(userId, rules);

            console.log(`✅ 用户 ${userId} 更新了风险控制规则`);

            res.json({
                success: true,
                data: result,
                message: '风险控制规则保存成功'
            });
        } catch (error) {
            console.error('❌ 保存风险控制规则错误:', error.message);
            res.status(500).json({
                success: false,
                error: '保存风险控制规则失败'
            });
        }
    });

    // ==================== 风险检查API ====================

    // 检查当前持仓的风险状态
    router.get('/check', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            console.log(`📊 开始检查用户 ${userId} 的风险状态...`);

            // 1. 获取风险控制规则
            const rules = riskControlRuleModel.getRulesConfig(userId);

            // 2. 获取用户信息和持仓数据
            const user = await userModel.findById(userId);
            const positions = await positionModel.findByUserId(userId);

            const totalCapital = user?.total_capital || 0;

            if (!positions || positions.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        riskLevel: 'low',
                        violations: [],
                        warnings: [],
                        summary: {
                            totalStocks: 0,
                            totalMarketValue: 0,
                            positionRatio: 0,
                            highRiskCount: 0,
                            mediumRiskCount: 0,
                            lowRiskCount: 0
                        }
                    },
                    message: '暂无持仓数据'
                });
            }

            // 3. 计算持仓汇总数据
            const totalMarketValue = positions.reduce((sum, p) => sum + (parseFloat(p.marketValue) || 0), 0);
            const positionRatio = totalCapital > 0 ? (totalMarketValue / totalCapital * 100) : 0;

            // 4. 进行风险检查
            const violations = [];  // 违规项
            const warnings = [];    // 预警项
            let riskLevel = 'low';  // 总体风险等级

            // 4.1 检查总仓位比例
            if (rules.position.enabled && positionRatio > rules.position.maxTotalPosition) {
                const violation = {
                    type: 'position_exceeded',
                    level: 'high',
                    title: '总仓位超限',
                    message: `当前总仓位${positionRatio.toFixed(2)}%，超过设定上限${rules.position.maxTotalPosition}%`,
                    triggerValue: positionRatio,
                    thresholdValue: rules.position.maxTotalPosition,
                    suggestion: `建议减仓至${rules.position.maxTotalPosition}%以下，需要减少约¥${((positionRatio - rules.position.maxTotalPosition) / 100 * totalCapital).toFixed(2)}`
                };
                violations.push(violation);
                riskLevel = 'high';
            }

            // 4.2 检查单只股票仓位
            for (const pos of positions) {
                const stockValue = parseFloat(pos.marketValue) || 0;
                const stockRatio = totalCapital > 0 ? (stockValue / totalCapital * 100) : 0;

                if (rules.position.enabled && stockRatio > rules.position.maxSingleStockPosition) {
                    const violation = {
                        type: 'single_stock_exceeded',
                        level: 'medium',
                        title: '个股仓位超限',
                        message: `${pos.stockName}(${pos.stockCode})仓位${stockRatio.toFixed(2)}%，超过设定上限${rules.position.maxSingleStockPosition}%`,
                        relatedStockCode: pos.stockCode,
                        relatedStockName: pos.stockName,
                        triggerValue: stockRatio,
                        thresholdValue: rules.position.maxSingleStockPosition,
                        suggestion: `建议减仓至${rules.position.maxSingleStockPosition}%以下`
                    };
                    violations.push(violation);
                    if (riskLevel === 'low') riskLevel = 'medium';
                }
            }

            // 4.3 检查行业集中度
            if (rules.position.enabled) {
                const industryMap = {};
                positions.forEach(pos => {
                    const industry = getStockIndustry(pos.stockCode);
                    const marketValue = parseFloat(pos.marketValue) || 0;

                    if (!industryMap[industry]) {
                        industryMap[industry] = {
                            industry,
                            marketValue: 0,
                            stocks: []
                        };
                    }

                    industryMap[industry].marketValue += marketValue;
                    industryMap[industry].stocks.push({
                        stockCode: pos.stockCode,
                        stockName: pos.stockName,
                        marketValue
                    });
                });

                for (const [industry, data] of Object.entries(industryMap)) {
                    const industryRatio = totalMarketValue > 0 ? (data.marketValue / totalMarketValue * 100) : 0;

                    if (industryRatio > rules.position.maxIndustryConcentration) {
                        const violation = {
                            type: 'industry_concentrated',
                            level: 'medium',
                            title: '行业集中度超限',
                            message: `${industry}行业占比${industryRatio.toFixed(2)}%，超过设定上限${rules.position.maxIndustryConcentration}%`,
                            triggerValue: industryRatio,
                            thresholdValue: rules.position.maxIndustryConcentration,
                            relatedData: {
                                industry,
                                stocks: data.stocks
                            },
                            suggestion: `建议降低${industry}行业配置，增加其他行业股票`
                        };
                        violations.push(violation);
                        if (riskLevel === 'low') riskLevel = 'medium';
                    }
                }
            }

            // 4.4 检查止损止盈
            if (rules.stopLoss.enabled) {
                // 检查账户总止损
                const totalProfitLoss = positions.reduce((sum, p) => sum + (parseFloat(p.profitLoss) || 0), 0);
                const totalProfitLossRate = totalCapital > 0 ? (totalProfitLoss / totalCapital * 100) : 0;

                if (totalProfitLossRate < rules.stopLoss.globalStopLoss) {
                    const violation = {
                        type: 'global_stop_loss',
                        level: 'high',
                        title: '账户总止损触发',
                        message: `账户总亏损${totalProfitLossRate.toFixed(2)}%，触发止损线${rules.stopLoss.globalStopLoss}%`,
                        triggerValue: totalProfitLossRate,
                        thresholdValue: rules.stopLoss.globalStopLoss,
                        suggestion: '建议立即减仓或清仓，控制进一步亏损'
                    };
                    violations.push(violation);
                    riskLevel = 'high';
                }

                // 检查单只股票止损止盈
                for (const pos of positions) {
                    const profitLossRate = parseFloat(pos.profitLossRate) || 0;

                    // 检查止损
                    if (profitLossRate < rules.stopLoss.singleStockStopLoss) {
                        const violation = {
                            type: 'stock_stop_loss',
                            level: 'high',
                            title: '个股止损触发',
                            message: `${pos.stockName}(${pos.stockCode})亏损${profitLossRate.toFixed(2)}%，触发止损线${rules.stopLoss.singleStockStopLoss}%`,
                            relatedStockCode: pos.stockCode,
                            relatedStockName: pos.stockName,
                            triggerValue: profitLossRate,
                            thresholdValue: rules.stopLoss.singleStockStopLoss,
                            suggestion: `建议止损离场，当前价格¥${pos.currentPrice.toFixed(2)}`
                        };
                        violations.push(violation);
                        riskLevel = 'high';
                    }

                    // 检查止盈
                    if (profitLossRate > rules.stopLoss.singleStockStopProfit) {
                        const warning = {
                            type: 'stock_stop_profit',
                            level: 'low',
                            title: '个股止盈提示',
                            message: `${pos.stockName}(${pos.stockCode})盈利${profitLossRate.toFixed(2)}%，已达止盈线${rules.stopLoss.singleStockStopProfit}%`,
                            relatedStockCode: pos.stockCode,
                            relatedStockName: pos.stockName,
                            triggerValue: profitLossRate,
                            thresholdValue: rules.stopLoss.singleStockStopProfit,
                            suggestion: '建议逐步止盈，锁定利润'
                        };
                        warnings.push(warning);
                    }
                }
            }

            // 4.5 检查黑名单
            if (rules.tradingLimits.enabled && rules.tradingLimits.blacklist.length > 0) {
                for (const pos of positions) {
                    if (rules.tradingLimits.blacklist.includes(pos.stockCode)) {
                        const warning = {
                            type: 'blacklist',
                            level: 'medium',
                            title: '黑名单股票持仓',
                            message: `${pos.stockName}(${pos.stockCode})在交易黑名单中`,
                            relatedStockCode: pos.stockCode,
                            relatedStockName: pos.stockName,
                            suggestion: '建议择机清仓该股票'
                        };
                        warnings.push(warning);
                    }
                }
            }

            // 5. 构建风险汇总
            const summary = {
                totalStocks: positions.length,
                totalMarketValue,
                totalCapital,
                positionRatio: positionRatio.toFixed(2),
                highRiskCount: violations.filter(v => v.level === 'high').length,
                mediumRiskCount: violations.filter(v => v.level === 'medium').length,
                lowRiskCount: warnings.filter(w => w.level === 'low').length
            };

            console.log(`✅ 风险检查完成: 风险等级=${riskLevel}, 违规=${violations.length}项, 预警=${warnings.length}项`);

            res.json({
                success: true,
                data: {
                    riskLevel,
                    violations,
                    warnings,
                    summary,
                    rules,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ 风险检查错误:', error.message);
            res.status(500).json({
                success: false,
                error: '风险检查失败: ' + error.message
            });
        }
    });

    // ==================== 风险预警API ====================

    // 获取风险预警列表
    router.get('/warnings', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                limit = 50,
                offset = 0,
                isRead = null,
                warningLevel = null
            } = req.query;

            const warnings = riskWarningModel.getByUserId(userId, {
                limit: parseInt(limit),
                offset: parseInt(offset),
                isRead: isRead !== null ? (isRead === 'true' || isRead === '1') : null,
                warningLevel
            });

            const unreadCount = riskWarningModel.getUnreadCount(userId);

            res.json({
                success: true,
                data: {
                    warnings,
                    unreadCount,
                    hasMore: warnings.length >= parseInt(limit)
                }
            });
        } catch (error) {
            console.error('❌ 获取风险预警列表错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取风险预警列表失败'
            });
        }
    });

    // 标记预警为已读
    router.put('/warnings/:warningId/read', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const warningId = parseInt(req.params.warningId);

            riskWarningModel.markAsRead(warningId, userId);

            res.json({
                success: true,
                message: '已标记为已读'
            });
        } catch (error) {
            console.error('❌ 标记预警为已读错误:', error.message);
            res.status(500).json({
                success: false,
                error: '标记预警失败'
            });
        }
    });

    // 标记所有预警为已读
    router.put('/warnings/read-all', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;

            const result = riskWarningModel.markAllAsRead(userId);

            res.json({
                success: true,
                message: '已标记所有预警为已读',
                updatedCount: result.changes
            });
        } catch (error) {
            console.error('❌ 标记所有预警为已读错误:', error.message);
            res.status(500).json({
                success: false,
                error: '标记预警失败'
            });
        }
    });

    // 删除预警
    router.delete('/warnings/:warningId', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const warningId = parseInt(req.params.warningId);

            const result = riskWarningModel.delete(warningId, userId);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '预警不存在或已被删除'
                });
            }

            res.json({
                success: true,
                message: '预警删除成功'
            });
        } catch (error) {
            console.error('❌ 删除预警错误:', error.message);
            res.status(500).json({
                success: false,
                error: '删除预警失败'
            });
        }
    });

    // ==================== 风险事件API ====================

    // 获取风险事件列表
    router.get('/events', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                limit = 50,
                offset = 0,
                eventLevel = null,
                startDate = null,
                endDate = null
            } = req.query;

            const events = riskEventModel.getByUserId(userId, {
                limit: parseInt(limit),
                offset: parseInt(offset),
                eventLevel,
                startDate,
                endDate
            });

            const stats = riskEventModel.getStatistics(userId, 30);

            res.json({
                success: true,
                data: {
                    events,
                    statistics: stats,
                    hasMore: events.length >= parseInt(limit)
                }
            });
        } catch (error) {
            console.error('❌ 获取风险事件列表错误:', error.message);
            res.status(500).json({
                success: false,
                error: '获取风险事件列表失败'
            });
        }
    });

    // 删除风险事件
    router.delete('/events/:eventId', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const eventId = parseInt(req.params.eventId);

            const result = riskEventModel.delete(eventId, userId);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: '事件不存在或已被删除'
                });
            }

            res.json({
                success: true,
                message: '事件删除成功'
            });
        } catch (error) {
            console.error('❌ 删除风险事件错误:', error.message);
            res.status(500).json({
                success: false,
                error: '删除风险事件失败'
            });
        }
    });

    return router;
};
