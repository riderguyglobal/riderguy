# Rider Delivery System — Audit Report

> Generated: 2026-03-19
> Last updated: 2026-03-21
> Scope: Full-stack rider delivery pipeline — API services, Socket.IO, rider app hooks & components
> Files audited: 14 across `apps/api/src/` and `apps/rider/src/`

---

## Summary

| Severity | Count | Fixed | Category |
|----------|-------|-------|----------|
| **CRITICAL** | 6 | 6 ✅ | Money loss, security bypass, data corruption |
| **HIGH** | 8 | 8 ✅ | Race conditions, logic errors, broken features |
| **MEDIUM** | 10 | 10 ✅ | UX failures under real-world Ghana conditions |
| **DESIGN** | 10 | 10 ✅ | Architecture improvements for production readiness |

---

## CRITICAL — Will Lose Money or Break Trust

### C-01: PIN Proof Never Validated ✅ FIXED

**File:** `apps/api/src/routes/orders/order.routes.ts` ~L685-690
**Impact:** Any rider can mark any delivery complete with a fake PIN

The proof endpoint stores `pin:${proofData}` but **never compares it to `order.deliveryPinCode`**. Any 4–6 digit string is accepted as valid proof. The entire PIN-based delivery verification feature is non-functional.

```typescript
// CURRENT — accepts anything
proofUrl = `pin:${proofData}`;

// NEEDED — compare against the order's actual PIN
if (proofData !== order.deliveryPinCode) {
  throw ApiError.badRequest('Incorrect delivery PIN', 'INVALID_PIN');
}
```

**Fix:** Read `order.deliveryPinCode`, compare with `proofData`, reject if mismatch.

---

### C-02: No Wallet Idempotency — Double-Credit on Retry ✅ FIXED

**File:** `apps/api/src/services/wallet.service.ts` ~L28-50
**Impact:** Riders get paid twice for the same delivery on network retries

`creditWallet()` has no `UNIQUE` constraint check on `(walletId, referenceId, referenceType)`. On a GPRS timeout + automatic retry (extremely common in Ghana), the same delivery completion triggers `creditWallet` twice with identical `referenceId`, and the rider is **credited double**.

The `referenceId` field exists in the transaction record but is never used to prevent duplicates.

```typescript
// NEEDED — before creating the transaction
const existing = await tx.walletTransaction.findFirst({
  where: { walletId: wallet.id, referenceId, referenceType },
});
if (existing) return existing; // Idempotent — already processed
```

**Fix:** Add a unique constraint on `(walletId, referenceId, referenceType)` in Prisma schema + check-before-write in `creditWallet`.

---

### C-03: Geofence Bypassed When GPS Is Null ✅ FIXED

**File:** `apps/api/src/routes/orders/order.routes.ts` ~L490-498
**Impact:** Riders can confirm pickup/dropoff from anywhere by disabling GPS

The geofence check is guarded by:
```typescript
if (target && riderProfile.currentLatitude && riderProfile.currentLongitude)
```

If `currentLatitude` is `null` (GPS off, device location cleared), the **entire 200m geofence is silently skipped**. The status transition succeeds without any location verification.

**Fix:** If geofence is required (AT_PICKUP, AT_DROPOFF) and GPS is null, **reject** the transition:
```typescript
if (geofencedStatuses.includes(newStatus) && (!riderLat || !riderLng)) {
  throw ApiError.badRequest('GPS location required for this status', 'GPS_REQUIRED');
}
```

---

### C-04: Rider Can Be Assigned Two Orders Simultaneously ✅ FIXED

**File:** `apps/api/src/services/dispatch.service.ts` ~L22-85
**Impact:** One rider ends up with two active deliveries — one will be abandoned

The rider availability check (line ~48) reads from the DB, then `order.updateMany` (line ~55) only guards the *order* status, not the rider's. Two concurrent `assignRider` calls can both pass the availability check and each assign a different order to the same rider.

```
Timeline:
  T1: assignRider(orderA, rider1) → reads rider1.availability = ONLINE ✓
  T2: assignRider(orderB, rider1) → reads rider1.availability = ONLINE ✓ (not yet updated)
  T3: orderA.updateMany succeeds → order A assigned to rider1
  T4: orderB.updateMany succeeds → order B assigned to rider1
  T5: riderProfile.update(ON_DELIVERY) → runs twice, second is a no-op
  Result: rider1 has two ASSIGNED orders
```

**Fix:** Wrap the entire assign in a `$transaction` with a `riderProfile.updateMany` that guards on `availability: 'ONLINE'`:
```typescript
const { count } = await tx.riderProfile.updateMany({
  where: { id: riderProfileId, availability: 'ONLINE' },
  data: { availability: 'ON_DELIVERY' },
});
if (count === 0) throw new Error('Rider no longer available');
// THEN assign the order
```

---

### C-05: Non-Atomic Order Assign + Rider Status Update ✅ FIXED

**File:** `apps/api/src/services/dispatch.service.ts` ~L55-85
**Impact:** Server crash between writes leaves rider ONLINE with an assigned order

Order is set to `ASSIGNED` and rider to `ON_DELIVERY` in **two separate writes** outside a transaction. If the server crashes between them:
- Order is `ASSIGNED` to rider
- Rider is still `ONLINE`
- Dispatch sends them another job → C-04 above

**Fix:** Wrap both writes in a single `prisma.$transaction`.

---

### C-06: Commission Rate Format Ambiguity ✅ FIXED

**File:** `apps/api/src/services/pricing.service.ts` ~L173-175
**Impact:** Platform charges 0.15% instead of 15% — silent money leak

```typescript
const commissionRate = pickupZone?.commissionRate != null
  ? pickupZone.commissionRate / 100   // Assumes stored as 15, not 0.15
  : PLATFORM_DEFAULTS.commissionRate; // 0.15
```

If an admin enters `0.15` in the zone settings instead of `15`, the division produces `0.0015` and the platform charges **0.15%** commission. There's no validation on the zone admin panel, no documentation of the expected format, and no bounds check.

**Fix:** Add bounds validation: `if (rate < 1) rate *= 100;` or enforce `commissionRate` is always 0-100 in the admin validator + add a range constraint in Prisma schema.

---

## HIGH — Real Bugs That Will Hit in Production

### H-01: Promo Code Usage Never Incremented Atomically ✅ FIXED

**File:** `apps/api/src/services/pricing.service.ts` ~L316-343
**Impact:** Same promo code used unlimited times concurrently

The pricing function validates `usedCount < maxUses` but doesn't increment the count. The increment happens later in `createOrder()`, but between the price quote and order creation, multiple users can pass the validation with the same stale `usedCount`.

**Fix:** Move promo validation + increment into `createOrder` inside the same transaction. Or use a `SELECT ... FOR UPDATE` lock pattern.

---

### H-02: Offer Countdown Drifts from Server Clock ✅ FIXED

**File:** `apps/rider/src/components/incoming-request.tsx` ~L133-147
**Impact:** Rider accepts in time locally but server says expired

The countdown is purely client-side, initialized from `OFFER_COUNTDOWN = 30`. If the socket event arrives 5s late (normal on EDGE/GPRS in rural Ghana), the rider sees 30s but the server thinks 25s remain. Rider accepts at local countdown=3, server already expired → "job taken" error.

```typescript
// CURRENT
const [countdown, setCountdown] = useState(OFFER_COUNTDOWN);

// FIX — derive from server's expiresAt
const remaining = Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 1000));
const [countdown, setCountdown] = useState(remaining);
```

---

### H-03: `respondToOfferAsync` Timeout Never Cleared ✅ FIXED

**File:** `apps/rider/src/hooks/use-socket.ts` ~L143-161
**Impact:** Leaked timers accumulate — dozens of orphaned 10s timeouts

The `setTimeout` in `respondToOfferAsync` is never cleared when the Socket.IO ACK callback fires. The promise resolves correctly (second `resolve` is a no-op), but the timer leaks for 10 seconds per call.

**Fix:** Store the timeout ID and clear it inside the ACK callback:
```typescript
let timeoutId: ReturnType<typeof setTimeout>;
const promise = new Promise((resolve) => {
  timeoutId = setTimeout(() => resolve({ success: false, error: 'Timeout' }), 10000);
  socket.emit('job:offer:respond', data, (ack) => {
    clearTimeout(timeoutId);
    resolve(ack);
  });
});
```

---

### H-04: Socket `auth` Overwritten with Static Token on Disconnect ✅ FIXED

**File:** `apps/rider/src/hooks/use-socket.ts` ~L83-86
**Impact:** Token refresh breaks after first disconnect — all reconnections use stale token

The `onDisconnect` handler sets:
```typescript
s.auth = { token: tokenStorage.getAccessToken() };
```

This replaces the dynamic `auth` callback `(cb) => cb({ token: getAccessToken() })` set during socket creation. All future reconnections use this frozen token value instead of calling `getAccessToken()` fresh. After a token refresh, the socket is permanently locked to the old token.

**Fix:** Always use the callback form:
```typescript
s.auth = (cb: any) => cb({ token: tokenStorage.getAccessToken() });
```

---

### H-05: Refunds/Adjustments Inflate `totalEarned` ✅ FIXED

**File:** `apps/api/src/services/wallet.service.ts` ~L33-34
**Impact:** Rider earnings stats are permanently inflated

```typescript
update: {
  balance: { increment: amount },
  totalEarned: { increment: amount },  // ← always incremented regardless of txType
},
```

If `txType` is `REFUND`, `ADJUSTMENT`, or `CANCELLATION_COMPENSATION`, `totalEarned` still goes up. The rider's lifetime earnings stat becomes meaningless.

**Fix:** Only increment `totalEarned` when `txType` is `DELIVERY_EARNING` or `TIP`.

---

### H-06: `reassignRider` Can Orphan Orders ✅ FIXED

**File:** `apps/api/src/services/dispatch.service.ts` ~L168-172
**Impact:** Order stuck in PENDING with no rider after admin reassignment

```typescript
export async function reassignRider(...) {
  await unassignRider(orderId, actor);     // Sets order to PENDING, rider to ONLINE
  return assignRider(orderId, newRider);   // If this throws → order orphaned
}
```

If `assignRider` fails (new rider went offline, network flake), the order is stuck in `PENDING` with no rider. The original rider was already released.

**Fix:** Wrap in a transaction — if `assignRider` fails, rollback `unassignRider`.

---

### H-07: Proof Upload + Status Transition Is Non-Atomic ✅ FIXED

**File:** `apps/rider/src/app/(dashboard)/dashboard/jobs/[id]/page.tsx` ~L116-133
**Impact:** Proof saved but order stuck at AT_DROPOFF — retry creates duplicate proof

`handleProofSubmit` makes two sequential calls: `POST /proof` then `PATCH /status`. If proof succeeds but the status update fails (network drop between the two), proof is saved but the order stays AT_DROPOFF. Retrying uploads duplicate proof.

**Fix:** Either combine into a single API endpoint (`POST /orders/:id/complete` that handles both), or add an idempotency key to the proof upload.

---

### H-08: `unassignRider` Has No Optimistic Concurrency ✅ FIXED

**File:** `apps/api/src/services/dispatch.service.ts` ~L136-148
**Impact:** Admin unassign overwrites a rider who already picked up the package

There's a read (line ~121) then a write (line ~136) with no status guard. If the rider progresses to `PICKED_UP` concurrently, the admin's unassign overwrites the order to `PENDING` — while the package is physically in the rider's hands.

**Fix:** Add `status: order.status` to the `where` clause of the update (optimistic concurrency, same pattern used in `transitionStatus`).

---

## MEDIUM — UX Failures Under Ghana Network/Device Conditions

### M-01: Going ONLINE with Failed GPS Sends Null Coordinates ✅ FIXED

**File:** `apps/rider/src/hooks/use-rider-availability.ts` ~L168-173
**Impact:** Rider is ONLINE but invisible to dispatch — receives zero offers with no explanation

The catch block around GPS says "GPS failed — still toggle availability." The rider goes ONLINE with `latitude: undefined` sent to the server. They appear in the presence system but distance-based dispatch scoring skips them (distance = `NaN`).

**Fix:** Block the toggle if GPS fails — show "Enable location to go online." Don't send the ONLINE request without valid coordinates.

---

### M-02: Toggle Button Race Condition on Double-Tap ✅ FIXED

**File:** `apps/rider/src/hooks/use-rider-availability.ts` ~L153-155
**Impact:** Two PATCH requests fire simultaneously — rider oscillates ONLINE→OFFLINE→ONLINE

`if (loading)` reads from a React state closure, which is stale on rapid taps. Two `PATCH /riders/availability` requests fire.

**Fix:** Use `useRef` for the loading guard instead of `useState`.

---

### M-03: Foreground Recovery Fires All Queries at Once ✅ FIXED

**File:** `apps/rider/src/hooks/use-foreground-recovery.ts` ~L48-50
**Impact:** On slow GPRS, 10-20 HTTP requests compete for ~50 Kbps — mass timeouts

`queryClient.invalidateQueries()` refetches every cached query simultaneously after >5s background. On GPRS bandwidth, they all timeout, leaving the rider with stale data and spinning loaders.

**Fix:** Invalidate only critical queries (active-orders, rider-availability) and stagger the rest.

---

### M-04: Markers Recreated Every GPS Update ✅ FIXED

**File:** `apps/rider/src/components/navigation-map.tsx` ~L184-248
**Impact:** Visible jank and GC pressure on cheap Tecno/Infinix phones

The route/marker update effect runs on every `riderLat`/`riderLng` change (every 1-3s). Every run destroys all static markers and recreates them — but pickup/dropoff markers never move.

**Fix:** Separate the rider marker update from static marker creation. Only update the rider marker's `setLngLat()` on GPS changes.

---

### M-05: Per-Second Re-Render from Session Timer ✅ FIXED

**File:** `apps/rider/src/hooks/use-connection-health.ts` ~L155-168
**Impact:** Battery drain and scroll jank on low-end devices

`setHealth(...)` fires every 1000ms to increment `sessionDurationSec`. This triggers re-renders in every component consuming this hook.

**Fix:** Track session duration in a `useRef` and only expose it on demand (e.g., when the dashboard mounts), not via continuous state updates.

---

### M-06: Audio Keep-Alive Dies After First Background Cycle ✅ FIXED

**File:** `apps/rider/src/hooks/use-audio-keep-alive.ts` ~L63-64
**Impact:** Incoming job notifications silently stop — rider misses offers

The `touchstart`/`click` listeners are registered with `{ once: true }`. After the first interaction, if the AudioContext auto-suspends again (every background cycle on Android Chrome), there's no listener to resume it.

**Fix:** Remove `{ once: true }`. Add an `onstatechange` handler to the AudioContext that re-registers the resume logic.

---

### M-07: Wake Lock `isActive` Is Never Reactive ✅ FIXED

**File:** `apps/rider/src/hooks/use-wake-lock.ts` ~L86
**Impact:** UI shows lock is active, but phone sleeps — rider misses notifications

`isActive: wakeLockRef.current !== null` is evaluated once at render time. When the system releases the lock, the ref updates but no re-render fires. Components display stale `true`.

**Fix:** Add a `useState` for `isActive` and update it in both the release handler and the `onrelease` event.

---

### M-08: Blank Signature Accepted as Valid Proof ✅ FIXED

**File:** `apps/rider/src/components/proof-of-delivery.tsx` ~L53-55
**Impact:** Rider submits blank canvas — delivery "verified" with no actual signature

`canvas.toDataURL('image/png')` exports without checking if anything was drawn. A completely blank canvas is valid.

**Fix:** Track a `hasDrawn` ref that flips `true` on any canvas `mousedown`/`touchstart`. Disable submit until drawn.

---

### M-09: Socket Status Events Can Regress Order State ✅ FIXED

**File:** `apps/rider/src/app/(dashboard)/dashboard/jobs/[id]/page.tsx` ~L72-76
**Impact:** UI shows an old status (e.g., PICKUP_EN_ROUTE) after already showing AT_PICKUP

The handler blindly sets `order.status = data.status`. If socket events arrive out of order (normal under bad network), the UI regresses.

**Fix:** Only accept updates where the new status is "forward" in the status flow:
```typescript
const STATUS_ORDER = ['PENDING', 'SEARCHING_RIDER', 'ASSIGNED', 'PICKUP_EN_ROUTE', ...];
if (STATUS_ORDER.indexOf(data.status) > STATUS_ORDER.indexOf(order.status)) {
  setOrder(prev => ({ ...prev, status: data.status }));
}
```

---

### M-10: Business Discount Can Push Below Minimum Fare ✅ FIXED

**File:** `apps/api/src/services/pricing.service.ts` ~L356-374
**Impact:** Business clients charged below minimum — platform loses money on small orders

Pricing applies the minimum fare floor, then applies the business discount without re-checking:
```
GHS 8.00 (minimum) × 0.90 (10% business discount) = GHS 7.20 < minimum
```

**Fix:** Apply minimum fare floor **after** all discounts:
```typescript
subtotal = roundGhs(Math.max(minimumFare, subtotal * (1 - businessDiscount) - promoDiscount));
```

---

## DESIGN — Architecture Improvements for Production

### D-01: In-Memory Dispatch State Lost on Server Restart ✅ FIXED

**File:** `apps/api/src/services/auto-dispatch.service.ts`
**Impact:** Any Render redeploy drops all active dispatch loops — riders get re-offered declined jobs

`activeDispatches` is a `Map` in process memory. `recoverStuckDispatches` re-dispatches from scratch — riders who already declined are re-offered the same job.

**Fix:** Dispatch state (including declined rider IDs) is now persisted to Redis with 5-min TTL. On recovery, previously-declined riders are filtered out. Redis state is cleaned up on resolve/cancel.

---

### D-02: No Offline Queue for Critical Socket Emissions ✅ FIXED

**File:** `apps/rider/src/hooks/use-socket.ts`
**Impact:** Accept/decline lost on GPRS disconnection — rider taps Accept, nothing happens

If the socket is disconnected when the rider taps "Accept", `respondToOfferAsync` silently fails. No queue replays the response on reconnect.

**Fix:** Added sessionStorage-backed offline queue. Critical events (offer responses) are queued when disconnected and auto-flushed on reconnect. Events older than 2 minutes are automatically dropped.

---

### D-03: No Delivery SLA or Max-Duration Timeout ✅ FIXED

**Files:** `apps/api/src/services/order.service.ts`, `apps/api/src/index.ts`
**Impact:** Rider accepts a job and never delivers — order sits forever

There's no maximum time between ASSIGNED and DELIVERED. No background worker monitors for stale active deliveries. An order can sit in PICKUP_EN_ROUTE indefinitely.

**Fix:** Added `escalateStaleDeliveries()` cron (runs every 10 min). Orders stuck in active statuses for >2 hours get flagged with `SLA BREACH` in orderStatusHistory. De-duplicated to avoid repeated alerts within 1 hour.

---

### D-04: Location Breadcrumbs Grow Unbounded ✅ FIXED

**File:** `apps/api/src/socket/index.ts`, `apps/api/src/services/order.service.ts`
**Impact:** LocationHistory table dominates Neon storage within months

Every 3-second location update creates a `LocationHistory` row per active order. A 30-minute delivery = 600 rows. At 500 deliveries/day = 300,000 rows/day with no TTL, no archival, no cleanup.

**Fix:** (1) Breadcrumbs are now buffered in memory and batch-inserted every 30s instead of per-update. Buffer is flushed on disconnect. (2) Added `cleanupOldBreadcrumbs()` cron (daily) that deletes breadcrumbs older than 30 days.

---

### D-05: SMS Fallback Fires on Every Dispatch Attempt ✅ FIXED

**File:** `apps/api/src/services/auto-dispatch.service.ts`
**Impact:** 10 SMS sent per order if all riders time out — wasted cost and spam

`SmsService.sendNewJobAvailable` fires for every offer (up to 10 per order). At Ghana SMS rates (~GHS 0.05/msg), this adds up fast and annoys riders.

**Fix:** Added `smsSentCount` to dispatch state. SMS is only sent on the first offer per dispatch cycle (count === 0), reducing per-order SMS from up to 10 to exactly 1.

---

### D-06: No Rider Blacklist for Declined Orders ✅ FIXED

**Files:** `apps/api/src/services/auto-dispatch.service.ts`, `apps/api/src/services/order.service.ts`
**Impact:** Rider declines via dispatch → sees same order in job feed → can accept it

If a rider declines an auto-dispatched offer, they can still see the same order in the manual job feed (`GET /orders/available`) and accept it via `POST /orders/:id/accept`. The dispatch knowledge is lost.

**Fix:** Declined/timed-out rider IDs are stored per-order in Redis sets (1hr TTL). `getAvailableJobs` now filters out orders the rider has declined. Both explicit declines and offer timeouts are tracked.

---

### D-07: No Multi-Stop Sequence Enforcement ✅ FIXED

**File:** `apps/api/src/routes/orders/order.routes.ts`
**Impact:** Rider completes stop #3 before stop #1 — delivery chain breaks

The stop completion endpoint doesn't validate that all previous stops (by sequence number) have been completed first.

**Fix:** Added sequence validation before stop completion. Counts all earlier stops (sequence < N) not in COMPLETED/SKIPPED status. Returns 400 with descriptive error if prior stops are pending.

---

### D-08: Single-Process Presence Breaks Horizontal Scaling ✅ FIXED

**File:** `apps/api/src/services/presence.service.ts`
**Impact:** Second API instance has empty presence Map — dispatch sees no riders

The presence `Map` lives in one Node.js process. The Redis adapter handles socket broadcasts, but presence lookups (`getOnlineRiders`) still read from local memory. A second instance would return an empty rider list.

**Fix:** Presence data is now mirrored to Redis keys with 6-min TTL on every connect/disconnect/heartbeat. Added `getOnlineRidersGlobal()` async function that merges local + Redis data for cross-instance dispatch. In-memory Map kept as local cache for speed.

---

### D-09: Route Refresh Has No Debounce or Budget Cap ✅ FIXED

**File:** `apps/rider/src/components/navigation-map.tsx`
**Impact:** Burns through Mapbox API quota on highway driving

The map refreshes the route when the rider drifts >100m from the last route origin. At 60 km/h on a highway, that triggers every ~6 seconds. Each call costs $0.0005. At 500 active riders, that's significant.

**Fix:** Added 30-second minimum interval between route refreshes via `lastRouteRefreshRef` + `MIN_ROUTE_REFRESH_MS`. Distance drift check is still applied but refresh is skipped if cooldown hasn't elapsed. Initial route is always fetched immediately.

---

### D-10: No Abort Controller on Mapbox Direction Requests ✅ FIXED

**File:** `apps/rider/src/components/navigation-map.tsx`
**Impact:** Stale route drawn — older request resolves after newer one

Rapid GPS updates trigger overlapping `fetchRoute` calls. On slow GPRS, an older request resolving after a newer one draws a stale route.

**Fix:** Added `AbortController` ref. Each `fetchRoute` call aborts any in-flight request before starting. Signal is passed to `fetch()`. AbortError is silently caught. Controller is also aborted on component unmount.

---

## Fix Priority

| Phase | Items | What Gets Fixed |
|-------|-------|-----------------|
| **Phase 1 — Money & Security** | C-01, C-02, C-03, C-06 | PIN validation, wallet idempotency, geofence enforcement, commission format |
| **Phase 2 — Data Integrity** | C-04, C-05, H-06, H-08 | Atomic assignment, concurrent dispatch guard, reassign safety |
| **Phase 3 — Reliability** | H-02, H-03, H-04, H-07 | Offer countdown sync, timer leaks, token refresh, proof atomicity |
| **Phase 4 — Ghana UX** | M-01–M-10 | GPS gating, query batching, marker optimization, audio recovery |
| **Phase 5 — Scale Prep** | D-01–D-10 | Redis presence, delivery SLA, breadcrumb TTL, route debounce |
