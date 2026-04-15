#!/bin/bash
# ============================================================
# RiderGuy — PostgreSQL Backup Script
# Run via cron: 0 2 * * * /var/www/riderguy/source/server-config/backup-db.sh
# Keeps last 14 daily backups + weekly on Sundays for 8 weeks
# ============================================================

set -e

BACKUP_DIR="/var/www/riderguy/backups"
DB_NAME="riderguy_db"
DB_USER="riderguy"
DATE=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
BACKUP_FILE="${BACKUP_DIR}/daily/${DB_NAME}_${DATE}.sql.gz"

# Ensure directories exist
mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"

# ── Create compressed backup ──
echo "[$(date)] Starting PostgreSQL backup..."
pg_dump -U "${DB_USER}" -h 127.0.0.1 "${DB_NAME}" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --verbose 2>/dev/null | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── Weekly backup on Sundays ──
if [ "${DAY_OF_WEEK}" = "7" ]; then
  WEEKLY_FILE="${BACKUP_DIR}/weekly/${DB_NAME}_week_${DATE}.sql.gz"
  cp "${BACKUP_FILE}" "${WEEKLY_FILE}"
  echo "[$(date)] Weekly backup: ${WEEKLY_FILE}"
fi

# ── Prune old daily backups (keep 14 days) ──
find "${BACKUP_DIR}/daily" -name "*.sql.gz" -mtime +14 -delete
DAILY_COUNT=$(find "${BACKUP_DIR}/daily" -name "*.sql.gz" | wc -l)
echo "[$(date)] Daily backups retained: ${DAILY_COUNT}"

# ── Prune old weekly backups (keep 8 weeks) ──
find "${BACKUP_DIR}/weekly" -name "*.sql.gz" -mtime +56 -delete
WEEKLY_COUNT=$(find "${BACKUP_DIR}/weekly" -name "*.sql.gz" | wc -l)
echo "[$(date)] Weekly backups retained: ${WEEKLY_COUNT}"

# ── Verify backup integrity ──
if gzip -t "${BACKUP_FILE}" 2>/dev/null; then
  echo "[$(date)] Backup integrity verified: OK"
else
  echo "[$(date)] WARNING: Backup integrity check FAILED!"
  exit 1
fi

echo "[$(date)] Backup complete."
