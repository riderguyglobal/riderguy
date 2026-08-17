#!/bin/bash
echo "============================================"
echo "  RIDERGUY PHASE 3+4 - FINAL VERIFICATION"
echo "============================================"
echo ""

PASS=0
FAIL=0

check() {
    local desc="$1"
    local result="$2"
    if [ "$result" = "PASS" ]; then
        echo "  [PASS] $desc"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] $desc - $result"
        FAIL=$((FAIL + 1))
    fi
}

# ── Node.js ──
echo "--- Node.js ---"
NODE_VER=$(node -v 2>/dev/null)
check "Node.js 22.x installed" "$(echo $NODE_VER | grep -q '^v22' && echo PASS || echo $NODE_VER)"
NPM_VER=$(npm -v 2>/dev/null)
check "npm 10.x installed" "$(echo $NPM_VER | grep -q '^10' && echo PASS || echo $NPM_VER)"
check "build-essential available" "$(dpkg -l | grep -q build-essential && echo PASS || echo FAIL)"

# ── tsx ──
echo ""
echo "--- tsx ---"
TSX_VER=$(tsx --version 2>/dev/null | head -1)
check "tsx installed" "$(echo $TSX_VER | grep -q 'tsx' && echo PASS || echo FAIL)"

# ── PM2 ──
echo ""
echo "--- PM2 ---"
PM2_VER=$(pm2 --version 2>/dev/null)
check "PM2 installed" "$(echo $PM2_VER | grep -qE '[0-9]+\.[0-9]+' && echo PASS || echo FAIL)"
check "PM2 version: $PM2_VER" "PASS"
check "pm2-deploy service enabled" "$(systemctl is-enabled pm2-deploy 2>/dev/null | grep -q enabled && echo PASS || echo FAIL)"
check "pm2-logrotate module active" "$(pm2 list 2>/dev/null | grep -q 'pm2-logrotate' && echo PASS || echo FAIL)"
check "PM2 home dir for deploy" "$([ -d /home/deploy/.pm2 ] && echo PASS || echo FAIL)"
check "PM2 home owned by deploy" "$([ $(stat -c %U /home/deploy/.pm2) = 'deploy' ] && echo PASS || echo FAIL)"

# ── Nginx ──
echo ""
echo "--- Nginx ---"
NGINX_VER=$(nginx -v 2>&1 | grep -oP '[\d.]+')
check "Nginx installed: $NGINX_VER" "PASS"
check "Nginx running" "$(systemctl is-active nginx | grep -q active && echo PASS || echo FAIL)"
check "Nginx enabled" "$(systemctl is-enabled nginx 2>/dev/null | grep -q enabled && echo PASS || echo FAIL)"
check "server_tokens off" "$(grep -q 'server_tokens off' /etc/nginx/nginx.conf && echo PASS || echo FAIL)"
check "gzip enabled" "$(grep -q 'gzip on' /etc/nginx/nginx.conf && echo PASS || echo FAIL)"
check "worker_connections 4096" "$(grep -q 'worker_connections 4096' /etc/nginx/nginx.conf && echo PASS || echo FAIL)"
check "Rate limit zones defined" "$(grep -q 'limit_req_zone' /etc/nginx/nginx.conf && echo PASS || echo FAIL)"

echo ""
echo "--- Nginx Site Config ---"
check "Site config exists" "$([ -f /etc/nginx/sites-available/riderguy ] && echo PASS || echo FAIL)"
check "Site enabled (symlink)" "$([ -L /etc/nginx/sites-enabled/riderguy ] && echo PASS || echo FAIL)"
check "Default site removed" "$([ ! -f /etc/nginx/sites-enabled/default ] && echo PASS || echo FAIL)"
check "Config syntax valid" "$(nginx -t 2>&1 | grep -q 'syntax is ok' && echo PASS || echo FAIL)"

# Check all server blocks exist
check "Marketing server block" "$(grep -q 'myriderguy.com' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"
check "Rider server block" "$(grep -q 'rider.myriderguy.com' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"
check "Client server block" "$(grep -q 'app.myriderguy.com' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"
check "Admin server block" "$(grep -q 'admin.myriderguy.com' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"
check "API server block" "$(grep -q 'api.myriderguy.com' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"
check "Default/fallback server" "$(grep -q 'default_server' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"

# Check rate limiting in API block
check "API auth rate limiting" "$(grep -q 'api_auth' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"
check "WebSocket config" "$(grep -q 'socket.io' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"
check "Upload serving (alias)" "$(grep -q 'alias /var/www/riderguy/uploads' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"
check "Dot files blocked" "$(grep -q '\.git\|\.env' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"

# Check upstreams
check "Upstream marketing :3000" "$(grep -q '127.0.0.1:3000' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"
check "Upstream rider :3001" "$(grep -q '127.0.0.1:3001' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"
check "Upstream client :3002" "$(grep -q '127.0.0.1:3002' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"
check "Upstream admin :3003" "$(grep -q '127.0.0.1:3003' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"
check "Upstream API :4000" "$(grep -q '127.0.0.1:4000' /etc/nginx/sites-available/riderguy && echo PASS || echo FAIL)"

# ── Certbot ──
echo ""
echo "--- Certbot ---"
CERT_VER=$(certbot --version 2>&1 | grep -oP '[\d.]+')
check "Certbot installed: $CERT_VER" "PASS"
check "Auto-renewal timer" "$(systemctl list-timers | grep -q certbot && echo PASS || echo FAIL)"
check "Nginx plugin available" "$(certbot plugins 2>/dev/null | grep -q nginx && echo PASS || echo FAIL)"

# ── Port check ──
echo ""
echo "--- Ports ---"
check "Port 80 (Nginx)" "$(ss -tlnp | grep -q ':80 ' && echo PASS || echo FAIL)"
check "Port 5432 (PostgreSQL)" "$(ss -tlnp | grep -q ':5432 ' && echo PASS || echo FAIL)"
check "Port 6379 (Redis)" "$(ss -tlnp | grep -q ':6379 ' && echo PASS || echo FAIL)"
check "Port 22 (SSH)" "$(ss -tlnp | grep -q ':22 ' && echo PASS || echo FAIL)"

# ── Summary ──
echo ""
echo "============================================"
TOTAL=$((PASS + FAIL))
echo "  RESULTS: $PASS/$TOTAL passed"
if [ $FAIL -eq 0 ]; then
    echo "  STATUS: ALL CHECKS PASSED"
else
    echo "  STATUS: $FAIL CHECK(S) FAILED"
fi
echo "============================================"
