#!/usr/bin/env bash
set -Eeuo pipefail

ENV_FILE="${RIDERGUY_ENV_FILE:-/var/www/riderguy/shared/.env.production}"
BACKUP_ROOT="${RIDERGUY_BACKUP_DIR:-/var/www/riderguy/backups/postgresql}"
RETENTION_DAYS="${RIDERGUY_BACKUP_RETENTION_DAYS:-14}"

[ -f "$ENV_FILE" ] || { echo "Missing environment file: $ENV_FILE" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

[ -n "${DATABASE_URL:-}" ] || { echo 'DATABASE_URL is not configured' >&2; exit 1; }

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_ROOT/riderguy-$timestamp.dump"
partial_file="$backup_file.partial"
pg_dump_url="${DATABASE_URL%%\?*}"

trap 'rm -f "$partial_file"' EXIT
pg_dump --dbname="$pg_dump_url" --format=custom --compress=6 --no-owner --no-privileges \
  --file="$partial_file"
pg_restore --list "$partial_file" >/dev/null
chmod 600 "$partial_file"
mv "$partial_file" "$backup_file"
trap - EXIT

find "$BACKUP_ROOT" -type f -name 'riderguy-*.dump' -mtime "+$RETENTION_DAYS" -delete
echo "Verified database backup: $backup_file"
echo 'Copy this backup to encrypted off-server storage; local-only backups are insufficient.'
