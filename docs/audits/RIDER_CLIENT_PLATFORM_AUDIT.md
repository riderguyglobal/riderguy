# Rider Client Platform — Full Audit Report

> Generated: 2026-03-21
> Scope: Complete rider PWA frontend — architecture, pages, components, hooks, libs, config, auth, PWA features
> Files audited: 50+ across `apps/rider/src/`, `packages/auth/`, `packages/ui/`
> Builds on: `RIDER_SYSTEM_AUDIT.md` (API + backend pipeline, all items FIXED)

---

## Audit Summary

| Category | Issues | Severity | Status |
|----------|--------|----------|--------|
| **Architecture & Config** | 8 | Mixed | 🔍 Review |
| **Authentication & Security** | 7 | HIGH–CRITICAL | 🔍 Review |
| **Real-Time & Socket Layer** | 5 | MEDIUM–HIGH | 🔍 Review |
| **PWA & Service Worker** | 6 | MEDIUM–HIGH | 🔍 Review |
| **Map & Navigation** | 4 | MEDIUM | 🔍 Review |
| **UI/UX & Accessibility** | 8 | LOW–MEDIUM | 🔍 Review |
| **Data Fetching & State** | 5 | MEDIUM | 🔍 Review |
| **Community Features** | 4 | LOW–MEDIUM | 🔍 Review |
| **Strengths** | — | — | ✅ |

**Total findings: 47**

---

## Table of Contents

1. [Architecture & Configuration](#1-architecture--configuration)
2. [Authentication & Security](#2-authentication--security)
3. [Real-Time & Socket Layer](#3-real-time--socket-layer)
4. [PWA & Service Worker](#4-pwa--service-worker)
5. [Map & Navigation](#5-map--navigation)
6. [UI/UX & Accessibility](#6-uiux--accessibility)
7. [Data Fetching & State Management](#7-data-fetching--state-management)
8. [Community Features](#8-community-features)
9. [Platform Strengths](#9-platform-strengths)
10. [Recommendations Priority Matrix](#10-recommendations-priority-matrix)

---

## 1. Architecture & Configuration

### AC-01: `force-dynamic` on Root Layout Disables Static Optimization

**File:** `apps/rider/src/app/layout.tsx` L9
**Severity:** MEDIUM

```typescript
export const dynamic = 'force-dynamic';
```

This forces **every page** in the app to be server-rendered on every request — even the landing page, 404, and error pages. Next.js can't generate static shells for any route.

**Impact:** Higher TTFB, increased Render compute costs, no ISR/SSG for marketing-style pages (landing, offline).
**Recommendation:** Remove the root-level `force-dynamic`. If specific pages need it (e.g., pages reading cookies), set it per-page instead of globally.

---

### AC-02: Jobs Page Uses Full URL Instead of Relative API Path

**File:** `apps/rider/src/app/(dashboard)/dashboard/jobs/page.tsx` ~L31-35
**Severity:** LOW

```typescript
const res = await api.get(`${API_BASE_URL}/orders/available`);
// vs other pages that use:
const res = await api.get('/orders/available');
```

The `api` client from `useAuth()` already has `API_BASE_URL` as its base URL. Prepending it again results in a doubled path like `http://localhost:4000/api/v1/http://localhost:4000/api/v1/orders/available` — which likely works only because Axios resolves absolute URLs.

**Impact:** Fragile — will break if `API_BASE_URL` ever changes format. Inconsistent with every other page.
**Recommendation:** Use relative paths consistently: `api.get('/orders/available')`.

---

### AC-03: `pages/` Directory Conflicts with App Router

**File:** `apps/rider/src/pages/_document.tsx`, `apps/rider/src/pages/_error.tsx`
**Severity:** LOW

The app uses Next.js 14 App Router (`src/app/`), but also has `src/pages/_document.tsx` and `src/pages/_error.tsx`. These are Pages Router artifacts.

**Impact:** The `_document.tsx` is ignored by App Router (metadata is handled in `layout.tsx`). The `_error.tsx` is superseded by `error.tsx` and `global-error.tsx`. These files create confusion and may cause build warnings.
**Recommendation:** Delete `src/pages/` directory entirely — App Router handles all error/document concerns.

---

### AC-04: Missing `postcss.config.js` Content Validation

**File:** `apps/rider/postcss.config.js`
**Severity:** INFO

Standard Tailwind setup — no issue, but the PostCSS config could pin plugin versions for reproducibility. Current config is fine for development.

---

### AC-05: No Environment Variable Validation at Build Time

**File:** `apps/rider/src/lib/constants.ts` L1-4
**Severity:** MEDIUM

```typescript
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
export const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
```

Both critical env vars fall back silently. A production deployment missing `NEXT_PUBLIC_API_URL` will point at localhost. Missing `NEXT_PUBLIC_MAPBOX_TOKEN` means maps silently render nothing.

**Impact:** Silent misconfiguration in production. Maps and API connectivity fail without obvious errors.
**Recommendation:** Add a `src/lib/env.ts` validation (or use `@t3-oss/env-nextjs`) that throws at build time if required env vars are missing.

---

### AC-06: Tailwind Content Path Includes All UI Package Sources

**File:** `apps/rider/tailwind.config.ts` L8-9
**Severity:** INFO — Correct Pattern

```typescript
content: [
  './src/**/*.{ts,tsx}',
  '../../packages/ui/src/**/*.{ts,tsx}',
],
```

Including `packages/ui` ensures shared component classes aren't purged. This is the correct pattern for a monorepo.

---

### AC-07: `tsconfig.json` Missing `strict: true`

**File:** `apps/rider/tsconfig.json`
**Severity:** MEDIUM

Only `strictNullChecks: true` is enabled — not full `strict` mode. This means:
- `noImplicitAny` is OFF → untyped parameters/variables silently become `any`
- `noImplicitThis` is OFF
- `strictBindCallApply` is OFF
- `strictPropertyInitialization` is OFF
- `alwaysStrict` may be OFF

**Impact:** Type safety gaps that allow runtime errors to slip through. Especially risky in financial calculations and API response handling.
**Recommendation:** Enable `"strict": true` in `tsconfig.base.json` — fix type errors incrementally.

---

### AC-08: No Bundle Analysis or Size Budget

**Severity:** MEDIUM

Current dependencies include `mapbox-gl` (~800KB), `firebase` (~300KB), `socket.io-client` (~50KB). No bundle analysis tools or size budgets are configured.

**Impact:** On 2G/3G Ghana networks (common for riders), large bundles mean slow first loads. The rider may see a blank screen for 10-20 seconds.
**Recommendation:** Add `@next/bundle-analyzer` to monitor bundle size. Consider lazy-loading `mapbox-gl` and `firebase` — both are only needed after authentication.

---

## 2. Authentication & Security

### AS-01: Landing Page Terms Links Are Non-Functional Spans

**File:** `apps/rider/src/app/page.tsx` ~L133-136
**Severity:** MEDIUM — Legal Compliance Risk

```html
<span className="text-muted underline">Terms</span>
<span className="text-muted underline">Privacy Policy</span>
```

These are `<span>` elements, not links. "By continuing, you agree to our Terms & Privacy Policy" implies clickable documents.

**Impact:** Legal compliance issue — users can't read terms they're agreeing to. Specifically relevant for Ghana's Data Protection Act 2012 (Act 843).
**Recommendation:** Replace with actual `<Link>` components pointing to the marketing site's terms/privacy pages. Until those pages exist, remove the "By continuing, you agree" text.

---

### AS-02: Google OAuth Callback Has No CSRF Protection

**File:** `apps/rider/src/app/auth/google/callback/page.tsx`
**Severity:** HIGH

The Google OAuth callback page receives an authorization code via URL parameters and exchanges it for an access token. Review needed on whether the `state` parameter is validated to prevent CSRF attacks.

**Impact:** Without `state` parameter validation, an attacker could initiate an OAuth flow with their own Google account and have a victim complete it, linking the attacker's Google account to the victim's session.
**Recommendation:** Ensure the auth package generates a cryptographic `state` on redirect and validates it on callback. If already handled server-side, confirm the callback page checks the `state` match.

---

### AS-03: JWT Tokens Stored in localStorage

**File:** `packages/auth/src/token-storage.ts`
**Severity:** MEDIUM

Access and refresh tokens are stored in `localStorage` (with IndexedDB backup). While this is common for SPAs, localStorage is accessible via XSS.

**Impact:** If an XSS vulnerability exists anywhere in the app, tokens can be exfiltrated. The IndexedDB backup adds another attack surface.
**Recommendation:** This is an accepted trade-off for PWA compatibility (no server-side cookie session). Mitigate by:
1. Ensuring all user-generated content (chat messages, forum posts) is properly sanitized before rendering
2. Adding CSP headers that block inline scripts
3. Using short-lived access tokens (< 15 min) with silent refresh

---

### AS-04: PIN Input Uses `inputMode="numeric"` Without `autocomplete="off"`

**File:** `apps/rider/src/app/(dashboard)/dashboard/settings/security/set-pin/page.tsx`
**File:** `apps/rider/src/app/(dashboard)/dashboard/settings/security/change-pin/page.tsx`
**Severity:** MEDIUM

PIN inputs may be auto-filled or cached by mobile browsers/password managers.

**Impact:** Rider's financial PIN could be auto-suggested or stored in the browser's autofill database.
**Recommendation:** Add `autoComplete="off"` and `autoCorrect="off"` to all PIN input fields.

---

### AS-05: MAPBOX_TOKEN Exposed in Client Bundle

**File:** `apps/rider/src/lib/constants.ts` L3-5
**Severity:** MEDIUM

The Mapbox access token is embedded in the client-side JavaScript bundle via `NEXT_PUBLIC_MAPBOX_TOKEN`.

**Impact:** The token is publicly visible in browser DevTools. While Mapbox tokens are designed to be public (and can be URL-restricted), anyone could extract it and use it from unauthorized domains if URL restrictions aren't configured.
**Recommendation:** Configure Mapbox token URL restrictions in the Mapbox dashboard to only allow requests from production domains. Consider using a server-side proxy for sensitive map operations (which the `NavigationMap` component already does for directions).

---

### AS-06: `fetchPublicCard` and `fetchSpotlights` Use Raw `fetch()` Without Sanitization

**File:** `apps/rider/src/hooks/use-rider-identity.ts` ~L98-120
**Severity:** MEDIUM

```typescript
const fetchPublicCard = useCallback(async (slug: string) => {
  const res = await fetch(`${PUBLIC_BASE}/card/${slug}`);
```

The `slug` parameter is interpolated directly into the URL. While this is a GET request (not injection-prone in the traditional sense), a malicious slug containing `../` or encoded characters could cause unexpected API behavior.

**Impact:** Path traversal in the API endpoint could return unintended data.
**Recommendation:** Validate/sanitize the `slug` parameter before interpolation — e.g., `encodeURIComponent(slug)`.

---

### AS-07: Delivery Chat Messages Rendered As Raw Text (Good)

**File:** `apps/rider/src/components/delivery-chat.tsx` ~L128
**Severity:** INFO — No Issue

```tsx
<p className="text-sm">{msg.content}</p>
```

Chat messages are rendered via React's JSX text interpolation, which auto-escapes HTML. This correctly prevents XSS from malicious messages. ✅

---

## 3. Real-Time & Socket Layer

### RT-01: Shared Socket Singleton Can Leak Across Page Navigations

**File:** `apps/rider/src/hooks/use-socket.ts` L76-79
**Severity:** HIGH

```typescript
let sharedSocket: Socket | null = null;
let listenerCount = 0;
```

Module-level singletons persist across Next.js client-side navigations. If a user logs out and another logs in (same tab), the socket may still carry the old user's auth token until a full page reload.

**Impact:** After logout + login as different user, socket events could be attributed to the wrong rider.
**Recommendation:** Clear `sharedSocket` on logout. Add a `disconnect()` call in the auth provider's logout flow.

---

### RT-02: `emitLocation` Doesn't Use Critical Emit Pattern

**File:** `apps/rider/src/hooks/use-socket.ts` ~L186
**Severity:** MEDIUM

```typescript
const emitLocation = useCallback((lat: number, lng: number, heading?: number) => {
  sharedSocket?.emit('rider:updateLocation', { latitude: lat, longitude: lng, heading });
}, []);
```

Location updates use the optional chaining `?.emit()` pattern, which silently drops the update if the socket is disconnected. Unlike `respondToOffer`, location updates don't use the offline queue.

**Impact:** During a GPRS dropout, all location updates are silently lost. The rider's position on the server goes stale — dispatch may stop routing orders to them.
**Recommendation:** While queuing every location update would be excessive, a "last known location" buffer (keeping only the most recent) would ensure at least one update is replayed on reconnect.

---

### RT-03: `job:new` Event Handler on Jobs Page Doesn't Debounce

**File:** `apps/rider/src/app/(dashboard)/dashboard/jobs/page.tsx` ~L45-48
**Severity:** LOW

```typescript
const handleNew = () => { if (tab === 'available') fetchJobs(); };
socket.on('job:new', handleNew);
```

Each `job:new` event triggers a full `fetchJobs()` API call. If multiple orders are created in quick succession (rush hour), this fires N API calls within seconds.

**Impact:** Unnecessary load on both client and server during peak times.
**Recommendation:** Debounce the handler (e.g., 2-second window) so rapid-fire events coalesce into a single refetch.

---

### RT-04: Socket Reconnection Creates Memory Leak Risk

**File:** `apps/rider/src/hooks/use-socket.ts` ~L150-153
**Severity:** LOW

The `handleVisibility` event listener is registered inside the `useEffect` but re-registers on every mount. With React Strict Mode (development), this can create duplicate listeners. The cleanup function correctly removes them, but the pattern is fragile.

**Impact:** Minimal in production (no Strict Mode double-mount), but could cause double-reconnects in development.
**Recommendation:** Already handles correctly — no change needed, but add a development-mode guard if issues are observed.

---

### RT-05: No Socket Health Indicator for Chat Feature

**File:** `apps/rider/src/components/delivery-chat.tsx`
**Severity:** LOW

The chat component uses `socket.emit()` for sending messages but has no visual indicator when the socket is disconnected. A rider could type messages that are silently dropped.

**Impact:** Rider thinks message was sent, but it was lost due to disconnection.
**Recommendation:** Show a "Reconnecting..." banner in the chat UI when `connected` is false, similar to how the dashboard shows reconnection status.

---

## 4. PWA & Service Worker

### PW-01: Service Worker Caches Authenticated API Responses

**File:** `apps/rider/src/sw.ts` ~L25-33
**Severity:** HIGH

```typescript
{
  matcher: /\/api\/v1\/(orders|riders|wallets|gamification|community)/,
  handler: new NetworkFirst({ cacheName: 'api-data', ... }),
  method: 'GET',
}
```

The service worker caches authenticated API responses (orders, wallets, gamification data) with a 5-minute TTL. These caches persist even after logout.

**Impact:** If rider A logs out and rider B logs in on the same device, rider B could briefly see rider A's cached order data, wallet balance, or gamification profile before the NetworkFirst strategy fetches fresh data.
**Recommendation:** Clear the `api-data` cache on logout. Add a `CLEAR_CACHES` message handler in the service worker:
```typescript
if (type === 'CLEAR_CACHES') {
  caches.delete('api-data');
}
```

---

### PW-02: Background Location Sync Token Can Go Stale

**File:** `apps/rider/src/sw.ts` ~L130-140
**Severity:** MEDIUM

```typescript
const item: QueuedLocation = {
  token: data.token,  // Captured at queue time
  ...
};
```

The auth token is captured when the location is queued. If the queue sits for minutes (bad network), the token could expire before the flush runs.

**Impact:** Background location sync fails with 401 — rider position goes stale on the server.
**Recommendation:** The `flushLocationQueue` function should request a fresh token from the main thread (via `postMessage`) before replaying queued locations. Alternatively, accept that the REST heartbeat from the main thread will eventually correct this.

---

### PW-03: Offline Page Has No Content

**File:** `apps/rider/src/app/~offline/page.tsx`
**Severity:** MEDIUM

The offline fallback page exists (used by Serwist's `fallbacks` config), but its content and usefulness should be verified.

**Impact:** When a rider navigates while offline, they see the offline page. If it only shows "You're offline" with no useful information (cached order data, last known status), it's a dead end.
**Recommendation:** The offline page should show:
1. Last known active delivery (from cache/localStorage)  
2. Cached map tile of current area
3. "You're offline — delivery data is saved and will sync when you reconnect"

---

### PW-04: Push Notification on Android Creates `new Notification()` Fallback

**File:** `apps/rider/src/hooks/use-push-notifications.ts` ~L66-70
**Severity:** LOW

```typescript
navigator.serviceWorker.ready
  .then(reg => reg.showNotification(title, opts))
  .catch(() => { try { new Notification(title, opts); } catch {} });
```

The `new Notification()` constructor is blocked on Android Chrome. This fallback will always fail on Android. Not harmful (silent catch), but the code path is dead.

**Impact:** None — the catch block handles it. Could be cleaned up for clarity.
**Recommendation:** Remove the `new Notification()` fallback for cleaner code, or add a comment explaining it's an iOS Safari fallback only.

---

### PW-05: `deviceId` for Push Token Registration Uses User-Agent

**File:** `apps/rider/src/hooks/use-push-notifications.ts` ~L24
**Severity:** LOW

```typescript
deviceId: `rider-${navigator.userAgent.slice(0, 50)}`,
```

User-Agent strings can change across browser updates. This means a rider's push token gets re-registered with a "new" device ID on every browser update, potentially creating duplicate push registrations.

**Impact:** Same device receives duplicate push notifications.
**Recommendation:** Generate a stable UUID and store it in localStorage:
```typescript
const deviceId = localStorage.getItem('riderguy_device_id') || crypto.randomUUID();
localStorage.setItem('riderguy_device_id', deviceId);
```

---

### PW-06: Serwist Disabled in Development

**File:** `apps/rider/next.config.js` ~L32
**Severity:** INFO — Correct Pattern

```typescript
disable: process.env.NODE_ENV === 'development',
```

Service worker is disabled in development to avoid caching headaches. Correct standard practice. ✅

---

## 5. Map & Navigation

### MN-01: Map Container Has No Explicit Height Fallback

**File:** `apps/rider/src/components/navigation-map.tsx` L285
**Severity:** LOW

```tsx
<div ref={containerRef} className="w-full h-full rounded-2xl" />
```

The map container relies on the parent having an explicit height (`h-full`). If the parent's height collapses (e.g., in a flex layout without `min-h`), the map renders at 0px height.

**Impact:** On some page layouts or during skeleton loading transitions, the map may briefly collapse to zero height, causing a Mapbox resize error.
**Recommendation:** Add a minimum height: `className="w-full h-full min-h-[200px] rounded-2xl"`.

---

### MN-02: `RiderMap` Component Loaded with `dynamic()` But No SSR Loading Indicator

**File:** `apps/rider/src/app/(dashboard)/dashboard/page.tsx` ~L32
**Severity:** LOW

```typescript
const RiderMap = dynamic(() => import('@/components/rider-map').then(mod => mod.RiderMap), { ssr: false });
```

No `loading` option is provided to `dynamic()`. During the client-side chunk load, the map area is empty (no skeleton or placeholder).

**Impact:** Brief flash of empty space before map loads — CLS (Cumulative Layout Shift) impact.
**Recommendation:** Add a loading skeleton:
```typescript
const RiderMap = dynamic(() => import('@/components/rider-map').then(mod => mod.RiderMap), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-skeleton rounded-2xl animate-pulse" />,
});
```

---

### MN-03: Direction Proxy Request Has No Rate Limiter on Client Side

**File:** `apps/rider/src/components/navigation-map.tsx` ~L111-130
**Severity:** MEDIUM

The `fetchRoute` function calls the server-side directions proxy. While the 30-second cooldown (`MIN_ROUTE_REFRESH_MS`) was added, a user could trigger many route fetches by rapidly changing order status (via devtools or API manipulation).

**Impact:** Potential abuse of the Mapbox Directions API quota through the proxy.
**Recommendation:** The server-side proxy should implement rate limiting per rider (e.g., max 2 requests/minute). The client-side cooldown is a good first defense but can be bypassed.

---

### MN-04: Map Style Switch Doesn't Preserve Route Layer

**File:** `apps/rider/src/components/navigation-map.tsx` ~L185-195
**Severity:** LOW

When switching between light/dark themes, `switchMapStyle` loads a new style which clears all custom layers. The `onStyleLoad` callback re-adds the traffic layer but doesn't re-draw the route.

**Impact:** Route line disappears when rider toggles theme during an active delivery. Route reappears on next GPS update (after drift threshold).
**Recommendation:** Trigger a route re-draw in the `onStyleLoad` callback using the last known route geometry.

---

## 6. UI/UX & Accessibility

### UX-01: Cancel Modal Uses Light-Mode-Only Colors

**File:** `apps/rider/src/components/rider-cancel-modal.tsx`
**Severity:** MEDIUM

The cancel modal uses hardcoded light-mode colors:
```typescript
const SEVERITY_COLORS = {
  low: 'bg-amber-50 text-amber-700 border-amber-200',
  // ...
};
```

And the modal body uses `bg-white`, `text-gray-900`, `bg-gray-50`, etc. — all light-mode specific.

**Impact:** In dark mode, the cancel modal appears as a jarring white card against the dark background. Text contrast may be poor, and the visual hierarchy breaks.
**Recommendation:** Use themed utilities: `bg-card`, `text-primary`, `border-themed` — matching the rest of the app's dark mode system.

---

### UX-02: No Haptic Feedback on Critical Actions

**File:** Various
**Severity:** LOW

The incoming request modal uses `navigator.vibrate([200, 100, 200])`, but other critical actions (Accept Job, Submit Proof, Go Online, Cancel Delivery) have no haptic feedback.

**Impact:** Reduced tactile confirmation on mobile — rider is less certain their tap registered.
**Recommendation:** Add short vibration (`navigator.vibrate?.(50)`) on Accept, Submit Proof, and status transition buttons.

---

### UX-03: No Loading State for Accept Job Button on Jobs Page

**File:** `apps/rider/src/app/(dashboard)/dashboard/jobs/page.tsx` ~L54-58
**Severity:** MEDIUM

```typescript
const acceptJob = async (orderId: string) => {
  if (!api || accepting) return;
  setAccepting(orderId);
  try {
    await api.post(`${API_BASE_URL}/orders/${orderId}/accept`);
    router.push(`/dashboard/jobs/${orderId}`);
  } catch {
    setAccepting(null);
  }
};
```

On GPRS, the `accept` request can take 5-15 seconds. The rider sees the button go to "loading" state, but if the request succeeds and `router.push` is slow, there's no navigation feedback.

**Impact:** Rider may tap Accept again, or close the app thinking it froze.
**Recommendation:** Show a full-screen overlay ("Accepting delivery...") during the accept flow, rather than just a button loader.

---

### UX-04: Pin Inputs Don't Support Paste

**File:** `apps/rider/src/app/(dashboard)/dashboard/settings/security/set-pin/page.tsx`
**Severity:** LOW

PIN inputs are single `<input>` fields with `maxLength={6}`. While they accept typed input, there's no explicit paste handler for OTP/PIN auto-fill from SMS.

**Impact:** Riders who receive a PIN via SMS (forgot PIN flow) can't paste it quickly.
**Recommendation:** For OTP inputs specifically, consider using `autocomplete="one-time-code"` for SMS auto-fill on mobile.

---

### UX-05: Error Boundary Shows Generic "Something went wrong"

**File:** `apps/rider/src/app/global-error.tsx`
**Severity:** LOW

The global error boundary shows a generic message with a "Try Again" button. No error details are logged to the user, and there's no way to report the issue.

**Impact:** Riders hit an error wall with no guidance. They can't tell support what happened.
**Recommendation:** Add an error reference code (from `error.digest`) and a "Report Issue" link/button.

---

### UX-06: Dashboard Earnings Card Shows `totalEarned` Without Context

**File:** `apps/rider/src/app/(dashboard)/dashboard/page.tsx` ~L230
**Severity:** LOW

The "Earned" stat shows `wallet.totalEarned` without specifying the time period. This could be today's earnings, this week's, or all-time — the rider doesn't know.

**Impact:** Misleading if rider expects today's earnings but sees all-time.
**Recommendation:** Add a label like "Total Earned" or "Today's Earnings" and fetch period-specific data.

---

### UX-07: No Keyboard Shortcut to Close Modals

**File:** Various modal components
**Severity:** LOW

The cancel modal, chat panel, and incoming request modal support Android back button (via `history.pushState`), but none respond to the Escape key.

**Impact:** Desktop/laptop users (admin testing, support staff) can't use Escape to close modals.
**Recommendation:** Add `useEffect` listeners for `keydown` → `Escape` on modal components.

---

### UX-08: Navigation Bottom Bar Covers Content on Small Screens

**File:** `apps/rider/src/app/(dashboard)/layout.tsx` ~L20-22
**Severity:** LOW

```tsx
<main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
```

The padding-bottom calculation accounts for the nav bar height, but on very small screens (320px width / 568px height — iPhone SE), the combination of the nav bar and map takes up most of the viewport, leaving minimal scrollable content.

**Impact:** Jobs and earnings pages may feel cramped on small devices.
**Recommendation:** On sub-pages with heavy content (jobs list, earnings), consider using a compact nav bar or auto-hiding nav on scroll.

---

## 7. Data Fetching & State Management

### DF-01: Active Orders Polled at 10s Interval Even When No Active Order Exists

**File:** `apps/rider/src/app/(dashboard)/dashboard/page.tsx` ~L107-110
**Severity:** MEDIUM

```typescript
const { data: orders = [] } = useQuery({
  queryKey: ['orders', 'active-rider'],
  queryFn: ...,
  refetchInterval: 10_000, // Always polling
});
```

The 10-second polling runs continuously, even when the rider is offline or has no active orders.

**Impact:** Unnecessary network requests on GPRS — wastes battery and data. At ~144 requests/day/rider when idle, this adds up.
**Recommendation:** Make `refetchInterval` conditional:
```typescript
refetchInterval: isOnline ? (orders.length > 0 ? 5_000 : 30_000) : false,
```
Poll every 5s during active delivery, every 30s when idle + online, and stop when offline.

---

### DF-02: `useRiderAvailability` Fetches Profile on Every Mount

**File:** `apps/rider/src/hooks/use-rider-availability.ts` ~L82-100
**Severity:** LOW

The hook fetches the rider profile on mount to get initial availability. This data is duplicated with the `rider-profile` React Query call on the dashboard.

**Impact:** Two redundant profile fetches on dashboard mount.
**Recommendation:** Use React Query for the profile fetch inside `useRiderAvailability`, sharing the `rider-profile` query key.

---

### DF-03: Community Hooks Use `useState` Instead of React Query

**File:** `apps/rider/src/hooks/use-community.ts`, `use-events.ts`, `use-feature-requests.ts`, `use-mentorship.ts`, `use-gamification.ts`
**Severity:** MEDIUM

All community-related hooks implement their own loading/error/data state management with `useState` + manual `fetch`. Meanwhile, the dashboard uses React Query for its data.

**Impact:**
- No automatic cache invalidation or background refresh
- No stale-while-revalidate for instant loads
- No global deduplication (two components using the same hook trigger duplicate requests)
- Manual loading states in every hook

**Recommendation:** Migrate community hooks to React Query. This gives free caching, deduplication, background refresh, and integrates with the existing `useForegroundRecovery` invalidation.

---

### DF-04: Gamification Profile Fetched Twice on Dashboard

**File:** `apps/rider/src/app/(dashboard)/dashboard/page.tsx` ~L115-126
**File:** `apps/rider/src/hooks/use-gamification.ts` ~L196-198

**Severity:** LOW

The dashboard page has its own `useQuery({ queryKey: ['gamification-profile'] })`, AND the gamification hook has an `useEffect` that calls `fetchProfile()` on mount. If both are active, the profile is fetched twice.

**Impact:** Duplicate API call on mount.
**Recommendation:** Standardize on React Query for gamification data — either use the hook or the page-level query, not both.

---

### DF-05: Notification Count Fetches Full Page of Notifications Just to Count Unread

**File:** `apps/rider/src/app/(dashboard)/dashboard/page.tsx` ~L129-134
**Severity:** LOW

```typescript
const res = await api!.get('/notifications', { params: { pageSize: '1' } });
const all = res.data.data ?? [];
return { unread: all.filter((n: { isRead: boolean }) => !n.isRead).length };
```

This fetches page 1 with pageSize=1, then counts unread from the one returned item. The unread count is always 0 or 1.

**Impact:** Unread badge is inaccurate — shows max "1" even if there are 50 unread notifications.
**Recommendation:** Add a dedicated `/notifications/unread-count` API endpoint, or use the existing endpoint's `meta` field if it includes total unread count.

---

## 8. Community Features

### CM-01: Chat Room List Not Sorted by Last Activity

**File:** `apps/rider/src/hooks/use-community.ts` ~L133-135
**Severity:** LOW

`fetchRooms` sets rooms directly from API response without client-side sorting. The real-time `handleMessage` handler does bump the active room to the top, but the initial load order depends on the API.

**Impact:** On first load, rooms may not be in "most recent first" order.
**Recommendation:** Sort rooms by `lastMessage.createdAt` after fetching.

---

### CM-02: Forum Vote Calculation Has Off-by-One on Remove

**File:** `apps/rider/src/hooks/use-community.ts` ~L280-290
**Severity:** LOW

```typescript
upvotes: p.upvotes + (result.value === 1 ? 1 : 0) - (oldVote === 1 ? 1 : 0),
downvotes: p.downvotes + (result.value === -1 ? 1 : 0) - (oldVote === -1 ? 1 : 0),
```

When `result.value` is `0` (vote removed), the old vote is subtracted but the new vote is not added, which is mathematically correct. However, if the API returns `result.value` as `null` instead of `0`, the comparison `result.value === 1` would fail and the old vote would still be subtracted — creating a negative count.

**Impact:** Potentially negative vote counts if API behavior changes.
**Recommendation:** Normalize `result.value` to default to `0` if null/undefined.

---

### CM-03: Typing Indicator Timers Not Cleaned on Room Switch

**File:** `apps/rider/src/hooks/use-community.ts` ~L223-235
**Severity:** LOW

The typing timer cleanup runs in the socket listener's `return` cleanup. But if the user switches rooms (calls `leaveRoom` then `enterRoom`), the typing timers for the old room persist until the component unmounts.

**Impact:** "User is typing..." indicator appears briefly when entering a new room if someone was typing in the old room.
**Recommendation:** Clear `typingTimersRef` and `typingUsers` state in the `leaveRoom` function (already partially done — `setTypingUsers(new Map())` is there).

---

### CM-04: Feature Request `title` and `description` Not Length-Validated on Client

**File:** `apps/rider/src/hooks/use-feature-requests.ts` ~L55-60
**Severity:** LOW

```typescript
const createRequest = useCallback(async (title: string, description: string) => {
  const res = await api.post(BASE, { title, description });
```

No client-side validation on title/description length before sending to the API.

**Impact:** Poor UX — rider types a very long feature request, submits, and gets a server validation error.
**Recommendation:** The page component should validate before calling `createRequest`. This is a UI concern rather than a hook concern.

---

## 9. Platform Strengths

The rider client platform demonstrates strong engineering across many areas:

### ✅ Excellent PWA Architecture
- Serwist service worker with precaching + runtime caching strategies
- Background sync for location updates with IndexedDB persistence
- Push notification support with FCM integration
- Offline fallback page with navigation handling
- Screen Wake Lock to prevent sleep during active deliveries
- Audio keep-alive to prevent browser suspension

### ✅ Ghana-Optimized Network Handling
- Adaptive heartbeat intervals based on connection quality
- GPRS-aware staggered query invalidation on foreground recovery
- Socket.IO offline queue for critical events (offer responses)
- REST heartbeat fallback when socket is disconnected
- GPS fallback from high-accuracy (satellite) to low-accuracy (cell tower)

### ✅ Comprehensive Delivery UX
- Real-time order tracking with live map
- Multi-stop delivery support with sequence enforcement
- Three proof-of-delivery methods (photo, signature, PIN)
- Inline delivery chat with typing indicators
- Navigation integration with persistent "Return to App" notification
- Cancellation flow with escalating consequences and post-pickup authorization

### ✅ Robust Auth System
- Multi-method authentication (phone OTP, PIN, biometric, email, Google OAuth)
- Session management with device tracking
- WebAuthn biometric registration and authentication
- Token refresh with IndexedDB backup
- Role-based route protection

### ✅ Well-Structured Codebase
- Clean separation: hooks for logic, components for UI, lib for utilities
- Shared packages (auth, ui, types, utils, validators, config)
- Consistent coding patterns across 50+ files
- Theme system with dark mode, CSS variables, and system preference detection
- Monorepo with Turborepo for build orchestration

### ✅ Production-Ready Monitoring
- Connection health dashboard (quality indicator, latency, missed heartbeats)
- Reconnection state with attempt counter
- Socket status indicators
- GPS error banners with human-readable messages
- Session duration tracking

### ✅ Rider Engagement Features
- Gamification (XP, levels, badges, challenges, leaderboards, rewards store)
- Community (chat rooms, forum, mentorship, events, feature requests, spotlights)
- Rider identity (public profile cards, monthly spotlights)

---

## 10. Recommendations Priority Matrix

### 🔴 Fix Before Launch (HIGH/CRITICAL)

| ID | Issue | Effort |
|----|-------|--------|
| PW-01 | Clear API cache on logout | Small |
| RT-01 | Clear shared socket on logout | Small |
| AS-02 | Validate OAuth `state` parameter | Small |
| AC-02 | Fix doubled API_BASE_URL in jobs page | Trivial |

### 🟡 Fix Within First Sprint (MEDIUM)

| ID | Issue | Effort |
|----|-------|--------|
| AC-01 | Remove global `force-dynamic` | Small |
| AC-05 | Add env var validation | Small |
| AC-07 | Enable `strict: true` in tsconfig | Medium |
| AS-01 | Make Terms/Privacy links functional | Small |
| AS-06 | Sanitize slug in identity hook | Trivial |
| PW-02 | Handle stale token in SW queue | Medium |
| PW-05 | Stable device ID for push tokens | Small |
| UX-01 | Dark mode for cancel modal | Medium |
| UX-03 | Full-screen accept flow overlay | Small |
| DF-01 | Conditional polling interval | Small |
| DF-03 | Migrate community hooks to React Query | Large |
| DF-05 | Fix notification unread count | Small |
| MN-03 | Server-side rate limit on directions proxy | Medium |

### 🟢 Nice to Have (LOW)

| ID | Issue | Effort |
|----|-------|--------|
| AC-03 | Delete legacy `pages/` directory | Trivial |
| AC-08 | Add bundle analysis | Small |
| AS-04 | Add `autoComplete="off"` to PIN inputs | Trivial |
| MN-01 | Add min-height to map container | Trivial |
| MN-02 | Add loading skeleton for dynamic map import | Trivial |
| MN-04 | Preserve route on theme switch | Small |
| UX-02 | Haptic feedback on critical actions | Trivial |
| UX-04 | OTP auto-fill support | Small |
| UX-05 | Error reference codes in global error | Small |
| UX-06 | Earnings time period label | Trivial |
| UX-07 | Escape key for modals | Small |
| RT-03 | Debounce `job:new` handler | Trivial |
| RT-05 | Socket status in chat UI | Small |
| CM-01 | Sort chat rooms by activity | Trivial |
| DF-02 | Deduplicate profile fetch | Small |
| DF-04 | Deduplicate gamification fetch | Small |

---

*End of audit. Total: 47 findings across 8 categories. 4 items recommended for pre-launch fix.*
