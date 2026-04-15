#!/bin/bash
set -euo pipefail

echo "=== UFW FIREWALL CONFIGURATION ==="
echo "CRITICAL: Adding SSH rule BEFORE enabling firewall"

# Reset to clean state
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# STEP 1: SSH FIRST (before enabling!)
ufw allow 22/tcp
echo "SSH rule added (allow 22/tcp)"

# STEP 2: Add rate limiting on SSH
ufw limit 22/tcp
echo "SSH rate limit applied"

# STEP 3: HTTP and HTTPS
ufw allow 80/tcp
echo "HTTP rule added (allow 80/tcp)"

ufw allow 443/tcp
echo "HTTPS rule added (allow 443/tcp)"

# Verify rules exist BEFORE enabling
echo ""
echo "Rules BEFORE enabling:"
ufw show added

# STEP 4: Enable firewall
echo ""
echo "Enabling UFW..."
ufw --force enable

# Final status
echo ""
echo "=== FINAL UFW STATUS ==="
ufw status verbose
echo ""
ufw status numbered

echo "---UFW_DONE---"
