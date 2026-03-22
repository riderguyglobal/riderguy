# Riderguy Pricing: Current State vs. Comprehensive Factor Analysis

> **Purpose:** Audit every factor that should influence delivery pricing — what we currently use, what we're missing, and what to consider before ride acceptance and delivery finalization.  
> **Date:** March 2026

---

## PART 1: CURRENT PRICING ENGINE — WHAT WE HAVE

### Current Formula

```
effectiveDistance  = haversineDistance × roadFactor (1.3 default)
distanceCharge    = effectiveDistance × perKmRate
stopSurcharges    = additionalStops × GHS 3.00
rawSubtotal       = (baseFare + distanceCharge + stopSurcharges)
                    × packageMultiplier × surgeMultiplier × scheduleDiscount
subtotal          = MAX(rawSubtotal, minimumFare)
serviceFee        = subtotal × 10%
totalPrice        = subtotal + serviceFee
platformCommission = totalPrice × commissionRate (15%)
riderEarnings     = totalPrice − platformCommission
```

### Factors Currently Considered

| # | Factor | How It's Used | Values |
|---|--------|---------------|--------|
| 1 | **Base fare** | Flat mobilization fee | GHS 5.00 (zone-overridable) |
| 2 | **Distance** | Haversine × road factor × per-km rate | GHS 2.00/km default |
| 3 | **Road factor** | Multiplier on straight-line distance | 1.15–1.4 (default 1.3) |
| 4 | **Package type** | Multiplier on subtotal | 1.0× to 1.5× (7 types) |
| 5 | **Surge** | Demand-based multiplier | 1.0× to 1.8× cap |
| 6 | **Schedule discount** | Reduced rate for pre-scheduled orders | 0–10% off |
| 7 | **Multi-stop surcharge** | Per additional stop | GHS 3.00/stop, max 5 stops |
| 8 | **Zone-based overrides** | Different base rates per city/area | 6 zones defined |
| 9 | **Service fee** | Transparent platform fee | 10% of subtotal |
| 10 | **Minimum fare** | Price floor | GHS 8.00 (zone-overridable) |
| 11 | **Commission rate** | Platform's cut of total | 15% default (zone-overridable) |
| 12 | **Level-based commission** | Gamification bonus at payout | Rookie 20% → Legend 8% |

### What's Missing

The current engine is **a v1 distance-based calculator**. It does NOT account for real road distance (uses haversine approximation), real-time traffic, time-of-day, package weight/dimensions, weather, rider availability, actual route, return trip costs, or dozens of other factors that mature delivery platforms consider.

---

## PART 2: COMPREHENSIVE FACTOR ANALYSIS

Every factor below is categorized by **when** it should be evaluated:
- **E** = Estimate (before order creation — client sees quote)
- **A** = Acceptance (before rider accepts the job)
- **F** = Finalization (at delivery completion — adjust final price)

---

### CATEGORY 1: DISTANCE & ROUTE

| # | Factor | Phase | Description | Currently Used? |
|---|--------|-------|-------------|-----------------|
| 1 | **Straight-line (haversine) distance** | E | GPS distance between pickup and dropoff | ✅ Yes |
| 2 | **Road distance (actual route)** | E/A | Real driving distance via roads, bridges, highways | ❌ No — approximated with road factor |
| 3 | **Road factor per zone** | E | Multiplier to estimate road vs. straight-line | ✅ Yes (global, not per-zone) |
| 4 | **Number of stops** | E | Additional stops beyond A→B | ✅ Yes |
| 5 | **Stop-to-stop distance** | E | Individual leg distances for multi-stop routes | ❌ No — uses single A→B distance |
| 6 | **Route complexity** | E | Number of turns, roundabouts, U-turns | ❌ No |
| 7 | **Elevation change** | E | Hilly terrain increases fuel and time | ❌ No |
| 8 | **Road quality/type** | E | Tarmac vs. gravel vs. unpaved | ❌ No |
| 9 | **Return trip (deadhead)** | E | Rider has to ride back — particularly for suburban/rural drops | ❌ No |
| 10 | **One-way streets / restricted access** | E | Some areas require long detours | ❌ No |
| 11 | **Toll roads / bridges** | E | E.g., motorway tolls in Accra-Tema corridor | ❌ No |
| 12 | **Actual distance traveled** | F | GPS-tracked real distance vs. estimate | ❌ No |

**Impact Assessment:**  
Items 2, 9, and 12 are the biggest gaps. A rider dropping off in Pokuase and having to deadhead 15 km back earns the same as one delivering within Osu. The route API would cost per call but dramatically improve accuracy.

---

### CATEGORY 2: TIME & DURATION

| # | Factor | Phase | Description | Currently Used? |
|---|--------|-------|-------------|-----------------|
| 13 | **Estimated duration** | E | Based on distance ÷ avg speed | ✅ Yes (20 km/h default) |
| 14 | **Time of day** | E | Peak hours = slower traffic + higher demand | ❌ No — surge is static |
| 15 | **Day of week** | E | Weekend vs. weekday demand patterns | ❌ No |
| 16 | **Real-time traffic** | E/A | Live traffic conditions affecting ETA | ❌ No |
| 17 | **Wait time at pickup** | F | Rider waiting for package to be ready | ❌ No |
| 18 | **Wait time at dropoff** | F | Recipient not available, rider waiting | ❌ No |
| 19 | **Idle/dwell time per stop** | F | Time spent at each intermediate stop | ❌ No |
| 20 | **Night/late-night operations** | E | Reduced visibility, safety risk, fewer riders | ❌ No — mentioned in surge guidance but not systemized |
| 21 | **Holiday/event pricing** | E | Public holidays, major events | ❌ No |
| 22 | **Actual trip duration** | F | GPS-tracked real duration vs. estimate | ❌ No |

**Impact Assessment:**  
Items 14, 17, 18, and 20 are critical. A rider stuck in Accra Circle traffic for 45 minutes earns the same as one on a clear road. Pickup wait times are a huge pain point — clients who aren't ready waste rider time that should be compensated.

---

### CATEGORY 3: PACKAGE CHARACTERISTICS

| # | Factor | Phase | Description | Currently Used? |
|---|--------|-------|-------------|-----------------|
| 23 | **Package type category** | E | Document, food, fragile, etc. | ✅ Yes (7 types) |
| 24 | **Package weight** | E | Affects fuel, rider fatigue, motorcycle wear | ❌ No |
| 25 | **Package dimensions/volume** | E | Bulky packages limit maneuverability | ❌ No |
| 26 | **Declared value** | E | Higher value = higher liability risk | ❌ No — HIGH_VALUE type exists but no declared amount |
| 27 | **Temperature sensitivity** | E | Cold chain / hot food — time pressure | ❌ No |
| 28 | **Hazardous materials** | E | Extra handling, legal compliance | ❌ No |
| 29 | **Stackability** | E | Can this be combined with other deliveries? | ❌ No |
| 30 | **Special handling instructions** | E | "Do not tilt", "sign required", etc. | ❌ No pricing impact |
| 31 | **Insurance requirement** | E | Client-requested insurance adds cost | ❌ No |
| 32 | **Photo proof required** | A/F | Documentation obligation at pickup/dropoff | ❌ No pricing impact |

**Impact Assessment:**  
Items 24 and 25 are the most impactful. A 20 kg bag of cement vs. a letter — the current system only differentiates by category (1.0×–1.5×), not actual weight. For a motorcycle delivery platform, weight directly affects fuel consumption, tire wear, and rider safety.

---

### CATEGORY 4: DEMAND & SUPPLY (DYNAMIC PRICING)

| # | Factor | Phase | Description | Currently Used? |
|---|--------|-------|-------------|-----------------|
| 33 | **Surge multiplier** | E | Static zone-based surge | ✅ Yes (static, admin-set) |
| 34 | **Real-time demand/supply ratio** | E | Auto-surge based on pending orders vs. available riders | ❌ No — planned but not built |
| 35 | **Rider density in pickup area** | E | Fewer nearby riders = longer wait + should cost more | ❌ No |
| 36 | **Order queue depth** | E | How many orders are waiting in the zone | ❌ No |
| 37 | **Rider acceptance rate** | A | If riders keep declining an order, price may need to increase | ❌ No |
| 38 | **Time since order placed** | A | Orders sitting too long should incentivize riders | ❌ No |
| 39 | **Competing orders** | E | Multiple good orders available — riders cherry-pick | ❌ No |
| 40 | **Minimum rider guarantee** | A | Guarantee minimum hourly earnings to keep riders active | ❌ No |

**Impact Assessment:**  
Item 34 is the single biggest missing piece for a real ride-hailing system. Without dynamic surge, pricing doesn't respond to reality. A lunchtime rush with 50 pending orders and 5 riders should NOT cost the same as a quiet Tuesday morning.

---

### CATEGORY 5: GEOGRAPHIC & ENVIRONMENTAL

| # | Factor | Phase | Description | Currently Used? |
|---|--------|-------|-------------|-----------------|
| 41 | **Zone-based pricing** | E | Different rates per area | ✅ Yes |
| 42 | **Cross-zone delivery** | E | Pickup in zone A, dropoff in zone B — which zone's rates? | ❌ No — uses pickup zone only |
| 43 | **Out-of-zone delivery** | E | Dropoff in unserviced area — extra risk, no return jobs | ❌ No |
| 44 | **Weather conditions** | E/A | Rain, flooding — slower, riskier, fewer riders | ❌ No |
| 45 | **Road closures / construction** | E | Temporary detours increasing distance | ❌ No |
| 46 | **Flood-prone areas** | E | Certain areas in Accra flood during rain season | ❌ No |
| 47 | **Security/safety zones** | E | High-crime areas — rider risk premium | ❌ No |
| 48 | **Urban vs. rural** | E | Population density affects efficiency | ❌ No — partially via zones |
| 49 | **Accessibility** | E | Gated communities, restricted areas, military zones | ❌ No |
| 50 | **GPS accuracy / addressing** | E | Areas with no street names — Plus Codes help but add complexity | Partial — Plus Codes stored |

**Impact Assessment:**  
Items 42, 43, and 44 are significant. A delivery from Accra Central to Dodowa (30+ km, no return jobs) vs. within Osu (3 km, instant next job) — the economics are completely different. Weather is a massive factor in Ghana's rainy season (April–July, Sept–Oct).

---

### CATEGORY 6: RIDER FACTORS

| # | Factor | Phase | Description | Currently Used? |
|---|--------|-------|-------------|-----------------|
| 51 | **Rider rating** | A | Higher-rated riders could command premium | ❌ No |
| 52 | **Rider experience level** | A | Veteran riders = faster, more reliable | Partial — gamification levels affect commission |
| 53 | **Rider vehicle type** | E | Motorcycle vs. bicycle vs. car (future) | ❌ No — motorcycle only currently |
| 54 | **Rider location (pickup distance)** | A | How far rider must travel to reach pickup | ❌ No |
| 55 | **Rider fuel costs** | — | Current fuel price in Ghana | ❌ No |
| 56 | **Rider equipment** | A | Does rider have insulated bag for food? Cargo rack? | ❌ No |
| 57 | **Rider insurance/license** | A | Properly documented riders may command premium | ❌ No |
| 58 | **Rider current earnings** | A | Guarantee minimum daily earnings | ❌ No |
| 59 | **Rider preferences** | A | Some riders prefer short trips, others long — affects acceptance | ❌ No |
| 60 | **Rider fatigue** | A | Hours worked today — safety consideration | ❌ No |

**Impact Assessment:**  
Item 54 is critical and commonly overlooked. If the nearest rider is 8 km from pickup, they're riding 8 km unpaid. This should either be compensated (rider mobilization fee based on actual distance to pickup, not flat) or factored into which rider gets the offer.

---

### CATEGORY 7: CLIENT FACTORS

| # | Factor | Phase | Description | Currently Used? |
|---|--------|-------|-------------|-----------------|
| 61 | **Business vs. individual** | E | Business accounts get volume discounts | Documented but ❌ not implemented |
| 62 | **Order history / loyalty** | E | Frequent clients get rewards/discounts | ❌ No |
| 63 | **Client rating** | A | Problem clients (not ready, rude) — riders may need incentive | ❌ No |
| 64 | **Payment method** | E | Cash vs. mobile money vs. card — different processing costs | ❌ No |
| 65 | **Prepaid vs. pay-on-delivery** | E | Cash on delivery = rider carrying cash risk | ❌ No |
| 66 | **Credit/wallet balance** | E | Pre-funded wallet may get discount | ❌ No |
| 67 | **Promo codes / referrals** | E | Discount codes for marketing campaigns | ❌ No |
| 68 | **Subscription tier** | E | Monthly subscription for reduced per-delivery fees | ❌ No |

**Impact Assessment:**  
Items 64 and 65 are operationally important. Cash on delivery means the rider carries money, which is a risk. Mobile money has a 1.5% processing fee that someone must absorb. Card payments have a different fee structure.

---

### CATEGORY 8: ORDER-SPECIFIC ADJUSTMENTS

| # | Factor | Phase | Description | Currently Used? |
|---|--------|-------|-------------|-----------------|
| 69 | **Priority/express delivery** | E | Client pays premium for faster service | ❌ No |
| 70 | **Scheduled time window** | E | Specific window (e.g., 2–3 PM) vs. ASAP | Partial — schedule discount exists |
| 71 | **Recipient instructions** | E | "Call when arriving", "Leave at door" — affects time | ❌ No pricing impact |
| 72 | **Proof of delivery type** | E | Signature, photo, OTP — affects time | ❌ No |
| 73 | **Round-trip (return delivery)** | E | Pick up and bring back | ❌ No |
| 74 | **Batched/pooled deliveries** | E | Multiple orders same direction — shared cost | ❌ No |
| 75 | **Attempted delivery / redelivery** | F | Failed first attempt, rescheduled | ❌ No |
| 76 | **Partial delivery** | F | Some items delivered, some returned | ❌ No |
| 77 | **Order modification after creation** | F | Client changes dropoff mid-ride | ❌ No |
| 78 | **Cancellation fees** | F | Based on stage of delivery | ✅ Yes (GHS 0/3/5) |
| 79 | **Tipping** | F | 100% to rider | ✅ Yes |

**Impact Assessment:**  
Items 69 and 74 are high-value features. Express delivery (guaranteed <30 min within zone) could command 1.5–2× premium. Batched deliveries (think: Shoprite distributing 10 orders same neighborhood) should be cheaper per order but more profitable per rider.

---

### CATEGORY 9: COST OF OPERATIONS (PLATFORM SIDE)

| # | Factor | Phase | Description | Currently Used? |
|---|--------|-------|-------------|-----------------|
| 80 | **Payment processing fees** | E/F | Paystack MoMo 1.5%, Card 1.95% | ❌ Absorbed but not calculated |
| 81 | **SMS/OTP costs** | — | Per-order verification costs | ❌ Not factored |
| 82 | **Map API calls** | — | Mapbox directions, geocoding per order | ❌ Not factored |
| 83 | **Insurance premiums** | — | Rider/package insurance pool | ❌ Not factored |
| 84 | **Customer support cost** | — | Per-order support overhead | ❌ Not factored |
| 85 | **Fraud/chargeback risk** | F | Orders disputed, refunded | ❌ Not factored |

---

## PART 3: PRIORITIZED RECOMMENDATIONS

### Tier 1 — Must Have (Accuracy & Fairness)

These factors should be implemented before scaling beyond beta:

| Priority | Factor | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | **Dynamic surge (demand/supply ratio)** | Medium | Ensures pricing responds to reality |
| **P0** | **Wait time charging (pickup/dropoff)** | Medium | Stops riders from losing money waiting |
| **P0** | **Payment method fee passthrough** | Low | Prevents margin erosion on MoMo |
| **P1** | **Time-of-day pricing** | Low | Auto-adjusts for peak hours / night |
| **P1** | **Actual route distance (Mapbox)** | Medium | Replaces haversine guessing |
| **P1** | **Rider distance to pickup** | Low | Better rider matching + fair compensation |
| **P1** | **Cross-zone / out-of-zone premium** | Low | Compensates for deadhead return |

### Tier 2 — Should Have (Growth Features)

Implement as the platform scales:

| Priority | Factor | Effort | Impact |
|----------|--------|--------|--------|
| **P2** | Express/priority delivery | Medium | Revenue booster, client willingness to pay |
| **P2** | Package weight/dimensions | Low | Better cost accuracy for heavy items |
| **P2** | Promo codes / referral discounts | Medium | Marketing & growth lever |
| **P2** | Order batching / pooled delivery | High | Efficiency gains for business clients |
| **P2** | Weather-based pricing | Medium | Rainy season rider retention |
| **P2** | Business volume discounts | Low | B2B acquisition |

### Tier 3 — Nice to Have (Maturity Features)

| Priority | Factor | Effort | Impact |
|----------|--------|--------|--------|
| **P3** | Rider rating premium | Low | Incentivizes quality |
| **P3** | Client loyalty rewards | Medium | Retention |
| **P3** | Subscription tiers | High | Predictable revenue |
| **P3** | Insurance add-on | Medium | High-value package protection |
| **P3** | Vehicle type pricing | High | Only when adding cars/bicycles |
| **P3** | Round-trip pricing | Low | New order type |

---

## PART 4: PRICING FLOW — WHEN EACH FACTOR APPLIES

### Phase 1: Estimate (Client Requests Quote)

```
Client enters: pickup, dropoff, package type, [stops], [schedule]
                           │
                           ▼
              ┌─────────────────────────┐
              │ STATIC FACTORS          │
              │ • Base fare (zone)      │
              │ • Distance (haversine)  │
              │ • Road factor           │
              │ • Package multiplier    │
              │ • Multi-stop surcharge  │
              │ • Schedule discount     │
              │ • Service fee (10%)     │
              │ • Minimum fare check    │
              └────────┬────────────────┘
                       │
              ┌────────▼────────────────┐
              │ SHOULD ADD              │
              │ • Real route distance   │
              │ • Time-of-day factor    │
              │ • Weather factor        │
              │ • Cross-zone premium    │
              │ • Express option        │
              │ • Weight surcharge      │
              │ • Payment method fee    │
              │ • Promo code discount   │
              └────────┬────────────────┘
                       │
                       ▼
              ┌─────────────────────────┐
              │ DYNAMIC FACTORS         │
              │ • Surge (demand/supply) │
              │ • Rider availability    │
              │ • Queue depth           │
              └────────┬────────────────┘
                       │
                       ▼
              Quoted Price (locked for X minutes)
```

### Phase 2: Rider Acceptance (Job Offered to Rider)

```
              Quoted Price from Phase 1
                       │
                       ▼
              ┌─────────────────────────┐
              │ RIDER-SIDE FACTORS      │
              │ • Distance to pickup    │
              │ • Rider's earnings so   │
              │   far today (guarantee) │
              │ • Client rating         │
              │ • Estimated total time  │
              │ • Rider preference match│
              │ • Fatigue check (hours) │
              └────────┬────────────────┘
                       │
                       ▼
              Show rider: earnings, distance, ETA
              Rider accepts or declines
                       │
              ┌────────▼────────────────┐
              │ IF DECLINED REPEATEDLY  │
              │ • Increase rider payout │
              │ • Expand search radius  │
              │ • Offer bonus incentive │
              └─────────────────────────┘
```

### Phase 3: Delivery Finalization (At Completion)

```
              Locked Price from Phase 1
                       │
                       ▼
              ┌─────────────────────────┐
              │ ADJUSTMENT FACTORS      │
              │ • Actual distance (GPS) │
              │ • Actual duration       │
              │ • Wait time charges     │
              │   (if > threshold)      │
              │ • Route deviation       │
              │ • Dropoff change mid-   │
              │   ride                  │
              │ • Failed delivery       │
              │   attempt               │
              │ • Partial delivery      │
              └────────┬────────────────┘
                       │
                       ▼
              ┌─────────────────────────┐
              │ POST-DELIVERY           │
              │ • Tip (100% to rider)   │
              │ • Cancellation fee      │
              │ • Level-based commission│
              │   bonus                 │
              │ • Fraud check           │
              └────────┬────────────────┘
                       │
                       ▼
              Final Price (may differ from estimate)
              Rider earnings credited to wallet
```

---

## PART 5: KEY DECISIONS NEEDED

1. **Should we charge for wait time?**  
   Suggestion: Free first 5 minutes at pickup, then GHS 0.50/minute after. Same at dropoff. Displayed to client as "Wait time: X min — GHS Y".

2. **Should we use real route distance?**  
   Suggestion: Use Mapbox for orders over GHS 15 (long distance). Keep haversine for short trips where the error is small. Cache frequent routes.

3. **Should we implement dynamic surge?**  
   Suggestion: Yes, but with transparency. Show "X riders available near you" and explain why surge applies. Cap at 1.8×.

4. **Should payment processing fees be visible?**  
   Suggestion: No — absorb into service fee. But adjust service fee by method: 10% for MoMo, 8% for wallet, 12% for card.

5. **Should price change after ride?**  
   Suggestion: Only for wait time and mid-ride dropoff changes. Never increase the base price after acceptance. If actual distance is 2× estimate due to road closure, platform absorbs the difference.

6. **How to handle out-of-zone drops?**  
   Suggestion: Apply 1.2× "remote area" multiplier for dropoffs outside any active zone. Show rider the premium before acceptance.

---

## Summary: 85 Factors Identified

| Category | Factors | Currently Used | Gap |
|----------|---------|---------------|-----|
| Distance & Route | 12 | 4 | 8 |
| Time & Duration | 10 | 1 | 9 |
| Package | 10 | 1 | 9 |
| Demand & Supply | 8 | 1 | 7 |
| Geographic & Environment | 10 | 1 | 9 |
| Rider | 10 | 1 | 9 |
| Client | 8 | 0 | 8 |
| Order-Specific | 11 | 3 | 8 |
| Platform Costs | 6 | 0 | 6 |
| **Total** | **85** | **12** | **73** |

We're currently pricing with **14% of the factors** that a comprehensive delivery pricing engine should consider. The top 7 priorities (P0/P1) would cover the most impactful gaps with moderate engineering effort.
