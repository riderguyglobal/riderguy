# RiderGuy Client App — Full Design Overhaul
**Version:** 1.0 | **Date:** 2026-05-25
**Inspiration:** Uber 2024 · Bolt · Google Maps · Revolut · Grab

---

## The Core Problem with Current Design

The current screens are functional but visually inconsistent and too "web-app" in feeling.
Specific issues:
- Cards use visible borders heavily — creates a "list of boxes" feel instead of breathing layouts
- Colors are used too broadly (surface-100 tinted everything) instead of being purposeful accent moments
- Typography hierarchy is weak — body and heading sizes are too close together
- The map home feels like a map *with* content placed on top, not a true map-first experience
- CTAs are inconsistent heights and weights — some 44px, some 56px, some pill, some rect
- Status badges are pastel-light, low-contrast, and forgettable
- Rider cards are sparse — just text, no visual warmth
- Empty states lack visual character
- The "send form" reads like a web checkout, not a spatial mobile experience

---

## New Design Language: "Bold Calm"

### The Feeling
Uber is black and white with surgical precision. Bolt is green and confident. Google Maps is spatial and layered. We are all three simultaneously — a green-accented, map-native, premium delivery app.

The visual language should say: *"We move things fast. We know what we're doing. You are in control."*

### Three Design Rules
1. **White space is content.** Nothing competes. Every screen has one dominant element and everything else supports it.
2. **Color earns its place.** Green = action taken or primary CTA. Black = authority. Gray = supporting information. Color badges = status only.
3. **Boldness conveys trust.** Big type, heavy CTAs, clear numbers. Never hedge with small, timid UI.

---

## Updated Design System

### Color Usage Rules (Strict)

```
WHITE (#FFFFFF)
  → Page backgrounds, card backgrounds, bottom sheets
  → NEVER use surface-50/surface-100 as a page background
  → surface-50 only for hover states and input fills

BLACK/NEAR-BLACK (surface-900 #18181b)
  → Primary CTA buttons
  → H1 headings, price displays, order numbers
  → Nav icons (active)
  → NEVER use for body copy (use surface-700 or surface-600)

BRAND GREEN (#22c55e)
  → Active nav indicator dot (small, not fill)
  → Live/online status dots
  → Price confirm button (ONLY when confirming a send action)
  → Wallet balance color
  → NEVER as a card background
  → NEVER as a large filled area (kills the premium feel)

SURFACE GRAYS
  surface-100 (#f4f4f5) → input field backgrounds only
  surface-200 (#e4e4e7) → dividers, drag handles
  surface-400 (#a1a1aa) → caption text, placeholder text, secondary icons
  surface-600 (#52525b) → body text (secondary)
  surface-700 (#3f3f46) → body text (primary reading)
  surface-900 (#18181b) → headings, CTAs

STATUS COLORS (used ONLY in status badges and timeline dots)
  Pending/Searching: Amber  #f59e0b on #fffbeb
  Assigned/En Route: Indigo #6366f1 on #eef2ff
  In Transit:        Blue   #3b82f6 on #eff6ff
  Delivered:         Green  #16a34a on #f0fdf4
  Cancelled/Failed:  Red    #ef4444 on #fef2f2
```

### Typography System (Upgraded)

```
DISPLAY      40px / 800 weight / -0.8px tracking
  → Splash screen, empty state hero numbers
  → Example: "GH₵ 24.50" wallet balance

HEADING-1    28px / 700 weight / -0.5px tracking
  → Order total price, confirmation screen
  → Example: "GH₵ 36.08"

HEADING-2    22px / 700 weight / -0.3px tracking
  → Page titles (Account, My Orders)
  → Used only in sticky headers

HEADING-3    18px / 700 weight / -0.2px tracking
  → Section headers, card titles, rider name

BODY-LARGE   16px / 600 weight
  → Primary interactive labels (bottom nav items on active)
  → Address text in route display

BODY         15px / 500 weight
  → Standard reading text, list items

BODY-SMALL   14px / 400 weight
  → Supporting body text

CAPTION      12px / 600 weight / 0.2px tracking / UPPERCASE
  → Section labels ("PICKUP", "PACKAGE", "THIS MONTH")
  → NEVER lowercase for section headers

CAPTION-2    12px / 500 weight
  → Timestamps, meta info

LABEL        11px / 700 weight / 0.3px tracking
  → Nav labels, status badges
  → Use sparingly

Note: Inter is correct. No font change needed.
```

### Spacing & Layout

```
Page horizontal margin: 20px (px-5) — keep existing
Safe inset top:         env(safe-area-inset-top) — keep existing

Section gap:            32px (gap between sections in scroll)
Card internal padding:  20px (p-5) — upgrade from current p-4/p-3
Between list items:     2px gap (extremely tight, Uber-style)
Between sections:       16px (not dividers — use padding)

Dividers: use ONLY mt/mb spacing + zero borders, not border-b lines
  → Exception: tab bars and sticky headers may have a 1px bottom border
```

### Component Design System

---

#### Primary CTA Button (Redesigned)
```
Height:         60px (h-[60px]) — upgrade from 56px
Width:          Full width (100%)
Border radius:  18px
Background:     surface-900 (default) | brand-500 (confirm send ONLY)
Text:           White, 17px, weight 700
Icon:           None (text only — very Uber) OR single right-arrow icon
Shadow:         0 4px 20px rgba(0,0,0,0.15) ← float off the screen
Active state:   scale(0.975) + shadow reduce

DO: "Confirm & Send" / "Continue" / "Save Changes"
DON'T: Two primary CTAs on same screen ever
```

#### Secondary CTA Button
```
Height:         48px
Border radius:  14px
Background:     surface-100
Text:           surface-900, 15px, weight 600
No shadow
```

#### Ghost/Text Button
```
Height:         44px (touch target)
Background:     transparent
Text:           surface-500, 14px, weight 500
Underline on tap, no border
```

#### Input Fields (Redesigned)
```
Height:         54px
Border radius:  14px
Background:     surface-100 (#f4f4f5) — no border
Text:           surface-900, 16px, weight 500 (16px PREVENTS iOS zoom)
Placeholder:    surface-400, 16px
Label above:    12px / 600 / UPPERCASE / surface-400 / 6px gap below label
Focus:          background becomes white + 2px solid surface-900/10 ring
               NO colored focus ring — too Materialish

Icon left:      20px, surface-400 color, 8px gap to text
```

#### Location Input (Special — Uber-style)
```
Container:      White card, shadow-float, rounded-2xl (20px)
Internal line:  Dashed 1.5px surface-200 connecting pickup → dropoff dots
Pickup dot:     8px circle, surface-700 (filled), 3px ring surface-200
Dropoff dot:    8px circle, surface-900 (filled)
Input text:     16px / 600 / surface-900 when filled
Placeholder:    16px / 400 / surface-400
Row height:     52px each
Swap button:    Floats on the right, between the two rows
                32px circle, surface-100 bg, ⇅ icon surface-600
```

#### Cards (Redesigned — no borders)
```
BEFORE: bg-white rounded-2xl border border-surface-100
AFTER:  bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_1px_rgba(0,0,0,0.06)]

Card content padding: p-5 (20px) — not p-3 or p-4
Card title:          18px / 700
Card body:           15px / 500 / surface-600
Card divider:        use py gap between items, not border-b lines
```

#### Status Badge (Redesigned — much bolder)
```
BEFORE: Light pastel background + colored text (e.g., bg-amber-50 text-amber-600)
AFTER:  Solid saturated background + white text

Height:         22px
Padding:        0 10px
Border radius:  9999px (pill)
Font:           11px / 700 / tracking 0.3px / UPPERCASE / white

PENDING:     bg-amber-500  text-white
SEARCHING:   bg-amber-500  text-white
ASSIGNED:    bg-indigo-500 text-white
EN ROUTE:    bg-blue-500   text-white
IN TRANSIT:  bg-blue-500   text-white
AT DROPOFF:  bg-brand-500  text-white
DELIVERED:   bg-brand-600  text-white
CANCELLED:   bg-red-500    text-white
FAILED:      bg-red-500    text-white

→ The contrast shift from pastel-text to solid-white makes status
  immediately scannable in bright sunlight (critical for mobile)
```

#### Bottom Sheet (Upgraded)
```
Border radius:  28px 28px 0 0  (upgrade from current 1.75rem/28px — same, keep)
Background:     white
Shadow:         0 -8px 40px rgba(0,0,0,0.10), 0 -1px 4px rgba(0,0,0,0.05)
Drag handle:    44px × 5px, rounded-full, surface-200, centered, mt-3 mb-2
Content start:  12px below drag handle
Z-index:        40
```

#### Bottom Navigation (Redesigned)
```
BEFORE: Frosted glass pill floating above home indicator
AFTER:  Keep pill concept but upgrade internal design

Container:      mx-4 mb-2 / rounded-2xl / white / shadow-[0_-2px_16px_rgba(0,0,0,0.06)]
Height:         68px (taller than current 64px — more generous touch targets)
Items:          5 tabs (add Wallet)

Active tab:
  → Icon: brand-500, scale(1.1), translate-y(-1px)
  → Label: 11px / 700 / brand-500
  → Background pip: 24px × 3px / brand-500 / rounded-full / below icon (not below label)
  → NO background fill on active (current has bg-brand-500/10 — remove this)

Inactive tab:
  → Icon: surface-400, normal scale
  → Label: 11px / 500 / surface-400

Notification badge (on Orders tab):
  → 6px × 6px solid red dot, top-right of icon (no count — just presence)
```

---

## Screen-by-Screen Redesign

---

### Screen 1: Home Dashboard

**What changes and why:**

The current home has a floating "Good morning, Jay" badge that overlaps the map. The bottom sheet immediately shows a search bar + recent orders — it's fine but doesn't breathe. We want the map to feel dominant and the bottom sheet to feel like it's *surfacing just enough* to invite the next action.

**New Layout:**

```
┌─────────────────────────────────────────────┐
│                                             │
│           MAP (60dvh, full-bleed)           │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  ← (back, only if nested)            │  │  ← top bar: minimal, white/transparent
│  │  [Notification bell, top-right]      │  │     floats OVER map, no background
│  └──────────────────────────────────────┘  │     just the icon with shadow circle
│                                             │
│  ── If active order ─────────────────────  │
│  ┌──────────────────────────────────────┐  │
│  │ 🟢 ·  James · In Transit · ~4 min   │  │  ← flat pill, floating over map
│  │                       [Track →]      │  │     white bg, shadow-float, corners-full
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
│                                             │  ← bottom sheet, -mt-7, z-50
│         ●●●  drag handle                   │
│                                             │
│  ┌──────────────────────────────────────┐  │  ← THE SEARCH BAR (hero CTA)
│  │  🔍  Where are you sending?          │  │     h-[56px], white, shadow-float
│  │                                   →  │  │     rounded-2xl (20px), full-width
│  └──────────────────────────────────────┘  │     text: 16px/600/surface-500 (placeholder)
│                                             │
│  HOME  ·  WORK  ·  [last address short]    │  ← horizontal chip row, tap = quick send
│  (scrollable, icon+label chips)            │
│                                             │
│  ─────── RECENT ──────────────────────     │  ← 12px/700/UPPERCASE/surface-400
│                                             │
│  📍  Tema Community 7 Roundabout  →       │  ← NO card border, just rows
│      used 2 days ago                       │     icon dot (5px, surface-300) left
│                                             │     chevron right (surface-300) right
│  📍  East Legon, Accra               →    │
│      used 4 days ago                       │
│                                             │
│  📍  Accra Mall, Spintex            →     │
│                                             │
└─────────────────────────────────────────────┘
```

**Key visual changes:**
- The greeting ("Good morning, Jay") MOVES INSIDE the bottom sheet header, not floating on the map
  - "Good afternoon" → small 12px/500/surface-400 text above search bar (no badge/card)
- Notification bell: standalone 40px circle, white bg, shadow-float, top-right of map (not in a bar)
- Search bar: the single most prominent element, elevated above the sheet content
- Recent destinations: plain rows, zero borders, just dots and chevrons
- Quick access chips (Home, Work): small pill buttons, surface-100 bg, surface-700 text, icons
- Map shows nearby rider dots in brand-green (existing behavior, keep)
- Active order widget: a slim pill (not a card) floating at bottom of map area

---

### Screen 2: Quick Send

**What changes and why:**

Currently it's a white screen with stacked form fields. Should feel spatial — like you're working on a map. Uber's approach: the map IS the background, the form fields float as a sheet.

**New Layout:**

```
┌─────────────────────────────────────────────┐
│                                             │
│    MAP (preview of route, 45dvh)            │
│    Route polyline appears as addresses fill │
│                                             │
│  [←]                                        │  ← back button: 40px circle, white, shadow
│                                             │
└─────────────────────────────────────────────┘
│  ─── drag ───────────────────────────────   │  ← sheet sits -mt-8 from map
│                                             │
│  ┌──────────────────────────────────────┐  │  ← Location Card (shadow-float, rounded-2xl)
│  │  ●  15 Cantonments Rd, Osu (auto)    │  │     pickup dot: 8px, surface-700
│  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ⇅    │  │     dashed connector line, left-aligned
│  │  ○  Where to?                        │  │     dropoff dot: 8px, surface-900
│  └──────────────────────────────────────┘  │     swap button floats right (⇅ icon)
│                                             │
│  Pay with:                                  │  ← 12px/700/UPPERCASE/surface-400
│  ┌──────┐  ┌──────┐  ┌──────┐             │
│  │ Cash │  │ MoMo │  │Wallet│             │  ← 3 tabs, pill toggle style
│  └──────┘  └──────┘  └──────┘             │     active: surface-900 bg, white text
│                                             │     inactive: surface-100 bg, surface-600 text
│  Recent:                                    │
│  📍 Tema Community 7    →                  │  ← tap pre-fills dropoff
│  📍 East Legon          →                  │
│                                             │
└─────────────────────────────────────────────┘

── Fixed bottom bar (above nav) ──────────────
│  ~ GH₵ 14 · 2.4 km · 12 min               │  ← shows only when dropoff filled
│  ┌──────────────────────────────────────┐  │
│  │           Send Package               │  │  ← 60px, rounded-[18px], surface-900
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Key changes:**
- Map sits behind the form — shows route preview live as user types
- Location inputs are in ONE card (not two separate inputs) — Uber-style connected picker
- Route preview map appears as soon as both addresses are filled
- Swap (⇅) button floats on the right edge of the location card
- Payment method toggle is 3 pills (not buttons stacked vertically)
- Bottom CTA is tall, black, full-width — singular focus

---

### Screen 3: Full Send Form

**What changes and why:**

The current form has a scrollable page with everything on it. Should be broken into clear SPATIAL STEPS with the map always visible.

**New 4-step design:**

**Header (persists across all steps):**
```
┌─────────────────────────────────────────────┐
│ [←]      Send Package              Step 2/4 │
│  ●━━━●━━━━━━━━━━━━━━○─────○─────○          │  ← step dots, brand-500 for completed/current
│                                              │     gray for future. Connected by thin line.
└─────────────────────────────────────────────┘
```

**Step 1 — Route:**
```
┌─────────────────────────────────────────────┐
│  ROUTE                                       │  ← 12px/700/UPPERCASE/surface-400
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  ●  Pickup location                  │   │  ← same connected card style as quick send
│  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ⇅   │   │
│  │  ○  Dropoff destination              │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [+ Add stop]   ← text button, small        │
│                                              │
│  ─── PICKUP CONTACT (OPTIONAL) ───          │
│  Name    [──────────────────────────────]   │
│  Phone   [──────────────────────────────]   │
│  Notes   [──────────────────────────────]   │
│                                              │
│  ─── DROPOFF CONTACT (OPTIONAL) ───         │
│  Name    [──────────────────────────────]   │
│  Phone   [──────────────────────────────]   │
│  Notes   [──────────────────────────────]   │
│                                              │
└─────────────────────────────────────────────┘

── Fixed bottom ──────────────────────────────
│  [Continue →]   (60px, surface-900, full)   │
└─────────────────────────────────────────────┘
```

**Step 2 — Package:**
```
│  WHAT ARE YOU SENDING?                       │  ← 12px/700/UPPERCASE/surface-400
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │    📄    │ │    📦    │ │    📫    │    │  ← Package type tiles
│  │ Document │ │  Small   │ │  Medium  │    │    64px height, rounded-xl
│  └──────────┘ └──────────┘ └──────────┘    │    Active: surface-900 bg + white text
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │    Inactive: surface-50 + surface-700 text
│  │    🗳️    │ │    🔮    │ │    🍜    │    │    emoji 24px, text 12px/600 below
│  │  Large   │ │ Fragile  │ │   Food   │    │
│  └──────────┘ └──────────┘ └──────────┘    │
│  ┌──────────┐ ┌──────────┐                  │
│  │    💎    │ │    📋    │                  │
│  │High Value│ │  Other   │                  │
│  └──────────┘ └──────────┘                  │
│                                              │
│  Weight (optional)                           │
│  [════════════════════]  kg                  │  ← slider OR text input
│                                              │
│  Description  [textarea, 3 rows]            │
│                                              │
│  📷 Add package photo (optional)            │  ← dashed border tile, tap to upload
└─────────────────────────────────────────────┘
```

**Step 3 — Schedule:**
```
│  WHEN?                                       │
│                                              │
│  ┌──────┐ ┌──────────┐ ┌──────────┐         │  ← 3 wide toggle buttons
│  │ Now  │ │Same Day  │ │Next Day  │          │    full-width divided thirds
│  └──────┘ └──────────┘ └──────────┘          │    Active: surface-900/white
│  ┌─────────────────────────────────┐         │
│  │ 🔄 Recurring   Save 10% →       │         │  ← 4th option, has green "Save 10%" badge
│  └─────────────────────────────────┘         │
│                                              │
│  ── If Recurring selected: ─────────        │
│  Frequency:  [Daily ▾]                      │
│  Time:       [09:00 AM ─]                   │
│  Days:       [M] [T] [W] [T] [F] [S] [Su]  │  ← day chips, active = surface-900
│                                              │
│  DELIVERY SPEED                             │
│  ┌────────────────────┐  ┌────────────────┐ │
│  │    Standard        │  │  ⚡ Express    │ │  ← 2 option cards (wider)
│  │    GH₵ 36.08       │  │   +20%        │ │    Active one gets brand-500 left border
│  └────────────────────┘  └────────────────┘ │    (4px left border, subtle)
│                                              │
│  PROOF OF DELIVERY                          │
│  ○ Photo  ○ PIN Code  ○ Leave at door       │  ← radio style (use custom pills)
└─────────────────────────────────────────────┘
```

**Step 4 — Review & Pay:**
```
│  PAYMENT                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐   │
│  │ 💵   │ │ 📱   │ │ 💳   │ │💚 Wallet │   │  ← payment method tiles (4-across)
│  │ Cash │ │ MoMo │ │ Card │ │ GH₵24.50 │   │    Active gets surface-900 fill
│  └──────┘ └──────┘ └──────┘ └──────────┘   │
│                                              │
│  Promo code                                  │
│  [─────────────────────────────] [Apply]    │
│  ✅ WELCOME20 · -GH₵ 7.20 applied          │  ← when applied: green checkmark + amount
│                                              │
│  ORDER SUMMARY                              │  ← 12px/700/UPPERCASE
│  ┌──────────────────────────────────────┐   │
│  │  Osu, Accra          Tema Com. 7     │   │  ← route summary, compact
│  │  ●────────────────────────────●      │   │    dot-line-dot visual
│  │  12.4 km  ·  ~35 min  ·  Small Parcel│  │
│  └──────────────────────────────────────┘   │
│                                              │
│  PRICE                                       │
│  Base fare              GH₵  8.00           │  ← plain rows, no borders
│  Distance (12.4km)      GH₵ 24.80           │     label: surface-600 / 14px
│  Service fee            GH₵  3.28           │     value: surface-900 / 14px/600
│  Promo discount        -GH₵  7.20           │  ← discount in brand-500
│  ───────────────────────────────────        │  ← 1px surface-100 divider
│  Total                  GH₵ 28.88           │  ← 22px/700/surface-900
│                                              │
└─────────────────────────────────────────────┘

── Fixed bottom ──────────────────────────────
│  GH₵ 28.88 · Cash                          │
│  ┌──────────────────────────────────────┐  │  ← brand-500 background (ONLY here)
│  │       Confirm & Send                 │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

### Screen 4: Searching for Rider (New Transition Screen)

**This screen doesn't clearly exist in the current flow — it goes straight from confirm to tracking. Add it.**

```
┌─────────────────────────────────────────────┐
│                                              │
│  [Map in background, blurred 20%]           │
│                                              │
│           ╔═══════════════════╗             │
│           ║                   ║             │  ← white card, rounded-3xl, centered
│           ║   [Radar SVG]     ║             │    radar: concentric rings pulsing outward
│           ║   animated        ║             │    from motorcycle icon in center
│           ║                   ║             │    brand-500 rings, 1.5s pulse
│           ║  Finding your     ║             │
│           ║  rider...         ║             │    heading: 22px/700
│           ║                   ║             │
│           ║  Usually 1-3 min  ║             │    caption: 14px/400/surface-400
│           ║                   ║             │
│           ║  [Cancel Order]   ║             │    link: 14px/500/surface-500 underline
│           ╚═══════════════════╝             │
│                                              │
└─────────────────────────────────────────────┘
```

→ Auto-navigates to tracking when rider assigned (socket event `order:assigned`)
→ Plays the ascending chime (already implemented) + a vibration pulse

---

### Screen 5: Live Tracking (Major Redesign)

**What changes and why:**

The tracking screen is the most critical. This is where the user spends the most emotional time — they're waiting. Every second here matters. Uber/Bolt give you the full map and a highly polished rider card at the bottom.

**New Layout:**

```
┌─────────────────────────────────────────────┐
│                                             │
│  MAP (full screen, edge to edge)            │
│                                             │
│  Pickup pin (●, surface-900 filled)         │
│  Dropoff pin (●, surface-900 filled)        │
│  Rider dot (🟢 pulsing, brand-500)          │
│  Route polyline: dashed surface-400 before  │
│                  pickup, brand-500 after    │
│                                             │
│  ┌─────────────────────────────────────┐   │  ← top bar: glass-light pill
│  │ ←    Order #A3F2B1           [⋮]   │   │    floating over map
│  └─────────────────────────────────────┘   │    ← is back button (40px circle)
│                                             │    ⋮ is options (share, help)
│                                             │
│  ┌───────────────────────┐                 │  ← ETA chip, floats over map
│  │ 🕐 Arriving ~4 min   │                 │    white, shadow-float, rounded-full
│  └───────────────────────┘                 │    14px/700/surface-900
│                                             │
└─────────────────────────────────────────────┘
│  ─── drag handle ──────────────────────────  │  ← bottom sheet
│                                             │
│  Status line                                │
│  ━━━━━●━━━━━━━━━━━━━━━━━━━━ IN TRANSIT    │  ← horizontal progress bar
│  ●    ●    ●    ●    ●    ○    ○           │    filled = brand-500, empty = surface-200
│  Placed Assigned Pickup Transit Arrive Done│    dots below, labels at 10px
│                                             │
│  ─────────────────────────────────────────  │  ← 1px surface-100
│                                             │
│  ┌─────────────────────────────────────┐   │  ← RIDER CARD (redesigned)
│  │  ┌────┐  James Mensah              │   │
│  │  │    │  ⭐ 4.8  ·  312 rides      │   │    Avatar: 52px, rounded-full, ring-2 brand-200
│  │  │ 🧑 │  Honda CB125  ·  AB 5432   │   │    Name: 17px/700/surface-900
│  │  └────┘                            │   │    Rating: 13px/600/surface-600 + filled star
│  │                                    │   │    Vehicle: 12px/500/surface-400
│  │  [📞 Call]            [💬 Chat]    │   │
│  └─────────────────────────────────────┘   │    Call/Chat: 44px pills, surface-100 bg
│                                             │    equal width, centered icons+labels
│  ─────────────────────────────────────────  │
│                                             │
│  📍 Picking up from:                        │  ← 12px/600/surface-400
│     15 Cantonments Road, Osu               │    address: 15px/500/surface-900
│                                             │
│  📍 Delivering to:                          │
│     Community 7, Tema                      │
│                                             │
│  Cash payment · GH₵ 36.08                  │  ← 13px/500/surface-500
│                                             │
│  [Cancel Order]   ←  ghost text button, red, bottom │
└─────────────────────────────────────────────┘
```

**Key changes:**
- Full-screen map (no map+content split — map goes edge-to-edge)
- ETA chip floats over map (white pill, animated countdown when < 2 min)
- Status shown as HORIZONTAL progress bar (not vertical timeline) — more spatial, less scrolly
- Rider card: larger avatar, cleaner layout, better visual hierarchy
- Call/Chat buttons: equal width pills side by side (not icon-only)
- Route shown as: dashed (upcoming leg) → solid brand-500 (completed/active leg)

**Delivered State (celebration):**
```
Full-screen overlay fades in:
Background: brand-500 at 95% opacity (green wash)
Center:
  ✅  (white, 72px, bounce-in animation)
  "Delivered!"  (40px/800/white)
  "Your package reached safely"  (16px/400/white/80% opacity)
  [confetti particles in white + brand-100]

After 2.5s auto-advances OR:
  [Rate your rider]  (white button, surface-900 text)
  [Skip]  (white text, 70% opacity)
```

---

### Screen 6: Rate & Tip (Upgraded)

**New Layout:**

```
┌─────────────────────────────────────────────┐
│  [←]              Rate James               │  ← 17px/700
├─────────────────────────────────────────────┤
│                                             │
│         ┌────────────────────┐             │
│         │                    │             │  ← Rider hero card
│         │   [Avatar 80px]    │             │    centered, rounded-2xl, shadow-float
│         │   James Mensah     │             │    avatar: 80px circle, ring-2 brand-200
│         │   Honda CB125      │             │    name: 20px/700
│         │                    │             │    vehicle: 13px/400/surface-400
│         └────────────────────┘             │
│                                             │
│  How was your delivery?                     │  ← 16px/600/surface-700 centered
│                                             │
│       ★  ★  ★  ★  ★                       │  ← 5 stars, 48px each, spaced 12px
│                                             │    empty: surface-200 (not outline)
│                                             │    filled: amber-400
│                                             │    tap = fill/unfill with spring bounce
│                                             │
│  (After tapping rating):                   │
│  "Excellent! 🎉"  (contextual copy, 14px)  │  ← slides up with animate-scale-in
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Leave a review                             │  ← 13px/600/UPPERCASE/surface-400
│  [tell us what was great or could         ] │
│  [be better...                            ] │  ← 3-row textarea, surface-100 bg
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Add a tip                                  │  ← 13px/600/UPPERCASE/surface-400
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │      │ │GH₵ 2 │ │GH₵ 5 │ │GH₵ 10│      │  ← 4 pill buttons, equal width
│  │ None │ │      │ │      │ │      │      │     active: surface-900/white
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│                                             │
└─────────────────────────────────────────────┘

── Fixed bottom ──────────────────────────────
│  ┌──────────────────────────────────────┐  │
│  │     Submit Rating                    │  │  ← 60px, surface-900, disabled at 0 stars
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**After submit:**
```
Full-screen white with center content:
  ✅ (brand-500, 56px, bounce-in)
  "Thank you!" (28px/700)
  "Your feedback helps us improve" (14px/400/surface-400)
  gap: 32px
  [❤️ Add James to favorites]  (pink-50 bg, pink-500 text, pill)
  gap: 16px
  [Back to Home]  (surface-900 button)
```

---

### Screen 7: Orders List (Upgraded)

**New Layout:**

```
┌─────────────────────────────────────────────┐
│  My Orders                                   │  ← 22px/700, in sticky header
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │  All  │  Active  │ Done  │Cancelled │    │  ← 4-tab bar (add Cancelled tab)
│  └─────────────────────────────────────┘    │     sliding indicator, surface-900 text
└─────────────────────────────────────────────┘

Order cards — ACTIVE:
┌─────────────────────────────────────────────┐
│  ┌───────────────────────────────────────┐  │
│  │ [🟢 pulsing dot]   In Transit         │  │  ← status area: left dot + badge
│  │ #A3F2B1            [IN TRANSIT ●●●]   │  │    badge: solid blue-500/white
│  │                                       │  │
│  │ 📍 Tema Community 7 Roundabout        │  │  ← destination: 15px/600/surface-900
│  │    12.4 km away · ~18 min             │  │    meta: 13px/400/surface-400
│  │                                       │  │
│  │ GH₵ 36.08 · Cash   [Track →]         │  │  ← price + CTA inline
│  │                    ━━━━━━━━━━━━━━━━━  │  │  ← progress bar at card bottom (brand-500)
│  └───────────────────────────────────────┘  │  no border, shadow-float on active orders
└─────────────────────────────────────────────┘

Order cards — COMPLETED:
┌─────────────────────────────────────────────┐
│  ┌───────────────────────────────────────┐  │
│  │  ✓  Delivered                         │  │  ← ✓ green, "Delivered" 13px/600/brand-600
│  │                            2 days ago │  │  ← right-aligned date
│  │  📍 East Legon, Accra                 │  │
│  │     GH₵ 14.08 · Cash                 │  │
│  └───────────────────────────────────────┘  │  ← no shadow (not active), just subtle
└─────────────────────────────────────────────┘
```

**Key changes:**
- Active orders get shadow-float to visually elevate them above completed orders
- Active orders have a horizontal progress bar at the bottom of the card
- Add "Cancelled" as a 4th tab (currently just All/Active/Completed)
- Order number in smaller caption, destination is the HEADLINE
- Completed orders are visually quieter (no shadow, slightly muted)

---

### Screen 8: Order Detail / Receipt (New Screen)

```
┌─────────────────────────────────────────────┐
│  [←]  Order #A3F2B1           [Share 🔗]   │  ← 17px/700
├─────────────────────────────────────────────┤
│                                             │
│  ✅  Delivered                              │  ← 28px checkmark icon, brand-500
│  May 24, 2026 at 2:34 PM                   │  ← 14px/400/surface-400
│  James Mensah  ⭐ 5                        │  ← 14px/600 + filled stars (you gave)
│                                             │
│  ─── ROUTE ────────────────────────────    │  ← 12px/700/UPPERCASE/surface-400
│  ●  15 Cantonments Road, Osu               │  ← 15px/600/surface-900
│  │  ← connector line (4px, dashed, left)  │
│  ●  Community 7, Tema                      │
│     12.4 km · 34 min actual                │  ← 13px/400/surface-400
│                                             │
│  ─── PACKAGE ──────────────────────────    │
│  Small Parcel · 0.8 kg                     │
│  Proof: Photo taken                        │
│  [View photo →]  ← text link, brand-500   │
│                                             │
│  ─── RECEIPT ──────────────────────────    │
│  Base fare              GH₵   8.00         │
│  Distance (12.4 km)     GH₵  24.80         │
│  Service fee (10%)      GH₵   3.28         │
│  Promo: WELCOME20      -GH₵   7.20         │  ← brand-500 color
│  ─────────────────────────────────────     │  ← 1px surface-100
│  Total paid             GH₵  28.88         │  ← 17px/700/surface-900
│  Via: Cash                                 │  ← 13px/400/surface-400
│  Tip: GH₵ 5.00                            │
│                                             │
│  [📤 Share Receipt]  [🔄 Reorder]         │  ← 2 secondary buttons, equal width
└─────────────────────────────────────────────┘
```

---

### Screen 9: Wallet (New Screen)

```
┌─────────────────────────────────────────────┐
│  Wallet                                     │  ← 22px/700
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │                                       │ │  ← Balance card
│  │   Balance                             │ │    bg: surface-900 (dark card — Revolut-style)
│  │                                       │ │    NOT green — reserve green for brand moments
│  │   GH₵ 24.50                           │ │    balance: 40px/800/white
│  │                                       │ │    label "Balance": 12px/600/white/60%
│  │   [+ Add Funds]   [→ Pay with wallet] │ │    buttons: white/20% bg, white text, pill
│  │                                       │ │    card: rounded-3xl (24px)
│  └───────────────────────────────────────┘ │
│                                             │
│  ─── THIS MONTH ───────────────────────    │
│  Spent: GH₵ 142.00   ·   4 deliveries     │  ← mini stats row, 13px
│                                             │
│  TRANSACTIONS                               │  ← 12px/700/UPPERCASE/surface-400
│  [All] [Deposits] [Payments]               │  ← pill tabs
│                                             │
│  ─── TODAY ─────────────────────────────   │  ← date group header: 11px/700/surface-300
│  📦  Order #A3F2B1          -GH₵ 28.88    │
│      Cash payment · 2:34 PM               │
│                                            │
│  ─── YESTERDAY ─────────────────────────   │
│  💰  Top-up                 +GH₵ 50.00    │  ← deposits in brand-500 color
│      Mobile Money · 11:02 AM              │
│                                            │
│  📦  Order #B7C3E4          -GH₵ 14.08    │
│      Wallet · 9:14 AM                     │
└─────────────────────────────────────────────┘
```

**Key design notes:**
- Wallet card uses **dark (surface-900) background** — creates a "premium card" feel (like Revolut/Cash App)
- Deposits shown in brand-500 green, payments in surface-900 (not red — avoid negative connotation)
- Date groups as section separators (no borders, just 11px uppercase gray labels)
- "This month" mini stats: small 2-column row, clean

---

### Screen 10: Account / Settings Hub (Major Redesign)

**What changes and why:**

Currently: profile header at top, then a flat list of colored icon rows (looks like stock iOS Settings). Every item either has an `href` or shows "Coming soon" on tap — dead ends.

**New Layout:**

```
┌─────────────────────────────────────────────┐
│  Account                                    │  ← 22px/700
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐ │  ← Profile row (not a big header)
│  │  [Avatar 48px]  Jay Monty    →        │ │    avatar+name, chevron → Edit Profile
│  │                 +233 24 123 456        │ │    48px avatar, rounded-full
│  └───────────────────────────────────────┘ │    name: 17px/700, phone: 13px/400/surface-400
│                                             │
│  DELIVERIES                                 │  ← 12px/700/UPPERCASE/surface-400
│                                             │  ← section groups (no card borders)
│  📍  Saved Addresses                →     │  ← rows: 52px height, no border
│  ❤️   Favorite Riders                →     │     icon: 20px, surface-900
│  🔄  Scheduled Deliveries            →     │     label: 15px/500/surface-900
│  🎫  Promo Codes                     →     │     chevron: surface-300
│                                             │
│  PAYMENTS                                   │
│                                             │
│  💳  Payment Methods                 →     │
│  💚  Wallet  ·  GH₵ 24.50           →     │  ← wallet shows live balance inline
│                                             │
│  PREFERENCES                                │
│                                             │
│  🔔  Notifications                   →     │
│                                             │  ← Appearance: inline toggle (no nav)
│  🌙  Appearance    [Light] [System] [Dark]  │     3-pill toggle inline in the row
│                                             │
│  SECURITY                                   │
│                                             │
│  🔒  PIN Login                       →     │
│  👆  Face ID / Fingerprint            →     │
│  📱  Active Sessions                 →     │
│                                             │
│  SUPPORT                                    │
│                                             │
│  ❓  Help & FAQ                       →     │
│  📄  Privacy & Terms                 →     │
│                                             │
│  ─────────────────────────────────────────  │
│  [Sign Out]  ← centered ghost button       │
│  RiderGuy v1.0.0  ← 11px/400/surface-300  │
└─────────────────────────────────────────────┘
```

**Key changes:**
- Profile is compact — just a row, not a big hero header
- Colored icons REMOVED — icons are uniform surface-900, clean like Uber Account
- Section headers in ALL CAPS, small gray — create groups without borders or cards
- Every item links to a real screen — ZERO "coming soon"
- Wallet row shows live balance inline (doesn't need to navigate to see balance)
- Appearance toggle is inline — no navigation needed for a simple preference

---

### Screen 11: Notifications (Upgraded)

**New Layout:**

```
┌─────────────────────────────────────────────┐
│  Notifications                [Mark all ✓] │  ← 22px/700 + action right
│  [All]  [Unread ·3]                        │  ← pill tabs, badge count on Unread
├─────────────────────────────────────────────┤
│                                             │
│  TODAY                                      │  ← 11px/700/UPPERCASE/surface-300
│                                             │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │ 🔵  ●                                │  │  ← ● = unread indicator (5px dot, brand-500)
│  │ [📦 icon, 40px circle, blue-50 bg]   │  │  ← icon circle: colored by type
│  │                                      │  │
│  │ Package Delivered!          2h ago   │  │     title: 15px/700/surface-900
│  │ James delivered your package to      │  │     body: 14px/400/surface-500, 2 lines max
│  │ Community 7. Rate your rider →       │  │     time: 11px/400/surface-300
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │  ← unread: bg-brand-500/4 row tint
│                                             │
│  [    Payment Confirmed       ]             │  ← read notification (same layout, no dot,
│  GH₵ 28.88 deducted from cash              │     no tint, opacity-70)
│                                             │
│  YESTERDAY                                  │
│  ...                                        │
└─────────────────────────────────────────────┘
```

**Key changes:**
- Icon circles: colored by notification type (order=blue-50, payment=green-50, promo=amber-50)
- Unread rows have a very subtle `brand-500/4` background tint — not the harsh `bg-brand-50/50`
- Read notifications at `opacity-70` (not the current `opacity-60` which is too faded)
- Date group labels separate sections without borders
- Swipe-left to dismiss individual notifications (reveal red × button)

---

### Screen 12: Saved Addresses (Upgraded)

```
┌─────────────────────────────────────────────┐
│  [←]  Saved Addresses           [+ Add]    │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐ │  ← Pinned addresses (Home, Work) at top
│  │  🏠  Home                            │ │    special badge "HOME" / "WORK" in surface-200
│  │      15 Cantonments Rd, Osu          │ │    48px row height
│  │                       [Use] [Edit]   │ │    [Use] = surface-100 pill, 11px/600
│  └───────────────────────────────────────┘ │    [Edit] = same style
│  ┌───────────────────────────────────────┐ │
│  │  💼  Work                            │ │
│  │      Airport City, Accra             │ │
│  │                       [Use] [Edit]   │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  OTHER ADDRESSES                            │  ← 12px/700/UPPERCASE/surface-400
│                                             │
│  📍  Tema Community 7              →       │  ← plain rows (no card, no border)
│      Community 7, Tema                     │    label: 15px/600/surface-900
│                                            │    address: 13px/400/surface-400
│  📍  Accra Mall                    →       │
│      Spintex Road, Accra                   │
│                                             │
└─────────────────────────────────────────────┘
```

**Add Address flow (map-first):**
```
Step 1: Full-screen map
  [Search location...] floating bar at top (like Google Maps)
  Crosshair fixed in center
  [Confirm this location →] button at bottom

Step 2: Details bottom sheet (slides up after pin confirmed)
  Label:       [Home] [Work] [● Other: ___]
  Instructions: [optional, textarea]
  [✓ Set as default]
  [Save Address]  ← 60px CTA
```

---

### Screen 13: Favorite Riders (Upgraded)

```
┌─────────────────────────────────────────────┐
│  [←]  Favorite Riders                      │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  [Avatar 56px]  James Mensah          │ │  ← rider card, no border, shadow-float
│  │                 ⭐ 4.8  ·  312 rides  │ │    avatar: 56px circle, ring-2 brand-200
│  │                 Lv.4 Pro 🥇           │ │    name: 17px/700
│  │                                       │ │    level badge: 12px pill, amber-100/amber-700
│  │  [Request this rider]   [Remove ×]    │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  [Avatar]  Kwame Asante               │ │
│  │            ⭐ 4.6  ·  187 rides       │ │
│  │            🟢 Online now              │ │  ← online status if available
│  │  [Request this rider]   [Remove ×]    │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Screen 14: Edit Profile (New)

```
┌─────────────────────────────────────────────┐
│  [←]  Edit Profile              [Save]     │  ← Save: brand-500 text, 15px/700
├─────────────────────────────────────────────┤
│                                             │
│         [Avatar 80px]                      │  ← centered, 80px circle
│         [📷 Change photo]                  │    tap overlay: 50% black + camera icon
│                                             │
│  PERSONAL                                   │  ← 12px/700/UPPERCASE/surface-400
│                                             │
│  First Name                                 │
│  [──────────────────────────────────────]  │
│                                             │
│  Last Name                                  │
│  [──────────────────────────────────────]  │
│                                             │
│  Email address                              │
│  [──────────────────────────────────────]  │
│  A verification link will be sent          │  ← 12px/400/surface-400 helper
│                                             │
│  Phone number                               │
│  [+233 24 123 456        ]  [Change →]     │  ← read-only field + action
│  Phone changes require OTP verification    │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Map Design Standards

### Map Style (Light)
Use Google Maps default style PLUS these custom overrides:
```javascript
styles: [
  // Remove POI clutter — keep roads and labels clean
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  // Soften roads slightly
  { featureType: "road", elementType: "geometry",
    stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }] },
  // Water: very light blue
  { featureType: "water", elementType: "geometry",
    stylers: [{ color: "#e8f4fd" }] },
  // Land: off-white
  { featureType: "landscape", elementType: "geometry",
    stylers: [{ color: "#fafafa" }] },
]
```

### Map Markers
```
Pickup marker:    White circle (24px) + black ● inner (10px) + drop shadow
Dropoff marker:   Black circle (24px) + white ✕ inner (10px) + drop shadow
Rider marker:     Brand-green circle (32px) + motorcycle SVG (white, 16px)
                  + outer ring pulse animation (brand-500/30, 2s infinite)
User location:    Blue-500 dot (12px) + white border (3px) + shadow
```

### Route Polylines
```
Upcoming leg:  dashed, 3px, surface-400
Active leg:    solid, 4px, brand-500 (#22c55e)
Completed:     solid, 3px, surface-200 (grayed out)

Route shadow:  below the line, 1px offset, black/8%
```

---

## Motion Design — Complete Spec

### Page Transitions

```
Push (forward nav):
  New page: translateX(100%) → translateX(0), 280ms, cubic-bezier(0.2, 0, 0, 1)
  Old page: translateX(0) → translateX(-30%), 280ms, same curve
  (Parallax effect — old page moves slower than new)

Pop (back nav):
  Exiting page: translateX(0) → translateX(100%), 240ms, ease-in-back
  Returning page: translateX(-30%) → translateX(0), 240ms, same

Bottom sheet entry:
  translateY(100%) → translateY(0), 380ms, spring(stiffness:280, damping:32)

Bottom sheet exit:
  translateY(0) → translateY(100%), 260ms, cubic-bezier(0.7, 0, 1, 1)

Tab switch:
  Content: opacity 0→1, translateY(4px→0), 180ms, ease-out
  (No slide — just fade-up)

Modal overlay:
  Backdrop: opacity 0→0.5, 200ms
  Modal: scale(0.94)→1 + opacity 0→1, 260ms, spring

Full-screen overlay (delivery celebration):
  Background: opacity 0→0.95, 300ms
  Content: scale(0.7)→1 + opacity 0→1, 400ms, spring
```

### Component Animations

```
Button press (btn-press class):
  Mousedown: scale(0.97) + shadow reduce, 80ms ease-out
  Release:   scale(1.0) + shadow restore, 120ms ease-in-back

Card press:
  scale(0.985), 100ms, ease-out

Status badge (active only):
  The outer ring pulses: scale 1→1.4, opacity 0.4→0, 2s infinite
  Inner dot: static

Map rider dot:
  Outer ring: pulse-ring 2.5s infinite
  Position: smooth interpolation 300ms when coord updates (not jump)

Price in confirm button:
  When promo applied: old price strikethrough+fade, new price slides up from below
  Duration: 350ms, spring

Rating stars:
  Tap: bounce scale 1→1.3→1, 300ms, cubic-bezier(0.34, 1.56, 0.64, 1)
  Unfill: fast scale 1→0.8→1, 150ms

Bottom sheet drag:
  Follow finger with 1:1 velocity
  Release: spring snap to nearest snap point
  Velocity-aware: fast swipe down always closes

Skeleton shimmer:
  Background: linear-gradient(90deg, surface-100 25%, surface-50 50%, surface-100 75%)
  Background-size: 200%
  Animation: shimmer 1.6s linear infinite

Number counter (wallet balance):
  When updated: count from old to new value, 600ms, ease-out
  e.g. 24.50 → 74.50 counts up visually
```

### Feedback Patterns

```
Toast notifications (slide from top):
  Entry: translateY(-100%) → translateY(0), 300ms, spring
  Exit:  translateY(0) → translateY(-100%), 200ms, ease-in
  Duration: 2.5s shown
  Max 1 toast at a time
  Style: white, shadow-float, rounded-2xl, icon+text, no close button (auto-dismiss)

Haptic feedback (on web, use navigator.vibrate):
  Button tap:      [10]         (10ms)
  Success action:  [10, 50, 10] (double pulse)
  Error:           [30, 10, 30] (stronger)
  Delivery done:   [20, 50, 20, 50, 40] (celebratory)

Inline form errors:
  Field:    border-red-300 + bg-red-50/50 (subtle — not alarming)
  Message:  12px/500/red-500, slides down from field bottom, 150ms
  Field shake: translateX ±3px, 3 cycles, 280ms total
```

---

## Component Inventory (What to Build / Refactor)

### New Components Needed

| Component | Location | Notes |
|-----------|----------|-------|
| `<LocationCard>` | `components/location-card.tsx` | Connected pickup→dropoff with swap button |
| `<PriceTotal>` | `components/price-total.tsx` | Animated price display with breakdown |
| `<RiderCard>` | `components/rider-card.tsx` | Avatar + name + rating + vehicle |
| `<OrderProgressBar>` | `components/order-progress-bar.tsx` | Horizontal step indicator |
| `<StatusBadge>` | `components/status-badge.tsx` | Solid-color pill badges |
| `<WalletCard>` | `components/wallet-card.tsx` | Dark card with balance + actions |
| `<TransactionRow>` | `components/transaction-row.tsx` | Reusable transaction list item |
| `<SearchBar>` | `components/search-bar.tsx` | Elevated "Where to?" bar |
| `<ActiveOrderPill>` | `components/active-order-pill.tsx` | Floating pill for home screen |
| `<RadarLoader>` | `components/radar-loader.tsx` | Pulsing radar for rider search |
| `<PackageTile>` | `components/package-tile.tsx` | Icon+label tile for package type |
| `<Toast>` | `components/toast.tsx` | Slide-from-top notification |
| `<SegmentedControl>` | `components/segmented-control.tsx` | Pill tab bar (replace current tab impl) |

### Components to Refactor

| Component | Change |
|-----------|--------|
| `<location-input>` | Wrap in LocationCard, add connected visual |
| `<tracking-map>` | Add custom Google Maps styles (POI removal, road softening) |
| `<price-breakdown>` | Add animation, use new typography scale |
| `<cancel-order-modal>` | Upgrade to full bottom sheet, better reason selector |
| `<order-confirmation>` | Full redesign as celebration overlay |
| Dashboard layout nav | 5 tabs, upgrade to 68px height, remove active background fill |

---

## CSS Changes Required in `globals.css`

### Changes to existing classes

```css
/* Upgrade card shadow — remove border dependency */
.card {
  /* Remove: border border-surface-100 */
  /* Add: */
  box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.06);
}

/* Upgrade bottom sheet corner radius */
.bottom-sheet {
  border-radius: 28px 28px 0 0;
  /* upgrade shadow */
  box-shadow: 0 -8px 40px rgba(0,0,0,0.10), 0 -1px 4px rgba(0,0,0,0.05);
}
```

### New CSS utilities to add

```css
/* Solid status badges — replace pastel approach */
.badge-pending    { @apply bg-amber-500 text-white; }
.badge-enroute    { @apply bg-indigo-500 text-white; }
.badge-transit    { @apply bg-blue-500 text-white; }
.badge-delivered  { @apply bg-green-600 text-white; }
.badge-cancelled  { @apply bg-red-500 text-white; }

/* Dark wallet card */
.wallet-card {
  @apply bg-surface-900 text-white;
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.20);
}

/* Elevated search bar */
.search-bar {
  @apply w-full h-14 bg-white rounded-2xl flex items-center gap-3 px-4;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.06);
}

/* Section label (ALL CAPS gray) */
.section-label {
  @apply text-[11px] font-bold tracking-[0.4px] uppercase text-surface-400;
}

/* Settings row */
.settings-row {
  @apply flex items-center gap-3 h-[52px] px-0;
  /* No background, no border — just spacing */
}

/* Package type tile */
.package-tile {
  @apply flex flex-col items-center justify-center gap-1.5 rounded-xl h-16;
  @apply transition-all duration-150;
}
.package-tile.active {
  @apply bg-surface-900 text-white;
}
.package-tile.inactive {
  @apply bg-surface-50 text-surface-700;
}

/* Progress bar (tracking) */
.tracking-progress {
  @apply h-1 rounded-full bg-surface-100 overflow-hidden;
}
.tracking-progress-fill {
  @apply h-full bg-brand-500 rounded-full transition-all duration-700 ease-out;
}
```

---

## Tailwind Config Additions

```typescript
// In apps/client/tailwind.config.ts — extend theme:
theme: {
  extend: {
    // ...existing brand colors...
    boxShadow: {
      'float':    '0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
      'card':     '0 1px 4px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.06)',
      'wallet':   '0 8px 32px rgba(0,0,0,0.20)',
      'brand':    '0 4px 14px rgba(34,197,94,0.18)',
      'search':   '0 2px 12px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.06)',
    },
    borderRadius: {
      '2.5xl': '20px',
      '3xl':   '24px',
      '4xl':   '28px',
      '5xl':   '32px',
    },
    fontSize: {
      // Section label
      'section': ['11px', { fontWeight: '700', letterSpacing: '0.4px' }],
    },
    height: {
      'cta': '60px',     // primary CTA
      'input': '54px',   // input fields
      'nav': '68px',     // bottom nav
    },
  }
}
```

---

## Implementation Order (Design-First)

### Phase 1 — Foundation (Do first, everything else builds on this)
1. Update `globals.css` — add new CSS utilities
2. Update `tailwind.config.ts` — add new tokens
3. Update `STATUS_CONFIG` constants — solid badge colors
4. Build `<StatusBadge>` component
5. Build `<SegmentedControl>` component
6. Build `<LocationCard>` component
7. Update bottom nav: 5 tabs, 68px, remove active fill

### Phase 2 — Home & Send (The most-used screens)
8. Redesign Home dashboard — new search bar hero, compact greeting, recent destinations
9. Redesign Quick Send — map-behind, connected location card
10. Redesign Full Send Form — 4-step, package tiles, schedule options
11. Build `<RadarLoader>` + Searching for Rider screen

### Phase 3 — Tracking & Orders
12. Redesign Tracking screen — full-bleed map, horizontal progress, upgraded rider card
13. Redesign delivery celebration overlay
14. Redesign Orders list — active card with progress bar, completed cards quieter
15. Build Order Detail / Receipt screen

### Phase 4 — Wallet & Account
16. Build Wallet screen — dark balance card, transactions
17. Build Add Funds screen
18. Redesign Settings hub — remove colors, remove dead-ends
19. Build Edit Profile screen
20. Build Payment Methods screen

### Phase 5 — Polish
21. Rate & Tip redesign
22. Saved Addresses map-first flow
23. Notifications date grouping + swipe delete
24. Favorite Riders upgrade
25. All empty states audit
26. Toast notification system
27. Motion/animation audit — ensure all specs are applied

---

*This document is the single source of truth for design decisions.
Implementation follows this spec exactly — no improvising colors, sizes, or spacing.*
