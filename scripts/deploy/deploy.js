#!/usr/bin/env node
// ==========================================
// Stock Manager 一键部署脚本 (Node.js版本)
// ==========================================
// 功能：自动将本地代码部署到远程Ubuntu服务器
// 使用：node deploy.js 或 npm run deploy
// ==========================================

const { execSync, spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ==================== 配置管理 ====================
const CONFIG_FILE = path.join(__dirname, '.deploy-config.json');

// 默认配置
let CONFIG = {
  remoteHost: '39.102.212.245',
  remoteUser: 'root',
  remotePort: '22',
  remotePath: '/opt/stock-manager',
  branch: 'master',
  skipGitCheck: false
};

// 加载配置
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      CONFIG = { ...CONFIG, ...saved };
      return true;
    } catch (error) {
      console.log('⚠️  配置文件读取失败，将使用默认配置');
    }
  }
  return false;
}

// 保存配置
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG, null, 2));
    console.log('✅ 配置已保存');
  } catch (error) {
    console.log('⚠️  配置保存失败:', error.message);
  }
}

// ==================== 交互界面 ====================
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function printBanner() {
  console.log('\n========================================');
  console.log('   Stock Manager 一键部署工具');
  console.log('========================================\n');
}

// ==================== 配置向导 ====================
async function configWizard() {
  const hasConfig = loadConfig();

  if (hasConfig) {
    console.log('📋 当前配置:');
    console.log(`   服务器: ${CONFIG.remoteUser}@${CONFIG.remoteHost}:${CONFIG.remotePort}`);
    console.log(`   路径: ${CONFIG.remotePath}`);
    console.log(`   分支: ${CONFIG.branch}\n`);

    const useExisting = await prompt('使用现有配置? (yes/no): ');
    if (useExisting.toLowerCase() === 'yes' || useExisting.toLowerCase() === 'y') {
      return;
    }
  }

  console.log('🔧 部署配置向导\n');

  const host = await prompt(`服务器IP [${CONFIG.remoteHost}]: `);
  if (host) CONFIG.remoteHost = host;

  const user = await prompt(`SSH用户名 [${CONFIG.remoteUser || 'ubuntu'}]: `);
  if (user) CONFIG.remoteUser = user;
  else if (!CONFIG.remoteUser) CONFIG.remoteUser = 'ubuntu';

  const port = await prompt(`SSH端口 [${CONFIG.remotePort}]: `);
  if (port) CONFIG.remotePort = port;

  const remotePath = await prompt(`远程项目路径 [${CONFIG.remotePath}]: `);
  if (remotePath) CONFIG.remotePath = remotePath;

  const branch = await prompt(`Git分支名 (如: master, main) [${CONFIG.branch}]: `);
  if (branch) {
    // 验证分支名格式，防止输入完整URL
    if (branch.includes('://') || branch.includes('@')) {
      console.log('⚠️  错误：请输入分支名（如 master），不是完整的仓库URL');
      const retryBranch = await prompt(`Git分支名 [${CONFIG.branch}]: `);
      if (retryBranch) CONFIG.branch = retryBranch;
    } else {
      CONFIG.branch = branch;
    }
  }

  saveConfig();

  console.log('\n📋 最终配置:');
  console.log(`   服务器: ${CONFIG.remoteUser}@${CONFIG.remoteHost}:${CONFIG.remotePort}`);
  console.log(`   路径: ${CONFIG.remotePath}`);
  console.log(`   分支: ${CONFIG.branch}\n`);
}

// ==================== 工具函数 ====================
function execCommand(command, description, options = {}) {
  console.log(`\n🚀 ${description}...`);
  try {
    const output = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
      ...options
    });
    console.log(`✅ ${description} 完成`);
    return output;
  } catch (error) {
    if (!options.allowError) {
      console.error(`❌ ${description} 失败:`, error.message);
      throw error;
    }
    return null;
  }
}

function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    return status.trim();
  } catch (error) {
    return null;
  }
}

// ==================== 部署流程 ====================
async function deploy() {
  try {
    printBanner();
    await configWizard();

    // 验证配置
    if (!CONFIG.remoteHost || !CONFIG.remoteUser) {
      console.error('❌ 错误: 服务器配置不完整');
      process.exit(1);
    }

    const confirm = await prompt('\n确认开始部署? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('❌ 部署已取消');
      process.exit(0);
    }

    console.log('\n🎯 开始部署流程...\n');

    // ==================== 步骤1: 检查本地代码状态 ====================
    console.log('📝 步骤 1/5: 检查本地代码状态...');
    const gitStatus = checkGitStatus();

    if (gitStatus === null) {
      console.log('⚠️  未检测到Git仓库');
      const continueAnyway = await prompt('继续部署? (yes/no): ');
      if (continueAnyway.toLowerCase() !== 'yes') {
        process.exit(0);
      }
    } else if (gitStatus && !CONFIG.skipGitCheck) {
      console.log('⚠️  检测到未提交的更改:');
      console.log(gitStatus);

      const commit = await prompt('\n是否提交这些更改? (yes/no/skip): ');
      if (commit.toLowerCase() === 'yes' || commit.toLowerCase() === 'y') {
        const message = await prompt('请输入提交信息: ');
        execCommand('git add .', '添加文件到暂存区');
        execCommand(`git commit -m "${message}"`, '提交代码');
      } else if (commit.toLowerCase() === 'skip') {
        CONFIG.skipGitCheck = true;
      }
    } else {
      console.log('✅ 工作区干净');
    }

    // ==================== 步骤2: 推送代码 ====================
    if (gitStatus !== null) {
      console.log('\n📤 步骤 2/5: 推送代码到远程仓库...');
      try {
        execCommand(`git push origin ${CONFIG.branch}`, '推送代码');
      } catch (error) {
        const forcePush = await prompt('推送失败，是否强制推送? (yes/no): ');
        if (forcePush.toLowerCase() === 'yes') {
          execCommand(`git push -f origin ${CONFIG.branch}`, '强制推送代码');
        } else {
          throw error;
        }
      }
    } else {
      console.log('\n⏭️  步骤 2/5: 跳过（无Git仓库）');
    }

    // ==================== 步骤3: 测试SSH连接 ====================
    console.log('\n🔌 步骤 3/5: 测试SSH连接...');
    const sshTest = `ssh -p ${CONFIG.remotePort} -o ConnectTimeout=5 ${CONFIG.remoteUser}@${CONFIG.remoteHost} "echo 'SSH连接成功'"`;
    execCommand(sshTest, '测试SSH连接');

    // ==================== 步骤4: 备份生产数据库 ====================
    console.log('\n💾 步骤 4/5: 备份生产数据库...');
    const backupCommands = [
      `cd ${CONFIG.remotePath}`,
      'mkdir -p backups',
      `cp stock_manager.db backups/stock_manager_$(date +%Y%m%d_%H%M%S).db 2>/dev/null || echo "跳过备份（数据库不存在）"`
    ].join(' && ');

    const sshBackup = `ssh -p ${CONFIG.remotePort} ${CONFIG.remoteUser}@${CONFIG.remoteHost} "${backupCommands}"`;
    execCommand(sshBackup, '备份数据库', { allowError: true });

    // ==================== 步骤5: 部署到服务器 ====================
    console.log('\n🚀 步骤 5/5: 部署到服务器...');

    const deployCommands = [
      // 进入项目目录
      `cd ${CONFIG.remotePath}`,

      // 拉取最新代码
      `echo "📥 拉取代码..." && git pull origin ${CONFIG.branch}`,

      // 安装/更新依赖
      'echo "📦 安装依赖..." && npm install --production',

      // 检查PM2是否已安装
      'if ! command -v pm2 &> /dev/null; then echo "安装PM2..." && npm install -g pm2; fi',

      // 重启服务
      'echo "🔄 重启服务..." && pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js',

      // 保存PM2配置
      'pm2 save',

      // 显示状态
      'echo "📊 服务状态:" && pm2 status'
    ].join(' && ');

    const sshDeploy = `ssh -p ${CONFIG.remotePort} ${CONFIG.remoteUser}@${CONFIG.remoteHost} "${deployCommands}"`;
    execCommand(sshDeploy, '在服务器上部署');

    // ==================== 部署完成 ====================
    console.log('\n========================================');
    console.log('🎉 部署成功!');
    console.log('========================================');
    console.log(`📍 访问地址: http://${CONFIG.remoteHost}:3000`);
    console.log('\n💡 常用命令:');
    console.log('   npm run logs       - 查看服务器日志');
    console.log(`   ssh ${CONFIG.remoteUser}@${CONFIG.remoteHost} "pm2 status"     - 查看服务状态`);
    console.log(`   ssh ${CONFIG.remoteUser}@${CONFIG.remoteHost} "pm2 monit"      - 实时监控`);
    console.log('');

  } catch (error) {
    console.error('\n❌ 部署失败:', error.message);
    console.log('\n💡 故障排查:');
    console.log('   1. 检查SSH连接是否正常');
    console.log('   2. 确认服务器上已安装Node.js和Git');
    console.log('   3. 验证远程路径是否正确');
    console.log('   4. 检查Git仓库权限');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// ==================== 程序入口 ====================
// 处理命令行参数
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
用法: node deploy.js [选项]

选项:
  --help, -h        显示帮助信息
  --config          重新配置部署参数

示例:
  node deploy.js              # 正常部署
  node deploy.js --config     # 重新配置
  `);
  process.exit(0);
}

if (args.includes('--config')) {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
    console.log('✅ 配置已清除，将重新配置');
  }
}

// 运行部署
deploy();
