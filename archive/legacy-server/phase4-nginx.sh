#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  Phase 4.1 - Install & Harden Nginx"
echo "============================================"

# ── 1. Install Nginx ──
echo ""
echo "1. Installing Nginx..."

if command -v nginx &>/dev/null; then
    echo "   Nginx already installed: $(nginx -v 2>&1)"
else
    apt install -y nginx
fi

nginx -v 2>&1
systemctl enable nginx

# ── 2. Harden Nginx main config ──
echo ""
echo "2. Hardening nginx.conf..."

NGINX_CONF="/etc/nginx/nginx.conf"
cp "$NGINX_CONF" "${NGINX_CONF}.backup"

cat > "$NGINX_CONF" <<'NGINXMAIN'
user www-data;
worker_processes auto;
worker_rlimit_nofile 65535;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log warn;

events {
    worker_connections 4096;
    multi_accept on;
    use epoll;
}

http {
    # ── Basic ──
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;
    client_max_body_size 25M;

    # ── MIME types ──
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # ── Logging ──
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time';
    access_log /var/log/nginx/access.log main;

    # ── Gzip ──
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1000;
    gzip_types
        text/plain
        text/css
        application/json
        application/javascript
        text/xml
        application/xml
        application/xml+rss
        text/javascript
        image/svg+xml
        application/wasm;

    # ── Timeouts ──
    client_body_timeout 10s;
    client_header_timeout 10s;
    send_timeout 10s;
    proxy_connect_timeout 10s;
    proxy_read_timeout 60s;
    proxy_send_timeout 30s;

    # ── Buffers ──
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    # ── Rate Limiting Zones ──
    limit_req_zone $binary_remote_addr zone=api_general:10m rate=30r/s;
    limit_req_zone $binary_remote_addr zone=api_auth:10m rate=5r/s;
    limit_req_zone $binary_remote_addr zone=ws_conn:10m rate=5r/s;

    # ── Security Headers (global) ──
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # ── Real IP from proxy ──
    set_real_ip_from 127.0.0.1;
    real_ip_header X-Forwarded-For;

    # ── Include site configs ──
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
NGINXMAIN

echo "   nginx.conf hardened"

# ── 3. Remove default site ──
echo ""
echo "3. Removing default site..."
rm -f /etc/nginx/sites-enabled/default
echo "   Default site removed"

# ── 4. Test and restart ──
echo ""
echo "4. Testing Nginx configuration..."
if nginx -t 2>&1; then
    systemctl restart nginx
    echo "   Nginx restarted"
else
    echo "   ERROR: Nginx config test failed!"
    cp "${NGINX_CONF}.backup" "$NGINX_CONF"
    echo "   Original config restored"
    exit 1
fi

echo ""
echo "Done - Nginx installed and hardened"
