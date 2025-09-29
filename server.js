const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fileUpload = require('express-fileupload');
const XLSX = require('xlsx');
const iconv = require('iconv-lite');
const { initDatabase, userModel, positionModel, positionUpdateModel } = require('./database');

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

// 启动服务器
async function startServer() {
    try {
        // 初始化数据库
        await initDatabase();
        console.log('✅ 数据库初始化完成');
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 个人股票信息系统服务器已启动`);
            console.log(`📍 服务地址: http://localhost:${PORT}`);
            console.log(`🌐 网络访问: http://<服务器IP>:${PORT}`);
            console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}`);
            console.log(`💾 数据存储: SQLite数据库 (stock_manager.db)`);
        });
    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;