#!/bin/bash
echo "============================================"
echo "  RIDERGUY PHASE 2 - FINAL VERIFICATION"
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

# ── PostgreSQL ──
echo "--- PostgreSQL ---"
PG_VER=$(psql --version 2>/dev/null | grep -oP '\d+\.\d+')
check "PostgreSQL 16.x installed" "$(echo $PG_VER | grep -q '^16' && echo PASS || echo $PG_VER)"
check "PostgreSQL running" "$(systemctl is-active postgresql | grep -q active && echo PASS || echo FAIL)"
check "Listening on 127.0.0.1:5432" "$(ss -tlnp | grep -q '127.0.0.1:5432' && echo PASS || echo FAIL)"
check "NOT listening on 0.0.0.0" "$(ss -tlnp | grep '0.0.0.0:5432' >/dev/null 2>&1 && echo 'EXPOSED!' || echo PASS)"

echo ""
echo "--- PostgreSQL Tuning ---"
check "shared_buffers = 4GB" "$(sudo -u postgres psql -tAc "SHOW shared_buffers;" | grep -q '4GB' && echo PASS || echo FAIL)"
check "effective_cache_size = 12GB" "$(sudo -u postgres psql -tAc "SHOW effective_cache_size;" | grep -q '12GB' && echo PASS || echo FAIL)"
check "work_mem = 32MB" "$(sudo -u postgres psql -tAc "SHOW work_mem;" | grep -q '32MB' && echo PASS || echo FAIL)"
check "maintenance_work_mem = 1GB" "$(sudo -u postgres psql -tAc "SHOW maintenance_work_mem;" | grep -q '1GB' && echo PASS || echo FAIL)"
check "max_connections = 200" "$(sudo -u postgres psql -tAc "SHOW max_connections;" | grep -q '200' && echo PASS || echo FAIL)"
check "random_page_cost = 1.1" "$(sudo -u postgres psql -tAc "SHOW random_page_cost;" | grep -q '1.1' && echo PASS || echo FAIL)"
check "effective_io_concurrency = 200" "$(sudo -u postgres psql -tAc "SHOW effective_io_concurrency;" | grep -q '200' && echo PASS || echo FAIL)"
check "max_worker_processes = 8" "$(sudo -u postgres psql -tAc "SHOW max_worker_processes;" | grep -q '8' && echo PASS || echo FAIL)"
check "log_min_duration = 500ms" "$(sudo -u postgres psql -tAc "SHOW log_min_duration_statement;" | grep -q '500' && echo PASS || echo FAIL)"

echo ""
echo "--- PostgreSQL Security ---"
check "SSL enabled" "$(sudo -u postgres psql -tAc "SHOW ssl;" | grep -q 'on' && echo PASS || echo FAIL)"
check "SSL min TLS 1.2" "$(sudo -u postgres psql -tAc "SHOW ssl_min_protocol_version;" | grep -q 'TLSv1.2' && echo PASS || echo FAIL)"
check "password_encryption = scram-sha-256" "$(sudo -u postgres psql -tAc "SHOW password_encryption;" | grep -q 'scram-sha-256' && echo PASS || echo FAIL)"

echo ""
echo "--- Database ---"
check "riderguy_db exists" "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='riderguy_db';" | grep -q '1' && echo PASS || echo FAIL)"
check "riderguy user exists" "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='riderguy';" | grep -q '1' && echo PASS || echo FAIL)"
check "uuid-ossp extension" "$(sudo -u postgres psql -d riderguy_db -tAc "SELECT 1 FROM pg_extension WHERE extname='uuid-ossp';" | grep -q '1' && echo PASS || echo FAIL)"
check "pgcrypto extension" "$(sudo -u postgres psql -d riderguy_db -tAc "SELECT 1 FROM pg_extension WHERE extname='pgcrypto';" | grep -q '1' && echo PASS || echo FAIL)"
check "pg_trgm extension" "$(sudo -u postgres psql -d riderguy_db -tAc "SELECT 1 FROM pg_extension WHERE extname='pg_trgm';" | grep -q '1' && echo PASS || echo FAIL)"
check "riderguy can connect" "$(PGPASSWORD='emAYIu7ZBQty+jZaJ8vCKSoIFgjVyqp4' psql -h 127.0.0.1 -U riderguy -d riderguy_db -tAc 'SELECT 1;' 2>/dev/null | grep -q '1' && echo PASS || echo FAIL)"

echo ""
echo "--- PostgreSQL Logging ---"
check "Log directory exists" "$([ -d /var/www/riderguy/logs/postgresql ] && echo PASS || echo FAIL)"
check "Owned by postgres" "$([ $(stat -c %U /var/www/riderguy/logs/postgresql) = 'postgres' ] && echo PASS || echo FAIL)"

# ── Redis ──
echo ""
echo "--- Redis ---"
REDIS_VER=$(redis-server --version 2>/dev/null | grep -oP 'v=\K[0-9.]+')
check "Redis 8.x installed" "$(echo $REDIS_VER | grep -q '^8' && echo PASS || echo $REDIS_VER)"
check "Redis running" "$(systemctl is-active redis-server | grep -q active && echo PASS || echo FAIL)"
check "Listening on 127.0.0.1:6379" "$(ss -tlnp | grep -q '127.0.0.1:6379' && echo PASS || echo FAIL)"
check "NOT listening on 0.0.0.0" "$(ss -tlnp | grep '0.0.0.0:6379' >/dev/null 2>&1 && echo 'EXPOSED!' || echo PASS)"

REDIS_PASS=$(grep '^requirepass ' /etc/redis/redis.conf | awk '{print $2}')
check "Password auth required" "$([ -n "$REDIS_PASS" ] && echo PASS || echo FAIL)"
check "maxmemory = 512mb" "$(redis-cli -a "$REDIS_PASS" --no-auth-warning CONFIG GET maxmemory 2>/dev/null | grep -q '536870912' && echo PASS || echo FAIL)"
check "Eviction: allkeys-lru" "$(redis-cli -a "$REDIS_PASS" --no-auth-warning CONFIG GET maxmemory-policy 2>/dev/null | grep -q 'allkeys-lru' && echo PASS || echo FAIL)"
check "PING/PONG works" "$(redis-cli -a "$REDIS_PASS" --no-auth-warning PING 2>/dev/null | grep -q 'PONG' && echo PASS || echo FAIL)"

# ── Backups ──
echo ""
echo "--- Backups ---"
check "Backup script exists" "$([ -x /var/www/riderguy/scripts/backup-database.sh ] && echo PASS || echo FAIL)"
check "Redis backup script exists" "$([ -x /var/www/riderguy/scripts/backup-redis.sh ] && echo PASS || echo FAIL)"
check "Uploads backup script exists" "$([ -x /var/www/riderguy/scripts/backup-uploads.sh ] && echo PASS || echo FAIL)"
check "Cron jobs configured" "$(crontab -u deploy -l 2>/dev/null | grep -q 'backup-database' && echo PASS || echo FAIL)"
check "Test backup exists" "$(ls /var/www/riderguy/backups/riderguy_db_*.dump 2>/dev/null | head -1 | grep -q 'dump' && echo PASS || echo FAIL)"
check "Backup log exists" "$([ -f /var/www/riderguy/logs/backup.log ] && echo PASS || echo FAIL)"

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
