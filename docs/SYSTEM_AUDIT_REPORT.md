# Riderguy System Audit Report

**Date:** March 15, 2026  
**Scope:** Full ride lifecycle — Request → Delivery → Completion  
**Method:** Line-by-line code review of API services, routes, Socket.IO, database schema, BullMQ workers, client app, and rider app.

---

## Executive Summary

| Layer | Readiness | Notes |
|-------|-----------|-------|
| Database Schema | **95%** | 41 models, well-structured. Missing only LocationHistory for route replay. |
| API Backend | **80%** | All core endpoints exist. Critical logic gaps in payment→dispatch flow e cancellation fees. |
| Pricing Engine | **98%** | All 15 factors implemented and tested. Two helper functions never called. |
| Auto-Dispatch | **85%** | 6-factor scoring works. Missing radius expansion & payment validation. |
| Socket.IO Real-Time | **90%** | Auth, rate limiting, Redis adapter, all events. Minor timer bug. |
| BullMQ Workers | **60%** | Queues defined. Workers partially wired. No transfer verification. |
| Client App (Frontend) | **40%** | Booking + live tracking work. No payment checkout UI, no receipts. |
| Rider App (Frontend) | **35%** | Jobs visible + map navigation. Can't go online/offline, can't submit proof, can't view earnings. |
| **Overall** | **~65%** | Backend is strong. **Frontend wiring + 5 critical blockers prevent launch.** |

---

## TIER 1 — CRITICAL BLOCKERS (Must fix before any launch)

### BUG-01: Auto-Dispatch Fires Before Payment Confirmation

**Severity:** CRITICAL  
**File:** [apps/api/src/routes/orders/order.routes.ts](../apps/api/src/routes/orders/order.routes.ts)

**Problem:** When a client creates an order with CARD or MOBILE_MONEY, `autoDispatch()` is called immediately — before the client completes Paystack checkout.

```
Current flow:
POST /orders → order created (PENDING) → autoDispatch() called immediately
              → Rider gets job offer for UNPAID order
              → Client hasn't paid yet
```

**Expected flow:**
```
POST /orders → order created (PENDING, paymentStatus=PROCESSING)
Client completes Paystack payment
Paystack webhook fires → paymentStatus=COMPLETED
→ THEN autoDispatch() should be called
→ Rider gets job offer for PAID order
```

**Impact:** Riders accept jobs that may never be paid for. Wastes rider time and erodes trust.

**Fix:** Only call `autoDispatch()` for CASH and WALLET orders at creation time. For CARD/MOBILE_MONEY, trigger dispatch inside the Paystack webhook handler after payment verification succeeds.

---

### BUG-02: Paystack Webhook Does Not Trigger Dispatch

**Severity:** CRITICAL  
**File:** [apps/api/src/routes/payments/payment.routes.ts](../apps/api/src/routes/payments/payment.routes.ts)

**Problem:** The webhook handler updates `paymentStatus` to COMPLETED but never transitions the order to `SEARCHING_RIDER` and never calls `autoDispatch()`.

**Impact:** Orders paid by card/mobile money sit indefinitely in PENDING status. No rider is ever dispatched.

**Fix:** After setting `paymentStatus = COMPLETED`, transition order status to `SEARCHING_RIDER` and call `autoDispatch(orderId)`.

---

### BUG-03: Cancellation Fees Not Implemented

**Severity:** CRITICAL  
**File:** [apps/api/src/services/order.service.ts](../apps/api/src/services/order.service.ts)

**Problem:** `cancelOrder()` transitions to CANCELLED status without charging any fees or compensating riders.

**Per lifecycle spec:**
| Stage | Fee |
|-------|-----|
| Before assignment (PENDING/SEARCHING_RIDER) | FREE |
| After assignment (ASSIGNED) | GHS 3.00 to rider |
| After pickup (PICKED_UP+) | GHS 5.00 to rider |

**Current code:** Just sets status to CANCELLED. No fee calculation, no wallet deduction, no rider compensation, no Paystack refund.

**Impact:** No disincentive for frivolous cancellations. Riders lose money on wasted trips.

**Fix:** Implement cancellation fee logic: deduct from client payment/wallet, credit rider wallet with compensation, create Transaction records for both parties.

---

### BUG-04: Rider Earnings Never Auto-Credited on Delivery

**Severity:** CRITICAL  
**Files:** [apps/api/src/services/order.service.ts](../apps/api/src/services/order.service.ts)

**Problem:** No evidence that when an order transitions to `DELIVERED`, the rider's wallet is automatically credited with their earnings. The lifecycle specifies instant wallet credit on delivery.

**Expected:** On `DELIVERED` transition:
1. Calculate `riderEarnings = totalPrice - platformCommission`
2. Credit rider's Wallet (increment `balance` and `totalEarned`)
3. Create Transaction record (type: `DELIVERY_EARNING`)
4. Award XP (50 base + bonuses)
5. Update rider streak

**Impact:** Riders complete deliveries but their wallet balance stays at zero. The entire financial model is broken.

**Fix:** Add wallet credit + transaction creation + gamification triggers inside the `transitionStatus()` function when target status is `DELIVERED`.

---

### BUG-05: No `wallet.service.ts` — Direct DB Manipulation

**Severity:** HIGH  
**File:** Missing

**Problem:** There is no dedicated wallet service. Wallet operations (credit, debit, transfer) are done inline in route handlers with raw Prisma calls.

**Impact:**
- No atomic balance updates (race conditions possible)
- No reusable credit/debit functions
- Inconsistent transaction recording
- No balance validation before deductions

**Fix:** Create `wallet.service.ts` with functions: `creditWallet()`, `debitWallet()`, `getBalance()`, `createTransaction()` — all using Prisma transactions for atomicity.

---

### BUG-06: Withdrawal Processing Never Completes

**Severity:** CRITICAL  
**Files:** [apps/api/src/routes/wallets/wallet.routes.ts](../apps/api/src/routes/wallets/wallet.routes.ts), [apps/api/src/jobs/workers.ts](../apps/api/src/jobs/workers.ts)

**Problem:** The withdrawal endpoint creates a PENDING withdrawal record but the BullMQ payout worker that processes it:
1. Initiates a Paystack transfer but doesn't verify completion
2. No webhook handler for Paystack transfer events (`transfer.success`, `transfer.failed`)
3. Riders never receive confirmation that their withdrawal succeeded or failed

**Impact:** Riders request withdrawals, money is deducted from wallet, but actual bank/mobile money transfer status is unknown.

**Fix:**
1. Add Paystack transfer webhook handler for `transfer.success` and `transfer.failed`
2. Update Withdrawal status accordingly
3. Notify rider of result (push + in-app)
4. On failure: refund wallet balance

---

## TIER 2 — MAJOR GAPS (Required for functional MVP)

### GAP-01: No Payment Checkout UI in Client App

**Severity:** HIGH  
**Location:** Client frontend (`apps/client/`)

**Problem:** The client app has full order booking flow but no Paystack checkout modal or payment page. After price estimation, there's no way to complete payment.

**Impact:** Client can create orders but cannot pay. Only CASH orders work end-to-end.

**Fix:** Integrate Paystack inline JS or redirect to Paystack checkout URL (already generated by `POST /payments/initialize`).

---

### GAP-02: Rider Cannot Go Online/Offline

**Severity:** HIGH  
**Location:** Rider frontend (`apps/rider/`)

**Problem:** The API endpoint `PATCH /riders/availability` exists and works, but there is no UI toggle button in the rider app.

**Impact:** Riders are stuck in whatever status they were created with. Cannot make themselves available for deliveries.

**Fix:** Add an online/offline toggle switch to the rider dashboard header or home screen.

---

### GAP-03: Rider Cannot Submit Proof of Delivery

**Severity:** HIGH  
**Location:** Rider frontend + API

**Problem:** The rider app has POD components (photo capture, signature canvas, PIN input) but:
- The `POST /orders/:id/proof` endpoint exists in routes
- But the rider app has no UI flow connecting delivery status transitions to POD submission
- No "complete this step" buttons for status progression (EN_ROUTE → AT_PICKUP → PICKED_UP → etc.)

**Impact:** Riders can't systematically progress through a delivery. No proof of delivery captured.

**Fix:** Build the active delivery screen with step-by-step status buttons and POD submission at each required stage.

---

### GAP-04: Rider Earnings / Wallet UI Missing

**Severity:** HIGH  
**Location:** Rider frontend (`apps/rider/`)

**Problem:** Rider app has no:
- Wallet balance display
- Transaction history view
- Withdrawal request form
- Earnings breakdown per delivery

**Impact:** Even if backend wallet crediting is fixed, riders can't see or access their money.

**Fix:** Build earnings dashboard with balance card, transaction list, and withdrawal form.

---

### GAP-05: Multi-Stop Completion Endpoint Missing

**Severity:** MEDIUM  
**File:** [apps/api/src/routes/orders/order.routes.ts](../apps/api/src/routes/orders/order.routes.ts)

**Problem:** `POST /orders/:id/complete-stop` mentioned in lifecycle doc is not implemented as a route. Individual `OrderStop` records have proof fields in the schema but no endpoint to mark them complete.

**Impact:** Multi-stop deliveries can't track intermediate stop completions separately.

**Fix:** Add `POST /orders/:id/stops/:stopId/complete` route that accepts proof (photo/signature/PIN) and marks that specific stop as delivered.

---

### GAP-06: No Location History / Breadcrumb Trail

**Severity:** MEDIUM  
**Files:** Schema + [apps/api/src/services/tracking.service.ts](../apps/api/src/services/tracking.service.ts)

**Problem:** No `LocationHistory` model in the database. The tracking service only stores the rider's current position on `RiderProfile`. Historical GPS breadcrumbs are never persisted.

**Impact:**
- Cannot replay a rider's route after delivery
- Cannot audit disputed deliveries
- Cannot detect route manipulation/fraud
- No data for route optimization

**Fix:** Add `LocationHistory` model (riderId, orderId, latitude, longitude, heading, speed, timestamp) and write breadcrumbs on each `rider:updateLocation` event.

---

### GAP-07: No ETA Calculation Service

**Severity:** MEDIUM  
**File:** [apps/api/src/services/tracking.service.ts](../apps/api/src/services/tracking.service.ts)

**Problem:** No ETA calculation exists. The client app shows the route on the map but no dynamic arrival time estimate.

**Expected:** Use Mapbox Directions API from rider's current position to next destination. Fallback: `distance / averageSpeed`.

**Fix:** Add `getETA(riderLat, riderLng, destLat, destLng)` function calling Mapbox and emit ETA alongside location updates.

---

### GAP-08: No Geofence Validation

**Severity:** MEDIUM  
**Location:** API — no `geofence.service.ts`

**Problem:** When riders mark "Arrived at pickup" or "Arrived at dropoff," there's no verification that they're actually near the location.

**Impact:** Riders could mark arrival from anywhere, enabling fraud.

**Fix:** Add geofence check: calculate haversine distance between rider's current GPS and target coordinates. Block status transition if > 200m.

---

### GAP-09: Receipt Generation Never Delivered

**Severity:** MEDIUM  
**File:** [apps/api/src/jobs/workers.ts](../apps/api/src/jobs/workers.ts)

**Problem:** Receipt worker generates receipt data but never sends it to the client (no email, no PDF, no in-app download).

**Fix:** Wire receipt worker to SendGrid email template with order breakdown, or generate PDF and store in S3 for download.

---

### GAP-10: No In-App Notification Panel (Client + Rider)

**Severity:** MEDIUM  
**Location:** Both frontend apps

**Problem:** Notifications are created in the DB and FCM push is sent, but neither app has a notification bell/panel/inbox to view past notifications.

**Fix:** Add notification list page or dropdown that queries `GET /notifications`.

---

## TIER 3 — LOGIC BUGS & EDGE CASES

### LOGIC-01: Onboarding Check Bypassed (Production Risk)

**Severity:** HIGH  
**Files:**
- [apps/api/src/routes/riders/rider.routes.ts](../apps/api/src/routes/riders/rider.routes.ts) (line 85)
- [apps/api/src/services/notification.service.ts](../apps/api/src/services/notification.service.ts) (line 199)

**Problem:** Both files contain: `// TODO: Re-enable after trial — temporarily bypassed for end-to-end testing`

**Impact:** Non-verified, non-approved riders can receive and accept delivery jobs. Safety and trust concern.

**Fix:** Remove the bypass. Restore the onboarding status check gatekeeping rider operations.

---

### LOGIC-02: Auto-Dispatch Has No Radius Expansion

**Severity:** MEDIUM  
**File:** [apps/api/src/services/auto-dispatch.service.ts](../apps/api/src/services/auto-dispatch.service.ts)

**Problem:** Search radius is hardcoded to `MAX_SEARCH_RADIUS_KM = 8`. If no riders within 8km, dispatch fails.

**Expected:** Progressive expansion: 5km → 8km → 12km with short delays between attempts.

**Fix:** Implement a loop with increasing radius: search at 5km first, if no candidates expand to 8km, then 12km.

---

### LOGIC-03: Auto-Dispatch Doesn't Check Payment Status

**Severity:** HIGH  
**File:** [apps/api/src/services/auto-dispatch.service.ts](../apps/api/src/services/auto-dispatch.service.ts)

**Problem:** `autoDispatch()` doesn't verify `paymentStatus === 'COMPLETED'` (or `method === 'CASH'`) before sending job offers.

**Impact:** Riders get dispatched to unpaid orders.

**Fix:** Add payment validation guard at the top of `autoDispatch()`.

---

### LOGIC-04: Job Offer Timer Shows Wrong Countdown

**Severity:** LOW  
**File:** [apps/api/src/socket/index.ts](../apps/api/src/socket/index.ts) (line ~160)

**Problem:** When re-emitting a pending offer on rider reconnection, `expiresAt` is hardcoded to `now + 25000ms` instead of calculating remaining time from original offer creation.

**Impact:** Reconnecting riders see 25s timer even if only 5s remain.

**Fix:** Store original `offerCreatedAt` and calculate: `expiresAt = offerCreatedAt + 30000`.

---

### LOGIC-05: Wait Time Charge Function Never Called

**Severity:** LOW  
**File:** [apps/api/src/services/pricing.service.ts](../apps/api/src/services/pricing.service.ts) (line ~353)

**Problem:** `calculateWaitTimeCharge()` exists with correct logic but is never invoked anywhere in the delivery completion flow.

**Fix:** Call it during delivery completion, add charge to final order total, credit extra to rider.

---

### LOGIC-06: Rider Pickup Distance Bonus Never Applied

**Severity:** LOW  
**File:** [apps/api/src/services/pricing.service.ts](../apps/api/src/services/pricing.service.ts) (line ~398)

**Problem:** `calculatePickupDistanceBonus()` exists but is never called during settlement.

**Fix:** Call during `DELIVERED` settlement. Add to rider earnings (platform absorbs cost, not client).

---

### LOGIC-07: FCM Push Has No Retry Mechanism

**Severity:** MEDIUM  
**File:** [apps/api/src/services/push.service.ts](../apps/api/src/services/push.service.ts)

**Problem:** Push notifications are fire-and-forget. If FCM is temporarily unavailable, the notification is lost.

**Fix:** Queue push notifications through BullMQ with retry logic (3 attempts, exponential backoff).

---

### LOGIC-08: Contact Form Email Not Sent

**Severity:** LOW  
**File:** [apps/api/src/routes/contact/contact.routes.ts](../apps/api/src/routes/contact/contact.routes.ts) (line 40)

**Problem:** `// TODO: In production, send email via SendGrid/Resend and store in DB`

**Impact:** Contact form submissions go nowhere.

**Fix:** Wire up SendGrid email to support inbox.

---

## TIER 4 — MISSING FRONTEND FEATURES (Backend exists, UI doesn't)

| Feature | Backend Status | Client App | Rider App |
|---------|---------------|------------|-----------|
| Saved Addresses | ✅ Full CRUD API | ❌ No UI | N/A |
| Favorite Riders | ✅ Full CRUD API | ❌ No UI | N/A |
| Notification Inbox | ✅ Full API | ❌ No panel | ❌ No panel |
| Gamification/Badges | ✅ Full API | N/A | ❌ No display |
| Challenge Participation | ✅ Full API | N/A | ❌ No UI |
| Rewards Store | ✅ Full API | N/A | ❌ No UI |
| Streak Display | ✅ Full API | N/A | ❌ No UI |
| Leaderboard | ✅ Full API | N/A | ❌ No UI |
| Mentorship | ✅ Full API | N/A | ❌ No UI |
| Events/Meetups | ✅ Full API | N/A | ❌ No UI |
| Feature Requests | ✅ Full API | N/A | ❌ No UI |
| Community Forums | ✅ Full API | N/A | ❌ No UI |

---

## TODO Comments Found in Codebase

| File | Line | Comment |
|------|------|---------|
| [rider.routes.ts](../apps/api/src/routes/riders/rider.routes.ts) | 85 | `TODO: Re-enable after trial — temporarily bypassed for end-to-end testing` |
| [notification.service.ts](../apps/api/src/services/notification.service.ts) | 199 | `TODO: Re-enable after trial — temporarily bypassed for end-to-end testing` |
| [contact.routes.ts](../apps/api/src/routes/contact/contact.routes.ts) | 40 | `TODO: In production, send email via SendGrid/Resend and store in DB` |

---

## TypeScript Compilation

| App | Errors | Status |
|-----|--------|--------|
| API (`apps/api`) | **0** | ✅ Clean compile |

---

## What IS Working Well

| Component | Status | Notes |
|-----------|--------|-------|
| **Database schema** | ✅ Excellent | 41 models, comprehensive, well-normalized |
| **Auth system** | ✅ Complete | Phone OTP, PIN, password, WebAuthn biometrics, multi-role, sessions |
| **Pricing engine** | ✅ Complete | All 15 factors, unit tested, zone-specific overrides |
| **Order state machine** | ✅ Correct | All 13 states with valid transitions + optimistic concurrency |
| **Auto-dispatch scoring** | ✅ Working | 6-factor weighted algorithm (proximity, rating, completion, on-time, experience, GPS) |
| **Socket.IO architecture** | ✅ Solid | Auth, rate limiting (60/10s), Redis adapter, room management |
| **Rider onboarding** | ✅ Complete | Document upload, vehicle registration, admin review flow |
| **Zone management** | ✅ Complete | GeoJSON polygons, surge pricing, activate/deactivate |
| **Community features** | ✅ Complete backend | Chat rooms, forums, polls, mentorship, events, feature requests |
| **Gamification** | ✅ Complete backend | XP, 7 levels, badges, streaks, challenges, rewards store, leaderboard |
| **Geocoding** | ✅ Complete | Mapbox forward/reverse/autocomplete + Plus Code support |
| **Live map tracking** | ✅ Working | Client sees rider move in real-time on Mapbox map |
| **Security** | ✅ Strong | Helmet, CORS, CSP, rate limiting, JWT, input validation (Zod) |
| **Error handling** | ✅ Good | Custom ApiError class, global handler, structured logging |

---

## Recommended Fix Priority

### Phase A — Critical Path (blocks any delivery from completing)

1. **Fix payment→dispatch flow** (BUG-01 + BUG-02 + LOGIC-03)
2. **Implement rider earnings credit on delivery** (BUG-04)
3. **Create wallet.service.ts** (BUG-05)
4. **Build payment checkout UI in client app** (GAP-01)
5. **Build rider availability toggle UI** (GAP-02)
6. **Build rider active delivery screen with status buttons** (GAP-03)
7. **Re-enable onboarding checks** (LOGIC-01)

### Phase B — Essential for trust & revenue

8. **Implement cancellation fees** (BUG-03)
9. **Build rider earnings/wallet UI** (GAP-04)
10. **Fix withdrawal completion flow** (BUG-06)
11. **Add geofence validation** (GAP-08)
12. **Add LocationHistory model** (GAP-06)
13. **Add ETA calculation** (GAP-07)

### Phase C — Polish for launch

14. **Build multi-stop completion endpoint** (GAP-05)
15. **Wire receipt delivery** (GAP-09)
16. **Build notification panels** (GAP-10)
17. **Fix job offer timer** (LOGIC-04)
18. **Wire wait time charges** (LOGIC-05)
19. **Wire pickup distance bonus** (LOGIC-06)
20. **Add FCM retry queue** (LOGIC-07)
21. **Wire contact form email** (LOGIC-08)
22. **Build remaining frontend UIs** (Tier 4 table)

---

*End of audit. Zero TypeScript compile errors. 6 critical bugs, 10 major gaps, 8 logic issues, 12 missing frontend features identified.*
