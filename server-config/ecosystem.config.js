const sourceDir = process.env.RIDERGUY_SOURCE_DIR || '/var/www/riderguy/source';
const logDir = process.env.RIDERGUY_LOG_DIR || '/var/www/riderguy/logs';

const common = {
  cwd: sourceDir,
  env: { NODE_ENV: 'production' },
  exp_backoff_restart_delay: 100,
  max_restarts: 10,
  min_uptime: '10s',
  merge_logs: true,
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'riderguy-api',
      script: 'apps/api/dist/index.js',
      env: { ...common.env, PORT: 4000 },
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      kill_timeout: 10000,
      listen_timeout: 10000,
      node_args: '--max-old-space-size=1536',
      error_file: `${logDir}/api-error.log`,
      out_file: `${logDir}/api-out.log`,
    },
    {
      ...common,
      name: 'riderguy-marketing',
      script: 'apps/marketing/.next/standalone/server.js',
      env: { ...common.env, PORT: 3000, HOSTNAME: '127.0.0.1' },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      error_file: `${logDir}/marketing-error.log`,
      out_file: `${logDir}/marketing-out.log`,
    },
    {
      ...common,
      name: 'riderguy-admin',
      script: 'apps/admin/.next/standalone/server.js',
      env: { ...common.env, PORT: 3003, HOSTNAME: '127.0.0.1' },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      error_file: `${logDir}/admin-error.log`,
      out_file: `${logDir}/admin-out.log`,
    },
  ],
};
