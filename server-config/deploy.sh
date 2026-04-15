#!/bin/bash
set -e

# ============================================================
# RiderGuy — Hetzner Production Deploy Script
# Usage: ssh riderguy-deploy 'bash /var/www/riderguy/source/server-config/deploy.sh'
# ============================================================

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

echo -e "${BOLD}"
echo "═══════════════════════════════════════════════════"
echo "  RiderGuy — Hetzner Production Deploy"
echo "  Server: 178.104.193.184 (CX43)"
echo "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "═══════════════════════════════════════════════════"
echo -e "${NC}"

cd /var/www/riderguy/source

# ── Step 0: Pre-flight checks ──
echo -e "\n${BOLD}▸ Pre-flight checks...${NC}"

# Check PostgreSQL
if pg_isready -q -h 127.0.0.1 -p 5432; then
  log "PostgreSQL is running"
else
  error "PostgreSQL is not running!"
  exit 1
fi

# Check Redis
REDIS_PASS=$(grep -oP '(?<=redis://:)[^@]+' .env | head -1)
if [ -n "$REDIS_PASS" ] && redis-cli -a "$REDIS_PASS" ping 2>/dev/null | grep -q PONG; then
  log "Redis is running"
else
  warn "Redis may not be running (not critical for deploy)"
fi

# Check disk space (need at least 2GB free)
FREE_MB=$(df /var/www/riderguy | tail -1 | awk '{print $4}')
FREE_GB=$((FREE_MB / 1024 / 1024))
if [ "$FREE_GB" -lt 2 ]; then
  error "Low disk space: ${FREE_GB}GB free (need 2GB minimum)"
  exit 1
fi
log "Disk space OK: ${FREE_GB}GB free"

# ── Step 1: Pull latest code ──
echo -e "\n${BOLD}▸ Step 1: Pulling latest code...${NC}"
git pull origin main 2>&1 | tail -5
log "Code updated"

# ── Step 2: Load environment ──
echo -e "\n${BOLD}▸ Step 2: Loading environment...${NC}"
set -a
source .env
set +a
log "Environment loaded (NEXT_PUBLIC_* vars available for build)"

# ── Step 3: Install dependencies ──
echo -e "\n${BOLD}▸ Step 3: Installing dependencies...${NC}"
NODE_ENV=development npm install --legacy-peer-deps 2>&1 | tail -5
log "Dependencies installed"

# ── Step 4: Generate Prisma client ──
echo -e "\n${BOLD}▸ Step 4: Generating Prisma client...${NC}"
npx prisma generate --schema=packages/database/prisma/schema.prisma 2>&1 | tail -3
log "Prisma client generated"

# ── Step 5: Run database migrations ──
echo -e "\n${BOLD}▸ Step 5: Running database migrations...${NC}"
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma 2>&1 | tail -5
log "Migrations applied"

# ── Step 6: Build API ──
echo -e "\n${BOLD}▸ Step 6: Building API...${NC}"
cd /var/www/riderguy/source/apps/api
npx tsc --project tsconfig.json 2>&1 | tail -10
log "API built"

# ── Step 7: Build shared packages ──
echo -e "\n${BOLD}▸ Step 7: Building shared packages...${NC}"
cd /var/www/riderguy/source
npx turbo run build --filter='@riderguy/utils' --filter='@riderguy/config' --filter='@riderguy/types' --filter='@riderguy/validators' --filter='@riderguy/auth' --filter='@riderguy/ui' 2>&1 | tail -10
log "Shared packages built"

# ── Step 8: Build frontend apps ──
APPS=("marketing:3000" "rider:3001" "client:3002" "admin:3003")
for app_info in "${APPS[@]}"; do
  APP="${app_info%%:*}"
  echo -e "\n${BOLD}▸ Building ${APP} app...${NC}"
  cd /var/www/riderguy/source/apps/${APP}
  npx next build 2>&1 | tail -5

  if [ -d ".next/standalone" ]; then
    cp -r .next/static .next/standalone/apps/${APP}/.next/static
    cp -r public .next/standalone/apps/${APP}/public
    log "${APP} built + standalone assets copied"
  else
    error "${APP} build failed!"
    exit 1
  fi
done

# ── Step 9: Restart services ──
echo -e "\n${BOLD}▸ Step 9: Restarting PM2 services...${NC}"
cd /var/www/riderguy/source
pm2 reload ecosystem.config.js --update-env 2>&1 | tail -5
pm2 save
sleep 3

# ── Step 10: Post-deploy health check ──
echo -e "\n${BOLD}▸ Step 10: Health check...${NC}"
sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/health || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  log "API health check passed (HTTP 200)"
else
  warn "API health check returned HTTP ${HTTP_CODE}"
fi

# Check all PM2 processes
PM2_ERRORS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
errors = [p['name'] for p in data if p.get('pm2_env', {}).get('status') != 'online']
print(','.join(errors) if errors else '')
" 2>/dev/null || echo "check_failed")

if [ -z "$PM2_ERRORS" ]; then
  log "All PM2 processes are online"
elif [ "$PM2_ERRORS" = "check_failed" ]; then
  warn "Could not verify PM2 status — check manually with 'pm2 ls'"
else
  error "PM2 processes not online: ${PM2_ERRORS}"
fi

pm2 ls

echo -e "\n${BOLD}"
echo "═══════════════════════════════════════════════════"
echo "  Deploy Complete! $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "═══════════════════════════════════════════════════"
echo -e "${NC}"
