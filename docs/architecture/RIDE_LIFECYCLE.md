# Riderguy — Complete Ride Lifecycle

> From **Request** to **Completion**: every state transition, safety check, financial settlement, and edge case.

---

## Table of Contents

1. [Phase 1: Client Requests a Delivery](#phase-1-client-requests-a-delivery)
2. [Phase 2: Rider Matching & Dispatch](#phase-2-rider-matching--dispatch)
3. [Phase 3: Rider En Route to Pickup](#phase-3-rider-en-route-to-pickup)
4. [Phase 4: At Pickup Location](#phase-4-at-pickup-location)
5. [Phase 5: In Transit](#phase-5-in-transit)
6. [Phase 6: Arrival at Dropoff](#phase-6-arrival-at-dropoff)
7. [Phase 7: Order Completed](#phase-7-order-completed)
8. [Cancellation Paths](#cancellation-paths)
9. [Failure Paths](#failure-paths)
10. [Behind-the-Scenes Infrastructure](#behind-the-scenes-infrastructure)

---

## State Machine Overview

```
                         ┌─ DELIVERY LIFECYCLE ───────────────────┐
                         │                                         │
PENDING ──────────────> SEARCHING_RIDER ──────> ASSIGNED          │
                                  ▲                  │             │
                                  │         ┌────────┘             │
                          [broadcast        │                      │
                           to riders]    PICKUP_EN_ROUTE           │
                                             │                     │
                            ┌────────────────┘                     │
                            │              [CANCELLED_BY_RIDER]    │
                            ▼                                      │
                          AT_PICKUP                                │
                            │                                      │
              ┌─FAILED──────┤                                      │
              │             │                                      │
              │          PICKED_UP                                 │
              │             │                                      │
              │          IN_TRANSIT                                │
              │             │                                      │
              │          AT_DROPOFF                                │
              │             │                                      │
              └──────────> DELIVERED (→ Instant Wallet Credit)     │
                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Client Requests a Delivery

### What the Client Does

- Opens the client PWA, enters **pickup address** and **dropoff address** (geocoded via Mapbox).
- Optionally adds **up to 5 stops** (multi-stop delivery).
- Selects **package type**: Document, Small Parcel, Medium Parcel, Large Parcel, Fragile, Food, High-Value.
- Enters **estimated weight** (if relevant).
- Chooses **delivery speed**: Standard or Express (<15 km priority).
- Optionally toggles **Scheduled Delivery** (future time/date, recurring: Once, Daily, Weekly, Monthly, Custom).
- Adds **recipient info** (name, phone) per stop.
- Adds **special instructions** (e.g., "Don't ring the bell", "Call on arrival").

### What Happens Behind the Scenes

#### 1. Price Estimate (`POST /orders/estimate`)

The system calculates the route via **Mapbox Directions API** → gets actual road distance and estimated duration. If Mapbox fails, falls back to **haversine distance × road factor** (1.15–1.4 depending on zone road conditions).

**15-Factor Pricing Engine applied:**

| # | Factor | Range | Example |
|---|--------|-------|---------|
| 1 | Base Fare | GHS 5.00 | Flat mobilization fee |
| 2 | Distance Charge | effective distance × GHS 2/km | 5 km = GHS 10 |
| 3 | Package Multiplier | 1.0× – 1.5× | Food 1.1×, Fragile 1.25×, High-Value 1.5× |
| 4 | Weight Surcharge | +GHS 0–10 | 5–10 kg = +GHS 2, 10–20 kg = +GHS 5 |
| 5 | Multi-Stop Surcharge | +GHS 3 per extra stop | 3 stops = +GHS 6 |
| 6 | Time of Day | 1.0× – 1.2× | Night (9 PM–6 AM) 1.2×, Rush hour 1.15×, Lunch 1.1× |
| 7 | Dynamic Surge | 1.0× – 1.8× (capped) | 6+ orders/rider in zone = 1.6× |
| 8 | Weather | 1.0× – 1.4× | Heavy rain 1.25×, Storm 1.4× |
| 9 | Cross-Zone | 1.2× | Pickup and dropoff in different zones |
| 10 | Express | 1.5× | Priority delivery (<15 km) |
| 11 | Schedule Discount | 0.90× – 0.95× | -5% next-day, -10% recurring |
| 12 | Business Volume Discount | 5–12% off | 51–500+ orders/month |
| 13 | Promo Code | % or flat | Admin-configured per campaign |
| 14 | Service Fee | 8–12% | Varies by payment method |
| 15 | Rider Commission | 15% → 8% by level | Level 1 = 15%, Level 7 = 8% |

**Pricing Formula:**

```
effectiveDistance = routeDistance || (haversineDistance × roadFactor)
distanceCharge   = effectiveDistance × perKmRate

rawSubtotal = (baseFare + distanceCharge + stopSurcharges + weightSurcharge)
              × packageMultiplier × surgeMultiplier × timeOfDayMultiplier
              × weatherMultiplier × crossZoneMultiplier × expressMultiplier
              × scheduleDiscount

subtotal    = MAX(rawSubtotal, minimumFare)
subtotal    = subtotal × (1 - businessDiscount) - promoDiscount
serviceFee  = ROUND(subtotal × serviceFeeRate)
totalPrice  = subtotal + serviceFee

platformCommission = ROUND(totalPrice × commissionRate)
riderEarnings      = totalPrice - platformCommission
```

**Real example (Accra, Medium Parcel, 8 km, evening rush, mobile money):**

- Base: GHS 5.00
- Distance: 8 × 1.3 (road factor) × GHS 2 = GHS 20.80
- Medium Parcel: ×1.15 = GHS 29.67
- Evening Rush: ×1.15 = GHS 34.12
- Service Fee (10%): GHS 3.41
- **Total: GHS 37.53** → Rider keeps GHS 31.90 (85%)

Returns **price breakdown** to client: subtotal, service fee, total, estimated duration, distance.

#### 2. Client Reviews Estimate and Confirms

#### 3. Payment Initiated

- Client selects payment method: **Card**, **Mobile Money**, **Wallet Balance**, or **Cash**.
- For digital methods → **Paystack checkout** initiated (`initializeTransaction`).
  - Paystack generates a payment URL / mobile money USSD prompt.
  - Client completes payment.
  - **Paystack webhook** fires → API receives and **verifies** (`verifyTransaction(reference)`).
  - Payment status → `COMPLETED` — order can now proceed.
- For **Cash** → no upfront payment; rider collects on delivery.
- For **Wallet** → balance deducted immediately; fails if insufficient.

#### 4. Order Created (`POST /orders`)

- Order record saved: status = `PENDING`.
- `OrderStatusHistory` entry logged (timestamp, actor, reason).
- `OrderStop` records created for each stop (sequenced).
- **Zone determined** from pickup coordinates (point-in-polygon against zone GeoJSON boundaries).
- If scheduled → `ScheduledDelivery` record created; order waits in queue until trigger time.

---

## Phase 2: Rider Matching & Dispatch

Auto-dispatch kicks in immediately (or at scheduled time).

### Step 1: Find Eligible Riders in the Pickup Zone

- Status = `ONLINE` (not `ON_DELIVERY`, `ON_BREAK`, or `OFFLINE`).
- Within **acceptable radius** of pickup (e.g., 5 km).
- Has a **verified, approved vehicle**.
- Account is `ACTIVE` (passed background check, documents verified).
- Not at capacity (no active delivery unless future order stacking).
- **Connection quality** is at least "good" (avoid dispatching to riders with poor signal).

### Step 2: Rank Eligible Riders By

1. **Proximity** to pickup (shortest distance first).
2. **Rating** (higher rated riders preferred).
3. **Level/XP** (experienced riders prioritized for complex orders like fragile/high-value).
4. **Acceptance rate** (riders who frequently decline get deprioritized).
5. **Time since last order** (fairness — idle riders get priority).
6. **Vehicle suitability** (if large parcel, prefer riders with bigger carriers).

### Step 3: Send Job Offer via Socket.IO (`rider:job-offer`)

- Rider gets a **push notification** (FCM) + in-app alert.
- Includes: pickup/dropoff addresses, distance, estimated earnings, package type, special instructions.
- **30-second acceptance window** — countdown timer on rider's screen.

### Step 4: Rider Responds

**ACCEPTS:**
- Order status: `PENDING` → `SEARCHING_RIDER` → `ASSIGNED`
- `riderId` linked to order.
- Rider status → `ON_DELIVERY`.
- Client notified: "Your rider [Name] is on the way!" (push + in-app).
- Client can now see rider's **name, photo, vehicle info, rating, level**.

**DECLINES or TIMEOUT (30s):**
- Move to **next rider** in the ranked list.
- Log the decline (affects future ranking).
- If rider declines too many in a row → soft warning, eventually affects acceptance rate score.

**NO RIDERS AVAILABLE:**
- Order stays in `SEARCHING_RIDER` for a configurable window (e.g., 5 minutes).
- Expand search radius incrementally: 5 km → 8 km → 12 km.
- If still no match → notify client: "No riders available. We'll keep trying." or offer to cancel for free.
- Admin can manually assign via dispatch panel (`POST /dispatch/manual`).

### Edge Cases

- **Rider's phone dies mid-acceptance** → heartbeat timeout (5 min no signal) → auto-reassign.
- **Rider accepts but never moves toward pickup** → after X minutes, system prompts "Are you on your way?" → if no response, auto-reassign + penalty.
- **Multiple orders in same area** → system batches intelligently (future: AI dispatch).

---

## Phase 3: Rider En Route to Pickup

**Order status: `PICKUP_EN_ROUTE`**

### 1. Live GPS Tracking Begins

- Rider's app sends location every **5–10 seconds** via Socket.IO (`rider:location-update`).
- Location broadcast to:
  - **Client app** (live map pin movement).
  - **Redis** (for fast lookups).
  - **Database** (periodic snapshots for audit trail).
- **ETA calculated** dynamically using Mapbox Directions from rider's current position to pickup.

### 2. Client Sees on Their Screen

- Live map with rider's moving pin.
- Rider's name, photo, vehicle, rating.
- Real-time ETA countdown.
- Option to **message rider** (in-app chat via Socket.IO).
- Option to **call rider** (phone number revealed, or masked number for privacy).
- Option to **cancel** (free before assignment, GHS 3.00 after assignment).

### 3. Rider Sees on Their Screen

- Turn-by-turn navigation to pickup (Mapbox).
- Pickup address + any special instructions.
- Client's name + phone.
- Package details.
- Earnings for this order.

### 4. Safety Measures Active

- **Route deviation detection**: If rider deviates significantly from route → system flags for review.
- **Idle detection**: If rider hasn't moved for extended time → prompt: "Still heading to pickup?"
- **Speed monitoring**: If GPS shows dangerously high speeds → logged for safety review (flagged, not real-time block).

---

## Phase 4: At Pickup Location

**Order status: `AT_PICKUP`**

### 1. Rider Arrives

- Rider marks "Arrived at pickup" in app.
- System verifies rider is **within geofence** of pickup coordinates (e.g., 200 m radius).
- If not within range → "You don't seem to be at the pickup location" warning.
- Status → `AT_PICKUP`.
- Client notified: "Your rider has arrived at pickup!"

### 2. Package Handoff

- Rider meets sender (client or designated sender).
- Rider **inspects package** — matches description? (right size, weight, type).
- Rider takes **pickup photo** (`POST /orders/:id/upload-photo`) — proof package was received.
- If package doesn't match description → rider can flag/refuse (e.g., listed as "document" but it's a heavy box).
- If item is prohibited/suspicious → rider reports, order flagged.

### 3. Verification at Pickup

- Client may need to provide **pickup PIN** (4-digit code shown in client app, rider enters it to confirm correct sender).
- Rider confirms package collected → status transitions to `PICKED_UP`.

### 4. Edge Cases

- **Sender not available** → Rider waits (configurable max wait time, e.g., 10 minutes). After wait → rider can mark "Sender unavailable" → client notified → order can be cancelled (with appropriate fee).
- **Wrong address** → Rider/client can coordinate via chat; admin can modify order.
- **Rider wants to cancel after seeing package** → Cancellation with GHS 5.00 fee (post-pickup); order goes back to dispatch for re-match.

---

## Phase 5: In Transit

**Order status: `IN_TRANSIT`**

### 1. Continuous Live Tracking

- GPS stream continues every 5–10 seconds.
- Client watches rider move on map in real-time.
- ETA dynamically recalculated as rider progresses.
- Route shown on map (expected vs. actual).

### 2. Multi-Stop Handling (if applicable)

- Stops are **sequenced** — rider follows order: Stop 1 → Stop 2 → Stop 3, etc.
- At each intermediate stop:
  - Status of that `OrderStop` updates.
  - Rider marks arrival → proof of delivery for that stop (photo/signature/PIN).
  - `POST /orders/:id/complete-stop` with proof.
  - Client gets per-stop notifications.
- After last stop → final delivery.

### 3. Communication Channels Open

- **In-app chat** between rider and client (real-time via Socket.IO).
- **Phone call** option.
- Client can send **updated instructions** mid-ride.

### 4. Safety Measures

| Measure | Details |
|---------|---------|
| **Route deviation detection** | Rider goes significantly off-route → alert to admin panel. |
| **Speed monitoring** | Excessive speed flagged for safety review. |
| **Dead zone handling** | If rider enters area with poor connectivity: heartbeat interval adapts; app caches location data offline, syncs on reconnect; `connectionQuality` updates: "excellent" → "good" → "poor" → "disconnected"; client sees "Rider's connection is weak, location may be delayed." |
| **Emergency SOS** | Rider can trigger emergency alert → dispatches to admin + emergency contacts. |
| **Geofence alerts** | If rider leaves the expected delivery zone entirely → flagged. |

### 5. What Admin Sees (Dispatch Panel)

- All active orders on a map.
- Rider positions in real-time.
- Flagged anomalies (route deviation, long idle, speed alerts).
- Ability to intervene: message rider, reassign, cancel.

---

## Phase 6: Arrival at Dropoff

**Order status: `AT_DROPOFF`**

### 1. Rider Arrives

- Rider marks "Arrived at dropoff".
- **Geofence verification** (within ~200 m of dropoff coordinates).
- Status → `AT_DROPOFF`.
- Client/recipient notified: "Your rider is at the delivery location!"

### 2. Proof of Delivery (one of these methods)

| Method | Description |
|--------|-------------|
| **Delivery PIN** | Recipient provides the 4-digit PIN from the client app. Rider enters it to confirm correct recipient. (Most secure.) |
| **Signature** | Recipient signs on rider's phone screen (digital signature capture). |
| **Photo** | Rider takes photo of package at door / with recipient. |
| **Left at door** | If client pre-authorized, rider takes photo of package at door. |

All proof uploaded via `POST /orders/:id/upload-photo` and stored in S3/R2.

### 3. Edge Cases at Dropoff

- **Recipient not available** → Rider waits (max wait time), then:
  - Contact client for instructions.
  - Leave at door (if authorized) + photo proof.
  - Return to sender (order marked accordingly; may incur return fee).
- **Wrong address** → Coordinate with client via chat.
- **Recipient refuses package** → Rider contacts client → order flagged, may return to sender.
- **Gate/security won't let rider in** → Call recipient/client.

---

## Phase 7: Order Completed

**Order status: `DELIVERED`**

An instant cascade of events fires on delivery confirmation.

### 1. Status Transition

- `AT_DROPOFF` → `DELIVERED`
- `OrderStatusHistory` final entry logged.
- **Optimistic concurrency** check prevents double-completion.

### 2. Financial Settlement (INSTANT)

- **Rider earnings calculated**: `totalPrice - platformCommission`
  - Commission rate depends on rider level: Level 1 = 15%, Level 7 = 8%.
- **Wallet credited immediately** — no waiting period.
- `Transaction` record created: `type = DELIVERY_EARNING`.
- Rider sees updated balance instantly in their wallet.
- If there was a **tip** → separate `Transaction` record: `type = TIP` (100% to rider).

### 3. Gamification Rewards

- **Base XP**: 50 XP per delivery.
- **Bonus XP** for:
  - On-time delivery (within ETA window).
  - High client rating.
  - Peak hours / bad weather deliveries.
  - Streak bonus (consecutive active days via `RiderStreak`).
  - Active `BonusXpEvent` campaigns (e.g., "Double XP Weekend").
- **Level check**: If XP crosses threshold → level up (Level 1–7).
  - Each level unlocks lower commission rates + badges.
- **Badge check**: e.g., "100 Deliveries", "Night Owl" (50 night deliveries), etc.
- **Challenge progress**: Update any active `ChallengeParticipant` records.
- **Streak update**: Increment `RiderStreak.currentStreak` if new day.

### 4. Rating & Feedback Flow

- **Client rates rider** (1–5 stars) via `POST /orders/:id/rate`.
- Optional **tip** (suggested amounts: GHS 2, 5, 10 or custom).
- Optional **text feedback**.
- Rating affects rider's average → impacts future dispatch ranking.
- If rating ≤ 2 → flag for review, prompt client for specific issue.
- **Rider rates client** (optional) — helps identify problematic clients.

### 5. Notifications Sent

| Recipient | Channel | Message |
|-----------|---------|---------|
| Client | Push + In-app + Email | "Your delivery is complete!" + receipt breakdown |
| Rider | Push + In-app | "Delivery confirmed! GHS XX.XX earned" |

### 6. Rider Status Reset

- `RiderProfile.status` → back to `ONLINE` (available for next order).
- Rider appears in dispatch pool again.

---

## Cancellation Paths

Cancellation can happen at multiple stages.

| When | Who | Cost | What Happens |
|------|-----|------|-------------|
| Before assignment (`PENDING` / `SEARCHING_RIDER`) | Client | **FREE** | Order voided, payment refunded. |
| After assignment (`ASSIGNED`) | Client | **GHS 3.00** | Rider gets cancellation compensation, rest refunded. |
| After pickup (`PICKED_UP`+) | Client | **GHS 5.00** | Rider compensated for time/distance traveled. |
| Any time | Rider | Affects acceptance rate | Order goes back to dispatch, re-matched. |
| Any time | Admin | Admin discretion | Full control over refund/compensation. |

**On every cancellation:**

- `OrderStatusHistory` records cancellation with reason.
- Payment refund initiated (minus cancellation fee if applicable).
- Rider freed up → status back to `ONLINE`.
- Both parties notified.

---

## Failure Paths

| Scenario | System Response |
|----------|----------------|
| **Payment fails** | Order doesn't proceed; client notified to retry. |
| **All riders decline** | Client notified; option to cancel or wait. |
| **Rider has accident / emergency** | SOS triggered; order reassigned to new rider; admin alerted. |
| **Package lost / damaged** | Client files claim; admin investigates; potential refund + rider penalty. |
| **Fraud detected** | Order frozen; both accounts flagged for review. |
| **App crash / connectivity loss** | Offline cache ensures no data loss; syncs on reconnect. |
| **Dispute** | Client or rider raises dispute → admin mediation workflow. |

---

## Behind-the-Scenes Infrastructure

| Layer | Role |
|-------|------|
| **Socket.IO** | Location streams, chat, presence heartbeats, job offers, status broadcasts. |
| **Redis** | Session cache, rider location cache, surge calculation, Socket.IO Pub/Sub (multi-instance). |
| **BullMQ** | Background jobs: payout batches, scheduled delivery triggers, notification queues, stale connection cleanup. |
| **PostgreSQL (Neon)** | All persistent data, order history, transactions, full audit trail. |
| **Mapbox** | Geocoding, routing, ETAs, distance calculations. |
| **Paystack** | Payment processing (cards, mobile money, USSD), rider payouts/transfers. |
| **Firebase FCM** | Push notifications to all 4 app frontends. |
| **S3 / R2** | Photo storage: POD photos, package photos, rider documents, signatures. |
| **Sentry** | Error tracking, performance monitoring. |
| **SendGrid** | Transactional email (receipts, verification). |
| **Twilio / mNotify** | SMS for OTP & critical alerts. |

### Presence & Heartbeat System

- Rider heartbeat every **25 seconds** (configurable based on connection quality).
- `socketId` stored in `RiderProfile` (links rider to active connection).
- `connectionQuality` field: `"excellent"` | `"good"` | `"poor"` | `"disconnected"`.
- Stale connection cleanup: auto-offline after **5 minutes** no signal.
- **Adaptive heartbeat**: less frequent pings in poor connectivity to save battery/data.

### Rate Limiting

- **60 events per socket per 10-second window** — prevents flooding.
- Per-IP and per-user API rate limiting on all endpoints.

### Multi-Instance Support

- **Redis Pub/Sub** with `@socket.io/redis-adapter` for horizontal scaling.
- In-memory adapter fallback for single-instance / local dev.

---

*This document describes the intended complete lifecycle. The system is designed specifically for the Ghana market: GHS currency, mobile money as primary payment, connectivity resilience for variable network conditions, and motorcycle-based delivery.*
