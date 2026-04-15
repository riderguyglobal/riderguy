#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  Phase 3.2 - Install PM2 & Configure Startup"
echo "============================================"

# ── 1. Install PM2 globally ──
echo ""
echo "1. Installing PM2..."
npm install -g pm2
pm2 --version

# ── 2. Install pm2-logrotate module ──
echo ""
echo "2. Installing pm2-logrotate..."
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:workerInterval 30
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'

# ── 3. Configure PM2 startup for deploy user ──
echo ""
echo "3. Configuring PM2 startup as deploy user..."

# Generate the startup script
env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy --no-daemon 2>&1 | tail -5

# The startup command needs to be run as root
# PM2 generates a command like: sudo env PATH=... pm2 startup systemd...
# Since we're root, we can run it directly
pm2 startup systemd -u deploy --hp /home/deploy

# ── 4. Set up ecosystem config for deploy user ──
echo ""
echo "4. Copying ecosystem.config.js to server..."

# Create PM2 home directory for deploy
mkdir -p /home/deploy/.pm2
chown -R deploy:deploy /home/deploy/.pm2

echo ""
echo "5. Verifying PM2 setup..."

# Check PM2 is in PATH for deploy user
echo "   PM2 path: $(which pm2)"
echo "   PM2 version: $(pm2 --version)"

# Check startup service
echo "   Startup service:"
systemctl is-enabled pm2-deploy 2>/dev/null && echo "   pm2-deploy: enabled" || echo "   pm2-deploy: not yet enabled (normal before first save)"

# Install tsx globally for the API (TypeScript execution)
echo ""
echo "6. Installing tsx globally (for API TypeScript execution)..."
npm install -g tsx
tsx --version

echo ""
echo "Done - PM2 installed and configured"
echo ""
echo "Summary:"
echo "  - PM2 $(pm2 --version) installed globally"
echo "  - pm2-logrotate: 50MB max, 14 day retention, compressed"
echo "  - Startup configured for deploy user"
echo "  - tsx $(tsx --version) installed for API"
