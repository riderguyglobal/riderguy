#!/bin/bash
# Wave 3 deploy — same shape as wave 2: env-extract → migrate → build shared
# packages → build API → reload → build rider+client PWAs (standalone copy)
# → reload. Assumes touched source files already SCP'd to /var/www/riderguy/source.
set -euo pipefail

BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}>>${NC} ${BOLD}$1${NC}"; }
warn() { echo -e "${YELLOW}!!${NC} ${BOLD}$1${NC}"; }

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
test -n "${DATABASE_URL:-}" || { echo "DATABASE_URL not set"; exit 1; }

log "[2/9] Generating Prisma client (picks up receiptEmailSentAt)"
npx prisma generate --schema=packages/database/prisma/schema.prisma | tail -3

log "[3/9] Running pending migrations (20260427140000_receipt_email_sent_at)"
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma | tail -10

log "[3.5/9] Verifying receiptEmailSentAt column exists"
psql "$DATABASE_URL" -c '\d orders' | grep -i receiptEmailSentAt || { warn "receiptEmailSentAt missing from orders!"; exit 1; }

log "[4/9] Rebuilding shared packages (types/validators/auth/database)"
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

log "[6/9] Reloading riderguy-api (cluster x2)"
sudo -u deploy -H bash -lc "cd /var/www/riderguy && pm2 reload riderguy-api --update-env" | tail -5

log "[6.5/9] /health check"
sleep 2
curl -sf http://127.0.0.1:4000/health && echo "" || { echo "API HEALTH FAILED"; exit 1; }

log "[7/9] Building rider PWA (standalone)"
cd /var/www/riderguy/source/apps/rider
npx next build 2>&1 | tail -8
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/rider/.next/static
  cp -r public .next/standalone/apps/rider/public
  chown -R deploy:deploy .next
fi

log "[7b/9] Building client PWA (standalone)"
cd /var/www/riderguy/source/apps/client
npx next build 2>&1 | tail -8
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/client/.next/static
  cp -r public .next/standalone/apps/client/public
  chown -R deploy:deploy .next
fi

log "[8/9] Reloading riderguy-rider + riderguy-client"
sudo -u deploy -H bash -lc "cd /var/www/riderguy && pm2 reload riderguy-rider --update-env && pm2 reload riderguy-client --update-env" | tail -10

log "[9/9] Smoke checks"
sleep 3
curl -sf -o /dev/null -w "API /health: %{http_code}\n" http://127.0.0.1:4000/health
curl -sf -o /dev/null -w "rider /:    %{http_code}\n" http://127.0.0.1:3001/ || true
curl -sf -o /dev/null -w "client /:   %{http_code}\n" http://127.0.0.1:3002/ || true

log "DONE — Wave 3"
sudo -u deploy -H bash -lc "pm2 status" | tail -15
