#!/bin/bash
echo "============================================"
echo "  RIDERGUY PHASE 1 - FINAL VERIFICATION"
echo "============================================"
echo ""

PASS=0
FAIL=0

check() {
    local desc="$1"
    local result="$2"
    if [ "$result" = "PASS" ]; then
        echo "  [PASS] $desc"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] $desc - $result"
        FAIL=$((FAIL + 1))
    fi
}

# ── 1. OS & System ──
echo "--- OS & System ---"
OS=$(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
check "OS: Ubuntu 24.04" "$(echo $OS | grep -q '24.04' && echo PASS || echo $OS)"
check "Hostname: riderguy-prod" "$([ $(hostname) = 'riderguy-prod' ] && echo PASS || echo $(hostname))"
check "Timezone: Africa/Accra" "$([ $(timedatectl show --property=Timezone --value) = 'Africa/Accra' ] && echo PASS || echo FAIL)"
check "NTP synchronized" "$([ $(timedatectl show --property=NTPSynchronized --value) = 'yes' ] && echo PASS || echo FAIL)"
check "Locale: en_US.UTF-8" "$(locale | grep -q 'en_US.UTF-8' && echo PASS || echo FAIL)"
check "CPUs: 8" "$([ $(nproc) -eq 8 ] && echo PASS || echo $(nproc))"
check "RAM: 15+ GB" "$([ $(free -g | awk '/Mem:/{print $2}') -ge 15 ] && echo PASS || echo $(free -h | awk '/Mem:/{print $2}'))"
check "Disk: 140+ GB available" "$([ $(df / --output=avail | tail -1 | tr -d ' ' | awk '{print int($1/1048576)}') -ge 140 ] && echo PASS || echo FAIL)"

# ── 2. Swap ──
echo ""
echo "--- Swap ---"
SWAP_TOTAL=$(free -g | awk '/Swap:/{print $2}')
check "Swap: 4GB configured" "$([ $SWAP_TOTAL -ge 3 ] && echo PASS || echo ${SWAP_TOTAL}GB)"
check "Swappiness: 10" "$([ $(sysctl -n vm.swappiness) -eq 10 ] && echo PASS || echo $(sysctl -n vm.swappiness))"
check "Swap in fstab" "$(grep -q swapfile /etc/fstab && echo PASS || echo FAIL)"

# ── 3. Users ──
echo ""
echo "--- Users ---"
check "Deploy user exists" "$(id deploy &>/dev/null && echo PASS || echo FAIL)"
check "Deploy SSH keys" "$([ -f /home/deploy/.ssh/authorized_keys ] && echo PASS || echo FAIL)"
check "Deploy SSH perms 700" "$([ $(stat -c %a /home/deploy/.ssh) = '700' ] && echo PASS || echo FAIL)"
check "Deploy sudoers valid" "$(visudo -c -f /etc/sudoers.d/deploy 2>/dev/null && echo PASS || echo FAIL)"

# ── 4. SSH Hardening ──
echo ""
echo "--- SSH Hardening ---"
check "PasswordAuth disabled" "$(sshd -T 2>/dev/null | grep -q 'passwordauthentication no' && echo PASS || echo FAIL)"
check "Root login key-only" "$(sshd -T 2>/dev/null | grep -q 'permitrootlogin without-password' && echo PASS || echo FAIL)"
check "MaxAuthTries 3" "$(sshd -T 2>/dev/null | grep -q 'maxauthtries 3' && echo PASS || echo FAIL)"
check "X11Forwarding off" "$(sshd -T 2>/dev/null | grep -q 'x11forwarding no' && echo PASS || echo FAIL)"
check "AllowUsers set" "$(sshd -T 2>/dev/null | grep -q 'allowusers' && echo PASS || echo FAIL)"
check "Strong ciphers only" "$(sshd -T 2>/dev/null | grep -q 'chacha20-poly1305' && echo PASS || echo FAIL)"

# ── 5. Firewall ──
echo ""
echo "--- Firewall (UFW) ---"
check "UFW active" "$(ufw status | grep -q 'Status: active' && echo PASS || echo FAIL)"
check "SSH port 22 LIMIT" "$(ufw status | grep -q '22/tcp.*LIMIT' && echo PASS || echo FAIL)"
check "HTTP port 80" "$(ufw status | grep -q '80/tcp.*ALLOW' && echo PASS || echo FAIL)"
check "HTTPS port 443" "$(ufw status | grep -q '443/tcp.*ALLOW' && echo PASS || echo FAIL)"
check "Default deny incoming" "$(ufw status verbose | grep -q 'deny (incoming)' && echo PASS || echo FAIL)"

# ── 6. Fail2Ban ──
echo ""
echo "--- Fail2Ban ---"
check "Fail2Ban running" "$(systemctl is-active fail2ban | grep -q 'active' && echo PASS || echo FAIL)"
check "SSHD jail enabled" "$(fail2ban-client status sshd &>/dev/null && echo PASS || echo FAIL)"
check "Recidive jail enabled" "$(fail2ban-client status recidive &>/dev/null && echo PASS || echo FAIL)"
JAILS=$(fail2ban-client status | grep 'Jail list' | sed 's/.*:\s*//' | tr -d ' ' | tr ',' '\n' | wc -l)
check "Total jails: 6" "$([ $JAILS -eq 6 ] && echo PASS || echo $JAILS)"

# ── 7. Kernel Security ──
echo ""
echo "--- Kernel Security ---"
check "SYN cookies enabled" "$([ $(sysctl -n net.ipv4.tcp_syncookies) -eq 1 ] && echo PASS || echo FAIL)"
check "IP forwarding disabled" "$([ $(sysctl -n net.ipv4.ip_forward) -eq 0 ] && echo PASS || echo FAIL)"
check "ASLR enabled (2)" "$([ $(sysctl -n kernel.randomize_va_space) -eq 2 ] && echo PASS || echo FAIL)"
check "RP filter (anti-spoof)" "$([ $(sysctl -n net.ipv4.conf.all.rp_filter) -eq 1 ] && echo PASS || echo FAIL)"
check "ICMP redirects disabled" "$([ $(sysctl -n net.ipv4.conf.all.accept_redirects) -eq 0 ] && echo PASS || echo FAIL)"
check "dmesg restricted" "$([ $(sysctl -n kernel.dmesg_restrict) -eq 1 ] && echo PASS || echo FAIL)"
check "ptrace restricted" "$([ $(sysctl -n kernel.yama.ptrace_scope) -eq 2 ] && echo PASS || echo FAIL)"
check "inotify watches 524288" "$([ $(sysctl -n fs.inotify.max_user_watches) -eq 524288 ] && echo PASS || echo FAIL)"

# ── 8. Auto Updates ──
echo ""
echo "--- Auto Updates ---"
check "Unattended-upgrades active" "$(systemctl is-active unattended-upgrades | grep -q 'active' && echo PASS || echo FAIL)"
check "Auto-reboot at 04:00" "$(grep -q '04:00' /etc/apt/apt.conf.d/50unattended-upgrades && echo PASS || echo FAIL)"

# ── 9. Performance ──
echo ""
echo "--- Performance ---"
check "THP disabled" "$(cat /sys/kernel/mm/transparent_hugepage/enabled | grep -q '\[never\]' && echo PASS || echo FAIL)"
check "File limits 65535" "$(grep -q '65535' /etc/security/limits.d/99-riderguy.conf && echo PASS || echo FAIL)"
check "Logrotate configured" "$([ -f /etc/logrotate.d/riderguy ] && echo PASS || echo FAIL)"

# ── 10. Directory Structure ──
echo ""
echo "--- Directory Structure ---"
check "/var/www/riderguy/source" "$([ -d /var/www/riderguy/source ] && echo PASS || echo FAIL)"
check "/var/www/riderguy/uploads" "$([ -d /var/www/riderguy/uploads ] && echo PASS || echo FAIL)"
check "/var/www/riderguy/uploads/documents" "$([ -d /var/www/riderguy/uploads/documents ] && echo PASS || echo FAIL)"
check "/var/www/riderguy/uploads/vehicles" "$([ -d /var/www/riderguy/uploads/vehicles ] && echo PASS || echo FAIL)"
check "/var/www/riderguy/uploads/profiles" "$([ -d /var/www/riderguy/uploads/profiles ] && echo PASS || echo FAIL)"
check "/var/www/riderguy/uploads/pod-photos" "$([ -d /var/www/riderguy/uploads/pod-photos ] && echo PASS || echo FAIL)"
check "/var/www/riderguy/logs" "$([ -d /var/www/riderguy/logs ] && echo PASS || echo FAIL)"
check "/var/www/riderguy/backups" "$([ -d /var/www/riderguy/backups ] && echo PASS || echo FAIL)"
check "/var/www/riderguy/scripts" "$([ -d /var/www/riderguy/scripts ] && echo PASS || echo FAIL)"
check "Owned by deploy" "$([ $(stat -c %U /var/www/riderguy/source) = 'deploy' ] && echo PASS || echo FAIL)"
check "Backups restricted (750)" "$([ $(stat -c %a /var/www/riderguy/backups) = '750' ] && echo PASS || echo FAIL)"

# ── Summary ──
echo ""
echo "============================================"
TOTAL=$((PASS + FAIL))
echo "  RESULTS: $PASS/$TOTAL passed"
if [ $FAIL -eq 0 ]; then
    echo "  STATUS: ALL CHECKS PASSED"
else
    echo "  STATUS: $FAIL CHECK(S) FAILED"
fi
echo "============================================"
