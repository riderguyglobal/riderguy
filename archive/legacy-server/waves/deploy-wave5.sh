#!/bin/bash
# Wave 5 deploy — Auth audit fixes (AU-01 through AU-14).
# No DB migrations. No schema changes. Pure code deploy.
# Changed files:
#   packages/validators/src/auth.ts
#   packages/auth/src/auth-provider.tsx
#   packages/auth/src/token-storage.ts
#   packages/auth/src/auth-store.ts
#   apps/api/src/routes/auth/auth.routes.ts
#   apps/api/src/routes/auth/auth.controller.ts
#   apps/api/src/services/auth.service.ts
#   apps/api/src/middleware/auth.ts
#   apps/client/src/lib/constants.ts
#   apps/rider/src/app/chat/page.tsx
#   apps/admin/src/app/chat/page.tsx
set -euo pipefail

BOLD='\033[1m'; GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}>>${NC} ${BOLD}$1${NC}"; }

cd /var/www/riderguy/source

log "[1/11] Loading env"
export NEXT_PUBLIC_API_URL=$(sed -n 's/^NEXT_PUBLIC_API_URL=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$(sed -n 's/^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_API_KEY=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_API_KEY=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_PROJECT_ID=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_APP_ID=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_APP_ID=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_FIREBASE_VAPID_KEY=$(sed -n 's/^NEXT_PUBLIC_FIREBASE_VAPID_KEY=//p' .env | head -1 | tr -d '"' | tr -d "'")
export NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=$(sed -n 's/^NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=//p' .env | head -1 | tr -d '"' | tr -d "'")

log "[2/11] Rebuilding shared packages (validators, auth, types, utils, config, database)"
npx turbo run build \
  --filter='@riderguy/validators' \
  --filter='@riderguy/auth' \
  --filter='@riderguy/types' \
  --filter='@riderguy/utils' \
  --filter='@riderguy/config' \
  --filter='@riderguy/database' 2>&1 | tail -15

log "[3/11] Building API"
cd /var/www/riderguy/source/apps/api
npx tsc --project tsconfig.json 2>&1 | tail -10
chown -R deploy:deploy /var/www/riderguy/source/apps/api/dist

log "[4/11] Reloading riderguy-api"
sudo -u deploy -H bash -lc "cd /var/www/riderguy && pm2 reload riderguy-api --update-env" | tail -5

log "[5/11] API health check"
sleep 3
curl -sf http://127.0.0.1:4000/health && echo "" || { echo "API HEALTH FAILED — aborting"; exit 1; }

log "[6/11] Building client PWA"
cd /var/www/riderguy/source/apps/client
npx next build 2>&1 | tail -10
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/client/.next/static
  cp -r public .next/standalone/apps/client/public
  chown -R deploy:deploy .next
fi

log "[7/11] Building rider PWA"
cd /var/www/riderguy/source/apps/rider
npx next build 2>&1 | tail -10
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/rider/.next/static
  cp -r public .next/standalone/apps/rider/public
  chown -R deploy:deploy .next
fi

log "[8/11] Building admin PWA"
cd /var/www/riderguy/source/apps/admin
npx next build 2>&1 | tail -10
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/admin/.next/static
  cp -r public .next/standalone/apps/admin/public
  chown -R deploy:deploy .next
fi

log "[9/11] Reloading client + rider + admin"
sudo -u deploy -H bash -lc "cd /var/www/riderguy && pm2 reload riderguy-client --update-env && pm2 reload riderguy-rider --update-env && pm2 reload riderguy-admin --update-env" | tail -10

log "[10/11] Smoke checks"
sleep 3
curl -sf -o /dev/null -w "API:    %{http_code}\n" http://127.0.0.1:4000/health
curl -sf -o /dev/null -w "client: %{http_code}\n" http://127.0.0.1:3002/ || true
curl -sf -o /dev/null -w "rider:  %{http_code}\n" http://127.0.0.1:3001/ || true
curl -sf -o /dev/null -w "admin:  %{http_code}\n" http://127.0.0.1:3003/ || true

log "[11/11] PM2 status"
sudo -u deploy -H bash -lc "pm2 status" | tail -15

log "DONE — Wave 5 (auth audit fixes)"
