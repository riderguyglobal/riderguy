#!/bin/bash
set -e

# Add HSTS header after Referrer-Policy in nginx.conf
sed -i '/add_header Referrer-Policy/a\    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;' /etc/nginx/nginx.conf

# Verify and reload
nginx -t && systemctl reload nginx
echo "HSTS added and Nginx reloaded"

# Verify it's there
grep 'Strict-Transport' /etc/nginx/nginx.conf
