const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { userModel } = require('../database');

module.exports = (JWT_SECRET) => {
    const router = express.Router();

    // 检查管理员权限中间件
    const requireAdmin = (req, res, next) => {
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ error: '需要管理员权限' });
        }
        next();
    };

    // 认证中间件（用于需要登录但不需要管理员权限的路由）
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

    // 用户登录API
    router.post('/login', async (req, res) => {
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
    router.post('/register', async (req, res) => {
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
    router.get('/me', authenticateToken, async (req, res) => {
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
                total_capital: user.total_capital || 0,
                registerTime: user.registerTime,
                lastLogin: user.lastLogin
            });
        } catch (error) {
            console.error('获取用户信息错误:', error);
            return res.status(500).json({ error: '获取用户信息失败' });
        }
    });

    // 获取用户总资金API
    router.get('/capital', authenticateToken, async (req, res) => {
        try {
            const user = await userModel.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: '用户不存在' });
            }

            res.json({
                success: true,
                total_capital: user.total_capital || 0
            });
        } catch (error) {
            console.error('获取总资金错误:', error);
            return res.status(500).json({ error: '获取总资金失败' });
        }
    });

    // 更新用户总资金API
    router.put('/capital', authenticateToken, async (req, res) => {
        const { total_capital } = req.body;

        if (total_capital === undefined || total_capital === null) {
            return res.status(400).json({ error: '总资金是必填的' });
        }

        if (isNaN(total_capital) || total_capital < 0) {
            return res.status(400).json({ error: '总资金必须是非负数' });
        }

        try {
            await userModel.updateTotalCapital(req.user.id, parseFloat(total_capital));

            res.json({
                success: true,
                message: '总资金更新成功',
                total_capital: parseFloat(total_capital)
            });
        } catch (error) {
            console.error('更新总资金错误:', error);
            return res.status(500).json({ error: '更新总资金失败' });
        }
    });

    // 修改密码API
    router.put('/change-password', authenticateToken, async (req, res) => {
        console.log('📝 收到修改密码请求, 用户ID:', req.user.id);
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            console.log('❌ 参数缺失: oldPassword=', !!oldPassword, 'newPassword=', !!newPassword);
            return res.status(400).json({ error: '旧密码和新密码都是必填的' });
        }

        if (!newPassword.trim()) {
            return res.status(400).json({ error: '新密码不能为空' });
        }

        try {
            // 获取当前用户信息
            const user = await userModel.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: '用户不存在' });
            }

            // 验证旧密码
            const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ error: '当前密码错误' });
            }

            // 加密新密码
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // 更新密码
            await userModel.updatePassword(req.user.id, hashedPassword);

            res.json({
                success: true,
                message: '密码修改成功'
            });
        } catch (error) {
            console.error('修改密码错误:', error);
            return res.status(500).json({ error: '修改密码失败，请稍后重试' });
        }
    });

    // 清除用户所有数据API
    router.delete('/clear-data', authenticateToken, async (req, res) => {
        console.log('📝 收到清除数据请求, 用户ID:', req.user.id);
        const { password } = req.body;

        if (!password) {
            console.log('❌ 参数缺失: password=', !!password);
            return res.status(400).json({ error: '需要输入密码确认' });
        }

        try {
            // 获取当前用户信息
            const user = await userModel.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: '用户不存在' });
            }

            // 验证密码
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ error: '密码错误' });
            }

            // 清除用户所有数据
            const result = await userModel.clearAllUserData(req.user.id);

            console.log('✅ 用户数据清除成功, 统计:', result.stats);

            res.json({
                success: true,
                message: '所有数据已清除',
                stats: result.stats
            });

            // 延迟3秒后重启服务器，确保响应已发送
            setTimeout(() => {
                console.log('🔄 数据已清除，正在重启服务器...');

                // 触发nodemon重启：修改server.js的修改时间
                const fs = require('fs');
                const serverFile = require('path').join(__dirname, '../server.js');
                const now = new Date();
                try {
                    fs.utimesSync(serverFile, now, now);
                    console.log('✅ 已触发服务器重启');
                } catch (err) {
                    console.error('❌ 触发重启失败，使用退出方式:', err.message);
                    process.exit(1);
                }
            }, 3000);
        } catch (error) {
            console.error('清除数据错误:', error);
            return res.status(500).json({ error: '清除数据失败，请稍后重试' });
        }
    });

    // 管理员API - 获取所有用户信息
    router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
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

    // 管理员API - 编辑用户信息
    router.put('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
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
    router.put('/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
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
    router.delete('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
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

    return router;
};
