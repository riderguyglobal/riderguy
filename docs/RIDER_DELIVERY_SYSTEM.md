# Rider Delivery Process — System Configuration

> Generated: 2026-03-19
> Scope: Rider app (`apps/rider`), API dispatch/order/presence services, Socket.IO events

---

## Status Flow — State Machine

```
PENDING ─→ SEARCHING_RIDER ─→ ASSIGNED ─→ PICKUP_EN_ROUTE ─→ AT_PICKUP ─→ PICKED_UP ─→ IN_TRANSIT ─→ AT_DROPOFF ─→ DELIVERED
   │              │                │              │                │            │             │             │
   └→ CANCELLED   └→ CANCELLED     └→ CANCELLED   └→ CANCELLED     └→ FAILED    └→ FAILED     └→ FAILED     └→ FAILED
      _BY_CLIENT     _BY_CLIENT       _BY_CLIENT      _BY_RIDER       _BY_ADMIN    _BY_ADMIN     _BY_ADMIN     _BY_ADMIN
      _BY_ADMIN      _BY_ADMIN        _BY_RIDER       _BY_ADMIN
                                      _BY_ADMIN
```

### Valid Transitions

| From | Allowed Next States |
|------|---------------------|
| `PENDING` | `SEARCHING_RIDER`, `ASSIGNED`, `CANCELLED_BY_CLIENT`, `CANCELLED_BY_ADMIN` |
| `SEARCHING_RIDER` | `ASSIGNED`, `CANCELLED_BY_CLIENT`, `CANCELLED_BY_ADMIN` |
| `ASSIGNED` | `PICKUP_EN_ROUTE`, `CANCELLED_BY_CLIENT`, `CANCELLED_BY_RIDER`, `CANCELLED_BY_ADMIN` |
| `PICKUP_EN_ROUTE` | `AT_PICKUP`, `CANCELLED_BY_RIDER`, `CANCELLED_BY_ADMIN` |
| `AT_PICKUP` | `PICKED_UP`, `FAILED`, `CANCELLED_BY_RIDER`, `CANCELLED_BY_ADMIN` |
| `PICKED_UP` | `IN_TRANSIT`, `FAILED`, `CANCELLED_BY_ADMIN` |
| `IN_TRANSIT` | `AT_DROPOFF`, `FAILED`, `CANCELLED_BY_ADMIN` |
| `AT_DROPOFF` | `DELIVERED`, `FAILED`, `CANCELLED_BY_ADMIN` |
| `DELIVERED` | *(terminal)* |
| `FAILED` | *(terminal)* |
| `CANCELLED_BY_*` | *(terminal)* |

---

## Phase 1: Going Online

### Rider Availability Toggle

**Endpoint:** `PATCH /riders/availability`
**Body:** `{ availability: 'ONLINE' | 'OFFLINE', latitude?, longitude? }`

**Server gates:**
- Rider `onboardingStatus` must be `ACTIVATED` — otherwise returns `403`
- GPS is acquired client-side before the API call so the rider's lat/lng is never null when dispatch queries run

**What activates on ONLINE:**

| System | Location | Interval | Purpose |
|--------|----------|----------|---------|
| GPS `watchPosition` | Rider app | On position change | Continuous location tracking |
| REST heartbeat | Rider app → `POST /riders/location` | 30,000 ms | Fallback if socket drops |
| Socket heartbeat | Rider app → `rider:heartbeat` | Adaptive (5s–30s) | Keep presence alive |
| Wake Lock | Rider app (browser) | While ONLINE | Prevents device sleep |
| Audio Keep-Alive | Rider app (Web Audio) | Continuous 20 Hz, gain 0.001 | Prevents iOS/Android background freeze |
| Foreground Recovery | Rider app | On `visibilitychange` | Resync on tab return |
| Service Worker sync | Rider app → SW | On online/offline | Background heartbeat ticks |
| Presence entry | API (in-memory) | — | Created by `riderConnected()` |
| Stale rider sweep | API | 60,000 ms | Cleans dead sessions |
| DB sync | API | 60,000 ms | Flushes in-memory presence to Prisma |

### Adaptive Heartbeat Intervals (Client-Side)

| Connection Quality | Socket Interval | Background Interval |
|--------------------|-----------------|---------------------|
| `excellent` | 30,000 ms | 15,000 ms |
| `good` | 20,000 ms | 15,000 ms |
| `poor` | 10,000 ms | 15,000 ms |
| `disconnected` | 5,000 ms | 15,000 ms |

**Quality evaluated by:** latency (>2s = poor, >500ms = good), missed heartbeats (≥1 = poor, ≥3 = disconnected), network online status.

### Presence Manager Constants (Server-Side)

| Constant | Value | Purpose |
|----------|-------|---------|
| `SWEEP_INTERVAL_MS` | 60,000 ms (1 min) | How often stale-rider sweep runs |
| `STALE_THRESHOLD_MS` | 120,000 ms (2 min) | Connected but no heartbeat → mark `poor` |
| `OFFLINE_GRACE_PERIOD_MS` | 300,000 ms (5 min) | Disconnected → force OFFLINE |
| `DISPATCH_FRESHNESS_MS` | 600,000 ms (10 min) | Max GPS age for dispatch participation |
| `DB_SYNC_INTERVAL_MS` | 60,000 ms (1 min) | Flush presence to database |
| `HEARTBEAT_THROTTLE_MS` | 3,000 ms (3 s) | Min interval between accepted heartbeats |

### Stale Rider Sweep Logic

| Condition | Result |
|-----------|--------|
| Connected + no heartbeat > 2 min | `connectionQuality = 'poor'` |
| Disconnected > 5 min | `forceRiderOffline()` → availability = `OFFLINE` |
| Connected + no heartbeat > 5 min | `forceRiderOffline()` (dead socket) |

---

## Phase 2: Dispatch — Order Assignment

### Trigger

| Payment Method | When Dispatch Fires |
|----------------|---------------------|
| `CASH` | Immediately on `POST /orders` |
| `WALLET` | Immediately on `POST /orders` |
| `CARD` | After Paystack `charge.success` webhook |
| `MOBILE_MONEY` | After Paystack `charge.success` webhook |

### Auto-Dispatch Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `OFFER_TIMEOUT_MS` | 30,000 ms (30 s) | Time each rider has to respond |
| `SEARCH_RADIUS_TIERS_KM` | `[5, 8, 12]` | Progressive radius expansion |
| `MAX_SEARCH_RADIUS_KM` | 12 km | Outermost search boundary |
| `MAX_DISPATCH_ATTEMPTS` | 10 | Max riders to try before giving up |
| Same-zone bonus | +3 points | Added to overall score for riders in the same pricing zone |

### 6-Factor Scoring Algorithm

| Factor | Weight | Formula |
|--------|--------|---------|
| **Proximity** | 0.40 (40%) | ≤0.5km=100, ≤1km=95, ≤2km=85, ≤3km=75, ≤5km=60, ≤8km=30, >8km=excluded |
| **Rating** | 0.20 (20%) | `(avgRating / 5) × 100`, default 50 if null |
| **Completion Rate** | 0.15 (15%) | `completionRate × 100`, default 60 if null |
| **On-Time Rate** | 0.10 (10%) | `onTimeRate × 100`, default 60 if null |
| **Experience** | 0.10 (10%) | ≥500 trips=100, ≥200=85, ≥100=70, ≥50=55, ≥20=40, ≥5=25, <5=10 |
| **GPS Freshness** | 0.05 (5%) | <1min=100, <5min=85, <10min=60, <15min=30, >15min=5 |

**Overall Score** = Σ(factor × weight) + (sameZone ? 3 : 0)

### Dispatch Flow

```
1. Query ALL online + ACTIVATED riders with GPS (max 100)
2. Filter: GPS > 10 min old → excluded
3. Filter: distance > 12 km → excluded
4. Score each rider (6 factors + zone bonus)
5. Sort descending by score
6. Group into radius tiers: 5 km → 8 km → 12 km
7. Start with smallest tier that has candidates
8. Take top 10 from that tier
9. Order: PENDING → SEARCHING_RIDER
10. Send offer to rider #1
```

### Radius Expansion

When all candidates in the current tier decline or timeout:
1. Move to next tier (5→8 or 8→12)
2. Pull new candidates from `allScored` that fall within the new tier but not the old
3. Continue from top of new batch (up to MAX_DISPATCH_ATTEMPTS)
4. If all tiers exhausted: revert order to `PENDING` for manual job feed pickup

---

## Phase 3: Job Offer — The Rider's Popup

### Socket Event: `job:offer`

**Sent to:** `user:{riderId}` room (targeted to one rider at a time)

**Payload:**
```typescript
{
  orderId: string;
  orderNumber: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  estimatedDurationMinutes: number;
  packageType: string;
  totalPrice: number;
  riderEarnings: number;
  expiresAt: string; // ISO timestamp (now + 30s)
}
```

### Rider UI (IncomingRequest Component)

- **Countdown ring:** 30-second SVG circle, green → red at 10 s remaining
- **Earnings card:** `formatCurrency(riderEarnings)` in accent color
- **Route:** Pickup → Dropoff addresses with connected dots
- **Meta pills:** Distance (km), Duration (min), Package type
- **Buttons:** Accept (gradient-accent) / Decline (outline)

### Audio + Haptic Notifications

| Channel | Mechanism | Details |
|---------|-----------|---------|
| Sound (primary) | `new Audio('/sounds/incoming.mp3')` | MP3 file in `public/sounds/` |
| Sound (fallback) | Web Audio API tone | 3 ascending sine waves: 880→1100→1320 Hz |
| iOS unlock | AudioContext resume + silent buffer | Fires on first user touch/click |
| Vibration | `navigator.vibrate([200, 100, 200])` | Double-pulse pattern |

### Scroll Lock + Platform Traps

| Platform | Mechanism |
|----------|-----------|
| iOS | `document.body.style.position = 'fixed'` + scroll Y restore |
| Android | `history.pushState` back-trap → closes popup instead of navigating |

### Response: `job:offer:respond`

**Socket Event:** `{ orderId, response: 'accept' | 'decline' }`

**With ACK callback** — server returns `{ success: boolean; error?: string }`

**10s client-side timeout** — if server doesn't ACK, resolves with error.

### Accept Success Path

1. Server: `assignRider()` → order `ASSIGNED`, rider `ON_DELIVERY`
2. Server: emits `job:offer:taken` to other candidates
3. Client: invalidates `active-orders` + `rider-stats` cache
4. Client: `router.replace('/dashboard/jobs/{orderId}')`

### Accept Failure Path

- "This job was already taken by another rider" → error shown, auto-dismiss 3 s
- Server tries next candidate

### Decline Path

- Popup dismissed immediately
- Server advances to next ranked candidate

### Timeout Path (no response in 30s)

- Server emits `job:offer:expired` to rider
- Client `clearOffer()` auto-dismisses
- Server advances to next candidate

### Reconnect Recovery

If rider disconnects and reconnects while an offer is active:
- Socket `connection` event → `getPendingOfferForRider(userId)` checks active offers
- Re-emits `job:offer` with remaining countdown (adjusted for elapsed time)

---

## Phase 4: Active Delivery — Status Progression

### Rider Action Buttons

| Current Status | Button Label | Next Status | Geofence? |
|----------------|-------------|-------------|-----------|
| `ASSIGNED` | "Start Navigation" | `PICKUP_EN_ROUTE` | No |
| `PICKUP_EN_ROUTE` | "Arrived at Pickup" | `AT_PICKUP` | **Yes — 200 m of pickup** |
| `AT_PICKUP` | "Package Picked Up" | `PICKED_UP` | No |
| `PICKED_UP` | "Heading to Drop-off" | `IN_TRANSIT` | No |
| `IN_TRANSIT` | "Arrived at Drop-off" | `AT_DROPOFF` | **Yes — 200 m of dropoff** |
| `AT_DROPOFF` | "Complete Delivery" | — *(opens Proof of Delivery)* | No |

### Geofence Validation (Server-Side)

**Endpoint:** `PATCH /orders/:id/status`

```
GEOFENCE_RADIUS_KM = 0.2  (200 metres)

Geofenced statuses:
  AT_PICKUP  → must be within 200 m of (pickupLatitude, pickupLongitude)
  AT_DROPOFF → must be within 200 m of (dropoffLatitude, dropoffLongitude)

Calculation: haversineKm(riderLat, riderLng, targetLat, targetLng) > 0.2
  → 400 error: GEOFENCE_VIOLATION
```

### Status Transition Server Logic

**Concurrency guard:** `updateMany` with status condition to prevent race conditions

**Timestamps set per transition:**

| Status | Field Set |
|--------|-----------|
| `ASSIGNED` | `assignedAt = now()` |
| `PICKED_UP` | `pickedUpAt = now()` |
| `DELIVERED` | `deliveredAt = now()` |
| `CANCELLED_*` | `cancelledAt = now()` |

### GPS & Location During Delivery

| System | How | Interval | What It Does |
|--------|-----|----------|--------------|
| `watchPosition` (job page) | Local only | On change | Updates map marker position |
| `watchPosition` (availability hook) | Socket + REST | On change | Sends `rider:updateLocation` + `POST /riders/location` |
| REST heartbeat (availability hook) | REST | 30,000 ms | `POST /riders/location` fallback |
| Location throttle (server) | Socket handler | 3,000 ms min | Prevents DB flood |

**Note:** The job detail page does NOT emit location — the availability hook already handles it globally. This prevents duplicate DB writes.

### Location Breadcrumbs (Server-Side)

On each `rider:updateLocation` event:
1. Update `RiderProfile` (currentLatitude, currentLongitude, lastLocationUpdate)
2. Query all ACTIVE orders for this rider (ASSIGNED → AT_DROPOFF)
3. Create `LocationHistory` entry for each active order (non-blocking)
4. Broadcast `rider:location` to `order:{orderId}` rooms (client sees live GPS)

### Socket Events During Delivery

| Event | Direction | Purpose |
|-------|-----------|---------|
| `rider:updateLocation` | Rider → Server | GPS update (throttled 3 s) |
| `rider:heartbeat` | Rider → Server | Keep-alive ping with ACK |
| `rider:location` | Server → Client | Broadcasts GPS to tracking page |
| `order:subscribe` | Rider → Server | Join order room for updates |
| `order:unsubscribe` | Rider → Server | Leave order room |
| `order:status` | Server → All | Status change broadcast |
| `message:send` | Rider → Server | Chat message (≤ 2000 chars) |
| `message:new` | Server → Room | New message broadcast |
| `message:typing` | Rider → Server | Typing indicator (3 s timeout) |

---

## Phase 5: Navigation Map

### Map Configuration

| Setting | Value |
|---------|-------|
| Provider | Mapbox GL JS v3.19 |
| Light style | `mapbox://styles/mapbox/streets-v12` |
| Dark style | `mapbox://styles/mapbox/navigation-night-v1` |
| Default center | Accra: `[-0.187, 5.603]` |
| 3D buildings | Yes (auto-detected from style) |
| Fog | Yes (theme-aware) |
| Controls | Navigation, Geolocate, Scale |

### Route Rendering

| Layer | Width | Purpose |
|-------|-------|---------|
| Shadow | 1.3× standard | Depth effect |
| Border | Opacity 0.3 | Edge definition |
| Glow | Opacity 0.5 | Phase color accent |
| Main line | Opacity 1.0 | Primary route |
| Arrows | Chevrons every 90 px | Direction indicator |

### Phase-Aware Coloring

| Phase | Statuses | Route Color |
|-------|----------|-------------|
| **Pickup** | ASSIGNED, PICKUP_EN_ROUTE, AT_PICKUP | Blue |
| **Delivery** | PICKED_UP, IN_TRANSIT, AT_DROPOFF, DELIVERED | Green |

### Route Auto-Refresh

**Trigger:** Rider drifts > `ROUTE_REFRESH_DISTANCE_M` (100 m) from the position where the route was last drawn.

**Direction source:** `GET /orders/directions?coordinates=...&profile=driving-traffic`

**Congestion overlay:** Colors route segments by congestion level (low/moderate/heavy/severe) using Mapbox driving-traffic data.

### Markers

| Marker | Appearance | Extras |
|--------|------------|--------|
| Pickup | Blue pin with dot | Plus Code in popup |
| Dropoff | Green flag | Plus Code in popup |
| Stop (multi) | Numbered badge | Address or sequence |
| Rider | Blue dot + bike icon | Animated pulse ring + glow |

---

## Phase 6: Proof of Delivery

### Proof Types

| Type | Input | Validation | Upload |
|------|-------|------------|--------|
| `PHOTO` | Camera capture or gallery | JPEG/PNG/WebP, ≤ 10 MB | Multipart `POST /orders/:id/proof` |
| `SIGNATURE` | Canvas drawing (touch) | Auto-exported as PNG base64 | JSON `POST /orders/:id/proof` |
| `PIN_CODE` | Numeric input (4–6 digits) | `maxLength=6`, digits only | JSON `POST /orders/:id/proof` |

### Submit Flow

```
1. Rider selects proof type via segmented control
2. Captures/draws/enters proof
3. POST /orders/:id/proof  → stores proofOfDeliveryUrl + proofOfDeliveryType
4. PATCH /orders/:id/status { status: 'DELIVERED' }
5. Server handles delivery completion (see Phase 7)
```

### Multi-Stop Proof

For multi-stop orders, each stop can be completed individually:

**Endpoint:** `POST /orders/:id/stops/:stopId/complete`

- Same 3 proof types (PHOTO, SIGNATURE, PIN_CODE)
- Sets stop `status = COMPLETED`, `completedAt = now()`
- Stores stop-level proof
- Rider must be assigned + order `isMultiStop = true`

---

## Phase 7: Delivery Completion

### What Happens on `DELIVERED`

| Step | Action | Service |
|------|--------|---------|
| 1 | Calculate wait time charge | `calculateWaitTimeCharge()` — time at pickup + dropoff |
| 2 | Calculate pickup distance bonus | `calculatePickupDistanceBonus()` — rider travel to pickup |
| 3 | Increment rider `totalDeliveries` | Prisma update |
| 4 | Set rider back to `ONLINE` | Prisma update (was `ON_DELIVERY`) |
| 5 | Credit rider wallet | `creditWallet()` — base earnings + wait charge + pickup bonus |
| 6 | Apply level perk bonus | `getCommissionRate()` — higher levels get reduced commission |
| 7 | Update client `totalOrders` + `totalSpent` | Prisma update |
| 8 | Enqueue commission job | BullMQ `commissions` queue |
| 9 | Enqueue receipt job | BullMQ `receipts` queue |
| 10 | Award XP | `awardXp(DELIVERY_COMPLETE)` |
| 11 | Record streak activity | `recordStreakActivity()` |
| 12 | Emit `order:status` | Socket broadcast to order room |

### Rider Earnings Breakdown

```
Total Rider Payout = Base Earnings
                   + Wait Time Charge
                   + Pickup Distance Bonus
                   - Platform Commission (reduced by level perk)
```

### Completion UI

- Animated celebration screen with pulsing checkmark
- Earnings amount with pop animation
- "Added to your wallet" text
- "Back to Jobs" button

---

## Phase 8: Failure & Cancellation

### Rider Reports Failure

**Endpoint:** `POST /orders/:id/fail`
**Body:** `{ reason: string }` + optional failure photo (5 MB limit)

| Field | Value |
|-------|-------|
| Status | → `FAILED` |
| `failureReason` | Text from rider |
| `failurePhotoUrl` | Optional evidence photo |
| Rider availability | Set back to `ONLINE` |

### Client Cancellation Impact on Rider

| When Cancelled | Fee | Rider Compensation |
|----------------|-----|-------------------|
| `PENDING` or `SEARCHING_RIDER` | Free | None (no rider assigned) |
| `ASSIGNED` or `PICKUP_EN_ROUTE` | GHS 3.00 | GHS 3.00 credited to rider wallet |

Server calls `cancelDispatch()` to stop the auto-dispatch loop if one is active.

### Rider Cancellation

Allowed during: `ASSIGNED`, `PICKUP_EN_ROUTE`, `AT_PICKUP`
- Status → `CANCELLED_BY_RIDER`
- Rider set back to `ONLINE`

---

## In-Delivery Chat

### Configuration

| Setting | Value |
|---------|-------|
| Max message length | 2,000 chars (server-validated) |
| Typing timeout | 3,000 ms |
| Access control | Only order client + assigned rider |
| History endpoint | `GET /orders/:id/messages` (paginated) |

### Socket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `message:send` | Rider → Server | `{ orderId, content }` |
| `message:new` | Server → Room | `{ id, content, senderId, createdAt }` |
| `message:typing` | Rider → Server | `{ orderId }` |
| `message:typing` | Server → Room | `{ senderId, senderName }` |

### UI Features

- Floating chat button (bottom-right) with unread badge
- Full-screen overlay panel
- Auto-scroll to latest message
- Three-dot typing animation
- Body scroll lock + Android back trap
- Messages styled: outgoing (gradient brand) / incoming (glass card)

---

## Jobs Feed (Manual Pickup)

### When the Job Feed is Used

If auto-dispatch exhausts all candidates (all decline or timeout across all radius tiers), the order reverts to `PENDING`. It then appears in the rider's job feed for manual pickup.

### Available Jobs Endpoint

**`GET /orders/available`** (RIDER role)

Returns: `PENDING` / `SEARCHING_RIDER` orders that are:
- Unassigned (`riderId = null`)
- In the rider's current zone OR unzoned
- Sorted by creation time
- Limit: 50

### Manual Accept

**`POST /orders/:id/accept`** → calls `acceptJob()` → `assignRider()`

Same assignment logic as auto-dispatch accept, but rider-initiated.

### Real-Time Feed Updates

Socket event `job:new` fires when new orders are created → triggers feed refresh if rider is on the "Available" tab.

---

## Socket Rate Limiting & Security

| Setting | Value |
|---------|-------|
| Events per window | 60 |
| Window duration | 10,000 ms (10 s) |
| Max buffer size | 100 KB |
| Ping interval | 25,000 ms |
| Ping timeout | 20,000 ms |
| Connect timeout | 15,000 ms |
| Reconnect delay (base) | 1,000 ms |
| Reconnect delay (max) | 30,000 ms |
| Reconnect attempts | `Infinity` (never stops while ONLINE) |
| Jitter factor | 0.3 |
| Transports | WebSocket primary, HTTP polling fallback |
| Auth | JWT token in `auth.token`, verified on connect |

### iOS Background Recovery

- iOS kills WebSocket after ~30 s in background
- `visibilitychange` listener: on return to foreground → instant `socket.connect()`
- Reconnect delay reset to base (1 s) for immediate reconnect
- `useForegroundRecovery` invalidates all React Query caches after >5 s background

---

## Dashboard Status Display

### Status Badges (Rider UI)

| Status | Label | Color | Background |
|--------|-------|-------|------------|
| `PENDING` | Pending | `text-amber-400` | `bg-amber-400/10` |
| `SEARCHING_RIDER` | Finding Rider | `text-brand-400` | `bg-brand-400/10` |
| `ASSIGNED` | Assigned | `text-brand-400` | `bg-brand-400/10` |
| `PICKUP_EN_ROUTE` | En Route | `text-purple-400` | `bg-purple-400/10` |
| `AT_PICKUP` | At Pickup | `text-indigo-400` | `bg-indigo-400/10` |
| `PICKED_UP` | Picked Up | `text-brand-400` | `bg-brand-400/10` |
| `IN_TRANSIT` | Delivering | `text-brand-400` | `bg-brand-400/10` |
| `AT_DROPOFF` | At Dropoff | `text-violet-400` | `bg-violet-400/10` |
| `DELIVERED` | Delivered | `text-accent-400` | `bg-accent-400/10` |
| `CANCELLED_BY_*` | Cancelled | `text-danger-400` | `bg-danger-400/10` |
| `FAILED` | Failed | `text-danger-400` | `bg-danger-400/10` |

### Package Types

| Key | Label | Icon |
|-----|-------|------|
| `DOCUMENT` | Document | 📄 |
| `SMALL_PARCEL` | Small Parcel | 📦 |
| `MEDIUM_PARCEL` | Medium Box | 📦 |
| `LARGE_PARCEL` | Large Box | 🗃️ |
| `FRAGILE` | Fragile | ⚠️ |
| `FOOD` | Food | 🍔 |
| `HIGH_VALUE` | High Value | 💎 |
| `OTHER` | Other | 📋 |

### Connection Banners (Dashboard)

| Condition | Banner |
|-----------|--------|
| Socket reconnecting | ⏳ "Reconnecting to server (attempt #X)… Your session is safe." |
| Socket disconnected + ONLINE | 🔴 "Socket disconnected — you won't receive delivery requests" |
| Connection quality `poor` | 📶 "Weak connection — heartbeat increased to keep you online" |
| `navigator.onLine = false` | 📵 "No network — your session is saved. Will reconnect automatically." |
| GPS error | 🔴 GPS-specific message (permission denied / unavailable / timeout) |

---

## External Navigation

**Trigger:** Navigation button on job detail page

**URL:** `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`

**Destination logic:**
- Pickup phase (ASSIGNED, PICKUP_EN_ROUTE): pickup coordinates
- Delivery phase (all other active): dropoff coordinates

**PWA handling:** If running in standalone mode → `window.location.href` (stays in app shell). Otherwise → `window.open` with `noopener,noreferrer`.

---

## Stale Unpaid Order Cleanup

| Setting | Value |
|---------|-------|
| Stale threshold | 30 minutes |
| Check interval | 5 minutes (300,000 ms) |
| Applies to | `PENDING` + `paymentStatus: PENDING` + `paymentMethod NOT IN (CASH, WALLET)` |
| Action | Status → `CANCELLED_BY_ADMIN`, `failureReason`: "Payment timeout" |
| History entry | Created per cancelled order |
| Concurrency | `$transaction` per order, try/catch per iteration |
