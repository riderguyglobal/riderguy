# ============================================================
# Vercel Deployment — RiderGuy Monorepo
# ============================================================
#
# This monorepo deploys 4 separate Vercel projects from one GitHub repo.
# Each project builds one Next.js frontend.
#
# ── SETUP (repeat for each app) ──────────────────────────────
#
# 1. Go to https://vercel.com/new
# 2. Import the `riderguyglobal/riderguy` GitHub repo
# 3. Set the "Root Directory" to the app folder (see table below)
# 4. Framework Preset: Next.js (auto-detected)
# 5. Build Command: leave default (Vercel auto-detects Turborepo)
# 6. Install Command: `npm install --legacy-peer-deps`
# 7. Add environment variables (see below)
# 8. Deploy
#
# ── PROJECT CONFIGURATION ────────────────────────────────────
#
# | Project Name      | Root Directory       | Domain                    |
# |-------------------|----------------------|---------------------------|
# | riderguy-rider    | apps/rider           | rider.riderguy.com        |
# | riderguy-client   | apps/client          | app.riderguy.com          |
# | riderguy-admin    | apps/admin           | admin.riderguy.com        |
# | riderguy-marketing| apps/marketing       | riderguy.com              |
#
# ── ENVIRONMENT VARIABLES (per project) ──────────────────────
#
# All 4 frontends need:
#   NEXT_PUBLIC_API_URL          = https://api.riderguy.com/api/v1
#   NEXT_PUBLIC_APP_URL          = (the app's own domain)
#
# Rider & Client apps also need (for PWA push):
#   NEXT_PUBLIC_FIREBASE_API_KEY
#   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
#   NEXT_PUBLIC_FIREBASE_APP_ID
#   NEXT_PUBLIC_FIREBASE_VAPID_KEY
#
# Marketing app also needs:
#   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (for contact page map, if used)
#
# ── TURBOREPO REMOTE CACHING ────────────────────────────────
#
# Vercel auto-enables Turborepo remote caching when it detects
# turbo.json. No additional config needed — builds are cached
# across deployments automatically.
#
# ── CUSTOM DOMAINS ───────────────────────────────────────────
#
# After deployment, in each Vercel project:
#   Settings → Domains → Add your custom domain
#   Point DNS: CNAME → cname.vercel-dns.com
#
# ============================================================
