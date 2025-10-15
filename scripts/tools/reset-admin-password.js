#!/usr/bin/env node
// ==========================================
// 管理员密码重置工具
// ==========================================
// 用途：重置管理员账号密码或生成密码哈希

const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// 生成密码哈希
async function generateHash(password) {
    try {
        const hash = await bcrypt.hash(password, 10);
        return hash;
    } catch (error) {
        throw new Error(`生成哈希失败: ${error.message}`);
    }
}

// 验证密码哈希
async function verifyHash(password, hash) {
    try {
        return await bcrypt.compare(password, hash);
    } catch (error) {
        return false;
    }
}

// 重置管理员密码
async function resetAdminPassword(dbPath, account, newPassword) {
    let db;
    try {
        // 连接数据库
        db = new Database(dbPath);
        log('green', '✅ 成功连接到数据库');

        // 查找用户
        const user = db.prepare('SELECT * FROM users WHERE account = ?').get(account);
        if (!user) {
            throw new Error(`用户 ${account} 不存在`);
        }

        log('blue', `📋 找到用户: ${user.username} (${user.account})`);
        log('blue', `   角色: ${user.role}`);

        // 生成新密码哈希
        log('yellow', '🔐 正在生成密码哈希...');
        const hashedPassword = await generateHash(newPassword);

        // 更新密码
        const result = db.prepare('UPDATE users SET password = ? WHERE account = ?')
            .run(hashedPassword, account);

        if (result.changes > 0) {
            log('green', '✅ 密码重置成功！');
            log('green', `   账号: ${account}`);
            log('green', `   新密码: ${newPassword}`);

            // 验证新密码
            const verify = await verifyHash(newPassword, hashedPassword);
            if (verify) {
                log('green', '✅ 密码验证通过');
            } else {
                log('red', '❌ 密码验证失败');
            }
        } else {
            throw new Error('更新失败');
        }

        db.close();
        return true;
    } catch (error) {
        if (db) db.close();
        throw error;
    }
}

// 显示所有用户
function listUsers(dbPath) {
    let db;
    try {
        db = new Database(dbPath);
        const users = db.prepare('SELECT id, username, account, role, lastLogin FROM users').all();

        if (users.length === 0) {
            log('yellow', '⚠️  数据库中没有用户');
            return;
        }

        log('blue', '\n📋 用户列表：');
        log('blue', '─'.repeat(80));
        console.log('ID\t用户名\t\t账号\t\t角色\t\t最后登录');
        log('blue', '─'.repeat(80));

        users.forEach(user => {
            const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-CN') : '从未登录';
            console.log(`${user.id}\t${user.username.padEnd(8, ' ')}\t${user.account.padEnd(8, ' ')}\t${user.role.padEnd(12, ' ')}\t${lastLogin}`);
        });

        log('blue', '─'.repeat(80));
        db.close();
    } catch (error) {
        if (db) db.close();
        throw error;
    }
}

// 生成密码哈希（用于手动更新数据库）
async function generateHashOnly(password) {
    try {
        log('yellow', `🔐 为密码 "${password}" 生成哈希...`);
        const hash = await generateHash(password);
        log('green', '✅ 哈希生成成功：');
        console.log(hash);
        log('yellow', '\n💡 使用方法：');
        console.log(`在 database.js 中将此哈希值用于默认用户的 password 字段`);
        return hash;
    } catch (error) {
        throw error;
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    // 确定数据库路径
    const dbPath = process.env.NODE_ENV === 'production'
        ? path.join(process.cwd(), 'stock_manager.db')
        : path.join(process.cwd(), 'stock_manager_dev.db');

    log('blue', '═'.repeat(80));
    log('blue', '  管理员密码重置工具');
    log('blue', '═'.repeat(80));
    console.log();
    log('yellow', `数据库路径: ${dbPath}`);
    console.log();

    try {
        if (command === 'reset') {
            // 重置密码: node reset-admin-password.js reset <account> <new-password>
            const account = args[1] || 'admin';
            const newPassword = args[2] || 'admin';

            log('yellow', `正在重置账号 "${account}" 的密码为 "${newPassword}"...`);
            await resetAdminPassword(dbPath, account, newPassword);

        } else if (command === 'list') {
            // 列出所有用户: node reset-admin-password.js list
            listUsers(dbPath);

        } else if (command === 'hash') {
            // 生成密码哈希: node reset-admin-password.js hash <password>
            const password = args[1] || 'admin';
            await generateHashOnly(password);

        } else {
            // 显示帮助信息
            log('yellow', '📖 使用说明：');
            console.log();
            console.log('  1. 重置管理员密码：');
            log('green', '     node scripts/tools/reset-admin-password.js reset <账号> <新密码>');
            log('green', '     npm run reset-password admin admin123');
            console.log();
            console.log('  2. 列出所有用户：');
            log('green', '     node scripts/tools/reset-admin-password.js list');
            console.log();
            console.log('  3. 生成密码哈希（用于手动更新代码）：');
            log('green', '     node scripts/tools/reset-admin-password.js hash <密码>');
            console.log();
            console.log('示例：');
            log('blue', '     node scripts/tools/reset-admin-password.js reset admin admin');
            log('blue', '     node scripts/tools/reset-admin-password.js list');
            log('blue', '     node scripts/tools/reset-admin-password.js hash admin123');
            console.log();
        }
    } catch (error) {
        console.error();
        log('red', `❌ 错误: ${error.message}`);
        process.exit(1);
    }

    log('blue', '\n═'.repeat(80));
}

// 运行
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
