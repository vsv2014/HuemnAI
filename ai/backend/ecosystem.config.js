// PM2 Ecosystem Configuration for HUMANE.OS Backend
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [{
    name: 'humane-backend',
    script: 'run_backend.py',
    interpreter: 'python3',
    cwd: process.cwd(),
    env: {
      ENV: 'production',
      PORT: 8001,
      BACKEND_PORT: 8001,
      BACKEND_HOST: '0.0.0.0',
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true,
  }]
};

