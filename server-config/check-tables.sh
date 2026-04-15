#!/bin/bash
echo "--- Table Count ---"
sudo -u postgres psql -d riderguy_db -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
echo "--- Tables ---"
sudo -u postgres psql -d riderguy_db -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;"
echo "--- Enum Count ---"
sudo -u postgres psql -d riderguy_db -tAc "SELECT count(*) FROM pg_type WHERE typtype = 'e';"
