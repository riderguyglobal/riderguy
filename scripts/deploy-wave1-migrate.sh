#!/bin/bash
set -e
cd /var/www/riderguy/source

# Extract DATABASE_URL safely from .env (handles &, =, etc.)
export DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' .env | head -1)"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not extracted from .env"
  exit 1
fi

# Mask password for log
host_part="$(echo "$DATABASE_URL" | sed -E 's|.*@||' | cut -d/ -f1)"
echo "→ Migrating against host: $host_part"

/var/www/riderguy/source/node_modules/.bin/prisma migrate deploy \
  --schema=packages/database/prisma/schema.prisma
