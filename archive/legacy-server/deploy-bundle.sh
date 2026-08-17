#!/bin/bash
# Run on Hetzner: align git tree with bundle, then run deploy steps
set -e

BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

echo -e "${BOLD}═══ RiderGuy Bundle Deploy — $(date) ═══${NC}"

cd /var/www/riderguy/source

# Backup .env
TS=$(date +%s)
cp .env /tmp/.env.backup-${TS}
log ".env backed up to /tmp/.env.backup-${TS}"

# Backup any unique server work
mkdir -p /tmp/server-stash-${TS}
git status --porcelain | awk '$1 ~ /\?\?/ {print $2}' | while read f; do
  if [ -e "$f" ]; then
    mkdir -p "/tmp/server-stash-${TS}/$(dirname "$f")"
    cp -r "$f" "/tmp/server-stash-${TS}/$f" 2>/dev/null || true
  fi
done
log "Server-only files copied to /tmp/server-stash-${TS}"

# Hard reset to deployed-main (our local HEAD)
log "Discarding tracked changes..."
git checkout -- . || true

log "Cleaning untracked files (forcing)..."
sudo git clean -fd 2>/dev/null || git clean -fd 2>&1 | tail -5

log "Resetting to deployed-main..."
git checkout main 2>&1 | tail -3
git reset --hard deployed-main
log "HEAD now at: $(git log -1 --oneline)"

# Verify .env still present (gitignored, should not be touched)
if [ ! -f .env ]; then
  warn ".env missing! Restoring from backup..."
  cp /tmp/.env.backup-${TS} .env
fi
log ".env present"

# ── Run deploy steps (skipping git pull) ──
echo -e "\n${BOLD}▸ Loading environment...${NC}"
set -a
source .env
set +a

echo -e "\n${BOLD}▸ Installing dependencies...${NC}"
NODE_ENV=development npm install --legacy-peer-deps 2>&1 | tail -3

echo -e "\n${BOLD}▸ Generating Prisma client...${NC}"
npx prisma generate --schema=packages/database/prisma/schema.prisma 2>&1 | tail -3

echo -e "\n${BOLD}▸ Running database migrations...${NC}"
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma 2>&1 | tail -10

echo -e "\n${BOLD}▸ Building API...${NC}"
cd /var/www/riderguy/source/apps/api
npx tsc --project tsconfig.json 2>&1 | tail -5

echo -e "\n${BOLD}▸ Building shared packages...${NC}"
cd /var/www/riderguy/source
npx turbo run build \
  --filter='@riderguy/utils' \
  --filter='@riderguy/config' \
  --filter='@riderguy/types' \
  --filter='@riderguy/validators' \
  --filter='@riderguy/auth' \
  --filter='@riderguy/ui' \
  --filter='@riderguy/database' 2>&1 | tail -8

echo -e "\n${BOLD}▸ Building frontend apps...${NC}"
APPS=("marketing" "rider" "client" "admin")
for APP in "${APPS[@]}"; do
  echo -e "${BOLD}  → ${APP}${NC}"
  cd /var/www/riderguy/source/apps/${APP}
  npx next build 2>&1 | tail -3
  if [ -d ".next/standalone" ]; then
    cp -r .next/static .next/standalone/apps/${APP}/.next/static
    cp -r public .next/standalone/apps/${APP}/public
    log "${APP} built"
  else
    error "${APP} standalone build missing!"
    exit 1
  fi
done

echo -e "\n${BOLD}▸ Reloading PM2...${NC}"
cd /var/www/riderguy
pm2 reload ecosystem.config.js --update-env 2>&1 | tail -5
pm2 save

sleep 4

echo -e "\n${BOLD}▸ Health check...${NC}"
pm2 list

echo -e "\n${BOLD}▸ HTTPS endpoints:${NC}"
for d in myriderguy.com rider.myriderguy.com app.myriderguy.com admin.myriderguy.com api.myriderguy.com; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 8 "https://$d/" || echo "ERR")
  echo "  $d → $CODE"
done

echo -e "\n${GREEN}${BOLD}✓ Deploy complete${NC}"
