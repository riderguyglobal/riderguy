#!/bin/bash
cd /var/www/riderguy/source
source .env
# Extract password from DATABASE_URL
export PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
psql -h 127.0.0.1 -U riderguy -d riderguy_db -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND (column_name LIKE '%ghana%' OR column_name LIKE '%security%');"
