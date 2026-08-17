#!/bin/bash
# ============================================================
# RiderGuy — PM2 Log Rotation Setup
# Run once to configure log rotation for all PM2 apps
# ============================================================

set -e

echo "Setting up PM2 log rotation..."

# Install pm2-logrotate if not already installed
pm2 install pm2-logrotate 2>/dev/null || true

# Configure log rotation
pm2 set pm2-logrotate:max_size 50M        # Rotate when file hits 50MB
pm2 set pm2-logrotate:retain 14            # Keep 14 rotated files
pm2 set pm2-logrotate:compress true        # Gzip rotated files
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateModule true    # Also rotate pm2-logrotate's own logs
pm2 set pm2-logrotate:workerInterval 30    # Check every 30 seconds
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'  # Also rotate daily at midnight

echo "✓ PM2 log rotation configured:"
echo "  - Max size: 50MB per log file"
echo "  - Retention: 14 rotated files"
echo "  - Compression: enabled (gzip)"
echo "  - Daily rotation at midnight"

pm2 save
echo "✓ PM2 config saved"
