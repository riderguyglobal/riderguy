#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIR="${RIDERGUY_SOURCE_DIR:-/var/www/riderguy/source}"
ENV_FILE="${RIDERGUY_ENV_FILE:-/var/www/riderguy/shared/.env.production}"
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

for app_name in marketing admin; do
  app_dir="$SOURCE_DIR/apps/$app_name"
  standalone_dir="$app_dir/.next/standalone/apps/$app_name"
  [ -f "$standalone_dir/server.js" ] || fail "$app_name standalone build is missing"
  mkdir -p "$standalone_dir/.next"
  cp -a "$app_dir/.next/static" "$standalone_dir/.next/"
  if [ -d "$app_dir/public" ]; then
    cp -a "$app_dir/public" "$standalone_dir/"
  fi
done

log 'checking PostgreSQL and applying migrations'
pg_isready -q -h 127.0.0.1 -p 5432 || fail 'PostgreSQL is not ready'
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma

log 'starting or reloading API, marketing, and admin services'
pm2 startOrReload server-config/ecosystem.config.js --update-env
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
