#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  Phase 2.2 - Tune PostgreSQL for 16GB RAM"
echo "============================================"

PG_CONF="/etc/postgresql/16/main/postgresql.conf"

# Backup original config
cp "$PG_CONF" "${PG_CONF}.backup"
echo "Original config backed up to ${PG_CONF}.backup"

# Apply performance tuning
# These values are optimized for:
#   - 16GB RAM server
#   - SSD storage (low random_page_cost)
#   - Mixed workload (OLTP + some analytics)
#   - ~200 max connections (5 apps + connection overhead)

cat >> "$PG_CONF" <<'PGCONF'

# ============================================
# RiderGuy Performance Tuning (16GB RAM / 8 vCPU / SSD)
# Applied: $(date +%Y-%m-%d)
# ============================================

# -- Memory --
shared_buffers = 4GB                   # 25% of RAM
effective_cache_size = 12GB            # 75% of RAM (OS cache estimate)
maintenance_work_mem = 1GB             # For VACUUM, CREATE INDEX
work_mem = 32MB                        # Per-sort/hash operation
huge_pages = try                       # Use if kernel supports

# -- Connections --
max_connections = 200                  # 5 apps + admin + overhead

# -- WAL & Checkpoints --
wal_buffers = 64MB                     # 1/64 of shared_buffers or 64MB max
checkpoint_completion_target = 0.9     # Spread checkpoint writes
min_wal_size = 1GB
max_wal_size = 4GB
wal_compression = on                   # Reduce WAL I/O

# -- Query Planner --
random_page_cost = 1.1                 # SSD: nearly same as seq_page_cost
effective_io_concurrency = 200         # SSD: high concurrency
default_statistics_target = 200        # Better query plans (from 100)

# -- Parallelism --
max_worker_processes = 8               # Match vCPU count
max_parallel_workers_per_gather = 4    # Half of vCPUs
max_parallel_workers = 8               # Match vCPU count
max_parallel_maintenance_workers = 4   # For parallel VACUUM/INDEX

# -- Logging --
logging_collector = on
log_directory = '/var/www/riderguy/logs/postgresql'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 500       # Log slow queries (>500ms)
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0                     # Log all temp file usage
log_autovacuum_min_duration = 250      # Log slow autovacuums
log_line_prefix = '%m [%p] %q%u@%d '

# -- Autovacuum --
autovacuum_max_workers = 4
autovacuum_naptime = 30s               # Check more frequently (from 1min)
autovacuum_vacuum_cost_limit = 1000    # More aggressive (from 200)

# -- Misc --
timezone = 'Africa/Accra'
lc_messages = 'en_US.UTF-8'
PGCONF

# Create PostgreSQL log directory
mkdir -p /var/www/riderguy/logs/postgresql
chown postgres:postgres /var/www/riderguy/logs/postgresql
chmod 750 /var/www/riderguy/logs/postgresql

# Validate config before restarting
echo ""
echo "Validating PostgreSQL configuration..."
if sudo -u postgres pg_ctlcluster 16 main start --dry-run 2>&1 | grep -qi "error"; then
    echo "ERROR: Config validation failed!"
    cp "${PG_CONF}.backup" "$PG_CONF"
    echo "Original config restored from backup."
    exit 1
fi

# Restart PostgreSQL
echo "Restarting PostgreSQL..."
systemctl restart postgresql

# Verify it came back up
sleep 2
if systemctl is-active postgresql | grep -q active; then
    echo ""
    echo "PostgreSQL is running with new configuration."
    echo ""
    echo "Key settings applied:"
    sudo -u postgres psql -c "SELECT name, setting, unit FROM pg_settings WHERE name IN ('shared_buffers', 'effective_cache_size', 'work_mem', 'maintenance_work_mem', 'max_connections', 'wal_buffers', 'random_page_cost', 'effective_io_concurrency', 'max_worker_processes', 'max_parallel_workers_per_gather', 'log_min_duration_statement');" 2>/dev/null
    echo ""
    echo "✓ PostgreSQL tuned successfully"
else
    echo "ERROR: PostgreSQL failed to start!"
    journalctl -u postgresql --no-pager -n 20
    exit 1
fi
