# RiderGuy Mapping & Delivery System: Deep Audit

> Full-spectrum analysis of the mapping infrastructure, client-to-rider delivery flow, and every capability layer. April 2026.

---

## Table of Contents

1. [System Architecture Map](#1-system-architecture-map)
2. [Complete Delivery Flow: Step by Step](#2-complete-delivery-flow-step-by-step)
3. [Map Technology Stack](#3-map-technology-stack)
4. [Location Intelligence Layers](#4-location-intelligence-layers)
5. [Dispatch Engine](#5-dispatch-engine)
6. [Real-Time Tracking Pipeline](#6-real-time-tracking-pipeline)
7. [Pricing Engine (Map-Dependent)](#7-pricing-engine-map-dependent)
8. [What's Working Well](#8-whats-working-well)
9. [Critical Gaps & What Can Be Better](#9-critical-gaps--what-can-be-better)
10. [Feature Possibility Map](#10-feature-possibility-map)
11. [Recommendations Priority Matrix](#11-recommendations-priority-matrix)

---

## 1. System Architecture Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENT DEVICE (PWA)                              │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Location     │  │ Map Picker   │  │ Tracking Map │                  │
│  │ Input +      │  │ Modal        │  │ (Live)       │                  │
│  │ Autocomplete │  │ (Pin drop)   │  │              │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│         │                  │                  │                          │
│  ┌──────▼──────────────────▼──────────────────▼───────┐                │
│  │         Google Maps JS API (Singleton Loader)       │                │
│  │  • AdvancedMarkerElement (SVG markers)              │                │
│  │  • Polylines (multi-layer route rendering)          │                │
│  │  • Places Autocomplete (New API, session tokens)    │                │
│  │  • Geocoder (reverse geocoding)                     │                │
│  │  • TrafficLayer                                     │                │
│  │  • Dark mode via styles array                       │                │
│  └──────────────────────────┬─────────────────────────┘                │
│                              │                                          │
│  ┌──────────────────────────▼─────────────────────────┐                │
│  │            useDirections() / useSocket()             │                │
│  │  • Directions via API proxy (key hidden server-side) │                │
│  │  • Socket.IO rider:location events                   │                │
│  │  • Route refresh on rider movement >100m             │                │
│  └──────────────────────────┬─────────────────────────┘                │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API SERVER                                     │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Orders      │  │ Dispatch    │  │ Tracking     │  │ Pricing     │  │
│  │ Routes      │  │ Service     │  │ Service      │  │ Service     │  │
│  │             │  │             │  │              │  │             │  │
│  │ • /estimate │  │ • Auto      │  │ • GPS update │  │ • 15-factor │  │
│  │ • /create   │  │   dispatch  │  │ • ETA calc   │  │   formula   │  │
│  │ • /status   │  │ • Manual    │  │ • Breadcrumb │  │ • Surge     │  │
│  │ • /directions│ │   assign    │  │   buffering  │  │ • Zone-aware│  │
│  │ • /reverse- │  │ • Reassign  │  │ • Zone auto- │  │ • ETA       │  │
│  │   geocode   │  │ • 6-factor  │  │   detect     │  │   learning  │  │
│  │ • /plus-code│  │   scoring   │  │              │  │             │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  │
│         │                │                 │                  │         │
│  ┌──────▼────────────────▼─────────────────▼──────────────────▼──────┐  │
│  │                    Socket.IO Server                               │  │
│  │  • JWT auth middleware                                            │  │
│  │  • Rate limiter (60 events/10s)                                   │  │
│  │  • rider:updateLocation (3s throttle, zone detect, breadcrumbs)   │  │
│  │  • job:offer / job:offer:respond (30s acceptance window)          │  │
│  │  • order:subscribe / order:status                                 │  │
│  │  • Redis adapter for multi-instance                               │  │
│  └──────────────────────────┬────────────────────────────────────────┘  │
│                              │                                          │
│  ┌───────────┐  ┌───────────▼───┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Zone      │  │ Presence      │  │ ETA Learning │  │ Natural     │  │
│  │ Service   │  │ Service       │  │ Service      │  │ Location    │  │
│  │           │  │               │  │              │  │ Parser      │  │
│  │ • CRUD    │  │ • In-memory + │  │ • ML correct │  │             │  │
│  │ • Point-  │  │   Redis       │  │   factors    │  │ • "near     │  │
│  │   in-poly │  │ • Heartbeat   │  │ • Zone/hour/ │  │   Melcom"   │  │
│  │ • Surge   │  │ • Stale sweep │  │   day dims   │  │ • Relative  │  │
│  │   calc    │  │ • 5min grace  │  │ • Confidence │  │   positions │  │
│  └───────────┘  └───────────────┘  │   weighting  │  │ • Landmarks │  │
│                                     └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌──────────────┐ ┌──────────┐  ┌──────────────┐
      │  PostgreSQL  │ │  Redis   │  │ Google APIs  │
      │              │ │          │  │              │
      │ • Orders     │ │ • Dispatch│  │ • Routes API │
      │ • Zones      │ │   state  │  │ • Places API │
      │ • Location   │ │ • Presence│  │ • Geocoding  │
      │   History    │ │ • Socket │  │ • Maps JS    │
      │ • ETA factors│ │   adapter│  │              │
      └──────────────┘ └──────────┘  └──────────────┘
```

---

## 2. Complete Delivery Flow: Step by Step

Every single thing that happens from the moment a client opens the app to the moment a rider gets paid.

### Phase 0: Pre-Booking (Location Discovery)

| Step | What Happens | Tech Layer |
|------|-------------|------------|
| 0.1 | Client opens Send page | Next.js route `/dashboard/send` |
| 0.2 | GPS auto-detect for pickup | `navigator.geolocation.getCurrentPosition()` with high accuracy fallback |
| 0.3 | Reverse geocode GPS coords to address | Google Geocoder via `reverseGeocodeWithGoogle()`, picks best result type (street > route > neighborhood) |
| 0.4 | Plus Code generated for GPS position | `encodePlusCode()` from Open Location Code library, shortened against 10 Ghana city reference points |
| 0.5 | Client types dropoff address | `useAutocomplete` hook: parallel search of Google Places (New API, session tokens) + 42K Ghana gazetteer backend |
| 0.6 | OR: Client pastes Google Maps link | `parseGoogleMapsUrl()` with 6 parsing strategies, short link resolution via API, coordinate extraction |
| 0.7 | OR: Client uses Map Picker | Full-screen Google Map, center-pin, debounced reverse geocode on pan (300ms), GPS button, Plus Code display |
| 0.8 | OR: Client picks saved address | `SavedAddress` model, stored coordinates + Plus Code |
| 0.9 | Optional multi-stop: up to 3 extra stops | Each stop: same location input flow, stored as `additionalStops` array |

### Phase 1: Price Estimation

| Step | What Happens | Tech Layer |
|------|-------------|------------|
| 1.1 | Distance check: pickup <-> dropoff | Client-side `haversineKm()`, rejects if >50km |
| 1.2 | Auto-estimate triggers (debounced) | When both pickup + dropoff have coordinates |
| 1.3 | Route preview map renders | `RoutePreviewMap` component: Google Map with pickup/dropoff markers, multi-layer route polylines (shadow/border/glow/line), alternative route (dashed), traffic overlay, congestion coloring |
| 1.4 | Directions fetched | `useDirections` -> `GET /orders/directions` -> server-side Google Routes API proxy (`TRAFFIC_AWARE_OPTIMAL` mode). API key never exposed to client |
| 1.5 | Price calculated server-side | `POST /orders/estimate` -> `PricingService.calculateEstimate()` |
| 1.6 | **15 pricing factors applied** | Base fare + distance charge + package multiplier + weight surcharge + multi-stop fee + time-of-day multiplier + surge multiplier + weather multiplier + cross-zone premium + express multiplier + schedule discount + business discount + promo code + service fee + commission |
| 1.7 | Zone detection for pricing | `isPointInPolygon()` ray-casting against all active zone GeoJSON polygons |
| 1.8 | Surge calculation | Dynamic: `pendingOrders / (activeRiders + 1)`, clamped 1.0-1.8, zone-specific override available |
| 1.9 | ETA calculation | Google Routes API duration, corrected by `EtaLearningService` factors per zone/hour/day/week, fallback: `haversine / 25kmh` |
| 1.10 | Price breakdown shown to client | Component: `PriceBreakdown`, shows base, distance, surcharges, discounts, total, rider earnings transparency |

### Phase 2: Order Creation

| Step | What Happens | Tech Layer |
|------|-------------|------------|
| 2.1 | Client selects package type | 7 types: DOCUMENT, SMALL_PARCEL, MEDIUM, LARGE, FOOD, FRAGILE, HIGH_VALUE (each has multiplier 1.0-1.5) |
| 2.2 | Client selects payment method | CARD, MOBILE_MONEY, WALLET, CASH |
| 2.3 | Client adds optional details | Contact name/phone for pickup + dropoff, package description, package photos (up to 3, max 10MB image / 25MB video), weight |
| 2.4 | Client applies promo code | Validated server-side: expiry, per-user limit, total limit, zone restriction, package restriction |
| 2.5 | Client can schedule delivery | NOW, SAME_DAY (time picker), NEXT_DAY (time picker), RECURRING (future phases) |
| 2.6 | Express toggle | 1.5x multiplier for distances <15km |
| 2.7 | Confirm and submit | `POST /orders` with full payload |
| 2.8 | Payment processing | For non-cash: Paystack initialize -> payment modal -> webhook confirms `paymentStatus: COMPLETED` |
| 2.9 | Order status: `PENDING` | Status history record created, timestamp logged |

### Phase 3: Auto-Dispatch (The Brain)

| Step | What Happens | Tech Layer |
|------|-------------|------------|
| 3.1 | `autoDispatch(orderId)` fires | Triggered after order creation + payment verification |
| 3.2 | Status: `SEARCHING_RIDER` | Status history: "Auto-dispatch started, searching for nearest rider" |
| 3.3 | Query all eligible riders | Prisma: `ONLINE` + `ACTIVATED` + GPS not null + not suspended + GPS <10min old |
| 3.4 | Progressive radius search | Tier 1: 5km, Tier 2: 8km, Tier 3: 12km. Starts narrow, expands if needed |
| 3.5 | **6-factor scoring algorithm** | For each rider within radius: |
| | a. Proximity (40% weight) | 0-100 score: ≤0.5km=100, ≤1km=95, ≤2km=85, ≤3km=75, ≤5km=60, ≤8km=30, >8km=0 |
| | b. Rating (20% weight) | `(averageRating / 5) * 100`, default 50 for new riders |
| | c. Completion rate (15% weight) | `completionRate * 100`, default 60 for new riders |
| | d. On-time rate (10% weight) | `onTimeRate * 100`, default 60 for new riders |
| | e. Experience (10% weight) | 500+ deliveries=100, 200+=85, 100+=70, 50+=55, 20+=40, 5+=25, <5=10 |
| | f. GPS freshness (5% weight) | <1min=100, <5min=85, <10min=60, <15min=30, >15min=5 |
| | g. Zone bonus | +3 points if rider is in the same zone as pickup |
| 3.6 | Sort riders by score (descending) | Highest-scoring rider gets first offer |
| 3.7 | Emit `job:offer` to top rider | Socket.IO targeted event with: order details, distance to pickup, earnings, pickup/dropoff addresses, package type |
| 3.8 | 30-second acceptance window | Timer starts, rider sees offer notification |
| 3.9 | If rider accepts | `job:offer:respond` with `accepted: true` -> `assignRider()` atomic transaction |
| 3.10 | If rider declines or timeout | Record in Redis declined set (1hr TTL), move to next-ranked rider |
| 3.11 | Repeat up to 10 attempts | If all 10 decline -> order stays `PENDING` for manual pickup or retry |
| 3.12 | `order:no-riders` event | Emitted to client if all riders exhausted |
| 3.13 | Redis persistence | Dispatch state persisted to Redis (5min TTL) for crash recovery |
| 3.14 | Reconnect re-emit | If rider disconnects/reconnects during active offer, pending offer re-emitted |

### Phase 4: Assignment & Pickup Navigation

| Step | What Happens | Tech Layer |
|------|-------------|------------|
| 4.1 | Rider accepts -> `ASSIGNED` | Atomic transaction: rider status `ONLINE` -> `ON_DELIVERY`, order status -> `ASSIGNED` |
| 4.2 | Client sees rider on map | `TrackingMap`: rider marker appears (blue bike SVG with CSS pulse animation) |
| 4.3 | Route drawn: rider -> pickup | Blue polyline (multi-layer: shadow 14px, border 10px, glow 7px, line 4.5px) with congestion coloring |
| 4.4 | Rider navigates to pickup | Status: `PICKUP_EN_ROUTE` |
| 4.5 | **Live GPS tracking begins** | Rider's `watchPosition` -> emits `rider:updateLocation` via Socket.IO every 3s (throttled) |
| 4.6 | Client sees real-time movement | `rider:location` event -> smooth marker transition on map |
| 4.7 | Route auto-refreshes | When rider moves >100m from last route origin (haversine check), new directions fetched |
| 4.8 | Breadcrumb recording | Socket handler buffers GPS points, batch-flushes to `LocationHistory` table every 30s |
| 4.9 | Zone auto-detection | On location update (60s throttle): `isPointInPolygon()` against all zones, updates `currentZoneId` |
| 4.10 | REST heartbeat fallback | Every 30s, rider app sends `POST /riders/location` as backup if socket drops |
| 4.11 | Rider arrives at pickup | Status: `AT_PICKUP` |

### Phase 5: Package Pickup

| Step | What Happens | Tech Layer |
|------|-------------|------------|
| 5.1 | Rider confirms package | Status: `PICKED_UP` |
| 5.2 | Route color switches | Blue (approaching) -> Green (delivering) |
| 5.3 | Route redrawn: rider -> dropoff | Green polyline with congestion overlay |
| 5.4 | Status: `IN_TRANSIT` | Real-time tracking continues |

### Phase 6: Delivery Navigation & Multi-Stop

| Step | What Happens | Tech Layer |
|------|-------------|------------|
| 6.1 | Rider navigates to dropoff | Continuous GPS tracking, route refresh, traffic overlay |
| 6.2 | For multi-stop orders | Each stop: `OrderStop` with sequence number, contact info, proof tracking |
| 6.3 | Complete individual stops | `POST /orders/:id/complete-stop` with proof for each stop |
| 6.4 | Geofence validation | Stop coordinates used for geofence check (resolves current active stop) |
| 6.5 | Rider arrives at final dropoff | Status: `AT_DROPOFF` |

### Phase 7: Proof of Delivery

| Step | What Happens | Tech Layer |
|------|-------------|------------|
| 7.1 | Rider initiates proof | 4 proof types: PHOTO, PIN, LEFT_AT_DOOR |
| 7.2 | Photo proof | Camera capture + upload via `POST /orders/:id/upload-photo` (multipart) |
| 7.3 | PIN proof | Client provides PIN, rider enters it |
| 7.4 | Left at door | Photo + note |
| 7.5 | Status: `DELIVERED` | Timestamps recorded, audit trail complete |

### Phase 8: Post-Delivery

| Step | What Happens | Tech Layer |
|------|-------------|------------|
| 8.1 | Rider earnings credited instantly | `riderEarnings` -> Wallet balance + Transaction record (`DELIVERY_EARNING`) |
| 8.2 | XP awarded | `XpEvent` created: delivery XP, streak bonus, zone bonus |
| 8.3 | Badge check | System checks if delivery earned any badges |
| 8.4 | Challenge progress | Active challenge participants updated |
| 8.5 | Client rates rider | 1-5 stars via `PATCH /orders/:id/rating` |
| 8.6 | Client tips rider | Optional tip -> Wallet + Transaction (`TIP`) |
| 8.7 | Rider goes back to `ONLINE` | Status: `ON_DELIVERY` -> `ONLINE`, available for new orders |
| 8.8 | Rider withdraws earnings | Any time -> `POST /wallets/:userId/withdraw` -> Paystack transfer to bank/mobile money |

---

## 3. Map Technology Stack

### Current Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Map Renderer | Google Maps JavaScript API | Active |
| API Loader | `@googlemaps/js-api-loader` (singleton) | Active |
| Markers | `AdvancedMarkerElement` with custom SVG | Active |
| Route Lines | `google.maps.Polyline` (4-layer stack) | Active |
| Directions | Google Routes API v2 (`computeRoutes`) | Active |
| Traffic | `google.maps.TrafficLayer` + congestion from Routes API | Active |
| Places Search | Google Places API (New) with `AutocompleteSuggestion` | Active |
| Geocoding | Google Geocoding API (forward + reverse) | Active |
| Dark Mode | `google.maps.MapTypeStyle[]` custom styles | Active |
| Ghana Addressing | Plus Codes / Open Location Code | Active |
| Gazetteer | 42K+ Ghana location database on backend | Active |
| Natural Language | Ghana-specific landmark parser ("near Melcom", "opposite Total") | Active |

### Route Rendering Architecture

The route drawing is **production-grade multi-layer rendering**:

```
Layer 4 (top):    Main line ──────────  4.5px  (route color)
Layer 3:          Glow      ━━━━━━━━━━   7px   (semi-transparent white)
Layer 2:          Border    ═══════════  10px   (darker shade)
Layer 1 (bottom): Shadow    ▓▓▓▓▓▓▓▓▓▓  14px   (rgba black, 15% opacity)
                  + Direction arrows (symbol overlay)
                  + Congestion overlay (color-coded segments)
```

Congestion colors: green (low) -> amber (moderate) -> orange (heavy) -> red (severe).

---

## 4. Location Intelligence Layers

### Layer 1: GPS Acquisition

```
HIGH_ACCURACY (default for delivery)
├── enableHighAccuracy: true
├── timeout: 15000ms
├── maximumAge: 5000ms
└── Fallback: LOW_ACCURACY on timeout
    ├── enableHighAccuracy: false
    ├── timeout: 30000ms
    └── maximumAge: 30000ms
```

- Rider app: acquires GPS BEFORE going online (never null coordinates for dispatch)
- iOS wake-up handler: restarts `watchPosition` on `visibilitychange`
- Connection quality tracked per rider

### Layer 2: Reverse Geocoding Pipeline

```
User taps location or GPS
    │
    ▼
Google Geocoder ──► Priority: street_address > route > neighborhood
    │
    ▼
Plus Code encoding ──► Full code + short code + nearest city
    │
    ▼
Natural Language Parser (backend)
    │
    ├── Extracts: "near", "behind", "opposite", "next to"
    ├── Features: traffic light, junction, roundabout, bridge
    └── Landmarks: 50+ Ghana brands (Total, Shell, MTN, Melcom, KFC, Accra Mall...)
```

### Layer 3: Address Search (Multi-Source)

```
User types address
    │
    ├──► Google Places (New API)
    │    ├── Session tokens (billing optimization)
    │    ├── Country bias: Ghana
    │    └── Location bias: user's current position
    │
    └──► Backend Gazetteer (parallel)
         ├── 42,000+ Ghana locations
         └── Fuzzy matching
    │
    ▼
Merged + deduplicated results
    │
    ▼
User selects ──► Place Details fetch ──► Plus Code computed
                                         │
                                         ▼
                                    Selection recorded (usage-based learning)
```

### Layer 4: Google Maps Link Parsing

6 extraction strategies for when users paste Google Maps URLs:

1. `?q=lat,lng` query parameter
2. `@lat,lng,zoom` URL path pattern
3. `/place/lat,lng` place pattern
4. `ll=lat,lng` parameter
5. `sll=lat,lng` parameter
6. `data=` encoded data string

Plus: raw "5.603, -0.187" coordinate string parsing, short link resolution (`goo.gl/maps`, `maps.app.goo.gl`).

### Layer 5: Zone Intelligence

- Zones defined as GeoJSON polygons with center coordinates
- Each zone carries: `baseFare`, `perKmRate`, `minimumFare`, `surgeMultiplier`, `commissionRate`, `roadFactor`, `avgSpeedKmh`
- Point-in-polygon via ray-casting algorithm (`isPointInPolygon`)
- Auto-detection: rider's zone updated on GPS emit (throttled 60s)
- Cross-zone detection: orders spanning two zones get 1.2x premium
- Surge per zone: calculated from ratio of pending orders to active riders

---

## 5. Dispatch Engine

### Auto-Dispatch Flow Diagram

```
Order Created (PENDING)
        │
        ▼
  ┌─────────────────┐
  │ SEARCHING_RIDER  │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────────┐
  │  Query: ONLINE + ACTIVATED + GPS fresh  │
  │  Filter: not suspended, GPS < 10min     │
  │  Limit: 100 riders max                  │
  └────────────────┬────────────────────────┘
                   │
                   ▼
  ┌─────────────────────────────────────────┐
  │  TIER 1: Riders within 5km              │
  │  Score all with 6-factor algorithm      │
  │  Sort by score descending               │
  │                                         │
  │  If no riders / all declined:           │
  │  TIER 2: Expand to 8km                  │
  │                                         │
  │  If no riders / all declined:           │
  │  TIER 3: Expand to 12km                 │
  └────────────────┬────────────────────────┘
                   │
                   ▼
  ┌─────────────────────────────────────────┐
  │  Sequential Offers (max 10 total)       │
  │                                         │
  │  For each ranked rider:                 │
  │  ├── Emit job:offer via Socket.IO       │
  │  ├── Start 30s timer                    │
  │  ├── If ACCEPT → assignRider()          │
  │  ├── If DECLINE → record + next rider   │
  │  └── If TIMEOUT → record + next rider   │
  └────────────────┬────────────────────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
   ┌──────────┐    ┌──────────────┐
   │ ASSIGNED │    │ No riders    │
   │          │    │ found, stays │
   │ Success  │    │ PENDING      │
   └──────────┘    └──────────────┘
```

### Scoring Breakdown

| Factor | Weight | Scale | Meaning |
|--------|--------|-------|---------|
| Proximity | 40% | 0-100 | Distance to pickup: ≤500m is perfect, >8km is zero |
| Rating | 20% | 0-100 | Average star rating normalized to 100 |
| Completion | 15% | 0-100 | Percentage of orders completed (not cancelled) |
| On-Time | 10% | 0-100 | Percentage of deliveries within ETA |
| Experience | 10% | 10-100 | Total lifetime deliveries |
| GPS Freshness | 5% | 5-100 | How recent their last GPS ping was |
| Zone Bonus | +3 flat | -- | Same zone as pickup location |

### Manual Dispatch (Admin)

- `POST /dispatch/manual` for admin/dispatcher override
- `GET /dispatch/riders` shows available riders sorted by rating
- Atomic transaction: claims rider + claims order simultaneously
- Reassign capability for stuck/problem orders

---

## 6. Real-Time Tracking Pipeline

```
RIDER DEVICE                    SERVER                         CLIENT DEVICE
─────────────                   ──────                         ─────────────

watchPosition()                                                
  │ (every 5s)                                                 
  ▼                                                            
rider:updateLocation ──►  Socket handler                       
  [lat, lng, heading,      │                                   
   speed, accuracy,        ├── Validate coordinates            
   timestamp]              │   (lat -90..90, lng -180..180)    
                           │                                   
                           ├── 3s throttle gate ──► DROP if    
                           │   (too frequent)       too fast   
                           │                                   
                           ├── Update riderProfile             
                           │   (lat, lng, lastLocationUpdate)  
                           │                                   
                           ├── Zone auto-detect (60s throttle) 
                           │   isPointInPolygon() all zones    
                           │                                   
                           ├── Buffer breadcrumb ──► Batch     
                           │   (LocationHistory)     flush 30s 
                           │                                   
                           ├── Broadcast to order rooms        
                           │                                   
                           └──► rider:location ──────────────► Client receives
                                                                │
                                                                ├── Smooth marker
                                                                │   transition (CSS)
                                                                │
                                                                ├── Check haversine
                                                                │   > 100m from
                                                                │   last route?
                                                                │
                                                                └── If yes: refetch
                                                                    directions &
                                                                    redraw route


REST FALLBACK (every 30s):
POST /riders/location ──► Same DB update + breadcrumb + zone detect
                          (No socket broadcast, client polls /nearby)
```

### Presence System

```
Rider connects via Socket.IO
    │
    ├── In-memory Map: riderPresence[userId] = { socketId, lastSeen }
    ├── Redis hash: presence:riders → { [userId]: JSON }
    │
    ▼
Heartbeat every 25s (rider → server)
    │
    ├── Updates lastSeen timestamp
    └── Connection quality tracking
    
Stale sweep (server, every 60s)
    │
    ├── STALE threshold: 2 minutes no heartbeat
    ├── OFFLINE_GRACE: 5 minutes → auto-set OFFLINE
    └── DISPATCH_FRESHNESS: 10 minutes → excluded from auto-dispatch

DB sync (every 60s)
    │
    └── Batch update riderProfile.availability for stale riders
```

---

## 7. Pricing Engine (Map-Dependent)

The pricing engine depends on map data at multiple points:

```
                    ┌──────────────────┐
                    │ Pickup Location  │
                    │ (lat, lng)       │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌──────────────┐
     │ Zone       │  │ Distance   │  │ Cross-Zone   │
     │ Detection  │  │ Calculation│  │ Detection    │
     │            │  │            │  │              │
     │ baseFare   │  │ Haversine  │  │ Different    │
     │ perKmRate  │  │ × roadFactor│ │ zones =      │
     │ minFare    │  │ (1.15-1.4) │  │ 1.2x premium │
     │ surgeMulti │  │            │  │              │
     │ commission │  │ OR Google  │  │              │
     └─────┬──────┘  │ Routes km  │  └──────┬───────┘
           │         └─────┬──────┘         │
           │               │                │
           ▼               ▼                ▼
     ┌─────────────────────────────────────────┐
     │             PRICING FORMULA              │
     │                                          │
     │ subtotal = (baseFare + distCharge +      │
     │   stops + weight) × package × surge ×    │
     │   timeOfDay × weather × crossZone ×      │
     │   express × scheduleDisc                 │
     │                                          │
     │ subtotal = MAX(subtotal, minimumFare)     │
     │ subtotal *= (1 - businessDisc)            │
     │ subtotal -= promoDisc                     │
     │ serviceFee = subtotal × feeRate           │
     │ total = subtotal + serviceFee             │
     │ commission = total × commRate             │
     │ riderEarnings = total - commission        │
     └──────────────────────────┬───────────────┘
                                │
                                ▼
     ┌──────────────────────────────────────────┐
     │            ETA LEARNING SERVICE           │
     │                                           │
     │ corrected_eta = raw_eta × factor          │
     │                                           │
     │ Factors learned per:                      │
     │ • Zone (Accra ≠ Tamale)                   │
     │ • Hour (rush hour corrections)            │
     │ • Day (weekday vs weekend)                │
     │                                           │
     │ Exponential moving average updates        │
     │ Confidence-weighted blending              │
     │ Hierarchical fallback: specific → global  │
     └──────────────────────────────────────────┘
```

---

## 8. What's Working Well

### Strengths

1. **Multi-layer route rendering** is professional-grade. The 4-layer polyline stack (shadow/border/glow/line) with congestion overlay matches what Uber/Bolt display.

2. **API key security**: Google API keys are never exposed to the client. Directions go through a server-side proxy at `GET /orders/directions`, which calls Google Routes API and transforms the response.

3. **Ghana-specific addressing**: Plus Codes with 10-city reference points, natural language landmark parser, 42K gazetteer database. This matters enormously in a market where street addresses are unreliable.

4. **6-factor dispatch scoring** is sophisticated and well-tuned. Progressive radius expansion prevents over-reaching while ensuring coverage.

5. **ETA learning service** is genuinely ML-grade: per-zone/hour/day correction factors with exponential moving averages and confidence weighting. Most competitors use static formulas.

6. **Offline resilience**: REST heartbeat fallback for GPS when socket drops, Socket.IO offline queue (sessionStorage-backed), iOS wake-up handler for background tab recovery.

7. **Socket rate limiting**: 60 events/10s per connection, 3s GPS throttle, prevents abuse and server overload.

8. **Breadcrumb buffering**: GPS points batched in memory and flushed to `LocationHistory` every 30s, preventing DB write storms.

9. **Phase-aware coloring**: Route turns blue (pickup approach) -> green (delivering to dropoff), giving users clear visual status without reading text.

10. **Crash recovery**: Dispatch state persisted to Redis with 5min TTL, reconnecting riders get pending offers re-emitted.

---

## 9. Critical Gaps & What Can Be Better

### GAP-01: No Admin Map Dashboard (CRITICAL)

**Current**: There is no admin map component. Zero files found in `apps/admin/src` related to maps.

**Impact**: Dispatchers have no visual overview of rider positions, active orders, zone boundaries, or demand hotspots. They're operating blind.

**Should Have**:
- Live map showing all online riders with status dots (green=available, blue=on-delivery, gray=offline)
- Active order pins showing current status
- Zone boundary overlays with real-time surge indicators
- Heatmap of demand density
- Click-to-assign: select order, see nearby riders, assign directly from map
- Dispatch queue sidebar integrated with map

### GAP-02: No Turn-by-Turn Navigation (HIGH)

**Current**: Rider sees a route drawn on the map but gets no turn-by-turn directions. They see the line and figure it out.

**Impact**: Riders must switch to Google Maps for actual navigation, losing context of the RiderGuy delivery flow.

**Options**:
- a. **Deep link to Google Maps** with pickup/dropoff as destination (simple, effective)
- b. **In-app step-by-step directions list** from Google Routes API `steps[]` (medium effort)
- c. **Full turn-by-turn with voice** using Web Speech API + directions steps (significant effort)

### GAP-03: No Geofence Arrival Detection (HIGH)

**Current**: Rider manually taps "I've arrived" to advance status. There's no automatic detection when they enter a radius around pickup/dropoff.

**Impact**: Missed status transitions, delayed notifications to clients, inaccurate ETA calculations.

**Should Have**:
- Define radius (e.g., 100m) around pickup/dropoff coordinates
- Continuously check `haversineDistance(riderPos, targetPos)` on each GPS update
- Auto-suggest "Mark as arrived?" when within radius
- Optional auto-transition with confirmation toast

### GAP-04: ~~No Nearby Riders on Send Page~~ FIXED (MEDIUM)

**Status**: COMPLETED

**What was done**:
- Created `use-nearby-riders.ts` hook that polls `GET /riders/nearby` every 15s with AbortController cleanup
- Updated `RoutePreviewMap` to accept `nearbyRiders` prop and render small rider markers
- Added rider count indicator on Send page: "X riders nearby" (green) or "No riders nearby" warning (amber)
- Markers auto-update as riders move

### GAP-05: Duplicate Code Across Client/Rider Apps (MEDIUM)

**Current**: `map-core.ts`, `map-markers.ts`, `map-route.ts` exist separately in both `apps/client/src/lib/` and `apps/rider/src/lib/` with only minor differences (mapId, line widths, XSS escaping in rider).

**Impact**: Bug fixes must be applied twice, divergence risk, maintenance burden.

**Should Fix**: Extract shared map library into `packages/map/` with app-specific config passed in. Keep the 1.3x wider lines for rider as a config option.

### GAP-06: ~~Duplicate Haversine Implementation~~ FIXED (LOW)

**Status**: COMPLETED

**What was done**:
- Replaced inline haversine in `send/page.tsx` with `haversineDistance` from `@riderguy/utils`
- Client-side `haversineKm()` wrapper adapts `[lng, lat]` tuple format to shared function's `(lat, lon, lat, lon)` signature
- Backend inline copy in `tracking.service.ts` remains (separate fix for API phase)

### GAP-07: No Route ETA Countdown on Tracking Map (MEDIUM)

**Current**: Client sees the rider moving but no live countdown timer ("Arriving in ~X min").

**Impact**: Clients repeatedly check the app, no predictable expectation setting.

**Should Have**:
- Live ETA badge on tracking map, updated each time route refreshes
- "Rider is X min away" in bold
- ETA adjusted by `EtaLearningService` correction factors
- Push notification at T-5min and T-1min

### GAP-08: No Route History / Breadcrumb Replay (LOW)

**Current**: `LocationHistory` breadcrumbs are stored but never surfaced to anyone.

**Could Have**:
- Admin: replay rider's actual path vs expected route (for disputes, fraud detection)
- Rider: "Your delivery path" summary after completion
- Client: see the route the rider took (transparency)

### GAP-09: No Offline Map Tiles (LOW, Future)

**Current**: Maps require internet. If the rider enters a dead zone, the map goes blank.

**Options**: Google Maps JS API doesn't support offline tiles natively. Would require:
- Pre-cached tile sets for key zones (complex)
- Fallback to last-known map state with overlay message
- Store route geometry locally and render on blank canvas

### GAP-10: No Smart Route Optimization for Multi-Stop (MEDIUM)

**Current**: Multi-stop orders use the sequence the client entered. No optimization.

**Should Have**: When a client adds 3+ stops, offer "Optimize route order" that uses the Google Routes API Waypoint Optimization to find the shortest path through all stops.

### GAP-11: No Demand Heatmap / Rider Guidance (MEDIUM)

**Current**: Online riders have no visibility into where demand is concentrated. They guess.

**Should Have**:
- Demand hotspots on rider dashboard map (colored zones based on pending order density)
- "Move toward [zone name] for more orders" push notification
- Surge zone indicators ("1.5x earnings in Osu right now")

### GAP-12: ~~No Address Favorites on Map~~ FIXED (LOW)

**Status**: COMPLETED

**What was done**:
- Created `createSavedAddressMarker()` in `map-markers.ts`: white pill with green star icon, label text, info popup
- `MapPickerModal` fetches saved addresses via `GET /saved-addresses` when opened
- Saved address pins rendered on map with click-to-fly (panTo + zoom 17, triggers reverse geocode)
- Proper cleanup on modal close
- Also enhanced map picker search to include Ghana gazetteer (42K locations) alongside Google Places

### GAP-13: No Delivery Photo Gallery in Tracking (LOW)

**Current**: Package photos uploaded during proof of delivery are stored but the tracking page doesn't show them to the client in real-time.

**Should Have**: After delivery, client sees the proof photos inline in the order detail/tracking view.

---

## 10. Feature Possibility Map

### What the Current Stack Can Already Support (Low Effort)

| Feature | Effort | How |
|---------|--------|-----|
| Deep link to Google Maps navigation | 1-2 hrs | `https://www.google.com/maps/dir/?api=1&destination=lat,lng` button on rider delivery page |
| Nearby riders count on booking page | 2-4 hrs | Call existing `/riders/nearby`, show count + dots on `RoutePreviewMap` |
| Live ETA countdown on tracking map | 4-8 hrs | Extract duration from `useDirections`, render countdown badge, update on route refresh |
| Geofence arrival auto-suggest | 4-8 hrs | Add haversine check in socket `rider:updateLocation` handler, emit `rider:near-destination` event |
| Multi-stop route optimization | 4-8 hrs | Add `optimizeWaypointOrder: true` to Google Routes API call |
| Delivery proof photos in order detail | 2-4 hrs | Query photos from order, render gallery component in tracking/order detail page |
| Breadcrumb path replay (admin) | 1-2 days | Query `LocationHistory` for order, render as polyline on admin map |

### What's Possible with Moderate Effort (Days)

| Feature | Effort | What It Gives You |
|---------|--------|-------------------|
| Admin live operations map | 3-5 days | Full dispatch command center with rider positions, order pins, zone overlays, click-to-assign |
| Rider demand heatmap | 2-3 days | Colored grid overlay showing pending order density per area |
| In-app step-by-step directions | 2-3 days | Direction list with maneuver icons from Routes API steps, expanding on tap |
| Route deviation alerts | 1-2 days | Compare rider's actual path vs expected route, alert admin if deviation >500m |
| Delivery time prediction UI | 1-2 days | "Usually delivers in X-Y min" based on ETA learning data per zone |
| Saved address map pins | 1 day | Show saved addresses as tappable pins on map picker |
| Client: "Share my location" | 1 day | Client sends GPS to rider before pickup so rider can navigate to exact spot |

### What's Possible with Significant Effort (Weeks)

| Feature | Effort | What It Gives You |
|---------|--------|-------------------|
| Full turn-by-turn with voice | 2-3 weeks | Web Speech API + directions steps, auto-advance on GPS match, rerouting on deviation |
| AI demand forecasting | 2-4 weeks | Predict demand per zone/hour using historical data, pre-position riders |
| GPS spoofing detection | 1-2 weeks | Velocity checks (impossible speed between points), accelerometer correlation, known GPS spoof app signatures |
| Delivery corridor pricing | 1-2 weeks | Named routes between common origin-destination pairs with fixed pricing |
| Street-level indoor navigation | 3-4 weeks | For mall/hospital deliveries, indoor wayfinding with floor plans |
| Multi-rider batch dispatch | 2-3 weeks | One dispatch event assigns multiple nearby orders to nearby riders optimally |
| Dynamic re-routing on traffic | 1-2 weeks | Monitor traffic during delivery, suggest alternative route if current becomes congested |

---

## 11. Recommendations Priority Matrix

### Do Now (Before Launch)

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| 1 | **GAP-02**: Add "Navigate in Google Maps" button for riders | Riders can't navigate without it | 2 hours |
| 2 | **GAP-04**: Show nearby rider count on Send page | Prevents empty-dispatch frustration | 4 hours |
| 3 | **GAP-07**: Add live ETA countdown on tracking map | Core customer expectation | 6 hours |
| 4 | **GAP-03**: Geofence arrival auto-suggest | Smoother status transitions | 6 hours |

### Do Soon (First Month Post-Launch)

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| 5 | **GAP-01**: Admin operations map | Dispatchers need visual oversight | 3-5 days |
| 6 | **GAP-10**: Multi-stop route optimization | Better delivery efficiency | 6 hours |
| 7 | **GAP-11**: Demand heatmap for riders | Rider positioning, faster dispatch | 2-3 days |
| 8 | **GAP-05**: Deduplicate map code into shared package | Maintenance sanity | 1-2 days |

### Do Later (Growth Phase)

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| 9 | **GAP-08**: Breadcrumb replay for admin | Dispute resolution, fraud detection | 1-2 days |
| 10 | **GAP-06**: Remove duplicate haversine | Code hygiene | 1 hour |
| 11 | Route deviation alerts | Fraud/safety | 1-2 days |
| 12 | AI demand forecasting | Scale efficiency | 2-4 weeks |
| 13 | GPS spoofing detection | Platform integrity | 1-2 weeks |

---

## Summary

The mapping system is **architecturally solid** with professional-quality route rendering, smart Ghana-specific addressing (Plus Codes, landmark parsing, gazetteer), a sophisticated 6-factor dispatch algorithm, and a genuinely innovative ETA learning service. The real-time tracking pipeline (Socket.IO with Redis adapter, breadcrumb buffering, REST fallback, presence management) is production-ready.

The four critical gaps before launch are: (1) riders need a "Navigate in Google Maps" button, (2) clients need to see nearby rider availability before booking, (3) clients need a live ETA countdown on the tracking map, and (4) geofence-based arrival detection should auto-suggest status transitions. These are all achievable in under 2 days total.

The biggest post-launch win is the admin operations map, which gives dispatchers the visual command center they need to manage the fleet effectively.

---

## Phase 1: Price Estimation — Fixes Completed

All 10 improvements below were implemented and verified (zero TypeScript errors across all modified files).

### P1-01: Time-of-day pricing timezone fix (CRITICAL)
**File:** `apps/api/src/services/pricing.service.ts`
**Problem:** `new Date().getHours()` used server's locale timezone, giving wrong time-of-day multiplier if server is not in GMT+0.
**Fix:** Explicit `Africa/Accra` timezone via `toLocaleString('en-US', { timeZone: 'Africa/Accra', hour: 'numeric', hour12: false })`.

### P1-02: Express delivery transparency flags (HIGH)
**Files:** `pricing.service.ts`, `price-breakdown.tsx`, `send/page.tsx`
**Problem:** Express >15km was silently downgraded to standard. Schedule discount blocked by surge had no explanation.
**Fix:** Added `expressIgnored` and `scheduleDiscountBlockedBySurge` boolean flags to `PriceBreakdown` interface and return. Client shows amber warning on Send page when express is ignored, and muted line items in expanded PriceBreakdown explaining blocked discounts.

### P1-03: Directions endpoint coordinate validation (HIGH)
**File:** `apps/api/src/routes/orders/order.routes.ts`
**Problem:** Malformed coordinates (NaN, out of bounds) passed straight to Google Routes API, wasting quota and causing cryptic errors.
**Fix:** Added bounds validation (lat -90..90, lng -180..180, null/NaN checks) before Google API call. Returns `400 Bad Request` with clear message.

### P1-04: Google Routes API timeout + logging (HIGH)
**Files:** `order.routes.ts`, `pricing.service.ts`
**Problem:** No timeout on Google API calls; failures returned generic errors with no server-side logging.
**Fix:** Added `AbortSignal.timeout(8000)` (8s) to both `fetchRouteDistance` and the directions proxy. Added `console.error` with status/body on non-OK responses.

### P1-05: Route preview map stale fetch + error overlay (MEDIUM)
**File:** `apps/client/src/components/route-preview-map.tsx`
**Problem:** Boolean `stale = false` cleanup was fragile under rapid remounts. Failed direction fetches showed blank map with no feedback.
**Fix:** Replaced stale flag with monotonically increasing `fetchSeqRef` sequence number. Added `routeError` state with amber "Could not load route preview" overlay.

### P1-06: Zone lookup cache (MEDIUM)
**File:** `apps/api/src/services/pricing.service.ts`
**Problem:** Every estimate made a fresh `prisma.zone.findMany({ where: { status: 'ACTIVE' } })` query.
**Fix:** Added in-memory zone cache with 5-minute TTL (`ZONE_CACHE_TTL_MS`). `getActiveZones()` returns cached zones when fresh, refetches when expired. Properly typed as `Zone[]` from Prisma.

### P1-07: ETA Learning atomic upsert (MEDIUM)
**File:** `apps/api/src/services/eta-learning.service.ts`
**Problem:** `upsertCorrectionFactor` used `findUnique` then `update`/`create` without a transaction, creating a race condition when two deliveries complete simultaneously for the same zone/hour/day.
**Fix:** Wrapped in `prisma.$transaction(async (tx) => { ... })` for atomic find-then-write.

### P1-08: PriceBreakdown surge/express notes (MEDIUM)
**File:** `apps/client/src/components/price-breakdown.tsx`
**Problem:** When express was silently ignored or schedule discount was blocked by surge, users had no visibility into why.
**Fix:** Added conditional line items in ExpandedBreakdown: muted text explaining "Express not available for this distance" and "Schedule discount unavailable during high demand" with n/a values.

### P1-09: Direction arrows smart scaling (LOW)
**File:** `apps/client/src/lib/map-route.ts`
**Problem:** Arrow repeat was hardcoded at `100px` — too dense on long routes (hundreds of arrows) and slightly sparse on very short ones.
**Fix:** Arrow `repeat` now scales based on route path point count: <20 points → 80px, <100 → 120px, <300 → 160px, 300+ → 220px.

### P1-10: Zone type safety cleanup (LOW)
**File:** `apps/api/src/services/pricing.service.ts`
**Problem:** Zone cache was typed as `Array<{ id: string; polygon: number[][][]; [key: string]: unknown }>`, causing all zone fields to resolve as `{}` type, requiring unsafe `Record<string, unknown>` casts.
**Fix:** Cache typed as `Zone[]` from `@prisma/client`. Removed all `(pickupZone as Record<string, unknown>)` casts for `roadFactor`, `avgSpeedKmh`, `pendingOrders`. `findZoneForPoint` now returns `Promise<Zone | null>`.

---

## Phase 2: Order Creation — Fixes Completed

**Scope:** Steps 2.1–2.9 (package selection, payment method, optional details, promo codes, scheduling, express toggle, submission, payment processing, status creation)
**Audit method:** Deep-read of 16 files, 25 issues identified (4 CRITICAL, 6 HIGH, 8 MEDIUM, 7 LOW). 9 fixes implemented covering all CRITICAL and targeted HIGH/MEDIUM issues.

### P2-01: File upload magic byte verification + rate limiting (CRITICAL)
**File:** `apps/api/src/routes/orders/order.routes.ts`
**Problem:** Upload endpoint trusted client-supplied `file.mimetype` with no server-side content verification. A malicious file with a spoofed MIME type could pass multer validation. Additionally, the upload endpoint had no rate limiter, making it vulnerable to abuse. A duplicate `fs.unlink` call could race with StorageService cleanup.
**Fix:** Added `MAGIC_BYTES` lookup mapping MIME types to their binary signatures (JPEG `FFD8FF`, PNG `89504E47`, WebP `52494646...57454250`, MP4 `ftyp` at offset 4, QuickTime `ftyp` at offset 4, WebM `1A45DFA3`). `verifyMagicBytes()` reads first 16 bytes via `fsSync.openSync/readSync/closeSync` and compares against declared MIME. Returns 400 on mismatch. Applied `sensitiveRateLimit` middleware (5 req/60s). Removed duplicate `fs.unlink` (StorageService.uploadFromPath handles cleanup).

### P2-02: Promo code atomic transaction + minOrderAmount enforcement (CRITICAL)
**Files:** `apps/api/src/services/order.service.ts`, `apps/api/src/services/pricing.service.ts`
**Problem:** Promo code claim used `$executeRaw` UPDATE without atomic per-user usage enforcement. Two concurrent requests could both pass the per-user check before either incremented the count. Additionally, the `minOrderAmount` field on PromoCode model was never checked during validation.
**Fix:** Replaced with `prisma.$transaction(async (tx) => { ... })` that: finds promo with serializable read, validates `isActive`/`validUntil`/`maxUses`, counts per-user usages atomically inside transaction, rejects if limit exceeded, then increments `usedCount`. In pricing service, restructured promo validation to run AFTER subtotal calculation so `minOrderAmount` can be checked against the actual pre-promo subtotal.

### P2-03: scheduledAt future-date validation (HIGH)
**File:** `packages/validators/src/order.ts`
**Problem:** Zod schema only checked that `scheduledAt` was a valid ISO date, not that it was in the future. A past date would be accepted and create a nonsensical order.
**Fix:** Added `.refine()` checking `scheduledAt.getTime() > Date.now() - 60_000` (60s grace for clock skew). Rejects with "Scheduled time must be in the future".

### P2-04: additionalStops count correction (MEDIUM)
**File:** `apps/api/src/services/order.service.ts`
**Problem:** `additionalStops = input.stops ? Math.max(0, input.stops.length - 1) : 0` subtracted 1, assuming the primary dropoff was included in the stops array. But the client only sends extra stops (primary dropoff is separate), so every order under-counted by 1 stop.
**Fix:** Changed to `input.stops ? input.stops.length : 0` with comment explaining the client sends only extra stops.

### P2-05: Weight cap synced to 30 kg (MEDIUM)
**Files:** `packages/validators/src/order.ts`, `apps/client/src/app/(dashboard)/dashboard/send/page.tsx`
**Problem:** Zod schema allowed `.max(200)` kg but the platform uses motorcycle couriers with a realistic 30 kg limit (matching `MAX_PACKAGE_WEIGHT_KG` constant). Client-side input also allowed up to 200.
**Fix:** Both `createOrderSchema` and `priceEstimateSchema` changed to `.max(30)`. Client weight input cap changed from `v > 200` to `v > 30`. Added heavy weight badges: >20 kg shows red "Heavy" badge with warning text about motorcycle delivery limits.

### P2-06: Double-submit prevention with useRef guard (HIGH)
**File:** `apps/client/src/app/(dashboard)/dashboard/send/page.tsx`
**Problem:** `handleConfirm` checked `submitting` state variable, but React state updates are asynchronous. Rapid double-taps could fire two requests before the first `setSubmitting(true)` rendered.
**Fix:** Added `const submittingRef = useRef(false)` as a synchronous guard. `handleConfirm` checks and sets `submittingRef.current` immediately (synchronous), with reset in `finally` block. The existing `submitting` state still drives UI disabled state.

### P2-07: SAME_DAY past-time user notice (MEDIUM)
**File:** `apps/client/src/app/(dashboard)/dashboard/send/page.tsx`
**Problem:** When a SAME_DAY delivery time picker value was in the past, the server silently bumped it to ~30 min from now. Users had no idea their selected time was ignored.
**Fix:** Added inline amber warning below the time picker: computes whether selected time has passed, shows "Selected time has passed. Delivery will be scheduled ~30 min from now." Wrapped the time picker and warning in a React fragment to satisfy JSX expression constraints.

### P2-08: Promo code error feedback full-stack (MEDIUM)
**Files:** `apps/api/src/services/pricing.service.ts`, `apps/api/src/services/order.service.ts`, `apps/client/src/components/price-breakdown.tsx`, `apps/client/src/app/(dashboard)/dashboard/send/page.tsx`
**Problem:** When a promo code was invalid (expired, usage exceeded, wrong zone, wrong package type, minimum not met), the client received `promoDiscount: 0` with no explanation. Users had no way to know why their code failed.
**Fix:** Added `promoError: string | null` to `PriceBreakdown` interface. Promo validation now sets specific human-readable error strings for each failure mode: 'not found or inactive', 'has expired', 'usage limit reached', 'already used maximum times', 'not valid for your zone', 'not valid for this package type', 'Minimum order of GHS X required'. Passed through estimate response to client. Client shows red error text below promo input (mutually exclusive with "Applied!" badge).

### P2-09: Duplicate temp file cleanup removal (LOW)
**File:** `apps/api/src/routes/orders/order.routes.ts`
**Problem:** Upload endpoint called `fs.unlink(file.path).catch(() => {})` after `StorageService.uploadFromPath()`, but the service already handles temp file cleanup internally. The duplicate unlink could race or log spurious ENOENT errors.
**Fix:** Removed the duplicate `fs.unlink` call. Handled as part of P2-01.

---

## Phase 3: Auto-Dispatch -- Fixes Completed

**Scope:** Steps 3.1-3.14 (autoDispatch trigger, rider querying, 6-factor scoring, progressive radius search, sequential job offers, 30s acceptance window, decline/timeout handling, assignment transaction, Redis persistence, crash recovery)
**Audit method:** Deep-read of 13 files, 29 issues identified (5 CRITICAL, 6 HIGH, 11 MEDIUM, 7 LOW). 13 fixes implemented covering all CRITICAL, key HIGH, and targeted MEDIUM issues.

### P3-01: SEARCHING_RIDER to PENDING revert now valid in state machine (CRITICAL)
**Files:** `apps/api/src/services/order.service.ts`, `apps/api/src/services/auto-dispatch.service.ts`
**Problem:** When no riders were found or all declined, auto-dispatch reverted orders to `PENDING` via raw `prisma.order.update()`. But the status transition map only allowed `SEARCHING_RIDER` to transition to `ASSIGNED`, `CANCELLED_BY_CLIENT`, or `CANCELLED_BY_ADMIN`. The revert bypassed the state machine and created no `orderStatusHistory` entry.
**Fix:** Added `PENDING` to the valid transitions from `SEARCHING_RIDER`. All 4 revert paths (no online riders, no riders in radius, all candidates declined, all candidates exhausted) now create `orderStatusHistory` entries with descriptive notes.

### P3-02: Atomic PENDING to SEARCHING_RIDER transition guard (CRITICAL)
**File:** `apps/api/src/services/auto-dispatch.service.ts`
**Problem:** `prisma.order.update({ where: { id: orderId }, data: { status: 'SEARCHING_RIDER' } })` had no status guard. If a client cancelled the order between the initial read and the status update, a cancelled order could be set back to `SEARCHING_RIDER`.
**Fix:** Changed to `prisma.order.updateMany({ where: { id: orderId, status: 'PENDING' }, ... })` and checks `count > 0`. If the order was already cancelled or changed, the dispatch silently exits.

### P3-03: Redis SETNX distributed lock for dispatch (CRITICAL)
**File:** `apps/api/src/services/auto-dispatch.service.ts`
**Problem:** The duplicate dispatch check (`activeDispatches.has(orderId)`) was in-memory only. In multi-instance deployments, two servers could dispatch the same order simultaneously (e.g., webhook retry + order creation), leading to duplicate offers and potential double-assignment.
**Fix:** Added `acquireDispatchLock(orderId)` using Redis `SET ... NX EX 300`. If another instance holds the lock, dispatch returns immediately. `releaseDispatchLock(orderId)` called on all terminal paths (success, exhaustion, cancellation). Falls back to local-only guard when Redis is unavailable.

### P3-04: job:offer:taken scoped to RIDER room (CRITICAL)
**File:** `apps/api/src/services/auto-dispatch.service.ts`
**Problem:** `io.emit('job:offer:taken', { orderId })` broadcast to ALL connected sockets (clients, riders, admins), leaking order IDs to unrelated users and creating unnecessary network traffic.
**Fix:** Changed to `io.to('role:RIDER').emit('job:offer:taken', { orderId })`.

### P3-05: handleOfferResponse synchronous mutex (CRITICAL)
**File:** `apps/api/src/services/auto-dispatch.service.ts`
**Problem:** `handleOfferResponse` is async but not atomic. A rider with a flaky connection could send two rapid `accept` events. Both could pass the `state.resolved` check before either set it to `true`, causing `assignRider()` to be called twice. On failure recovery, `state.resolved = false` with re-add to `activeDispatches` created corruption.
**Fix:** Added `processing: boolean` to `DispatchState`. Checked/set synchronously at entry, reset on all exit paths (early returns, success, failure recovery, decline). Concurrent calls get "Response already being processed" error.

### P3-06: Proximity score extended for 8-12km tiers (HIGH)
**File:** `apps/api/src/services/auto-dispatch.service.ts`
**Problem:** `proximityScore()` returned 0 for distances > 8km, but `SEARCH_RADIUS_TIERS_KM` includes a 12km tier. Riders at 8-12km got a 0 proximity score (40% of total), making them effectively invisible even when they were the only available riders.
**Fix:** Added `if (distanceKm <= 10) return 15; if (distanceKm <= 12) return 5;` to the proximity scoring ladder.

### P3-07: order:no-riders emitted to user + admin rooms (HIGH)
**Files:** `apps/api/src/services/auto-dispatch.service.ts`
**Problem:** `order:no-riders` was emitted only to `order:${orderId}` room. Since auto-dispatch fires immediately after POST /orders returns, the client often hadn't navigated to the tracking page and subscribed to the order room yet. The event was lost. Admins had no visibility into dispatch failures.
**Fix:** All 3 no-riders emission points now emit to both `order:${orderId}` + `user:${order.clientId}` (guaranteed delivery) and separately to `role:ADMIN`. Added `clientId` to both `DispatchState` and `PersistedDispatchState` for the exhausted-path emission.

### P3-08: Redis cleanup moved after successful assignRider (HIGH)
**File:** `apps/api/src/services/auto-dispatch.service.ts`
**Problem:** On accept, `removeDispatchFromRedis(orderId)` was called BEFORE `assignRider()`. If assignment failed (rider already claimed, order changed), the Redis dispatch state was permanently lost. The catch block re-added to `activeDispatches` but the Redis key was gone, so a server crash would lose recovery data.
**Fix:** Moved `removeDispatchFromRedis(orderId)` to after the successful `assignRider()` call. On failure, the Redis state is still intact for recovery.

### P3-09: GPS bounding box pre-filter in SQL query (HIGH)
**File:** `apps/api/src/services/auto-dispatch.service.ts`
**Problem:** The rider query fetched up to 100 riders with `WHERE availability = 'ONLINE' AND currentLatitude IS NOT NULL` but with no spatial constraint. In a city with 100+ online riders, the 100 returned may not include the nearest to the pickup. Distance calculation happened post-fetch in JS. GPS freshness (`lastLocationUpdate`) was also not filtered at DB level, wasting bandwidth on stale-GPS riders.
**Fix:** Added bounding box filter: `currentLatitude BETWEEN pickupLat +/- degDelta` and `currentLongitude BETWEEN pickupLng +/- degDelta` where `degDelta = MAX_SEARCH_RADIUS_KM / 111`. Added `lastLocationUpdate: { gte: new Date(Date.now() - MIN_GPS_FRESHNESS_MS) }` to the query. Removed redundant JS-level freshness check.

### P3-10: Breadcrumb buffer cap to prevent OOM (MEDIUM)
**File:** `apps/api/src/socket/index.ts`
**Problem:** The `breadcrumbBuffer` array only removed entries on successful DB flush. If writes consistently failed (DB down, connection pool exhausted), the buffer grew unbounded, risking OOM on long-running connections.
**Fix:** Added `MAX_BREADCRUMB_BUFFER_SIZE = 500`. After each push, if buffer exceeds cap, oldest entries are dropped with a warning log.

### P3-11: cancelDispatch clears Redis declined set (MEDIUM)
**File:** `apps/api/src/services/auto-dispatch.service.ts`
**Problem:** `cancelDispatch` removed only `dispatch:${orderId}` from Redis, not `declined:${orderId}`. If the same order was re-dispatched within the 1-hour TTL (e.g., admin retry), previously-declined riders were still filtered out, unnecessarily shrinking the candidate pool.
**Fix:** Added `redis.del('declined:${orderId}')` in `cancelDispatch`.

### P3-12: Redis SCAN replaces KEYS in presence service (MEDIUM)
**File:** `apps/api/src/services/presence.service.ts`
**Problem:** `redis.keys('presence:*')` scans ALL Redis keys in O(N), blocking the Redis event loop. In production with thousands of keys across all services, this causes latency spikes.
**Fix:** Replaced with cursor-based `redis.scan()` loop using `MATCH presence:* COUNT 100`, which is non-blocking and returns results incrementally.

### P3-13: Zone bonus score cap raised to 103 (MEDIUM)
**File:** `apps/api/src/services/auto-dispatch.service.ts`
**Problem:** `Math.min(score + zoneBonus, 100)` meant riders with score 98+ got zero benefit from the +3 zone bonus. The bonus was designed as a tiebreaker for same-zone riders but was effectively nullified for top riders.
**Fix:** Cap raised to `Math.min(score, 103)` to allow the zone bonus to function as a tiebreaker above the natural 100-point ceiling.
