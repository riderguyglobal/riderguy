# RiderGuy Platform Deep Audit

**Date:** April 6, 2026
**Scope:** Rider App, Client App, API Backend, Shared Packages (auth, types, database, validators, utils)
**Files Analyzed:** 100+ source files across 6 packages

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 4 | Requires immediate fix |
| High | 6 | Fix this sprint |
| Medium | 5 | Next sprint |
| Low | 4 | Backlog |

---

## Critical Issues

### C-01: `SIGNATURE` Enum Mismatch Between Types and Database

**Location:**
- `packages/types/src/enums.ts` line 110 (defines `SIGNATURE = 'SIGNATURE'`)
- `packages/database/prisma/schema.prisma` line 144-148 (missing `SIGNATURE`)

**Problem:**
The TypeScript types package includes `ProofOfDeliveryType.SIGNATURE`, but the Prisma schema does not:

```prisma
// schema.prisma
enum ProofOfDeliveryType {
  PHOTO
  PIN_CODE
  LEFT_AT_DOOR
  // SIGNATURE is MISSING
}
```

```typescript
// enums.ts
export enum ProofOfDeliveryType {
  PHOTO = 'PHOTO',
  SIGNATURE = 'SIGNATURE',  // EXISTS here
  PIN_CODE = 'PIN_CODE',
  LEFT_AT_DOOR = 'LEFT_AT_DOOR',
}
```

**Impact:** Any code path that writes `SIGNATURE` as a proof-of-delivery type will throw a Prisma validation error at runtime. TypeScript will not catch this because it trusts the enum definition.

**Fix:** Either add `SIGNATURE` to the Prisma enum (requires migration) or remove it from the TypeScript enum. Determine which is the intended source of truth.

---

### C-02: Socket Offline Queue Leaks Between Users (Rider App)

**Location:** `apps/rider/src/hooks/use-socket.ts` line 25-52

**Problem:**
The offline event queue uses a fixed sessionStorage key `riderguy:socket_queue` with no user isolation:

```typescript
const QUEUE_KEY = 'riderguy:socket_queue';

function getOfflineQueue(): QueuedEvent[] {
  const raw = sessionStorage.getItem(QUEUE_KEY);  // No user ID in key
  // ...
}

function flushOfflineQueue(s: Socket): void {
  const queue = getOfflineQueue();
  for (const item of queue) {
    s.emit(item.event as any, item.data as any);  // No user ownership check
  }
}
```

**Attack Vector:**
1. Rider A accepts a delivery and goes online
2. Network drops, location events are queued in sessionStorage
3. Rider A logs out (tab stays open)
4. Rider B logs in on same tab
5. Socket reconnects, `flushOfflineQueue()` fires
6. Rider B's session replays Rider A's queued location data

**Impact:** Location data cross-contamination between rider accounts. Could cause incorrect delivery tracking and location history corruption.

**Fix:** Include the user ID in the queue key: `riderguy:socket_queue:${userId}`. Clear the queue on logout (already attempted in `disconnectSocket()` but not guaranteed).

---

### C-03: Email Enumeration on Registration (API)

**Location:** `apps/api/src/services/auth.service.ts` line 408

**Problem:**
```typescript
if (existingEmail) {
  throw ApiError.conflict('A user with this email already exists', 'EMAIL_EXISTS');
}
```

The registration endpoint returns a specific HTTP 409 when an email is already registered. An attacker can probe the endpoint to determine which emails have accounts.

**Contrast:** `requestPasswordReset()` and `resendVerification()` correctly return generic success regardless of whether the email exists.

**Fix:** Return a generic success response (`{ success: true }`) regardless of whether the email exists. Send an email to existing users saying "someone tried to register with your email" instead.

---

### C-04: Missing Role Authorization on File Upload (API)

**Location:** `apps/api/src/routes/orders/order.routes.ts` line 72

**Problem:**
```typescript
router.post('/upload-photo',
  packagePhotoUpload.single('file'),  // Only auth middleware, no role check
  asyncHandler(async (req, res) => { ... })
);
```

The endpoint is authenticated but has no `requireRole()` middleware. Any authenticated user (riders, admins) can upload package photos, which should be restricted to clients only.

**Fix:** Add `requireRole(UserRole.CLIENT, UserRole.BUSINESS_CLIENT)` middleware before the handler.

---

## High Severity Issues

### H-01: Missing `riderPaymentConfirmed` and `actualPaymentMethod` in Types

**Location:**
- `packages/database/prisma/schema.prisma` (Order model has both fields)
- `packages/types/src/order.ts` (neither field is defined)

**Problem:** The Prisma schema includes `riderPaymentConfirmed Boolean @default(false)` and `actualPaymentMethod PaymentMethod?` on the Order model, but the shared TypeScript interface does not declare them. Frontend code accessing these fields will see `undefined` without any TypeScript warning.

**Fix:** Add both fields to the `Order` interface in `packages/types/src/order.ts`.

---

### H-02: Missing Presence Tracking Fields in RiderProfile Type

**Location:**
- `packages/database/prisma/schema.prisma` (RiderProfile model)
- `packages/types/src/rider.ts` (RiderProfile interface)

**Problem:** The Prisma schema includes these fields on `RiderProfile`:
- `isConnected Boolean @default(false)`
- `lastHeartbeat DateTime?`
- `socketId String?`
- `sessionStartedAt DateTime?`
- `connectionQuality String?`
- `totalOnlineSeconds Int @default(0)`

None are present in the TypeScript `RiderProfile` interface. Admin dashboard or monitoring code touching these fields gets no type safety.

**Fix:** Add all six fields to the `RiderProfile` interface in `packages/types/src/rider.ts`.

---

### H-03: Missing `roles: UserRole[]` on Base User Type

**Location:**
- `packages/types/src/user.ts` (User interface, only has `role: UserRole`)
- `packages/types/src/auth.ts` line 7 (AuthUser has `roles: UserRole[]`)
- `packages/database/prisma/schema.prisma` (has both `role` and `roles`)

**Problem:** The base `User` interface only has the deprecated singular `role` field. The new `roles: UserRole[]` array exists in `AuthUser` but not in `User`. Code that works with `User` instead of `AuthUser` will miss the multi-role capability.

**Fix:** Add `roles: UserRole[]` to the `User` interface in `packages/types/src/user.ts`.

---

### H-04: No Content-Security-Policy Headers (Both Frontend Apps)

**Location:**
- `apps/rider/next.config.js` lines 24-27
- `apps/client/next.config.js` lines 19-22

**Problem:** Neither app configures security headers. The only custom header is `Content-Type` for `manifest.json`:

```javascript
headers: async () => [
  {
    source: '/manifest.json',
    headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
  },
],
```

Missing headers:
- `Content-Security-Policy` (prevents XSS via inline script injection)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy`

The API backend uses Helmet for these, but the frontend apps are unprotected.

**Fix:** Add a security headers block to both `next.config.js` files, or use the `@next/headers` middleware pattern.

---

### H-05: Plaintext Bearer Tokens in Service Worker IndexedDB (Rider App)

**Location:** `apps/rider/src/sw.ts` lines 74-81

**Problem:**
```typescript
interface QueuedLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  token: string;       // Plaintext bearer token
  apiUrl: string;
}

async function idbPush(item: QueuedLocation): Promise<void> {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).add(item);  // Token stored unencrypted
}
```

**Impact:** If a device is physically compromised or debugged, an attacker can extract bearer tokens from IndexedDB. Tokens may remain valid longer than the active session.

**Fix:** Store a short-lived, single-purpose location sync token instead of the main bearer token. Alternatively, encrypt tokens at rest using the Web Crypto API.

---

### H-06: PII Logging in Production (API)

**Location:** Multiple files in `apps/api/src/services/`
- `auth.service.ts` line 385 (logs email addresses)
- `auth.service.ts` line 150 (logs phone numbers)
- Order service logs full order details with client names

**Problem:** If logs are aggregated to third-party services (Datadog, Sentry, CloudWatch), personally identifiable information is exposed, risking GDPR/privacy violations.

**Fix:** Create masking utilities for production logging:
```typescript
const maskEmail = (email: string) => email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
const maskPhone = (phone: string) => phone.slice(-4).padStart(phone.length, '*');
```

---

## Medium Severity Issues

### M-01: Rate Limiting Falls Back to In-Memory

**Location:** `apps/api/src/middleware/rate-limit.ts` lines 45-65

**Problem:** When Redis is unavailable, rate limiting falls back to in-memory storage. In multi-instance deployments behind a load balancer, each instance has independent counters. An attacker can bypass limits by distributing requests across N instances, effectively getting N times the limit.

**Fix:** Require Redis in production. Fail fast at startup if Redis is not configured when `NODE_ENV=production`.

---

### M-02: Missing Database Constraints

**Location:** `packages/database/prisma/schema.prisma`

**Issues:**
1. **OrderStop** has no `@@unique([orderId, sequence])` constraint. Duplicate stop sequences can be inserted for the same order.
2. **ScheduledDelivery** has no unique constraint on client + frequency + route. Clients can accidentally create unlimited duplicate schedules.
3. **PromoCode.packageTypes** uses `String[]` instead of typed `PackageType[]`. Invalid enum values can be stored without database-level validation.

**Fix:** Add the constraints via a new Prisma migration.

---

### M-03: No Soft Delete on Any Model

**Location:** All Prisma models

**Problem:** No model has a `deletedAt` field. All deletes are permanent with no recovery path. For orders, users, and financial transactions, this creates regulatory risk: GDPR requires right-to-erasure, but financial regulations may require record retention.

**Fix:** Add `deletedAt DateTime?` to User, Order, Transaction, and Wallet models. Implement a Prisma middleware that filters soft-deleted records by default.

---

### M-04: LocationHistory Has No Retention Policy

**Location:** `packages/database/prisma/schema.prisma` (LocationHistory model)

**Problem:** Location history records accumulate without any TTL, cleanup job, or archival policy. No index on timestamp for efficient range queries. This table will grow unbounded, degrading performance and inflating storage costs.

**Fix:** Add a cron job to purge records older than N days. Add an index on `(riderId, createdAt)` for efficient queries.

---

### M-05: Missing Database Indexes for Common Queries

**Location:** `packages/database/prisma/schema.prisma`

**Missing indexes:**
- `Order(clientId, createdAt)` for "my orders" listings (sorted by date)
- `Order(createdAt)` for admin time-range queries and reports
- `Order(riderId, status)` for rider active job lookups

**Fix:** Add indexes via migration. These become critical as order volume scales.

---

## Low Severity Issues

### L-01: Socket.IO Rate Limiting Not Distributed

**Location:** `apps/api/src/socket/index.ts` lines 65-85

Per-connection socket event rate limiting is in-memory only. In multi-instance deployments, limits can be circumvented by connecting to different instances. Move to Redis-backed socket rate limiting when scaling.

---

### L-02: JWT Secret Length Not Validated at Startup

**Location:** `apps/api/src/config/index.ts`

No minimum entropy check on JWT secrets. A weak secret could be deployed without warning. Add startup validation:
```typescript
if (config.jwt.accessSecret.length < 32) {
  throw new Error('JWT_ACCESS_SECRET must be at least 32 characters');
}
```

---

### L-03: Concurrent Token Refresh Returns Error

**Location:** `apps/api/src/services/auth.service.ts` lines 803-820

When two browser tabs refresh tokens simultaneously, the second request fails because the refresh token hash was already rotated by the first. The client must retry. Could be improved by caching the first refresh result briefly (e.g., 5 seconds).

---

### L-04: Phone Number Validator Allows Non-Ghanaian Numbers

**Location:** `packages/validators/src/common.ts`

The phone regex allows up to 15 digits (E.164 max), but Ghana numbers are max 13 characters (`+233XXXXXXXXX`). Numbers outside Ghana's range will be accepted by validation but rejected by the SMS provider.

---

## What's Working Well

The codebase demonstrates strong engineering discipline across the following areas:

**Authentication and Security:**
- Multi-method auth: OTP, PIN, WebAuthn biometrics, email/password, Google OAuth
- Constant-time OTP comparison (`crypto.timingSafeEqual`) prevents timing attacks
- HMAC webhook verification for Paystack payment callbacks
- Refresh token rotation with hash storage
- Account lockout after 5 failed attempts (15-minute cooldown)
- CSRF state validation on Google OAuth flow
- Prisma ORM prevents SQL injection across all queries

**Real-Time Architecture:**
- Socket.IO with exponential backoff and jitter (`reconnectionDelayMax: 30s`)
- Dynamic token refresh on reconnect attempts
- Offline event queue with 2-minute TTL
- Debounced real-time job notifications (2s)
- Forward-only status transition enforcement on the client
- REST heartbeat fallback when sockets are down
- Adaptive heartbeat intervals based on connection quality

**PWA Durability (Rider App):**
- Screen Wake Lock API with auto-reacquire on visibility change
- Sub-audible audio keep-alive (20 Hz, gain 0.001) prevents iOS process suspension
- Service worker background sync for location and order status checks
- Foreground recovery: invalidates stale caches when app returns from background (>5s threshold)
- Push notification handling with tag-based deduplication

**Map and Geolocation:**
- AbortController on all Mapbox API calls (prevents race conditions)
- High-accuracy GPS with automatic low-accuracy fallback on timeout
- Route refresh only after 100m of rider movement (saves API calls)
- Marker pooling: updates existing markers instead of recreating
- Proper cleanup of all map instances, markers, and intervals on unmount

**Input Validation:**
- Zod schemas shared between client and server via `@riderguy/validators`
- Client-side haversine distance check (50km max) before order submission
- Phone, email, and password validation before any API call
- Coordinate range validation (-90/90 lat, -180/180 lng)
- Multi-stop capped at 10 stops

**Error Handling:**
- Global error boundary (`global-error.tsx`) with error digest for debugging
- Per-page `error.tsx` fallbacks
- Offline fallback page (`~offline/page.tsx`)
- API global error handler with safe error messages (no stack traces in production)
- `asyncHandler` wrapper prevents unhandled promise rejections

**Mobile-Native UX:**
- Android back button traps on modals (prevents accidental navigation)
- iOS safe area insets for notch/home indicator
- Haptic feedback via `navigator.vibrate()`
- Web Audio API notification tones with iOS audio context unlock
- OTP cooldown timer survives iOS backgrounding (uses `Date.now()` delta + visibility change listener)
- Body scroll lock on modal overlays

---

## Recommended Fix Priority

**This week (P0):**
1. C-01: Add `SIGNATURE` to Prisma enum or remove from TypeScript enum
2. C-02: Add user ID to socket queue key
3. C-03: Fix email enumeration on registration
4. C-04: Add role check to upload-photo endpoint

**This sprint (P1):**
5. H-01 through H-03: Sync TypeScript types with Prisma schema
6. H-04: Add security headers to both Next.js apps
7. H-05: Replace bearer token storage in service worker
8. H-06: Add PII masking to production logs

**Next sprint (P2):**
9. M-01 through M-05: Database constraints, indexes, retention policies

**Backlog (P3):**
10. L-01 through L-04: Distributed rate limiting, JWT validation, concurrent refresh, phone regex
