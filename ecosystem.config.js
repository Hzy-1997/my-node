/**
 * PM2 配置文件
 * 线上环境使用 PM2 管理应用和工作进程
 * 
 * 启动：pm2 start ecosystem.config.js
 * 停止：pm2 stop ecosystem.config.js
 * 重启：pm2 restart ecosystem.config.js
 * 重载（零停机）：pm2 reload ecosystem.config.js
 * 查看状态：pm2 status
 * 查看日志：pm2 logs
 */

const fs = require('fs');
const path = require('path');

// 确保日志目录存在
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

module.exports = {
  apps: [
    {
      name: 'mynode-app',
      script: './bin/www',
      instances: 1,  // 先测试1个实例，确认无状态后再增加
      exec_mode: 'fork',  // 如果是无状态应用可改为 'cluster'
      max_memory_restart: '500M',

      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },

      // 日志配置
      log_file: './logs/app.log',
      out_file: './logs/app-out.log',
      error_file: './logs/app-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,  // 合并多实例日志

      // 进程管理
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',  // 最小运行时间，避免无限重启
      kill_timeout: 5000,  // 强制kill前的等待时间
      listen_timeout: 5000,  // 监听超时

      // 监控
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'temp'],

      // 实例优雅退出
      wait_ready: false,  // 如果需要手动通知PM2应用已就绪，设为true

      // 环境变量
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'mynode-worker',
      script: './workers/orderWorker.js',
      instances: 1,  // 队列消费者通常设为1，避免重复消费
      exec_mode: 'fork',
      max_memory_restart: '300M',

      env: {
        NODE_ENV: 'production',
        WORKER_ID: 'primary'
      },
      env_development: {
        NODE_ENV: 'development',
        WORKER_ID: 'dev'
      },

      // 日志配置
      log_file: './logs/worker.log',
      out_file: './logs/worker-out.log',
      error_file: './logs/worker-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // 进程管理
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 10000,  // worker需要更长时间清理任务

      // Worker特定配置
      watch: false,
      wait_ready: true,  // 等待 worker 初始化完成

      // 实例变量（用于区分多个worker实例）
      instance_var: 'WORKER_INSTANCE',
    }
  ],

  // 部署配置（可选）
  deploy: {
    production: {
      user: 'your_user',
      host: 'your_server_ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo.git',
      path: '/var/www/mynode-app',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};