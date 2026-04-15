module.exports = {
  apps: [
    // ── API (Express + Socket.IO) ──
    {
      name: 'riderguy-api',
      script: 'apps/api/dist/index.js',
      cwd: '/var/www/riderguy/source',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        CORS_ORIGINS: 'https://myriderguy.com,https://rider.myriderguy.com,https://client.myriderguy.com,https://admin.myriderguy.com',
      },
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      exp_backoff_restart_delay: 100,
      max_restarts: 15,
      min_uptime: '10s',
      kill_timeout: 10000,
      listen_timeout: 10000,
      shutdown_with_message: true,
      wait_ready: false,
      error_file: '/var/www/riderguy/logs/api-error.log',
      out_file: '/var/www/riderguy/logs/api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Auto-restart on memory leaks (checked every 30s)
      pmx: true,
      // Node.js memory optimization
      node_args: '--max-old-space-size=1536 --optimize-for-size',
    },

    // ── Marketing (Next.js standalone) ──
    {
      name: 'riderguy-marketing',
      script: 'apps/marketing/.next/standalone/apps/marketing/server.js',
      cwd: '/var/www/riderguy/source',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: '/var/www/riderguy/logs/marketing-error.log',
      out_file: '/var/www/riderguy/logs/marketing-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ── Rider App (Next.js standalone) ──
    {
      name: 'riderguy-rider',
      script: 'apps/rider/.next/standalone/apps/rider/server.js',
      cwd: '/var/www/riderguy/source',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOSTNAME: '127.0.0.1',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: '/var/www/riderguy/logs/rider-error.log',
      out_file: '/var/www/riderguy/logs/rider-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ── Client App (Next.js standalone) ──
    {
      name: 'riderguy-client',
      script: 'apps/client/.next/standalone/apps/client/server.js',
      cwd: '/var/www/riderguy/source',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        HOSTNAME: '127.0.0.1',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: '/var/www/riderguy/logs/client-error.log',
      out_file: '/var/www/riderguy/logs/client-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ── Admin Portal (Next.js standalone) ──
    {
      name: 'riderguy-admin',
      script: 'apps/admin/.next/standalone/apps/admin/server.js',
      cwd: '/var/www/riderguy/source',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        HOSTNAME: '127.0.0.1',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: '/var/www/riderguy/logs/admin-error.log',
      out_file: '/var/www/riderguy/logs/admin-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
