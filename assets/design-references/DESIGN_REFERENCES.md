# RiderGuy — UI Design References

> These reference images were studied on Feb 24, 2026.
> The screenshots are from Uber's ride-hailing and delivery apps.
> Our client app UI was redesigned to match this premium quality level.

---

## Image 1 — Uber Tracking Screens (2 phones, dark theme left, light map right)

**Left phone (Uber rider tracking):**
- Full-bleed dark map taking ~55% of screen
- Car icon on map showing driver approaching
- "1 mile away" floating badge near car
- "Pickup spot" label with edit icon on map
- "Driver may record audio for added safety" floating alert ribbon (green/teal)
- Map controls (compass, locate-me) floating right side
- **Bottom sheet** with white background, rounded top corners:
  - "Meet at your pickup spot on Mission St" — bold text
  - Walking icon + "2 min" walk time
  - **ETA badge**: "5 min" in a bordered box, right-aligned
  - **Driver card**: Circular avatar (photo), rating (4.9), Name "Anderson", plate "3M53AF2", vehicle "Silver Honda Civic"
  - "Send a message" input bar with phone + settings icons

**Right phone (Driver navigation view):**
- Turn-by-turn nav header: "1.5 mi → E Main St"
- Destination pill: location icon + "22 N Ussery St, Dothan, AL"
- Dark map with thick black route line
- Pickup marker (green circle) and dropoff marker
- "Navigate" black button at bottom
- "Rider may record audio for added safety" bar

**Key patterns:** Bottom sheet, driver card with photo/rating/vehicle, message bar, ETA badge, floating map elements.

---

## Image 2 — Uber Home + Ride Selection (3 phones)

**Left phone (ride confirmation):**
- Map hero ~40% with route shown
- "Work >" destination label floating on map
- ETA badge "5 MIN" in black box on map
- Back arrow (←) top left, circular black
- **Bottom sheet** slides up:
  - "You're going green with Comfort Electric" text
  - **Vehicle illustration** (car photo/render)
  - "Comfort Electric ⚡" vehicle name with passenger capacity icon
  - "8:36am · 5 min away" — arrival time + ETA
  - Price: **$17.21** — bold, right-aligned
  - "Premium zero-emission cars" description
  - Payment row: Visa icon + "•••• 1059" + chevron
  - **Black CTA button**: "Choose Comfort Electric"

**Center phone (Uber home):**
- Profile icon top right (black circle)
- Green promo banner "⚡ Electrify your ride — Request an EV →"
- **Service grid** (2 rows × 4): Ride, Food, Grocery, Reserve, Hourly, Rent, Vaccine, More
  - Each: illustration icon + label
- "Where to?" header with "Now ▼" time picker
- **Recent destinations** list:
  - Location icon + "Chase Center" + address
  - Location icon + "San Francisco International Airport" + address
  - "Golden Gate Park"...
- Bottom nav: Home, Explore, Activity

**Right phone (ride selection list):**
- Map hero ~35%
- "Work >" + "5 MIN" badge on map
- "Choose a ride, or swipe up for more"
- **Ride options list:**
  - Each row: vehicle image | name + capacity | price
  - "UberX ⚡4 — $10.34 — 8:31am"
  - "Comfort Electric ⚡4 — $17.21 — 8:36am · 5 min away" (highlighted/selected)
  - "Black — $29.95 — 8:38am"
- Payment row: Visa •••• 1059
- Black CTA: "Choose Comfort Electric"

**Key patterns:** Service grid, ride option cards, vehicle illustrations, price + ETA, payment row, black CTA, promo banner.

---

## Image 3 — Ride Selection & Pickup (3 phones)

**Left phone (map + ride list):**
- Map ~40% showing route to "San Francisco International Airport"
- "Home >" label, "3 MIN" ETA badge
- Destination label on map
- "Choose a ride, or swipe up for more"
- Ride list: UberX ($14.87), Pool ($9.85), UberXL ($22.61)
  - Each: vehicle image, name, capacity, price, description
  - Pool has blue text "Extra seats and luggage space"
- Payment row + black CTA

**Center phone (full-screen ride list, dark header):**
- "Choose a ride" header with down arrow
- **"Economy"** category header
- Full list with more detail per option:
  - UberX ⚡4 — $14.87 — "Affordable rides, all to yourself"
  - Pool ⚡1-2 — $9.85 — "Shared ride with the option to walk"
  - Comfort ⚡4 — $16.64 — "Newer cars with extra legroom"
  - UberXL ⚡6 — $22.61 — "Affordable rides for groups up to 6"
  - Transit ⚡4 — $3.75 — "Public transit routes in your city"
  - Connect ⚡4 — $15.20
- Payment footer

**Right phone (Pool detail + pickup map):**
- Map with **animated blue circle** around pickup point
- "Pickup near Home" label
- "4 MIN" badge
- Pool card: vehicle image, name, price, ETA
- "Short walk to & from your ride — Saves you $1.50" with toggle switch
- "How many seats?" with 1/2 selector buttons
- Payment + CTA

**Key patterns:** Category headers, detailed ride descriptions, toggle switches, seat selectors, animated pickup circle on map.

---

## Image 4 — Driver Accept/Reject Screen (2 phones, dark + light)

**Left phone (dark theme):**
- Map with route line (pickup to dropoff, purple/blue gradient dots)
- **Price badge** floating on map: "₹ 799.43" in white circle
- Pickup pin (A) and dropoff pin on map
- **Driver info card** below map:
  - Circular avatar photo
  - Name "Alok Trivedi"
  - "3 km away | 12 mins"
  - Rating: 4.78 stars
  - "Pickup from" label
  - Address: "3, Malviya Nagar, Near LB Hospital, Jaipur, Rajasthan"
- **Two buttons:** Green "ACCEPT" + Red "REJECT" — full width, side by side

**Right phone (light theme, same layout):**
- Light/pastel map
- Same floating price badge
- Same driver card layout
- Green accept + Red reject buttons

**Key patterns:** Floating price badge on map, clean accept/reject split buttons, driver card with avatar + rating + distance, route visualization with pins.

---

## Design Principles Extracted

1. **Map dominance** — Map takes 40-60% of screen, content in bottom sheet
2. **Bottom sheet pattern** — White card sliding up from bottom with rounded-t-3xl
3. **Clean information hierarchy** — Large bold primary info, smaller secondary details
4. **Minimal color usage** — Mostly black/white/gray, accent color only for key elements
5. **Vehicle/service illustrations** — Visual icons for each service type
6. **ETA prominently displayed** — Floating badges on map, inline in cards
7. **Driver/rider cards** — Photo (circular), name, vehicle, rating, all in one row
8. **Integrated messaging** — "Send a message" bar in tracking view
9. **Payment method** — Always visible as a row near CTA
10. **Dark CTAs** — Uber uses black buttons, we'll use our brand color but solid/bold
11. **Floating map elements** — Labels, badges, controls float over map
12. **Generous whitespace** — Clean spacing, no clutter
13. **Subtle shadows** — Cards use very subtle shadows, not heavy elevation
