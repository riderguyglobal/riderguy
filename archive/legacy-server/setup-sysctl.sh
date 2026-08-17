#!/bin/bash
set -euo pipefail

echo "=== KERNEL SECURITY HARDENING ==="

cat > /etc/sysctl.d/99-riderguy-security.conf << 'SYSEOF'
# ── Network Security ──

# Prevent IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Disable IP source routing (prevents spoofed packets)
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0

# Disable ICMP redirects (prevent MITM)
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0

# Ignore ICMP broadcast requests (prevent Smurf attacks)
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Ignore bogus ICMP errors
net.ipv4.icmp_ignore_bogus_error_responses = 1

# Log suspicious packets (martians)
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# SYN flood protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 3

# Disable IP forwarding (not a router)
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0

# Disable IPv6 router advertisements
net.ipv6.conf.all.accept_ra = 0
net.ipv6.conf.default.accept_ra = 0

# ── TCP Performance & Security ──

# Enable TCP Fast Open
net.ipv4.tcp_fastopen = 3

# Reuse TIME_WAIT sockets safely
net.ipv4.tcp_tw_reuse = 1

# Increase connection tracking for high traffic
net.netfilter.nf_conntrack_max = 131072

# TCP keepalive (detect dead connections faster)
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 5

# Increase local port range
net.ipv4.ip_local_port_range = 10240 65535

# Increase socket buffer sizes for high throughput
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.rmem_default = 262144
net.core.wmem_default = 262144
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216

# Increase connection backlog
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535

# ── Memory & Process Security ──

# Restrict dmesg to root
kernel.dmesg_restrict = 1

# Restrict kernel pointer leaks
kernel.kptr_restrict = 2

# Disable magic SysRq key
kernel.sysrq = 0

# Restrict ptrace to root-only
kernel.yama.ptrace_scope = 2

# Randomize memory layout (ASLR)
kernel.randomize_va_space = 2

# ── File System Security ──

# Restrict core dumps
fs.suid_dumpable = 0

# Increase inotify watchers (for Node.js file watching)
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 256

# Increase file handle limits
fs.file-max = 2097152
SYSEOF

# Apply all settings
sysctl -p /etc/sysctl.d/99-riderguy-security.conf 2>&1 | tail -10

# Verify critical settings
echo ""
echo "Verification:"
echo "  SYN cookies: $(sysctl -n net.ipv4.tcp_syncookies)"
echo "  IP forward: $(sysctl -n net.ipv4.ip_forward)"
echo "  ASLR: $(sysctl -n kernel.randomize_va_space)"
echo "  RP filter: $(sysctl -n net.ipv4.conf.all.rp_filter)"
echo "  ptrace: $(sysctl -n kernel.yama.ptrace_scope)"
echo "  inotify watches: $(sysctl -n fs.inotify.max_user_watches)"

echo "---SYSCTL_DONE---"
