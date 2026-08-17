#!/bin/bash
# Wave 2 deploy — assumes source files already SCP'd.
set -euo pipefail

BOLD='\033[1m'; GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}>>${NC} ${BOLD}$1${NC}"; }

cd /var/www/riderguy/source

log "[1/8] Loading env"
# .env may contain non-ASCII chars in comments — extract specific keys explicitly
export DATABASE_URL=$(sed -n 's/^DATABASE_URL=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_API_URL=$(sed -n 's/^NEXT_PUBLIC_API_URL=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$(sed -n 's/^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_API_KEY=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_API_KEY=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_PROJECT_ID=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_APP_ID=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_APP_ID=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_VAPID_KEY=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_VAPID_KEY=//p' .env | head -1 | tr -d '"' | tr -d "'")
test -n "${DATABASE_URL:-}" || { echo "DATABASE_URL not set"; exit 1; }

log "[2/8] Generating Prisma client"
npx prisma generate --schema=packages/database/prisma/schema.prisma | tail -3

log "[3/8] Running pending migrations"
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma | tail -10

log "[4/8] Rebuilding shared packages"
npx turbo run build --filter='@riderguy/auth' --filter='@riderguy/database' --filter='@riderguy/utils' --filter='@riderguy/config' --filter='@riderguy/types' --filter='@riderguy/validators' 2>&1 | tail -10

log "[5/8] Building API"
cd /var/www/riderguy/source/apps/api
npx tsc --project tsconfig.json 2>&1 | tail -10
chown -R deploy:deploy /var/www/riderguy/source/apps/api/dist

log "[6/8] Reloading riderguy-api"
sudo -u deploy -H bash -lc "cd /var/www/riderguy && pm2 reload riderguy-api --update-env" | tail -5

log "[6.5/8] /health check"
sleep 2
curl -sf http://127.0.0.1:4000/health && echo "" || { echo "API HEALTH FAILED"; exit 1; }

log "[7/8] Building rider PWA"
cd /var/www/riderguy/source/apps/rider
npx next build 2>&1 | tail -8
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/rider/.next/static
  cp -r public .next/standalone/apps/rider/public
  chown -R deploy:deploy .next
fi

log "[7b/8] Building client PWA"
cd /var/www/riderguy/source/apps/client
npx next build 2>&1 | tail -8
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/client/.next/static
  cp -r public .next/standalone/apps/client/public
  chown -R deploy:deploy .next
fi

log "[8/8] Reloading riderguy-rider + riderguy-client"
sudo -u deploy -H bash -lc "cd /var/www/riderguy && pm2 reload riderguy-rider --update-env && pm2 reload riderguy-client --update-env" | tail -10

log "DONE"
sudo -u deploy -H bash -lc "pm2 status" | tail -15
