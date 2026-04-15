#!/bin/bash
set -euo pipefail

echo "=== SSH Hardening ==="

# Back up original config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%Y%m%d)

# Create hardened SSH config drop-in
cat > /etc/ssh/sshd_config.d/99-riderguy-hardening.conf << 'SSHEOF'
# ── RiderGuy SSH Hardening ──
# Applied: Phase 1 Server Setup

# Disable password authentication entirely (key-only)
PasswordAuthentication no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no

# Disable root password login (key-only for root)
PermitRootLogin prohibit-password

# Limit authentication attempts
MaxAuthTries 3
MaxSessions 5
MaxStartups 3:50:10

# Login grace period
LoginGraceTime 30

# Disable unused authentication methods
PermitEmptyPasswords no
GSSAPIAuthentication no
KerberosAuthentication no

# Disable X11 and agent forwarding (not needed for server)
X11Forwarding no
AllowAgentForwarding no

# Disable TCP forwarding (not needed)
AllowTcpForwarding no

# Use only protocol 2
Protocol 2

# Strict mode checks file permissions
StrictModes yes

# Log verbosely for security auditing
LogLevel VERBOSE

# Disconnect idle sessions after 5 minutes
ClientAliveInterval 300
ClientAliveCountMax 2

# Only allow specific users
AllowUsers root deploy

# Use strong key exchange algorithms only
KexAlgorithms sntrup761x25519-sha512@openssh.com,curve25519-sha256,curve25519-sha256@libssh.org

# Use strong ciphers only
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com

# Use strong MACs only
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com

# Disable motd and banner (info leakage)
PrintMotd no
Banner none

# Prevent DNS lookups on connecting clients (speeds up login)
UseDNS no
SSHEOF

# Validate the SSH configuration before applying
echo "Validating SSH config..."
sshd -t
if [ $? -eq 0 ]; then
    echo "SSH config is valid. Restarting ssh..."
    systemctl restart ssh
    echo "SSH hardening applied successfully"
else
    echo "ERROR: SSH config validation failed! Reverting..."
    rm /etc/ssh/sshd_config.d/99-riderguy-hardening.conf
    exit 1
fi

# Show active SSH settings
echo ""
echo "Active hardening settings:"
echo "  PasswordAuthentication: $(sshd -T 2>/dev/null | grep passwordauthentication | awk '{print $2}')"
echo "  PermitRootLogin: $(sshd -T 2>/dev/null | grep permitrootlogin | awk '{print $2}')"
echo "  MaxAuthTries: $(sshd -T 2>/dev/null | grep maxauthtries | awk '{print $2}')"
echo "  X11Forwarding: $(sshd -T 2>/dev/null | grep x11forwarding | awk '{print $2}')"
echo "  AllowUsers: $(sshd -T 2>/dev/null | grep allowusers | awk '{print $2}')"
