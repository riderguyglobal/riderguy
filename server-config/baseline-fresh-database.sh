#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIR="${RIDERGUY_SOURCE_DIR:-/var/www/riderguy/source}"
ENV_FILE="${RIDERGUY_ENV_FILE:-/var/www/riderguy/shared/.env.production}"
SCHEMA_FILE="$SOURCE_DIR/packages/database/prisma/schema.prisma"
MIGRATIONS_DIR="$SOURCE_DIR/packages/database/prisma/migrations"

if [ "${RIDERGUY_CONFIRM_EMPTY_DATABASE:-}" != 'YES' ]; then
  echo 'Set RIDERGUY_CONFIRM_EMPTY_DATABASE=YES for a deliberately empty replacement database.' >&2
  exit 1
fi

[ -f "$ENV_FILE" ] || { echo "Missing environment file: $ENV_FILE" >&2; exit 1; }
[ -f "$SCHEMA_FILE" ] || { echo "Missing Prisma schema: $SCHEMA_FILE" >&2; exit 1; }

cd "$SOURCE_DIR"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo '[baseline] creating the current schema in the empty database'
npx prisma db push --schema="$SCHEMA_FILE" --skip-generate

echo '[baseline] recording repository migrations as the initial production baseline'
for migration_dir in "$MIGRATIONS_DIR"/*; do
  [ -d "$migration_dir" ] || continue
  npx prisma migrate resolve --schema="$SCHEMA_FILE" --applied "$(basename "$migration_dir")"
done

npx prisma migrate status --schema="$SCHEMA_FILE"
echo '[baseline] fresh database baseline completed'
