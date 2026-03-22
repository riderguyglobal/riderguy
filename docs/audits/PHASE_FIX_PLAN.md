# RiderGuy PWA — Phased Fix Plan

> **Date:** March 3, 2026
> **Reference:** [SYSTEM_ISSUES_ANALYSIS.md](SYSTEM_ISSUES_ANALYSIS.md)
> **Approach:** Ship critical fixes first, iterate fast, validate with user testing after each phase

---

## Overview

| Phase | Focus | Duration | Issues Addressed |
|-------|-------|----------|-----------------|
| **Phase A** | Critical UX Fixes (Showstoppers) | 2-3 days | ISSUE-001, 002, 005, 007 |
| **Phase B** | Background Resilience & Notifications | 3-5 days | ISSUE-006, RISK-001 |
| **Phase C** | Auth & Account Improvements | 2-3 days | ISSUE-003, 004, RISK-003 |
| **Phase D** | Feature Completions | 3-5 days | ISSUE-008, 009, 014 |
| **Phase E** | Reliability & Scaling Prep | 2-3 days | ISSUE-010, 011, 012, 013, 016, 017 |

**Total estimated duration:** ~2-3 weeks (working in order of priority)

---

## Phase A — Critical UX Fixes (Showstoppers)

> **Goal:** Fix the core ride flow so both client and rider see correct, real-time status updates.
> **Timeline:** 2-3 days
> **Deploy after:** Yes — deploy immediately after Phase A

### A1. Fix Socket Event Name Mismatch (ISSUE-007)

**Priority:** P0 | **Effort:** ~30 minutes

**Task:** Audit all socket event names across the entire codebase. Ensure the client app listens for the exact events the server emits.

**Files to check:**
- `apps/api/src/socket/index.ts` — what events does the server emit?
- `apps/client/src/hooks/use-socket.ts` — what events does the client listen for?
- `apps/client/src/app/(dashboard)/dashboard/orders/[id]/tracking/page.tsx` — `order:updated` vs `order:status`
- `apps/rider/src/hooks/use-socket.ts` — same audit for rider

**Acceptance criteria:**
- [ ] All socket event names are consistent between server and clients
- [ ] Real-time status updates arrive instantly (not delayed by polling)

---

### A2. Client "Rider Found" Notification (ISSUE-001)

**Priority:** P0 | **Effort:** ~4 hours

**Task:** When order status changes from `SEARCHING_RIDER` → `ASSIGNED`, show a clear, attention-grabbing notification.

**Changes:**

1. **Tracking page** (`apps/client/src/app/(dashboard)/dashboard/orders/[id]/tracking/page.tsx`):
   - Listen for `order:status` socket event (fix event name per A1)
   - On `ASSIGNED` status, show a "Rider Found!" celebration:
     - Success toast with rider name
     - Sound notification (Web Audio API — short chime)
     - Vibration (`navigator.vibrate([200, 100, 200])`)
     - Smooth UI transition from "searching" spinner to rider details card
   - Force immediate React Query cache invalidation + refetch

2. **Order confirmation** (`apps/client/src/components/order-confirmation.tsx`):
   - If this component is visible during the transition, animate it to show rider details
   - Add a pulsing "Searching for rider..." state with animated dots
   - Transition to green "Rider Found! 🎉" with rider info

3. **Foreground detection** (new or extend existing):
   - Add `document.visibilitychange` listener to the tracking page
   - On return to foreground: force refetch of order data, reconnect socket if needed

**Acceptance criteria:**
- [ ] User sees "Rider Found!" banner within 2 seconds of assignment
- [ ] Sound + vibration play on rider assignment
- [ ] Works even if user was briefly on a different tab
- [ ] Polling is still active as a fallback (keep `refetchInterval` but reduce to 5s while in `SEARCHING_RIDER` state)

---

### A3. Rider — Navigate to Job After Accepting (ISSUE-002)

**Priority:** P0 | **Effort:** ~4 hours

**Task:** After rider accepts a job offer, navigate them to the active delivery page with proper feedback.

**Changes:**

1. **Incoming request modal** (`apps/rider/src/components/incoming-request.tsx`):
   ```tsx
   const handleRespond = async (accepted: boolean) => {
     if (!offer || responding) return;
     setResponding(true);
     
     try {
       // Await server acknowledgment
       const result = await respondToOfferAsync(offer.orderId, accepted);
       
       if (accepted && result.success) {
         // Success feedback
         toast.success('Job accepted! Loading delivery details...');
         
         // Navigate to job page
         router.push(`/dashboard/jobs/${offer.orderId}`);
       } else if (accepted && !result.success) {
         // Job already taken
         toast.error(result.message || 'This job was already taken by another rider');
       }
     } catch (error) {
       toast.error('Failed to respond. Please try again.');
     } finally {
       clearOffer();
       setResponding(false);
     }
   };
   ```

2. **Socket response handler** (modify `respondToOffer` or create `respondToOfferAsync`):
   - Use Socket.IO acknowledgement callback: `socket.emit('job:offer:respond', data, (ack) => { ... })`
   - Server should respond with `{ success: boolean, message?: string }`

3. **Server side** (`apps/api/src/socket/index.ts`):
   - Add acknowledgement callback to `job:offer:respond` handler
   - Return `{ success: true }` on successful assignment
   - Return `{ success: false, message: 'Job already taken' }` on conflict

4. **Dashboard active orders** (`apps/rider/src/app/(dashboard)/dashboard/page.tsx`):
   - Reduce `refetchInterval` from 30s to 10s for active orders
   - Add manual refetch trigger on `job:offer:respond` success

**Acceptance criteria:**
- [ ] Rider sees loading spinner on "Accept" button while waiting for server response
- [ ] On successful accept: toast message + automatic navigation to job detail page
- [ ] On failed accept (job taken): error toast, modal closes, back to dashboard
- [ ] Dashboard active orders list updates within 5 seconds

---

### A4. Reduce Online Status Icon Size (ISSUE-005)

**Priority:** P1 | **Effort:** ~30 minutes

**Task:** Reduce the rider status dot marker size on the map.

**Changes in** `apps/rider/src/lib/map-markers.ts` (`createRiderStatusDot`):
- Outer container: 56px → 36px
- Glow layer: 40px → 24px
- Dot center: 24px → 14px
- Box shadow: `0 0 20px 6px` → `0 0 8px 3px`
- Pulse animation: reduce spread by 40%

**Acceptance criteria:**
- [ ] Status dot is visually distinct but no longer competes with map controls
- [ ] Pulse animation is subtle, not distracting
- [ ] Still clearly visible on all map zoom levels

---

### Phase A Checklist
- [ ] A1: Socket events consistent
- [ ] A2: "Rider Found" notification working
- [ ] A3: Rider navigates to job after accept
- [ ] A4: Status icon reduced
- [ ] **Deploy to staging → User test with Pastor Darko → Deploy to production**

---

## Phase B — Background Resilience & Push Notifications

> **Goal:** Ensure the app stays functional when backgrounded and delivers critical notifications.
> **Timeline:** 3-5 days
> **Dependencies:** Phase A must be complete

### B1. Push Notification Infrastructure

**Priority:** P0 | **Effort:** ~1 day

**Task:** Wire FCM push notifications for critical events.

**Changes:**

1. **Firebase setup:**
   - Add Firebase config to both client and rider apps
   - Register service worker for push notification handling
   - Add `PushManager.subscribe()` to service workers
   - Store push subscription endpoint in the User model

2. **Server push triggers** (`apps/api/src/services/notification.service.ts`):
   - `job:offer` → Push to rider: "New delivery request! [pickup] → [dropoff]" with Accept/Decline actions
   - `ASSIGNED` status → Push to client: "Rider found! [rider name] is on the way"
   - `PICKED_UP` → Push to client: "Your package has been picked up!"
   - `DELIVERED` → Push to client: "Delivery complete! Rate your experience"
   - `AT_PICKUP` → Push to client: "Rider has arrived at pickup location"

3. **Notification actions:**
   - Rider: "Accept" action on job offer → opens app to job detail
   - Client: "Track" action on status update → opens app to tracking page

**Acceptance criteria:**
- [ ] Push notifications arrive even when app is completely closed
- [ ] Notification click opens the correct in-app screen
- [ ] Job offer notification has Accept/Decline action buttons
- [ ] Notifications work on Android Chrome and iOS Safari (with limitations documented)

---

### B2. Foreground Recovery System

**Priority:** P0 | **Effort:** ~1 day

**Task:** When user returns to the app after backgrounding, immediately resync all state.

**Changes:**

1. **Create `useForegroundRecovery` hook** (shared or per-app):
   ```tsx
   function useForegroundRecovery() {
     useEffect(() => {
       const handleVisibility = () => {
         if (document.visibilityState === 'visible') {
           // 1. Force socket reconnect if disconnected
           socket.connect();
           
           // 2. Invalidate all React Query caches
           queryClient.invalidateQueries();
           
           // 3. Re-acquire wake lock
           requestWakeLock();
           
           // 4. Show "Reconnecting..." banner if socket is disconnected
           if (!socket.connected) {
             showReconnectBanner();
           }
           
           // 5. Check for missed events
           fetchMissedEvents(lastEventTimestamp);
         }
       };
       document.addEventListener('visibilitychange', handleVisibility);
       return () => document.removeEventListener('visibilitychange', handleVisibility);
     }, []);
   }
   ```

2. **Add to client app** (currently missing entirely):
   - Add `visibilitychange` listener in the layout or tracking page
   - Refetch active order data on foreground return
   - Reconnect socket

3. **Add to rider app** (extend `use-connection-health.ts`):
   - Current implementation only sends heartbeat — also invalidate queries and check for missed offers

4. **Server: missed-events endpoint:**
   - `GET /api/v1/riders/missed-events?since=<timestamp>` — returns recent events for this rider
   - Stores last N events per rider in memory (or Redis in Phase E)

**Acceptance criteria:**
- [ ] Returning to the app after 1 minute background: data refreshed within 2 seconds
- [ ] Socket reconnects automatically (existing) + all queries refresh (new)
- [ ] "Reconnecting..." banner shown while socket is reconnecting
- [ ] No full page reload required

---

### B3. Audio Keep-Alive (Anti-Suspension)

**Priority:** P0 | **Effort:** ~4 hours

**Task:** Prevent mobile browsers from suspending the PWA using silent audio playback.

**Changes:**

1. **Create `useAudioKeepAlive` hook** for the rider app:
   ```tsx
   function useAudioKeepAlive(isOnline: boolean) {
     useEffect(() => {
       if (!isOnline) return;
       
       const ctx = new AudioContext();
       const oscillator = ctx.createOscillator();
       const gain = ctx.createGain();
       gain.gain.value = 0.001; // Inaudible
       oscillator.connect(gain);
       gain.connect(ctx.destination);
       oscillator.start();
       
       return () => {
         oscillator.stop();
         ctx.close();
       };
     }, [isOnline]);
   }
   ```

2. **Activate when rider is ONLINE** — keeps browser process alive during phone calls, app switches
3. **Deactivate when rider goes OFFLINE** — don't drain battery when not needed

**Acceptance criteria:**
- [ ] PWA stays active during 2-minute phone call (Android Chrome)
- [ ] No audible sound
- [ ] Battery impact is negligible
- [ ] Deactivates cleanly when rider goes offline

---

### B4. Job Offer Resilience

**Priority:** P0 | **Effort:** ~4 hours

**Task:** Ensure riders don't permanently miss job offers due to background state.

**Changes:**

1. **Server:** If socket delivery of `job:offer` fails (no ACK within 3s), send FCM push notification as fallback
2. **Server:** If rider responds to an expired offer within 10 seconds of expiry, still attempt to assign (grace period)
3. **Rider app:** On foreground return, check `GET /riders/pending-offers` for any outstanding offers
4. **Rider app:** Show "Missed offer" summary if offers expired while backgrounded

**Acceptance criteria:**
- [ ] Rider receives push notification for job offers when app is backgrounded
- [ ] Returning to app shows any pending/missed offers
- [ ] 10-second grace period on expired offers

---

### Phase B Checklist
- [ ] B1: Push notifications working for critical events
- [ ] B2: Foreground recovery resynchronizes state
- [ ] B3: Audio keep-alive prevents suspension (rider app)
- [ ] B4: Job offers survive background transitions
- [ ] **Deploy → User test → Production**

---

## Phase C — Auth & Account Improvements

> **Goal:** Smooth the login experience and enable dual-role accounts.
> **Timeline:** 2-3 days

### C1. Persistent Sessions & Login Experience (ISSUE-003)

**Priority:** P1 | **Effort:** ~1 day

**Changes:**

1. **Extend refresh token TTL for PWA users:**
   - Detect `display-mode: standalone` in the auth flow
   - Set refresh token to 30-day expiry for PWA (vs. 7-day for browser)

2. **Encourage PIN/biometric setup:**
   - After first successful OTP login: show "Set up quick login" prompt
   - Offer PIN setup (6-digit) and biometric registration
   - Store `riderguy_setup_completed` flag to not re-prompt
   - Show benefits: "Sign in instantly without SMS codes"

3. **Token persistence improvements:**
   - Store tokens in both `localStorage` and `IndexedDB` (redundancy)
   - On load: check both stores, prefer IndexedDB if localStorage was cleared
   - Add `remember me` flag that extends session duration

4. **Rate limiting on OTP requests** (RISK-003):
   - Max 3 OTP requests per phone per 15 minutes
   - Max 10 OTP requests per IP per hour
   - Show countdown timer after OTP send: "Resend in XX seconds"

**Acceptance criteria:**
- [ ] Returning PWA user is auto-logged in for 30 days
- [ ] New users are prompted to set up PIN/biometric after first login
- [ ] OTP requests are rate-limited
- [ ] Login method preference is remembered

---

### C2. Multi-Role Account Support (ISSUE-004)

**Priority:** P1 | **Effort:** ~1.5 days

**Changes:**

1. **Database schema migration:**
   ```prisma
   model User {
     // Change: role UserRole → roles UserRole[]
     roles    UserRole[]  @default([])
     activeRole UserRole?  // Currently active role for session context
   }
   ```

2. **Registration flow update:**
   - When registering with a phone that already exists:
     - Check if the existing account has the requested role
     - If different role: prompt "This number is already registered as a [CLIENT]. Would you like to add [RIDER] access?"
     - If yes: add role to array, create the appropriate profile (RiderProfile or ClientProfile)
   - Remove `PHONE_EXISTS` error for different-role registration

3. **Login flow update:**
   - If user has multiple roles: after authentication, show role picker
   - Set `activeRole` in JWT claims
   - Each app validates that the user has the required role

4. **API auth middleware:**
   - Check `roles.includes(requiredRole)` instead of `role === requiredRole`
   - `activeRole` determines which profile/context is used for the session

**Acceptance criteria:**
- [ ] Same phone can register as both CLIENT and RIDER
- [ ] Existing users can add the other role without re-registering
- [ ] Login on client app auto-selects CLIENT role
- [ ] Login on rider app auto-selects RIDER role
- [ ] Separate profiles, wallets, and histories per role

---

### Phase C Checklist
- [ ] C1: Persistent sessions, PIN/biometric promotion, rate limiting
- [ ] C2: Multi-role account support
- [ ] **Deploy → User test → Production**

---

## Phase D — Feature Completions

> **Goal:** Complete missing features needed for launch.
> **Timeline:** 3-5 days

### D1. Client Delivery Chat (ISSUE-008)

**Priority:** P1 | **Effort:** ~6 hours

**Task:** Build `delivery-chat.tsx` for the client app, mirroring the rider's existing implementation.

**Changes:**
- Copy and adapt `apps/rider/src/components/delivery-chat.tsx` to `apps/client/src/components/delivery-chat.tsx`
- Add chat button/panel to the order tracking page
- Wire `message:send` and `message:new` socket events
- Add unread message badge indicator
- Support text messages only (no media for MVP)

**Acceptance criteria:**
- [ ] Client can send messages to assigned rider during active delivery
- [ ] Messages appear in real-time on both sides
- [ ] Chat history persists for the duration of the delivery

---

### D2. Payment Gateway Integration (ISSUE-009)

**Priority:** P1 | **Effort:** ~2 days

**Task:** Complete the Paystack charge flow for Mobile Money and Card payments.

**Changes:**

1. **Client send page** — after order confirmation:
   - For Mobile Money: Initialize Paystack charge with `mobile_money` channel
   - For Card: Initialize Paystack charge with `card` channel
   - For Cash: Skip payment flow, mark as `PAY_ON_DELIVERY`

2. **Paystack popup/redirect:**
   - Use Paystack inline JS SDK for seamless in-app payment
   - Handle success callback → update order payment status
   - Handle failure/close → show retry option or allow Cash fallback

3. **Webhook handler** (`apps/api/src/routes/webhooks.ts`):
   - `POST /webhooks/paystack` — verify signature, update payment + order status
   - Idempotent processing (handle duplicate webhooks)
   - Credit rider wallet on delivery completion

**Acceptance criteria:**
- [ ] Mobile Money payment works end-to-end (MTN, Vodafone Cash, AirtelTigo)
- [ ] Card payment works end-to-end
- [ ] Cash/pay-on-delivery option available
- [ ] Webhook properly credits rider after delivery completion
- [ ] Failed payments don't block order creation (retry available)

---

### D3. Forgot-PIN Recovery (ISSUE-014)

**Priority:** P2 | **Effort:** ~3 hours

**Task:** Allow riders to reset their PIN after authenticating via OTP.

**Changes:**
- Add "Forgot PIN?" link on the PIN login screen
- Flow: enter phone → receive OTP → verify → set new PIN
- API endpoint: `POST /auth/pin/reset` (requires verified OTP within 15 minutes)
- Reuses existing OTP verification infrastructure

**Acceptance criteria:**
- [ ] Rider can reset PIN via OTP verification
- [ ] New PIN is set and usable immediately

---

### Phase D Checklist
- [ ] D1: Client delivery chat
- [ ] D2: Payment gateway integration
- [ ] D3: Forgot-PIN recovery
- [ ] **Deploy → User + payment provider test → Production**

---

## Phase E — Reliability & Scaling Prep

> **Goal:** Harden the system for growth and edge cases.
> **Timeline:** 2-3 days

### E1. Redis Integration (ISSUE-010)

- Add Redis for rider presence (shared across instances)
- Add Redis adapter for Socket.IO (enables multi-instance WebSocket)
- Add Redis for rate limiting (distributed counters)
- Add Redis for session caching (reduce DB load)

### E2. Offline Status Queue (ISSUE-011)

- Queue delivery status transitions in IndexedDB when offline
- Flush queued transitions on connectivity return (in order)
- Show "Offline — status will update when connected" indicator
- Service worker handles background sync of queued transitions

### E3. Zone-Targeted Job Broadcasts (ISSUE-012)

- Only broadcast `job:new` to riders within configurable radius of pickup
- Use rider GPS from presence service to filter

### E4. IndexedDB Service Worker Queues (ISSUE-013)

- Replace in-memory arrays in service workers with IndexedDB
- Use `idb-keyval` or Workbox Background Sync

### E5. Location Throttle Fix (ISSUE-017)

- Move throttle from per-socket to per-userId in presence service

### E6. API Rate Limiting (RISK-003)

- `express-rate-limit` on all endpoints
- Stricter limits on auth/OTP endpoints
- Socket.IO rate limiting middleware

---

### Phase E Checklist
- [ ] E1: Redis for presence + Socket.IO
- [ ] E2: Offline status queue
- [ ] E3: Zone-targeted broadcasts
- [ ] E4: IndexedDB SW queues
- [ ] E5: Location throttle fix
- [ ] E6: Rate limiting
- [ ] **Deploy → Load test → Production**

---

## Execution Order Summary

```
Week 1 (Days 1-3):   Phase A — Critical UX Fixes
                      ↳ Deploy + User Test
                      
Week 1-2 (Days 3-7): Phase B — Background Resilience
                      ↳ Deploy + User Test

Week 2 (Days 7-10):  Phase C — Auth & Account
                      ↳ Deploy + User Test

Week 2-3 (Days 10-14): Phase D — Feature Completions
                        ↳ Deploy + Payment Test

Week 3 (Days 14-17): Phase E — Reliability & Scaling
                      ↳ Deploy + Load Test
```

---

## Testing Protocol (After Each Phase)

1. **Developer smoke test** on staging environment
2. **Send staging links to Pastor Darko** for user acceptance testing
3. **Collect feedback** via WhatsApp (existing channel)
4. **Fix critical issues** found during testing
5. **Deploy to production** only after user sign-off

---

## Download Links (Requested)

Both apps are PWAs — provide installable links:
- **Client App:** `https://[client-domain]/` — user taps "Add to Home Screen" or install prompt
- **Rider App:** `https://[rider-domain]/` — same installation process

Generate short shareable links and share install instructions with Pastor Darko. Include screenshots of the install process for both Android and iOS.

---

*This plan references issues documented in [SYSTEM_ISSUES_ANALYSIS.md](SYSTEM_ISSUES_ANALYSIS.md)*
