# Native Apps Comprehensive Audit — 2026-06-11

> Historical snapshot: the Hetzner server described in sections 6–8 was later
> lost with the former account and is no longer available. The native apps remain
> the active products; use `docs/operations/NEW_SERVER_RESET.md` for the current
> infrastructure state.

Scope: full audit of the RiderGuy Rider native app (`apps/rider-native`, `com.riderguy.rider`)
and the RiderGuy client native app (`apps/client-native`, `com.riderguy.client`), the API they
depend on, the Google Play Console configuration for both, and the PWA → native transition.

---

## 1. What was audited

- **Every screen** of rider-native (28 route files: auth landing/login/register/recovery,
  home online/offline dashboards, job feed, job detail, job offer, proof of delivery,
  order chat, earnings + withdrawals, cancellations + appeals, gamification, training,
  community (tab, forum, events, mentorship, zone chat), onboarding (hub, documents,
  selfie, vehicle, vehicle photos), notifications, account, settings (profile, PINs,
  about, delete account), deep-link handlers (reset password, verify email, Google callback)).
- **Every screen** of client-native (32 route files: auth, home, quick-send booking flow,
  orders list/detail/tracking/payment/rate, chat, wallet + add-funds, saved addresses,
  favorite riders, scheduled deliveries, promos, notifications, safety center, settings).
- **API surface cross-check**: every endpoint either app calls was diffed against the
  routes the Express API actually serves (23 route modules). Socket.IO event names used
  by the apps were diffed against the backend socket handlers/emitters.
- **Type safety**: `tsc --noEmit` for rider-native, client-native, and the API.
- **Play Console state** for both packages via the Android Publisher API (tracks,
  releases, listings, contact details, bundles, store graphics).
- **Android packaging**: AndroidManifest, Gradle config, permissions, signing, versioning.

## 2. Issues found and fixed (code)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | **Critical** | **Push notifications were completely broken in both apps.** The backend delivers push via Firebase Admin (`fcm.sendEachForMulticast`) to raw FCM device tokens, but both apps registered an **Expo push token** (`ExponentPushToken[…]`), which FCM cannot deliver to. No rider would ever get a job-offer push with the app in background. | Rewrote `usePushNotifications.ts` in both apps to register `messaging().getToken()` (FCM), re-register on `onTokenRefresh`, mirror foreground FCM messages as local notifications, and deep-link on notification tap (`orderId` → job/order screen) incl. background and cold-start taps. |
| 2 | **High** | **Offline app launch logged riders out.** `AuthProvider.restoreSession` cleared stored tokens on *any* `/auth/me` failure — including plain network failures (no data, flaky connection). | Tokens are now only cleared when the server explicitly rejects the session (401/403); transient network errors keep the session for the next launch. (`packages/auth-native/src/AuthProvider.tsx`) |
| 3 | **High** | **Rider home "Today" earnings always showed GHS 0.00.** The app reads `wallet.todayEarnings` but `GET /wallets` returned the raw DB wallet (no such field). | API now aggregates today's `DELIVERY_EARNING`/`TIP`/`BONUS` transactions (Ghana = UTC) and returns `todayEarnings` with the wallet. (`apps/api/src/routes/wallets/wallet.routes.ts`) |
| 4 | Medium | FCM messages had no Android channel/priority, so delivery in Doze and heads-up behaviour were unreliable. | Backend now sends `android: { priority: 'high', notification: { channelId, sound, vibrate } }`. (`apps/api/src/services/push.service.ts`) |
| 5 | Medium | Client quick-send fallback geocoding called `GET /places/autocomplete` (doesn't exist → 404) and `/places/reverse-geocode` with `lat/lng` params (API expects `latitude/longitude` → 400). | Fallbacks now call `/places/search?q=` and send correct param names. (`apps/client-native/app/(app)/quick-send.tsx`) |
| 6 | Low | Rider account screen showed hardcoded "Member Since Jan 2024", an unconditional "You're a Top Rider!" banner, and never displayed the user's real avatar. | Member-since derives from `user.createdAt`; banner copy is rating/deliveries-aware; avatar uses `user.avatarUrl` when present. (`apps/rider-native/app/(tabs)/account.tsx`) |

**Verified clean after fixes:** `tsc --noEmit` exits 0 for rider-native, client-native, and the API.

## 3. What was audited and found healthy

- **Endpoint contract**: all ~90 distinct REST calls across both apps match served routes,
  methods, and body shapes (incl. cancellation appeals `{statement, evidenceUrls}`,
  rate `{rating, review, tipAmount}`, withdraw, top-up + Paystack verify flows).
- **Socket contract**: `job:offer`, `job:offer:respond` (with ack + REST accept fallback),
  `job:offer:taken`, `order:subscribe/unsubscribe`, `order:status`, `message:send/new`,
  `rider:updateLocation`, `rider:location` all line up app ↔ backend.
- **Delivery lifecycle**: status actions (ASSIGNED → PICKUP_EN_ROUTE → AT_PICKUP →
  PICKED_UP → IN_TRANSIT → AT_DROPOFF → DELIVERED) match the backend state machine,
  send fresh GPS for the 200 m geofence checks, and the proof flow (payment confirm →
  PIN/photo proof → atomic DELIVERED transition) matches the API.
- **Background location**: foreground watch + background task posting to `/riders/location`,
  with a proper Android foreground-service notification; stops on Go Offline.
- **Payments**: Paystack initialize → secure browser → verify-by-reference for both order
  payment and wallet top-up; amount/user cross-checks server-side; atomic wallet debits.
- **Chat**: ascending message order, dedupe, ack-checked sends, order-scoped rooms.
- **Account deletion** (Play policy): in-app deletion request + link to the live web
  delete-account page in both apps.
- **Android packaging**: correct permissions (incl. `ACCESS_BACKGROUND_LOCATION`,
  `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`), aggressive blocked-permissions
  list, Google Maps key injection, `google-services` Gradle wiring, upload-key signing
  via local credentials, remote versioning (EAS auto-increment).

## 4. Play Console — found and fixed

State was inspected via the Android Publisher API using the invited service account.

| Item | Rider (`com.riderguy.rider`) | Client (`com.riderguy.client`) |
|------|------------------------------|--------------------------------|
| Connection / service account | ✅ working | ✅ working |
| Live releases (before) | vc 3 on internal + alpha (closed test) | vc 2 on internal |
| Listing (title/descriptions/contacts) | ✅ complete | ✅ complete |
| Store graphics (before) | icon ✅, feature ✅, **2 raw screenshots** | **NONE** (0 icon, 0 feature graphic, 0 screenshots — a production-release blocker) |
| Store graphics (after) | 4 professionally framed screenshots (replaced raw ones) | 512px icon + 1024×500 feature graphic + 4 framed screenshots — **uploaded & committed** |

Graphics were generated with `sharp` (real device captures framed on brand canvases with
captions — raw 1080×2340 captures exceed Play's 2:1 screenshot aspect limit) and uploaded
via the Publisher API. Scripts kept for reuse:
`scripts/play-console-check.js`, `scripts/play-upload-client-graphics.js`,
`scripts/play-upload-rider-graphics.js`, `scripts/eas-build-status.js`.

**Build pipeline fix:** both new EAS builds initially failed at
`:app:processReleaseGoogleServices` because `.easignore` blanket-excluded
`google-services.json` from the upload. Fixed with negation rules re-including
`apps/*-native/android/app/google-services.json` (client-side identifiers, not secrets).

Remaining Play Console items that **require the Console UI** (no public API): Data Safety
form, content rating questionnaire, background-location declaration video, target-audience
declarations, and promoting releases from internal/alpha → production. All answers are
pre-written in `docs/architecture/PLAY_CONSOLE_SETUP_KIT.md`.

## 5. New builds shipped

- Rider: versionCode **6** (build `4779fa7e`), Client: versionCode **4** (build `58a1584b`)
  — EAS production profile (AAB, upload-key signed), submitted to the **internal** track
  via `eas submit` after build completion.
- These builds contain the FCM push fix, offline-logout fix, places fixes, and account
  polish; the API fixes are already live in production.

## 6. API deployment

`wallet.routes.ts` (+ its new `wallet-topup.service.ts` dependency) and `push.service.ts`
were deployed to the Hetzner server (`/var/www/riderguy/source`), the API workspace was
rebuilt, `pm2 reload riderguy-api` executed, and `https://api.myriderguy.com/health`
returned 200 on both cluster instances.

## 7. PWA archive (transition to native)

- `apps/client` (client PWA) → `archive/pwa/client`
- `apps/rider` (rider PWA) → `archive/pwa/rider`
- Both are now outside the npm workspace globs: not installed, built, type-checked, or
  uploaded to EAS. `npm install` re-ran cleanly to refresh the lockfile; `/archive/` is
  excluded in `.easignore`. See `archive/pwa/README.md`.
- **The production server still serves app.myriderguy.com / rider.myriderguy.com from its
  own copy via PM2** (`riderguy-client`, `riderguy-rider`). Decommissioning those processes
  (and pointing those domains at app-store interstitials) is a deliberate go/no-go decision
  left for the team.

## 8. Recommended next steps

1. In Play Console UI: complete/refresh Data Safety + content rating if not finalized, and
   promote the internal-track releases to closed testing → production when QA passes.
2. Decide the decommission date for the PWA PM2 processes and replace those subdomains
   with "get the app" pages.
3. Add 2–4 more rider screenshots (job offer accept flow, proof of delivery) once final UI
   media exists; same for client (tracking with rider en route).
4. Consider a "request a new FCM token on login" hook so device-switch users never keep a
   stale token registered.
