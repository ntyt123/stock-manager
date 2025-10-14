// ==========================================
// PM2 进程管理配置文件
// ==========================================
// 用于生产环境的进程管理、自动重启、日志管理
//
// 常用命令：
//   pm2 start ecosystem.config.js    - 启动应用
//   pm2 reload ecosystem.config.js   - 零停机重启
//   pm2 stop stock-manager           - 停止应用
//   pm2 restart stock-manager        - 重启应用
//   pm2 delete stock-manager         - 删除应用
//   pm2 logs stock-manager           - 查看日志
//   pm2 monit                        - 实时监控
//   pm2 status                       - 查看状态
// ==========================================

module.exports = {
  apps: [{
    // 应用名称
    name: 'stock-manager',

    // 启动脚本
    script: './server.js',

    // 实例数量（cluster模式）
    // 1 = 单实例，'max' = CPU核心数
    instances: 1,

    // 执行模式
    // 'cluster' = 集群模式（适合无状态应用）
    // 'fork' = 单进程模式
    exec_mode: 'fork',

    // 环境变量（生产环境）
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },

    // 开发环境变量（使用 --env development 时）
    env_development: {
      NODE_ENV: 'development',
      PORT: 3000
    },

    // 日志配置
    error_file: './logs/pm2-error.log',      // 错误日志
    out_file: './logs/pm2-out.log',          // 正常日志
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z', // 日志时间格式
    merge_logs: true,                         // 合并日志

    // 自动重启配置
    autorestart: true,                        // 自动重启
    max_restarts: 10,                         // 最大重启次数
    min_uptime: '10s',                        // 最小运行时间（避免频繁重启）
    restart_delay: 4000,                      // 重启延迟（毫秒）

    // 监控配置
    watch: false,                             // 生产环境不监控文件变化
    ignore_watch: [                           // 忽略监控的文件
      'node_modules',
      'logs',
      '*.db',
      '.git'
    ],

    // 进程配置
    max_memory_restart: '500M',               // 内存超过500M自动重启

    // 时间配置
    kill_timeout: 5000,                       // 强制kill超时时间
    listen_timeout: 3000,                     // 启动超时时间

    // 其他配置
    instance_var: 'INSTANCE_ID',              // 实例ID环境变量名

    // cron重启（可选）
    // cron_restart: '0 2 * * *',             // 每天凌晨2点重启

    // 是否立即启动
    autorestart: true,

    // 进程退出时的行为
    // 'SIGINT' - 优雅退出
    // 'SIGTERM' - 强制退出
    kill_timeout: 3000
  }]
};
