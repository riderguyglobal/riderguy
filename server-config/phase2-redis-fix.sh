#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  Phase 2.5 - Fix Redis Configuration"
echo "============================================"

REDIS_CONF="/etc/redis/redis.conf"

# Restore from backup
cp "${REDIS_CONF}.backup" "$REDIS_CONF"
echo "Restored original config from backup"

# Generate password
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

# ── Apply changes using sed ──

# Bind to localhost only
sed -i 's/^bind .*/bind 127.0.0.1 ::1/' "$REDIS_CONF"

# Set password (handle both commented and uncommented)
sed -i "s/^# requirepass foobared/requirepass ${REDIS_PASSWORD}/" "$REDIS_CONF"
sed -i "s/^requirepass .*/requirepass ${REDIS_PASSWORD}/" "$REDIS_CONF"

# Memory limit
sed -i "s/^# maxmemory <bytes>/maxmemory 512mb/" "$REDIS_CONF"

# Eviction policy
sed -i "s/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/" "$REDIS_CONF"

# Use allowed log path (systemd sandbox allows /var/log/redis/)
sed -i 's|^logfile .*|logfile /var/log/redis/redis-server.log|' "$REDIS_CONF"

# TCP keepalive
sed -i 's/^tcp-keepalive .*/tcp-keepalive 300/' "$REDIS_CONF"

# Append extra production settings
cat >> "$REDIS_CONF" <<'EOF'

# ── RiderGuy Production Config ──
supervised systemd

# Slow log
slowlog-log-slower-than 10000
slowlog-max-len 128

# Persistence (RDB snapshots)
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
EOF

# Create log dir
mkdir -p /var/log/redis
chown redis:redis /var/log/redis

# Verify password is set
if grep -q "^requirepass ${REDIS_PASSWORD}" "$REDIS_CONF"; then
    echo "Password configured: YES"
else
    echo "WARNING: Password not in config, adding manually"
    echo "requirepass ${REDIS_PASSWORD}" >> "$REDIS_CONF"
fi

# Verify maxmemory
echo "maxmemory: $(grep '^maxmemory ' "$REDIS_CONF" | head -1)"
echo "maxmemory-policy: $(grep '^maxmemory-policy ' "$REDIS_CONF" | head -1)"
echo "bind: $(grep '^bind ' "$REDIS_CONF" | head -1)"
echo "logfile: $(grep '^logfile ' "$REDIS_CONF" | head -1)"

# Restart
echo ""
echo "Restarting Redis..."
systemctl daemon-reload
systemctl restart redis-server
sleep 2

if systemctl is-active redis-server | grep -q active; then
    echo "Redis is RUNNING"
    echo ""
    
    # Server info
    echo "--- Server ---"
    redis-cli -a "$REDIS_PASSWORD" --no-auth-warning INFO server 2>/dev/null | grep -E "redis_version|tcp_port|uptime_in_seconds"
    
    # Memory info
    echo ""
    echo "--- Memory ---"
    redis-cli -a "$REDIS_PASSWORD" --no-auth-warning INFO memory 2>/dev/null | grep -E "maxmemory_human|used_memory_human"
    
    # Ping
    echo ""
    echo "--- Ping ---"
    redis-cli -a "$REDIS_PASSWORD" --no-auth-warning PING
    
    # Auth test (should fail without password)
    echo ""
    echo "--- Auth Required Test ---"
    NOAUTH_RESULT=$(redis-cli PING 2>&1 || true)
    if echo "$NOAUTH_RESULT" | grep -qi "NOAUTH\|ERR\|Authentication"; then
        echo "Unauthenticated access correctly DENIED"
    else
        echo "WARNING: No auth required - check config!"
    fi
    
    # SET/GET test
    echo ""
    echo "--- SET/GET Test ---"
    redis-cli -a "$REDIS_PASSWORD" --no-auth-warning SET riderguy:test "phase2-ok" EX 60 2>/dev/null
    RESULT=$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning GET riderguy:test 2>/dev/null)
    echo "Result: $RESULT"
    redis-cli -a "$REDIS_PASSWORD" --no-auth-warning DEL riderguy:test 2>/dev/null > /dev/null
    
    echo ""
    echo "============================================"
    echo "  REDIS CREDENTIALS"
    echo "============================================"
    echo "  Host:     127.0.0.1"
    echo "  Port:     6379"
    echo "  Password: ${REDIS_PASSWORD}"
    echo ""
    echo "  REDIS_URL=redis://:${REDIS_PASSWORD}@127.0.0.1:6379"
    echo "============================================"
    echo ""
    echo "Done - Redis configured successfully"
else
    echo "ERROR: Redis failed to start!"
    journalctl -u redis-server --no-pager -n 20
    exit 1
fi
