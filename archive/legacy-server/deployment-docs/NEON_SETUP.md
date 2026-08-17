# ============================================================
# Neon Database Setup — RiderGuy
# ============================================================
#
# Neon provides serverless PostgreSQL with connection pooling,
# scale-to-zero, and database branching.
#
# ── INITIAL SETUP ────────────────────────────────────────────
#
# 1. Sign up at https://console.neon.tech
# 2. Create a new project:
#    - Name: riderguy
#    - Region: AWS us-east-2 (or closest to your Render region)
#    - Postgres version: 16
# 3. A default database `neondb` is created automatically.
#    Rename it to `riderguy` or create a new one.
#
# ── CONNECTION STRINGS ───────────────────────────────────────
#
# Go to: Dashboard → Connection Details → select your database
#
# You need TWO connection strings:
#
# 1. POOLED (for your app — DATABASE_URL):
#    Toggle "Pooled connection" ON
#    postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/riderguy?sslmode=require&pgbouncer=true
#
# 2. DIRECT (for migrations — DIRECT_URL):
#    Toggle "Pooled connection" OFF
#    postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/riderguy?sslmode=require
#
# ── APPLY SCHEMA ─────────────────────────────────────────────
#
# From your local machine, set DATABASE_URL and DIRECT_URL in
# your .env file, then run:
#
#   cd packages/database
#   npx prisma migrate deploy    # Apply all migrations
#   npm run seed                 # (Optional) Seed sample data
#
# Or for first-time setup (no migrations yet):
#
#   npx prisma db push           # Push schema directly
#   npm run seed
#
# ── BRANCHING (dev/staging) ──────────────────────────────────
#
# Neon supports database branching like Git:
#
# 1. Dashboard → Branches → Create Branch
# 2. Name it "staging" or "dev"
# 3. Get its connection string
# 4. Use it as DATABASE_URL in your dev/staging environment
#
# Each branch is a full copy of the database at a point in time,
# with its own connection string.
#
# ── FREE TIER LIMITS ─────────────────────────────────────────
#
# - 0.5 GB storage
# - 190 compute hours/month (auto-suspends after 5 min idle)
# - 1 project, 10 branches
#
# Sufficient for development and early production. Upgrade to
# Scale ($19/mo) when you need more.
#
# ── HOW IT WORKS WITH PRISMA ─────────────────────────────────
#
# The @riderguy/database package auto-detects Neon in production:
#
# - Production (NODE_ENV=production + DATABASE_URL contains "neon"):
#   Uses @neondatabase/serverless driver via @prisma/adapter-neon
#   for WebSocket-based connection pooling.
#
# - Development:
#   Uses standard Prisma TCP connection (works with local
#   PostgreSQL or Neon direct URL).
#
# ============================================================
