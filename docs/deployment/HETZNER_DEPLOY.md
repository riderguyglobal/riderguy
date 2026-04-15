# RiderGuy - Hetzner Deployment Plan

## Server Details

| Property | Value |
|----------|-------|
| **Provider** | Hetzner Cloud |
| **Plan** | CX43 |
| **Server ID** | #126979244 |
| **IPv4** | 178.104.193.184 |
| **IPv6** | 2a01:4f8:1c18:3d69::/64 |
| **vCPU** | 8 |
| **RAM** | 16 GB |
| **Disk** | 160 GB SSD |
| **Location** | Nuremberg, Germany (eu-central) |
| **OS** | Ubuntu 24.04 LTS (to be installed) |
| **SSH Key** | ~/.ssh/riderguy-hetzner |

---

## Architecture Overview

Everything runs on a single Hetzner server. No external cloud services except essential third-party APIs.

```
                    ┌─────────────────────────────────────────────────┐
                    │              Hetzner CX43 Server                │
                    │           178.104.193.184 (8 vCPU/16GB)        │
                    │                                                 │
  Internet ──▶     │   ┌──────────────────────────────────┐          │
                    │   │         Nginx (reverse proxy)    │          │
                    │   │   Port 80 / 443 (SSL via Certbot)│          │
                    │   └──────┬───┬───┬───┬───┬──────────┘          │
                    │          │   │   │   │   │                      │
                    │    ┌─────┘   │   │   │   └──────┐              │
                    │    ▼         ▼   ▼   ▼          ▼              │
                    │  :3000    :3001 :3002 :3003   :4000             │
                    │  Marketing Rider Client Admin   API             │
                    │  (Next.js) (Next.js) (Next.js) (Express)       │
                    │                                  │   │          │
                    │                          ┌───────┘   └───┐     │
                    │                          ▼               ▼     │
                    │                   ┌────────────┐  ┌─────────┐  │
                    │                   │ PostgreSQL  │  │  Redis  │  │
                    │                   │    16       │  │   7     │  │
                    │                   │ :5432       │  │  :6379  │  │
                    │                   └────────────┘  └─────────┘  │
                    │                                                 │
                    │   /var/www/riderguy/uploads/  (local file store)│
                    └─────────────────────────────────────────────────┘
```

### Port Allocation

| Service | Port | Access |
|---------|------|--------|
| Nginx | 80, 443 | Public |
| Marketing (Next.js) | 3000 | Internal only (via Nginx) |
| Rider App (Next.js) | 3001 | Internal only (via Nginx) |
| Client App (Next.js) | 3002 | Internal only (via Nginx) |
| Admin Portal (Next.js) | 3003 | Internal only (via Nginx) |
| API (Express + Socket.IO) | 4000 | Internal only (via Nginx) |
| PostgreSQL | 5432 | localhost only |
| Redis | 6379 | localhost only |

---

## Migration from External Services

### What We're Removing

| Old Service | Replacement | Notes |
|-------------|-------------|-------|
| Neon PostgreSQL (cloud) | PostgreSQL 16 (local) | Self-hosted on server |
| Cloudflare R2 / AWS S3 | Local disk storage | `/var/www/riderguy/uploads/` served via Nginx |
| Mapbox | Google Maps API | Keys already configured |
| Render hosting | Hetzner + PM2 + Nginx | Full self-hosted stack |
| Supabase | Not needed | Was never deeply integrated |

### What We're Keeping

| Service | Reason |
|---------|--------|
| Paystack | Ghana payment gateway, no self-hosted alternative |
| mNotify | Ghana SMS provider for OTP/alerts |
| SendGrid | Transactional email delivery |
| Firebase Cloud Messaging | Push notifications to PWA clients |
| Google OAuth | Social login |
| Google Maps API | Geocoding, directions, live tracking |
| Sentry (optional) | Error monitoring |

### Marketing App Change

The current `apps/marketing/` in this repo will be **replaced** with the marketing app from `c:\Users\Jay Monty\Desktop\Projects\myriderguy\apps\marketing\` which has a polished editorial design with:
- Hero carousel with Ken Burns effect
- Scroll-reveal animations
- 10+ pages (About, Careers, Contact, For Riders, For Businesses, etc.)
- Already audited for accessibility and content compliance

---

## Deployment Phases

### Phase 1: Server Setup (Foundation)

SSH into server and install the base stack.

```bash
ssh -i ~/.ssh/riderguy-hetzner root@178.104.193.184
```

**1.1 System Update & Essentials**
```bash
apt update && apt upgrade -y
apt install -y curl wget git build-essential ufw fail2ban htop unzip
```

**1.2 Create Deploy User**
```bash
adduser --disabled-password --gecos "" deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
usermod -aG sudo deploy
echo "deploy ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/deploy
```

**1.3 Firewall (UFW)**
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

**1.4 Fail2Ban**
```bash
systemctl enable fail2ban
systemctl start fail2ban
```

**1.5 SSH Hardening**
```bash
# Edit /etc/ssh/sshd_config:
# PasswordAuthentication no
# PermitRootLogin prohibit-password
# MaxAuthTries 3
systemctl restart sshd
```

---

### Phase 2: Database & Cache

**2.1 PostgreSQL 16**
```bash
apt install -y postgresql-16 postgresql-contrib-16

sudo -u postgres psql <<EOF
CREATE USER riderguy WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD_HERE';
CREATE DATABASE riderguy_db OWNER riderguy;
\c riderguy_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
GRANT ALL PRIVILEGES ON DATABASE riderguy_db TO riderguy;
EOF
```

PostgreSQL config tuning for 16GB RAM (`/etc/postgresql/16/main/postgresql.conf`):
```ini
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
work_mem = 32MB
max_connections = 200
wal_buffers = 64MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1
effective_io_concurrency = 200
```

Restrict to localhost only (`/etc/postgresql/16/main/pg_hba.conf`):
```
local   all   all                 peer
host    all   all   127.0.0.1/32  scram-sha-256
host    all   all   ::1/128       scram-sha-256
```

```bash
systemctl restart postgresql
systemctl enable postgresql
```

**2.2 Redis 7**
```bash
apt install -y redis-server
```

Edit `/etc/redis/redis.conf`:
```ini
bind 127.0.0.1 ::1
maxmemory 512mb
maxmemory-policy allkeys-lru
```

```bash
systemctl restart redis-server
systemctl enable redis-server
```

---

### Phase 3: Node.js & Process Manager

**3.1 Node.js 22 (via NodeSource)**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v  # Should show v22.x
npm -v
```

**3.2 PM2**
```bash
npm install -g pm2
pm2 startup systemd -u deploy --hp /home/deploy
```

---

### Phase 4: Nginx & SSL

**4.1 Nginx**
```bash
apt install -y nginx
systemctl enable nginx
```

**4.2 SSL with Certbot**
Once domains are pointed to 178.104.193.184:
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d myriderguy.com -d www.myriderguy.com -d api.myriderguy.com -d rider.myriderguy.com -d app.myriderguy.com -d admin.myriderguy.com
```

**4.3 Nginx Configuration** (`/etc/nginx/sites-available/riderguy`)

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_general:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=api_auth:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=ws_conn:10m rate=5r/s;

# Upstream definitions
upstream marketing   { server 127.0.0.1:3000; }
upstream rider_app   { server 127.0.0.1:3001; }
upstream client_app  { server 127.0.0.1:3002; }
upstream admin_app   { server 127.0.0.1:3003; }
upstream api_backend { server 127.0.0.1:4000; }

# ── Marketing site: myriderguy.com ──
server {
    listen 80;
    listen [::]:80;
    server_name myriderguy.com www.myriderguy.com;

    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    location / {
        proxy_pass http://marketing;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_next/static/ {
        proxy_pass http://marketing;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}

# ── Rider app: rider.myriderguy.com ──
server {
    listen 80;
    listen [::]:80;
    server_name rider.myriderguy.com;

    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    location / {
        proxy_pass http://rider_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# ── Client app: app.myriderguy.com ──
server {
    listen 80;
    listen [::]:80;
    server_name app.myriderguy.com;

    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    location / {
        proxy_pass http://client_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# ── Admin portal: admin.myriderguy.com ──
server {
    listen 80;
    listen [::]:80;
    server_name admin.myriderguy.com;

    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    location / {
        proxy_pass http://admin_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# ── API: api.myriderguy.com ──
server {
    listen 80;
    listen [::]:80;
    server_name api.myriderguy.com;

    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    # API routes
    location / {
        limit_req zone=api_general burst=50 nodelay;
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_set_header Connection "";
    }

    # Auth endpoints (stricter rate limit)
    location /api/v1/auth/ {
        limit_req zone=api_auth burst=10 nodelay;
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        limit_req zone=ws_conn burst=5 nodelay;
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Uploaded files (served directly by Nginx)
    location /uploads/ {
        alias /var/www/riderguy/uploads/;
        expires 30d;
        add_header Cache-Control "public";
        add_header X-Content-Type-Options nosniff;
    }

    # Security headers
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Block exploit paths
    location ~ /\.(git|env|htaccess) { deny all; return 404; }

    client_max_body_size 25M;
}

# ── IP-only access (fallback) ──
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 178.104.193.184;

    location /health {
        proxy_pass http://api_backend/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://marketing;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Common HTTPS block** (added by Certbot, or manually after certs are installed):
```nginx
# Security headers for all HTTPS servers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options SAMEORIGIN always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy strict-origin-when-cross-origin always;

# Gzip
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

server_tokens off;
client_body_timeout 10s;
client_header_timeout 10s;
keepalive_timeout 65s;
send_timeout 10s;
```

---

### Phase 5: Directory Structure & Permissions

```bash
mkdir -p /var/www/riderguy/{source,uploads,logs,backups}
mkdir -p /var/www/riderguy/uploads/{documents,vehicles,profiles,pod-photos}
mkdir -p /var/www/certbot
chown -R deploy:deploy /var/www/riderguy
chmod 755 /var/www/riderguy/uploads
```

---

### Phase 6: Application Configuration

**6.1 Environment Variables** (`.env.production`)

```env
# ── Core ──
NODE_ENV=production
PORT=4000
APP_URL=https://myriderguy.com
API_URL=https://api.myriderguy.com

# ── Database (local PostgreSQL) ──
DATABASE_URL=postgresql://riderguy:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/riderguy_db
DIRECT_URL=postgresql://riderguy:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/riderguy_db

# ── Redis (local) ──
REDIS_URL=redis://127.0.0.1:6379

# ── JWT Secrets (generate unique values!) ──
JWT_ACCESS_SECRET=GENERATE_WITH_openssl_rand_hex_64
JWT_REFRESH_SECRET=GENERATE_WITH_openssl_rand_hex_64

# ── File Storage (local disk, no S3) ──
UPLOAD_DIR=/var/www/riderguy/uploads
UPLOAD_BASE_URL=https://api.myriderguy.com/uploads
# Leave S3_ vars empty to use local fallback

# ── Google Maps (replacing Mapbox) ──
GOOGLE_MAPS_API_KEY=CHANGE_ME
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=CHANGE_ME

# ── Payments (Paystack) ──
PAYSTACK_SECRET_KEY=CHANGE_ME
PAYSTACK_PUBLIC_KEY=CHANGE_ME
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=CHANGE_ME

# ── SMS (mNotify - Ghana) ──
MNOTIFY_API_KEY=CHANGE_ME
MNOTIFY_SENDER_ID=RiderGuy

# ── Email (SendGrid) ──
SENDGRID_API_KEY=YOUR_SENDGRID_API_KEY
SENDGRID_FROM_EMAIL=noreply@myriderguy.com

# ── Google OAuth ──
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID

# ── Firebase (Push Notifications) ──
FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL=YOUR_FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY=YOUR_FIREBASE_PRIVATE_KEY
NEXT_PUBLIC_FIREBASE_API_KEY=CHANGE_ME
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY

# ── WebAuthn ──
WEBAUTHN_RP_NAME=RiderGuy
WEBAUTHN_RP_ID=myriderguy.com
WEBAUTHN_ORIGIN=https://myriderguy.com

# ── SourceID (Ghana Card Verification) ──
SOURCEID_API_KEY=YOUR_SOURCEID_API_KEY
SOURCEID_BASE_URL=https://api.sbx.sourceid.tech

# ── Sentry (optional) ──
SENTRY_DSN=
```

**6.2 PM2 Ecosystem Config** (`ecosystem.config.js`)

```javascript
module.exports = {
  apps: [
    // ── API (Express + Socket.IO) ──
    {
      name: 'riderguy-api',
      script: 'node_modules/.bin/tsx',
      args: 'apps/api/src/index.ts',
      cwd: '/var/www/riderguy/source',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      exp_backoff_restart_delay: 100,
      max_restarts: 15,
      kill_timeout: 5000,
      listen_timeout: 10000,
      error_file: '/var/www/riderguy/logs/api-error.log',
      out_file: '/var/www/riderguy/logs/api-out.log',
      merge_logs: true,
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
      error_file: '/var/www/riderguy/logs/marketing-error.log',
      out_file: '/var/www/riderguy/logs/marketing-out.log',
      merge_logs: true,
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
        NEXT_PUBLIC_API_URL: 'https://api.myriderguy.com',
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'AIzaSyBsJhWMnbMXcRdsv9la7BWVf6rJXUkG4V8',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      error_file: '/var/www/riderguy/logs/rider-error.log',
      out_file: '/var/www/riderguy/logs/rider-out.log',
      merge_logs: true,
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
        NEXT_PUBLIC_API_URL: 'https://api.myriderguy.com',
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'AIzaSyBsJhWMnbMXcRdsv9la7BWVf6rJXUkG4V8',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      error_file: '/var/www/riderguy/logs/client-error.log',
      out_file: '/var/www/riderguy/logs/client-out.log',
      merge_logs: true,
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
        NEXT_PUBLIC_API_URL: 'https://api.myriderguy.com',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      error_file: '/var/www/riderguy/logs/admin-error.log',
      out_file: '/var/www/riderguy/logs/admin-out.log',
      merge_logs: true,
    },
  ],
};
```

---

### Phase 7: Code Changes Required

Before deploying, these code modifications need to happen in the Riderguy PWA codebase:

**7.1 Replace Mapbox with Google Maps**
- [ ] Remove `mapbox-gl` and `@mapbox/mapbox-gl-geocoder` from rider and client apps
- [ ] Install `@react-google-maps/api` or `@vis.gl/react-google-maps`
- [ ] Update all map components (rider tracking, order placement, route display)
- [ ] Replace Mapbox geocoding API calls with Google Places/Geocoding API
- [ ] Replace Mapbox Directions API calls with Google Directions API
- [ ] Update environment variable references from `MAPBOX_*` to `GOOGLE_MAPS_*`

**7.2 Replace Marketing App**
- [ ] Back up current `apps/marketing/`
- [ ] Copy marketing app from `myriderguy/apps/marketing/` into this repo
- [ ] Verify shared package imports (`@riderguy/ui`, `@riderguy/config`) are compatible
- [ ] Test build with `next build`

**7.3 Storage: Ensure Local Disk Fallback Works**
- [ ] Verify `apps/api/src/services/storage.service.ts` local fallback is functional
- [ ] Update upload URL generation to use `UPLOAD_BASE_URL` env var
- [ ] Ensure Nginx serves `/uploads/` directory correctly
- [ ] Test document upload, vehicle photo upload, POD photo upload

**7.4 Database: Switch from Neon to Local PostgreSQL**
- [ ] Update Prisma datasource to use single `DATABASE_URL` (no pooling needed locally)
- [ ] Run `prisma db push` against local PostgreSQL
- [ ] Verify all 60+ models are created
- [ ] Seed initial data (admin user, zones, default pricing)

---

### Phase 8: Deployment Script

```powershell
# deploy.ps1 - Run from project root on Windows
$ErrorActionPreference = 'Stop'

$SSH_KEY    = "$env:USERPROFILE\.ssh\riderguy-hetzner"
$SERVER     = 'deploy@178.104.193.184'
$REMOTE     = '/var/www/riderguy'
$ROOT       = (Get-Item "$PSScriptRoot\..").FullName

function Invoke-SSH($cmd) {
    ssh -i $SSH_KEY $SERVER $cmd
    if ($LASTEXITCODE -ne 0) { throw "SSH failed: $cmd" }
}

function Invoke-SSHRoot($cmd) {
    ssh -i $SSH_KEY "root@178.104.193.184" $cmd
    if ($LASTEXITCODE -ne 0) { throw "SSH root failed: $cmd" }
}

Write-Host "`n========== RiderGuy Deploy to Hetzner ==========" -ForegroundColor Green

# 1. Archive & upload source
Write-Host '[1/7] Archiving source...' -ForegroundColor Cyan
$tar = Join-Path $env:TEMP 'riderguy-deploy.tar.gz'
Push-Location $ROOT
tar -czf $tar --exclude=node_modules --exclude=.next --exclude=.turbo --exclude=.git --exclude=dist `
    "apps" "packages" "scripts" "server-config" "package.json" "package-lock.json" "tsconfig.base.json" "turbo.json"
Pop-Location
scp -i $SSH_KEY $tar "${SERVER}:/tmp/riderguy-deploy.tar.gz"
Remove-Item $tar -ErrorAction SilentlyContinue

# 2. Extract on server
Write-Host '[2/7] Extracting on server...' -ForegroundColor Cyan
Invoke-SSH "mkdir -p ${REMOTE}/source ${REMOTE}/logs ${REMOTE}/uploads"
Invoke-SSH "cd ${REMOTE}/source && rm -rf apps packages scripts server-config *.json 2>/dev/null; tar -xzf /tmp/riderguy-deploy.tar.gz && rm /tmp/riderguy-deploy.tar.gz"

# 3. Upload .env
Write-Host '[3/7] Uploading environment config...' -ForegroundColor Cyan
scp -i $SSH_KEY "$ROOT\server-config\.env.production" "${SERVER}:${REMOTE}/source/.env"

# 4. Install dependencies & Prisma
Write-Host '[4/7] Installing dependencies...' -ForegroundColor Cyan
Invoke-SSH "cd ${REMOTE}/source && NODE_ENV=development npm ci 2>&1 | tail -5"
Invoke-SSH "cd ${REMOTE}/source && npx prisma generate --schema=packages/database/prisma/schema.prisma 2>&1 | tail -5"

# 5. Push database schema
Write-Host '[5/7] Syncing database schema...' -ForegroundColor Cyan
Invoke-SSH "cd ${REMOTE}/source && npx prisma db push --schema=packages/database/prisma/schema.prisma 2>&1 | tail -10"

# 6. Build all Next.js apps
Write-Host '[6/7] Building applications...' -ForegroundColor Cyan
foreach ($app in @('marketing', 'rider', 'client', 'admin')) {
    Write-Host "  Building $app..." -ForegroundColor Gray
    Invoke-SSH "cd ${REMOTE}/source/apps/$app && npx next build 2>&1 | tail -10"
    Invoke-SSH "cd ${REMOTE}/source/apps/$app && cp -r .next/static .next/standalone/apps/$app/.next/static 2>/dev/null; cp -r public .next/standalone/apps/$app/public 2>/dev/null; echo done"
}

# 7. Deploy configs & restart
Write-Host '[7/7] Starting services...' -ForegroundColor Cyan
Invoke-SSH "cp ${REMOTE}/source/server-config/ecosystem.config.js ${REMOTE}/ecosystem.config.js"
Invoke-SSHRoot "cp ${REMOTE}/source/server-config/nginx-riderguy.conf /etc/nginx/sites-available/riderguy && ln -sf /etc/nginx/sites-available/riderguy /etc/nginx/sites-enabled/riderguy && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx"
Invoke-SSH "cd ${REMOTE} && pm2 delete all 2>/dev/null; pm2 start ecosystem.config.js && pm2 save"

Write-Host "`n========== Deploy Complete! ==========`n" -ForegroundColor Green
Write-Host "  Marketing:  http://178.104.193.184" -ForegroundColor Yellow
Write-Host "  API Health: http://178.104.193.184/health (via api subdomain)" -ForegroundColor Yellow
Write-Host "  SSH:        ssh -i ~/.ssh/riderguy-hetzner deploy@178.104.193.184`n" -ForegroundColor Gray
```

---

### Phase 9: Database Backups

**Automated daily backups via cron:**

```bash
# /var/www/riderguy/scripts/backup-db.sh
#!/bin/bash
BACKUP_DIR="/var/www/riderguy/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -U riderguy -h 127.0.0.1 riderguy_db | gzip > "$BACKUP_DIR/riderguy_db_$TIMESTAMP.sql.gz"
# Keep only last 14 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +14 -delete
```

```bash
# Add to deploy user's crontab
crontab -e
# 0 3 * * * /var/www/riderguy/scripts/backup-db.sh
```

---

### Phase 10: DNS Configuration

Point these domains to `178.104.193.184`:

| Record | Type | Value |
|--------|------|-------|
| myriderguy.com | A | 178.104.193.184 |
| www.myriderguy.com | A | 178.104.193.184 |
| api.myriderguy.com | A | 178.104.193.184 |
| rider.myriderguy.com | A | 178.104.193.184 |
| app.myriderguy.com | A | 178.104.193.184 |
| admin.myriderguy.com | A | 178.104.193.184 |

Also add AAAA records for IPv6: `2a01:4f8:1c18:3d69::1`

---

## Execution Order (Checklist)

| # | Task | Status |
|---|------|--------|
| 1 | SSH into server, run Phase 1 (system setup) | [ ] |
| 2 | Install PostgreSQL & Redis (Phase 2) | [ ] |
| 3 | Install Node.js 22 & PM2 (Phase 3) | [ ] |
| 4 | Install Nginx (Phase 4.1) | [ ] |
| 5 | Create directory structure (Phase 5) | [ ] |
| 6 | Replace marketing app from myriderguy project (Phase 7.2) | [ ] |
| 7 | Replace Mapbox with Google Maps in code (Phase 7.1) | [ ] |
| 8 | Verify local storage fallback works (Phase 7.3) | [ ] |
| 9 | Create .env.production with real values (Phase 6.1) | [ ] |
| 10 | First deploy: upload code, build, start (Phase 8) | [ ] |
| 11 | Push database schema (Phase 6) | [ ] |
| 12 | Seed initial data | [ ] |
| 13 | Point DNS to server (Phase 10) | [ ] |
| 14 | Install SSL certificates (Phase 4.2) | [ ] |
| 15 | Configure Nginx HTTPS blocks | [ ] |
| 16 | Set up database backups (Phase 9) | [ ] |
| 17 | Test all apps end-to-end | [ ] |

---

## Resource Estimates

| Resource | Usage | Capacity | Headroom |
|----------|-------|----------|----------|
| Disk | ~5GB (apps + DB + uploads start) | 160 GB | 155 GB |
| RAM | ~6GB (PG 4GB + Redis 0.5GB + 5 Node apps ~1.5GB) | 16 GB | 10 GB |
| CPU | Low-moderate (8 vCPU handles all) | 8 vCPU | Plenty |

This server is more than sufficient for launch and early growth.
