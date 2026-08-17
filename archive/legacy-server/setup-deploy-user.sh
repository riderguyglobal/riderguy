#!/bin/bash
set -euo pipefail

# ── Create deploy user ──
echo "Creating deploy user..."
useradd -m -s /bin/bash -c "RiderGuy Deploy" deploy

# Set up SSH directory with strict permissions
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Grant limited sudo: only service management, nginx, pm2, certbot
cat > /etc/sudoers.d/deploy << 'SUDOEOF'
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart postgresql
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart redis-server
deploy ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
deploy ALL=(ALL) NOPASSWD: /usr/bin/cp /var/www/riderguy/source/server-config/nginx-riderguy.conf /etc/nginx/sites-available/riderguy
deploy ALL=(ALL) NOPASSWD: /usr/bin/ln -sf /etc/nginx/sites-available/riderguy /etc/nginx/sites-enabled/riderguy
deploy ALL=(ALL) NOPASSWD: /usr/bin/rm -f /etc/nginx/sites-enabled/default
deploy ALL=(ALL) NOPASSWD: /usr/bin/certbot *
SUDOEOF

visudo -c -f /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy

echo "Deploy user created successfully"
echo "User: $(id deploy)"
echo "SSH keys: $(wc -l < /home/deploy/.ssh/authorized_keys) key(s)"
echo "Sudoers: valid"
