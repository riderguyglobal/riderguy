#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIR="${RIDERGUY_SOURCE_DIR:-/var/www/riderguy/source}"
ENV_FILE="${RIDERGUY_ENV_FILE:-/var/www/riderguy/shared/.env.production}"
ECOSYSTEM_FILE="${RIDERGUY_ECOSYSTEM_FILE:-/var/www/riderguy/shared/ecosystem.config.js}"
LOCK_FILE="${RIDERGUY_DEPLOY_LOCK:-/tmp/riderguy-deploy.lock}"

log() { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

command -v flock >/dev/null || fail 'flock is required'
exec 9>"$LOCK_FILE"
flock -n 9 || fail 'another deployment is already running'

for command_name in git node npm npx pm2 curl pg_isready; do
  command -v "$command_name" >/dev/null || fail "$command_name is not installed"
done

[ -d "$SOURCE_DIR/.git" ] || fail "repository not found at $SOURCE_DIR"
[ -f "$ENV_FILE" ] || fail "production environment file not found at $ENV_FILE"
[ -f "$ECOSYSTEM_FILE" ] || fail "PM2 ecosystem file not found at $ECOSYSTEM_FILE"

cd "$SOURCE_DIR"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  fail 'tracked files are modified on the server; resolve them before deploying'
fi

log 'updating source with a fast-forward-only pull'
git fetch origin main
git checkout main
git pull --ff-only origin main

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export RIDERGUY_SOURCE_DIR="$SOURCE_DIR"
export RIDERGUY_LOG_DIR="${RIDERGUY_LOG_DIR:-/var/www/riderguy/logs}"
mkdir -p "$RIDERGUY_LOG_DIR"

log 'installing locked dependencies'
npm ci --include=dev

log 'generating Prisma client'
npx prisma generate --schema=packages/database/prisma/schema.prisma

log 'building API, marketing, and admin workspaces'
npx turbo run build \
  --filter=@riderguy/api \
  --filter=@riderguy/marketing-app \
  --filter=@riderguy/admin-app

# npm workspaces symlink local packages into node_modules. Older checkouts may
# still point their runtime entry at TypeScript source, which plain Node cannot
# execute. Build isolated runtime copies so production always uses compiled JS.
log 'preparing compiled shared packages for the API runtime'
for package_name in types utils validators; do
  package_dir="$SOURCE_DIR/packages/$package_name"
  runtime_dir="$SOURCE_DIR/.runtime-packages/$package_name"
  [ -f "$package_dir/dist/index.js" ] || fail "$package_name compiled output is missing"
  rm -rf "$runtime_dir"
  mkdir -p "$runtime_dir"
  cp -a "$package_dir/dist" "$runtime_dir/"
  cp "$package_dir/package.json" "$runtime_dir/package.json"
  npm pkg set \
    'main=./dist/index.js' \
    'types=./dist/index.d.ts' \
    --prefix "$runtime_dir" >/dev/null
  rm -f "$SOURCE_DIR/node_modules/@riderguy/$package_name"
  ln -s "../../.runtime-packages/$package_name" \
    "$SOURCE_DIR/node_modules/@riderguy/$package_name"
done

for app_name in marketing admin; do
  app_dir="$SOURCE_DIR/apps/$app_name"
  standalone_dir="$app_dir/.next/standalone"
  standalone_app_dir="$standalone_dir/apps/$app_name"
  [ -f "$standalone_app_dir/server.js" ] || fail "$app_name standalone build is missing"
  mkdir -p "$standalone_app_dir/.next"
  cp -a "$app_dir/.next/static" "$standalone_app_dir/.next/"
  if [ -d "$app_dir/public" ]; then
    cp -a "$app_dir/public" "$standalone_app_dir/"
  fi

  # npm may install Next in each workspace or hoist it to the repository root.
  # Prefer a complete workspace package. If tracing left only a partial package,
  # replace it with a link to a complete hoisted runtime when one is available.
  next_runtime="$standalone_dir/node_modules/next"
  next_probe='dist/server/node-polyfill-crypto.js'
  if [ ! -f "$next_runtime/$next_probe" ]; then
    complete_next="$app_dir/node_modules/next"
    if [ ! -f "$complete_next/$next_probe" ]; then
      complete_next="$SOURCE_DIR/node_modules/next"
    fi
    [ -f "$complete_next/$next_probe" ] \
      || fail "$app_name Next.js runtime package is incomplete"
    rm -rf "$next_runtime"
    mkdir -p "$(dirname "$next_runtime")"
    ln -s "$complete_next" "$next_runtime"
  fi
done

log 'checking PostgreSQL and applying migrations'
pg_isready -q -h 127.0.0.1 -p 5432 || fail 'PostgreSQL is not ready'
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma

log 'starting or reloading API, marketing, and admin services'
pm2 startOrReload "$ECOSYSTEM_FILE" --update-env
pm2 save

log 'checking local services'
for check_url in \
  http://127.0.0.1:4000/health \
  http://127.0.0.1:3000/ \
  http://127.0.0.1:3003/; do
  curl --fail --silent --show-error --max-time 15 "$check_url" >/dev/null \
    || fail "health check failed: $check_url"
done

pm2 status
log 'deployment completed successfully'
