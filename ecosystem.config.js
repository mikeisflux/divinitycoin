// ecosystem.config.js
// PM2 configuration for production deployment

module.exports = {
  apps: [
    {
      name: 'divinitycoin',
      script: 'npm',
      args: 'start',
      cwd: '/root/divinitycoin',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/divinitycoin/error.log',
      out_file: '/var/log/divinitycoin/out.log',
      log_file: '/var/log/divinitycoin/combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
