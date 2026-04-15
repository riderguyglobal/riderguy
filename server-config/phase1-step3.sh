#!/bin/bash
set -euo pipefail

echo "=== TIMEZONE, LOCALE, HOSTNAME ==="

# Timezone: Ghana (UTC/GMT)
timedatectl set-timezone Africa/Accra
echo "Timezone: $(timedatectl show --property=Timezone --value)"

# Locale: UTF-8
locale-gen en_US.UTF-8 2>/dev/null
update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
echo "Locale: $(locale | head -1)"

# Hostname
hostnamectl set-hostname riderguy-prod
# Only add if not already present
grep -q "riderguy-prod" /etc/hosts || echo "127.0.0.1 riderguy-prod" >> /etc/hosts
echo "Hostname: $(hostname)"

# NTP sync
timedatectl set-ntp true
echo "NTP: $(timedatectl show --property=NTPSynchronized --value)"

echo ""
echo "=== SWAP CONFIGURATION ==="

if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab

    cat > /etc/sysctl.d/99-swap.conf << 'EOF'
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF
    sysctl -p /etc/sysctl.d/99-swap.conf
    echo "Swap: created 4GB"
else
    echo "Swap: already exists"
fi
free -h | grep -i swap
echo "Swappiness: $(cat /proc/sys/vm/swappiness)"

echo "---STEP3_DONE---"
