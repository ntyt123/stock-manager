# AI提示词管理说明

## 概述

股票管理系统现在支持在设置页面中管理和编辑所有AI提示词模板，包括新增的趋势分析功能。

## 如何访问AI提示词管理

1. 登录系统
2. 点击右上角的"⚙️ 设置"按钮
3. 在左侧导航栏中选择"🤖 AI提示词管理"
4. 查看所有可用的提示词模板

## 已配置的趋势分析提示词

### 1. 趋势分析（技术面）

**场景类型**: `trend_prediction`
**场景名称**: 趋势分析（技术面）
**类别**: 🔮 预测分析
**状态**: ✅ 已启用

**可用变量**:
- `{stock_code}` - 股票代码
- `{stock_name}` - 股票名称
- `{prediction_date}` - 预测日期
- `{trading_day_status}` - 交易日状态

**用途**: 在"分析"→"趋势分析"功能中使用，基于技术分析和市场环境对个股进行趋势预测。

### 2. 股票趋势预测（六壬）

**场景类型**: `stock_trend_prediction`
**场景名称**: 股票趋势预测（六壬）
**类别**: 🔮 预测分析
**状态**: ✅ 已启用

**可用变量**:
- `{stock_code}` - 股票代码
- `{stock_name}` - 股票名称
- `{prediction_time}` - 预测时间
- `{day_ganzhi}` - 日干支
- `{hour_ganzhi}` - 时干支
- `{month_jiang}` - 月将
- `{sike}` - 四课
- `{sanchuan}` - 三传
- `{twelve_gods}` - 十二神

**用途**: 在"预测"→"趋势预测"功能中使用，基于六壬排盘对个股进行趋势预测。

## 如何编辑提示词

### 方法1: 通过设置页面

1. 进入"设置"→"AI提示词管理"
2. 找到要编辑的提示词模板卡片
3. 点击"✏️ 编辑"按钮
4. 在弹出的编辑器中修改：
   - 系统提示词（System Prompt）
   - 用户提示词模板（User Prompt Template）
   - 描述
5. 点击"💾 保存修改"

### 方法2: 直接修改数据库

```javascript
// 示例：更新趋势分析的系统提示词
const {db} = require('./database/connection');

db.prepare(`
  UPDATE ai_prompt_templates
  SET system_prompt = ?
  WHERE scene_type = ?
`).run(
  '你的新系统提示词内容...',
  'trend_prediction'
);
```

### 方法3: 使用SQL脚本

编辑文件 `database/add-trend-prediction-prompt.sql`，然后运行：

```bash
node database/run-add-trend-prediction.js
```

## 提示词编辑最佳实践

### 1. 保持变量一致性

确保提示词模板中使用的变量名与代码中传递的变量名完全一致：

```javascript
// 后端代码中的变量
const variables = {
    stock_code: stockCode,
    stock_name: stockName,
    prediction_date: predictionDate,
    trading_day_status: isToday ? '当前交易日' : '下一个交易日'
};

// 提示词模板中使用
预测股票 **{stock_name}（{stock_code}）** 的{trading_day_status}走势
```

### 2. 使用Markdown格式

提示词模板支持Markdown格式，输出结果会被渲染为HTML：

```markdown
## 1. 技术面分析
- **趋势判断**：分析当前趋势
- **关键价位**：识别支撑位和压力位

## 2. 交易建议
- 操作策略：买入/持有/卖出
- 止损位设置
```

### 3. 提供清晰的分析框架

好的提示词应该包含：
- 明确的分析维度
- 具体的输出要求
- 风险提示
- 免责声明

### 4. 测试和验证

修改提示词后，建议：
1. 使用不同的股票代码测试
2. 验证变量替换是否正确
3. 检查AI输出的质量和格式
4. 调整提示词以获得最佳结果

## 变量说明

### 股票信息类
- `stock_code`: 6位股票代码（如：600036）
- `stock_name`: 股票中文名称（如：招商银行）

### 时间类
- `prediction_date`: 预测目标日期（YYYY-MM-DD格式）
- `prediction_time`: 六壬排盘时间
- `trading_day_status`: "当前交易日" 或 "下一个交易日"

### 六壬排盘类
- `day_ganzhi`: 日干支（如：甲子）
- `hour_ganzhi`: 时干支（如：丙寅）
- `month_jiang`: 月将信息
- `sike`: 四课信息（格式化为多行文本）
- `sanchuan`: 三传信息（初传、中传、末传）
- `twelve_gods`: 十二神信息（格式化为多行文本）

## 启用/禁用提示词

在AI提示词管理页面中，每个提示词卡片右上角都有状态标识：
- ✅ 已启用：提示词正常使用
- 🚫 已禁用：提示词不会被使用

点击"🚫 禁用"或"✅ 启用"按钮可以切换状态。

## 故障排除

### 问题1: 提示词不生效

**解决方案**:
1. 检查提示词是否已启用
2. 刷新浏览器缓存
3. 检查变量名是否正确
4. 查看浏览器控制台的错误信息

### 问题2: 变量未被替换

**解决方案**:
1. 确认变量名使用 `{variable_name}` 格式
2. 检查后端代码是否传递了该变量
3. 查看服务器日志中的提示词输出

### 问题3: AI输出格式混乱

**解决方案**:
1. 在提示词末尾明确要求使用Markdown格式
2. 提供清晰的输出结构示例
3. 调整系统提示词，强调格式要求

## 示例：自定义趋势分析提示词

```markdown
### 系统提示词
你是一位资深的A股分析师，擅长技术分析和趋势研判。请基于提供的股票信息，
给出专业、客观的分析，并使用Markdown格式输出。

### 用户提示词模板
请分析股票 **{stock_name}（{stock_code}）** 在 {prediction_date} 的走势。

## 分析要求

1. **技术形态**: 分析K线形态、均线系统
2. **量价关系**: 评估成交量变化
3. **支撑压力**: 标注关键价位
4. **操作建议**: 给出明确的买卖建议

请以专业、简洁的方式输出分析报告。
```

## 相关文件

- 前端管理器: `public/js/modules/ai-prompt-manager.js`
- 后端路由: `routes/ai-prompts.js`
- 数据库模型: `database/models/ai-prompt.js`
- SQL脚本: `database/add-trend-prediction-prompt.sql`

## 更多帮助

如有问题，请查看：
- 系统日志: 浏览器控制台
- 服务器日志: 终端输出
- API响应: 网络请求详情
