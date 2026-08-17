# RiderGuy Native UI Overhaul Plan

Generated: 2026-05-30
Scope: Rider native app, client native app, rider/client PWAs, shared assets, app icons, and delivery/map experiences.

## Current Decision

The production backend hotfix has been deployed before this UI work begins. The UI overhaul should now proceed from a stable API contract and must preserve all existing delivery, chat, payment, proof, wallet, rating, and notification behavior.

## Brand Direction

RiderGuy's primary brand mark is black text on the official green background. The sampled green from `assets/branding/Official Logo 1 for RIder.png` is:

- Brand green: `#40BE89`
- Brand black: `#050505`
- App white: `#FFFFFF`
- Soft surface: `#F6FAF8`
- Border line: `#E3EEE9`
- Success/deep green: `#079B61`
- Warning: `#F5B84B`
- Danger: `#EF3B2D`

The existing rider native token `#00A86B` should be replaced with `#40BE89` as the brand source. Dark green remains available only for contrast states, route highlights, and pressed states. The app should feel green, black, and white without becoming a flat one-color interface.

## Reference Style

The supplied rider home/profile references define the first visual pass:

- White mobile surface with black text and brand green accents.
- Centered `Riderguy` wordmark in the top bar.
- Left menu icon, right notification icon with red unread dot.
- Rounded white utility panels with soft shadows and very light green tints.
- Large wallet/status surfaces using solid brand green.
- Friendly icon circles, compact metrics, and clear bottom navigation.
- Small 3D/cartoon rider or scooter illustrations used as functional context, not decoration.
- Map-first delivery surfaces with floating job request panels and bottom sheets.

## Asset Strategy

Use existing assets first, then generate only what is missing.

Existing assets to promote into shared/native usage:

- `assets/branding/Official Logo 1 for RIder.png`
- `assets/branding/Official Logo 2 for Client and MainSite.png`
- `assets/Full New Assets and References/Rider App Home Page.png`
- `assets/Full New Assets and References/Rider App Account Page.png`
- `assets/Full New Assets and References/Rider App Dashboard.png`
- `assets/Full New Assets and References/Client Header.png`
- `assets/Full New Assets and References/Client App Assets/*`
- `apps/client-native/assets/images/*`
- `apps/client/public/images/*`
- `apps/rider/public/images/*`

Generated assets needed:

- Rider native launcher icon and adaptive icon using the exact brand mark. This should be deterministic from the logo source, not AI-generated text.
- Client native launcher icon and adaptive icon using the client/main-site logo source.
- PWA icons for rider/client at 192, 512, maskable, and Apple touch sizes.
- Cartoon/3D-style transparent or cutout assets:
  - Rider scooter with Accra skyline for rider home.
  - Customer package handoff for client home.
  - Empty order state.
  - Delivery completed celebration.
  - Wallet/cash-out illustration.
  - Safety shield illustration.
  - Learning center illustration.
  - Community/rider crew illustration.

Use the image generation workflow only for illustration/cutout assets. Do not use generated text for official logos.

## Shared UI Foundation

Create a unified native design layer:

- `BrandHeader`: centered wordmark, menu button, notification button.
- `MetricStrip`: 2-4 compact metric tiles with dividers.
- `ActionBand`: green-tinted status row with icon, status text, and action button.
- `WalletCard`: solid green money panel with quick actions.
- `MapBottomSheet`: shared map overlay surface for orders/jobs/tracking.
- `QuickActionTile`: icon circle, title, short text, chevron.
- `ProfileHero`: avatar/photo, verified badge, rating, deliveries, edit affordance.
- `OrderTimeline`: delivery status progress for both rider and client.
- `EmptyIllustrationState`: image, title, short copy, primary action.

Native apps should avoid one-off screen styling. Rider and client can have different layouts, but they should use the same primitives, spacing scale, icons, and brand colors.

## Rider Native Screens

### Auth

Screens:

- Welcome/index
- Login
- Register
- Forgot password/PIN/recovery
- Google callback
- Email verification/reset

Design behavior:

- Use full-bleed branded auth imagery from `assets/Auth Images` and rider logo placement.
- Keep phone/email/Ghana Card segmented controls.
- Make OTP/PIN states feel native: large inputs, clear resend timer, biometric prompt where available.
- Use green primary buttons, black secondary text/buttons, white content panels.
- Error states use inline validation plus toast, not layout jumps.

### Home / Dashboard

Reference: supplied Rider App Home Page.

Required sections:

- Top brand header.
- Greeting and availability selector.
- Scooter/skyline illustration.
- Wallet balance card with Add Money, Cash Out, Transaction History.
- Today's overview: deliveries, earnings, rating.
- Go Online and Deliver band.
- Active delivery card when assigned.
- Recommended: Refer and Earn, Learning Center, Community.
- Safety band.

States:

- Offline: CTA says Go Online; muted connection dot.
- Online: CTA says Go Offline; live socket/location health visible.
- On delivery: show active job first, with Navigate, Chat, Call.
- Onboarding incomplete: replace go-online band with activation checklist.
- No wallet data: skeleton, then zero-state.

### Jobs / Deliveries

Required sections:

- Tabs: Available, Active, History.
- Available jobs use map-aware job cards: pickup, dropoff, distance, payout, package, urgency.
- Active jobs use status and next action.
- History groups by day with payout totals.

States:

- Empty available jobs: illustrated idle state with online guidance.
- Searching: compact shimmer rows.
- Accept error: show "job taken" or eligibility reason.
- Offline: show a persistent go-online prompt.

### Job Offer

Reference: Rider App Dashboard map popup.

Required behavior:

- Full-screen map preview behind a job offer card.
- 30-second circular countdown.
- Payout and distance are dominant.
- Pickup/dropoff route with dots.
- Accept and Decline buttons fixed at bottom of card.
- Haptic and sound cues remain.
- Expired/taken state should animate out and return to Jobs.

### Active Delivery Map

Required behavior:

- Full-bleed map.
- Pickup/dropoff markers, rider marker, route polyline, ETA.
- Bottom sheet with order number, payout, package, customer, chat/call, current status, next action.
- Floating recenter/navigation buttons.
- Geofence error displayed as a map-aware warning sheet.
- Chat button with unread badge.

Status actions:

- Assigned -> Navigate to pickup.
- Pickup en route -> Confirm pickup arrival.
- At pickup -> Package collected.
- Picked up -> Start dropoff route.
- In transit -> Confirm dropoff arrival.
- At dropoff -> Complete proof.

### Proof

Required sections:

- Payment confirmation first for cash/MoMo/card-wallet consistency.
- Segmented proof type: Photo, PIN, Signature.
- Camera/gallery flow with preview and retake.
- Submit button with delivered success animation.
- Completion screen: earnings added, XP gained, next job CTA.

### Earnings / Wallet

Reference: green wallet card from rider home.

Required sections:

- Wallet balance card.
- Cash out.
- Transaction history filters.
- Daily/weekly/monthly earnings chart.
- Tips and bonuses.
- Payout destination management.
- Withdrawal states: pending, processing, paid, failed.

### Community

Required sections:

- Joined zone rooms.
- Zone discovery.
- Forum.
- Events.
- Mentorship.
- Rider spotlights.

Design:

- Make this feel like a rider crew hub, not an admin list.
- Use avatar chips, unread counts, and green active states.

### Training

Required sections:

- Learning center dashboard.
- Mandatory onboarding course.
- Progress cards.
- Certificates.
- Offline/download state.

Visuals:

- Use cartoon learning/rider safety illustrations.
- Progress bars and completion badges should match the profile system.

### Gamification

Required sections:

- Level, XP progress, current title.
- Badges.
- Streak.
- Challenges.
- Leaderboards.
- Rewards store entry.

Behavior:

- Animate XP progress on entry.
- Use achievements as compact cards, not oversized marketing blocks.

### Profile / Account

Reference: supplied Rider App Account Page.

Required sections:

- Avatar/photo with camera edit.
- Name, verified badge, rating, deliveries.
- "Top Rider" achievement band.
- Account overview: member since, city, vehicle type.
- Settings list: personal, vehicle, payout, safety, support, app settings.
- Log out card.

Fix:

- Stop showing placeholder `ghanacard_<uuid>` as the visible phone/account identifier. Prefer Ghana Card label, verified status, phone if present, then email.

### Onboarding

Required sections:

- Checklist overview.
- Documents.
- Selfie.
- Vehicle details.
- Vehicle photos.
- Review status.

Behavior:

- Clear progress bar.
- Each requirement gets status: pending, submitted, rejected, approved.
- Rejection state gives exact next action.

## Client Native Screens

### Auth

Design:

- Use client/main logo and client delivery assets.
- Match current clean dashboard quality, but move all screens onto the same brand tokens.
- Phone/email/Google/PIN flows remain.

### Home

Required sections:

- Brand header.
- Primary actions: Send Package, Buy For Me, Book Ride, Schedule.
- Hero image/illustration from client assets.
- Active order preview.
- Saved addresses.
- Recent orders.
- Promo/referral card.

States:

- First-time user: guided first-order callout.
- Active order: tracking card takes priority.
- No active order: quick-send builder takes priority.

### Quick Send / Order Creation

Required behavior:

- Stepper: pickup, dropoff, package, schedule, payment, confirm.
- Address inputs with map picker and autocomplete.
- Package type icon grid.
- Estimate card sticks near submit.
- Multi-stop builder stays accessible but not visually heavy.

### Tracking

Reference: map phone image in Rider App Dashboard.

Required behavior:

- Full-screen map with rider marker, route, pickup/dropoff.
- Bottom sheet with status, ETA, rider card, chat, call, proof/payment action when relevant.
- Timeline is available from sheet.
- Finding-rider state uses animated radar/search illustration.

### Chat

Required behavior:

- Shared order room with live socket and REST history.
- Visible connection status.
- Message retry if socket ack fails.
- Quick message chips: "I'm outside", "Please call me", "Gate code is...".

### Payment

Required behavior:

- Payment method cards: MoMo, card, wallet, cash.
- Clear post-delivery payment state.
- Paystack result screen.
- Receipt access after completion.

### Rating

Required behavior:

- Rider profile summary.
- Star selector.
- Tip selector.
- Feedback chips plus optional comment.
- Completion thank-you illustration.

### Orders

Required sections:

- Active.
- Scheduled.
- History.
- Canceled/failed.

Behavior:

- Status chips match backend state machine.
- History cards include rating/payment/proof access.

### Wallet

Required sections:

- Balance.
- Add funds.
- Payment methods.
- Transactions.
- Promo credits.

### Account / Settings

Required sections:

- Profile.
- Saved addresses.
- Favorite riders.
- Payment methods.
- Notifications.
- Security/PIN.
- Help.
- Safety.
- About.

## Rider PWA and Client PWA Alignment

The native apps lead this visual pass, then the PWAs should be brought into conformance:

- Replace PWA brand tokens with `#40BE89` primary.
- Use official logo assets consistently.
- Mirror the native information hierarchy on mobile breakpoints.
- Use web-specific density on desktop, but keep the same components and status language.
- PWA install icons must match native launcher icons.

## Map UX Standard

All map experiences should use the same grammar:

- Map fills the available screen.
- UI floats over the map only as top controls and bottom sheet.
- Route colors:
  - Pickup phase: black route line with green pickup marker.
  - Delivery phase: brand green route line with black/white destination marker.
- Rider marker: green vehicle icon with soft pulse.
- Customer marker: black pin with white center.
- Pickup/dropoff markers should be tappable and show address/contact snippets.
- Bottom sheet snap points: compact, half, full.
- Chat/call/safety actions are always reachable during active delivery.

## Responsive Behavior

Phones:

- Bottom tabs remain primary.
- Bottom sheets handle dense details.
- Large touch targets: minimum 44px.

Tablets/foldables:

- Map plus side panel layout where space allows.
- Lists can show detail preview beside them.

Web PWAs:

- Mobile mirrors native.
- Desktop uses two-column operational layouts for dashboard, tracking, and order history.

## Implementation Order

1. Deploy backend patch and verify live behavior. Done.
2. Create shared brand asset folder and design tokens.
3. Generate deterministic app/PWA icons from official logo files.
4. Build shared native UI primitives.
5. Redesign rider home and profile to match supplied references.
6. Redesign rider jobs, job offer, active map, proof, and earnings.
7. Redesign client home, quick send, tracking, chat, payment, rating.
8. Apply same brand/token system to rider/client PWAs.
9. Generate missing illustration assets and wire them into empty states, completion states, and feature entry cards.
10. Rebuild APKs, reinstall on connected Android device, and run end-to-end simulations.

## Verification Matrix

Backend:

- Order creation.
- Manual accept after auto-dispatch starts.
- No timeout revert to `PENDING`.
- Chat persistence.
- Status progression.
- Payment confirmation.
- Proof upload.
- Rating.

Rider native:

- Login/register/recovery.
- Onboarding gates.
- Go online/offline with permissions.
- Job offer accept/decline/timeout.
- Active delivery map.
- Chat/call.
- Proof completion.
- Wallet/withdrawal.
- Community/training/gamification.
- Profile/settings/logout.

Client native:

- Login/register/recovery.
- Quick send and estimate.
- Active tracking.
- Chat/call.
- Payment.
- Rating/tip.
- Order history.
- Wallet.
- Safety/settings.

Visual QA:

- No overlapping text at small phone widths.
- Bottom sheets do not cover critical map markers.
- Header and bottom tabs stay stable.
- Empty/loading/error states are designed.
- Brand green/black/white is consistent.
- Launcher/splash/PWA icons are correct on device.
