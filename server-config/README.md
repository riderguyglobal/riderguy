# Production server configuration

This directory is the active baseline for the replacement production server.
It deliberately contains no provider IP, passwords, signing keys, or service
account credentials.

Active server processes:

- `riderguy-api` on port 4000;
- `riderguy-marketing` on port 3000;
- `riderguy-admin` on port 3003.

The customer and rider apps are native Google Play applications and must not be
started by PM2. Previous Hetzner setup and wave-deployment scripts are preserved
under `archive/legacy-server/` for reference only; do not execute them on a new
server.

Expected server layout:

```text
/var/www/riderguy/
  source/                 # clean Git checkout
  shared/.env.production  # mode 600, never committed
  uploads/                # persistent user uploads
  logs/                   # PM2 logs
  backups/postgresql/     # local staging before off-server copy
```

Copy `.env.example` to the server's shared environment path and fill it with
newly issued values. Run `deploy.sh` as the non-root deploy user only after the
replacement server has been provisioned and DNS/TLS are ready.

The Nginx file assumes a Certbot certificate named `myriderguy.com` that covers
all listed hostnames. Use a temporary HTTP-only block for the initial ACME
challenge, then install the full file.
