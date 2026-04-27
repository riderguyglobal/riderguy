#!/bin/bash
# Wave 4 deploy — 13 low-severity polish items.
# Migration: 20260427150000_wallet_balance_check (CHECK balance >= 0)
set -euo pipefail

BOLD='\033[1m'; GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}>>${NC} ${BOLD}$1${NC}"; }

cd /var/www/riderguy/source

log "[1/9] Loading env"
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

log "[2/9] Generating Prisma client"
cd packages/database && npx prisma generate >/dev/null 2>&1 && cd /var/www/riderguy/source

log "[3/9] Running pending migrations (20260427150000_wallet_balance_check)"
cd packages/database && npx prisma migrate deploy && cd /var/www/riderguy/source

log "[3.5/9] Verifying wallets_balance_nonneg CHECK constraint"
sudo -u postgres psql riderguy_db -c "\d+ wallets" | grep -i wallets_balance_nonneg || { echo "MISSING wallets_balance_nonneg"; exit 1; }

log "[4/9] Rebuilding shared packages"
npx turbo run build \
  --filter='@riderguy/auth' \
  --filter='@riderguy/database' \
  --filter='@riderguy/utils' \
  --filter='@riderguy/config' \
  --filter='@riderguy/types' \
  --filter='@riderguy/validators' 2>&1 | tail -10

log "[5/9] Building API"
cd /var/www/riderguy/source/apps/api
npx tsc --project tsconfig.json 2>&1 | tail -10
chown -R deploy:deploy /var/www/riderguy/source/apps/api/dist

log "[6/9] Reloading riderguy-api"
sudo -u deploy -H bash -lc "cd /var/www/riderguy && pm2 reload riderguy-api --update-env" | tail -5

log "[6.5/9] /health check"
sleep 2
curl -sf http://127.0.0.1:4000/health && echo "" || { echo "API HEALTH FAILED"; exit 1; }

log "[7/9] Building rider PWA"
cd /var/www/riderguy/source/apps/rider
npx next build 2>&1 | tail -8
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/rider/.next/static
  cp -r public .next/standalone/apps/rider/public
  chown -R deploy:deploy .next
fi

log "[8/9] Building client PWA"
cd /var/www/riderguy/source/apps/client
npx next build 2>&1 | tail -8
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/client/.next/static
  cp -r public .next/standalone/apps/client/public
  chown -R deploy:deploy .next
fi

log "[9/9] Reloading rider + client + smoke check"
sudo -u deploy -H bash -lc "cd /var/www/riderguy && pm2 reload riderguy-rider --update-env && pm2 reload riderguy-client --update-env" | tail -10
sleep 3
curl -sf -o /dev/null -w "API:    %{http_code}\n" http://127.0.0.1:4000/health
curl -sf -o /dev/null -w "rider:  %{http_code}\n" http://127.0.0.1:3001/ || true
curl -sf -o /dev/null -w "client: %{http_code}\n" http://127.0.0.1:3002/ || true

log "DONE — Wave 4"
sudo -u deploy -H bash -lc "pm2 status" | tail -15
