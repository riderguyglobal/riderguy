# ============================================================
# Render Deployment — RiderGuy API
# ============================================================
#
# The Express API + Redis deploy to Render via the render.yaml blueprint.
#
# ── AUTOMATIC SETUP (recommended) ────────────────────────────
#
# 1. Go to https://dashboard.render.com/blueprints
# 2. Click "New Blueprint Instance"
# 3. Connect the `riderguyglobal/riderguy` GitHub repo
# 4. Render reads `render.yaml` and creates:
#    - riderguy-api (Web Service)
#    - riderguy-redis (Redis instance)
# 5. Fill in the environment variables marked `sync: false`:
#    - DATABASE_URL (from Neon — pooled connection string)
#    - DIRECT_URL (from Neon — direct connection string)
#    - SENDGRID_API_KEY
#    - PAYSTACK_SECRET_KEY
#    - FIREBASE_PROJECT_ID
#    - FIREBASE_CLIENT_EMAIL
#    - FIREBASE_PRIVATE_KEY
# 6. Deploy
#
# ── MANUAL SETUP ─────────────────────────────────────────────
#
# If you prefer manual setup:
#
# 1. New → Web Service → Connect repo
# 2. Name: riderguy-api
# 3. Region: Frankfurt
# 4. Runtime: Node
# 5. Build Command:
#      npm install --legacy-peer-deps &&
#      cd packages/database && npx prisma generate && cd ../.. &&
#      rm -rf apps/api/dist &&
#      npx turbo run build --filter=@riderguy/api
# 6. Start Command: cd apps/api && node dist/index.js
# 7. Health Check Path: /health
# 8. Add all env vars listed in render.yaml
#
# ── NEON DATABASE URLS ───────────────────────────────────────
#
# From your Neon dashboard (https://console.neon.tech):
#
# DATABASE_URL (pooled — for the app):
#   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/riderguy?sslmode=require&pgbouncer=true
#
# DIRECT_URL (direct — for migrations):
#   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/riderguy?sslmode=require
#
# ── CUSTOM DOMAIN ────────────────────────────────────────────
#
# 1. In Render dashboard: riderguy-api → Settings → Custom Domains
# 2. Add: api.riderguy.com
# 3. Point DNS: CNAME → riderguy-api.onrender.com
#
# ── AUTO-DEPLOY ──────────────────────────────────────────────
#
# Render auto-deploys on push to `main` branch.
# To disable: Settings → Build & Deploy → Auto-Deploy = No
#
# ============================================================
