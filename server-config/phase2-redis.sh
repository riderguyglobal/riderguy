#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  Phase 2.5 - Install & Configure Redis 7"
echo "============================================"

# ── 1. Install Redis ──
echo ""
echo "1. Installing Redis 7..."

if dpkg -l | grep -q redis-server; then
    echo "   Redis is already installed"
else
    # Add official Redis repository for latest 7.x
    apt install -y lsb-release curl gpg
    curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg 2>/dev/null
    echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" > /etc/apt/sources.list.d/redis.list
    apt update
    apt install -y redis-server
fi

redis-server --version

# ── 2. Configure Redis ──
echo ""
echo "2. Configuring Redis..."

REDIS_CONF="/etc/redis/redis.conf"
cp "$REDIS_CONF" "${REDIS_CONF}.backup"

# Generate a strong password for Redis
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

# Apply configuration changes using sed
# Bind to localhost only
sed -i 's/^bind .*/bind 127.0.0.1 ::1/' "$REDIS_CONF"

# Set password
if grep -q "^# requirepass" "$REDIS_CONF"; then
    sed -i "s/^# requirepass .*/requirepass ${REDIS_PASSWORD}/" "$REDIS_CONF"
elif grep -q "^requirepass" "$REDIS_CONF"; then
    sed -i "s/^requirepass .*/requirepass ${REDIS_PASSWORD}/" "$REDIS_CONF"
else
    echo "requirepass ${REDIS_PASSWORD}" >> "$REDIS_CONF"
fi

# Memory configuration
# 512MB for Redis cache - enough for sessions, BullMQ queues, Socket.IO adapter
if grep -q "^# maxmemory " "$REDIS_CONF"; then
    sed -i 's/^# maxmemory .*/maxmemory 512mb/' "$REDIS_CONF"
elif grep -q "^maxmemory " "$REDIS_CONF"; then
    sed -i 's/^maxmemory .*/maxmemory 512mb/' "$REDIS_CONF"
else
    echo "maxmemory 512mb" >> "$REDIS_CONF"
fi

# Eviction policy - allkeys-lru (evict least recently used when full)
if grep -q "^# maxmemory-policy" "$REDIS_CONF"; then
    sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' "$REDIS_CONF"
elif grep -q "^maxmemory-policy" "$REDIS_CONF"; then
    sed -i 's/^maxmemory-policy .*/maxmemory-policy allkeys-lru/' "$REDIS_CONF"
else
    echo "maxmemory-policy allkeys-lru" >> "$REDIS_CONF"
fi

# Disable dangerous commands in production
if ! grep -q "^rename-command FLUSHDB" "$REDIS_CONF"; then
    cat >> "$REDIS_CONF" <<'REDISEXTRA'

# ── RiderGuy Security ──
# Disable dangerous commands (rename to empty string = disabled)
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG ""

# ── RiderGuy Performance ──
# Reduce latency of writes at cost of durability
# (Redis is used as cache + queue, PostgreSQL is the source of truth)
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes

# TCP keepalive
tcp-keepalive 300

# Log level
loglevel notice
logfile /var/www/riderguy/logs/redis.log

# Slow log
slowlog-log-slower-than 10000
slowlog-max-len 128
REDISEXTRA
fi

# Set supervised to systemd
sed -i 's/^supervised .*/supervised systemd/' "$REDIS_CONF" || \
    sed -i 's/^# supervised .*/supervised systemd/' "$REDIS_CONF"

echo "   Configuration applied"

# ── 3. Create log file with correct ownership ──
touch /var/www/riderguy/logs/redis.log
chown redis:redis /var/www/riderguy/logs/redis.log
chmod 640 /var/www/riderguy/logs/redis.log

# ── 4. Enable and restart ──
echo ""
echo "3. Restarting Redis..."
systemctl enable redis-server
systemctl restart redis-server
sleep 2

if systemctl is-active redis-server | grep -q active; then
    echo "   Redis is running"
else
    echo "   ERROR: Redis failed to start!"
    journalctl -u redis-server --no-pager -n 20
    exit 1
fi

# ── 5. Verify ──
echo ""
echo "4. Verifying Redis..."

echo "--- Server Info ---"
redis-cli -a "$REDIS_PASSWORD" --no-auth-warning INFO server | grep -E "redis_version|tcp_port|uptime|executable"

echo ""
echo "--- Memory ---"
redis-cli -a "$REDIS_PASSWORD" --no-auth-warning INFO memory | grep -E "maxmemory|used_memory_human"

echo ""
echo "--- PING Test ---"
PONG=$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning PING)
echo "   $PONG"

echo ""
echo "--- Auth Required Test ---"
NOAUTH=$(redis-cli PING 2>&1 || true)
if echo "$NOAUTH" | grep -qi "NOAUTH\|Authentication"; then
    echo "   Auth correctly required (unauthenticated access denied)"
else
    echo "   WARNING: Auth may not be enforced!"
fi

echo ""
echo "--- SET/GET Test ---"
redis-cli -a "$REDIS_PASSWORD" --no-auth-warning SET riderguy:test "phase2-ok" EX 60 > /dev/null
RESULT=$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning GET riderguy:test)
echo "   SET/GET: $RESULT"
redis-cli -a "$REDIS_PASSWORD" --no-auth-warning DEL riderguy:test > /dev/null

echo ""
echo "============================================"
echo "  REDIS CREDENTIALS (SAVE THESE!)"
echo "============================================"
echo "  Host:     127.0.0.1"
echo "  Port:     6379"
echo "  Password: ${REDIS_PASSWORD}"
echo ""
echo "  REDIS_URL=redis://:${REDIS_PASSWORD}@127.0.0.1:6379"
echo "============================================"
echo ""
echo "✓ Redis 7 installed and secured"
