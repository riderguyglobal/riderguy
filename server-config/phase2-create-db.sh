#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  Phase 2.3 - Create Database, User & Extensions"
echo "============================================"

# Generate a strong random password (32 chars, alphanumeric + special)
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9!@#%^&*_+-=' | head -c 32)

echo ""
echo "Creating database user 'riderguy'..."
echo "Creating database 'riderguy_db'..."
echo ""

sudo -u postgres psql <<EOSQL
-- Create user with strong password
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'riderguy') THEN
        CREATE USER riderguy WITH PASSWORD '${DB_PASSWORD}';
        RAISE NOTICE 'User riderguy created';
    ELSE
        ALTER USER riderguy WITH PASSWORD '${DB_PASSWORD}';
        RAISE NOTICE 'User riderguy already exists - password updated';
    END IF;
END
\$\$;

-- Create database
SELECT 'CREATE DATABASE riderguy_db OWNER riderguy'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'riderguy_db')\gexec

-- Ensure ownership
ALTER DATABASE riderguy_db OWNER TO riderguy;

-- Connect to the database and set up extensions
\c riderguy_db

-- Extensions needed by Prisma and the app
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant schema privileges
GRANT ALL PRIVILEGES ON DATABASE riderguy_db TO riderguy;
GRANT ALL ON SCHEMA public TO riderguy;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO riderguy;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO riderguy;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO riderguy;

EOSQL

echo ""
echo "Verifying database setup..."

# Verify database exists
echo "--- Database ---"
sudo -u postgres psql -c "SELECT datname, pg_catalog.pg_get_userbyid(datdba) as owner FROM pg_database WHERE datname = 'riderguy_db';"

# Verify extensions
echo "--- Extensions ---"
sudo -u postgres psql -d riderguy_db -c "SELECT extname, extversion FROM pg_extension ORDER BY extname;"

# Verify user can connect
echo "--- Connection test ---"
PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U riderguy -d riderguy_db -c "SELECT current_user, current_database(), version();" 2>/dev/null

echo ""
echo "============================================"
echo "  DATABASE CREDENTIALS (SAVE THESE!)"
echo "============================================"
echo "  Host:     127.0.0.1"
echo "  Port:     5432"
echo "  Database: riderguy_db"
echo "  User:     riderguy"
echo "  Password: ${DB_PASSWORD}"
echo ""
echo "  DATABASE_URL=postgresql://riderguy:${DB_PASSWORD}@127.0.0.1:5432/riderguy_db"
echo "  DIRECT_URL=postgresql://riderguy:${DB_PASSWORD}@127.0.0.1:5432/riderguy_db"
echo "============================================"
echo ""
echo "✓ Database, user, and extensions created successfully"
