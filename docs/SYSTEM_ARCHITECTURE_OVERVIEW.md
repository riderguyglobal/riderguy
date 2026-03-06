# RiderGuy — How The System Works

### A Complete Guide for the Project Owner

> **What is RiderGuy?** RiderGuy is a **4-in-1 super-platform** that transforms delivery riding from a disposable gig into a dignified, rewarding career. It gives riders the tools, income, training, community, safety nets, and growth paths they deserve — while giving clients a seamless delivery experience, partners a recruitment engine, and operators total control.

> Most delivery platforms treat riders as interchangeable resources — faceless labor behind an algorithm. RiderGuy is built on a fundamentally different belief: **riders are skilled professionals who deserve more than just job assignments. They deserve careers.**

> RiderGuy wraps everything a rider needs into a single platform: work, income, learning, certification, rewards, community, welfare, safety, and a real path forward. At the same time, businesses get a professional delivery network they can trust, partners get a recruitment and growth engine, and platform operators get powerful tools to manage it all at scale.

> **This isn't just a delivery app. It's the operating system for the rider economy.**

> **Last Updated:** March 2026

---

## Table of Contents

1. [The Big Picture — The Vision](#1-the-big-picture--the-vision)
2. [The Four Apps](#2-the-four-apps)
3. [How a Delivery Works — Step by Step](#3-how-a-delivery-works--step-by-step)
4. [How Pricing Works](#4-how-pricing-works)
5. [How Riders Get Matched to Orders](#5-how-riders-get-matched-to-orders)
6. [How Payments Work](#6-how-payments-work)
7. [The Rider Experience](#7-the-rider-experience)
8. [The Client Experience](#8-the-client-experience)
9. [Real-Time Features](#9-real-time-features)
10. [Security & Login](#10-security--login)
11. [Push Notifications](#11-push-notifications)
12. [The Gamification System](#12-the-gamification-system)
13. [The Community Features](#13-the-community-features)
14. [What Makes RiderGuy Different](#14-what-makes-riderguy-different)
15. [Where Everything Runs](#15-where-everything-runs)
16. [What Has Been Built So Far](#16-what-has-been-built-so-far)
17. [The Road Ahead](#17-the-road-ahead)

---

## 1. The Big Picture — The Vision

RiderGuy exists because the delivery industry has a problem: **riders are treated as disposable.** Other platforms like Bolt and Glovo focus on fulfilling orders — they ask *"How do we deliver more packages?"* RiderGuy asks a different question: ***"How do we build better riders — and a better world for them?"***

That difference shows up in every feature. RiderGuy is not just an app that sends a rider to pick something up. It's a **complete ecosystem** where:

- **Riders build careers, not just earn gig money** — they level up, earn certifications, unlock better commission rates, and build a real professional reputation
- **Community is a first-class feature** — riders chat, mentor each other, attend events, vote on features, and feel like they belong to something bigger
- **Financial tools go beyond just payouts** — riders get wallets, instant earnings, savings goals, expense tracking, and a path toward financial health
- **Safety and welfare matter** — the platform is designed with emergency support, insurance access, gear subsidies, and fatigue detection in mind
- **Partners power growth** — anyone can recruit riders and earn commissions, turning recruitment into a scalable engine
- **Clients get reliability and transparency** — real-time tracking, transparent pricing, proof of delivery, and professional riders who care

### How It Works on Phones

Everything runs in the web browser, which means:
- **No app store needed** — users visit a link and can "install" it to their home screen like a regular app. No Google Play or Apple App Store required.
- **Works on any phone** — Android, iPhone, even basic smartphones with a browser
- **Updates automatically** — no need to download updates from a store. New features appear instantly.
- **Works offline** — if a rider loses internet connection in the field, the app saves their actions and sends them when they reconnect
- **Fast and lightweight** — loads quickly even on slow connections, caches data for speed

This type of app is called a **Progressive Web App (PWA)** — and it's the reason RiderGuy can reach every rider in Ghana regardless of what phone they have.

---

## 2. The Four Apps

RiderGuy is built as **four interconnected platforms under one roof** — each a full product, each feeding into the others. Think of it like one brain powering four different screens, each designed for a different audience.

| App | Who Uses It | What It Does |
|-----|------------|--------------|
| 🛵 **Rider App** | Motorcycle riders who deliver packages | The rider's **complete career companion** — jobs, wallet, training, community, progression, welfare. Everything a rider needs to manage their entire work life, career growth, and community. |
| 📦 **Client App** | People & businesses who need deliveries | Request deliveries, track them live on a map, pay, rate riders — with full transparency at every step |
| ⚙️ **Admin Portal** | Platform managers & operators | The **command center** — full operational control over users, finances, content, fleet, compliance |
| 🌐 **Marketing Website** | The public (potential riders, clients, partners) | The **public identity** — website, landing pages, onboarding funnels, brand presence |

All four apps share a unified system, a single identity system, and a common design language — but each is optimized for its audience. Every interaction in one app creates data and value for the others.

### Who Is RiderGuy For?

| Person | What They Get |
|--------|--------------|
| 🛵 **Riders** | An app to manage their entire work life, career growth, and community |
| 📦 **Clients (Individuals)** | An app to request, track, and pay for deliveries with full transparency |
| 🏢 **Clients (Businesses)** | A dashboard to schedule deliveries, manage integrations, and track performance |
| 🤝 **Referral Partners** | A portal to recruit riders, track commissions, and build recruitment teams |
| 🖥️ **Dispatchers / Operations** | A live command center to coordinate riders and deliveries in real time |
| ⚙️ **Platform Admins** | Full control over the entire ecosystem — users, finances, content, compliance, and settings |

---

## 3. How a Delivery Works — Step by Step

Here's what happens from the moment a client wants to send a package until it arrives:

### Step 1: Client Creates an Order
- The client opens the Client App and taps "Send a Package"
- They enter the **pickup address** and **dropoff address** (the app auto-suggests addresses as they type, powered by Mapbox maps)
- They can also add **extra stops** (up to 5 total) for multi-stop deliveries
- They choose the **package type** (document, small parcel, food, fragile item, large parcel, etc.)
- They can optionally enter the **package weight**, add **special instructions**, upload a **photo of the package**, and enter a **promo code**
- They choose their **payment method** (mobile money, card, cash, or wallet)

### Step 2: Price Estimate
- Before confirming, the client sees a **full price breakdown** showing:
  - Base fare
  - Distance charge
  - Package type surcharge (if any)
  - Surge pricing (if demand is high)
  - Service fee
  - Any discounts (promo code, scheduled delivery discount, business volume discount)
  - **Total price**
  - **Estimated delivery time**
- The client can adjust options and see the price update in real time

### Step 3: Order is Placed
- The client confirms the order
- The system saves it and immediately starts **searching for a rider**

### Step 4: Finding a Rider (Auto-Dispatch)
- The system automatically looks for the **best available rider** nearby (within 8 km of the pickup)
- It scores each rider based on multiple factors (distance, rating, experience, reliability — more on this in Section 5)
- The top-scoring rider receives a **personal job offer** on their phone with all the details
- The rider has **30 seconds** to accept or decline
- If they decline or don't respond, the system moves to the next best rider
- This continues for up to **10 attempts**
- At the same time, the job is **broadcast** to all nearby riders so anyone can grab it from the jobs feed
- If no riders accept after all attempts, the client is notified that no riders are currently available

### Step 5: Rider Accepts the Job
- Once a rider accepts, the order is marked as **Assigned**
- The client gets a notification: "A rider has been assigned to your delivery"
- Both the client and rider can now **see each other on the map** in real time
- They can also **chat with each other** through the app

### Step 6: Pickup
- The rider navigates to the pickup location
- When they arrive, the status changes to "At Pickup"
- The rider confirms they have the package (they can scan a code, take a photo, or enter a PIN)
- Status changes to "Picked Up"

### Step 7: Delivery
- The rider navigates to the dropoff (with turn-by-turn directions on the map)
- The client can **track the rider's exact location** on a live map throughout the journey
- Status updates at each step: "In Transit" → "At Dropoff"

### Step 8: Proof of Delivery
- When the rider arrives, they confirm the delivery with **proof**:
  - **Photo** — take a picture of the delivered package
  - **Signature** — recipient signs on the rider's screen
  - **PIN Code** — recipient provides a delivery PIN
  - **Left at Door** — rider takes a photo showing package left at the location

### Step 9: Order Complete
- Status changes to **"Delivered"**
- The rider's **earnings are instantly added** to their digital wallet
- The rider earns **experience points (XP)** that count toward their level
- If the client paid by mobile money or card, the payment is processed through Paystack
- The client gets a notification: "Your package has been delivered!"

### Step 10: Rating & Tipping
- The client can **rate the rider** (1 to 5 stars)
- They can also leave a **tip** — suggested amounts are GHS 2, GHS 5, GHS 10, or a custom amount
- **100% of tips go to the rider** — the platform takes nothing from tips

### What If Something Goes Wrong?

| Situation | What Happens |
|-----------|-------------|
| **Client cancels before a rider is assigned** | Free cancellation, no charge |
| **Client cancels after rider is assigned** | GHS 3 cancellation fee |
| **Client cancels after pickup** | GHS 5 cancellation fee |
| **Rider can't deliver** (no one at home, wrong address, etc.) | Rider follows a guided process: call client → wait → take photo evidence → mark as failed |
| **Rider cancels** | No fee, but affects their performance rating |
| **Internet drops** | The app saves everything offline and syncs when back online |

---

## 4. How Pricing Works

The pricing system is designed to be **fair for riders** (so they earn a good living), **affordable for clients** (so everyday Ghanaians can use it), and **sustainable for the platform** (to cover operating costs).

### The Basic Formula (Simplified)

> **Total Price = Base Fare + Distance Charge + Any Extras − Any Discounts + Service Fee**

Here's what each part means:

### 4.1 — Base Fare (GHS 5.00)
A flat fee charged on every delivery, regardless of distance. This covers the rider's cost to get to the pickup location (fuel, time, wear on their vehicle). Even a delivery across the street has this cost.

### 4.2 — Distance Charge (GHS 2.00 per km)
The further the delivery, the more the distance charge. The system calculates the distance between pickup and dropoff using GPS coordinates, then adjusts it with a **road factor** (since real roads are never a straight line — you have to go around blocks, turn at intersections, etc.).

| Area Type | Road Factor | What It Means |
|-----------|-------------|--------------|
| Dense city center (e.g., Accra Central) | 1.4× | Roads are 40% longer than a straight line due to one-ways, detours |
| Regular city (most of Accra, Kumasi) | 1.3× | Standard city roads, 30% longer |
| Suburbs | 1.2× | More direct routes |
| Highway/Inter-city | 1.15× | Mostly straight highway |

**Example:** If the GPS straight-line distance is 5 km and the road factor is 1.3, the effective distance is 6.5 km, so the distance charge is 6.5 × GHS 2.00 = GHS 13.00.

When available, the system uses **actual road distance** from Mapbox (a mapping service) instead of the estimate, for better accuracy.

### 4.3 — Package Type Multiplier
Different types of packages cost different amounts because they carry different levels of risk and difficulty:

| Package Type | Price Multiplier | Why |
|-------------|-----------------|-----|
| Document (letters, contracts) | 1.0× (no extra) | Lightweight, easy |
| Small Parcel (phone accessories, small orders) | 1.0× (no extra) | Standard delivery |
| Medium Parcel (shoes, boxed electronics) | 1.15× (+15%) | Bulkier, takes more space |
| Food (restaurant orders, groceries) | 1.10× (+10%) | Time-sensitive, spill risk |
| Fragile (glass, ceramics, cakes) | 1.25× (+25%) | Extra care needed, slower riding |
| Large Parcel (appliances, furniture parts) | 1.40× (+40%) | Heavy, limits other jobs |
| High-Value (jewelry, expensive electronics) | 1.50× (+50%) | Security risk, extra verification needed |

### 4.4 — Weight Surcharge
Heavier packages cost a bit more:

| Weight | Extra Charge |
|--------|-------------|
| 0–5 kg | No extra |
| 5–10 kg | + GHS 2 |
| 10–20 kg | + GHS 5 |
| 20–30 kg | + GHS 10 |

### 4.5 — Surge Pricing (High Demand)
When there are many more orders than available riders (like during rush hour or bad weather), prices go up slightly to encourage more riders to come online. This is capped to keep things fair:

| Demand Level | Price Multiplier | When This Happens |
|-------------|-----------------|-------------------|
| Normal | 1.0× (no change) | Plenty of riders available |
| Slightly busy | 1.2× (+20%) | 2+ orders per available rider |
| Busy | 1.4× (+40%) | 4+ orders per rider |
| Very busy | 1.6× (+60%) | 6+ orders per rider (major events, storms) |
| Maximum cap | 1.8× (+80%) | Never goes above this — protects affordability |

### 4.6 — Time of Day
Certain times of day cost slightly more because of traffic or because fewer riders are available:

| Time | Multiplier | Reason |
|------|-----------|--------|
| Normal hours | 1.0× | Standard pricing |
| Lunch rush (11am–2pm) | 1.10× (+10%) | High food delivery demand |
| Evening rush (4pm–7pm) | 1.15× (+15%) | Traffic + dinner deliveries |
| Late evening (7pm–10pm) | 1.05× (+5%) | Slightly fewer riders |
| Night (10pm–6am) | 1.20× (+20%) | Premium for late-night service |

### 4.7 — Weather
Bad weather means slower, riskier riding:

| Weather | Multiplier |
|---------|-----------|
| Clear / Cloudy | 1.0× (no change) |
| Light Rain | 1.10× (+10%) |
| Heavy Rain | 1.25× (+25%) |
| Storm | 1.40× (+40%) |

### 4.8 — Multi-Stop Surcharge
Each extra stop beyond the standard pickup→dropoff adds **GHS 3.00**. Maximum 5 stops per order.

### 4.9 — Express Delivery
If a client wants express (priority) delivery, it's **1.5× the normal price** — but only available for distances under 15 km.

### 4.10 — Service Fee
A transparent platform fee shown separately in the breakdown. It varies by payment method:
- **Wallet:** 8%
- **Mobile Money:** 10%
- **Cash:** 10%
- **Card:** 12%

### 4.11 — Minimum Fare
No delivery costs less than **GHS 8.00**, no matter how short the distance. This ensures every trip is worth the rider's time.

### 4.12 — Discounts Built Into the System

| Discount | Amount | How It Works |
|----------|--------|-------------|
| **Scheduled delivery (next day)** | 5% off | Booking ahead helps the platform plan riders |
| **Recurring delivery (weekly+)** | 10% off | Guaranteed repeat business for riders |
| **Business volume (51+ orders/month)** | 5% off | Reward for frequent business clients |
| **Business volume (201+ orders/month)** | 8% off | Bigger volume, bigger discount |
| **Business volume (500+ orders/month)** | 12% off | Major accounts get the best rate |
| **Promo codes** | Varies | Percentage or flat discounts, can be targeted by zone or package type |

### Zone-Based Pricing
Different cities have different costs of living, so pricing adapts per area:

| Zone | Base Fare | Per Km Rate | Minimum Fare | Commission |
|------|-----------|------------|--------------|------------|
| Accra Central | GHS 5.00 | GHS 2.00 | GHS 8.00 | 15% |
| Accra Suburbs | GHS 6.00 | GHS 2.00 | GHS 9.00 | 15% |
| Tema | GHS 5.00 | GHS 1.80 | GHS 8.00 | 15% |
| Kumasi | GHS 4.50 | GHS 1.80 | GHS 7.00 | 12% |
| Tamale | GHS 4.00 | GHS 1.50 | GHS 6.00 | 10% |
| Cape Coast | GHS 4.50 | GHS 1.80 | GHS 7.00 | 12% |

### A Real Example

**Scenario:** A client in Accra Central sends a medium parcel 8 km away during evening rush hour, paying with mobile money, no promo code.

| Component | Calculation | Amount |
|-----------|------------|--------|
| Base Fare | Fixed | GHS 5.00 |
| Distance | 8 km × 1.3 (road factor) = 10.4 km × GHS 2.00 | GHS 20.80 |
| Subtotal so far | | GHS 25.80 |
| Medium Parcel (×1.15) | GHS 25.80 × 1.15 | GHS 29.67 |
| Evening Rush (×1.15) | GHS 29.67 × 1.15 | GHS 34.12 |
| Service Fee (10%) | GHS 34.12 × 0.10 | GHS 3.41 |
| **Total Price** | | **GHS 37.53** |
| Platform Commission (15%) | GHS 37.53 × 0.15 | GHS 5.63 |
| **Rider Earnings** | GHS 37.53 − GHS 5.63 | **GHS 31.90** |

### How Much Do Riders Earn?

| Day Type | Deliveries | Average Fare | Gross Earnings | After Commission (85%) | After Fuel (~GHS 30) |
|----------|-----------|-------------|---------------|----------------------|---------------------|
| Slow day | 6 | GHS 18 | GHS 108 | GHS 91.80 | ~GHS 62 |
| Normal day | 10 | GHS 18 | GHS 180 | GHS 153 | ~GHS 123 |
| Busy day | 14 | GHS 20 | GHS 280 | GHS 238 | ~GHS 208 |

This puts riders at **GHS 2,000–6,000 per month**, which is competitive for motorcycle-based work in Ghana.

### Why 15% Commission?

RiderGuy charges riders only **15% commission** — compared to 20–30% charged by competitors like Bolt and Glovo. This means riders keep **85%** of every delivery. The lower commission is intentional to attract and keep the best riders.

---

## 5. How Riders Get Matched to Orders

When a new order comes in, the system doesn't just pick the closest rider — it uses a **smart scoring system** that considers multiple factors to find the best rider for each job.

### The Scoring Factors

| Factor | Weight (Importance) | What It Measures |
|--------|-------------------|-----------------|
| **Distance to pickup** | 40% | How close the rider is — closer is better |
| **Customer rating** | 20% | Average star rating from past deliveries |
| **Completion rate** | 15% | How often they successfully complete accepted jobs |
| **On-time rate** | 10% | How often they deliver within the estimated time |
| **Experience** | 10% | Total number of completed deliveries |
| **GPS freshness** | 5% | How recently the system received their location (ensures the rider's phone is active) |

### How the Matching Process Works

1. **Order comes in** → System switches it to "Searching for Rider"
2. **Finds nearby riders** → Looks for riders who are online, within 8 km, and have fresh GPS data (updated within the last 10 minutes)
3. **Scores each rider** → Calculates a total score using the factors above
4. **Sends offer to the top rider** → The best-scoring rider gets a personal notification with full job details
5. **30-second window** → The rider has 30 seconds to accept or decline
6. **If declined or no response** → System moves to the next best rider
7. **Up to 10 attempts** → Tries up to 10 different riders
8. **Broadcast** → The job is also shown to all nearby riders in the "Available Jobs" feed so anyone can grab it
9. **If no one accepts** → The client is notified that no riders are currently available, and the order stays open for manual pickup

### Rider Pickup Compensation
If the system assigns a rider who is far from the pickup location, the platform adds extra pay to compensate for the travel. This extra cost is not charged to the client — the platform absorbs it.

---

## 6. How Payments Work

### Payment Methods Available
- **Mobile Money** — MTN MoMo, Vodafone Cash, AirtelTigo Money (most popular in Ghana)
- **Debit/Credit Card** — Visa, Mastercard
- **Cash** — Paid directly to the rider
- **Wallet** — Prepaid balance in the client's app wallet

### Payment Flow (Mobile Money & Card)
1. Client places an order and selects mobile money or card
2. After delivery, the client is directed to a **Paystack** payment page (Paystack is Ghana's leading payment processor)
3. Payment is processed securely
4. Paystack confirms the payment through a secure callback
5. The rider's earnings are credited to their **in-app wallet**

### Rider Payouts
- Riders earn money directly to their **digital wallet** inside the app after each delivery
- They can view their **full earnings history** — broken down by day, week, or month
- They can **withdraw** to their bank account or mobile money at any time
- Withdrawals go through an **admin approval process** for security
- Once approved, the payout is sent via Paystack's transfer system

### Platform Earnings
For every delivery, the platform earns the **commission** (typically 15% of the total). The rider keeps the remaining 85%.

**Payment processing fees** (charged by Paystack) are absorbed by the platform — they are NOT passed on to clients or riders.

### Cancellation Fees

| Situation | Fee |
|-----------|-----|
| Client cancels before rider is assigned | Free |
| Client cancels after rider is assigned | GHS 3 |
| Client cancels after package picked up | GHS 5 |
| Rider cancels before pickup | Free (but affects rating) |

---

## 7. The Rider Experience

### Getting Started as a Rider

1. **Sign Up** — Enter phone number, get a verification code (OTP), create an account
2. **Upload Documents** — National ID, driver's license, vehicle registration, insurance, proof of address, selfie
3. **Register Vehicle** — Enter vehicle details, upload photos (front, back, left, right)
4. **Admin Review** — The platform team reviews the application and documents
5. **Approval** — Once approved, the rider's account is activated
6. **Set Up Security** — Create a PIN for quick login, optionally set up biometric login (fingerprint/face)

### The Rider Dashboard
- **Go Online/Offline toggle** — One tap to start or stop receiving jobs
- **Live Map** — Shows their location and nearby activity
- **Available Jobs Feed** — A stream of available delivery jobs they can browse and accept
- **Earnings Overview** — Real-time wallet balance and earnings breakdown
- **Onboarding Progress** — Checklist showing what steps are complete and what's remaining

### On a Delivery
- **Job details** — See pickup/dropoff locations, distance, estimated earnings, package type, and special instructions before accepting
- **Turn-by-turn navigation** — Integrated maps guide the rider to each location
- **Status updates** — Rider taps through statuses: "En Route to Pickup" → "At Pickup" → "Picked Up" → "In Transit" → "At Dropoff" → "Delivered"
- **Chat** — Can message the client in real time about the delivery
- **Proof of Delivery** — Photo, signature, PIN, or "left at door" confirmation

### Earnings & Wallet
- Earnings are credited **instantly** after each delivery
- Full transaction history with filters
- Tips tracked separately (100% goes to rider)
- Withdrawal to bank or mobile money

### Vehicle Management
- Register multiple vehicles
- Upload photos for each vehicle
- Set a primary (default) vehicle
- Update vehicle details anytime

---

## 8. The Client Experience

### Placing a Delivery
- **Smart address search** — Start typing and the app suggests addresses (powered by Mapbox)
- **Plus Code support** — For locations without a street address (common in many parts of Ghana), clients can use Google Plus Codes
- **Multiple stops** — Add up to 5 stops in a single delivery route
- **Price transparency** — See exactly how the price is calculated before confirming
- **Package photo** — Upload a picture so the rider knows what to expect
- **Promo codes** — Enter discount codes for reduced pricing

### Live Tracking
- **Real-time map** — Watch the rider's exact location as they pick up and deliver
- **Status notifications** — Get alerts at every step (rider assigned, package picked up, arriving, delivered)
- **In-app chat** — Communicate with the rider directly
- **Estimated arrival time** — Live countdown to delivery

### Order History
- Full list of past and active orders
- See delivery details, proof of delivery photos, and receipts
- Rate past deliveries

### Settings
- Manage profile information
- Set up or remove biometric login (fingerprint/face)
- Manage security PIN
- View active sessions and sign out of other devices

---

## 9. Real-Time Features

The system uses **live connections** (WebSocket technology) to keep everything updated in real time. Here's what happens live, without the user needing to refresh:

### For Clients
- **Rider's location on the map** — Updates every few seconds during a delivery
- **Order status changes** — Instant notification when the rider picks up, is in transit, or delivers
- **Chat messages** — Real-time messaging with the rider
- **New delivery notifications** — When a rider is assigned, when they're nearby, when they deliver

### For Riders
- **New job offers** — Appear instantly on screen with all details and a 30-second timer
- **Job broadcasts** — Available jobs from nearby clients show up in real time
- **Order status updates** — When a client cancels or when admin reassigns
- **Chat messages** — Real-time messaging with the client
- **Community chat** — Live chat rooms for riders in the same zone

### How the Live Connection Works
- When a rider or client opens the app, it creates a persistent connection to the server
- The rider's location is sent to the server every few seconds
- The server pushes updates to all relevant parties instantly
- If the connection drops (e.g., entering a tunnel), the app automatically reconnects
- If the app is closed or backgrounded, **push notifications** take over (see next section)
- A **heartbeat system** monitors connection quality and adapts — sending updates more or less frequently depending on network conditions

### Rider Presence System
The system tracks whether each rider is truly available in real time:
- Riders send a "heartbeat" signal regularly to confirm they're active
- If a rider's heartbeat stops for more than 2 minutes, their connection quality degrades
- After 5 minutes of no signal, they're automatically set to offline
- This prevents "ghost riders" — riders who appear online but aren't actually available
- The system syncs presence data to the database every 60 seconds for reliability

---

## 10. Security & Login

### Multiple Login Methods
Riders and clients have several ways to log in, in order of convenience:

1. **Biometric Login (Fingerprint/Face)** — The fastest way. Uses the phone's built-in fingerprint scanner or face recognition. One tap and you're in.
2. **PIN Login** — A 4-digit PIN the user sets up. Quick and works on all phones.
3. **Password Login** — Traditional email + password (supported but not the default flow).
4. **OTP Login** — Enter phone number, receive a 6-digit code via SMS, enter it. Used for first-time setup and account recovery.

### How Account Security Works
- When a user logs in, they receive two special security tokens:
  - An **access token** (valid for 15 minutes) — used for every action in the app
  - A **refresh token** (valid for 30 days) — used to get a new access token without re-logging in
- This means users stay logged in for up to 30 days without needing to enter credentials again
- Each login session is tied to a specific device
- Users can see all their active sessions and sign out of any device remotely
- Suspicious accounts can be suspended or banned by admins — suspended users cannot refresh their tokens

### Phone Number Verification (OTP)
- Verification codes are sent via **mNotify** (a Ghanaian SMS gateway)
- Codes are 6 digits and valid for 5 minutes
- Rate-limited to prevent abuse (max 10 attempts per minute per phone number)

### Account Roles
A single user account can have **multiple roles** — for example, someone could be both a rider and a client. The system tracks all roles and grants appropriate access for each.

| Role | Access |
|------|--------|
| Client | Place and track deliveries |
| Business Client | All client features + business dashboard, volume discounts |
| Rider | Accept deliveries, track earnings, community features |
| Partner | Recruit riders, track commissions |
| Dispatcher | View live operations, manually assign riders |
| Admin | Full platform management |
| Super Admin | Everything, including admin management |

### Account Statuses
| Status | Meaning |
|--------|---------|
| Pending Verification | Just signed up, hasn't completed identity verification |
| Active | Fully verified and operational |
| Suspended | Temporarily disabled (can be reactivated by admin) |
| Deactivated | User chose to deactivate their own account |
| Banned | Permanently blocked from the platform |

---

## 11. Push Notifications

Even when the app is closed, users receive important updates through push notifications on their phone:

### What Triggers Notifications

**For Clients:**
- Rider assigned to their order
- Rider has picked up the package
- Rider is approaching the dropoff
- Package delivered
- Order cancelled

**For Riders:**
- New job offer (personal targeted offer)
- Job broadcast in their area
- Order cancelled by client
- Payment received
- Level up / badge earned
- Community messages

### How It Works
- Push notifications are powered by **Firebase Cloud Messaging (FCM)**, the same system used by most mobile apps
- When a user opens the app, their device registers for notifications
- The server sends notifications to all of a user's registered devices
- If a notification can't be delivered (device token is invalid), the system automatically cleans up stale tokens
- Notifications include the app icon and can take the user directly to the relevant screen when tapped

### Offline Capability
- Both the rider and client apps can **work offline** thanks to their service workers
- If a rider updates their location while offline, the update is saved and sent when internet returns
- If a client checks an order status while offline, they see the most recent data from the cache
- Map tiles are cached so the map still works in areas with poor connectivity

---

## 12. The Gamification System

RiderGuy turns delivery work into a **rewarding career path** with levels, experience points, badges, streaks, and challenges. This isn't just cosmetic — higher levels unlock real benefits like reduced commission rates.

### Experience Points (XP)
Riders earn XP for everything they do on the platform:

| Action | XP Earned |
|--------|----------|
| Complete a delivery | 50 XP |
| On-time delivery | 20 XP |
| Get a 5-star rating | 30 XP |
| Get a 4-star rating | 10 XP |
| First delivery ever | 100 XP |
| Complete a training module | 75 XP |
| Refer a new rider | 100 XP |
| Hit a 7-day streak | 50 XP |
| Hit a 14-day streak | 100 XP |
| Hit a 30-day streak | 1,000 XP |
| Perfect week (all on-time) | 200 XP |

### Rider Levels (7 Tiers)
XP accumulates over a rider's entire career and determines their level:

| Level | Title | XP Required | What It Unlocks |
|-------|-------|------------|-----------------|
| 1 | Rookie | 0 | Basic access, standard jobs |
| 2 | Runner | 500 | Priority job access |
| 3 | Streaker | 2,000 | Streak bonuses, profile flair |
| 4 | Pro | 5,000 | Lower commission rates, premium support |
| 5 | Ace | 12,000 | VIP job access, mentorship eligibility |
| 6 | Captain | 25,000 | Regional leaderboard feature, can create training content |
| 7 | Legend | 50,000 | Platform advisory role, top-tier perks, Legend badge |

### Commission Reduction by Level
Higher-level riders pay **less commission**, meaning they keep more of each delivery:

| Level | Commission Rate | Rider Keeps |
|-------|----------------|------------|
| Rookie (Level 1) | 20% | 80% |
| Runner (Level 2) | 18% | 82% |
| Streaker (Level 3) | 16% | 84% |
| Pro (Level 4) | 15% | 85% |
| Ace (Level 5) | 13% | 87% |
| Captain (Level 6) | 10% | 90% |
| Legend (Level 7) | 8% | 92% |

This gives riders a strong incentive to stay active, maintain high ratings, and grow on the platform.

### Badges
Riders earn badges for achievements like:
- Milestone deliveries (100, 500, 1,000 deliveries)
- Streak achievements (7-day, 30-day, 90-day streaks)
- Training completions
- Community contributions
- Safety records
- Special event participation

### Streaks
The system tracks **consecutive active days**. Each day a rider completes at least one delivery counts toward their streak. Longer streaks earn bonus XP and special badges.

### Challenges
Admins can create time-limited challenges for riders:
- **Daily challenges** — "Complete 5 deliveries by 2pm"
- **Weekly challenges** — "Maintain a 4.8+ rating for 7 days"
- **Monthly challenges** — Bigger goals with bigger rewards
- Challenges award both XP and reward points

### Rewards Store
Riders can spend their accumulated reward points on real rewards — though this part of the system is built and ready for items to be added by administrators.

### Bonus XP Events
Admins can create special time-limited events where all XP earned is multiplied (e.g., "Double XP Weekend").

---

## 13. The Community Features

RiderGuy has a full social platform built into the rider app, creating a sense of community among riders:

### Zone Chat Rooms
- Riders can chat in real time with other riders in their operating zone
- Messages are delivered instantly through the live connection
- Supports text messages, images, voice notes, and system messages
- Members can see who joined or left the room
- Typing indicators show when someone is composing a message

### Discussion Forum
- Riders can create **discussion posts** organized by categories:
  - General, Tips & Tricks, Routes, Vehicle Maintenance, Earnings, Safety, Events, Feature Requests, Off-Topic
- Other riders can **comment**, **upvote**, and engage in discussion
- Helps riders share knowledge and learn from each other

### Events
- Community events can be created (in-person, virtual, or hybrid)
- Riders can **RSVP** to events
- Supports meetups, training sessions, and social gatherings

### Mentorship Program
- Experienced riders (Level 5+) can become **mentors**
- New riders are paired with mentors in the same zone
- The system tracks check-ins between mentors and mentees
- Mentors earn XP and recognition for helping new riders succeed

### Rider Spotlights
- Outstanding riders can be **featured** on the platform
- Spotlights highlight a rider's story, achievements, and contributions

### Feature Requests
- Riders can **suggest new features** for the platform
- Other riders can **upvote** suggestions they like
- The team can update the status of each request (submitted → reviewed → planned → in progress → shipped)

### Content Moderation
- Users can **report** inappropriate content (spam, harassment, hate speech, scams, etc.)
- Admins review reports and can take action (warnings, temporary mutes, bans from community features)

---

## 14. What Makes RiderGuy Different

Most platforms ask: *"How do we fulfil more orders?"*
RiderGuy asks: ***"How do we build better riders — and a better world for them?"***

That difference shows up in every feature:

- **Career, not gig** — Riders level up, earn certifications, unlock perks, and build a portable professional reputation. A rider at Level 7 ("Legend") keeps 92% of every delivery and has advisory influence on the platform.
- **4-in-1 super-platform** — Riders, clients, partners, and admins are all served by one interconnected ecosystem, not separate disconnected tools.
- **Rider-first community** — Community is a core pillar, not an afterthought. Zone chat rooms, forums, mentorship, events, feature requests, and rider spotlights make riders feel like they belong to something bigger.
- **Financial inclusion** — Instant wallets, immediate payouts, savings tools, and financial literacy built right in. No waiting 2 weeks for a paycheck.
- **Welfare & safety nets** — Insurance access, emergency funds, gear subsidies, rest stop networks, panic buttons, fatigue detection — the platform cares about riders as people.
- **Learning & growth** — A full training academy with certifications, specialization tracks, and offline access. Riders can become certified specialists in food delivery, high-value items, medical packages, and more.
- **Partner-driven recruitment** — A multi-tier referral program that scales rider onboarding through incentivized partners. Anyone can recruit riders and earn ongoing commissions.
- **Client experience** — Seamless delivery for individuals and businesses, with real-time tracking, transparent pricing, proof of delivery, and API integrations for business clients.
- **Smart operations** — Intelligent auto-dispatch, demand-based surge pricing, zone management, and real-time presence tracking for operational efficiency.
- **Built for Ghana, built for scale** — PWA technology means no app store gatekeepers, works on any phone, installs instantly, works offline, and updates automatically. This is critical for reaching riders across all of Ghana, including areas with limited internet.
- **Trust & transparency** — Identity verification, audit logs, rider voice features, and transparent pricing breakdowns build trust with all users.

The result: riders are more motivated, more skilled, more loyal, and more supported. Clients get a more reliable, professional delivery network. Partners earn by growing the network. And the platform becomes the **gold standard for how the rider economy should work.**

---

## 15. Where Everything Runs

### The Infrastructure

| Component | Provider | Purpose |
|-----------|----------|---------|
| **Client App** | Vercel | Hosts the client-facing delivery app |
| **Rider App** | Vercel | Hosts the rider-facing app |
| **Marketing Website** | Vercel | Hosts the public website |
| **Admin Portal** | Vercel | Hosts the admin management interface |
| **API Server** | Render | Runs the central system that powers everything |
| **Database** | Neon (PostgreSQL) | Stores all data — users, orders, payments, etc. |
| **Maps & Navigation** | Mapbox | Provides maps, address search, route directions |
| **Payments** | Paystack | Processes mobile money, card payments, and rider payouts |
| **SMS (OTP)** | mNotify | Sends verification codes and important SMS messages |
| **Push Notifications** | Firebase (FCM) | Delivers push notifications to phones |
| **Real-time Updates** | Socket.IO | Powers live tracking, chat, and instant notifications |

### How the Parts Connect

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Client App │    │  Rider App  │    │ Admin Portal│    │  Marketing  │
│  (Vercel)   │    │  (Vercel)   │    │  (Vercel)   │    │  (Vercel)   │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │                  │
       └──────────────────┼──────────────────┼──────────────────┘
                          │
                    ┌─────▼─────┐
                    │  API      │
                    │ Server    │◄──── Real-time connections (Socket.IO)
                    │ (Render)  │
                    └─────┬─────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    ┌─────▼─────┐   ┌─────▼─────┐   ┌────▼────┐
    │ Database  │   │  Paystack  │   │   Maps  │
    │  (Neon)   │   │ (Payments) │   │(Mapbox) │
    └───────────┘   └───────────┘   └─────────┘
```

All four apps connect to the same API server. The API server connects to the database, payment processor, and mapping services. Real-time features (live tracking, chat, notifications) flow through persistent WebSocket connections between the apps and the API server.

---

## 16. What Has Been Built So Far

Here's a summary of everything that is currently implemented and working in the system:

### Fully Built & Working

| Feature Area | Status | Details |
|-------------|--------|---------|
| **User Registration & Login** | ✅ Complete | Phone OTP registration, PIN login, password login, biometric (fingerprint/face) login, forgot PIN flow |
| **Multi-Role Accounts** | ✅ Complete | Users can hold multiple roles (rider + client, etc.) |
| **Session Management** | ✅ Complete | JWT tokens, refresh tokens, device sessions, remote logout |
| **Rider Onboarding** | ✅ Complete | Document upload, selfie, vehicle registration, vehicle photos, admin approval workflow |
| **Order Creation** | ✅ Complete | Full order form with address autocomplete, package type, weight, multi-stop, promo codes, photo upload |
| **Pricing Engine** | ✅ Complete | All 15+ pricing factors (distance, package, surge, time-of-day, weather, weight, multi-stop, express, zone-based, business discounts, promo codes, schedule discounts, cross-zone) |
| **Auto-Dispatch** | ✅ Complete | Multi-factor rider scoring, targeted job offers, 30-second acceptance window, up to 10 attempts, broadcast fallback |
| **Live Order Tracking** | ✅ Complete | Real-time map, rider location updates, status changes, in-app chat |
| **Order Status System** | ✅ Complete | Full state machine: Pending → Searching → Assigned → Pickup → In Transit → Delivered (plus cancellation and failure flows) |
| **Proof of Delivery** | ✅ Complete | Photo, signature, PIN code, left-at-door confirmation |
| **Rider Earnings & Wallet** | ✅ Complete | Instant earnings credit, transaction history, withdrawal requests |
| **Payment Processing** | ✅ Complete | Paystack integration for mobile money and cards, webhook handling, admin payout approval |
| **Rating & Tipping** | ✅ Complete | 1-5 star ratings, tips (100% to rider), suggested tip amounts |
| **Push Notifications** | ✅ Complete | Firebase FCM, device token management, push on key events |
| **Offline Support** | ✅ Complete | Service workers, location queuing, order status caching, map tile caching |
| **Zones** | ✅ Complete | Zone-based pricing, GeoJSON polygon boundaries, zone-specific settings |
| **Gamification** | ✅ Complete | XP system, 7 rider levels, badges, streaks, challenges, bonus XP events, rewards store |
| **Community** | ✅ Complete | Zone chat rooms, discussion forum, events, mentorship, feature requests, rider spotlights, content moderation |
| **Address Auto-Complete** | ✅ Complete | Mapbox-powered, with Plus Code and Google Maps link support |
| **Rider Presence** | ✅ Complete | In-memory presence tracking, heartbeat system, stale rider cleanup, connection quality monitoring |
| **Connection Health** | ✅ Complete | Adaptive heartbeat that adjusts based on network quality, background detection |
| **Admin Management** | ✅ Complete | Rider application review, order management, financial overview, user management |
| **Security** | ✅ Complete | Rate limiting, input validation, XSS protection, HMAC webhook verification, role-based access control |
| **Promo Codes** | ✅ Complete | Percentage and flat discounts, zone/package targeting, per-user usage limits |
| **Scheduled Deliveries** | ✅ Complete | Future-dated orders with repeat schedules |
| **Saved Addresses** | ✅ Complete | Save frequently used pickup/dropoff locations |
| **Favorite Riders** | ✅ Complete | Mark preferred riders for future orders |

### Database Size
- **41 database models** covering all aspects of the platform
- **25 enums** defining every possible status, type, and category in the system
- **22 API route groups** with 100+ individual endpoints
- **31+ services** handling all business logic

### What's Ready for Future Expansion
The following features are designed in the database and system architecture but not yet fully built in the front-end:

- Training Academy / Learning Management System (LMS)
- Partner recruitment portal and commission tracking
- Business client dashboard with bulk orders and API access
- Advanced admin analytics and reporting
- Rider welfare features (emergency fund, microloans)
- Full marketing website content

---

## 17. The Road Ahead

The platform has been built with a clear growth path in mind. Here's where RiderGuy is heading:

### Phase 2 — Engagement & Intelligence (Next)
- **Full Training Academy** — A complete learning management system where riders take courses, earn certifications, and unlock specialization tracks (food delivery, medical packages, high-value items, etc.)
- **Smart Auto-Dispatch with AI** — Machine learning-based rider matching that gets smarter over time
- **Business Client Dashboard** — Full dashboard for business clients with bulk order uploads, API access, and white-label tracking pages
- **Partner Portal** — Complete partner recruitment dashboard with commission tracking, team management, and marketing materials
- **Advanced Financial Tools** — Savings goals, expense tracking, microloans based on rider earnings history
- **Push Notification Intelligence** — Smart scheduling, A/B testing, and segmented targeting

### Phase 3 — Scale & Optimize
- **AI-Powered Demand Forecasting** — Predict where orders will come from and pre-position riders
- **Dynamic Pricing Intelligence** — Smarter surge pricing based on real-time patterns
- **Multi-Region Support** — Expand beyond Ghana with localization, multi-currency, and regional compliance
- **Fraud Detection** — Advanced security systems to detect GPS spoofing, fake documents, and rating manipulation
- **E-Commerce Integrations** — Connect with Shopify, WooCommerce, and other online stores for automated delivery
- **White-Label Delivery** — Let businesses run their own branded delivery service powered by RiderGuy
- **Rider Welfare Expansion** — Insurance marketplace, vehicle financing partnerships, rest stop network

### Phase 4 — Ecosystem & Dominance
- **Public API Marketplace** — Let other developers build on top of RiderGuy
- **Rider Cooperative Models** — Rider-owned chapters with revenue sharing
- **Cross-Border Delivery** — Expand the network across West Africa
- **RiderGuy Financial Services** — Full financial layer with savings accounts, investment, and insurance
- **RiderGuy Academy as a Standalone Product** — License the training platform to other delivery companies
- **Data & Insights Products** — Anonymized logistics intelligence for businesses and cities
- **Strategic Partnerships** — Vehicle manufacturers, fuel companies, telcos, governments
- **Social Impact Programs** — Youth employment, women in delivery, rural access

The vision is to make RiderGuy the **gold standard for how the rider economy should work** — not just in Ghana, but across Africa and beyond.

---

*RiderGuy — Building the world's most supported rider network, one rider at a time.*
