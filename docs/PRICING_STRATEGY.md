# Riderguy Pricing Strategy

> **Currency:** Ghana Cedi (GHS) — 1 GHS = 100 pesewas
> **Market:** Motorcycle-based last-mile delivery in urban & peri-urban Ghana
> **Last updated:** March 2026

---

## 1. Pricing Philosophy

Riderguy pricing must balance three competing goals:

1. **Affordability for clients** — Deliveries should be accessible to everyday Ghanaians, not just the upper class. A typical intra-city delivery should cost GHS 8–25.
2. **Fair rider earnings** — After platform commission, a rider should earn enough per delivery to make GHS 150–300+ on a full working day (8–12 deliveries). This beats or matches informal dispatch work.
3. **Platform sustainability** — The commission covers operating costs (servers, SMS/OTP, payment processing, support) and builds toward profitability.

### Competitive Benchmarks (Accra, 2025–2026)

| Service          | Base Fare (GHS) | Per Km (GHS) | Min Fare (GHS) | Commission |
| ---------------- | --------------- | ------------ | --------------- | ---------- |
| Bolt Delivery    | 3.50–5.00       | 1.50–2.50    | 6.00            | 20–25%     |
| Glovo Ghana      | 5.00–8.00       | 2.00–3.00    | 10.00           | 25–30%     |
| Local dispatch   | Flat 10–30      | Negotiated   | 10.00           | N/A        |
| **Riderguy**     | **5.00**        | **2.00**     | **8.00**        | **15%**    |

Riderguy intentionally undercuts on commission (15% vs 20–30%) to attract and retain riders during the growth phase. This can be adjusted per-zone as the business matures.

---

## 2. Price Formula

```
distanceCharge  = distanceKm × perKmRate
subtotal        = (baseFare + distanceCharge) × packageMultiplier × surgeMultiplier
subtotal        = MAX(subtotal, minimumFare)
serviceFee      = ROUND(subtotal × serviceFeeRate)
totalPrice      = subtotal + serviceFee

platformTake    = ROUND(totalPrice × commissionRate)
riderEarnings   = totalPrice − platformTake
```

All values are in **GHS** (e.g., 5.00 = five cedis). Stored as `Decimal` in the database. Converted to **pesewas** (× 100) only at the Paystack payment gateway boundary.

---

## 3. Platform Default Rates

These apply when a delivery's pickup location falls outside any defined zone polygon.

| Parameter            | Value    | Notes                                     |
| -------------------- | -------- | ----------------------------------------- |
| `baseFare`           | 5.00 GHS | Flat fee — covers rider mobilization      |
| `perKmRate`          | 2.00 GHS | Straight-line distance × this rate        |
| `minimumFare`        | 8.00 GHS | Floor price for very short deliveries     |
| `serviceFeeRate`     | 0.10     | 10% of subtotal — displayed to the client |
| `commissionRate`     | 0.15     | 15% of total — platform's cut             |

### Why these numbers?

- **GHS 5 base fare:** Covers the rider's cost to reach the pickup (fuel, time, wear). Even a 0 km delivery has a cost.
- **GHS 2/km:** A 5 km delivery = 5 + 10 = GHS 15 subtotal → GHS 16.50 total with service fee. This is competitive with Bolt and cheaper than Glovo.
- **GHS 8 minimum:** Ensures even the shortest trip is worth the rider's time. At 15% commission, the rider earns GHS 6.80 minimum.
- **10% service fee:** Transparent platform fee shown separately in the price breakdown. Common practice in the market.
- **15% commission:** Lower than competitors to attract riders. Riders keep 85% of each delivery.

---

## 4. Zone-Based Pricing

Each operational zone (e.g., "Accra Central", "Kumasi", "Tamale") can override the platform defaults. This allows pricing that reflects local economics.

### Recommended Launch Zones

| Zone              | Base Fare | Per Km | Min Fare | Surge | Commission | Rationale                              |
| ----------------- | --------- | ------ | -------- | ----- | ---------- | -------------------------------------- |
| Accra Central     | 5.00      | 2.00   | 8.00     | 1.0   | 15%        | Dense, high demand, short distances    |
| Accra Suburbs     | 6.00      | 2.00   | 9.00     | 1.0   | 15%        | Slightly farther pickup reach          |
| Tema / Tema New   | 5.00      | 1.80   | 8.00     | 1.0   | 15%        | Industrial, moderate density           |
| Kumasi Metro      | 4.50      | 1.80   | 7.00     | 1.0   | 12%        | Lower cost of living, launch incentive |
| Tamale Metro      | 4.00      | 1.50   | 6.00     | 1.0   | 10%        | Lowest cost market, growth zone        |
| Cape Coast        | 4.50      | 1.80   | 7.00     | 1.0   | 12%        | University town, moderate demand       |

Zones outside these areas fall back to platform defaults.

---

## 5. Package Type Multipliers

Different package types carry different handling costs, risk, and liability.

| Package Type    | Multiplier | Example Use Case                          | Rationale                              |
| --------------- | ---------- | ----------------------------------------- | -------------------------------------- |
| `DOCUMENT`      | 1.00       | Letters, contracts, exam scripts          | Lightweight, easy to carry             |
| `SMALL_PARCEL`  | 1.00       | Phone accessories, small online orders    | Standard delivery                      |
| `MEDIUM_PARCEL` | 1.15       | Shoes, boxed electronics, books           | Takes box space, slightly bulkier      |
| `LARGE_PARCEL`  | 1.40       | Appliances, furniture parts               | Limits other jobs, awkward to carry    |
| `FOOD`          | 1.10       | Restaurant orders, groceries              | Time-sensitive, spill risk             |
| `FRAGILE`       | 1.25       | Glass, ceramics, cakes                    | Extra care required, slower riding     |
| `HIGH_VALUE`    | 1.50       | Jewelry, electronics > GHS 500, cash      | Insurance liability, extra verification|

### Example pricing (Accra, no surge):

| Package Type   | 3 km delivery | 8 km delivery | 15 km delivery |
| -------------- | ------------- | ------------- | -------------- |
| DOCUMENT       | GHS 12.10     | GHS 23.10     | GHS 38.50      |
| FOOD           | GHS 13.31     | GHS 25.41     | GHS 42.35      |
| LARGE_PARCEL   | GHS 16.94     | GHS 32.34     | GHS 53.90      |
| HIGH_VALUE     | GHS 18.15     | GHS 34.65     | GHS 57.75      |

*Calculated as: ((5 + distance×2) × multiplier) × 1.10 service fee*

---

## 6. Surge Pricing

Surge applies when demand exceeds rider supply in a zone. It multiplies the subtotal before the service fee.

### Surge Levels

| Level     | Multiplier | Trigger Condition                                            |
| --------- | ---------- | ------------------------------------------------------------ |
| No surge  | 1.0×       | Normal operations                                            |
| Low       | 1.2×       | Queue ratio > 2:1 (2+ pending orders per available rider)    |
| Medium    | 1.4×       | Queue ratio > 4:1 or peak hours with high demand             |
| High      | 1.6×       | Queue ratio > 6:1 (major events, extreme weather)            |
| Max       | 1.8×       | Emergency cap — never exceed 1.8× to protect affordability   |

### Time-of-Day Surge Guidance

| Time Window      | Typical Surge | Reason                            |
| ---------------- | ------------- | --------------------------------- |
| 06:00 – 08:00    | 1.0–1.2×      | Morning rush, moderate demand     |
| 08:00 – 11:00    | 1.0×          | Normal business hours             |
| 11:00 – 14:00    | 1.0–1.2×      | Lunch delivery peak               |
| 14:00 – 16:00    | 1.0×          | Afternoon lull                    |
| 16:00 – 19:00    | 1.2–1.4×      | Evening rush + dinner deliveries  |
| 19:00 – 22:00    | 1.0–1.2×      | Late evening, declining supply    |
| 22:00 – 06:00    | 1.2–1.4×      | Night premium — fewer riders out  |

**Note:** Surge is set per-zone in the database. The initial implementation uses a static multiplier. Dynamic auto-surge based on queue ratios is a future enhancement.

---

## 7. Distance Calculation

| Method            | Used For                  | Details                                        |
| ----------------- | ------------------------- | ---------------------------------------------- |
| Haversine         | Pricing estimates         | Straight-line GPS distance, fast, no API cost  |
| Mapbox Directions | Route display & ETA       | Actual road distance, used for map polylines   |

**Why Haversine for pricing?** In Ghanaian cities, road distance averages 1.3–1.5× straight-line distance. Rather than burning Mapbox API calls for every estimate, we use Haversine with a built-in **road factor** to approximate real driving distance. This keeps estimates accurate within ±15% while being instant and free.

### Road Distance Factor

```
effectiveDistance = haversineDistance × roadFactor
```

| Zone Type       | Road Factor | Rationale                                                |
| --------------- | ----------- | -------------------------------------------------------- |
| Dense urban     | 1.4         | Grid streets, detours, one-ways (Accra Central, Osu)     |
| Urban           | 1.3         | Standard city roads (most of Accra, Kumasi)              |
| Suburban/Peri   | 1.2         | More direct routes, fewer obstacles                      |
| Highway/Inter   | 1.15        | Long-distance, mostly highway                            |

**Default:** 1.3 (used when zone doesn't specify)

### Estimated Duration

```
durationMinutes = (effectiveDistanceKm / avgSpeedKmh) × 60
avgSpeedKmh = 20 (urban), 25 (suburban), 35 (highway)
minimumDuration = 10 minutes
```

Accra traffic averages 18–25 km/h for motorcycles. We use 20 km/h for urban zones to give realistic ETAs.

---

## 8. Multi-Stop Pricing

When an order includes intermediate stops (e.g., pick up from 2 locations, deliver to 1):

```
totalDistance     = sum of distances between consecutive stops
baseFare          = standardBaseFare + (additionalStops × stopSurcharge)
distanceCharge    = totalDistance × perKmRate
```

| Parameter         | Value    | Notes                                  |
| ----------------- | -------- | -------------------------------------- |
| `stopSurcharge`   | 3.00 GHS | Per additional stop beyond the first   |
| Max stops         | 5        | System limit for planning sanity       |

**Example:** 3-stop route (pickup → stop A → stop B → dropoff), total 12 km:
- baseFare: 5.00 + (2 × 3.00) = GHS 11.00
- distanceCharge: 12 × 2.00 = GHS 24.00
- subtotal: GHS 35.00
- serviceFee: GHS 3.50
- **total: GHS 38.50**

---

## 9. Scheduled Delivery Pricing

| Scenario                  | Modifier | Notes                                     |
| ------------------------- | -------- | ----------------------------------------- |
| Same-day scheduled        | 1.0×     | No change — just reserved time slot       |
| Next-day scheduled        | 0.95×    | 5% discount — helps with rider planning   |
| Recurring (weekly+)       | 0.90×    | 10% discount — guaranteed repeat business |

Scheduled deliveries **never** have surge applied — the price is locked at booking time.

---

## 10. Business Account Pricing

Business clients with verified accounts get volume-based discounts:

| Monthly Volume     | Discount | Effective Commission |
| ------------------ | -------- | -------------------- |
| 1–50 deliveries    | 0%       | 15%                  |
| 51–200 deliveries  | 5%       | 15%                  |
| 201–500 deliveries | 8%       | 15%                  |
| 500+ deliveries    | 12%      | 15%                  |

The discount applies to the subtotal. Commission remains fixed — discounts come from the platform's service fee margin.

---

## 11. Rider Earnings Breakdown

For every GHS 20 delivery (at 15% commission):

| Component           | Amount (GHS) | % of Total |
| -------------------- | ------------ | ---------- |
| Rider earnings       | 17.00        | 85%        |
| Platform commission  | 3.00         | 15%        |
| **Total**            | **20.00**    | **100%**   |

### Daily Earnings Projection (Accra rider)

| Deliveries/Day | Avg Fare (GHS) | Gross Earnings | After Commission | After Fuel (~GHS 30) |
| --------------- | -------------- | -------------- | ---------------- | -------------------- |
| 6 (slow day)    | 18.00          | 108.00         | 91.80            | ~61.80               |
| 10 (normal)     | 18.00          | 180.00         | 153.00           | ~123.00              |
| 14 (busy day)   | 20.00          | 280.00         | 238.00           | ~208.00              |

This positions Riderguy riders to earn GHS 2,000–6,000/month, which is competitive for motorcycle-based work in Ghana.

---

## 12. Payment Processing Fees

Paystack charges are absorbed into the platform commission, **not** passed to the client or rider:

| Method         | Paystack Fee              | Notes                        |
| -------------- | ------------------------- | ---------------------------- |
| Mobile Money   | 1.5% (capped GHS 50)     | Most common in Ghana         |
| Card           | 1.95% + GHS 0.50         | Visa/Mastercard              |
| Bank Transfer  | GHS 10 flat               | Rare for small amounts       |
| Cash           | No processing fee         | Settled in-person            |

---

## 13. Cancellation Fees

| Scenario                          | Fee     | Who Pays |
| --------------------------------- | ------- | -------- |
| Client cancels before assignment  | Free    | —        |
| Client cancels after assignment   | GHS 3   | Client   |
| Client cancels after pickup       | GHS 5   | Client   |
| Rider cancels before pickup       | Free    | —        |
| Rider cancels after pickup        | Penalty | Rider (affects rating)  |

---

## 14. Tipping

Tips are 100% rider earnings — the platform takes 0% commission on tips. Suggested tip amounts shown to clients after delivery:

- GHS 2 | GHS 5 | GHS 10 | Custom amount

---

## 15. Price Display Rules

1. **Always show breakdown** — never just a total. Clients see: base fare, distance charge, package surcharge (if any), surge (if any), service fee, and total.
2. **Round to nearest pesewa** — e.g., GHS 16.47, not GHS 16.4723.
3. **Show surge prominently** — if surge > 1.0×, display a yellow/orange banner: "High demand pricing: 1.4× applied".
4. **Estimates ≠ final** — Label pre-order prices as "Estimated total". The final price is calculated at order creation and locked.
5. **Currency symbol** — Always prefix with "GHS" or "₵", never just a number.
