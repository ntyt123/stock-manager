# 更新日志

## [1.1.0] - 2025-01-10

### 修复
- **自选股行情加载问题** - 修复了部署到远程服务器后自选股行情一直显示"正在加载..."的问题

### 改进

#### 1. 添加请求超时处理
- 为所有自选股相关的API请求添加超时控制
- **获取自选股列表**: 10秒超时（`/api/watchlist`）
- **获取行情数据**: 15秒超时（`/api/stock/quotes`）
- 超时后显示友好的错误提示，而不是无限等待

#### 2. 改进空状态显示
- 当用户没有添加任何自选股时，显示友好的空状态界面
- 提供明确的引导信息，告诉用户如何添加自选股
- 区分"暂无自选股"和"加载失败"两种情况

#### 3. 增强错误处理和提示
- **前端**: 显示具体的错误原因（超时、网络错误等）
- **后端**: 详细记录错误类型、堆栈信息
- **用户提示**: 根据错误类型给出具体的解决建议

#### 4. 添加测试工具
- 新增 `test-api-connection.js` 脚本
- 快速测试服务器是否能访问新浪财经API
- 自动诊断网络问题（DNS、超时、连接失败等）

### 修改的文件

#### 前端
- `public/js/modules/watchlist-manager.js`
  - `loadWatchlist()` - 添加超时和空状态显示
  - `loadWatchlistQuotes()` - 添加请求超时和错误提示优化
  - `loadOverviewWatchlistQuotes()` - 添加请求超时和错误提示优化

#### 后端
- `routes/stock.js`
  - 增强 `/quotes` 接口的错误日志
  - 区分不同类型的错误（超时、DNS、连接失败等）
  - 返回更友好的错误消息

#### 文档和工具
- `test-api-connection.js` - 新增API连接测试工具
- `docs/DEPLOYMENT_TROUBLESHOOTING.md` - 新增详细的部署和故障排查指南
- `QUICK_FIX_GUIDE.md` - 新增快速修复指南

### 技术细节

#### 前端超时实现
```javascript
// 使用 AbortController 实现请求超时
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
    const response = await fetch('/api/watchlist', {
        signal: controller.signal
    });
    // ...
} catch (err) {
    if (err.name === 'AbortError') {
        throw new Error('获取数据超时（10秒），请检查网络连接');
    }
    throw err;
} finally {
    clearTimeout(timeoutId);
}
```

#### 空状态显示
```javascript
if (watchlist.length === 0) {
    container.innerHTML = `
        <div class="empty-state">
            <div style="font-size: 48px;">📈</div>
            <div style="font-size: 18px; color: #666;">暂无自选股</div>
            <div style="font-size: 14px; color: #999;">
                <p>您还没有添加任何自选股</p>
                <p>点击"市场动态"页签添加股票到自选股</p>
            </div>
        </div>
    `;
    return;
}
```

### 使用说明

#### 本地测试
```bash
# 测试API连接
node test-api-connection.js

# 启动服务器
npm start

# 访问应用
http://localhost:3000
```

#### 部署到远程服务器

1. **测试网络连接**:
   ```bash
   node test-api-connection.js
   ```

2. **如果测试失败**:
   - 查看 `docs/DEPLOYMENT_TROUBLESHOOTING.md` 获取详细解决方案
   - 根据错误类型采取对应措施

3. **部署代码**:
   ```bash
   git pull origin main
   npm start
   ```

### 已知问题

无

### 向后兼容性

- ✅ 完全向后兼容
- ✅ 不影响现有功能
- ✅ 只是增强错误处理和用户体验

### 性能影响

- ✅ 无性能影响
- ✅ 超时机制反而可以避免长时间等待

### 安全性

- ✅ 无安全风险
- ✅ 不涉及敏感信息

---

## [1.0.0] - 2025-01-09

### 功能
- 初始版本发布
- 支持股票持仓管理
- 支持自选股管理
- 支持行情数据查看
- 支持交易记录管理
