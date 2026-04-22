# The RiderGuy Delivery Story — Full Gamification Scope of Work

**Status:** Draft · Pre-Build
**Owner:** Marketing · Home
**Placement:** New standalone section on `/` (desktop only), sits between §04 "How It Works" and §05 "Why RiderGuy", directly replacing the informational 4-card grid with a cinematic, scroll-driven scene.
**Principle:** Every RiderGuy delivery is a tiny film. This section is that film — a single unbroken shot that carries a parcel from a sender's hand in Osu to a customer's door in East Legon, in 60–90 seconds of pure motion.

---

## 1. North-Star Intent

When a visitor lands on RiderGuy, they should *feel* the product before they read about it. The existing hero-frame animation is a teaser — walkers and bikes looping on a border. This new section is the **feature film**: the full delivery scope, acted out on stage, with the visitor as the audience.

**Three things the viewer must walk away with:**
1. **Confidence.** We run a real, instrumented logistics system — not a vague marketplace.
2. **Delight.** This company has taste. The motion is cinematic, not cartoonish.
3. **Trust in the rider.** Every act ends with the rider doing something dignified, skilled, or kind.

**Corporate palette only** — brand green (`--brand-500 #22c55e`, `--brand-700 #15803d`), deep black (`#0a0a0a`, `#1f2937`), paper white (`#ffffff`, `#f8fafc`), plus a single restrained accent of mint (`--brand-200`) for glows and trails. No amber, no orange.

---

## 2. Stage & Camera

**Stage:** A full-bleed 1440×720 "living map" — an abstract, top-down neighborhood of Accra rendered as a technical schematic:
- Matte black background (`#0a0a0a`) with a 48-pixel grid at 4% white opacity (blueprint look).
- Roads drawn as single-stroke white vectors, 1.5 px, with soft mint dashed centerlines on major arteries.
- Landmarks as minimalist glyphs: a shop, three homes, a hospital, a school, a market stall, a bank.
- Two rivers of light flowing diagonally — ambient motion only, never distracting.

**Camera:** CSS-only "virtual camera." We do not move the viewport; we move/scale/rotate the stage under a fixed mask. Five camera beats:
1. Wide establishing shot — whole city visible.
2. Push-in on sender's shop.
3. Tracking shot along the route with the rider.
4. Orbit around the drop point.
5. Pull-back wide to reveal a dozen other active deliveries lighting up across the map (the "this is just one of thousands" reveal).

**Trigger:** `IntersectionObserver` + `scroll-timeline` (progressive enhancement) with a graceful `requestAnimationFrame` fallback. Autoplay once the section is ≥40% in viewport; pause when scrolled away; respects `prefers-reduced-motion` by collapsing to a static 3-panel diorama.

**Duration:** 72 seconds on loop, with an invisible 2 s fade-to-black between loops so it never feels mechanical.

**Mobile:** Not rendered. Below `md` breakpoint, this entire section is replaced by a clean 6-step vertical card stack — no animation, no route map. Stated policy: cinematic motion belongs on desktop; mobile stays sharp, fast, calm.

---

## 3. The Seven Acts (the Story Plan)

Each act is ~9–12 seconds. Beats are numbered; each beat specifies **WHAT moves, WHAT lights up, WHAT the viewer reads, and WHAT plays underneath.**

### Act I — "The Ask" (0:00 – 0:10)
*Camera: wide, then push-in on top-left shop.*

| # | Beat | Visual | Copy (left rail) |
|---|------|--------|------------------|
| 1 | City is still. One pulse of light starts in the bottom-left. | Cursor-style pulse in a floating phone frame. | **01 · A request is born.** |
| 2 | Phone mock-up draws itself onto the canvas. Sender types a destination; autocomplete suggests "Osu → East Legon." | Typed-text animation, green caret. | *"A sender opens RiderGuy. Two fields. Pickup. Drop-off."* |
| 3 | Price appears: **GH₵ 28.00** counts up in 0.6 s. ETA chip reads **14 min**. | Number roll (green). | *"Price and ETA are quoted instantly. No negotiation. No surge."* |
| 4 | Sender taps **Send**. Phone flies into the map and lands as a glowing shop pin (top-left corner). | Phone shrinks → pin. Mint ring pulses outward. | — |

**Payoff feeling:** *This is friction-free.* We showed a full order intake in ten seconds.

---

### Act II — "The Match" (0:10 – 0:19)
*Camera: pulls back to wide. Five candidate rider-dots blink on across the map.*

| # | Beat | Visual | Copy |
|---|------|--------|------|
| 1 | Shop pin emits a ripple. Five small rider-dots (black with green stroke) scattered across the city light up. | Concentric mint rings from the shop. | **02 · The nearest rider is summoned.** |
| 2 | Dashed green vectors snap from shop to each candidate, then four retract and one stays. | Vectors draw in 350 ms, recede in 400 ms. | *"RiderGuy checks proximity, vehicle size, rating, and workload in under 2 seconds."* |
| 3 | A checkmark flashes on the chosen rider. Their dot becomes a small stickman on a bike. | Dot → rider SVG morph. | *"Matched: Kwame A., Rider Level 4. 4.92★ · 1,204 deliveries."* |
| 4 | A tiny "Accept" chip flips from black to green on the rider's card. Rider pulls out from the curb. | Card flip, bike starts. | — |

**Payoff feeling:** *This is instrumented.* We showed the algorithm without explaining it.

---

### Act III — "Pickup" (0:19 – 0:30)
*Camera: tracks the rider toward the shop.*

| # | Beat | Visual | Copy |
|---|------|--------|------|
| 1 | Rider weaves around two black delivery trucks. Wheels spin. | Bike bobs; road dashes slide under. | **03 · Pickup, scanned & sealed.** |
| 2 | Rider arrives at shop. Stickman shopkeeper steps out holding a white parcel with a single green tape band. | Door slides open. Parcel handoff. | *"Every parcel is photographed, weighed, and scanned at pickup."* |
| 3 | Rider scans the parcel. A QR-code glyph on the parcel flashes and turns into a green checkmark. | Micro-ping sound equivalent (visual flash only). | *"Chain-of-custody starts here. The sender gets a pickup photo in real time."* |
| 4 | Parcel slots into the rider's box. Box lid closes with a soft snap. | Lid animation. Sender's phone (top-left HUD) shows "Picked up ✓ 11:42". | — |

**Payoff feeling:** *This is accountable.* We showed proof-of-pickup — a trust feature most couriers hide.

---

### Act IV — "In Transit" (0:30 – 0:44)
*Camera: sidescrolls along the route. This is the longest act — it's the hero beat.*

| # | Beat | Visual | Copy |
|---|------|--------|------|
| 1 | A green "breadcrumb" trail emits from the rider every 400 ms, persisting. | Trail fades over 3 s. | **04 · Live tracking. Every second, every meter.** |
| 2 | A floating mini-map in the lower-right draws the same trail in miniature — the "customer's view." | Mini-map draws on top of phone frame. | *"The customer watches on their phone. So does the business. So does support."* |
| 3 | Rider hits traffic. Two cars block the road. Route engine replans. A second dashed line appears, the rider pivots onto it. | Red "X" on old line, new green line draws. | *"Traffic detected → route recalculated in 600 ms. No manual intervention."* |
| 4 | Rain starts falling as a subtle particle layer. Rider keeps moving. A small umbrella icon appears on the parcel. | 60 soft white dots, parallax. | *"All weather. All terrain. Ghana is our city."* |
| 5 | Halfway marker pulses — a thin green line bisects the route. ETA in HUD drops from 14 → 7 min. | Number countdown. | — |

**Payoff feeling:** *This is alive.* We showed replan-mid-journey — something only infrastructure-grade systems do.

---

### Act V — "Arrival" (0:44 – 0:54)
*Camera: orbits around the destination home (top-right).*

| # | Beat | Visual | Copy |
|---|------|--------|------|
| 1 | Rider slows. Destination pin pulses. A phone chirp glyph flies from pin to a little home. | Pin ripples. | **05 · She's here.** |
| 2 | Customer's phone HUD (lower-right) shows **"Your rider is 30 seconds away."** | Notification slide-in. | *"A courtesy ping, not a guess. The customer walks out on time."* |
| 3 | Stickman customer steps out of the home, door swings. She walks three steps toward the curb. | Walker animation (brand green). | — |
| 4 | Rider stops, dismounts. Bike kickstand animation. | Rider pivots from sitting to standing. | — |

**Payoff feeling:** *This is considerate.* We showed a feature most apps don't build — "walk out now" timing.

---

### Act VI — "Proof" (0:54 – 1:04)
*Camera: tight close-up on hands and parcel.*

| # | Beat | Visual | Copy |
|---|------|--------|------|
| 1 | Rider lifts parcel. Customer's phone rises to scan. QR code on parcel flashes green. | QR → check. | **06 · Proof of delivery. No disputes.** |
| 2 | A photo frame snaps around the handoff moment; the frame flies into the shop pin (top-left) as the sender's receipt. | Photo flies across full canvas. | *"Signature, photo, GPS-stamp, timestamp. Every parcel, every time."* |
| 3 | Customer taps 5 stars on her phone. A green "+GH₵ 2.00 tip" chip flies from her phone to the rider's earnings card. | Star fill-in; chip animation. | *"The rider keeps 100% of tips. Paid to mobile money in 30 seconds."* |
| 4 | Rider's earnings HUD ticks: **+GH₵ 23.80 · Today: GH₵ 184.20**. | Number roll. | — |

**Payoff feeling:** *This is fair.* We showed rider economics on-screen — a core RiderGuy differentiator.

---

### Act VII — "The Scale" (1:04 – 1:12)
*Camera: hard pull-back to the widest shot we've had.*

| # | Beat | Visual | Copy |
|---|------|--------|------|
| 1 | As we pull back, twelve more deliveries light up simultaneously across the city — each one a tiny green trail at different stages. | 12 routes, staggered. | **07 · One of thousands. Every day.** |
| 2 | A counter in the bottom HUD ticks: **Active deliveries: 1,247** → **1,248** → **1,249**. | Live-feeling number. | *"This is not a demo. This is Tuesday."* |
| 3 | The whole map dims, and the RiderGuy wordmark fades up, centered, on the black stage. Under it: a single CTA button — **Send a Package** — and a secondary link — **Become a Rider**. | Fade + button glow. | — |
| 4 | 2-second black hold. Loop. | — | — |

**Payoff feeling:** *This is at scale.* We close the film by promoting the very act it just depicted.

---

## 4. Visual System

### Palette (strict)
| Role | Token | Hex |
|---|---|---|
| Stage background | `surface-950` | `#0a0a0a` |
| Grid lines | white @ 4% | `rgba(255,255,255,0.04)` |
| Roads | `surface-50` | `#f8fafc` |
| Primary motion (routes, trails, riders-carrying) | `brand-500` | `#22c55e` |
| Route strokes (deep) | `brand-700` | `#15803d` |
| Glow / halo | `brand-300` @ 30% | `#86efac` |
| Rider returning empty | near-black | `#1f2937` with white stroke |
| Parcel | white with `brand-500` tape band | `#ffffff` / `#22c55e` |
| Text HUD | white | `#ffffff` |
| Numbers (price, stars, tips) | `brand-400` | `#4ade80` |

**No amber, no red, no blue anywhere.** Traffic warning = a single white "X" on a red-free path.

### Typography (HUD)
- Headline per act: **Space Grotesk 600**, 14 px, tracked +120, uppercase.
- Body copy: **Inter 400**, 14 px, `text-surface-200`.
- Numbers: **Space Grotesk 700** with tabular figures.

### Motion Language
- **Easing:** all transitions use `cubic-bezier(0.22, 1, 0.36, 1)` (out-expo) for entries and `cubic-bezier(0.64, 0, 0.78, 0)` (in-expo) for exits.
- **Duration scale:** micro 180 ms · small 360 ms · medium 720 ms · act 9–12 s.
- **Parallax:** three depth layers (grid –2 %, roads 0 %, actors +3 %) — subtle, not 3D-vertigo.
- **No easing-linear** anywhere except the rider trail emission (needs constant cadence).

### Sound (optional, off by default)
Muted by default. A small speaker toggle in the HUD corner unlocks ambient design: a soft Accra traffic bed, a GPS "bloop" on match, a camera-shutter on the photo beat, a single chime on arrival. Shipped as a separate follow-up PR — not in the first build.

---

## 5. Interactivity

1. **Scrubber.** A thin green progress bar across the bottom, clickable. Lets the visitor jump to any of the 7 acts. Labelled by act number on hover.
2. **Pause / Play.** Keyboard `Space` toggles when section is focused.
3. **Chapter dots.** Seven dots below the scrubber; the current act is green, others are white at 40%.
4. **"Skip to end" link.** A tiny `→ Skip to CTA` link in the top-right of the section — respects the viewer's time.
5. **Accessibility.**
   - Every act has a narrated `aria-label` read when that act is active.
   - `prefers-reduced-motion` → static 7-panel storyboard, no autoplay.
   - Full copy of all 7 act scripts is rendered in a visually-hidden `<ol>` for screen readers.
   - Keyboard-focusable chapter dots with visible focus ring.

---

## 6. Technical Build Plan

### Delivery strategy
Single new client component: `apps/marketing/src/components/delivery-film.tsx`. Pure React + Tailwind + inline SVG + CSS variables driving keyframes. No new libraries required. Optional lightweight helper: a ~40-line `useScrollTimeline` hook.

### Architecture
```
<DeliveryFilm>
  ├── <FilmStage>           // the black canvas, roads, grid, landmarks
  ├── <ActorLayer>          // rider, walkers, shopkeeper, customer
  ├── <RouteLayer>          // dashed lines, breadcrumbs, replan logic
  ├── <HUDLayer>            // left copy panel, mini-map, counters, phone mocks
  ├── <CameraController>    // CSS transform on the stage, act-driven
  ├── <Scrubber>            // chapter dots + progress bar
  └── <ReducedMotionPoster> // fallback diorama
```

### Props & state
- `activeAct: 0..6` — single source of truth, driven by a 72 s timeline.
- `playing: boolean` — paused automatically when section is out of viewport.
- `prefersReducedMotion: boolean` — from `window.matchMedia`.

### Performance budget
- **No third-party animation libs.** CSS `@keyframes` + `transform` + `opacity` only — GPU-accelerated.
- **No canvas, no WebGL.** Keeps bundle under +6 KB gzipped.
- **All SVG inline**, no extra network requests.
- **Section lazy-mounted** via `next/dynamic` with `ssr: false` and a static poster fallback.
- **Target:** 60 fps on a mid-2020 laptop; 30 fps fallback path on older hardware.

### Responsive rules
- `< md` (mobile/tablet portrait): component returns `null`. A separate `<DeliveryStepsMobile>` block renders the 6-card stack.
- `md` to `xl`: stage is full-width but height caps at `720 px`. Copy rail collapses under the stage.
- `≥ xl`: full cinematic layout — stage + right-side copy rail side-by-side.

### Content authoring
All 7 acts defined as a `const ACTS: Act[]` array at the top of the file. Each entry owns its own SVG layer, copy text, duration, and camera transform. Marketing can edit copy without touching animation logic.

---

## 7. What We Build When

| Phase | Scope | Notes |
|---|---|---|
| **P0 (this PR)** | (a) Plan reviewed & approved. (b) Hide current hero-frame gamification on mobile. (c) Recolor current hero-frame to corporate palette (no amber). | Quick cleanup pass; ships today. |
| **P1** | Skeleton: `DeliveryFilm` shell, black stage, grid, roads, 7-act skeleton with placeholder text only. Camera controller with act transitions. Scrubber + chapter dots working. Reduced-motion fallback in place. | "Boring but correct" — the timing engine. |
| **P2** | Acts I–III (Ask, Match, Pickup) fully choreographed — all actors, all copy, all HUDs. | Ship to staging; gather reactions. |
| **P3** | Acts IV–V (Transit, Arrival) — the longest and most complex beats (rain, replan, customer walk-out). | Technical risk lives here. |
| **P4** | Acts VI–VII (Proof, Scale) — the emotional payoff and the pull-back reveal. | Closes the story. |
| **P5** | Polish: sound design, analytics instrumentation (`act_viewed`, `cta_clicked_from_film`), A/B hook against current HOW_IT_WORKS grid. | Optional; data-driven. |

---

## 8. Success Criteria

1. **Scroll-depth:** ≥ 70% of desktop visitors reach Act VII (currently only 38% reach the "Why RiderGuy" section).
2. **CTA uplift:** ≥ +25% clicks on "Send a Package" from homepage vs. the outgoing 4-card HOW_IT_WORKS grid.
3. **Dwell time:** median time-on-homepage rises by ≥ 20 s.
4. **Subjective:** when shown to 10 first-time testers, at least 7 use the word *"real"*, *"serious"*, or *"trustworthy"* unprompted.
5. **Performance:** Lighthouse Performance score on `/` stays ≥ 90 desktop / ≥ 85 mobile.

---

## 9. Out of Scope (for this section)

- Real map tiles (Google / Mapbox). The stage is an abstract diagram, not a geographic map.
- Live data feed. The "1,247 active deliveries" number is a styled fake (with a roadmap note to wire it to a real metric later).
- Video or Lottie. Everything is SVG + CSS for performance and crispness.
- Mobile animation. Explicit product decision: mobile stays clean.

---

## 10. Open Questions (for the writer's room)

1. Should we name the sender and customer on-screen (e.g., "Ama → Mensah") or keep them anonymous stickfolk? *Current recommendation: anonymous. The film is about the system, not personas.*
2. Should Act VII show a specific day's count, or a running counter? *Recommendation: a gently-randomized counter seeded from the hour, so no two page-loads look identical.*
3. Do we include a **rider-earnings reveal** in Act VI, or save that for the `/for-riders` page? *Recommendation: include a brief version here — it is a load-bearing differentiator.*
4. Does the film live under a new section number (08), or does it replace the existing §04 HOW IT WORKS grid entirely? *Recommendation: replace §04 on desktop; mobile keeps the grid.*

---

**Next step:** review this plan, resolve the open questions, then build P1 (skeleton + timing engine).
