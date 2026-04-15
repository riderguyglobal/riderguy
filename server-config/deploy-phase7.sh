#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════"
echo "  Phase 7 Deploy: Google Maps Migration"
echo "═══════════════════════════════════════════════════"

cd /var/www/riderguy/source

# Load env vars (needed for NEXT_PUBLIC_* at build time)
set -a
source .env
set +a

echo ""
echo "▸ Step 1: Installing dependencies..."
NODE_ENV=development npm install 2>&1 | tail -10
echo "✓ Dependencies installed"

echo ""
echo "▸ Step 2: Verifying Google Maps packages..."
ls -la node_modules/@googlemaps/js-api-loader/package.json 2>/dev/null && echo "✓ @googlemaps/js-api-loader found" || echo "✗ @googlemaps/js-api-loader MISSING"
ls -la node_modules/@types/google.maps/package.json 2>/dev/null && echo "✓ @types/google.maps found" || echo "✗ @types/google.maps MISSING"
echo "Checking mapbox-gl NOT installed..."
ls node_modules/mapbox-gl 2>/dev/null && echo "⚠ mapbox-gl still present!" || echo "✓ mapbox-gl removed"

echo ""
echo "▸ Step 3: Generating Prisma client..."
npx prisma generate --schema=packages/database/prisma/schema.prisma 2>&1 | tail -5
echo "✓ Prisma client generated"

echo ""
echo "▸ Step 4: Building API..."
cd /var/www/riderguy/source/apps/api
npx tsc --project tsconfig.json 2>&1 | tail -20
echo "✓ API built"

echo ""
echo "▸ Step 5: Building shared packages..."
cd /var/www/riderguy/source
npx turbo run build --filter='@riderguy/utils' --filter='@riderguy/config' --filter='@riderguy/types' --filter='@riderguy/validators' --filter='@riderguy/auth' --filter='@riderguy/ui' 2>&1 | tail -20
echo "✓ Shared packages built"

echo ""
echo "▸ Step 6: Building Marketing app..."
cd /var/www/riderguy/source/apps/marketing
npx next build 2>&1 | tail -10
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/marketing/.next/static
  cp -r public .next/standalone/apps/marketing/public
  echo "✓ Marketing built + standalone assets copied"
else
  echo "✗ Marketing build failed — no standalone output"
  exit 1
fi

echo ""
echo "▸ Step 7: Building Rider app..."
cd /var/www/riderguy/source/apps/rider
npx next build 2>&1 | tail -10
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/rider/.next/static
  cp -r public .next/standalone/apps/rider/public
  echo "✓ Rider built + standalone assets copied"
else
  echo "✗ Rider build failed — no standalone output"
  exit 1
fi

echo ""
echo "▸ Step 8: Building Client app..."
cd /var/www/riderguy/source/apps/client
npx next build 2>&1 | tail -10
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/client/.next/static
  cp -r public .next/standalone/apps/client/public
  echo "✓ Client built + standalone assets copied"
else
  echo "✗ Client build failed — no standalone output"
  exit 1
fi

echo ""
echo "▸ Step 9: Building Admin app..."
cd /var/www/riderguy/source/apps/admin
npx next build 2>&1 | tail -10
if [ -d ".next/standalone" ]; then
  cp -r .next/static .next/standalone/apps/admin/.next/static
  cp -r public .next/standalone/apps/admin/public
  echo "✓ Admin built + standalone assets copied"
else
  echo "✗ Admin build failed — no standalone output"
  exit 1
fi

echo ""
echo "▸ Step 10: Restarting PM2 services..."
cd /var/www/riderguy/source
pm2 delete all 2>/dev/null || true
pm2 start /var/www/riderguy/ecosystem.config.js
pm2 save
sleep 3
pm2 ls

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Phase 7 Deploy Complete!"
echo "═══════════════════════════════════════════════════"
