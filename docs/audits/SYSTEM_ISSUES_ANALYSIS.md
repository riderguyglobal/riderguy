# RiderGuy PWA — Comprehensive System Issues Analysis

> **Date:** March 3, 2026
> **Source:** Live user feedback (Pastor Eben Darko, product owner) + code audit
> **Scope:** All reported issues + proactively discovered architectural risks

---

## Table of Contents

1. [Reported Issues (User Feedback)](#1-reported-issues-user-feedback)
2. [Proactively Discovered Issues](#2-proactively-discovered-issues)
3. [Architectural Risks](#3-architectural-risks)
4. [Risk Matrix](#4-risk-matrix)

---

## 1. Reported Issues (User Feedback)

### ISSUE-001: Client — "Finding Rider" Status Never Changes to "Rider Found"

| Field | Detail |
|---|---|
| **Reporter** | Pastor Eben Darko |
| **Severity** | 🔴 Critical |
| **Platform** | Client App |
| **Quote** | _"Finding Rider does change even after rider accepts request. Needs to change to rider found once a rider accepts."_ |

**Root Cause Analysis:**

The client tracking page (`apps/client/src/app/(dashboard)/dashboard/orders/[id]/tracking/page.tsx`) listens to `order:updated` socket events and calls `refetch()` to reload order data. When the status transitions from `SEARCHING_RIDER` → `ASSIGNED`, the UI passively updates the step label and badge color — but:

1. **No proactive "Rider Found" celebration** — no sound, no haptic vibration, no banner/toast, no animation
2. **Socket event is `order:updated` but server emits `order:status`** — potential event name mismatch means the client may never receive the real-time update and relies solely on the 15-second polling interval (`refetchInterval: 15000`)
3. **If the user is on a different page or the browser is backgrounded**, there is zero notification that a rider was found
4. **No push notification** is sent from the server for the `ASSIGNED` status transition to the client

**What the user sees:** The "Finding a rider for you..." spinner just keeps spinning. Even after a rider accepts, the client may not see the change for up to 15 seconds (polling delay), and there's no attention-grabbing notification.

**Required Fix:**
- Verify socket event name consistency between server and client (`order:status` vs `order:updated`)
- Add immediate UI transition: success sound, vibration, green "Rider Found!" banner
- Trigger push notification for `ASSIGNED` status change
- Add `document.visibilitychange` listener to refetch immediately on foreground return
- Force immediate refetch when `order:status` socket event fires (not just `refetch()` — also invalidate React Query cache)

---

### ISSUE-002: Rider — Dashboard Reverts to "Waiting for Deliveries" After Accepting Job

| Field | Detail |
|---|---|
| **Reporter** | Pastor Eben Darko |
| **Severity** | 🔴 Critical |
| **Platform** | Rider App |
| **Quote** | _"Once he accepts the ride, it needs to take him from it. So it still reverts back to waiting for deliveries."_ |

**Root Cause Analysis:**

In `apps/rider/src/components/incoming-request.tsx`, the accept handler does:

```tsx
const handleRespond = async (accepted: boolean) => {
  respondToOffer(offer.orderId, accepted);  // Emits socket event (fire-and-forget)
  clearOffer();                              // Closes modal immediately
};
```

Critical problems:
1. **No `router.push()` to the job detail page** — after `clearOffer()`, the rider is dumped back to the dashboard with no navigation
2. **No server confirmation awaited** — `respondToOffer` fires a socket event but doesn't wait for acknowledgment
3. **Dashboard polls active orders every 30 seconds** (`refetchInterval: 30_000`) — the newly accepted order won't appear for up to 30 seconds
4. **No success toast or confirmation message** — rider gets zero feedback that their accept was successful
5. **No error handling** — if another rider already accepted the job, the current rider gets no rejection feedback

**What the rider sees:** The offer modal closes, the dashboard shows "Waiting for deliveries" again, and eventually (after up to 30s) the active order appears in the list. The rider has no idea if the accept worked.

**Required Fix:**
- After successful accept: navigate to `/dashboard/jobs/{orderId}` immediately
- Await server acknowledgment before closing the modal
- Add success toast: "Job accepted! Navigating to delivery..."
- Add error handling: "Sorry, this job was taken by another rider"
- Force immediate refetch of active orders on accept
- Add loading spinner on accept button while waiting for server response

---

### ISSUE-003: Re-Verification on Every Sign-In (Rider App)

| Field | Detail |
|---|---|
| **Reporter** | Pastor Eben Darko |
| **Severity** | 🟡 Medium |
| **Platform** | Rider App |
| **Quote** | _"System still asks me to provide number and verify before signing me in. Once the number has logged in before we don't need to verify the number again at sign in."_ |

**Root Cause Analysis:**

The auth system is actually designed correctly for token persistence:

1. `AuthProvider` checks for existing tokens on mount and auto-restores the session
2. `tokenStorage.hasTokens()` validates JWT expiry and returns `true` if refresh token is still valid
3. Login page redirects to `/dashboard` if `isAuthenticated` is true

However, there are scenarios where the user is forced to re-login:

1. **7-day session expiry:** Both access and refresh tokens expire after 7 days — after that, full re-authentication is required
2. **Browser clears localStorage:** If the user's browser privacy settings auto-clear site data (common on mobile Chrome/Safari), tokens are wiped
3. **PWA re-install or cache clear:** Clearing browser data removes all stored tokens
4. **Server-side session revocation:** If the server restarts or sessions are cleaned, stored tokens become invalid
5. **OTP is the default login method:** Unless the rider has set up PIN or biometric auth, OTP is the only login method — requiring phone verification every time tokens expire

**The real issue is likely:** The rider's tokens expired (possibly due to session cleanup or server restart) and OTP was their only configured login method. The system defaulted to the OTP flow.

**Required Fix:**
- **Strongly encourage PIN/biometric setup during onboarding** — show a setup prompt after first registration
- **Extend session to 30 days** for PWA users (longer-lived refresh tokens for `standalone` display mode)
- **Remember the last-used login method** and auto-route there (partially implemented — uses localStorage `riderguy_preferred_auth_method`)
- **Add "Remember this device" checkbox** during login to set a longer-lived session
- **Add device fingerprinting** — recognize returning devices and skip directly to PIN/biometric
- **Store tokens in IndexedDB as backup** (more persistent than localStorage on some mobile browsers)

---

### ISSUE-004: Same Phone Number Cannot Be Used for Both Client and Rider Accounts

| Field | Detail |
|---|---|
| **Reporter** | Pastor Eben Darko |
| **Severity** | 🟡 Medium |
| **Platform** | API / Database |
| **Quote** | _"You also mentioned that you'd look into the system not allowing one number to be used to create accounts both for Rider and client."_ |

**Root Cause Analysis:**

This is a **design limitation**, not a bug:

1. `User.phone` has a `@unique` constraint in Prisma schema — one phone = one user record
2. `User.role` is a single `UserRole` enum (`CLIENT | RIDER | ADMIN`), not an array
3. Registration explicitly throws `PHONE_EXISTS` if the phone is already registered
4. No "add role" or "switch role" API endpoint exists
5. A rider wanting to send packages must use a different phone number

**Required Fix (two approaches):**

**Option A — Multi-role on single account (recommended):**
- Change `role UserRole` to `roles UserRole[]` in the schema
- Update registration to allow adding a role to an existing account
- Both apps check if user has the appropriate role for the context
- Session/token includes active role; role-switching endpoint needed
- Dashboard shows role switcher in the menu

**Option B — Linked accounts:**
- Allow two separate User records with the same phone number but different roles
- Change `@unique` on phone to a composite unique constraint `@@unique([phone, role])`
- Registration checks `phone + role` instead of just `phone`
- Simpler to implement but means separate profiles, wallets, and histories

---

### ISSUE-005: Online Status Icon Too Large (Interferes with Map Zoom Controls)

| Field | Detail |
|---|---|
| **Reporter** | Pastor Eben Darko |
| **Severity** | 🟢 Low |
| **Platform** | Rider App |
| **Quote** | _"Please reduce size of the online icon. It eats into the Zoom (+/-) for the Map."_ |

**Root Cause Analysis:**

The rider status dot marker in `apps/rider/src/lib/map-markers.ts` (`createRiderStatusDot`) renders as:
- **56×56px** outer container (pulsing ring)
- **40×40px** inner glow layer
- **24×24px** actual dot center

The 56px total footprint with pulsing animation and glow effects is visually dominant. While it's a map marker (moves with the map, not fixed position), at close zoom levels it can visually overlap with or compete for attention against the Mapbox NavigationControl (zoom +/- buttons) which is positioned at `top-right` by default.

**Required Fix:**
- Reduce outer ring from 56px to 36px
- Reduce glow from 40px to 28px
- Reduce dot from 24px to 16px
- Reduce box-shadow spread from `0 0 20px 6px` to `0 0 10px 3px`
- Consider making the animation less aggressive (slower pulse, smaller spread)
- Or: move zoom controls to a different position (e.g., bottom-right)

---

### ISSUE-006: PWA Goes Inactive When Leaving Screen (Phone Call, App Switch)

| Field | Detail |
|---|---|
| **Reporter** | Pastor Eben Darko |
| **Severity** | 🔴 Critical |
| **Platform** | Both Apps (Rider especially) |
| **Quote** | _"When you leave the screen to attend to other things... the page becomes inactive. It has to refresh. And in that moment, if you are in the process of receiving or being connected to a ride, you lose the opportunity."_ |

**Root Cause Analysis:**

This is the most fundamental challenge of a browser-based PWA vs. native app. Several factors contribute:

**A) Browser/OS Throttling:**
- When a PWA is backgrounded, the browser aggressively throttles JavaScript execution
- `setTimeout`/`setInterval` intervals are extended to 1 minute minimum (Chrome)
- WebSocket connections may be dropped after 30-60 seconds of inactivity
- The OS may freeze the page entirely to save memory/battery
- Safari on iOS is particularly aggressive — kills backgrounded PWA processes within ~30 seconds

**B) What Currently Works:**
- Socket.IO has `reconnection: true` with infinite retry
- `use-connection-health.ts` detects `visibilitychange` and sends immediate heartbeat on foreground return
- Service worker registers `periodicsync` for background heartbeats
- `Wake Lock API` is used but only works while the screen is on AND the page is visible

**C) What's Missing:**
1. **Client app has NO `visibilitychange` handler** — only the rider app has `use-connection-health.ts`
2. **No React Query invalidation on foreground return** — data (active orders, offers, status) can be stale for up to 30 seconds after returning to the app
3. **No "missed offers" recovery** — if a `job:offer` arrives while backgrounded, the 30-second timer runs out server-side, the offer expires, and the rider never even sees it
4. **No background push for job offers** — FCM push notification service exists but is not wired to fire for `job:offer` events
5. **GPS `watchPosition` is throttled/killed in background** — location stops updating, causing the rider to appear "stale" to the dispatch system and potentially get marked offline
6. **Wake Lock doesn't work when the screen is off** — only prevents screen dimming while visible
7. **No foreground re-initialization** — when returning, the app should check for missed events, resync state, and reconnect socket, but currently only sends a heartbeat

**D) The Fundamental PWA Limitation:**
Unlike native apps, a browser PWA cannot:
- Run continuous background processes
- Receive real-time socket messages while backgrounded (except via Push API)
- Guarantee JavaScript execution in background
- Access GPS continuously in background (only via service worker on Android with limitations)

**Required Fix (Multi-Layered Approach):**

1. **Push Notifications as Primary Background Channel:**
   - Wire FCM push for `job:offer` events (critical for riders)
   - Wire FCM push for `order:status` changes (critical for clients)
   - Push notification click should open the app and navigate to the relevant screen
   - Show notification with action buttons ("Accept" / "Decline") for job offers

2. **Aggressive Foreground Recovery:**
   - On `visibilitychange` to `visible`: immediately reconnect socket, refetch all critical data, check for missed offers/status changes
   - Add recovery endpoint: `GET /riders/missed-events?since={timestamp}` that returns any events emitted while the rider was backgrounded
   - Invalidate ALL React Query caches on foreground return

3. **Keep-Alive Strategies:**
   - Use Web Audio API silence loop to keep the page alive (plays inaudible audio — prevents iOS from killing the process)
   - Use `navigator.locks.request()` Web Lock API as another keep-alive signal
   - Service worker `fetch` event for periodic self-pinging

4. **Graceful Degradation:**
   - Server should hold `job:offer` with delivery confirmation (not just fire-and-forget)
   - If socket delivery fails, fall back to push notification delivery
   - If push delivery fails, add to a pending queue that the rider sees on foreground return
   - Show "You were away - checking for updates..." banner when returning from background

---

## 2. Proactively Discovered Issues

### ISSUE-007: Socket Event Name Mismatch (Client)

| Field | Detail |
|---|---|
| **Severity** | 🔴 Critical |
| **Platform** | Client App ↔ API |

The client tracking page listens for `order:updated` but the server (`socket/index.ts`) emits `order:status` for status changes. If these are different events (and `order:updated` is not emitted by the server), the client would **never receive real-time status updates** and would rely entirely on the 15-second polling interval.

**Action:** Verify whether `order:updated` is emitted anywhere in the API codebase. If not, change client to listen for `order:status`.

---

### ISSUE-008: No Client-Side Chat Component

| Field | Detail |
|---|---|
| **Severity** | 🟡 Medium |
| **Platform** | Client App |

The rider app has `delivery-chat.tsx` for in-delivery messaging, but the client app has **no equivalent component**. Socket events `message:send` and `message:new` are wired in the API, but clients cannot send or receive delivery chat messages through the UI.

**Action:** Build `delivery-chat.tsx` for the client app, mirroring the rider's implementation.

---

### ISSUE-009: No Payment Gateway Charge Flow (Client)

| Field | Detail |
|---|---|
| **Severity** | 🟡 Medium |
| **Platform** | Client App |

The client order creation flow collects `paymentMethod` (Mobile Money, Card, Cash) but does **not** trigger an actual Paystack/Flutterwave charge. The order is created with `PENDING` payment status. The `payment.service.ts` exists on the API with Paystack integration, but the client-side charge initialization flow (redirect to Paystack, handle callback) is not implemented.

**Action:** Implement Paystack charge flow on the client send page, with webhook callback handling on the API.

---

### ISSUE-010: In-Memory Presence (No Redis)

| Field | Detail |
|---|---|
| **Severity** | 🟡 Medium |
| **Platform** | API |

Rider presence (`presence.service.ts`) uses an in-memory `Map`. In a multi-instance deployment:
- Rider presence data is NOT shared across API instances
- Auto-dispatch would only see riders connected to the same instance
- A server restart wipes all presence data (recovered from DB on restart, but with stale data)

The build plan specifies Redis but it's not implemented.

**Action:** Implement Redis-based presence when scaling horizontally.

---

### ISSUE-011: No Offline Status Transition Queue (Rider)

| Field | Detail |
|---|---|
| **Severity** | 🟡 Medium |
| **Platform** | Rider App |

During an active delivery, status transitions (`PICKUP_EN_ROUTE → AT_PICKUP → PICKED_UP → IN_TRANSIT → AT_DROPOFF → DELIVERED`) require active network connectivity. If the rider loses connectivity during a delivery (common in rural Ghana), they cannot advance the delivery status.

**Action:** Queue status transitions in IndexedDB via the service worker. Flush queued transitions when connectivity returns, in order.

---

### ISSUE-012: `job:new` Broadcasts to ALL Riders (No Zone Targeting)

| Field | Detail |
|---|---|
| **Severity** | 🟢 Low |
| **Platform** | API |

The socket server broadcasts `job:new` to the entire `role:RIDER` room. A comment in the code notes that zone-targeting wasn't working. This means every online rider receives every new job notification, regardless of their location or zone.

**Action:** Implement zone-based job broadcasting. Only emit `job:new` to riders within a configurable radius of the pickup location.

---

### ISSUE-013: Service Worker In-Memory Queues

| Field | Detail |
|---|---|
| **Severity** | 🟢 Low |
| **Platform** | Both Apps |

Both service workers use plain JavaScript arrays (`pendingLocations`, `pendingOrderChecks`) for queuing. If the browser terminates the service worker (which it can do at any time), queued items are permanently lost.

**Action:** Replace in-memory arrays with IndexedDB-backed queues (e.g., using `idb-keyval` or Workbox's built-in Background Sync queue).

---

### ISSUE-014: No Forgot-PIN Recovery Flow

| Field | Detail |
|---|---|
| **Severity** | 🟢 Low |
| **Platform** | Rider App |

If a rider forgets their 6-digit PIN:
- They can still log in via OTP (backup method)
- But there's no "Reset PIN" flow — no UI to change PIN after authenticating via OTP
- The only workaround is to sign in with OTP every time

**Action:** Add a "Reset PIN" option accessible after OTP-based authentication.

---

### ISSUE-015: No Phone Number Change Flow

| Field | Detail |
|---|---|
| **Severity** | 🟢 Low |
| **Platform** | Both Apps |

Users cannot change their phone number after registration. No API endpoint or UI exists for phone number updates. If a user changes their SIM, they lose access to their account (unless they use PIN or biometric login).

**Action:** Add secure phone number change flow: authenticate → verify new number via OTP → update.

---

### ISSUE-016: Neon/PgBouncer Transaction Limitation

| Field | Detail |
|---|---|
| **Severity** | 🟡 Medium |
| **Platform** | API / Database |

Neon's PgBouncer proxy doesn't support Prisma interactive transactions. All multi-step writes (e.g., creating a user + profile + wallet) are sequential with manual rollback on failure. This creates race conditions, especially in:
- User registration (User + Profile + Wallet creation)
- Order acceptance (status update + rider assignment)
- Payment processing (order update + wallet credit + transaction record)

**Current Mitigation:** `updateMany` with WHERE guards to prevent concurrent modifications. Acceptable at current scale.

**Future Action:** Use Neon's direct connection string for transactional operations, or switch to direct PostgreSQL when outgrowing Neon.

---

### ISSUE-017: Location Throttle Resets on Socket Reconnect

| Field | Detail |
|---|---|
| **Severity** | 🟢 Low |
| **Platform** | API |

The 3-second location update throttle in the socket server is stored in an in-memory variable per socket. When a rider's socket disconnects and reconnects, the throttle resets, allowing a burst of location updates. Not a security issue but wastes bandwidth and DB writes.

**Action:** Move throttle to presence service (keyed by userId, not socketId).

---

## 3. Architectural Risks

### RISK-001: PWA Background Execution is Fundamentally Limited

**The core challenge:** Browser-based PWAs cannot replicate native app background behavior. This affects:
- **Rider availability:** Riders who background the app may be lost to the dispatch system
- **Real-time notifications:** Job offers arrive via WebSocket, which is killed in background
- **GPS tracking:** Location updates stop when the app is backgrounded
- **Competitive disadvantage:** Competing ride-hailing apps are native and don't have this limitation

**Mitigation Strategy:**
1. Push notifications as the primary background communication channel
2. Audio keep-alive to prevent page suspension (silent audio loop)
3. Web Locks API (`navigator.locks.request`) for additional keep-alive
4. Server-side resilience: hold job offers, retry on reconnection, missed-events endpoint
5. Long-term: Consider wrapping the PWA in a native shell (TWA for Android, Capacitor/Ionic) for critical background capabilities

---

### RISK-002: Single Server / No Horizontal Scaling

**Current state:** One Express server handles everything — HTTP, WebSocket, presence, dispatch, notifications.

**Risks:**
- Server restart = all socket connections dropped + all presence data lost (recovered from DB)
- No load balancing for WebSocket connections
- In-memory presence means no multi-instance support
- All auto-dispatch scoring happens in a single process

**Mitigation:** Accept for MVP launch. Plan Redis adapter for Socket.IO and Redis-based presence for Phase 2 scaling.

---

### RISK-003: No Rate Limiting or Abuse Prevention

**Current state:** No rate limiting on:
- OTP requests (an attacker could drain mNotify SMS credits)
- Login attempts (beyond the 5-attempt OTP limit)
- API endpoints (no request throttling)
- WebSocket messages (no message rate limiting beyond location throttle)

**Mitigation:** Implement rate limiting before public launch. Use `express-rate-limit` for HTTP, socket.io middleware for WebSocket.

---

### RISK-004: No End-to-End Encryption for Messages

Delivery chat messages are sent via WebSocket and stored in the database in plaintext. This is typically acceptable for delivery messaging but should be noted for compliance.

---

### RISK-005: JWT Secret Rotation

No mechanism exists for rotating JWT secrets without invalidating all active sessions. A secret compromise would require restarting the server with a new secret, logging out all users.

---

## 4. Risk Matrix

| ID | Issue | Severity | Impact | Effort | Priority |
|----|-------|----------|--------|--------|----------|
| ISSUE-001 | "Finding Rider" status not updating | 🔴 Critical | Users think no rider is coming | Small | **P0** |
| ISSUE-002 | Rider dashboard reverts after accept | 🔴 Critical | Riders don't know job was accepted | Small | **P0** |
| ISSUE-006 | PWA goes inactive in background | 🔴 Critical | Riders miss jobs, clients miss updates | Large | **P0** |
| ISSUE-007 | Socket event name mismatch | 🔴 Critical | Real-time updates don't work | Tiny | **P0** |
| ISSUE-003 | Re-verification on sign-in | 🟡 Medium | Poor returning-user experience | Medium | **P1** |
| ISSUE-004 | Same phone, dual role | 🟡 Medium | Users need two phones | Large | **P1** |
| ISSUE-008 | No client chat component | 🟡 Medium | Clients can't message riders | Medium | **P1** |
| ISSUE-009 | No payment charge flow | 🟡 Medium | Can't actually collect payment | Large | **P1** |
| ISSUE-010 | In-memory presence | 🟡 Medium | Can't scale horizontally | Medium | **P2** |
| ISSUE-011 | No offline status queue | 🟡 Medium | Riders stuck in rural areas | Medium | **P2** |
| ISSUE-016 | Transaction race conditions | 🟡 Medium | Rare data inconsistencies | Medium | **P2** |
| ISSUE-005 | Online icon too large | 🟢 Low | Minor visual annoyance | Tiny | **P1** |
| ISSUE-012 | No zone-targeted broadcasts | 🟢 Low | Unnecessary notifications | Small | **P2** |
| ISSUE-013 | SW in-memory queues | 🟢 Low | Rare data loss | Small | **P2** |
| ISSUE-014 | No forgot-PIN flow | 🟢 Low | Minor inconvenience | Small | **P2** |
| ISSUE-015 | No phone change flow | 🟢 Low | Locked to original SIM | Medium | **P3** |
| ISSUE-017 | Location throttle reset | 🟢 Low | Minor bandwidth waste | Tiny | **P3** |
| RISK-001 | PWA background limits | 🔴 Critical | Fundamental platform risk | Ongoing | **P0** |
| RISK-002 | No horizontal scaling | 🟡 Medium | Can't handle growth | Large | **P2** |
| RISK-003 | No rate limiting | 🟡 Medium | Abuse potential | Medium | **P1** |
| RISK-004 | No message encryption | 🟢 Low | Compliance concern | Medium | **P3** |
| RISK-005 | No JWT rotation | 🟢 Low | Security concern | Small | **P3** |

---

*This document should be reviewed alongside the [PHASE_FIX_PLAN.md](PHASE_FIX_PLAN.md) for the implementation roadmap.*
