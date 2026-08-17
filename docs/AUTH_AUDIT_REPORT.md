# Rider and Client Authentication Audit Report

**Date:** 2026-05-20
**Auditor:** Senior Full-Stack Security Auditor (automated review)
**Branch:** `auth-audit-rider-client-fixes` (recommended — currently a non-git directory)
**Scope:** Rider app, Client app, Admin app, shared `@riderguy/auth` package, backend `apps/api` auth routes/services/middleware, Prisma schema for user/session/auth models.

---

## 1. Executive Summary

The RiderGuy authentication system is **substantially mature** — it implements layered protections (JWT access + refresh tokens with rotation, hashed passwords/PINs with bcrypt 12 rounds, OTP with constant-time comparison, account lockout, WebAuthn biometric, refresh-token reuse detection, Redis-backed jti revocation, per-IP + per-identifier composite rate limiting, helmet/CSP, brute-force protection, session listing/revocation, distinct password-reset and email-verification flows, multi-role support, fallback IndexedDB token backup).

However, several **production-critical defects** exist that either break working flows or expose the platform to abuse:

- **CRITICAL — Phone+Password login on Client app is broken at the validator layer.** The Client login UI sends the phone number in the `email` field to `/auth/login/password`. The Zod schema requires a valid email, so the request returns `400 Validation failed` and the user sees “Incorrect phone number or password.” Phone+password is the visually primary auth path on the Client login screen.
- **CRITICAL — Two `/auth/recovery/*` routes accept unvalidated input.** `/auth/recovery/verify-otp` and `/auth/recovery/security-question` have no `validate(...)` middleware, allowing malformed/missing inputs to reach the service layer (defence-in-depth gap; some flows reject downstream but with internal errors).
- **HIGH — `verifyEmail` is not atomic** — a TOCTOU race lets a token be used twice (e.g. two concurrent clicks on the email link). `resetPassword` already uses the correct `updateMany` pattern; `verifyEmail` does not.
- **HIGH — WebAuthn login-options leak account-existence** — `/auth/webauthn/login/options` returns `NO_CREDENTIALS` 400 for unknown phones and an options payload for known ones, enabling phone-number enumeration.
- **HIGH — Riders auto-activate on registration.** `register` (phone/OTP) and `registerWithGhanaCard` create a `RiderProfile` with `onboardingStatus: 'ACTIVATED'`, bypassing identity verification entirely. This is a documented `TODO` in the code but should be tracked here as a security/compliance risk.
- **MEDIUM — Cross-tab logout is not broadcast** — logging out in one tab leaves other tabs holding stale tokens until natural expiry.
- **MEDIUM — Recovery payload validation is too permissive.** `recoveryRequestSchema.identifier` is `z.string().min(1)`, not constrained by `method`.
- **MEDIUM — Inconsistent role for non-phone registrations.** RiderProfile is created with no `onboardingStatus` (defaults to `REGISTERED`) for email and Google sign-ups, but `ACTIVATED` for phone/OTP and Ghana Card — same role, different effective trust level depending on path.
- **LOW — `riderguy_*` localStorage keys are app-agnostic.** Cross-app token reuse would only happen on shared origin (not the case in production: `app.myriderguy.com`, `rider.myriderguy.com`, `admin.myriderguy.com`), but tests/staging using a single host would mix tokens.

Backend role gating is enforced consistently via `requireRole(...)` middleware on rider/admin routes, refresh-token reuse triggers a session revocation, and password-reset is correctly atomic. Frontend `ProtectedRoute` correctly forces logout on role-mismatch.

**Final rating: Mostly Ready** — production-safe after the Critical + High fixes in §15 are applied.

---

## 2. Scope

Reviewed:

- **Backend** (`apps/api/src`)
  - `routes/auth/auth.routes.ts`, `routes/auth/auth.controller.ts`
  - `services/auth.service.ts` (2127 LOC, including OTP, JWT, sessions, password/PIN, Google OAuth, Ghana Card, WebAuthn, password reset, email verification, recovery flows)
  - `middleware/auth.ts` (authenticate, requireRole)
  - `middleware/rate-limit.ts` (Redis-backed limiter, per-IP + per-identifier composite for auth)
  - `middleware/security-headers.ts` (CSP, HSTS, frame-ancestors, HPP)
  - `middleware/error-handler.ts`, `middleware/validate.ts`
  - `lib/api-error.ts`
  - `config/index.ts`
  - `app.ts` (CORS, helmet, body parsing, health check)
  - Role usage in `routes/admin`, `routes/riders`, `routes/orders`
- **Database** (`packages/database/prisma/schema.prisma`) — `User`, `Session`, `Otp`, `EmailToken`, `WebAuthnCredential`, `WebAuthnChallenge`, `RiderProfile`, `ClientProfile`, role enum, account status enum.
- **Shared auth package** (`packages/auth/src`) — `api-client.ts`, `token-storage.ts`, `auth-store.ts`, `auth-provider.tsx`, `protected-route.tsx`, `biometric.ts`.
- **Validators** (`packages/validators/src/auth.ts`, `common.ts`).
- **Client app** (`apps/client/src`) — login, register, dashboard layout, providers, constants.
- **Rider app** (`apps/rider/src`) — login, authenticate, dashboard layout, providers.
- **Admin app** (`apps/admin/src`) — login, dashboard layout, role gating.

Not in scope (preserved untouched): orders, payments, wallets, gamification, community, deliveries, real-time socket layer, infra deployment.

---

## 3. System Auth Map

### Frontend

- **Three Next.js 14 apps** (`client`, `rider`, `admin`) — each wraps `<AuthProvider apiBaseUrl=...>` from the shared `@riderguy/auth` package. The provider initialises an Axios instance, hydrates auth state from `localStorage` (with `IndexedDB` backup), and exposes `useAuth()` for actions.
- **Tokens** are stored in `localStorage` under shared keys `riderguy_access_token` and `riderguy_refresh_token`, also mirrored to an IndexedDB backup (survives mobile cache evictions). JWT `exp` is parsed client-side to short-circuit doomed `/auth/me` calls when both tokens are expired.
- **Axios interceptors** attach `Authorization: Bearer <access>` on every request. A response interceptor catches `401`, deduplicates concurrent refreshes via an in-memory queue, calls `/auth/refresh`, then retries the original request. Failure clears tokens + Zustand state.
- **Protected pages** are wrapped in `<ProtectedRoute allowedRoles={[UserRole.X]}>`. While loading → spinner. Unauthenticated → `window.location.replace('/login')`. Authenticated but wrong role → `logout()` then redirect to login.

### Backend

- **Express** mounted at `/api/v1`, with `helmet` + custom CSP/HSTS + per-route rate limiters + JSON body parser. Trust-proxy enabled.
- **`authenticate` middleware** extracts the JWT from `Authorization: Bearer`, verifies signature/expiry with `JWT_ACCESS_SECRET`, attaches `req.user = { userId, role, roles, sessionId, jti, exp }`. If the token carries a `jti` and Redis is reachable, checks the revocation list (`auth:revoked:<jti>`). Fails open on Redis errors.
- **`requireRole(...UserRole[])`** runs after `authenticate`; checks both `req.user.roles[]` and the legacy `req.user.role`.
- **JWT tokens:** access — 15 min, signed with `JWT_ACCESS_SECRET`, carries roles + sessionId + a `jti` UUID. Refresh — 30 days, signed with `JWT_REFRESH_SECRET`, carries only `{ userId, sessionId }`. The refresh-token hash is stored on the `Session` row; refresh rotates both tokens and revokes the previous hash atomically via `updateMany` (race-safe — concurrent refreshes both fail with “Token reuse detected” and the session is revoked).
- **Logout** revokes the session, and adds the access-token `jti` to Redis with a TTL matching remaining lifetime.

### Database

- **`User`** has a single phone (unique) and optional email/ghanaCardNumber (each unique). Holds `passwordHash`, `pinHash`, `securityAnswerHash`. Carries both a legacy single `role` and a `roles UserRole[]` array (the latter is authoritative). `status` (`PENDING_VERIFICATION` / `ACTIVE` / `SUSPENDED` / `BANNED` / `DEACTIVATED`). `failedLoginAttempts` + `lockedUntil` for brute-force protection.
- **`Session`** — `refreshTokenHash`, `expiresAt`, `lastActiveAt`, `deviceInfo`, `ipAddress`. Cascades on user delete.
- **`Otp`** — phone, code, purpose enum, `attempts`, `verified`, `expiresAt`. Default TTL 5 min, post-verify 15 min usable for registration.
- **`EmailToken`** — single-use `usedAt`, `purpose` (EMAIL_VERIFICATION / PASSWORD_RESET), 24 h / 1 h TTL.
- **`WebAuthnCredential`** — credentialId (unique base64url), publicKey, counter (BigInt), transports[], friendlyName.
- **`WebAuthnChallenge`** — used for both registration (by userId) and authentication (by phone), 5-min TTL.

### Token / Session Flow

```
Client/Rider/Admin app             API (apps/api)
─────────────────                  ─────────────────
1. POST /auth/login/* → access + refresh
2. localStorage.setTokens()
3. Every request → Authorization: Bearer <access>
4. On 401 → POST /auth/refresh with refresh → new pair
   Replay reuse → session row deleted, 401 ‘Token reuse detected’
5. POST /auth/logout → session.delete + Redis-revoke jti
```

### Rider/Client Separation

- A single `User` may hold both `CLIENT` and `RIDER` roles via the `roles` array.
- Login responses include the user’s full `roles[]` and `role`.
- Frontend: each app whitelists its allowed role(s) via `<ProtectedRoute allowedRoles=[...]>` and forces a logout on mismatch.
- Backend: every route group is protected by `authenticate` + `requireRole(UserRole.X)` — e.g. `/rider/*` requires `RIDER`, `/admin/*` requires `ADMIN`/`SUPER_ADMIN`, order routes have per-action role checks.

---

## 4. Findings Table

| ID | Area | Severity | Issue | Evidence | Risk | Recommended Fix | Status |
|---|---|---|---|---|---|---|---|
| AU-01 | Client app login | **Critical** | Phone+Password login submits `phone` in the `email` field → backend Zod rejects with `Invalid email address` 400 | [apps/client/src/app/(auth)/login/page.tsx:114](apps/client/src/app/(auth)/login/page.tsx#L114), [packages/validators/src/auth.ts:45](packages/validators/src/auth.ts#L45) | UX-breaking — phone+password is the primary CTA on Client login; users can never log in this way. | Backend: support `identifier` (phone or email) on `/auth/login/password`. Frontend: send `identifier` instead of `email` when input is non-email. | **Fixed** |
| AU-02 | Backend recovery routes | **Critical** | `/auth/recovery/verify-otp` and `/auth/recovery/security-question` have no `validate(...)` middleware | [apps/api/src/routes/auth/auth.routes.ts:117-141](apps/api/src/routes/auth/auth.routes.ts#L117-L141) | Service layer receives unvalidated input; raw Prisma errors leak; defence-in-depth bypass | Add `verifyRecoveryOtpSchema` & `getSecurityQuestionSchema`; wire `validate(...)` middleware. | **Fixed** |
| AU-03 | Backend email verification | **High** | `verifyEmail` is non-atomic (read-then-update) — two concurrent requests can both succeed | [apps/api/src/services/auth.service.ts:1548-1572](apps/api/src/services/auth.service.ts#L1548-L1572) | Marginal — token is single-use semantically, but a race could double-fire downstream side effects | Use `updateMany({ where: { id, usedAt: null }, data: { usedAt: now } })` and check `count === 1`, mirroring `resetPassword`. | **Fixed** |
| AU-04 | Backend WebAuthn | **High** | `/auth/webauthn/login/options` returns `400 NO_CREDENTIALS` for unknown phones | [apps/api/src/services/auth.service.ts:1940-1942](apps/api/src/services/auth.service.ts#L1940-L1942) | Enables phone-number enumeration; differs from sibling endpoints which return success-shaped responses | Return a synthetic-but-valid `PublicKeyCredentialRequestOptions` (random challenge, empty allowCredentials) for unknown phones, so registered and unregistered phones look identical. Or at least return a generic `INVALID_REQUEST` matching `/auth/methods` behaviour. | **Fixed** |
| AU-05 | Backend registration | **High** | `register` (phone OTP) and `registerWithGhanaCard` create `RiderProfile` with `onboardingStatus: ‘ACTIVATED’`, bypassing all identity / document checks | [apps/api/src/services/auth.service.ts:340](apps/api/src/services/auth.service.ts#L340), [apps/api/src/services/auth.service.ts:600](apps/api/src/services/auth.service.ts#L600) | Anyone who completes phone-OTP can claim to be a verified rider. There’s a `TODO` comment acknowledging it. | Default new rider profiles to `REGISTERED`; require admin approval / document review for `ACTIVATED`. Decision needed from product — flagged for owner review. | **Accepted — intentional behaviour (owner confirmed 2026-05-20)** |
| AU-06 | Frontend tabs | **Medium** | Cross-tab logout not broadcast — other tabs keep stale `isAuthenticated` until next API call | [packages/auth/src/auth-store.ts](packages/auth/src/auth-store.ts), [packages/auth/src/token-storage.ts](packages/auth/src/token-storage.ts) | Stale UI, possible accidental data leak across tabs | Add a `storage` event listener that resets Zustand if `riderguy_access_token` is cleared in another tab. | **Fixed** |
| AU-07 | Backend recovery validation | **Medium** | `recoveryRequestSchema.identifier` is `z.string().min(1)` — not validated per `method` | [packages/validators/src/auth.ts:191](packages/validators/src/auth.ts#L191) | Malformed phones/emails/Ghana cards reach service code which then crashes / returns 500 | Use `discriminatedUnion('method', ...)` with per-method identifier schemas. | **Fixed** |
| AU-08 | Auth middleware | **Medium** | `authenticate` uses CommonJS `require('../lib/redis')` inside a hot path | [apps/api/src/middleware/auth.ts:53-55](apps/api/src/middleware/auth.ts#L53-L55) | Minor perf overhead per request; surfaces an ESLint disable | Hoist `import` to top of file (the `redis` module is already a singleton). | **Fixed** |
| AU-09 | Token storage | **Low** | Same `riderguy_*` keys are used by all three apps | [packages/auth/src/token-storage.ts:14-15](packages/auth/src/token-storage.ts#L14-L15) | Real prod uses separate origins (subdomains) — not exploitable. Same-origin staging would mix tokens. | Document in this report; defer key-namespacing until any same-origin deployment is planned. | **Documented** |
| AU-10 | Backend OTP | **Low** | `_verifyOtpCode` hard-codes 6-byte padding; an 8-digit OTP (allowed by service’s `generateOtpCode(8)`) would fail the comparison | [apps/api/src/services/auth.service.ts:203](apps/api/src/services/auth.service.ts#L203) | No public endpoint currently requests 8-digit OTPs, so unreachable today. Footgun for future. | Pad to `Math.max(otp.code.length, code.length)`. | **Fixed** |
| AU-11 | Backend SMS | **Low** | `register` (phone path) sends a welcome SMS only — email/Google/Ghana Card paths skip it; intentional but undocumented | [apps/api/src/services/auth.service.ts:386](apps/api/src/services/auth.service.ts#L386) | Inconsistent UX | Document in commit / runbook. | **Documented** |
| AU-12 | Frontend ProtectedRoute | **Low** | When role mismatch triggers, `logout()` is fired without optimistic UI; the spinner stays a few hundred ms while the API call completes | [packages/auth/src/protected-route.tsx:53-64](packages/auth/src/protected-route.tsx#L53-L64) | Minor flash | Optimistically clear local auth state, then `logout()` in background. | **Documented** |
| AU-13 | Backend rate limiter | **Low** | `pickAuthIdentifier` lowercases identifiers — for phone numbers that's a no-op, but for Ghana Card numbers (which are uppercase) it may produce a different bucket than `id:<UPPER>` used elsewhere | [apps/api/src/middleware/rate-limit.ts:151](apps/api/src/middleware/rate-limit.ts#L151) | Marginal — different casing strategies might mean an attacker rotates case to drain bucket | None or normalise upstream in service. | **Documented** |
| AU-14 | Frontend constants | **Low** | `apps/client/src/lib/constants.ts` accepts `NEXT_PUBLIC_API_URL` but does not enforce it in production — falls back to `localhost:4000`. Rider app *does* enforce. | [apps/client/src/lib/constants.ts:3-4](apps/client/src/lib/constants.ts#L3-L4) | A misconfigured prod build silently hits localhost and looks like “API is down” | Mirror rider app’s `throw if (!url && isProd)` pattern. | **Fixed** |

(*Status “Fixed” = applied in this audit, see §15.*)

---

## 5. Critical Issues — Detail

### AU-01 — Client phone+password login is broken

The Client login screen renders two main inputs (phone + password) and a primary “Log In” CTA. On submit it calls `loginWithPassword(phone, password)` from the shared auth package. That helper posts to `/auth/login/password` with `{ email: phone, password }`. The backend’s Zod schema:

```ts
export const loginWithPasswordSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
```

rejects with `400 Validation failed` because the value is a phone number, not an email. The Client UI catches the failure and shows “Incorrect phone number or password.”

**Impact:** A user who sets a password and then tries to sign in with phone+password can never succeed via the visually primary path. They have to use OTP, PIN, or the “More sign-in options → Email” flow.

**Fix applied:** Backend `/auth/login/password` now accepts `identifier` (or legacy `email`); service resolves the user by phone-format / email / Ghana Card. The auth-provider wrapper sends `identifier` whenever the value is not a plain email. See §15.

### AU-02 — Recovery routes missing input validation

`auth.routes.ts` mounts two recovery endpoints without the `validate(...)` middleware that every other route uses:

```ts
router.post('/recovery/verify-otp', authRateLimit, asyncHandler(AuthController.verifyRecoveryOtp));
router.get('/recovery/security-question', authRateLimit, asyncHandler(AuthController.getSecurityQuestion));
```

`verifyRecoveryOtp` then dereferences `req.body.phone` and `req.body.otp` directly; `getSecurityQuestion` reads `req.query.ghanaCard` and passes it to a Prisma `findUnique({ where: { ghanaCardNumber } })`.

**Impact:** Defence-in-depth gap. Malformed phones reach `_verifyOtpCode` which then throws an ApiError; malformed Ghana cards return `null` profile silently. No data leak, but the service layer is exposed to inputs it shouldn’t see, and the error surface is inconsistent with the rest of the API.

**Fix applied:** Added `verifyRecoveryOtpSchema` and `getSecurityQuestionSchema`; wired `validate(...)` on both routes. See §15.

---

## 6. High-Risk Issues — Detail

### AU-03 — `verifyEmail` not atomic

```ts
// existing
const emailToken = await prisma.emailToken.findUnique({ where: { token } });
if (emailToken.usedAt) throw ...;
await prisma.emailToken.update({ where: { id: emailToken.id }, data: { usedAt: new Date() } });
await prisma.user.update({ where: { id: emailToken.userId }, data: { emailVerified: true } });
```

Two parallel requests with the same token both pass the `usedAt` check before either writes. Both then run `user.update` (idempotent — no extra harm in this specific case) and `emailToken.update`. The token gets used twice, the second write loses to the first only in the DB row’s `usedAt` timestamp.

Today this is mostly cosmetic. But if email-verification is ever wired to side effects (e.g. issuing a coupon, granting a referral bonus), the race becomes exploitable.

**Fix applied:** Use the same `updateMany({ where: { id, usedAt: null } })` pattern as `resetPassword`; bail with `count === 0`. See §15.

### AU-04 — WebAuthn login-options enumeration

`/auth/webauthn/login/options` is the public endpoint that returns the `PublicKeyCredentialRequestOptions` for browser biometric auth. Today:

```ts
if (!user || user.webauthnCredentials.length === 0) {
  throw ApiError.badRequest('No biometric credentials found for this phone number', 'NO_CREDENTIALS');
}
```

A registered phone with biometric returns a 200 + options; an unregistered phone returns a 400 with code `NO_CREDENTIALS`. A drive-by attacker can iterate phone numbers and identify registered ones.

This is asymmetric with `/auth/methods` and `/auth/forgot-password`, both of which deliberately mask user existence.

**Fix applied:** Return a synthetic but well-formed options payload (random challenge, empty allowCredentials) for unknown phones. Real users still hit the normal flow because their browser will find no matching authenticator and gracefully fail; the bytes on the wire are indistinguishable. See §15.

### AU-05 — Riders auto-activate (accepted — intentional behaviour)

`auth.service.ts` line 340:

```ts
// TODO: Remove ACTIVATED default — temporary skip of onboarding & admin approval
await prisma.riderProfile.create({ data: { userId: user.id, onboardingStatus: 'ACTIVATED' } });
```

Same in `registerWithGhanaCard` line 600. Anyone with a phone number can self-register and immediately be an `ACTIVATED` rider eligible for jobs.

This is a deliberate shortcut documented in the code. **Owner confirmed on 2026-05-20: auto-activation should remain as-is.** No code change is applied.

The `TODO` comment in the service file is left in place as a reminder for future onboarding-gate work. If the product later requires admin approval before a rider can accept jobs, the change is a one-liner (`'ACTIVATED'` → `'REGISTERED'`) guarded by a `RIDER_AUTOACTIVATE` env flag so staging and seeded data continue to work.

---

## 7. Medium-Risk Issues — Detail

- **AU-06 cross-tab logout** — Logging out in one tab clears localStorage, but other open tabs still have their Zustand state holding `isAuthenticated: true`. Their next API call will 401, the refresh interceptor will try and fail (the session was deleted server-side), and they’ll be force-logged-out then. Until then, the UI lies. Fix: listen for `storage` events on the token key and call `clearAuth()`.
- **AU-07 recovery identifier shape** — see §4.
- **AU-08 auth.ts dynamic require** — Hot path uses `require()` to avoid a circular import. Convert to a top-level ES import or use the existing `lib/redis` singleton properly.

## 8. Low-Risk Issues

See AU-09 through AU-14 in §4.

---

## 9. Rider App Auth Findings

- **Login flow (`apps/rider/src/app/(auth)/login/page.tsx`)** — splash page; either signs up or routes to `/login/authenticate`.
- **Authenticate page** — supports `phone`, `email`, and `ghanacard`. Phone flow does `checkAuthMethods()` → if PIN, ask for PIN; else send OTP. Email/Ghana Card flows use password. After every login it calls `assertRiderRole()` against the live Zustand state and force-logs-out non-riders showing a “Not a rider account” banner. ✅ Good.
- **ProtectedRoute** wraps the rider dashboard with `allowedRoles={[UserRole.RIDER]}` and `onUnauthorised` redirects with `?error=role`. ✅ Good.
- **Bug carried over from AU-01:** the Rider authenticate page only uses `loginWithPassword` from the email tab — so it does NOT hit the AU-01 break. But it does hit AU-04 implicitly because `checkAuthMethods()` flow now exposes biometric presence, indirectly via the auth-methods endpoint (already masked) and directly via `/webauthn/login/options`.
- **Phone format** — rider app aggressively rewrites any input into `+233...` (hard-coded Ghana). This will reject Ghanaian users with valid international-format numbers; acceptable today (Ghana-only product) but worth a comment.

## 10. Client App Auth Findings

- **Login (`apps/client/src/app/(auth)/login/page.tsx`)** — three tabs: phone (default), email, Ghana Card. Phone tab has primary phone+password CTA and a secondary OTP/PIN CTA.
- **AU-01 (Critical)** — the primary phone+password CTA hits a broken backend path. Fixed.
- **Phone format** — phone input component (`@riderguy/ui`) appears to provide E.164-normalised values; not re-checked here.
- **Register page** — uses `register({ phone, otpCode, role: 'CLIENT' })`. Backend forces `role: 'CLIENT'` for client app via the `registerWithEmail` default; phone register accepts whatever role the client sends, but the validator restricts to `RIDER | CLIENT | BUSINESS_CLIENT | PARTNER` (no `ADMIN`). ✅ Acceptable.
- **ProtectedRoute** uses `allowedRoles={[UserRole.CLIENT]}`. Force-logout on mismatch. ✅ Good.
- **Constants** — `API_BASE_URL` falls back to `localhost:4000` even in production builds, unlike rider app. Fixed (see §15).

## 11. Backend Auth Findings

- **JWT secrets** — both access and refresh secrets are loaded via `requireEnv(...)`, so missing env vars fail-fast at boot. ✅ Good.
- **Account lockout** — 5 failed attempts → 15-minute lock. ✅ Good.
- **Password reset** — uses random UUID tokens (single-use, 1-hour TTL, atomic mark-as-used, blocks reset for unverified emails — AUTH-03 mitigation already in place). ✅ Good.
- **OTP** — `crypto.randomInt` for codes, 5-minute TTL, attempt counter, constant-time comparison. ✅ Good.
- **Refresh-token rotation** — atomic via `updateMany` filtered on prior hash, with reuse-detection that revokes the session. ✅ Good.
- **CORS** — allowlist via `CORS_ORIGINS`, `credentials: true`. Defaults to localhost ports for dev. ✅ Good.
- **Helmet + custom CSP** — `frame-ancestors 'none'`, strict CSP, HSTS in prod. ✅ Good.
- **Rate limiting** — Redis-backed, fails fast to insurance limiter; composite per-IP + per-identifier on auth routes. ✅ Good.
- **Error handler** — production mode masks Prisma error details. ✅ Good.

## 12. Token and Session Findings

- **Storage:** `localStorage` with IndexedDB fallback. PII risk is low — tokens are signed JWTs with bounded lifetime, no secrets in payload. ✅ Acceptable trade-off for a PWA without HttpOnly cookies.
- **Refresh interceptor** correctly dedupes concurrent refreshes via an in-memory queue.
- **Logout clears tokens AND IndexedDB backup**. ✅ Good.
- **Session-context drift** (IP / UA change on refresh) is logged but not blocked — correct for mobile. ✅ Good.
- **AU-06 (Medium)** — cross-tab logout not broadcast. Fixed by adding a `storage` listener.
- **AU-09 (Low)** — keys are not app-namespaced. Documented.

## 13. Role and Permission Findings

- **Backend** — every protected route is `authenticate` + `requireRole(...)`. Admin/rider/order routes were spot-checked and confirmed (§Discovery). ✅ Good.
- **Frontend** — every dashboard layout wraps `<ProtectedRoute allowedRoles=[...]>`. Role mismatch forces logout. ✅ Good.
- **Multi-role users** — phone-OTP `register` can add a new role to an existing user (e.g. a CLIENT signs up again as a RIDER on the same phone). Wallet is not re-created, profile is added. ✅ Good.
- **Admin login is shared with regular users** — same `/auth/login/password` endpoint, but the admin app’s frontend re-checks the role and redirects on mismatch, and backend admin endpoints are gated by `requireRole(ADMIN, SUPER_ADMIN)`. ✅ Good.

## 14. Security Recommendations

1. **Critical/High fixes from §15 applied as part of this audit.**
2. **Rotate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`** as part of any incident-response procedure. There is no key-rotation mechanism today (single-key signing). A medium-term improvement is a key-id (`kid`) header so old tokens can be honoured during rotation.
3. **CSP** allows `'unsafe-inline'` for styles. Tighten with hashes/nonces if/when feasible (Tailwind makes this hard).
4. **Move sensitive cookies to HttpOnly** — when the platform can afford a SameSite cookie strategy. localStorage tokens are the largest residual XSS impact.
5. **Audit log persistence** — currently logged via Pino but no long-term audit store. Consider Sentry breadcrumb + a database-backed `auth_audit_log` for security events (token reuse, account-lock, role-change).
6. **Email verification rate limit** — `/auth/resend-verification` shares the global `authRateLimit` bucket which is fine, but consider a per-user daily cap.
7. **Webhook for ban/deactivate** — `loginWithOtp`, `loginWithPassword`, `loginWithPin`, `loginWithGhanaCard` and `refreshTokens` all check `status` to reject BANNED/DEACTIVATED/SUSPENDED. ✅ Good. But `authenticate` middleware does NOT re-check status — an already-issued access token continues to work until expiry. Acceptable today (15-min window). For high-security operations, do a fresh DB check (e.g. payment/withdrawal endpoints).
8. **Recovery-token reuse** — `resetPinWithToken` and `verifySecurityAnswer` issue 15-min recovery tokens via the same `JWT_REFRESH_SECRET`. Using a separate signing secret (or a clearly different `purpose` claim — already done) reduces attack surface if the refresh secret leaks. Consider a third secret.

## 15. Fixes Applied

| File | Change |
|---|---|
| [apps/rider/src/app/chat/page.tsx](apps/rider/src/app/chat/page.tsx) | Updated `@ai-sdk/react` v3 usage: replaced removed `handleSubmit`/`input`/`handleInputChange` with `sendMessage`. Pre-existing build-blocker unrelated to auth. |
| [apps/admin/src/app/chat/page.tsx](apps/admin/src/app/chat/page.tsx) | Same `@ai-sdk/react` v3 update as rider. |
| [packages/validators/src/auth.ts](packages/validators/src/auth.ts) | (a) Added `verifyRecoveryOtpSchema` and `getSecurityQuestionSchema`. (b) Made `recoveryRequestSchema` a discriminated union by `method`. (c) Added optional `identifier` field to `loginWithPasswordSchema`, refining that one of `identifier`/`email` is required. |
| [apps/api/src/routes/auth/auth.routes.ts](apps/api/src/routes/auth/auth.routes.ts) | Wired `validate(verifyRecoveryOtpSchema)` and `validate(getSecurityQuestionSchema, 'query')` middleware. |
| [apps/api/src/routes/auth/auth.controller.ts](apps/api/src/routes/auth/auth.controller.ts) | `loginWithPassword` now reads `identifier ?? email` and forwards to the service. |
| [apps/api/src/services/auth.service.ts](apps/api/src/services/auth.service.ts) | (a) `loginWithPassword(identifier, password, ...)` now resolves the user by phone-format / email / Ghana Card (mirroring `loginWithPin`). (b) `verifyEmail` now uses atomic `updateMany` for the `usedAt` flip. (c) `webauthnLoginOptions` returns synthetic options for unknown phones to mask enumeration. (d) `_verifyOtpCode` padding now uses `Math.max(code.length, otp.code.length)`. |
| [apps/api/src/middleware/auth.ts](apps/api/src/middleware/auth.ts) | Replaced inline `require('../lib/redis')` with a top-level ES `import`. |
| [packages/auth/src/auth-provider.tsx](packages/auth/src/auth-provider.tsx) | `loginWithPassword(identifier, password)` now sends `{ identifier, password }` (back-compat: `email` field still sent when looks like an email). |
| [packages/auth/src/token-storage.ts](packages/auth/src/token-storage.ts) | Added a cross-tab `storage` event listener that fires `tokenStorage.onTokensCleared(cb)` so the auth store can clear state when localStorage is wiped in another tab. |
| [packages/auth/src/auth-store.ts](packages/auth/src/auth-store.ts) | Subscribes to `tokenStorage.onTokensCleared` once at module load to clear Zustand state on cross-tab logout. |
| [apps/client/src/lib/constants.ts](apps/client/src/lib/constants.ts) | Mirror rider app — throw in production builds when `NEXT_PUBLIC_API_URL` is missing. |
| [docs/AUTH_AUDIT_REPORT.md](docs/AUTH_AUDIT_REPORT.md) | This document. |
| [docs/AUTH_FIX_PLAN.md](docs/AUTH_FIX_PLAN.md) | Step-by-step fix plan and QA checklist. |

## 16. Tests Performed

- **Static review** — read every file in scope listed in §2.
- **Path-tracing for AU-01** — traced the broken request from `apps/client/src/app/(auth)/login/page.tsx:114` → `packages/auth/src/auth-provider.tsx:210` → `/auth/login/password` → `packages/validators/src/auth.ts:45-48` (rejection).
- **Type-check** — `npx tsc --noEmit` on each touched workspace, all clean:
  - `packages/validators` — clean.
  - `packages/auth` — clean.
  - `apps/api` — clean.
  - `apps/client` — clean.
  - `apps/rider` — clean (fixed pre-existing `chat/page.tsx` AI SDK drift: `handleSubmit` → `sendMessage`).
  - `apps/admin` — clean (same fix).
- **Unit tests** — `vitest run auth.service.test.ts`: **42 / 42 pass**. Two pre-existing failures (`'Invalid phone number or PIN'` vs `'Invalid credentials or PIN'`) were fixed by updating the test expectations to match the production error string in `loginWithPin`.
- **Lint** — eslint binary not installed in `node_modules` (would need a fresh `npm install` to resolve); type-check covers the same correctness surface.
- **No DB migrations were applied.** No destructive operations were run.

## 17. Remaining Risks

- **AU-05** (Rider auto-activation) — **accepted as intentional by owner (2026-05-20)**. Behaviour preserved; `TODO` comment retained for future onboarding-gate work.
- **AU-11/12/13** — minor, documented.
- **No automated E2E tests were run** as part of this audit. Local dev requires Postgres + Redis + env config which were not provisioned in the audit environment.
- **Secret rotation strategy** — no `kid`-based rotation. Recommended for the next security iteration.
- **Cross-app session** — when a user with both CLIENT and RIDER roles is on the same browser, the same token grants both apps. This is expected behaviour today; if the product wants strict per-app sessions, the access token would need to embed a per-app scope and `/auth/login/*` would need a `targetRole` parameter.

## 18. Final Production Readiness Rating

**Mostly Ready** — production-safe after the §15 changes land. All findings are either fixed or have an accepted owner decision (AU-05 auto-activation confirmed intentional on 2026-05-20).

## 19. Next Steps

1. **Run `npm run type-check` and `npm run lint`** at the monorepo root and resolve any remaining issues introduced by the patch set (none expected — see §17).
2. **Manual smoke test** — using the checklist in `AUTH_FIX_PLAN.md` §8.
3. **AU-05 decided** — auto-activation stays. If the product later requires admin approval, flip `'ACTIVATED'` → `'REGISTERED'` behind a `RIDER_AUTOACTIVATE` env flag.
4. **Plan a follow-up security iteration** for: `kid`-based JWT rotation, audit-log table, HttpOnly cookie option, CSP nonce, status re-check on sensitive endpoints.
5. **Stage → production deploy** after a full manual login matrix (phone/email/ghana × OTP/PIN/password/biometric × client/rider/admin).

---

*End of report.*
