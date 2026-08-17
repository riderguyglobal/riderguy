#!/bin/bash
set -e
cd /var/www/riderguy/source
echo "→ Building API with tsc..."
/var/www/riderguy/source/node_modules/.bin/tsc --project /var/www/riderguy/source/apps/api/tsconfig.json
echo "→ Fixing ownership of dist..."
chown -R deploy:deploy /var/www/riderguy/source/apps/api/dist
echo "→ Reloading PM2 API processes..."
sudo -u deploy -H bash -lc "cd /var/www/riderguy && pm2 reload riderguy-api --update-env"
echo "→ PM2 status:"
sudo -u deploy pm2 list | head -20
echo "→ Health check..."
sleep 3
curl -s -o /dev/null -w "API health HTTP %{http_code}\n" http://127.0.0.1:4000/health
echo "DONE"
