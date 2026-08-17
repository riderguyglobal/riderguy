# RiderGuy Client App — Complete Rewrite Plan
**Version:** 1.0 | **Date:** 2026-05-25 | **Focus:** UI/UX First

---

## Table of Contents

1. [Current State Audit](#1-current-state-audit)
2. [Design Philosophy & Concept](#2-design-philosophy--concept)
3. [Design System](#3-design-system)
4. [App Architecture & Screen Map](#4-app-architecture--screen-map)
5. [Navigation Structure](#5-navigation-structure)
6. [Onboarding Flow](#6-onboarding-flow)
7. [Home Screen (Dashboard)](#7-home-screen-dashboard)
8. [Send Package Flow](#8-send-package-flow)
9. [Live Tracking Screen](#9-live-tracking-screen)
10. [Orders & History](#10-orders--history)
11. [Wallet & Payments](#11-wallet--payments)
12. [Account & Profile](#12-account--profile)
13. [Notifications](#13-notifications)
14. [Saved Addresses](#14-saved-addresses)
15. [Favorite Riders](#15-favorite-riders)
16. [Scheduled Deliveries](#16-scheduled-deliveries)
17. [Promo Codes & Vouchers](#17-promo-codes--vouchers)
18. [Help & Support](#18-help--support)
19. [Privacy & Security](#19-privacy--security)
20. [Micro-Interactions & Animation Spec](#20-micro-interactions--animation-spec)
21. [PWA & Mobile Specifics](#21-pwa--mobile-specifics)
22. [Accessibility](#22-accessibility)
23. [Empty States & Error States](#23-empty-states--error-states)
24. [Implementation Priority](#24-implementation-priority)

---

## 1. Current State Audit

### What Exists (Complete)
| Screen | Status | Notes |
|--------|--------|-------|
| Auth (login, register, forgot password, PIN, biometric) | ✅ Done | Full flow |
| Dashboard Home | ✅ Done | Map hero + recent orders |
| Quick Send | ✅ Done | Minimal auto-pickup form |
| Full Send Form | ✅ Done | Multi-stop, package types, schedule, promo |
| Order Tracking | ✅ Done | Real-time map, rider card, chat, cancel |
| Rate & Tip | ✅ Done | Stars, review, tip, add to favorites |
| Orders List | ✅ Done | Tab-filtered |
| Notifications List | ✅ Done | Mark read, read-all |
| Saved Addresses | ✅ Done | Full CRUD |
| Favorite Riders | ✅ Done | List + remove |
| Settings shell | ⚠️ Partial | Many items are "Coming soon" dead ends |

### What Is Missing (Gap Analysis)
| Feature | Priority |
|---------|----------|
| Edit Profile (name, avatar, email) | P1 |
| Payment Methods management | P1 |
| Wallet — balance + transactions | P1 |
| Order Detail / Receipt page | P1 |
| Scheduled Deliveries management | P2 |
| Promo Code redemption page | P2 |
| Notification Preferences | P2 |
| Spending Analytics / History | P2 |
| Help & Support (FAQ + contact) | P2 |
| Privacy & Security (full page) | P3 |
| Onboarding (first-launch flow) | P3 |
| Business account UI | P3 |

### Design Gaps in Current Screens
- Home is sparse — no active-order quick-access widget when a delivery is live
- Settings has dead "Coming soon" taps that frustrate users
- No wallet or balance visible anywhere
- No receipt / invoice UI for completed orders
- No contextual empty states with educating copy
- Nav bar has 4 items; optimal is 5 for coverage without cognitive overload

---

## 2. Design Philosophy & Concept

### Core Concept: "Calm Confidence"
RiderGuy handles something people care about — their stuff moving through the city. The UI must feel:

- **Calm**: No clutter, no anxiety. The user should feel in control at all times.
- **Fast**: Every action completes in 2 taps or fewer. No buried menus.
- **Alive**: Real-time data (map, status) must feel breathing, not static.
- **Trustworthy**: Clear pricing, honest status language, never surprises.

### Design Language Reference Points
The visual grammar sits at the intersection of:
- **Uber Eats** — dominant map, bottom sheet, bottom nav, search bar as CTA
- **Cash App** — big numbers, confident typography, wallet-first thinking
- **Linear** — micro-animation polish, purposeful motion, tight spacing
- **Apple Maps** — floating cards, elevation hierarchy, gesture-native

### Core UX Principles
1. **Map-first on home**: The map is not decoration — it provides spatial context for the city-based service.
2. **One action per screen**: Each screen has one primary action. Never two CTAs fighting.
3. **Progressive disclosure**: Show simple form first (Quick Send), unlock full detail on demand.
4. **Status is never ambiguous**: Every order state has a label, color, icon, and one-line human description.
5. **Price transparency**: Show the full breakdown before any confirmation. No surprises at payment.
6. **Never dead-end**: Every error, empty state, or "coming soon" has a path forward.

---

## 3. Design System

### Color Palette
```
Brand (primary green — already established in codebase):
  brand-50:  #f0fdf4
  brand-100: #dcfce7
  brand-200: #bbf7d0
  brand-300: #86efac
  brand-400: #4ade80
  brand-500: #22c55e   ← main brand / theme color
  brand-600: #16a34a
  brand-700: #15803d   ← established brand color
  brand-800: #166534
  brand-900: #14532d

Accent (amber/gold — for premium/earnings context):
  accent-400: #fbbf24
  accent-500: #f59e0b
  accent-600: #d97706

Surface (neutral grays — already in use):
  surface-50:  #fafafa
  surface-100: #f4f4f5
  surface-200: #e4e4e7
  surface-300: #d4d4d8
  surface-400: #a1a1aa
  surface-500: #71717a
  surface-600: #52525b
  surface-700: #3f3f46
  surface-800: #27272a
  surface-900: #18181b

Status colors:
  success:   #22c55e (brand-500)
  warning:   #f59e0b
  danger:    #ef4444
  info:      #3b82f6

Payment method colors:
  cash:      #16a34a  (green)
  momo:      #f59e0b  (yellow — MTN MoMo visual language)
  card:      #6366f1  (indigo)
  wallet:    #22c55e  (brand)
```

### Typography
```
Font family: Inter (already in use, correct choice — excellent legibility on mobile)

Scale:
  Display:    32px / bold / tracking -0.5px   ← splash, empty state hero
  Heading-1:  24px / bold / tracking -0.3px   ← page titles (h1)
  Heading-2:  20px / bold / tracking -0.2px   ← section titles
  Heading-3:  17px / semibold                 ← card titles, modal headers
  Body-1:     15px / medium                   ← primary reading text
  Body-2:     14px / regular                  ← secondary text
  Caption-1:  12px / medium                   ← labels, meta
  Caption-2:  11px / medium                   ← badges, timestamps
  Micro:      10px / bold                     ← nav labels, tiny badges

Currency display:
  Large price:  28px / extrabold             ← order total, wallet balance
  Inline price: 15px / bold                  ← list items, receipts
```

### Spacing Grid
```
Base unit: 4px (0.25rem)
Micro:     4px      ← icon-text gap
Small:     8px      ← within components
Medium:    12px     ← between siblings
Base:      16px     ← standard padding
Large:     20px     ← section gap
XL:        24px     ← page padding top
XXL:       32px     ← section separators
Page:      20px     ← horizontal page padding (left/right)
```

### Border Radius
```
Pill:    9999px    ← tags, badges, button chips
XL:      24px      ← bottom sheets, large cards
Large:   16px      ← cards, modals
Medium:  12px      ← buttons, inputs, small cards
Small:   8px       ← inner elements, icon wrappers
```

### Elevation / Shadow
```
Flat:      no shadow    ← list items, inline cards
Raised:    0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)   ← hover cards
Float:     0 4px 16px rgba(0,0,0,0.12)                               ← bottom sheet
Pop:       0 8px 32px rgba(0,0,0,0.16)                               ← modals, FABs
Brand:     0 4px 16px rgba(34,197,94,0.3)                            ← primary CTA
```

### Component Tokens

**Button — Primary CTA**
```
Height:       56px (h-14)
Border radius: 16px
Background:   surface-900 (light mode) / surface-100 (dark mode)
Text:         white / bold / 15px
Press anim:   scale(0.97) + shadow reduce (100ms ease-out)
Disabled:     opacity 40%
Brand variant: brand-500 background + shadow-brand
```

**Button — Secondary**
```
Height:       44px (h-11)
Border radius: 12px
Background:   surface-100
Text:         surface-900 / semibold / 14px
```

**Input Field**
```
Height:       52px
Border radius: 14px
Background:   surface-100
Focus ring:   2px inset brand-500/30
Font:         15px / medium
Placeholder:  surface-400
Label:        12px / semibold / surface-400 (above input)
```

**Card**
```
Background:   white
Border:       1px solid surface-100
Border radius: 20px
Padding:      16px
Hover:        background surface-50, slight scale(1.005)
```

**Bottom Sheet**
```
Border radius: 24px 24px 0 0
Background:   white
Drag handle:  32px × 4px / rounded-full / surface-200 / centered
Padding-top:  8px (drag handle above content)
Shadow:       0 -4px 24px rgba(0,0,0,0.1)
```

**Status Badge**
```
Height:       20px
Padding:      0 8px
Border radius: 9999px
Font:         11px / bold
Colors:       per ORDER_STATUS_CONFIG (already defined)
```

---

## 4. App Architecture & Screen Map

```
/
├── (auth)
│   ├── /login                     ← Phone number entry
│   ├── /register                  ← Name + phone + password/PIN
│   ├── /forgot-password           ← OTP reset
│   └── /forgot-pin                ← OTP PIN reset
│
└── (dashboard)
    ├── /dashboard                 ← Home (map hero)
    ├── /dashboard/send            ← Full send form
    ├── /dashboard/quick-send      ← Minimal quick send
    │
    ├── /dashboard/orders          ← Order history list
    ├── /dashboard/orders/[id]     ← Order detail / receipt   ← NEW
    ├── /dashboard/orders/[id]/tracking   ← Live tracking
    ├── /dashboard/orders/[id]/payment    ← Payment confirmation
    └── /dashboard/orders/[id]/rate       ← Rate & tip
    │
    ├── /dashboard/wallet                 ← NEW: Wallet + balance
    ├── /dashboard/wallet/transactions    ← NEW: Transaction history
    ├── /dashboard/wallet/add-funds       ← NEW: Top up flow
    │
    ├── /dashboard/scheduled              ← NEW: Scheduled deliveries list
    ├── /dashboard/scheduled/new          ← NEW: Create scheduled delivery
    ├── /dashboard/scheduled/[id]         ← NEW: Edit/manage scheduled delivery
    │
    ├── /dashboard/promos                 ← NEW: My promo codes
    │
    ├── /dashboard/notifications          ← Notifications list (exists)
    │
    └── /dashboard/settings               ← Account hub
        ├── /dashboard/settings/profile        ← NEW: Edit profile
        ├── /dashboard/settings/payment-methods ← NEW: Saved cards + MoMo
        ├── /dashboard/settings/notifications  ← NEW: Notification preferences
        ├── /dashboard/settings/security       ← Security hub (PIN, biometrics, sessions)
        ├── /dashboard/settings/security/set-pin      (exists)
        ├── /dashboard/settings/security/change-pin   (exists)
        ├── /dashboard/settings/help           ← NEW: Help & FAQ
        ├── /dashboard/settings/help/contact   ← NEW: Contact support
        ├── /dashboard/saved-addresses         (exists)
        └── /dashboard/favorite-riders         (exists)
```

---

## 5. Navigation Structure

### Bottom Navigation Bar
**5 tabs** (current has 4 — adding Wallet as dedicated tab):

```
┌─────────────────────────────────────────────────────┐
│  🏠 Home   📦 Send   🔄 Orders   💰 Wallet   👤 Me  │
└─────────────────────────────────────────────────────┘
```

| Tab | Icon | Route | Badge |
|-----|------|-------|-------|
| Home | Home | /dashboard | Active order pulse dot |
| Send | Package | /dashboard/send | — |
| Orders | ClipboardList | /dashboard/orders | Unread status count |
| Wallet | Wallet | /dashboard/wallet | Pending balance |
| Me | User | /dashboard/settings | — |

**Nav bar design:**
- Frosted glass pill (current design is correct — keep it)
- Active tab: icon scale(1.1) + translate-y(-2px) + brand-500 color + dot indicator bottom
- Inactive: surface-400
- Nav hidden during: live tracking, payment flow, rate page, full-screen modals

### Tab Logic
- **Home** tab: only active on exact `/dashboard` path
- **Send** tab: active on `/dashboard/send` and `/dashboard/quick-send`
- **Orders** tab: active on `/dashboard/orders/**`
- **Wallet** tab: active on `/dashboard/wallet/**`
- **Me** tab: active on `/dashboard/settings/**`

---

## 6. Onboarding Flow

**Trigger**: First login only (stored in localStorage: `rg_onboarded`)

### Screen 1 — Welcome Splash
```
Layout: Full screen, brand gradient (brand-700 → brand-500)
Center content:
  - RiderGuy logo (large, white)
  - Tagline: "Send anything across the city"
  - Sub: "Fast. Safe. Real-time tracking."
Bottom:
  - "Get Started" button (white, fills width, rounded-full)
  - Already have an account? Login link
```

### Screen 2 — Location Permission
```
Layout: White screen, centered illustration
  - City map illustration with pin drop animation
  - Heading: "Allow location access"
  - Body: "We use your location to auto-detect your pickup point and show nearby riders"
  - Two buttons stacked:
      "Allow Location" (primary, brand)
      "Set manually later" (text link, surface-500)
```

### Screen 3 — Notifications Permission
```
Layout: Same pattern as location
  - Bell illustration with gentle ring animation
  - Heading: "Stay updated on your delivery"
  - Body: "Get real-time push notifications when your rider picks up, is nearby, and delivers"
  - Two buttons:
      "Enable Notifications" (primary)
      "Maybe later" (text link)
```

### Screen 4 — Security Setup (PIN)
```
Layout: Same pattern
  - Shield illustration
  - Heading: "Set up quick access"
  - Body: "Create a 6-digit PIN for faster login"
  - Two buttons:
      "Set up PIN" → flows to PIN creation
      "Skip for now" (text link)
```

**Completion**: Animate to Home dashboard with a welcome toast "You're all set, [FirstName]!"

---

## 7. Home Screen (Dashboard)

### Layout (Current is mostly correct — refine it)

```
┌────────────────────────────────┐
│  MAP HERO (52dvh)              │
│  ┌──────────────────────────┐  │
│  │ 👤 Good morning, Jay  🔔 │  │ ← floating glass header
│  └──────────────────────────┘  │
│                                │
│  [Rider location dots on map]  │
│                                │
│  ┌──────────────────────────┐  │  ← Active order widget (only when live)
│  │ 🚴 James is on the way   │  │
│  │ In Transit · 4 min away  │  │
│  └──────────────────────────┘  │
│                                │
└────────────────────────────────┘
│                                │ ← Bottom sheet (-mt-6, rounded-t-3xl)
│ ─────────── drag handle ─────  │
│                                │
│ 🔍  Where are you sending?  → │ ← Search bar CTA (existing)
│                                │
│ ─── Quick Actions ──────────── │
│ [📍 Saved]  [⚡ Express]       │ ← 2 chips
│ [🕐 Schedule] [🎫 Promos]      │
│                                │
│ ─── Recent Destinations ────── │
│  📍 Tema Community 7 Roundab.. │
│  📍 East Legon, Accra          │
│  📍 Airport City               │
│                                │
│ ─── Activity ─────────────────  │
│  #A3F2B1  Delivered  GH₵ 18   │ ← recent order row
│  #B7C3E4  Cancelled  GH₵ —    │
│                                │
└────────────────────────────────┘
```

### New: Active Order Widget
When an order is in an active status (PENDING → AT_DROPOFF), show a persistent floating card over the map:
```
┌──────────────────────────────────────┐
│  🟢 ●  James is picking up your    │
│        package · At Pickup           │
│  [Track Live →]                      │
└──────────────────────────────────────┘
```
- Tapping anywhere on the card navigates to the tracking screen
- Card has a pulsing green left-border indicator
- Hidden when no active order

### Quick Actions Row
4 icon-chip buttons below the search bar:
- **Saved** — navigates to saved addresses (used as quick pickup selection)
- **Express** — opens full send form pre-set to Express mode
- **Schedule** — opens full send form pre-set to RECURRING schedule tab
- **Promos** — navigates to /dashboard/promos

### Recent Destinations
- Top 5 most-used dropoff addresses (derived from order history)
- Tap → goes to Quick Send with that address pre-filled as dropoff
- Shows address label + distance estimate (optional)

### Wallet Peek (below recent, above recent orders)
```
┌──────────────────────────────────┐
│  💳  Wallet Balance               │
│      GH₵ 24.50              → │
└──────────────────────────────────┘
```
- Compact single-line row, tap → /dashboard/wallet
- Only shown if wallet balance > 0

---

## 8. Send Package Flow

### Entry Points
1. **Home search bar** → Quick Send (minimal)
2. **"Send" nav tab** → Full Send form
3. **"Express" quick action** → Full Send (express pre-selected)
4. **"Schedule" quick action** → Full Send (recurring tab open)
5. **Recent destination tap** → Quick Send (dropoff pre-filled)

### Quick Send (Minimal Flow — 3 Steps)

**Step 1: Locations**
```
┌─────────────────────────────────┐
│  ← Quick Send                  │
├─────────────────────────────────┤
│  📍 Your location (auto)        │
│  [Detecting...] / [Address]     │
│                                 │
│  📦 Where to?                   │
│  [Search address...]            │
│                                 │
│  ─── Recent ──────────────────  │
│  📍 Tema Community 7           │
│  📍 East Legon                  │
└─────────────────────────────────┘
Bottom:
  [Show Price →] (disabled until dropoff set)
```

**Step 2: Summary Card (slides up as bottom sheet)**
```
Route:   [Pickup] → [Dropoff]
         2.4 km · ~12 min

Package: Small Parcel  ▾ (change)
Payment: [Cash] [MoMo] [Wallet]

Price breakdown:
  Base fare:          GH₵ 8.00
  Distance (2.4km):   GH₵ 4.80
  Service fee:        GH₵ 1.28
  ─────────────────────────────
  Total:              GH₵ 14.08

[Confirm & Send →]
```

**Step 3: Searching for Rider (transition screen)**
```
Full screen white with:
  - Animated radar/sonar pulse around a motorcycle icon
  - "Finding your rider..." text
  - Estimated wait: "~2 min"
  - [Cancel] link below
→ Automatically transitions to Tracking when rider assigned
```

---

### Full Send Form (Multi-Step — 4 Steps)

**Step 1: Route**
```
┌────────────────────────────────────┐
│  ← Send Package       Step 1/4   │
│  ●━━━━━━━━━━━━━━━━━━━━━━━━○─○─○  │ ← progress
├────────────────────────────────────┤
│  PICKUP                            │
│  [📍 Address search             ] │
│  Contact name (optional)           │
│  Contact phone (optional)          │
│  Pickup notes (optional)           │
│                                    │
│  DROPOFF                           │
│  [📍 Address search             ] │
│  Contact name (optional)           │
│  Contact phone (optional)          │
│  Dropoff notes (optional)          │
│                                    │
│  [+ Add another stop]              │
│                                    │
│  [Show on map]   [Next →]          │
└────────────────────────────────────┘
```

**Step 2: Package Details**
```
│  ← Back               Step 2/4   │
│  ━●━━━━━━━━━━━━━━━━━━━━○─○─○    │
├────────────────────────────────────┤
│  Package type:                     │
│  [📄 Doc] [📦 Small] [📫 Med]    │
│  [🗳️ Large] [🔮 Fragile] [🍜 Food] │
│  [💎 High Value] [📋 Other]       │
│                                    │
│  Weight (optional)                 │
│  [──── kg ────]                   │
│                                    │
│  Photo (optional)                  │
│  [📷 Add photo]                   │
│                                    │
│  Description (optional)            │
│  [Text area]                       │
│                                    │
│  [← Back]           [Next →]      │
└────────────────────────────────────┘
```

**Step 3: Schedule & Delivery Options**
```
│  ← Back               Step 3/4   │
│  ━━━━●━━━━━━━━━━━━━━━━○─○─○    │
├────────────────────────────────────┤
│  When?                             │
│  [Now] [Same Day] [Next Day]       │
│  [Recurring ─ 10% off]            │
│                                    │
│  ── If Recurring: ────────────     │
│  Frequency: [Daily▾] [Weekly▾]    │
│  Time: [09:00 AM ─]               │
│  Days: [M] [T] [W] [T] [F]       │
│                                    │
│  Delivery type:                    │
│  [Standard] [⚡ Express +20%]     │
│                                    │
│  Proof of delivery:                │
│  [Photo] [PIN Code] [Leave at door]│
│                                    │
│  [← Back]           [Next →]      │
└────────────────────────────────────┘
```

**Step 4: Payment & Review**
```
│  ← Back               Step 4/4   │
│  ━━━━━━━━━━━━━━━━━━━●─○─○       │
├────────────────────────────────────┤
│  Payment method:                   │
│  [💵 Cash] [📱 Mobile Money]      │
│  [💳 Card] [💚 Wallet GH₵24.50]  │
│                                    │
│  Promo code (optional)             │
│  [──── ENTER CODE ────] [Apply]   │
│                                    │
│  ── Order Summary ───────────      │
│  Pickup:   Osu, Accra              │
│  Dropoff:  Tema Community 7        │
│  Distance: 12.4 km                 │
│  Package:  Small Parcel            │
│  Schedule: Now                     │
│                                    │
│  ── Price Breakdown ──────────     │
│  Base fare:         GH₵  8.00     │
│  Distance (12.4km): GH₵ 24.80    │
│  Weight surcharge:  GH₵  0.00     │
│  Express:           GH₵  0.00     │
│  Promo discount:   -GH₵  0.00     │
│  Service fee:       GH₵  3.28     │
│  ─────────────────────────────     │
│  Total:             GH₵ 36.08     │
│                                    │
│  [Confirm Order →]                 │
└────────────────────────────────────┘
```

**Order Confirmation Modal (after Confirm)**
```
Bottom sheet slides up:
  ✅ Order Placed!
  Order #A3F2B1
  Finding a rider for you...
  [Track Order →]      [Back to Home]
```

---

## 9. Live Tracking Screen

### Layout (full-screen map with floating cards)
```
┌────────────────────────────────┐
│  MAP (fills screen)            │
│                                │
│  Pickup pin  →  Dropoff pin    │
│  Rider location (moving dot)   │
│  Route polyline                │
│                                │
│  [←]  #A3F2B1              [⋮] │  ← top left back, top right menu
│                                │
│  ┌──────────────────────────┐  │
│  │ 🚴 On The Way  · 4 min   │  │  ← ETA chip, floating over map
│  └──────────────────────────┘  │
└────────────────────────────────┘
│  ─── drag handle ─────────────  │  ← expandable bottom sheet
│                                 │
│  Status timeline:               │
│  ✅ Order placed                │
│  ✅ Rider assigned              │
│  ✅ Picked up                   │
│  → 🔵 In Transit               │  ← current step highlighted
│     ○ Arriving                  │
│     ○ Delivered                 │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 🧑 James Mensah         │   │  ← Rider card
│  │ ⭐ 4.8 · 312 deliveries │   │
│  │ Honda CB125 · AB 5432   │   │
│  │  [📞 Call]  [💬 Chat]   │   │
│  └─────────────────────────┘   │
│                                 │
│  [Cancel Order]    [Pay Cash]  │  ← contextual actions
└─────────────────────────────────┘
```

### Chat Drawer
Slides in from right (or expands the bottom sheet tall):
```
Header: Chat with James
Messages: standard chat bubbles (sender right, rider left)
Input: text field + send button
```
Close: swipe down or back button

### Cancel Flow
Tapping "Cancel Order" opens a bottom sheet:
```
Why are you cancelling?
  ○ Wrong address
  ○ Found another way
  ○ Taking too long
  ○ Other

[Confirm Cancel]   [Keep Order]

Note: "Cancellations after pickup may incur a fee"
```

### Delivery Confirmed Animation
When status → DELIVERED:
```
Full-screen celebration overlay:
  - Confetti particle burst (brand-green + accent-gold)
  - Large ✅ checkmark animates in
  - "Delivered!" heading
  - "Rate your rider" button (primary, brand)
  - "Back to Home" (secondary)
```

---

## 10. Orders & History

### Orders List Screen
**Header**: "My Orders" + filter tabs: All | Active | Completed | Cancelled

**Order row card:**
```
┌──────────────────────────────────────────┐
│  🚴  #A3F2B1            [In Transit 🔵]  │
│      Tema Community 7                    │
│      2 hours ago · GH₵ 36.08            │
│                                    →     │
└──────────────────────────────────────────┘
```
Active orders → tracking page. Completed → order detail. Cancelled → order detail.

### Order Detail / Receipt Screen (NEW)
For completed and cancelled orders:
```
┌────────────────────────────────────────┐
│  ← Order #A3F2B1         [Share 🔗]   │
├────────────────────────────────────────┤
│  ✅  Delivered                          │
│  May 24, 2026 · 2:34 PM               │
│                                        │
│  ── Route ──────────────────────────   │
│  📍  15 Cantonments Road, Accra        │
│      ↓                                  │
│  📍  Community 7, Tema                 │
│  Distance: 12.4 km                     │
│                                        │
│  ── Rider ──────────────────────────   │
│  🧑  James Mensah                      │
│  ⭐ You rated this 5 stars             │
│                                        │
│  ── Package ────────────────────────   │
│  Small Parcel · No weight declared     │
│  Proof: Photo                          │
│  [View delivery photo]                 │
│                                        │
│  ── Payment ────────────────────────   │
│  Method: Cash                          │
│  Base fare:           GH₵  8.00       │
│  Distance:            GH₵ 24.80       │
│  Service fee:         GH₵  3.28       │
│  ─────────────────────────────────     │
│  Total:               GH₵ 36.08       │
│  Tip:                 GH₵  0.00       │
│                                        │
│  [Reorder to same destination]         │
│  [Download Receipt / Share]            │
└────────────────────────────────────────┘
```

**Reorder** button: pre-fills the Send form with same route + package type.
**Share receipt**: generates a simple receipt card as an image (Web Share API).

---

## 11. Wallet & Payments

### Wallet Home Screen (NEW)
```
┌────────────────────────────────────────┐
│  ← Wallet                              │
├────────────────────────────────────────┤
│  ┌────────────────────────────────┐   │
│  │       💚 Wallet Balance         │   │
│  │                                │   │
│  │       GH₵ 24.50               │   │  ← large balance display
│  │                                │   │
│  │  [+ Add Funds]  [→ Pay]        │   │
│  └────────────────────────────────┘   │
│                                        │
│  ── Quick Stats ─────────────────      │
│  This month: GH₵ 142.00 spent         │
│  3 deliveries                          │
│                                        │
│  ── Transactions ────────────────      │
│  [All] [Deposits] [Payments]           │
│                                        │
│  📦 Order #A3F2B1     -GH₵ 36.08     │
│     May 24 · Cash payment             │
│                                        │
│  💰 Top-up              +GH₵ 50.00    │
│     May 23 · Mobile Money             │
│                                        │
│  📦 Order #B7C3E0     -GH₵ 14.08     │
│     May 22 · Wallet                   │
│                                        │
│  [Load more]                           │
└────────────────────────────────────────┘
```

### Add Funds Screen (NEW)
```
┌────────────────────────────────────────┐
│  ← Add Funds                           │
├────────────────────────────────────────┤
│  Amount                                │
│  [GH₵ ─────────────────────────────] │
│  Quick: [10] [20] [50] [100]           │
│                                        │
│  Pay via:                              │
│  ○ 📱 Mobile Money                    │
│  ○ 💳 Card                            │
│                                        │
│  ── Mobile Money ──────────────────    │
│  Number: [+233 ───────────────────]   │
│  Network: [MTN ▾]                     │
│                                        │
│  [Add GH₵ 50.00]                      │
└────────────────────────────────────────┘
```

### Payment Methods Settings Screen (NEW)
```
┌────────────────────────────────────────┐
│  ← Payment Methods                     │
├────────────────────────────────────────┤
│  Saved Mobile Money                    │
│  ┌────────────────────────────────┐   │
│  │ 📱 MTN MoMo  · +233 24 123 456│   │
│  │ ★ Default                      │   │
│  │          [Edit]    [Remove]    │   │
│  └────────────────────────────────┘   │
│                                        │
│  [+ Add Mobile Money Number]           │
│                                        │
│  Saved Cards                           │
│  ┌────────────────────────────────┐   │
│  │ 💳 Visa · ···· 4242             │   │
│  │ Expires 09/27                  │   │
│  │          [Remove]              │   │
│  └────────────────────────────────┘   │
│                                        │
│  [+ Add New Card]                      │
└────────────────────────────────────────┘
```

---

## 12. Account & Profile

### Settings Hub Screen (Refactored — no more dead-ends)
```
┌────────────────────────────────────────┐
│  Account                               │
├────────────────────────────────────────┤
│  ┌────────────────────────────────┐   │
│  │  [Avatar] Jay Monty          → │   │
│  │           jay@example.com      │   │
│  │           +233 24 123 456      │   │
│  └────────────────────────────────┘   │
│                                        │
│  DELIVERY                              │
│  [📍] Saved Addresses            →    │
│  [❤️] Favorite Riders             →    │
│  [🔄] Scheduled Deliveries        →    │
│  [🎫] Promo Codes                 →    │
│                                        │
│  PAYMENTS                              │
│  [💳] Payment Methods             →    │
│  [💚] Wallet                      →    │
│                                        │
│  PREFERENCES                           │
│  [🔔] Notification Preferences    →    │
│  [🌙] Appearance                  →    │  (inline theme picker, not linked)
│                                        │
│  SECURITY                              │
│  [🔒] PIN Login                   →    │
│  [👆] Biometric                   →    │
│  [📱] Active Sessions             →    │
│                                        │
│  SUPPORT                               │
│  [❓] Help & Support              →    │
│  [📄] Terms & Privacy             →    │
│                                        │
│  [Sign Out]                            │
│  RiderGuy v1.0.0                       │
└────────────────────────────────────────┘
```

Every item links to a real screen. Zero "coming soon" dead-ends.

### Edit Profile Screen (NEW)
```
┌────────────────────────────────────────┐
│  ← Edit Profile         [Save]         │
├────────────────────────────────────────┤
│  [Avatar with camera overlay tap]      │
│                                        │
│  First Name                            │
│  [────────────────────────────────]   │
│                                        │
│  Last Name                             │
│  [────────────────────────────────]   │
│                                        │
│  Email address                         │
│  [────────────────────────────────]   │
│  (requires OTP verification to change) │
│                                        │
│  Phone number                          │
│  [+233 24 123 456]  [Change →]        │
│  (linked to OTP — shown as read-only)  │
└────────────────────────────────────────┘
```

---

## 13. Notifications

### Improvements over current screen

**Current gaps:**
- No grouping by date
- TYPE_ICON mapping uses wrong type keys (ORDER vs ORDER_UPDATE)
- No delete individual notification
- No deep link for PAYMENT type

**Redesigned layout:**
```
┌────────────────────────────────────────┐
│  ← Notifications         [Mark all ✓] │
│  [All] [Unread]                        │
├────────────────────────────────────────┤
│  Today                                 │
│  ┌────────────────────────────────┐   │
│  │ 🔵 📦  Package Delivered!      │   │
│  │    James delivered your parcel │   │
│  │    2h ago              [→]     │   │
│  └────────────────────────────────┘   │
│  ┌────────────────────────────────┐   │
│  │    💰  Top-up Successful       │   │  ← read, dimmed
│  │    GH₵ 50.00 added to wallet   │   │
│  │    4h ago                      │   │
│  └────────────────────────────────┘   │
│                                        │
│  Yesterday                             │
│  ┌─────────────────────────────────┐  │
│  │ 🔵 🔔  Rider Assigned           │  │
│  │    ...                          │  │
│  └─────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**Swipe-to-delete** on individual notifications (right→left reveals red delete button).
**Deep links**:
- ORDER type → tracking or order detail
- PAYMENT type → wallet transactions
- PROMOTION type → /dashboard/promos

---

## 14. Saved Addresses

### Improvements over current screen

Current design is functional but the form UX is poor (no map picker on add/edit).

**Redesigned Add/Edit Address flow:**
```
Step 1: Search
  [🔍 Search address...]
  Recent: East Legon, Accra
          Tema Community 7
          Airport City

Step 2: Map Confirm (full-screen map)
  Crosshair in center
  Instruction: "Drag map to adjust pin position"
  [Confirm Pin →]

Step 3: Label & Details (bottom sheet)
  Label: [Home] [Work] [Other: _____]
  Instructions for rider (optional): [textarea]
  [✓ Set as default address]
  [Save Address]
```

**Address list enhancements:**
- Home and Work addresses pinned to top if they exist
- Quick-use button per address: [Use for Pickup] [Use for Dropoff]

---

## 15. Favorite Riders

### Improvements over current screen

**Send to favorite rider flow:**
- Button on each card: "Request this rider" → opens Quick Send with rider preference embedded in order
- "Recently delivered" date shown per favorite
- Rider availability indicator (🟢 Online / ⚫ Offline) — if API supports it

**Empty state enhancement:**
```
[Heart illustration]
"Save riders you love"
"After a great delivery, tap ❤️ to add that rider to favorites.
They'll get priority matching on future orders."
[Book a delivery →]
```

---

## 16. Scheduled Deliveries

### Scheduled Deliveries List (NEW)
```
┌────────────────────────────────────────┐
│  ← Scheduled Deliveries    [+ New]    │
├────────────────────────────────────────┤
│  Active                                │
│  ┌────────────────────────────────┐   │
│  │ 🔄 Daily Office Supplies       │   │
│  │    Mon–Fri · 9:00 AM           │   │
│  │    Osu → Airport City          │   │
│  │    [Pause] [Edit] [Delete]     │   │
│  └────────────────────────────────┘   │
│                                        │
│  Paused                                │
│  ┌────────────────────────────────┐   │
│  │ ⏸ Weekly Shipment              │   │
│  │    Every Monday · 2:00 PM      │   │
│  │    [Resume] [Edit] [Delete]    │   │
│  └────────────────────────────────┘   │
│                                        │
│  Completed / Expired                   │
│  [collapsed section, expandable]       │
└────────────────────────────────────────┘
```

### Create Scheduled Delivery (NEW)
Uses the same Full Send Form (Step 3 with schedule) but saves it as a template rather than dispatching immediately.

**Additional options (only for recurring):**
- Start date picker
- End date picker (or "Never")
- Max occurrences toggle

---

## 17. Promo Codes & Vouchers

### Promo Code Screen (NEW)
```
┌────────────────────────────────────────┐
│  ← Promo Codes                         │
├────────────────────────────────────────┤
│  ┌────────────────────────────────┐   │
│  │  Enter promo code               │   │
│  │  [─────────────────] [Apply]   │   │
│  └────────────────────────────────┘   │
│                                        │
│  My Active Codes                       │
│  ┌────────────────────────────────┐   │
│  │ 🎫 WELCOME20                   │   │
│  │    20% off your next order     │   │
│  │    Expires Jun 30, 2026        │   │
│  │              [Use in Order →]  │   │
│  └────────────────────────────────┘   │
│                                        │
│  Used Codes                            │
│  [RIDERGUY10 · Used May 20 · -GH₵ 5] │
└────────────────────────────────────────┘
```

**UX note:** Promos applied in the Send Form show the discount immediately in the price breakdown (existing — keep). This screen is for browsing/managing your codes.

---

## 18. Help & Support

### Help Hub Screen (NEW)
```
┌────────────────────────────────────────┐
│  ← Help & Support                      │
├────────────────────────────────────────┤
│  🔍 [Search for help...]               │
│                                        │
│  Common Questions                      │
│  ┌────────────────────────────────┐   │
│  │ How do I track my order?  →    │   │
│  │ What if my package is lost? →  │   │
│  │ How do I cancel an order?  →   │   │
│  │ Payment methods accepted    →  │   │
│  │ How does pricing work?      →  │   │
│  └────────────────────────────────┘   │
│                                        │
│  Still need help?                      │
│  ┌────────────────────────────────┐   │
│  │ 💬  Chat with Support          │   │
│  │     Usually replies in 5 min   │   │
│  └────────────────────────────────┘   │
│  ┌────────────────────────────────┐   │
│  │ 📧  Send us an email           │   │
│  │     support@myriderguy.com     │   │
│  └────────────────────────────────┘   │
│                                        │
│  Useful Links                          │
│  Terms of Service →                   │
│  Privacy Policy →                     │
│  RiderGuy v1.0.0                       │
└────────────────────────────────────────┘
```

**FAQ items** open inline expansion (accordion pattern), no navigation needed.

---

## 19. Privacy & Security

### Security Screen (Upgrade from current)
Currently these exist as separate flows (set-pin, change-pin, biometric in settings). Consolidate:

```
┌────────────────────────────────────────┐
│  ← Security                            │
├────────────────────────────────────────┤
│  ── Login Methods ─────────────────    │
│  [🔒] PIN Login                        │
│       Status: Set ✅ / Not set ✗       │
│       [Change PIN] [Remove PIN]        │
│                                        │
│  [👆] Biometric                        │
│       iPhone — Face ID                 │
│       Added May 20, 2026               │
│       [Remove] [Add another device]    │
│                                        │
│  ── Active Sessions ───────────────    │
│  [📱] iPhone 15 — Accra, GH (Current) │
│  [💻] Chrome on Windows — now         │
│       [Sign out other sessions]        │
│                                        │
│  ── Account ───────────────────────    │
│  [🔑] Change Password                  │
│  [⚠️] Delete Account                   │
└────────────────────────────────────────┘
```

---

## 20. Micro-Interactions & Animation Spec

### Page Transitions
```
Default (push):  slide-in-right 220ms ease-out
Back (pop):      slide-out-right 180ms ease-in
Modal up:        slide-up 300ms spring(stiffness:200, damping:28)
Modal close:     slide-down 200ms ease-in
Tab switch:      fade 150ms ease-out
```

### Component Animations
```
Button press:    scale(0.97) 100ms → scale(1.0) 80ms  (already: btn-press)
Card hover:      scale(1.004) 120ms ease-out
Sheet drag:      spring physics, velocity-aware
Skeleton:        shimmer sweep 1.4s infinite
Status badge:    pulse (if active status) 2s infinite
Map marker:      bounce-in on appear
Confetti:        particle burst on DELIVERED (existing)
Rider chime:     ascending C5-E5-G5-C6 (existing)
```

### Loading States
Every data-loading surface must have a skeleton, never a spinner alone:
```
Order row:    1 skeleton rect (68px tall, full width, rounded-2xl)
Rider card:   circle + 2 rects (name + stats)
Notification: circle + 2 rects
Price:        1 wide rect (28px tall, 60% width)
Balance:      1 rect (36px tall, 40% width)
Map:          grey background with subtle pulse
```

### Success States
```
Profile save:     top toast "Saved ✅" (2.5s, slides from top)
Address added:    top toast "Address saved ✅"
Order placed:     full-screen celebration → tracking
Delivery done:    confetti overlay → rate screen
Promo applied:    price row animates (old price crosses out, new slides in)
Wallet topup:     balance number counts up (spring animation)
```

### Error States
```
Form validation:  field shake (translateX ±4px) + red border + helper text below
API error:        red banner below header, never full-page (unless catastrophic)
Network offline:  persistent top banner "No connection · Changes will sync when back"
```

---

## 21. PWA & Mobile Specifics

### Safe Area Handling
- All headers: `padding-top: env(safe-area-inset-top)` (existing `safe-area-top` class)
- Bottom sheet & nav: `padding-bottom: env(safe-area-inset-bottom)`
- Map views: edge-to-edge, no safe area (content floats over)

### Gesture Support
- **Pull-to-refresh** on orders list, notifications list, wallet transactions
- **Swipe back** (iOS): all detail screens support native back swipe
- **Swipe-to-delete** on notifications, saved addresses, payment methods
- **Bottom sheet drag**: drag handle on all sheets, velocity-based snap

### Viewport Handling
- Use `100dvh` (dynamic viewport height) everywhere — not `100vh` (cuts off on Safari)
- Input fields: prevent page zoom on focus (font-size ≥ 16px on all inputs)
- Keyboard avoidance: bottom sheet CTAs must stay above keyboard (use `visual-viewport` API)

### Offline Support (Service Worker)
Already has SW (`sw.ts`). Ensure:
- Home screen loads (cached shell)
- Recent orders visible offline
- Queue order creation when offline → sync on reconnect
- Show "Offline" indicator in top bar when `navigator.onLine === false`

### Performance Targets
- First Contentful Paint: < 1.5s on 4G
- Time to Interactive: < 3s
- Largest Contentful Paint: < 2.5s
- Maps lazy-loaded (existing `dynamic(..., { ssr: false })` pattern — keep)
- Images: WebP format, next/image with proper sizes
- Fonts: preloaded Inter, display:swap (already configured)

### PWA Install Prompt
On first visit (after second session), show a bottom sheet:
```
"Add RiderGuy to your home screen for a better experience"
[Add to Home Screen]   [Not now]
```
Use the `beforeinstallprompt` event.

---

## 22. Accessibility

### Touch Targets
- Minimum 44×44px for all interactive elements (Apple HIG standard)
- Icon-only buttons must have `aria-label`
- Bottom nav labels are always visible (no icon-only nav)

### Color Contrast
- All body text: ≥ 4.5:1 ratio against background
- Large text (≥ 18px bold): ≥ 3:1 ratio
- Brand green (#22c55e) on white: 2.57:1 — use on colored backgrounds only, never as text color on white
- Status text must not rely on color alone — pair with icon

### Screen Reader Support
- Dynamic status changes: `aria-live="polite"` on order status text
- Map: `aria-hidden="true"` on decorative maps, descriptive text alongside
- Loading states: `aria-busy="true"` on loading regions
- Modal close: `Escape` key closes, focus returns to trigger

### Font Size
- No text below 12px (currently some are 10px — review)
- All inputs: min 16px to prevent iOS zoom

---

## 23. Empty States & Error States

### Principle
Every empty state teaches the user what the feature is and gives them a CTA.

| Screen | Empty State | CTA |
|--------|------------|-----|
| Orders | "No deliveries yet" + "Send your first package today" | "Send Package →" |
| Wallet | "Your wallet is empty" + "Add funds to pay faster" | "Add Funds →" |
| Notifications | "You're all caught up" + "We'll notify you about your deliveries" | — |
| Saved Addresses | "Save addresses for quick order creation" | "Add Address +" |
| Favorite Riders | "Your delivery, your preferred riders" | "Book a delivery →" |
| Scheduled | "No schedules yet" + "Set up recurring deliveries and save 10%" | "Schedule a delivery →" |
| Promos | "No active promo codes" + "Check back for deals!" | — |

### Error States
| Error | Treatment |
|-------|-----------|
| Network error on load | Skeleton → Error card with "Try again" button |
| API 500 | Error banner "Something went wrong · Try again" |
| Location denied | Informational card explaining how to enable + fallback to manual |
| Distance too far | Inline warning below dropoff field "Outside service area" |
| Payment failed | Full-page error with specific reason + retry or choose another method |

---

## 24. Implementation Priority

### Phase 1 — Complete Missing Core (P1)
These screens are promised to users but don't exist. Do these first.

| Screen | File to Create | Effort |
|--------|---------------|--------|
| Order Detail / Receipt | `orders/[id]/page.tsx` (replace stub) | M |
| Edit Profile | `settings/profile/page.tsx` | S |
| Payment Methods | `settings/payment-methods/page.tsx` | M |
| Wallet Home | `wallet/page.tsx` | M |
| Wallet Transactions | `wallet/transactions/page.tsx` | S |
| Add Funds | `wallet/add-funds/page.tsx` | M |

### Phase 2 — Feature Completeness (P2)
| Screen | File to Create | Effort |
|--------|---------------|--------|
| Scheduled Deliveries List | `scheduled/page.tsx` | M |
| Create Scheduled Delivery | `scheduled/new/page.tsx` | L |
| Edit Scheduled Delivery | `scheduled/[id]/page.tsx` | M |
| Promo Codes | `promos/page.tsx` | S |
| Notification Preferences | `settings/notifications/page.tsx` | S |
| Help & Support | `settings/help/page.tsx` | S |

### Phase 3 — Polish & Enhancement (P3)
| Task | Notes |
|------|-------|
| Settings hub redesign | Remove "coming soon" dead-ends, link all items |
| Home: Active order widget | Floating card when delivery is live |
| Home: Recent destinations | Derive from order history |
| Home: Wallet peek | Show balance if non-zero |
| Notifications: date grouping + swipe delete | UX improvement |
| Saved addresses: map picker | Better UX on add/edit |
| Onboarding flow | First-launch only |
| Add 5th nav tab (Wallet) | Layout change |
| PWA install prompt | `beforeinstallprompt` |
| Offline indicator | `navigator.onLine` |
| Pull-to-refresh | React Query `refetch` on gesture |
| Spending analytics widget | In wallet or home |
| Share receipt | Web Share API |
| Reorder button | On order detail |

### Phase 4 — Business Accounts (P3/Later)
- Business account creation flow
- API key management UI
- Bulk order view
- Invoice download

---

## Appendix A: Route → Screen Map (Quick Reference)

```
/dashboard                              → Home (map + recent)
/dashboard/send                         → Full Send Form (4 steps)
/dashboard/quick-send                   → Quick Send (minimal)
/dashboard/orders                       → Orders List (tabs)
/dashboard/orders/[id]                  → Order Detail / Receipt    ← NEW
/dashboard/orders/[id]/tracking         → Live Tracking
/dashboard/orders/[id]/payment          → Payment Confirmation
/dashboard/orders/[id]/rate             → Rate & Tip
/dashboard/wallet                       → Wallet Home              ← NEW
/dashboard/wallet/transactions          → Transaction History       ← NEW
/dashboard/wallet/add-funds             → Add Funds                 ← NEW
/dashboard/scheduled                    → Scheduled Deliveries      ← NEW
/dashboard/scheduled/new                → Create Schedule           ← NEW
/dashboard/scheduled/[id]               → Edit Schedule             ← NEW
/dashboard/promos                       → Promo Codes               ← NEW
/dashboard/notifications                → Notifications
/dashboard/saved-addresses              → Saved Addresses
/dashboard/favorite-riders              → Favorite Riders
/dashboard/settings                     → Account Hub (refactored)
/dashboard/settings/profile             → Edit Profile              ← NEW
/dashboard/settings/payment-methods     → Payment Methods           ← NEW
/dashboard/settings/notifications       → Notification Prefs        ← NEW
/dashboard/settings/security            → Security Hub (upgraded)
/dashboard/settings/security/set-pin    → Set PIN
/dashboard/settings/security/change-pin → Change PIN
/dashboard/settings/help                → Help & FAQ                ← NEW
/dashboard/settings/help/contact        → Contact Support           ← NEW
```

**Total screens: 28** (current: 14, new: 14 additions)
**No backend changes required for Phase 1-2** (all APIs already exist in the backend)

---

*Document end. Backend integration plan follows in a separate document.*
