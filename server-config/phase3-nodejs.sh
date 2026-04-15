#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  Phase 3.1 - Install Node.js 22 LTS"
echo "============================================"

if command -v node &>/dev/null; then
    echo "Node.js already installed: $(node -v)"
else
    echo "Installing Node.js 22 LTS via NodeSource..."
    
    # Install NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt install -y nodejs
fi

echo ""
echo "--- Node.js ---"
node -v
echo "--- npm ---"
npm -v

# Verify the correct version
NODE_MAJOR=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_MAJOR" -ge 22 ]; then
    echo ""
    echo "Node.js $NODE_MAJOR confirmed"
else
    echo ""
    echo "WARNING: Expected Node.js 22+, got $NODE_MAJOR"
fi

# Install build essentials for native modules
echo ""
echo "Installing build tools for native npm modules..."
apt install -y build-essential python3

echo ""
echo "Done - Node.js 22 LTS installed"
