#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  Phase 2.4 - PostgreSQL Security Hardening"
echo "============================================"

PG_HBA="/etc/postgresql/16/main/pg_hba.conf"
PG_CONF="/etc/postgresql/16/main/postgresql.conf"
SSL_DIR="/etc/postgresql/16/main/ssl"

# ── 1. Harden pg_hba.conf ──
echo ""
echo "1. Hardening pg_hba.conf..."

cp "$PG_HBA" "${PG_HBA}.backup"

cat > "$PG_HBA" <<'HBA'
# PostgreSQL Client Authentication Configuration File
# ===================================================
# RiderGuy Production - Hardened
#
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections (Unix socket) - postgres admin via peer (OS user match)
local   all             postgres                                peer

# Local connections - riderguy app user via scram-sha-256
local   riderguy_db     riderguy                                scram-sha-256

# IPv4 localhost - only riderguy user to riderguy_db
host    riderguy_db     riderguy        127.0.0.1/32            scram-sha-256

# IPv6 localhost - only riderguy user to riderguy_db
host    riderguy_db     riderguy        ::1/128                 scram-sha-256

# Deny everything else
host    all             all             0.0.0.0/0               reject
host    all             all             ::/0                    reject
HBA

echo "   pg_hba.conf hardened (only riderguy@riderguy_db via scram-sha-256)"

# ── 2. Generate self-signed SSL cert for local connections ──
echo ""
echo "2. Setting up PostgreSQL SSL..."

mkdir -p "$SSL_DIR"

# Generate self-signed certificate (valid 10 years)
openssl req -new -x509 -days 3650 -nodes \
    -subj "/CN=riderguy-prod-postgres/O=RiderGuy" \
    -out "$SSL_DIR/server.crt" \
    -keyout "$SSL_DIR/server.key" \
    2>/dev/null

# Set correct permissions
chmod 600 "$SSL_DIR/server.key"
chmod 644 "$SSL_DIR/server.crt"
chown postgres:postgres "$SSL_DIR/server.key" "$SSL_DIR/server.crt"

# Enable SSL in postgresql.conf
# First check if SSL settings already exist from our tuning
if ! grep -q "^ssl = on" "$PG_CONF"; then
    cat >> "$PG_CONF" <<SSLCONF

# -- SSL --
ssl = on
ssl_cert_file = '${SSL_DIR}/server.crt'
ssl_key_file = '${SSL_DIR}/server.key'
ssl_min_protocol_version = 'TLSv1.2'
ssl_prefer_server_ciphers = on
SSLCONF
    echo "   SSL enabled in postgresql.conf"
else
    echo "   SSL already configured"
fi

# ── 3. Additional security settings ──
echo ""
echo "3. Applying additional security settings..."

if ! grep -q "^password_encryption" "$PG_CONF"; then
    cat >> "$PG_CONF" <<'SECCONF'

# -- Security --
password_encryption = scram-sha-256    # Strongest password hash
row_security = on                      # Enable row-level security
SECCONF
    echo "   scram-sha-256 password encryption enforced"
    echo "   Row-level security enabled"
fi

# ── 4. Set listen_addresses explicitly ──
# Ensure PostgreSQL ONLY listens on localhost
echo ""
echo "4. Verifying listen_addresses..."
LISTEN=$(grep "^listen_addresses" "$PG_CONF" || true)
if [ -z "$LISTEN" ]; then
    # It might be using the default, let's set it explicitly
    sed -i "s/^#listen_addresses = 'localhost'/listen_addresses = '127.0.0.1'/" "$PG_CONF"
    echo "   listen_addresses set to 127.0.0.1 only"
else
    echo "   Already set: $LISTEN"
fi

# ── 5. Restart and verify ──
echo ""
echo "5. Restarting PostgreSQL..."
systemctl restart postgresql
sleep 2

if systemctl is-active postgresql | grep -q active; then
    echo "   PostgreSQL restarted successfully"
else
    echo "   ERROR: PostgreSQL failed to start!"
    journalctl -u postgresql --no-pager -n 20
    exit 1
fi

# Verify SSL
echo ""
echo "--- SSL Status ---"
sudo -u postgres psql -c "SHOW ssl;" 2>/dev/null
sudo -u postgres psql -c "SHOW ssl_min_protocol_version;" 2>/dev/null

# Verify password encryption
echo "--- Password Encryption ---"
sudo -u postgres psql -c "SHOW password_encryption;" 2>/dev/null

# Verify listen address
echo "--- Listen Address ---"
sudo -u postgres psql -c "SHOW listen_addresses;" 2>/dev/null

# Verify our user can still connect
echo "--- Connection Test ---"
PGPASSWORD="emAYIu7ZBQty+jZaJ8vCKSoIFgjVyqp4" psql -h 127.0.0.1 -U riderguy -d riderguy_db -c "SELECT 'Connection via scram-sha-256: OK' as status;" 2>/dev/null

# Test that random connections are rejected
echo "--- Rejection Test ---"
if PGPASSWORD="test" psql -h 127.0.0.1 -U randomuser -d riderguy_db -c "SELECT 1;" 2>/dev/null; then
    echo "   WARNING: Random user was NOT rejected!"
else
    echo "   Random user correctly rejected"
fi

echo ""
echo "✓ PostgreSQL security hardening complete"
