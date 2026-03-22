# FBI Mode Code Investigation Report
### Riderguy PWA — Client & Rider Apps
**Date:** March 1, 2026  
**Scope:** Client App, Rider App, Shared Packages (auth, types, utils), API surface alignment  
**Files Investigated:** 80+  

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [CLIENT APP Findings](#client-app-findings)
3. [RIDER APP Findings](#rider-app-findings)
4. [SHARED PACKAGES Findings](#shared-packages-findings)
5. [Cross-Cutting Issues](#cross-cutting-issues)
6. [Phased Fix Plan](#phased-fix-plan)

---

## Executive Summary

| Severity | Client | Rider | Shared | Total |
|----------|--------|-------|--------|-------|
| **CRITICAL** | 1 | 3 | 1 | **5** |
| **HIGH** | 3 | 4 | 1 | **8** |
| **MEDIUM** | 6 | 6 | 2 | **14** |
| **LOW** | 8 | 8 | 0 | **16** |
| **Total** | **18** | **21** | **4** | **43** |

The codebase has a solid architecture (monorepo, shared packages, typed models) but suffers from:
- A **singleton socket conflict** pattern across both apps that causes intermittent connection drops
- **Token refresh bypass** where hooks use raw `fetch` + `tokenStorage` instead of the auth-managed axios instance
- **React Query is installed but barely used** — most data fetching uses raw `useState`/`useEffect` with no caching
- **Dead code accumulation** — entire unused components, dead imports, duplicate functions
- **Missing assets and validation** on the rider side

---

## CLIENT APP Findings

### C-CRIT-1: Singleton Socket Conflict ⚠️
**Files:** `src/hooks/use-socket.ts`, `src/components/client-map.tsx`, tracking page, `order-chat.tsx`  
**Issue:** The WebSocket is a module-level singleton. Multiple components call `connectSocket()` / `disconnectSocket()`. When ANY component unmounts, it calls `disconnectSocket()`, killing the shared socket for ALL other components. This causes intermittent live-tracking and chat failures.  
**Impact:** Users lose real-time tracking updates mid-delivery.

### C-HIGH-1: Token Refresh Bypass
**Files:** `src/hooks/use-directions.ts`, `src/hooks/use-mapbox-autocomplete.ts`, `src/components/client-map.tsx`  
**Issue:** These files use `tokenStorage.getAccessToken()` with raw `fetch()` instead of the `api` axios instance from `useAuth()`. The auth package's token refresh interceptor only works on the axios instance — raw fetch calls will fail silently when the access token expires.  
**Impact:** Map directions, autocomplete, and nearby rider fetching break after ~15min of inactivity.

### C-HIGH-2: Stale Photo Cleanup (Memory Leak)
**File:** `src/app/(dashboard)/dashboard/send/page.tsx`  
**Issue:** The `useEffect` cleanup for revoking `URL.createObjectURL()` captures the initial empty `packagePhotos` array (deps: `[]`). On unmount, it revokes nothing — the real URLs leak.  
**Impact:** Memory leak accumulates with each photo attached during order creation.

### C-HIGH-3: Schedule Discount Math Error
**File:** `src/components/price-breakdown.tsx`  
**Issue:** Discount calculation is `subtotal * (1 - scheduleDiscount) / scheduleDiscount`. If discount = 0.95 (5% off), displayed amount = `subtotal * 0.05/0.95`, which is wrong. Correct: `subtotal * (1 - scheduleDiscount)`.  
**Impact:** Users see incorrect savings amounts.

### C-MED-1: Entirely Dead Component
**File:** `src/components/order-chat.tsx`  
**Issue:** This component is never imported anywhere. The tracking page implements chat inline. Also has unused imports (`getSocket`, `X` icon) and no `subscribeToOrder()` call.

### C-MED-2: No Input Validation on Auth Forms
**Files:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`  
**Issue:** No client-side validation for phone format, email RFC compliance, or password strength. Placeholder says "At least 8 characters" but nothing enforces it. No OTP resend cooldown timer.

### C-MED-3: Hardcoded Active Status Arrays  
**Files:** Dashboard page, orders page, tracking page (3+ locations)  
**Issue:** `['PENDING', 'SEARCHING_RIDER', 'ASSIGNED', ...]` is copy-pasted across files instead of being a constant.

### C-MED-4: No Chat Message History
**File:** Tracking page  
**Issue:** `messages` starts empty with no API call to load history. Page refresh loses all messages.

### C-MED-5: Payment Auto-Initiation Race Condition
**File:** `src/app/(dashboard)/dashboard/orders/[id]/payment/page.tsx`  
**Issue:** Paystack popup opens automatically on `state === 'ready'` with no explicit user action. Multiple re-renders can trigger multiple popups. `accessCode` variable from backend response is unused (dead variable).

### C-MED-6: Type Safety — `Record<string, unknown>` for Orders
**Files:** Dashboard page, orders page  
**Issue:** Orders are typed as `Record<string, unknown>` with inline `as string` / `as number` casts. The `@riderguy/types` package exports a fully-typed `Order` interface with 40+ fields.

### C-LOW-1: Dead Exports in `constants.ts`
`LOCATION_INTERVAL`, `MAP_STYLE` — never imported anywhere.

### C-LOW-2: Dead Exports in `map-core.ts`
`switchMapStyle`, `flyToPoint`, `easeToPoint` — never used in client app.

### C-LOW-3: Dead Exports in `map-markers.ts`
`createStopMarker`, `createRiderStatusDot`, `updateRiderStatusDot` — unused.

### C-LOW-4: Duplicate `fitBoundsToCoords`
Defined in both `map-route.ts` and `map-core.ts`. Only `map-core.ts` version is imported.

### C-LOW-5: Dead Dependencies in `package.json`
`zustand` and `@riderguy/validators` — never directly imported in client app code.

### C-LOW-6: Unused `accentColor` Prop
`LocationInput` accepts but ignores `accentColor`.

### C-LOW-7: Dual Export in `location-input.tsx`
Both named and default export exist; only named is used.

### C-LOW-8: No Offline API Caching in Service Worker
`sw.ts` has no runtime caching strategy for API responses. All API calls fail offline.

---

## RIDER APP Findings

### R-CRIT-1: Missing Audio Asset
**File:** `src/components/incoming-request.tsx` (line 31)  
**Issue:** `new Audio('/sounds/incoming.mp3')` — the file does NOT exist in `apps/rider/public/`. No `sounds/` directory exists. The `try/catch` prevents a crash but incoming delivery requests are silent.  
**Impact:** Riders miss incoming delivery requests because they get no audio notification.

### R-CRIT-2: Stale Socket Ref in Return Value
**File:** `src/hooks/use-socket.ts` (line 88)  
**Issue:** `socket: socketRef.current` returns the ref's value at render time. On first render, this is always `null`. Since refs don't trigger re-renders, `useEffect` hooks with `[socket]` as a dependency (used in `delivery-chat.tsx`, `incoming-request.tsx`, `use-community.ts`) won't re-fire when the socket connects.  
**Impact:** Socket event listeners may fail to attach on first mount. Chat messages, incoming requests, and community features intermittently break.

### R-CRIT-3: Redundant `API_BASE_URL` in All Hooks
**Files:** All hooks (`use-community.ts`, `use-events.ts`, `use-feature-requests.ts`, `use-gamification.ts`, `use-mentorship.ts`, `use-rider-identity.ts`), `delivery-chat.tsx`  
**Issue:** `api.get(\`${API_BASE_URL}/orders/...\`)` — since `api` (axios) already has `API_BASE_URL` as its `baseURL`, passing an absolute URL bypasses the baseURL entirely. This **works accidentally** because the full URL is correct, but it's fragile and inconsistent with the dashboard page which uses relative paths correctly.  
**Impact:** If the API URL structure changes, these will all break while the dashboard survives.

### R-HIGH-1: Every Chat Message Triggers Full Rooms Refetch
**File:** `src/hooks/use-community.ts`  
**Issue:** `fetchRooms()` is called inside the `handleMessage` socket listener. Every incoming chat message triggers a full rooms list API call.  
**Impact:** In active chats, this creates excessive API load and janky UI updates.

### R-HIGH-2: React Query Installed But Unused
**Files:** `src/app/(dashboard)/dashboard/page.tsx`, all hooks  
**Issue:** `@tanstack/react-query` is installed and configured, but all data fetching uses raw `useState`/`useEffect`/`api.get()`. No queries, no caching, no stale-while-revalidate, data lost on navigation.  
**Impact:** Poor UX — data refetched on every mount, no background refresh, no optimistic updates.

### R-HIGH-3: Map Init Hangs Indefinitely
**File:** `src/lib/map-core.ts` (line 186)  
**Issue:** `await new Promise<void>((resolve) => map.on('load', resolve))` — if Mapbox fails to load (invalid token, network error), this promise never resolves. No timeout or error handler.  
**Impact:** App appears frozen if Mapbox CDN is down or token is invalid.

### R-HIGH-4: Proof-of-Delivery Signature Invisible in Light Mode
**File:** `src/components/proof-of-delivery.tsx` (line 82)  
**Issue:** `ctx.strokeStyle = '#fff'` — signature stroke is hardcoded white. On a light-mode canvas background, the signature is invisible.  
**Impact:** Signatures captured in light mode are blank/invisible.

### R-MED-1: Memory Leak — Typing Timers Never Cleared
**Files:** `src/hooks/use-community.ts`, `src/components/delivery-chat.tsx`  
**Issue:** `typingTimersRef.current` accumulates `setTimeout` handles that are never cleared on unmount. `typingTimeout.current` in delivery-chat is also never cleared on unmount.

### R-MED-2: Geolocation Blocks Map Initialization
**File:** `src/components/rider-map.tsx`  
**Issue:** `getUserPosition()` (8s timeout) is called before map init. If GPS is slow or user denies permission, map init is delayed up to 8 seconds.

### R-MED-3: No OTP Resend Cooldown
**Files:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`  
**Issue:** "Resend code" button has no cooldown timer. Users can spam the OTP endpoint.

### R-MED-4: Silent Error Swallowing on Dashboard
**File:** `src/app/(dashboard)/dashboard/page.tsx` (lines 62-78)  
**Issue:** All `.catch(() => {})` blocks silently discard errors. Failed requests are invisible.

### R-MED-5: No Photo Size Validation on Proof-of-Delivery
**File:** `src/components/proof-of-delivery.tsx`  
**Issue:** No file size check before converting to base64. A 50MB photo creates a massive JSON payload.

### R-MED-6: Duplicate `@keyframes float` Animation
**Files:** `src/app/globals.css`, `src/components/gamification-celebrations.tsx`  
**Issue:** `@keyframes float` defined in both with different values. The `<style jsx global>` in celebrations overrides the global one when mounted, affecting other elements using `animate-float`.

### R-LOW-1: Dead Import — `Crown` from lucide-react
**File:** `gamification-celebrations.tsx`

### R-LOW-2: Dead Import — `routeFitBounds` (aliased `fitBoundsToCoords`)
**File:** `navigation-map.tsx`

### R-LOW-3: Dead Import — `RiderLevel` type
**File:** `use-gamification.ts`

### R-LOW-4: Dead Export — `MAP_STYLE` constant
**File:** `constants.ts`

### R-LOW-5: Dead Function — `adjustColor()`
**File:** `map-markers.ts`

### R-LOW-6: Unused Prop — `orderId` in ProofOfDelivery
**File:** `proof-of-delivery.tsx`

### R-LOW-7: Unauthenticated Fetch for Public Card/Spotlights
**File:** `use-rider-identity.ts` — uses bare `fetch()` with no auth header for public endpoints. May be intentional.

### R-LOW-8: Magic Number in Heartbeat Interval
**File:** `use-rider-availability.ts` — `LOCATION_INTERVAL * 6` instead of a named constant.

---

## SHARED PACKAGES Findings

### S-CRIT-1: Stale `accessToken` in Auth Context
**File:** `packages/auth/src/auth-provider.tsx`  
**Issue:** `accessToken: tokenStorage.getAccessToken()` is captured inside a `useMemo`. It is never re-derived after a token refresh. Any consumer using `accessToken` directly (rather than the `api` instance) gets a stale value.  
**Impact:** Affects all hooks using `tokenStorage.getAccessToken()` directly (client-map, use-directions, use-mapbox-autocomplete, rider navigation-map).

### S-HIGH-1: Prisma Decimal → Number Mismatch
**Files:** `packages/database/prisma/schema.prisma`, `packages/types/src/order.ts`  
**Issue:** Order pricing fields (`baseFare`, `distanceCharge`, `totalPrice`, etc.) are `Decimal` in Prisma but `number` in TypeScript types. Prisma Client returns `Prisma.Decimal` objects which don't auto-serialize to JSON numbers. The API must explicitly convert `.toNumber()`.  
**Impact:** Potential `NaN` or `[object Object]` in price displays if API doesn't convert.

### S-MED-1: Unimplemented API Features
**Issue:** Prisma schema has `SavedAddress`, `FavoriteRider`, and `ScheduledDelivery` models, but no visible API route groups for these features. Client app references scheduled delivery UI, but the API may not support it.

### S-MED-2: No DB-Level Constraint on `RiderProfile.currentLevel`
**Issue:** Column is `Int @default(1)` with no CHECK constraint limiting values to 1-7. The TypeScript enum `RiderLevel` enforces this on the app side only.

---

## Cross-Cutting Issues

| Issue | Client | Rider | Impact |
|-------|--------|-------|--------|
| Singleton socket conflict | ✅ | ✅ | Real-time features break intermittently |
| Token bypass with raw fetch | ✅ | ✅ | Auth breaks after token expiry |
| React Query underutilized | Partial | ✅ | No caching, poor data lifecycle |
| Dead code accumulation | ✅ | ✅ | Maintenance burden, confusion |
| No input validation on auth | ✅ | ✅ | Relies entirely on backend |
| No OTP resend cooldown | ✅ | ✅ | Abuse vector |
| `refetchOnWindowFocus: false` | ✅ | ✅ | Stale data when returning to app |

---

## Phased Fix Plan

### Phase 1: CRITICAL FIXES (Breaks Core Functionality)
**Estimated effort:** 2-3 days  
**Goal:** Fix issues that cause features to silently fail

| ID | Task | App | File(s) | Description |
|----|------|-----|---------|-------------|
| P1-1 | **Fix singleton socket pattern** | Both | `use-socket.ts` (both apps) | Implement reference counting: track active consumers with a counter. Only `disconnectSocket()` when counter reaches 0. Add `useSocket()` hook that auto-increments on mount, auto-decrements on unmount. |
| P1-2 | **Fix stale socket ref in rider** | Rider | `use-socket.ts` | Change from `socketRef.current` to a `useState` for the socket instance so React re-renders when socket connects. Consumers' `useEffect([socket])` will then fire correctly. |
| P1-3 | **Add incoming request sound** | Rider | `public/sounds/` | Create or source an `incoming.mp3` notification sound and place it at `apps/rider/public/sounds/incoming.mp3`. |
| P1-4 | **Fix redundant API_BASE_URL** | Rider | All hooks + `delivery-chat.tsx` | Replace `api.get(\`${API_BASE_URL}/...\`)` with `api.get('/...')` across all rider hooks. The axios instance already has the base URL. |
| P1-5 | **Fix stale accessToken in auth** | Shared | `packages/auth/src/auth-provider.tsx` | Derive `accessToken` from zustand state or add a `getAccessToken` function that always reads fresh from `tokenStorage`. |

### Phase 2: HIGH-PRIORITY FIXES (Major UX/Performance Impact)
**Estimated effort:** 3-4 days  
**Goal:** Fix broken math, performance issues, and auth bypass

| ID | Task | App | File(s) | Description |
|----|------|-----|---------|-------------|
| P2-1 | **Fix token refresh bypass** | Client | `use-directions.ts`, `use-mapbox-autocomplete.ts`, `client-map.tsx` | Refactor to accept `api` from `useAuth()` as a parameter (or use a context). Replace raw `fetch` + `tokenStorage.getAccessToken()` with the auth-managed axios instance. |
| P2-2 | **Fix schedule discount math** | Client | `price-breakdown.tsx` | Change formula from `subtotal * (1 - discount) / discount` to `subtotal * (1 - discount)`. |
| P2-3 | **Fix photo cleanup memory leak** | Client | `send/page.tsx` | Move the URL revocation into a `useEffect` that watches `packagePhotos` changes and revokes previous URLs, or use a ref to track current URLs. |
| P2-4 | **Fix community room refetch storm** | Rider | `use-community.ts` | Replace `fetchRooms()` inside `handleMessage` with a targeted state update: insert the new message into the existing rooms state and reorder, instead of refetching from API. |
| P2-5 | **Fix map init hanging** | Rider | `map-core.ts` | Add a `Promise.race` with a 15-second timeout. On timeout, reject with a user-friendly error and show a retry button. |
| P2-6 | **Fix signature visibility** | Rider | `proof-of-delivery.tsx` | Use theme-aware stroke color: `ctx.strokeStyle = resolvedTheme === 'dark' ? '#fff' : '#1a1a2e'`. |
| P2-7 | **Adopt React Query for data fetching** | Rider | `dashboard/page.tsx`, hooks | Convert dashboard data fetching from raw `useState`/`useEffect` to `useQuery`. Parallel queries with `useQueries`. Add `staleTime`, `gcTime` configs. This is the highest-ROI refactor. |
| P2-8 | **Fix Prisma Decimal serialization** | API | API order serializers | Ensure all `Decimal` fields are converted with `.toNumber()` before sending JSON responses. Add a Prisma middleware or a serialization utility. |

### Phase 3: MEDIUM FIXES (Robustness & UX Polish)
**Estimated effort:** 3-4 days  
**Goal:** Harden validation, fix memory leaks, improve reliability

| ID | Task | App | File(s) | Description |
|----|------|-----|---------|-------------|
| P3-1 | **Add auth form validation** | Both | `login/page.tsx`, `register/page.tsx` (both apps) | Add client-side validation: phone format (GH numbers), email RFC check, password min 8 chars + complexity indicator. Use `@riderguy/validators` zod schemas if available. |
| P3-2 | **Add OTP resend cooldown** | Both | `login/page.tsx`, `register/page.tsx` (both apps) | Add a 60-second countdown timer after requesting OTP. Disable resend button during cooldown. Show remaining seconds. |
| P3-3 | **Extract order status constants** | Client | Create `src/lib/order-statuses.ts` | Define `ACTIVE_STATUSES`, `DELIVERY_STATUSES`, `TERMINAL_STATUSES` as `Set<string>` constants. Replace all hardcoded arrays. |
| P3-4 | **Add chat message history** | Client | Tracking page | On mount, fetch `GET /orders/:id/messages` to load existing messages before socket connection. |
| P3-5 | **Fix payment auto-initiation** | Client | `payment/page.tsx` | Add an explicit "Pay Now" button instead of auto-opening Paystack. Add a guard to prevent multiple popup initiations. Remove dead `accessCode` variable. |
| P3-6 | **Use proper Order typing** | Client | `dashboard/page.tsx`, `orders/page.tsx` | Import `Order` from `@riderguy/types` instead of `Record<string, unknown>`. Remove all `as string` / `as number` casts. |
| P3-7 | **Fix typing timer memory leaks** | Rider | `use-community.ts`, `delivery-chat.tsx` | Clear all accumulated `setTimeout` handles in cleanup functions. Clear `typingTimeout.current` on unmount. |
| P3-8 | **Fix geolocation blocking map init** | Rider | `rider-map.tsx` | Initialize map immediately with `ACCRA_CENTER` default. Update center asynchronously when geolocation resolves. |
| P3-9 | **Add photo size validation** | Rider | `proof-of-delivery.tsx` | Check file size before base64 conversion. Limit to `MAX_FILE_SIZE_BYTES` from `@riderguy/utils`. Show error if exceeded. |
| P3-10 | **Fix duplicate keyframes** | Rider | `globals.css`, `gamification-celebrations.tsx` | Remove the `<style jsx global>` override and unify the `float` animation in `globals.css`. |
| P3-11 | **Fix silent error swallowing** | Rider | `dashboard/page.tsx` | Replace `.catch(() => {})` with `.catch((err) => console.error('Failed to fetch...', err))` at minimum. Consider a toast notification for user-facing errors. |
| P3-12 | **Parallelize dashboard API calls** | Rider | `dashboard/page.tsx` | Wrap independent API calls in `Promise.allSettled()` to load data concurrently. |

### Phase 4: LOW-PRIORITY CLEANUP (Code Quality)
**Estimated effort:** 1-2 days  
**Goal:** Remove dead code, clean up exports, reduce bundle size

| ID | Task | App | File(s) | Description |
|----|------|-----|---------|-------------|
| P4-1 | **Delete dead `order-chat.tsx`** | Client | `src/components/order-chat.tsx` | Remove entirely — unused component. |
| P4-2 | **Remove dead exports from constants** | Both | `constants.ts` (both apps) | Remove `LOCATION_INTERVAL`, `MAP_STYLE` from client. Remove `MAP_STYLE` from rider. |
| P4-3 | **Remove dead exports from map libs** | Both | `map-core.ts`, `map-markers.ts`, `map-route.ts` | Remove unused `switchMapStyle`, `flyToPoint`, `easeToPoint` from client. Remove `adjustColor` and duplicate `fitBoundsToCoords` from rider. |
| P4-4 | **Remove dead imports** | Both | Various | Remove: `Crown` (rider gamification), `routeFitBounds` (rider navigation-map), `RiderLevel` (rider use-gamification), `easeToPoint` (client client-map), `getSocket`/`X` (client order-chat). |
| P4-5 | **Remove dead dependencies** | Client | `package.json` | Remove `zustand` and `@riderguy/validators` if truly unused. |
| P4-6 | **Remove dual export** | Client | `location-input.tsx` | Remove the `export default` at the bottom — only named export is used. |
| P4-7 | **Remove unused `accentColor` prop** | Client | `location-input.tsx` | Remove from props interface and destructuring. |
| P4-8 | **Remove unused `orderId` prop** | Rider | `proof-of-delivery.tsx` | Remove from props interface and destructuring. |
| P4-9 | **Replace magic heartbeat number** | Rider | `use-rider-availability.ts` | Replace `LOCATION_INTERVAL * 6` with `LOCATION_INTERVALS.restHeartbeat` from `@riderguy/utils`. |
| P4-10 | **Enable `refetchOnWindowFocus`** | Both | `query-client.tsx` (both apps) | Change to `true` or set a `staleTime` so data refreshes when users return to the app tab. Critical for a live-tracking delivery app. |

### Phase 5: FUTURE ENHANCEMENTS (Not Bugs, But Important)
**Estimated effort:** Ongoing  
**Goal:** Fill feature gaps and improve resilience

| ID | Task | App | Description |
|----|------|-----|-------------|
| P5-1 | **Add runtime API caching in SW** | Both | Add `StaleWhileRevalidate` strategy for `GET /orders` in service worker for offline support. |
| P5-2 | **Add `global-error.tsx`** | Both | Catch root layout errors that `error.tsx` misses. |
| P5-3 | **Move landing page to SSR** | Client | The root `page.tsx` is `'use client'` — zero SEO. Consider extracting auth check to middleware. |
| P5-4 | **Implement Saved Addresses API** | API | Add CRUD routes for `SavedAddress` model (exists in Prisma schema but no API routes). |
| P5-5 | **Implement Favorite Riders API** | API | Add CRUD routes for `FavoriteRider` model. |
| P5-6 | **Implement Scheduled Deliveries** | API | Add routes for `ScheduledDelivery` model. Client UI references scheduling but API may not support it. |
| P5-7 | **Add DB constraint for RiderLevel** | Database | Add CHECK constraint to limit `currentLevel` to 1-7. |
| P5-8 | **Add Decimal precision to Order** | Database | Add `@db.Decimal(12,2)` annotations to Order pricing fields like Wallet/Transaction already have. |
| P5-9 | **Switch photo uploads to multipart** | Both | Replace base64 JSON uploads with multipart form data for photos/videos to reduce payload size 33%. |

---

## Fix Tracking Checklist

Use this to track progress when implementing fixes:

```
PHASE 1 — CRITICAL (5 tasks) ✅ COMPLETE
[x] P1-1  Fix singleton socket pattern (both apps)
[x] P1-2  Fix stale socket ref (rider)
[x] P1-3  Add incoming request sound (rider)
[x] P1-4  Fix redundant API_BASE_URL (rider)
[x] P1-5  Fix stale accessToken in auth (shared)

PHASE 2 — HIGH (8 tasks) ✅ COMPLETE
[x] P2-1  Fix token refresh bypass (client)
[x] P2-2  Fix schedule discount math (client)
[x] P2-3  Fix photo cleanup memory leak (client)
[x] P2-4  Fix community room refetch storm (rider)
[x] P2-5  Fix map init hanging (rider)
[x] P2-6  Fix signature visibility (rider)
[x] P2-7  Adopt React Query for data fetching (rider)
[x] P2-8  Fix Prisma Decimal serialization (API)

PHASE 3 — MEDIUM (12 tasks) ✅ COMPLETE
[x] P3-1  Add auth form validation (both)
[x] P3-2  Add OTP resend cooldown (both)
[x] P3-3  Extract order status constants (client)
[x] P3-4  Add chat message history (client)
[x] P3-5  Fix payment auto-initiation (client)
[x] P3-6  Use proper Order typing (client)
[x] P3-7  Fix typing timer memory leaks (rider)
[x] P3-8  Fix geolocation blocking map init (rider)
[x] P3-9  Add photo size validation (rider)
[x] P3-10 Fix duplicate keyframes (rider)
[x] P3-11 Fix silent error swallowing (rider) — addressed by P2-7 React Query
[x] P3-12 Parallelize dashboard API calls (rider) — addressed by P2-7 React Query

PHASE 4 — LOW / CLEANUP (10 tasks) ✅ COMPLETE
[x] P4-1  Delete dead order-chat.tsx (client)
[x] P4-2  Remove dead exports from constants (both)
[x] P4-3  Remove dead exports from map libs (both)
[x] P4-4  Remove dead imports (both)
[x] P4-5  Remove dead dependencies (client)
[x] P4-6  Remove dual export (client)
[x] P4-7  Remove unused accentColor prop (client)
[x] P4-8  Remove unused orderId prop (rider)
[x] P4-9  Replace magic heartbeat number (rider)
[x] P4-10 Enable refetchOnWindowFocus (both)

PHASE 5 — FUTURE ENHANCEMENTS (9 tasks) ✅ COMPLETE
[x] P5-1  Add runtime API caching in SW (both)
[x] P5-2  Add global-error.tsx (both)
[x] P5-3  Move landing page to SSR (client)
[x] P5-4  Implement Saved Addresses API
[x] P5-5  Implement Favorite Riders API
[x] P5-6  Implement Scheduled Deliveries
[x] P5-7  Add DB constraint for RiderLevel
[x] P5-8  Add Decimal precision to Order
[x] P5-9  Switch photo uploads to multipart (both)
```

---

### ALL 5 PHASES COMPLETE — 44 TASKS FIXED WITH ZERO ERRORS

*Report generated by FBI Mode Investigation — March 1, 2026*
*All phases completed — March 2, 2026*
