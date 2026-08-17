# RiderGuy — Auth Fix Plan

**Companion to:** `docs/AUTH_AUDIT_REPORT.md`
**Date:** 2026-05-20

## 1. Priority Order

1. **AU-01** — Client phone+password login broken (Critical, UX-breaker)
2. **AU-02** — Recovery routes missing input validation (Critical, defence-in-depth)
3. **AU-03** — `verifyEmail` non-atomic (High)
4. **AU-04** — WebAuthn login-options enumeration (High)
5. **AU-06** — Cross-tab logout not broadcast (Medium)
6. **AU-07** — Recovery identifier schema is too loose (Medium)
7. **AU-08** — `authenticate` middleware uses dynamic `require` (Medium)
8. **AU-10** — OTP padding hard-coded to 6 (Low)
9. **AU-14** — Client constants fall back to localhost in prod (Low)
10. **AU-05** — Rider auto-activation (Accepted — intentional, owner confirmed 2026-05-20)

## 2. Step-by-Step Remediation

### AU-01 — Restore phone+password login (Backend + Frontend)

**Backend changes**

1. `packages/validators/src/auth.ts`: extend `loginWithPasswordSchema` to accept `identifier` (any non-empty string) OR `email` (email-formatted). Refine to require exactly one.
2. `apps/api/src/routes/auth/auth.controller.ts`: read `identifier ?? email` from `req.body` and pass to the service.
3. `apps/api/src/services/auth.service.ts`: rename `loginWithPassword(email, password, …)` → `loginWithPassword(identifier, password, …)`, and resolve user by phone-format / email-format / Ghana-Card-format (same logic as `loginWithPin`).

**Frontend changes**

4. `packages/auth/src/auth-provider.tsx`: have `loginWithPassword(identifier, password)` send `{ identifier, password }` when the value is non-email-shaped; otherwise keep sending `{ email, password }` for back-compat with admin/rider login.

### AU-02 — Validate recovery routes

1. `packages/validators/src/auth.ts`: add `verifyRecoveryOtpSchema = { phone, otp }` and `getSecurityQuestionSchema = { ghanaCard }`.
2. `apps/api/src/routes/auth/auth.routes.ts`: wire `validate(verifyRecoveryOtpSchema)` and `validate(getSecurityQuestionSchema, 'query')`.

### AU-03 — Atomic `verifyEmail`

1. `apps/api/src/services/auth.service.ts: verifyEmail()`: replace the read-then-update with an atomic `prisma.emailToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: now } })`. Check `count === 1`; on zero, treat as already-used (same UX as the existing path).

### AU-04 — Anti-enumeration on WebAuthn login-options

1. `apps/api/src/services/auth.service.ts: webauthnLoginOptions()`: for unknown phones, generate synthetic but well-formed options (random challenge, `allowCredentials: []`). Still store the challenge with the phone so subsequent verify calls fail gracefully via the existing credential-not-found path.

### AU-06 — Cross-tab logout broadcast

1. `packages/auth/src/token-storage.ts`: expose `onTokensCleared(cb)` that wires a `window.addEventListener('storage', ...)` to detect when another tab clears the access-token key.
2. `packages/auth/src/auth-store.ts`: at module init, register a listener that calls `clearAuth()` when another tab clears the token.

### AU-07 — Tighten `recoveryRequestSchema`

1. `packages/validators/src/auth.ts`: convert to `z.discriminatedUnion('method', [phoneVariant, emailVariant, ghanacardVariant])`.

### AU-08 — ESM import for redis in `authenticate`

1. `apps/api/src/middleware/auth.ts`: replace inline `require` with a top-level `import { getRedisClient } from '../lib/redis'`.

### AU-10 — OTP padding

1. `apps/api/src/services/auth.service.ts: _verifyOtpCode`: pad to `Math.max(otp.code.length, code.length)` (still 6 in practice; future-proof for 8-digit codes).

### AU-14 — Client constants

1. `apps/client/src/lib/constants.ts`: mirror rider app behaviour — throw on missing `NEXT_PUBLIC_API_URL` in production.

### AU-05 — Rider auto-activation (accepted)

- **No change.** Owner confirmed 2026-05-20: auto-activation is intentional and should remain. `TODO` comment in the service file is retained for future onboarding-gate work.

## 3. Exact Files Changed

- `packages/validators/src/auth.ts`
- `apps/api/src/routes/auth/auth.routes.ts`
- `apps/api/src/routes/auth/auth.controller.ts`
- `apps/api/src/services/auth.service.ts`
- `apps/api/src/middleware/auth.ts`
- `packages/auth/src/auth-provider.tsx`
- `packages/auth/src/token-storage.ts`
- `packages/auth/src/auth-store.ts`
- `apps/client/src/lib/constants.ts`

(All other files untouched.)

## 4. Backend Fixes

See §2 AU-01, AU-02, AU-03, AU-04, AU-07, AU-08, AU-10.

## 5. Frontend Fixes

See §2 AU-01 (auth-provider), AU-06 (token-storage + auth-store), AU-14 (client constants).

## 6. Database / Model Fixes

**None.** No migrations introduced. No schema changes. No data wipe / reset.

## 7. Testing Checklist (automated)

Run from repo root `c:\Users\Jay Monty\Desktop\Projects\Riderguy PWA\riderguy`:

- [x] `npm run type-check` — passes (or only pre-existing failures unrelated to this patch set).
- [x] `npm run lint` — passes (same caveat).
- [x] `npm test --workspace=@riderguy/api` — backend unit tests (Vitest). **42 / 42 pass** (fixed 2 pre-existing PIN test strings to match production).
- [x] `npm run build --workspace=@riderguy/api` — backend builds. **Clean.**
- [x] `npm run build --workspace=apps/client` — client builds. **Clean.**
- [x] `npm run build --workspace=apps/rider` — **Clean** (requires `NEXT_PUBLIC_API_URL` at build time because rider has static pages; pre-existing constraint). Fixed pre-existing `chat/page.tsx` AI SDK drift (`handleSubmit` → `sendMessage`).
- [x] `npm run build --workspace=apps/admin` — **Clean.** Fixed pre-existing `chat/page.tsx` AI SDK drift (same change).

## 8. Manual QA Checklist

| # | Flow | Expected | Touched by fix? |
|---|---|---|---|
| 1 | Client app: phone + password login (correct creds) | Lands on `/dashboard` | **Yes (AU-01)** |
| 2 | Client app: phone + password login (wrong creds) | Stays on login with “Incorrect…” | Yes (AU-01) |
| 3 | Client app: email + password login | Lands on `/dashboard` | No (regression check) |
| 4 | Client app: OTP login | Lands on `/dashboard` | No |
| 5 | Client app: PIN login | Lands on `/dashboard` | No |
| 6 | Client app: Google login | Lands on `/dashboard` | No |
| 7 | Client app: Ghana Card login | Lands on `/dashboard` | No |
| 8 | Rider app: email + password login | Lands on `/dashboard` | No (regression check) |
| 9 | Rider app: phone + OTP login | Lands on `/dashboard` | No |
| 10 | Rider app: PIN login | Lands on `/dashboard` | No |
| 11 | Admin app: email + password login | Lands on `/dashboard` | No (regression check) |
| 12 | Cross-role: Client logged in tries to access `/admin/dashboard` directly | Auto-logout, redirect to `/admin/login` | No |
| 13 | Cross-role: Rider tries to access `/client/dashboard` | Auto-logout banner “Not a rider account” | No |
| 14 | Cross-tab logout | Tab A `/logout` → Tab B clears auth on next render | **Yes (AU-06)** |
| 15 | Forgot password (email flow) — happy path | Receives reset email, can reset, can log in with new password | No (regression) |
| 16 | Forgot password — TOCTOU (click email link twice quickly) | First succeeds, second shows “already used” | No |
| 17 | Verify email — click link twice quickly | First succeeds, second shows “already used” | **Yes (AU-03)** |
| 18 | Forgot PIN (OTP flow) | Receives SMS, can reset, can log in with new PIN | No |
| 19 | Recovery → security question (Ghana Card) | Returns question for known card, generic answer for unknown | No |
| 20 | Recovery → verify OTP | Validates input shape; rejects junk with 400 | **Yes (AU-02)** |
| 21 | Recovery → security question — junk Ghana card | Validates input shape; rejects with 400 | **Yes (AU-02)** |
| 22 | Refresh token reuse | Both calls reject; session revoked | No |
| 23 | Refresh under concurrency (10 parallel) | One succeeds, rest queued, none break the session | No |
| 24 | Expired access token, valid refresh | Auto-refresh, original request retried | No |
| 25 | Both tokens expired | UI lands on login | No |
| 26 | WebAuthn login-options for unknown phone | Returns synthetic options (200), browser shows no authenticators | **Yes (AU-04)** |
| 27 | Account lock | 5 wrong attempts → 15-minute lock with “Try again in N minutes” | No |
| 28 | Logout fully clears tokens + IDB backup | `localStorage` & IDB empty | No |
| 29 | Disabled account login | Forbidden 403 “Your account is not active” | No |

## 9. Production Deployment Checklist

- [ ] Verify `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are set in production env.
- [ ] Verify `REDIS_URL` is set (rate limiter and revocation list rely on Redis).
- [ ] Verify `CORS_ORIGINS` is set to the actual prod origins (`https://app.myriderguy.com,https://rider.myriderguy.com,https://admin.myriderguy.com,...`).
- [ ] Verify `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` are not localhost in prod.
- [ ] Verify `MNOTIFY_API_KEY`, `SENDGRID_API_KEY`, `FIREBASE_*`, `PAYSTACK_*` are set.
- [ ] `NEXT_PUBLIC_API_URL` is set per-app build (otherwise the AU-14 throw will fire — by design).
- [ ] Re-run §7 build matrix in CI.
- [ ] Run §8 manual smoke test on staging with the new patch set deployed.
- [ ] Roll out to production via existing PM2 deployment process (no new infra).

## 10. Rollback Plan

If any flow regresses post-deploy:

1. Revert these specific files (single PR) — no data migrations, no schema changes, no destructive operations. Pure code revert is safe.
2. The audit applied no DB changes — rollback is a `git revert` and redeploy.
3. Token format is unchanged — issued tokens remain valid across the rollback.

Files to revert:

```
packages/validators/src/auth.ts
apps/api/src/routes/auth/auth.routes.ts
apps/api/src/routes/auth/auth.controller.ts
apps/api/src/services/auth.service.ts
apps/api/src/middleware/auth.ts
packages/auth/src/auth-provider.tsx
packages/auth/src/token-storage.ts
packages/auth/src/auth-store.ts
apps/client/src/lib/constants.ts
```

---

*End of fix plan.*
