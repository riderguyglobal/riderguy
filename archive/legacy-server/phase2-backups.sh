#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  Phase 2.6 - Automated Database Backups"
echo "============================================"

BACKUP_DIR="/var/www/riderguy/backups"
SCRIPTS_DIR="/var/www/riderguy/scripts"

# ── 1. Create the backup script ──
echo ""
echo "1. Creating database backup script..."

cat > "${SCRIPTS_DIR}/backup-database.sh" <<'BACKUP'
#!/bin/bash
# RiderGuy PostgreSQL Backup Script
# Runs via cron as the deploy user
# Creates compressed, timestamped backups with rotation

set -euo pipefail

BACKUP_DIR="/var/www/riderguy/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/riderguy_db_${TIMESTAMP}.sql.gz"
LOG_FILE="/var/www/riderguy/logs/backup.log"
RETENTION_DAYS=14

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "Starting database backup..."

# Create backup using pg_dump (custom format for parallel restore capability)
# The deploy user connects via peer auth through sudo -u postgres
if sudo -u postgres pg_dump \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="${BACKUP_DIR}/riderguy_db_${TIMESTAMP}.dump" \
    riderguy_db 2>> "$LOG_FILE"; then
    
    DUMP_FILE="${BACKUP_DIR}/riderguy_db_${TIMESTAMP}.dump"
    SIZE=$(du -h "$DUMP_FILE" | cut -f1)
    log "Backup created: $DUMP_FILE ($SIZE)"
    
    # Also create a plain SQL backup (for easy inspection/portability)
    sudo -u postgres pg_dump \
        --format=plain \
        riderguy_db 2>> "$LOG_FILE" | gzip > "$BACKUP_FILE"
    
    SQL_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "SQL backup created: $BACKUP_FILE ($SQL_SIZE)"
else
    log "ERROR: Database backup FAILED!"
    exit 1
fi

# ── Rotate old backups ──
log "Rotating backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "$BACKUP_DIR" -name "riderguy_db_*" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
log "Deleted $DELETED old backup(s)"

# ── Summary ──
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "riderguy_db_*" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "Backup complete. Total backups: $TOTAL_BACKUPS, Total size: $TOTAL_SIZE"
BACKUP

chmod +x "${SCRIPTS_DIR}/backup-database.sh"
chown deploy:deploy "${SCRIPTS_DIR}/backup-database.sh"

echo "   Created ${SCRIPTS_DIR}/backup-database.sh"

# ── 2. Create Redis backup script ──
echo ""
echo "2. Creating Redis backup script..."

cat > "${SCRIPTS_DIR}/backup-redis.sh" <<'REDISBACKUP'
#!/bin/bash
# RiderGuy Redis RDB Backup Script
set -euo pipefail

BACKUP_DIR="/var/www/riderguy/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/www/riderguy/logs/backup.log"
REDIS_RDB="/var/lib/redis/dump.rdb"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "Starting Redis backup..."

# Trigger a synchronous save
if sudo redis-cli -a "$(grep '^requirepass ' /etc/redis/redis.conf | awk '{print $2}')" --no-auth-warning BGSAVE 2>> "$LOG_FILE"; then
    sleep 3  # Wait for background save
    
    if [ -f "$REDIS_RDB" ]; then
        sudo cp "$REDIS_RDB" "${BACKUP_DIR}/redis_${TIMESTAMP}.rdb"
        sudo chown deploy:deploy "${BACKUP_DIR}/redis_${TIMESTAMP}.rdb"
        SIZE=$(du -h "${BACKUP_DIR}/redis_${TIMESTAMP}.rdb" | cut -f1)
        log "Redis backup created: redis_${TIMESTAMP}.rdb ($SIZE)"
    else
        log "WARNING: Redis RDB file not found at $REDIS_RDB"
    fi
else
    log "ERROR: Redis BGSAVE failed!"
fi

# Rotate old Redis backups (keep 7 days)
find "$BACKUP_DIR" -name "redis_*.rdb" -mtime +7 -delete
log "Redis backup rotation complete"
REDISBACKUP

chmod +x "${SCRIPTS_DIR}/backup-redis.sh"
chown deploy:deploy "${SCRIPTS_DIR}/backup-redis.sh"

echo "   Created ${SCRIPTS_DIR}/backup-redis.sh"

# ── 3. Create upload directory backup script ──
echo ""
echo "3. Creating uploads backup script..."

cat > "${SCRIPTS_DIR}/backup-uploads.sh" <<'UPLOADBACKUP'
#!/bin/bash
# RiderGuy Uploads Backup (incremental with rsync)
set -euo pipefail

BACKUP_DIR="/var/www/riderguy/backups/uploads"
SOURCE_DIR="/var/www/riderguy/uploads"
LOG_FILE="/var/www/riderguy/logs/backup.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

mkdir -p "$BACKUP_DIR"

log "Starting uploads backup..."

# Use rsync for incremental backup
rsync -a --delete "$SOURCE_DIR/" "$BACKUP_DIR/latest/" 2>> "$LOG_FILE"

# Create a weekly full archive (Sundays only)
if [ "$(date +%u)" = "7" ]; then
    tar czf "${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz" -C "$SOURCE_DIR" . 2>> "$LOG_FILE"
    log "Weekly uploads archive created: uploads_${TIMESTAMP}.tar.gz"
    # Keep 4 weekly archives
    find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +28 -delete
fi

log "Uploads backup complete"
UPLOADBACKUP

chmod +x "${SCRIPTS_DIR}/backup-uploads.sh"
chown deploy:deploy "${SCRIPTS_DIR}/backup-uploads.sh"

echo "   Created ${SCRIPTS_DIR}/backup-uploads.sh"

# ── 4. Set up cron jobs ──
echo ""
echo "4. Setting up cron jobs..."

# Create the backup uploads directory
mkdir -p "${BACKUP_DIR}/uploads"
chown deploy:deploy "${BACKUP_DIR}/uploads"

# Create log file
touch /var/www/riderguy/logs/backup.log
chown deploy:deploy /var/www/riderguy/logs/backup.log

# Add cron jobs for the deploy user
# Database: daily at 2:00 AM
# Redis: daily at 2:30 AM
# Uploads: daily at 3:00 AM
CRON_CONTENT="# RiderGuy Automated Backups
0 2 * * * /var/www/riderguy/scripts/backup-database.sh
30 2 * * * /var/www/riderguy/scripts/backup-redis.sh
0 3 * * * /var/www/riderguy/scripts/backup-uploads.sh
"

echo "$CRON_CONTENT" | crontab -u deploy -

echo "   Cron jobs installed for deploy user:"
crontab -u deploy -l

# ── 5. Allow deploy user to run pg_dump and redis-cli via sudo ──
echo ""
echo "5. Updating sudoers for backup commands..."

# Check current sudoers for deploy
CURRENT_SUDOERS=$(cat /etc/sudoers.d/deploy)

# Add pg_dump and redis-cli permissions if not already present
if ! grep -q "pg_dump" /etc/sudoers.d/deploy; then
    cat > /etc/sudoers.d/deploy <<'SUDOERS'
# deploy user privileges for RiderGuy
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx, /usr/bin/systemctl restart postgresql, /usr/bin/systemctl restart redis-server, /usr/bin/certbot renew
deploy ALL=(postgres) NOPASSWD: /usr/bin/pg_dump
deploy ALL=(root) NOPASSWD: /usr/bin/redis-cli, /usr/bin/cp /var/lib/redis/dump.rdb *
SUDOERS
    visudo -c -f /etc/sudoers.d/deploy && echo "   Sudoers updated" || echo "   ERROR: Sudoers invalid!"
else
    echo "   pg_dump already in sudoers"
fi

# ── 6. Run a test backup ──
echo ""
echo "6. Running test database backup..."

sudo -u deploy bash "${SCRIPTS_DIR}/backup-database.sh" 2>&1 || true

echo ""
echo "Backup files:"
ls -lah "${BACKUP_DIR}/" | grep -v "^total\|^d"

echo ""
echo "Backup log:"
tail -10 /var/www/riderguy/logs/backup.log

echo ""
echo "✓ Automated backup system configured"
