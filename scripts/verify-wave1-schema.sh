#!/bin/bash
set -e
cd /var/www/riderguy/source
export PGPASSWORD="$(sed -n 's/^DATABASE_URL=postgresql:\/\/riderguy:\([^@]*\)@.*/\1/p' .env | head -1)"
echo "→ webhook_events columns:"
psql -h 127.0.0.1 -U riderguy -d riderguy_db -tAc "SELECT column_name FROM information_schema.columns WHERE table_name = 'webhook_events' ORDER BY ordinal_position;"
echo "→ withdrawals.paystackRecipientCode:"
psql -h 127.0.0.1 -U riderguy -d riderguy_db -tAc "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'withdrawals' AND column_name = 'paystackRecipientCode';"
echo "→ unique index on webhook_events:"
psql -h 127.0.0.1 -U riderguy -d riderguy_db -tAc "SELECT indexname FROM pg_indexes WHERE tablename = 'webhook_events';"
