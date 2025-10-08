const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fileUpload = require('express-fileupload');
const XLSX = require('xlsx');
const iconv = require('iconv-lite');
const axios = require('axios');
const cron = require('node-cron');
const { initDatabase, userModel, positionModel, positionUpdateModel, watchlistModel, analysisReportModel } = require('./database');
const stockCache = require('./stockCache');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'stock-manager-secret-key';

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB文件大小限制
    createParentPath: true
}));

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 认证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '访问令牌缺失' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '令牌无效' });
        }
        req.user = user;
        next();
    });
};

// 检查管理员权限中间件
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
};

// 用户登录API
app.post('/api/auth/login', async (req, res) => {
    const { account, password } = req.body;

    if (!account || !password) {
        return res.status(400).json({ error: '账号和密码是必填的' });
    }

    try {
        // 从数据库查找用户
        const user = await userModel.findByAccount(account);
        if (!user) {
            return res.status(401).json({ error: '账号或密码错误' });
        }

        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: '账号或密码错误' });
        }

        // 更新最后登录时间
        await userModel.updateLastLogin(user.id);

        // 生成JWT令牌
        const token = jwt.sign(
            { id: user.id, account: user.account, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username,
                account: user.account,
                email: user.email,
                avatar: user.avatar,
                role: user.role
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        return res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

// 用户注册API
app.post('/api/auth/register', async (req, res) => {
    const { username, account, password, email } = req.body;

    if (!username || !account || !password || !email) {
        return res.status(400).json({ error: '所有字段都是必填的' });
    }

    try {
        // 检查账号是否已存在
        const existingAccount = await userModel.findByAccount(account);
        if (existingAccount) {
            return res.status(400).json({ error: '账号已存在' });
        }

        // 检查邮箱是否已存在
        const existingEmail = await userModel.findByEmail(email);
        if (existingEmail) {
            return res.status(400).json({ error: '邮箱已被使用' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = {
            username,
            account,
            password: hashedPassword,
            email,
            avatar: `/assets/avatars/user${Math.floor(Math.random() * 5) + 1}.png`,
            role: 'user',
            registerTime: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };

        // 保存到数据库
        const createdUser = await userModel.create(newUser);

        res.json({
            success: true,
            message: '注册成功',
            user: {
                id: createdUser.id,
                username: createdUser.username,
                account: createdUser.account,
                email: createdUser.email,
                avatar: createdUser.avatar,
                role: createdUser.role
            }
        });
    } catch (error) {
        console.error('注册错误:', error);
        return res.status(500).json({ error: '注册失败，请稍后重试' });
    }
});

// 获取当前用户信息API
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await userModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        res.json({
            id: user.id,
            username: user.username,
            account: user.account,
            email: user.email,
            avatar: user.avatar,
            role: user.role,
            registerTime: user.registerTime,
            lastLogin: user.lastLogin
        });
    } catch (error) {
        console.error('获取用户信息错误:', error);
        return res.status(500).json({ error: '获取用户信息失败' });
    }
});

// 管理员API - 获取所有用户信息
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await userModel.findAll();
        const userList = users.map(user => ({
            id: user.id,
            username: user.username,
            account: user.account,
            email: user.email,
            avatar: user.avatar,
            role: user.role,
            registerTime: user.registerTime,
            lastLogin: user.lastLogin
        }));

        res.json({
            success: true,
            users: userList,
            total: userList.length
        });
    } catch (error) {
        console.error('获取用户列表错误:', error);
        return res.status(500).json({ error: '获取用户列表失败' });
    }
});

// Excel文件上传API - 解析持仓数据Excel文件
app.post('/api/upload/positions', authenticateToken, async (req, res) => {
    try {
        // 检查是否有文件上传
        if (!req.files || !req.files.file) {
            return res.status(400).json({ 
                success: false, 
                error: '请选择要上传的Excel文件' 
            });
        }

        const file = req.files.file;
        
        // 检查文件类型
        if (!file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
            return res.status(400).json({ 
                success: false, 
                error: '请上传Excel文件(.xls或.xlsx格式)' 
            });
        }

        // 修复文件名中的中文字符乱码
        const fixedFileName = fixChineseCharacters(file.name);
        console.log('原始文件名:', file.name);
        console.log('修复后文件名:', fixedFileName);

        // 解析Excel文件
        const positions = await parseExcelFile(file.data);
        
        if (positions.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: '未在Excel文件中找到有效的持仓数据' 
            });
        }

        // 计算汇总信息
        const totalMarketValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
        const totalCost = positions.reduce((sum, pos) => sum + (pos.costPrice * pos.quantity), 0);
        const totalProfitLoss = positions.reduce((sum, pos) => sum + pos.profitLoss, 0);
        const totalProfitLossRate = totalCost > 0 ? (totalProfitLoss / totalCost * 100).toFixed(2) : 0;

        try {
            // 保存持仓数据到数据库
            const saveResult = await positionModel.saveOrUpdatePositions(req.user.id, positions);
            console.log(`✅ 持仓数据保存成功: ${saveResult.totalRecords}条记录`);
            
            // 记录更新日志
            await positionUpdateModel.recordUpdate(
                req.user.id,
                fixedFileName,
                'success',
                null,
                saveResult.totalRecords,
                saveResult.totalRecords
            );
            
            // 获取最新的更新时间
            const latestUpdate = await positionUpdateModel.getLatestUpdate(req.user.id);
            
            res.json({
                success: true,
                message: 'Excel文件解析成功，数据已保存到数据库',
                data: {
                    positions: positions,
                    summary: {
                        totalMarketValue: totalMarketValue,
                        totalProfitLoss: totalProfitLoss,
                        totalProfitLossRate: totalProfitLossRate,
                        positionCount: positions.length,
                        lastUpdate: latestUpdate ? latestUpdate.updateTime : new Date().toISOString(),
                        fileName: fixedFileName
                    }
                }
            });
            
        } catch (dbError) {
            console.error('❌ 数据库保存失败:', dbError);
            
            // 记录失败日志
            await positionUpdateModel.recordUpdate(
                req.user.id,
                fixedFileName,
                'failed',
                dbError.message,
                positions.length,
                0
            );
            
            // 即使数据库保存失败，也返回解析的数据，让用户知道文件解析是成功的
            res.json({
                success: true,
                message: 'Excel文件解析成功，但数据保存到数据库失败',
                warning: '数据仅显示在页面上，下次登录需要重新上传',
                data: {
                    positions: positions,
                    summary: {
                        totalMarketValue: totalMarketValue,
                        totalProfitLoss: totalProfitLoss,
                        totalProfitLossRate: totalProfitLossRate,
                        positionCount: positions.length,
                        lastUpdate: new Date().toISOString(),
                        fileName: fixedFileName
                    }
                }
            });
        }
        
    } catch (error) {
        console.error('Excel文件解析错误:', error);
        return res.status(500).json({ 
            success: false, 
            error: '文件解析失败，请检查文件格式是否正确' 
        });
    }
});

// 辅助函数：修复中文字符乱码
function fixChineseCharacters(text) {
    if (!text || typeof text !== 'string') return text;
    
    console.log('原始文本:', text);
    
    // 如果文本已经是正确的中文，直接返回
    if (/[\u4e00-\u9fa5]/.test(text) && !text.includes('�') && !text.includes('\ufffd')) {
        console.log('文本已经是正确的中文，无需处理');
        return text;
    }
    
    // 尝试多种编码转换
    const encodings = ['gbk', 'gb2312', 'gb18030', 'big5', 'utf8'];
    
    for (const encoding of encodings) {
        try {
            // 方法1：直接使用iconv进行编码转换
            const decodedText1 = iconv.decode(Buffer.from(text, 'binary'), encoding);
            console.log(`方法1 - 编码 ${encoding}: ${decodedText1}`);
            
            // 方法2：尝试将文本视为latin1编码，然后转换
            const decodedText2 = iconv.decode(Buffer.from(text, 'latin1'), encoding);
            console.log(`方法2 - 编码 ${encoding}: ${decodedText2}`);
            
            // 方法3：尝试将文本视为utf8编码，然后转换（针对双重编码情况）
            let decodedText3 = text;
            try {
                // 先尝试将乱码文本解码为Buffer，再重新编码
                const tempBuffer = iconv.encode(text, 'utf8');
                decodedText3 = iconv.decode(tempBuffer, encoding);
            } catch (e) {
                decodedText3 = text;
            }
            console.log(`方法3 - 编码 ${encoding}: ${decodedText3}`);
            
            // 检查哪个转换结果最可能是正确的中文
            const candidates = [decodedText1, decodedText2, decodedText3];
            for (const candidate of candidates) {
                // 检查转换结果是否包含中文字符且没有乱码
                if (/[\u4e00-\u9fa5]/.test(candidate) && 
                    !candidate.includes('�') && 
                    !candidate.includes('\ufffd') &&
                    candidate.length > 0 &&
                    candidate !== text) {
                    console.log(`✅ 使用编码 ${encoding} 成功转换: ${candidate}`);
                    return candidate;
                }
            }
        } catch (error) {
            console.log(`编码 ${encoding} 转换失败:`, error.message);
        }
    }
    
    // 如果所有编码转换都失败，尝试简单的字符清理
    console.log('所有编码转换失败，尝试字符清理');
    const cleanedText = text.replace(/[�\ufffd]/g, '').trim();
    if (cleanedText && cleanedText !== text) {
        console.log('清理后文本:', cleanedText);
        return cleanedText;
    }
    
    console.log('无法修复乱码，返回原始文本');
    return text;
}

// 辅助函数：解析Excel文件
async function parseExcelFile(fileBuffer) {
    try {
        console.log('开始解析Excel文件...');
        
        // 使用xlsx库解析Excel文件，针对.xls格式优化
        const workbook = XLSX.read(fileBuffer, {
            type: 'buffer',
            codepage: 936, // GBK编码，适用于中文.xls文件
            cellText: true,
            cellDates: true,
            raw: false, // 获取格式化后的文本
            WTF: true // 启用WTF模式，更好地处理中文编码
        });
        
        console.log('Excel文件读取成功，工作表数量:', workbook.SheetNames.length);
        
        // 获取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        console.log('工作表名称:', firstSheetName);
        
        // 将工作表转换为JSON格式
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            raw: false, // 获取格式化后的文本值
            defval: '' // 默认值为空字符串
        });
        
        console.log('Excel数据行数:', jsonData.length);
        console.log('前3行数据预览:', jsonData.slice(0, 3));
        
        // 查找数据开始行（跳过表头）
        let dataStartRow = 0;
        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (Array.isArray(row) && row.some(cell => 
                typeof cell === 'string' && (cell.includes('证券代码') || cell.includes('股票代码')))) {
                dataStartRow = i + 1; // 数据从下一行开始
                console.log('找到表头行:', i, '数据从第', dataStartRow, '行开始');
                break;
            }
        }
        
        // 如果没有找到表头，假设数据从第2行开始（跳过标题行）
        if (dataStartRow === 0) {
            dataStartRow = 1;
            console.log('未找到表头，数据从第1行开始');
        }
        
        const positions = [];
        let validCount = 0;
        
        // 解析持仓数据行
        for (let i = dataStartRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!Array.isArray(row) || row.length < 11) {
                console.log('跳过行', i, ': 不是数组或长度不足');
                continue;
            }
            
            console.log('解析第', i, '行:', row);
            
            // 根据实际Excel格式解析字段
            let stockCode, stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate;
            
            // 第2列：证券代码（需要去除公式符号）
            if (row[1] !== undefined && row[1] !== null && row[1] !== '') {
                stockCode = row[1].toString().replace(/[="\s]/g, '').trim();
                console.log('证券代码:', stockCode);
            }
            
            // 第3列：证券名称
            if (row[2] !== undefined && row[2] !== null && row[2] !== '') {
                stockName = fixChineseCharacters(row[2].toString().trim());
                console.log('证券名称:', stockName);
            }
            
            // 第4列：持仓数量
            quantity = parseFloat(row[3]) || 0;
            
            // 第6列：成本价
            costPrice = parseFloat(row[5]) || 0;
            
            // 第11列：当前价
            currentPrice = parseFloat(row[10]) || 0;
            
            // 第10列：参考市值
            marketValue = parseFloat(row[9]) || 0;
            
            // 第7列：实现盈亏
            profitLoss = parseFloat(row[6]) || 0;
            
            // 第8列：盈亏率
            profitLossRate = parseFloat(row[7]) || 0;
            
            console.log('解析结果:', { stockCode, stockName, quantity, costPrice, currentPrice, marketValue, profitLoss, profitLossRate });
            
            // 如果缺少当前价，使用成本价加盈亏计算
            let finalCurrentPrice = currentPrice;
            if (currentPrice === 0 && costPrice > 0 && quantity > 0) {
                finalCurrentPrice = costPrice + (profitLoss / quantity);
            }
            
            // 如果缺少市值，使用当前价和数量计算
            let finalMarketValue = marketValue;
            if (marketValue === 0 && finalCurrentPrice > 0 && quantity > 0) {
                finalMarketValue = finalCurrentPrice * quantity;
            }
            
            // 验证数据有效性
            if (stockCode && stockName && quantity > 0) {
                positions.push({
                    stockCode: stockCode,
                    stockName: stockName,
                    quantity: quantity,
                    costPrice: costPrice,
                    currentPrice: finalCurrentPrice > 0 ? finalCurrentPrice : costPrice,
                    marketValue: finalMarketValue > 0 ? finalMarketValue : (finalCurrentPrice * quantity),
                    profitLoss: profitLoss,
                    profitLossRate: profitLossRate
                });
                validCount++;
                console.log('成功解析第', validCount, '条数据');
            } else {
                console.log('数据验证失败，跳过该行');
            }
        }
        
        console.log('总共解析到', validCount, '条有效数据');
        
        // 如果没有解析到数据，返回空数组而不是模拟数据
        if (validCount === 0) {
            console.log('Excel文件解析成功但未找到有效数据，返回空数组');
            return [];
        }
        
        return positions;
        
    } catch (error) {
        console.error('Excel文件解析错误:', error);
        
        // 解析失败时返回空数组而不是模拟数据
        console.log('Excel文件解析失败，返回空数组');
        return [];
    }
}

// 辅助函数 - 根据股票代码获取股票名称
function getStockName(symbol) {
    const stockMap = {
        '600036': '招商银行',
        '000858': '五粮液',
        '601318': '中国平安',
        '600519': '贵州茅台',
        '000333': '美的集团',
        '000001': '平安银行',
        '600000': '浦发银行',
        '601398': '工商银行'
    };
    return stockMap[symbol] || '未知股票';
}

// 管理员API - 编辑用户信息
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { username, email, role } = req.body;

    if (!username || !email || !role) {
        return res.status(400).json({ error: '所有字段都是必填的' });
    }

    if (!['super_admin', 'admin', 'user'].includes(role)) {
        return res.status(400).json({ error: '无效的角色类型' });
    }

    try {
        const user = await userModel.findById(parseInt(id));
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 检查邮箱是否已被其他用户使用
        const existingUser = await userModel.findByEmail(email);
        if (existingUser && existingUser.id !== parseInt(id)) {
            return res.status(400).json({ error: '邮箱已被其他用户使用' });
        }

        // 不能修改自己的权限为普通用户
        if (user.id === req.user.id && role !== 'super_admin') {
            return res.status(400).json({ error: '不能修改自己的权限' });
        }

        // 更新用户信息
        await userModel.update(parseInt(id), { username, email, role });

        res.json({
            success: true,
            message: '用户信息更新成功',
            user: {
                id: user.id,
                username: username,
                account: user.account,
                email: email,
                role: role
            }
        });
    } catch (error) {
        console.error('编辑用户信息错误:', error);
        return res.status(500).json({ error: '编辑用户信息失败' });
    }
});

// 管理员API - 修改用户权限
app.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!['super_admin', 'admin', 'user'].includes(role)) {
        return res.status(400).json({ error: '无效的角色类型' });
    }

    try {
        const user = await userModel.findById(parseInt(id));
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 不能修改自己的权限
        if (user.id === req.user.id) {
            return res.status(400).json({ error: '不能修改自己的权限' });
        }

        // 更新用户权限
        await userModel.update(parseInt(id), { 
            username: user.username, 
            email: user.email, 
            role 
        });

        res.json({
            success: true,
            message: '用户权限更新成功',
            user: {
                id: user.id,
                username: user.username,
                account: user.account,
                role: role
            }
        });
    } catch (error) {
        console.error('修改用户权限错误:', error);
        return res.status(500).json({ error: '修改用户权限失败' });
    }
});

// 管理员API - 删除用户
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const user = await userModel.findById(parseInt(id));
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 不能删除自己
        if (user.id === req.user.id) {
            return res.status(400).json({ error: '不能删除自己的账户' });
        }

        // 不能删除超级管理员（除了自己）
        if (user.role === 'super_admin') {
            return res.status(400).json({ error: '不能删除超级管理员账户' });
        }

        // 从数据库删除用户
        await userModel.delete(parseInt(id));

        res.json({
            success: true,
            message: '用户删除成功'
        });
    } catch (error) {
        console.error('删除用户错误:', error);
        return res.status(500).json({ error: '删除用户失败' });
    }
});

// API路由示例
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: '个人股票信息系统运行正常',
        timestamp: new Date().toISOString()
    });
});

// 获取用户持仓数据
app.get('/api/positions', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 获取用户的持仓数据
        const positions = await positionModel.findByUserId(userId);
        
        // 获取最新的更新时间
        const latestUpdate = await positionUpdateModel.getLatestUpdate(userId);
        
        // 计算汇总信息
        const totalMarketValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
        const totalCost = positions.reduce((sum, pos) => sum + (pos.costPrice * pos.quantity), 0);
        const totalProfitLoss = positions.reduce((sum, pos) => sum + pos.profitLoss, 0);
        const totalProfitLossRate = totalCost > 0 ? (totalProfitLoss / totalCost * 100).toFixed(2) : 0;
        
        res.json({
            success: true,
            data: {
                positions: positions,
                summary: {
                    totalMarketValue: totalMarketValue,
                    totalProfitLoss: totalProfitLoss,
                    totalProfitLossRate: totalProfitLossRate,
                    positionCount: positions.length,
                    lastUpdate: latestUpdate ? latestUpdate.updateTime : null,
                    fileName: latestUpdate ? latestUpdate.fileName : null
                },
                updateHistory: latestUpdate ? {
                    status: latestUpdate.status,
                    totalRecords: latestUpdate.totalRecords,
                    successRecords: latestUpdate.successRecords,
                    errorMessage: latestUpdate.errorMessage
                } : null
            }
        });
        
    } catch (error) {
        console.error('获取持仓数据错误:', error);
        res.status(500).json({
            success: false,
            error: '获取持仓数据失败'
        });
    }
});

// 获取用户自选股列表
app.get('/api/watchlist', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 获取用户的自选股列表
        const watchlist = await watchlistModel.findByUserId(userId);
        
        res.json({
            success: true,
            data: watchlist
        });
        
    } catch (error) {
        console.error('获取自选股列表错误:', error);
        res.status(500).json({
            success: false,
            error: '获取自选股列表失败'
        });
    }
});

// 添加自选股（支持单个和批量）
app.post('/api/watchlist', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        console.log('📥 收到自选股添加请求');
        console.log('📦 请求体:', JSON.stringify(req.body, null, 2));

        const { stockCode, stockName, stocks } = req.body;

        console.log('🔍 解析结果:');
        console.log('  - stockCode:', stockCode);
        console.log('  - stockName:', stockName);
        console.log('  - stocks:', stocks);
        console.log('  - stocks是数组?', Array.isArray(stocks));

        // 批量添加
        if (stocks && Array.isArray(stocks)) {
            console.log('📊 批量添加自选股，数量:', stocks.length);
            console.log('📝 股票列表:', JSON.stringify(stocks, null, 2));

            let successCount = 0;
            let skipCount = 0;
            let errorCount = 0;
            const results = [];

            for (const stock of stocks) {
                try {
                    console.log('🔍 检查股票:', stock);

                    // 验证股票代码格式
                    if (!/^[0-9]{6}$/.test(stock.stockCode)) {
                        console.log(`❌ 股票代码格式错误: ${stock.stockCode} (类型: ${typeof stock.stockCode})`);
                        errorCount++;
                        results.push({
                            stockCode: stock.stockCode,
                            success: false,
                            error: `股票代码格式错误 (需要6位数字，收到: ${stock.stockCode})`
                        });
                        continue;
                    }

                    // 检查是否已存在
                    const exists = await watchlistModel.exists(userId, stock.stockCode);
                    console.log(`  检查 ${stock.stockCode} 是否存在: ${exists}`);

                    if (exists) {
                        skipCount++;
                        console.log(`  ⏭️ 跳过已存在的股票: ${stock.stockCode}`);
                        results.push({
                            stockCode: stock.stockCode,
                            success: false,
                            skipped: true,
                            error: '股票已在自选股列表中'
                        });
                        continue;
                    }

                    // 添加自选股
                    console.log(`  💾 添加自选股: ${stock.stockCode} ${stock.stockName}`);
                    await watchlistModel.add(userId, stock.stockCode, stock.stockName || '未知股票');
                    successCount++;
                    console.log(`  ✅ 成功添加: ${stock.stockCode}`);
                    results.push({
                        stockCode: stock.stockCode,
                        success: true
                    });

                } catch (err) {
                    errorCount++;
                    results.push({
                        stockCode: stock.stockCode,
                        success: false,
                        error: err.message
                    });
                }
            }

            const response = {
                success: true,
                message: `批量添加完成：成功 ${successCount} 个，跳过 ${skipCount} 个，失败 ${errorCount} 个`,
                data: {
                    successCount,
                    skipCount,
                    errorCount,
                    total: stocks.length,
                    results
                }
            };

            console.log('✅ 批量添加完成，返回结果:', JSON.stringify(response, null, 2));
            return res.json(response);
        }

        // 单个添加
        if (!stockCode) {
            return res.status(400).json({
                success: false,
                error: '股票代码是必填的'
            });
        }

        // 验证股票代码格式
        if (!/^[0-9]{6}$/.test(stockCode)) {
            return res.status(400).json({
                success: false,
                error: '请输入正确的6位股票代码'
            });
        }

        // 检查自选股是否已存在
        const exists = await watchlistModel.exists(userId, stockCode);
        if (exists) {
            return res.status(400).json({
                success: false,
                error: '该股票已在自选股列表中'
            });
        }

        // 添加自选股
        const result = await watchlistModel.add(userId, stockCode, stockName || '未知股票');

        res.json({
            success: true,
            message: '添加自选股成功',
            data: {
                id: result.id,
                stockCode,
                stockName: stockName || '未知股票'
            }
        });

    } catch (error) {
        console.error('添加自选股错误:', error);
        res.status(500).json({
            success: false,
            error: '添加自选股失败'
        });
    }
});

// 删除自选股
app.delete('/api/watchlist/:stockCode', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { stockCode } = req.params;
        
        if (!stockCode) {
            return res.status(400).json({
                success: false,
                error: '股票代码是必填的'
            });
        }
        
        // 删除自选股
        const result = await watchlistModel.remove(userId, stockCode);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                error: '自选股不存在'
            });
        }
        
        res.json({
            success: true,
            message: '删除自选股成功',
            data: {
                deletedCount: result.changes
            }
        });
        
    } catch (error) {
        console.error('删除自选股错误:', error);
        res.status(500).json({
            success: false,
            error: '删除自选股失败'
        });
    }
});

// 获取股票实时行情
app.get('/api/stock/quote/:stockCode', async (req, res) => {
    try {
        const { stockCode } = req.params;

        // 检查缓存
        const cached = stockCache.getQuote(stockCode);
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                cached: true
            });
        }

        // 判断股票市场（沪市或深市）
        // 000001是上证指数, 399开头是深市指数, 6开头是沪市股票, 其他是深市股票
        let market;
        if (stockCode === '000001') {
            market = 'sh';  // 上证指数
        } else if (stockCode.startsWith('6')) {
            market = 'sh';  // 沪市股票
        } else {
            market = 'sz';  // 深市股票和指数
        }
        const fullCode = `${market}${stockCode}`;

        // 使用新浪财经API获取实时行情
        const sinaUrl = `https://hq.sinajs.cn/list=${fullCode}`;
        const response = await axios.get(sinaUrl, {
            headers: {
                'Referer': 'https://finance.sina.com.cn'
            },
            timeout: 5000,
            responseType: 'arraybuffer'
        });

        // 将GBK编码转换为UTF-8
        const data = iconv.decode(Buffer.from(response.data), 'gbk');

        // 解析返回的数据
        const match = data.match(/="(.+)"/);
        if (!match || !match[1]) {
            return res.status(404).json({
                success: false,
                error: '未找到该股票数据'
            });
        }

        const values = match[1].split(',');

        if (values.length < 32) {
            return res.status(404).json({
                success: false,
                error: '股票数据格式错误'
            });
        }

        // 解析股票数据
        const stockData = {
            stockCode: stockCode,
            stockName: values[0],
            todayOpen: parseFloat(values[1]),
            yesterdayClose: parseFloat(values[2]),
            currentPrice: parseFloat(values[3]),
            todayHigh: parseFloat(values[4]),
            todayLow: parseFloat(values[5]),
            buyPrice: parseFloat(values[6]),
            sellPrice: parseFloat(values[7]),
            volume: parseInt(values[8]),
            amount: parseFloat(values[9]),
            change: parseFloat(values[3]) - parseFloat(values[2]),
            changePercent: ((parseFloat(values[3]) - parseFloat(values[2])) / parseFloat(values[2]) * 100).toFixed(2),
            date: values[30],
            time: values[31]
        };

        // 缓存数据
        stockCache.setQuote(stockCode, stockData);

        res.json({
            success: true,
            data: stockData,
            cached: false
        });

    } catch (error) {
        console.error('获取股票行情错误:', error.message);
        res.status(500).json({
            success: false,
            error: '获取股票行情失败: ' + error.message
        });
    }
});

// 获取股票历史数据（用于绘制图表）
app.get('/api/stock/history/:stockCode', async (req, res) => {
    try {
        const { stockCode } = req.params;
        const { days = 30 } = req.query;

        // 检查缓存
        const cached = stockCache.getHistory(stockCode, days);
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                cached: true
            });
        }

        // 判断股票市场
        const market = stockCode.startsWith('6') ? 'sh' : 'sz';
        const fullCode = `${market}${stockCode}`;

        // 使用腾讯财经API获取历史数据
        const tencentUrl = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${fullCode},day,,,${days},qfq`;

        const response = await axios.get(tencentUrl, {
            headers: {
                'Referer': 'https://gu.qq.com'
            },
            timeout: 10000
        });

        if (response.data.code !== 0 || !response.data.data || !response.data.data[fullCode]) {
            return res.status(404).json({
                success: false,
                error: '未找到历史数据'
            });
        }

        const historyData = response.data.data[fullCode];
        // 股票使用qfqday（前复权），指数使用day
        const qfqday = historyData.qfqday || historyData.day || [];

        console.log(`📊 股票/指数 ${stockCode} 请求 ${days} 天，实际返回 ${qfqday.length} 条数据`);

        // 格式化历史数据
        const formattedData = qfqday.map(item => ({
            date: item[0],
            open: parseFloat(item[1]),
            close: parseFloat(item[2]),
            high: parseFloat(item[3]),
            low: parseFloat(item[4]),
            volume: parseInt(item[5])
        }));

        const result = {
            stockCode: stockCode,
            stockName: historyData.qt ? historyData.qt[fullCode][1] : '',
            history: formattedData
        };

        // 缓存数据
        stockCache.setHistory(stockCode, days, result);

        res.json({
            success: true,
            data: result,
            cached: false
        });

    } catch (error) {
        console.error('获取股票历史数据错误:', error.message);
        res.status(500).json({
            success: false,
            error: '获取股票历史数据失败: ' + error.message
        });
    }
});

// 批量获取股票行情
app.post('/api/stock/quotes', async (req, res) => {
    try {
        const { stockCodes } = req.body;

        if (!stockCodes || !Array.isArray(stockCodes) || stockCodes.length === 0) {
            return res.status(400).json({
                success: false,
                error: '请提供股票代码列表'
            });
        }

        // 检查缓存，分离缓存命中和未命中的股票
        const cacheResult = stockCache.getQuotes(stockCodes);
        const quotes = cacheResult.cached.map(item => item.data);
        const missingCodes = cacheResult.missing;

        console.log(`📊 批量行情请求: 总数 ${stockCodes.length}, 缓存命中 ${cacheResult.cached.length}, 需要获取 ${missingCodes.length}`);

        // 如果所有数据都在缓存中，直接返回
        if (missingCodes.length === 0) {
            return res.json({
                success: true,
                data: quotes,
                cached: true,
                cacheHitRate: '100%'
            });
        }

        // 构建需要获取的股票代码列表
        const fullCodes = missingCodes.map(code => {
            // 判断股票市场（沪市或深市）
            // 000001是上证指数, 399开头是深市指数, 6开头是沪市股票, 其他是深市股票
            let market;
            if (code === '000001') {
                market = 'sh';  // 上证指数
            } else if (code.startsWith('6')) {
                market = 'sh';  // 沪市股票
            } else {
                market = 'sz';  // 深市股票和指数
            }
            return `${market}${code}`;
        }).join(',');

        // 使用新浪财经API批量获取行情
        const sinaUrl = `https://hq.sinajs.cn/list=${fullCodes}`;
        const response = await axios.get(sinaUrl, {
            headers: {
                'Referer': 'https://finance.sina.com.cn'
            },
            timeout: 10000,
            responseType: 'arraybuffer'
        });

        // 将GBK编码转换为UTF-8
        const data = iconv.decode(Buffer.from(response.data), 'gbk');
        const lines = data.split('\n').filter(line => line.trim());

        const newQuotes = [];

        for (let i = 0; i < missingCodes.length; i++) {
            const line = lines[i];
            if (!line) continue;

            const match = line.match(/="(.+)"/);
            if (!match || !match[1]) continue;

            const values = match[1].split(',');
            if (values.length < 32) continue;

            const quote = {
                stockCode: missingCodes[i],
                stockName: values[0],
                currentPrice: parseFloat(values[3]),
                yesterdayClose: parseFloat(values[2]),
                change: parseFloat(values[3]) - parseFloat(values[2]),
                changePercent: ((parseFloat(values[3]) - parseFloat(values[2])) / parseFloat(values[2]) * 100).toFixed(2),
                todayOpen: parseFloat(values[1]),
                todayHigh: parseFloat(values[4]),
                todayLow: parseFloat(values[5]),
                volume: parseInt(values[8]),
                amount: parseFloat(values[9]),
                date: values[30],
                time: values[31]
            };

            newQuotes.push(quote);
        }

        // 缓存新获取的数据
        stockCache.setQuotes(newQuotes);

        // 合并缓存数据和新数据
        const allQuotes = [...quotes, ...newQuotes];

        // 按原始顺序排序
        const sortedQuotes = stockCodes.map(code =>
            allQuotes.find(q => q.stockCode === code)
        ).filter(q => q !== undefined);

        const cacheHitRate = ((cacheResult.cached.length / stockCodes.length) * 100).toFixed(1);

        res.json({
            success: true,
            data: sortedQuotes,
            cached: false,
            cacheHitRate: `${cacheHitRate}%`,
            stats: {
                total: stockCodes.length,
                fromCache: cacheResult.cached.length,
                fromAPI: newQuotes.length
            }
        });

    } catch (error) {
        console.error('批量获取股票行情错误:', error.message);
        res.status(500).json({
            success: false,
            error: '批量获取股票行情失败: ' + error.message
        });
    }
});

// 获取缓存统计信息
app.get('/api/cache/stats', (req, res) => {
    const stats = stockCache.getStats();
    res.json({
        success: true,
        data: {
            ...stats,
            message: stats.isTradeTime ?
                '当前为交易时间，缓存有效期30秒' :
                '当前为非交易时间，缓存到下一个交易时段'
        }
    });
});

// 清空所有缓存
app.post('/api/cache/clear', authenticateToken, requireAdmin, (req, res) => {
    stockCache.clearAll();
    res.json({
        success: true,
        message: '缓存已清空'
    });
});

// 清空用户持仓数据
app.delete('/api/positions', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // 删除用户的所有持仓数据
        const result = await positionModel.deleteByUserId(userId);

        // 记录清空操作
        await positionUpdateModel.recordUpdate(
            userId,
            '手动清空',
            'cleared',
            null,
            0,
            0
        );

        res.json({
            success: true,
            message: '持仓数据已清空',
            deletedCount: result.changes
        });

    } catch (error) {
        console.error('清空持仓数据错误:', error);
        res.status(500).json({
            success: false,
            error: '清空持仓数据失败'
        });
    }
});

// 获取A股热点新闻
app.get('/api/news/hot', async (req, res) => {
    try {
        const { category = 'latest' } = req.query;

        console.log(`📰 获取新闻请求: category=${category}`);

        // 新浪财经API的lid分类映射
        const categoryMap = {
            'latest': '2516',      // 财经
            'stock': '2517',       // 股市
            'tech': '2515',        // 科技
            'policy': '2516',      // 财经（政策类也使用财经）
            'international': '2511' // 国际
        };

        const lid = categoryMap[category] || '2516'; // 默认财经

        try {
            const sinaUrl = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=${lid}&k=&num=20&page=1`;
            const sinaResponse = await axios.get(sinaUrl, {
                headers: {
                    'Referer': 'https://finance.sina.com.cn/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 5000
            });

            if (sinaResponse.data && sinaResponse.data.result && sinaResponse.data.result.data) {
                console.log(`✅ 新浪财经API获取成功 (category: ${category}, lid: ${lid})`);
                const newsList = sinaResponse.data.result.data.slice(0, 10).map(item => ({
                    title: item.title,
                    source: '新浪财经',
                    time: formatNewsTime(item.ctime),
                    url: item.url || '#'
                }));

                res.json({
                    success: true,
                    data: newsList,
                    source: 'sina',
                    category: category
                });
            } else {
                console.log(`❌ 新浪API返回数据为空 (category: ${category})`);
                res.json({
                    success: true,
                    data: [],
                    source: 'none',
                    category: category
                });
            }
        } catch (sinaError) {
            console.log(`❌ 新浪财经API失败 (category: ${category}):`, sinaError.message);
            res.json({
                success: true,
                data: [],
                source: 'error',
                category: category,
                error: sinaError.message
            });
        }

    } catch (error) {
        console.error('❌ 获取新闻严重错误:', error.message);
        res.json({
            success: true,
            data: [],
            source: 'error',
            category: category,
            error: error.message
        });
    }
});

// 获取持仓股票相关新闻
app.get('/api/news/positions', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        console.log(`📰 获取持仓股票新闻: userId=${userId}`);

        // 获取用户持仓
        const positions = await positionModel.findByUserId(userId);

        if (!positions || positions.length === 0) {
            console.log('⚠️ 用户没有持仓数据');
            return res.json({
                success: true,
                data: [],
                source: 'none',
                message: '暂无持仓数据'
            });
        }

        console.log(`📊 找到 ${positions.length} 个持仓股票`);

        // 收集所有股票新闻
        const allNews = [];
        const oneMonthAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60); // 30天前的时间戳

        // 为每个持仓股票获取新闻
        for (const position of positions) {
            try {
                const keyword = position.stockName; // 使用股票名称搜索
                const sinaUrl = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=${encodeURIComponent(keyword)}&num=20&page=1`;

                console.log(`🔍 搜索 ${position.stockCode} ${keyword} 的新闻`);

                const response = await axios.get(sinaUrl, {
                    headers: {
                        'Referer': 'https://finance.sina.com.cn/',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 5000
                });

                if (response.data && response.data.result && response.data.result.data) {
                    let newsItems = response.data.result.data
                        .filter(item => {
                            // 只过滤最近一个月的新闻
                            const newsTime = parseInt(item.ctime);
                            return newsTime >= oneMonthAgo;
                        })
                        .map(item => ({
                            title: item.title,
                            source: '新浪财经',
                            time: formatNewsTime(item.ctime),
                            url: item.url || '#',
                            stockCode: position.stockCode,
                            stockName: position.stockName,
                            timestamp: parseInt(item.ctime) // 用于排序
                        }));

                    // 每个股票最多取5条新闻
                    newsItems = newsItems.slice(0, 5);

                    allNews.push(...newsItems);
                    console.log(`  ✅ 找到 ${newsItems.length} 条相关新闻`);
                }
            } catch (error) {
                console.log(`  ❌ 获取 ${position.stockName} 新闻失败:`, error.message);
            }
        }

        // 去重（根据URL）
        const uniqueNews = Array.from(
            new Map(allNews.map(item => [item.url, item])).values()
        );

        // 按时间倒序排序
        uniqueNews.sort((a, b) => b.timestamp - a.timestamp);

        // 返回所有去重后的新闻（每个股票最多5条，总数不超过 stocks * 5）
        const finalNews = uniqueNews;

        console.log(`📰 总计: ${allNews.length} 条新闻, 去重后: ${uniqueNews.length} 条, 返回: ${finalNews.length} 条`);

        res.json({
            success: true,
            data: finalNews,
            source: 'sina',
            stats: {
                total: allNews.length,
                unique: uniqueNews.length,
                returned: finalNews.length,
                positions: positions.length
            }
        });

    } catch (error) {
        console.error('❌ 获取持仓新闻错误:', error.message);
        res.json({
            success: true,
            data: [],
            source: 'error',
            error: error.message
        });
    }
});

// 格式化新闻时间
function formatNewsTime(datetime) {
    if (!datetime) return '刚刚';

    try {
        // 如果是Unix时间戳(秒),转换为毫秒
        let newsTime;
        if (typeof datetime === 'number' || (typeof datetime === 'string' && /^\d+$/.test(datetime))) {
            newsTime = new Date(parseInt(datetime) * 1000);
        } else {
            newsTime = new Date(datetime);
        }

        const now = new Date();
        const diff = Math.floor((now - newsTime) / 1000); // 秒

        if (diff < 60) return '刚刚';
        if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;

        return newsTime.toLocaleDateString('zh-CN');
    } catch (e) {
        return '刚刚';
    }
}

// DeepSeek AI API路由
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
    const { message } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({
            success: false,
            error: '消息内容不能为空'
        });
    }

    try {
        console.log('📤 发送AI请求到DeepSeek:', message.substring(0, 50) + '...');

        const response = await axios.post('https://api.deepseek.com/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: '你是一位专业的股票投资顾问助手。你需要为用户提供专业的投资建议、市场分析和风险提示。请用简洁、专业的语言回答用户的问题。注意：你的建议仅供参考，不构成具体的投资建议。'
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            stream: false,
            temperature: 0.7,
            max_tokens: 2000
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer sk-4196cd3ad726465581d70a9791fcbb23'
            },
            timeout: 30000 // 30秒超时
        });

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const aiResponse = response.data.choices[0].message.content;
            console.log('✅ DeepSeek AI响应成功');

            res.json({
                success: true,
                data: {
                    message: aiResponse,
                    model: 'deepseek-chat',
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            throw new Error('AI响应格式异常');
        }

    } catch (error) {
        console.error('❌ DeepSeek API错误:', error.message);

        let errorMessage = '抱歉，AI服务暂时不可用，请稍后重试。';

        if (error.response) {
            // API返回了错误响应
            console.error('API错误响应:', error.response.data);
            if (error.response.status === 401) {
                errorMessage = 'API密钥验证失败';
            } else if (error.response.status === 429) {
                errorMessage = 'API请求频率超限，请稍后重试';
            } else if (error.response.status === 500) {
                errorMessage = 'AI服务器错误，请稍后重试';
            }
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = '请求超时，请检查网络连接';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = '无法连接到AI服务，请检查网络';
        }

        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

// 持仓分析API - 调用DeepSeek分析持仓
app.post('/api/analysis/portfolio', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        console.log(`📊 开始分析用户 ${userId} 的持仓...`);

        // 1. 获取用户持仓数据
        const positions = await positionModel.findByUserId(userId);

        if (!positions || positions.length === 0) {
            return res.json({
                success: false,
                error: '暂无持仓数据，请先导入持仓信息'
            });
        }

        // 2. 构建详细的持仓数据摘要
        const portfolioSummary = buildPortfolioSummary(positions);

        // 3. 调用DeepSeek AI进行分析
        const analysisPrompt = `请作为专业的股票投资顾问，对以下持仓进行全面深入的分析：

【持仓概况】
- 总持仓股票：${portfolioSummary.totalStocks} 只
- 总市值：¥${portfolioSummary.totalMarketValue.toFixed(2)}
- 总盈亏：¥${portfolioSummary.totalProfitLoss.toFixed(2)} (${portfolioSummary.totalProfitLossRate}%)
- 盈利股票：${portfolioSummary.profitableStocks} 只
- 亏损股票：${portfolioSummary.lossStocks} 只

【详细持仓】
${portfolioSummary.detailedPositions}

请从以下几个方面进行详细分析：

1. **整体持仓评估**
   - 分析当前持仓结构的合理性
   - 评估整体风险水平（高/中/低）
   - 判断持仓集中度是否合理

2. **个股分析**
   - 分析表现最好和最差的股票
   - 指出哪些股票值得继续持有
   - 指出哪些股票需要警惕或减仓

3. **风险提示**
   - 识别当前持仓的主要风险点
   - 提出具体的风险控制建议
   - 建议设置止损位

4. **操作建议**
   - 短期（1-2周）操作建议
   - 中期（1-3个月）操作建议
   - 仓位调整建议

5. **市场环境**
   - 结合当前A股市场环境
   - 分析对持仓的影响
   - 提出应对策略

请提供详细、专业、可执行的分析建议。注意：以上建议仅供参考，不构成具体投资建议。`;

        const aiResponse = await callDeepSeekAPI(analysisPrompt);

        console.log('✅ 持仓分析完成');

        // 4. 保存分析报告到数据库
        const savedReport = await analysisReportModel.save(userId, aiResponse, portfolioSummary, 'manual');
        console.log(`📄 分析报告已保存，ID: ${savedReport.id}`);

        // 5. 返回分析结果
        res.json({
            success: true,
            data: {
                reportId: savedReport.id,
                analysis: aiResponse,
                portfolioSummary: portfolioSummary,
                timestamp: savedReport.created_at,
                positions: positions
            }
        });

    } catch (error) {
        console.error('❌ 持仓分析错误:', error.message);
        res.status(500).json({
            success: false,
            error: '持仓分析失败: ' + error.message
        });
    }
});

// 获取分析报告列表API
app.get('/api/analysis/reports', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 30;
    const offset = parseInt(req.query.offset) || 0;

    try {
        const reports = await analysisReportModel.findByUserId(userId, limit, offset);
        const totalCount = await analysisReportModel.getCount(userId);

        res.json({
            success: true,
            data: {
                reports: reports,
                totalCount: totalCount,
                hasMore: offset + reports.length < totalCount
            }
        });
    } catch (error) {
        console.error('❌ 获取报告列表错误:', error.message);
        res.status(500).json({
            success: false,
            error: '获取报告列表失败'
        });
    }
});

// 获取单个分析报告详情API
app.get('/api/analysis/reports/:reportId', authenticateToken, async (req, res) => {
    const reportId = parseInt(req.params.reportId);
    const userId = req.user.id;

    try {
        const report = await analysisReportModel.findById(reportId);

        if (!report) {
            return res.status(404).json({
                success: false,
                error: '报告不存在'
            });
        }

        // 验证报告所有权
        if (report.user_id !== userId) {
            return res.status(403).json({
                success: false,
                error: '无权访问此报告'
            });
        }

        res.json({
            success: true,
            data: {
                reportId: report.id,
                analysis: report.analysis_content,
                portfolioSummary: report.portfolio_summary,
                reportType: report.report_type,
                timestamp: report.created_at
            }
        });
    } catch (error) {
        console.error('❌ 获取报告详情错误:', error.message);
        res.status(500).json({
            success: false,
            error: '获取报告详情失败'
        });
    }
});

// 构建持仓摘要
function buildPortfolioSummary(positions) {
    let totalMarketValue = 0;
    let totalProfitLoss = 0;
    let totalCost = 0;
    let profitableStocks = 0;
    let lossStocks = 0;

    let detailedPositions = '';

    positions.forEach((pos, index) => {
        const marketValue = parseFloat(pos.marketValue) || 0;
        const profitLoss = parseFloat(pos.profitLoss) || 0;
        const profitLossRate = parseFloat(pos.profitLossRate) || 0;
        const costPrice = parseFloat(pos.costPrice) || 0;
        const currentPrice = parseFloat(pos.currentPrice) || 0;

        totalMarketValue += marketValue;
        totalProfitLoss += profitLoss;
        totalCost += costPrice * pos.quantity;

        if (profitLoss > 0) profitableStocks++;
        if (profitLoss < 0) lossStocks++;

        detailedPositions += `${index + 1}. ${pos.stockName} (${pos.stockCode})
   持仓: ${pos.quantity}股 | 成本价: ¥${costPrice.toFixed(2)} | 现价: ¥${currentPrice.toFixed(2)}
   市值: ¥${marketValue.toFixed(2)} | 盈亏: ${profitLoss >= 0 ? '+' : ''}¥${profitLoss.toFixed(2)} (${profitLoss >= 0 ? '+' : ''}${profitLossRate.toFixed(2)}%)

`;
    });

    const totalProfitLossRate = totalCost > 0 ? ((totalProfitLoss / totalCost) * 100).toFixed(2) : '0.00';

    return {
        totalStocks: positions.length,
        totalMarketValue,
        totalProfitLoss,
        totalProfitLossRate,
        profitableStocks,
        lossStocks,
        detailedPositions: detailedPositions.trim()
    };
}

// 调用DeepSeek API的通用函数
async function callDeepSeekAPI(userMessage, systemMessage = '你是一位专业的股票投资顾问助手。') {
    try {
        const response = await axios.post('https://api.deepseek.com/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: systemMessage
                },
                {
                    role: 'user',
                    content: userMessage
                }
            ],
            stream: false,
            temperature: 0.7,
            max_tokens: 3000
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer sk-4196cd3ad726465581d70a9791fcbb23'
            },
            timeout: 120000,  // 增加到120秒（2分钟）
            httpsAgent: new (require('https').Agent)({
                keepAlive: true,
                timeout: 120000
            })
        });

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return response.data.choices[0].message.content;
        } else {
            throw new Error('AI响应格式异常');
        }
    } catch (error) {
        if (error.code === 'ECONNABORTED' || error.message === 'aborted') {
            console.error('DeepSeek API请求超时，建议检查网络连接或增加超时时间');
            throw new Error('AI服务请求超时，请稍后重试');
        } else if (error.response) {
            console.error('DeepSeek API返回错误:', error.response.status, error.response.data);
            throw new Error(`AI服务错误: ${error.response.status}`);
        } else {
            console.error('DeepSeek API调用失败:', error.message);
            throw new Error('AI服务暂时不可用，请稍后重试');
        }
    }
}

// 定时任务：每天下午5点自动分析所有用户的持仓
// cron表达式：0 17 * * * 表示每天17:00执行
cron.schedule('0 17 * * *', async () => {
    console.log('⏰ 定时任务触发：开始自动分析所有用户持仓...');

    try {
        // 获取所有用户
        const users = await userModel.getAllUsers();

        for (const user of users) {
            try {
                // 获取用户持仓
                const positions = await positionModel.findByUserId(user.id);

                if (positions && positions.length > 0) {
                    console.log(`📊 正在分析用户 ${user.username} (ID: ${user.id}) 的持仓...`);

                    // 构建持仓摘要
                    const portfolioSummary = buildPortfolioSummary(positions);

                    // 调用AI分析
                    const analysisPrompt = `请对以下持仓进行每日例行分析：

【持仓概况】
- 持仓股票：${portfolioSummary.totalStocks} 只
- 总市值：¥${portfolioSummary.totalMarketValue.toFixed(2)}
- 总盈亏：¥${portfolioSummary.totalProfitLoss.toFixed(2)} (${portfolioSummary.totalProfitLossRate}%)

【详细持仓】
${portfolioSummary.detailedPositions}

请提供：
1. 今日持仓表现评估
2. 明日需要关注的股票
3. 风险提示
4. 操作建议

请简明扼要，突出重点。`;

                    const analysis = await callDeepSeekAPI(analysisPrompt);

                    // 保存分析结果到数据库
                    const savedReport = await analysisReportModel.save(user.id, analysis, portfolioSummary, 'scheduled');
                    console.log(`✅ 用户 ${user.username} 的持仓分析完成，报告ID: ${savedReport.id}`);

                } else {
                    console.log(`ℹ️ 用户 ${user.username} 暂无持仓数据`);
                }

            } catch (error) {
                console.error(`❌ 分析用户 ${user.username} 的持仓时出错:`, error.message);
            }
        }

        console.log('✅ 所有用户持仓分析完成');

    } catch (error) {
        console.error('❌ 定时任务执行失败:', error.message);
    }
}, {
    timezone: 'Asia/Shanghai'
});

console.log('⏰ 定时任务已启动：每天17:00自动分析持仓');

// 检查端口是否可用
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = require('net').createServer();

        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            } else {
                resolve(false);
            }
        });

        server.once('listening', () => {
            server.close();
            resolve(true);
        });

        server.listen(port, '0.0.0.0');
    });
}

// 查找可用端口
async function findAvailablePort(startPort, maxAttempts = 10) {
    let port = startPort;

    for (let i = 0; i < maxAttempts; i++) {
        const available = await isPortAvailable(port);
        if (available) {
            return port;
        }
        console.log(`⚠️ 端口 ${port} 已被占用，尝试下一个端口...`);
        port++;
    }

    throw new Error(`无法找到可用端口（尝试了端口 ${startPort}-${startPort + maxAttempts - 1}）`);
}

// 启动服务器
async function startServer() {
    try {
        // 初始化数据库
        await initDatabase();
        console.log('✅ 数据库初始化完成');

        // 查找可用端口
        const availablePort = await findAvailablePort(PORT);

        if (availablePort !== PORT) {
            console.log(`ℹ️ 默认端口 ${PORT} 被占用，使用端口 ${availablePort}`);
        }

        app.listen(availablePort, '0.0.0.0', () => {
            console.log(`🚀 个人股票信息系统服务器已启动`);
            console.log(`📍 服务地址: http://localhost:${availablePort}`);
            console.log(`🌐 网络访问: http://<服务器IP>:${availablePort}`);
            console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}`);
            console.log(`💾 数据存储: SQLite数据库 (stock_manager.db)`);

            if (availablePort !== PORT) {
                console.log(`⚠️ 注意: 服务运行在端口 ${availablePort}（而非默认端口 ${PORT}）`);
            }
        });
    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;