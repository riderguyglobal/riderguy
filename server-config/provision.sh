#!/usr/bin/env bash
set -Eeuo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo 'Run this script as root.' >&2
  exit 1
fi

DEPLOY_USER="${RIDERGUY_DEPLOY_USER:-deploy}"
DEPLOY_PUBLIC_KEY="${RIDERGUY_DEPLOY_PUBLIC_KEY:-}"
APP_ROOT="${RIDERGUY_APP_ROOT:-/var/www/riderguy}"
ENV_FILE="$APP_ROOT/shared/.env.production"

if [ -z "$DEPLOY_PUBLIC_KEY" ]; then
  echo 'RIDERGUY_DEPLOY_PUBLIC_KEY is required.' >&2
  exit 1
fi

log() { printf '[provision] %s\n' "$*"; }

log 'installing operating-system updates and production packages'
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y full-upgrade
apt-get install -y \
  build-essential ca-certificates certbot cron curl fail2ban git jq libpq-dev \
  logrotate nginx nodejs npm openssl postgresql postgresql-client \
  python3-certbot-nginx redis-server rsync unattended-upgrades ufw

timedatectl set-timezone Africa/Accra

if ! swapon --show=NAME --noheadings | grep -q .; then
  log 'creating a 2 GiB swap file'
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -qF '/swapfile none swap sw 0 0' /etc/fstab \
    || printf '/swapfile none swap sw 0 0\n' >>/etc/fstab
fi

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash --comment 'RiderGuy deployment' "$DEPLOY_USER"
fi

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
printf '%s\n' "$DEPLOY_PUBLIC_KEY" >"/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
ssh-keygen -lf "/home/$DEPLOY_USER/.ssh/authorized_keys" >/dev/null

install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_ROOT"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
  "$APP_ROOT/source" "$APP_ROOT/uploads" "$APP_ROOT/logs"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
  "$APP_ROOT/shared" "$APP_ROOT/backups" "$APP_ROOT/backups/postgresql"

log 'configuring key-only SSH access'
install -d -m 755 /etc/ssh/sshd_config.d
cat >/etc/ssh/sshd_config.d/60-riderguy-hardening.conf <<EOF
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
PermitEmptyPasswords no
PermitRootLogin prohibit-password
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
LoginGraceTime 30
AllowUsers root $DEPLOY_USER
EOF
sshd -t
systemctl reload ssh

log 'configuring firewall and intrusion prevention'
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw limit 22/tcp
ufw --force enable

cat >/etc/fail2ban/jail.d/riderguy.local <<'EOF'
[DEFAULT]
banaction = ufw
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 2h

[nginx-http-auth]
enabled = true

[nginx-botsearch]
enabled = true
EOF
systemctl enable --now fail2ban

log 'applying conservative kernel hardening'
cat >/etc/sysctl.d/99-riderguy-security.conf <<'EOF'
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
kernel.randomize_va_space = 2
kernel.yama.ptrace_scope = 2
fs.suid_dumpable = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.tcp_syncookies = 1
EOF
sysctl --system >/dev/null

log 'enabling automatic security updates'
cat >/etc/apt/apt.conf.d/52riderguy-unattended-upgrades <<'EOF'
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}-security";
  "${distro_id}ESMApps:${distro_codename}-apps-security";
  "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
EOF
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

log 'installing the pinned npm release and PM2'
npm install --global npm@10.8.0 pm2@latest

systemctl enable --now postgresql redis-server nginx cron
sed -i -E 's/^[[:space:]]*server_tokens[[:space:]]+[^;]+;/\tserver_tokens off;/' /etc/nginx/nginx.conf

if [ ! -f "$ENV_FILE" ]; then
  log 'generating new database, Redis, and JWT secrets'
  DB_PASSWORD="$(openssl rand -hex 32)"
  REDIS_PASSWORD="$(openssl rand -hex 32)"
  JWT_ACCESS_SECRET="$(openssl rand -hex 64)"
  JWT_REFRESH_SECRET="$(openssl rand -hex 64)"

  umask 077
  cat >"$ENV_FILE" <<EOF
NODE_ENV=production
PORT=4000
APP_URL=https://myriderguy.com
API_URL=https://api.myriderguy.com
NEXT_PUBLIC_API_URL=https://api.myriderguy.com/api/v1
DATABASE_URL='postgresql://riderguy:${DB_PASSWORD}@127.0.0.1:5432/riderguy_db?connection_limit=10&connect_timeout=10'
REDIS_URL='redis://:${REDIS_PASSWORD}@127.0.0.1:6379'
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
OTP_EXPIRY_MINUTES=5
UPLOAD_DIR=/var/www/riderguy/uploads
UPLOAD_BASE_URL=https://api.myriderguy.com/uploads
S3_ENDPOINT=
S3_REGION=auto
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=riderguy-uploads
GOOGLE_MAPS_ENABLED=false
GOOGLE_MAPS_API_KEY=
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_SECRET=
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
MNOTIFY_API_KEY=
MNOTIFY_SENDER_ID=RiderGuy
GMAIL_USER=
GMAIL_APP_PASSWORD=
EMAIL_FROM=developer@myriderguy.com
GOOGLE_CLIENT_ID=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
CORS_ORIGINS=https://myriderguy.com,https://www.myriderguy.com,https://app.myriderguy.com,https://rider.myriderguy.com,https://admin.myriderguy.com
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
WEBAUTHN_RP_NAME=RiderGuy
WEBAUTHN_RP_ID=myriderguy.com
WEBAUTHN_ORIGIN=https://myriderguy.com,https://admin.myriderguy.com
API_KEY_21ST=
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
EOF
  chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  sudo -u postgres psql --set=ON_ERROR_STOP=1 --set=app_password="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE riderguy LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'riderguy') \gexec
SELECT format('ALTER ROLE riderguy WITH LOGIN PASSWORD %L', :'app_password') \gexec
SELECT 'CREATE DATABASE riderguy_db OWNER riderguy'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'riderguy_db') \gexec
ALTER DATABASE riderguy_db OWNER TO riderguy;
SQL

  sed -i -E '/^[[:space:]]*requirepass[[:space:]]/d' /etc/redis/redis.conf
  sed -i -E 's/^[#[:space:]]*supervised[[:space:]].*/supervised systemd/' /etc/redis/redis.conf
  cat >>/etc/redis/redis.conf <<EOF

# RiderGuy production overrides
requirepass ${REDIS_PASSWORD}
appendonly yes
appendfsync everysec
maxmemory 512mb
maxmemory-policy noeviction
EOF
  systemctl restart redis-server
fi

chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_ROOT"
chmod 600 "$ENV_FILE"

log 'provisioning completed'
node --version
npm --version
pm2 --version
psql --version
redis-server --version
ufw status verbose
