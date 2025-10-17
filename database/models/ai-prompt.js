const { db } = require('../connection');

// AI提示词模板模型
const aiPromptTemplateModel = {
    /**
     * 获取所有提示词模板
     */
    findAll() {
        const stmt = db.prepare(`
            SELECT * FROM ai_prompt_templates
            ORDER BY category, id
        `);
        return stmt.all();
    },

    /**
     * 根据ID获取提示词模板
     */
    findById(templateId) {
        const stmt = db.prepare('SELECT * FROM ai_prompt_templates WHERE id = ?');
        return stmt.get(templateId);
    },

    /**
     * 根据场景类型获取提示词模板
     */
    findBySceneType(sceneType) {
        const stmt = db.prepare('SELECT * FROM ai_prompt_templates WHERE scene_type = ?');
        return stmt.get(sceneType);
    },

    /**
     * 根据分类获取提示词模板列表
     */
    findByCategory(category) {
        const stmt = db.prepare('SELECT * FROM ai_prompt_templates WHERE category = ? ORDER BY id');
        return stmt.all(category);
    },

    /**
     * 更新提示词模板
     */
    update(templateId, data) {
        const { systemPrompt, userPromptTemplate, variables, description } = data;
        const stmt = db.prepare(`
            UPDATE ai_prompt_templates
            SET system_prompt = ?,
                user_prompt_template = ?,
                variables = ?,
                description = ?,
                updated_at = ?
            WHERE id = ?
        `);

        return stmt.run(
            systemPrompt,
            userPromptTemplate,
            JSON.stringify(variables || []),
            description || '',
            new Date().toISOString(),
            templateId
        );
    },

    /**
     * 创建新的提示词模板
     */
    create(data) {
        const {
            sceneType,
            sceneName,
            category,
            systemPrompt,
            userPromptTemplate,
            variables,
            description
        } = data;

        const stmt = db.prepare(`
            INSERT INTO ai_prompt_templates
            (scene_type, scene_name, category, system_prompt, user_prompt_template,
             variables, description, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `);

        const now = new Date().toISOString();
        const result = stmt.run(
            sceneType,
            sceneName,
            category,
            systemPrompt,
            userPromptTemplate,
            JSON.stringify(variables || []),
            description || '',
            now,
            now
        );

        return {
            id: result.lastInsertRowid,
            ...data,
            is_active: 1,
            created_at: now,
            updated_at: now
        };
    },

    /**
     * 删除提示词模板
     */
    delete(templateId) {
        const stmt = db.prepare('DELETE FROM ai_prompt_templates WHERE id = ?');
        return stmt.run(templateId);
    },

    /**
     * 启用/禁用提示词模板
     */
    toggleActive(templateId, isActive) {
        const stmt = db.prepare(`
            UPDATE ai_prompt_templates
            SET is_active = ?,
                updated_at = ?
            WHERE id = ?
        `);

        return stmt.run(
            isActive ? 1 : 0,
            new Date().toISOString(),
            templateId
        );
    },

    /**
     * 重置提示词模板为默认值
     */
    resetToDefault(sceneType) {
        const defaultTemplates = getDefaultTemplates();
        const defaultTemplate = defaultTemplates.find(t => t.scene_type === sceneType);

        if (!defaultTemplate) {
            throw new Error('找不到默认提示词模板');
        }

        const stmt = db.prepare(`
            UPDATE ai_prompt_templates
            SET system_prompt = ?,
                user_prompt_template = ?,
                variables = ?,
                description = ?,
                updated_at = ?
            WHERE scene_type = ?
        `);

        return stmt.run(
            defaultTemplate.system_prompt,
            defaultTemplate.user_prompt_template,
            JSON.stringify(defaultTemplate.variables),
            defaultTemplate.description,
            new Date().toISOString(),
            sceneType
        );
    },

    /**
     * 初始化默认提示词模板
     */
    initDefaultTemplates() {
        const stmt = db.prepare('SELECT COUNT(*) as count FROM ai_prompt_templates');
        const row = stmt.get();

        if (row.count === 0) {
            const templates = getDefaultTemplates();
            const insertStmt = db.prepare(`
                INSERT INTO ai_prompt_templates
                (scene_type, scene_name, category, system_prompt, user_prompt_template,
                 variables, description, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            `);

            const now = new Date().toISOString();
            templates.forEach(template => {
                insertStmt.run(
                    template.scene_type,
                    template.scene_name,
                    template.category,
                    template.system_prompt,
                    template.user_prompt_template,
                    JSON.stringify(template.variables),
                    template.description,
                    now,
                    now
                );
            });

            console.log('✅ AI提示词默认模板初始化完成');
        }
    }
};

/**
 * 获取默认提示词模板配置
 */
function getDefaultTemplates() {
    return [
        // AI投资助手
        {
            scene_type: 'ai_chat',
            scene_name: 'AI投资助手',
            category: 'chat',
            system_prompt: '你是一位专业的股票投资顾问助手。你需要为用户提供专业的投资建议、市场分析和风险提示。请用简洁、专业的语言回答用户的问题。注意：你的建议仅供参考,不构成具体的投资建议。',
            user_prompt_template: '{message}',
            variables: [
                { name: '用户消息', key: 'message', type: 'text', description: '用户输入的问题或咨询内容', required: true }
            ],
            description: 'AI投资助手的对话提示词，用于回答用户的投资咨询问题'
        },

        // 持仓分析
        {
            scene_type: 'portfolio_analysis',
            scene_name: '持仓分析',
            category: 'analysis',
            system_prompt: '你是一位专业的股票投资顾问助手，擅长分析持仓数据并提供投资建议。',
            user_prompt_template: `请对以下持仓进行每日例行分析：

【持仓数据】
{positions}

【总资金】
¥{total_capital}

【盈亏情况】
{profit_loss}

请结合投资者的资金规模和仓位情况，提供：
1. 今日持仓表现评估
2. 仓位管理建议（基于当前仓位占比）
3. 明日需要关注的股票
4. 风险提示和操作建议

请简明扼要，突出重点。`,
            variables: [
                { name: '持仓数据', key: 'positions', type: 'text', description: '用户当前持仓数据（包含股票、数量、成本、市值、盈亏等）', required: true },
                { name: '总资金', key: 'total_capital', type: 'number', description: '用户的总投资资金', required: true },
                { name: '盈亏情况', key: 'profit_loss', type: 'text', description: '持仓盈亏详情', required: true },
                { name: '日期', key: 'date', type: 'text', description: '当前日期', required: false },
                { name: '时间', key: 'time', type: 'text', description: '当前时间', required: false }
            ],
            description: '每日持仓分析报告的提示词模板，用于生成持仓分析报告'
        },

        // 集合竞价分析
        {
            scene_type: 'call_auction_analysis',
            scene_name: '集合竞价分析',
            category: 'analysis',
            system_prompt: '你是一位专业的A股市场分析师，擅长解读集合竞价和盘前信息。',
            user_prompt_template: `请作为专业的股票分析师，对今日（{date}）的A股市场集合竞价情况进行分析：

【市场指数概况】
{indices}

请从以下几个方面进行专业分析：

1. **集合竞价特征**
   - 分析三大指数的开盘情况和市场情绪
   - 判断今日市场的整体强弱
   - 识别是否有明显的主力资金动向

2. **市场热点**
   - 根据指数表现推断可能的热点板块
   - 分析资金流向和市场偏好
   - 预判今日可能活跃的行业

3. **交易策略建议**
   - 今日操作建议（激进/稳健/观望）
   - 重点关注的指数区间
   - 仓位控制建议

4. **风险提示**
   - 识别今日潜在风险点
   - 提醒需要警惕的市场信号
   - 建议设置止损位

5. **全天展望**
   - 预测今日市场可能走势
   - 关键时间节点提醒
   - 收盘预期

请提供简明扼要、可执行的专业分析建议。注意：以上建议仅供参考，不构成具体投资建议。`,
            variables: [
                { name: '日期', key: 'date', type: 'text', description: '当前日期', required: true },
                { name: '市场指数', key: 'indices', type: 'text', description: '主要市场指数数据', required: true },
                { name: '市场数据', key: 'market_data', type: 'text', description: '市场整体数据', required: false }
            ],
            description: '每日集合竞价分析的提示词模板，用于生成盘前市场分析'
        },

        // 股票推荐
        {
            scene_type: 'stock_recommendation',
            scene_name: '股票推荐',
            category: 'recommendation',
            system_prompt: '你是一位专业的A股投资顾问，擅长分析市场趋势和推荐优质股票。',
            user_prompt_template: `请作为专业的股票投资顾问，基于当前市场数据和投资者资金情况，为投资者推荐下一个交易日值得关注和买入的股票：

【市场概况 - {date}】
{indices}

【投资者持仓】
{positions}

【总资金】
¥{total_capital}

请结合投资者的资金规模和持仓情况，从以下几个方面进行专业推荐：

1. **市场趋势分析**
   - 分析当前市场整体走势和情绪
   - 识别市场热点板块和资金流向
   - 判断短期市场机会

2. **推荐股票（3-5只）**

   对于每只推荐的股票，请按以下格式提供：

   **股票名称 (股票代码)**
   - **推荐理由**: 详细说明推荐该股票的理由（如基本面、技术面、消息面等）
   - **目标买入价**: ¥XX.XX - ¥XX.XX（给出合理的买入价格区间）
   - **止盈位**: ¥XX.XX（建议盈利XX%止盈）
   - **止损位**: ¥XX.XX（建议跌破此价格止损）
   - **持仓建议**: X%（建议占总仓位的比例）
   - **投资周期**: 短线/中线/长线
   - **风险等级**: 高/中/低

3. **交易策略**
   - 具体操作建议
   - 仓位控制建议
   - 分批买入策略

4. **风险提示**
   - 市场风险警示
   - 个股风险提示
   - 注意事项

5. **免责声明**
   以上推荐仅供参考，不构成具体投资建议。投资有风险，入市需谨慎。

请提供详细、专业、可执行的股票推荐和交易建议。`,
            variables: [
                { name: '日期', key: 'date', type: 'text', description: '当前日期', required: true },
                { name: '市场指数', key: 'indices', type: 'text', description: '市场主要指数数据', required: true },
                { name: '持仓数据', key: 'positions', type: 'text', description: '投资者当前持仓', required: false },
                { name: '总资金', key: 'total_capital', type: 'number', description: '投资者总资金', required: false },
                { name: '自选股', key: 'watchlist', type: 'text', description: '投资者自选股列表', required: false }
            ],
            description: '股票推荐的提示词模板，用于生成股票买入推荐'
        },

        // 组合优化
        {
            scene_type: 'portfolio_optimization',
            scene_name: '组合优化',
            category: 'optimization',
            system_prompt: '你是一位专业的投资组合管理顾问，擅长资产配置和组合优化。具有丰富的投资组合理论知识和实战经验。',
            user_prompt_template: `请作为专业的投资组合管理顾问，对以下投资组合进行全面的优化分析：

【资金情况】
{capital_info}

【持仓概况】
{portfolio_summary}

【行业分布】
{industry_distribution}

【详细持仓】
{positions}

请从以下几个维度进行深入的组合优化分析：

1. **资产配置分析**
   - 评估当前仓位水平是否合理
   - 根据资金规模给出合理的仓位建议
   - 分析可用资金的使用策略

2. **行业配置优化**
   - 评估行业分布的集中度和风险
   - 识别过度集中的行业（占比>30%需警惕）
   - 建议增加或减少的行业配置

3. **个股权重调整**
   - 分析单只股票占比是否合理
   - 识别权重过高的个股（建议单股不超过20%）
   - 给出具体的加仓或减仓建议

4. **风险收益平衡**
   - 评估当前组合的风险收益比
   - 分析盈亏分布的合理性
   - 建议止盈止损的具体操作

5. **组合再平衡方案**
   - 提供具体的调仓建议（哪些股票加仓、哪些减仓）
   - 给出新资金的配置方向
   - 建议调整的时机和节奏

6. **长期配置建议**
   - 核心持仓（长期持有）的选择
   - 卫星持仓（波段操作）的选择
   - 防御性资产的配置建议

请提供详细、具体、可执行的优化方案。注意：以上建议仅供参考，不构成具体投资建议。`,
            variables: [
                { name: '资金情况', key: 'capital_info', type: 'text', description: '总资金、持仓市值、仓位占比、可用资金等信息', required: true },
                { name: '持仓概况', key: 'portfolio_summary', type: 'text', description: '持仓股票数、总盈亏、盈利/亏损股票数等概况', required: true },
                { name: '行业分布', key: 'industry_distribution', type: 'text', description: '各行业持仓分布及占比', required: true },
                { name: '详细持仓', key: 'positions', type: 'text', description: '每只股票的详细持仓信息', required: true },
                { name: '日期', key: 'date', type: 'text', description: '当前日期', required: false }
            ],
            description: '投资组合优化的提示词模板，用于生成投资组合优化建议和再平衡方案'
        }
    ];
}

module.exports = { aiPromptTemplateModel };
