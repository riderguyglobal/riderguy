#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  Phase 2.1 - Install PostgreSQL 16"
echo "============================================"

# Check if already installed
if dpkg -l | grep -q postgresql-16; then
    echo "PostgreSQL 16 is already installed"
    psql --version
else
    echo "Installing PostgreSQL 16..."
    
    # Add PostgreSQL official repository for latest 16.x
    apt install -y gnupg2 lsb-release
    echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
    apt update
    
    apt install -y postgresql-16 postgresql-contrib-16
    
    echo ""
    psql --version
fi

# Ensure service is running and enabled
systemctl enable postgresql
systemctl start postgresql

echo ""
echo "PostgreSQL 16 service status:"
systemctl is-active postgresql
echo ""
echo "Listening on:"
ss -tlnp | grep 5432 || echo "  (not yet listening - will listen after config)"
echo ""
echo "✓ PostgreSQL 16 installed successfully"
