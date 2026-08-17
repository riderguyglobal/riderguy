#!/bin/bash
set -euo pipefail

echo "=== FAIL2BAN CONFIGURATION ==="

# Create comprehensive jail configuration
cat > /etc/fail2ban/jail.local << 'F2BEOF'
# RiderGuy Fail2Ban Configuration
# Protects against brute force and abuse

[DEFAULT]
# Ban for 1 hour on first offense
bantime = 3600
# Look at last 10 minutes of logs
findtime = 600
# 5 failures triggers a ban
maxretry = 5
# Use UFW for banning
banaction = ufw
banaction_allports = ufw
# Email notifications (optional, set up later)
# destemail = admin@myriderguy.com
# sender = fail2ban@myriderguy.com
# action = %(action_mwl)s

# ── SSH Protection ──
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
findtime = 300

# ── SSH DDoS Protection ──
[sshd-ddos]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 6
bantime = 3600
findtime = 60

# ── Nginx Protection (bad bots, scanners) ──
[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600

[nginx-botsearch]
enabled = true
port = http,https
filter = nginx-botsearch
logpath = /var/log/nginx/access.log
maxretry = 3
bantime = 86400
findtime = 600

[nginx-badbots]
enabled = true
port = http,https
filter = nginx-badbots
logpath = /var/log/nginx/access.log
maxretry = 2
bantime = 86400

# ── Repeat offenders (escalating bans) ──
[recidive]
enabled = true
filter = recidive
logpath = /var/log/fail2ban.log
bantime = 604800
findtime = 86400
maxretry = 3
F2BEOF

# Create custom filter for nginx bad bots (enhanced)
cat > /etc/fail2ban/filter.d/nginx-badbots.conf << 'FILTEREOF'
[Definition]
failregex = ^<HOST> -.*"(GET|POST|HEAD).*HTTP.*" .* ".*(?:masscan|nikto|sqlmap|nmap|dirbuster|havij|w3af|zgrab|python-requests/2\.\d+).*"$
ignoreregex =
FILTEREOF

# Restart fail2ban
systemctl restart fail2ban
systemctl enable fail2ban

# Verify
echo ""
echo "Fail2Ban status:"
fail2ban-client status
echo ""
echo "SSHD jail:"
fail2ban-client status sshd

echo "---FAIL2BAN_DONE---"
