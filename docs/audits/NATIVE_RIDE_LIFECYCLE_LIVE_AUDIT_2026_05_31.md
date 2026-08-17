# Native Ride Lifecycle Live Audit - 2026-05-31

Source lifecycle: `docs/architecture/RIDE_LIFECYCLE.md`

## Scope

- Target apps: `apps/client-native` (`com.riderguy.client`) and `apps/rider-native` (`com.riderguy.rider`).
- Out of scope for this pass: legacy rider/client PWAs.
- Maps stack: Google Maps Platform, Google Maps deep links, `react-native-maps`, Google Routes/Geocoding services, Plus Codes, and Ghana address/link parsing.
- Backend target: `https://api.myriderguy.com/api/v1`.
- Device used: Samsung SM-A176B, ADB id `RZGL20QRZ5J`.
- Test accounts: `client@test.com` and `rider@test.com`.
- Earlier native audit order: `RG-2026-826AB7` (`cmpth2yg7000d32qscqv5znov`).
- Current full recheck happy-path order: `RG-2026-2219E7`.
- Current native phone feed/claim smoke order: `RG-2026-28CEA3` (`cmpttppt30020320hvvs6zh16`).

## Current Result

- [x] PASS Native lifecycle happy path reached `DELIVERED` from the rider app on the connected phone.
- [x] PASS Backend confirms `DELIVERED`, `COMPLETED`, `PIN_CODE`, `CASH`, `riderPaymentConfirmed=true`, and `deliveredAt=2026-05-31T08:10:44.901Z`.
- [x] PASS Rider wallet credited `GHS 7.48`; `totalEarned=7.48`; delivery earning transaction references `RG-2026-826AB7`.
- [x] PASS Client native Orders and Order Details show the delivered order, receipt state, cash payment, rider card, and rate action.
- [x] PASS Client rating submitted from the connected phone after reinstall; production backend now has `clientRating=5`, review highlights, and `tipAmount=0`.
- [x] PASS Client rider card now shows `Test Rider` and `5.0`; no more `undefined undefined`.
- [x] PASS Dispatch timeout recovery fix deployed to production API and smoke-tested with temp order `RG-2026-5DB31C`.
- [x] PASS Native Google Maps tiles now render in both client tracking and rider job detail on the connected phone after installing an Android Maps SDK key locally.
- [x] PASS Rider native unauthenticated/failed job deep links no longer sit on an indefinite spinner; protected app routes now redirect to auth and failed order loads show retry/back actions.
- [x] PASS Full production recheck completed against the installed app pair and production API after the scheduled-dispatch fixes below.

## Full Campaign Recheck - 2026-05-31

This pass used `RIDE_LIFECYCLE.md` as the checklist, the connected Samsung SM-A176B (`RZGL20QRZ5J`), the installed native apps, and production API `https://api.myriderguy.com/api/v1`.

### API Campaign

- [x] PASS Client and rider authentication with `client@test.com` and `rider@test.com`.
- [x] PASS No-rider recovery: `RG-2026-76ACFF` stayed `PENDING` while the rider was `OFFLINE`, then cancelled cleanly before assignment.
- [x] PASS Estimate drift guard: stale estimate order creation was rejected with `409` and a changed-price response.
- [x] PASS Scheduled-order guard: `RG-2026-8E6DA9` stayed `PENDING`, did not appear in `/orders/available`, and manual rider accept was blocked with `SCHEDULED_ORDER_NOT_READY`.
- [x] PASS Rider cancellation branch: `RG-2026-867A1A` assigned, duplicate accept was rejected as `INVALID_ORDER_STATUS`, and rider cancellation produced `CANCELLED_BY_RIDER`.
- [x] PASS Happy path: `RG-2026-2219E7` moved through assignment, pickup, collected, transit, dropoff, payment, proof, delivery, wallet, receipt, chat, rating, and history.
- [x] PASS Pickup geofence rejected an out-of-radius arrival with `GEOFENCE_VIOLATION`, then accepted the valid coordinate.
- [x] PASS Dropoff geofence rejected an out-of-radius arrival with `GEOFENCE_VIOLATION`, then accepted the valid coordinate.
- [x] PASS Direct `DELIVERED` transition before payment/proof was rejected with `PAYMENT_NOT_CONFIRMED`.
- [x] PASS Cash payment confirmation succeeded before completion.
- [x] PASS Bad PIN proof was rejected with `INVALID_PIN`; correct 6-digit PIN completed delivery with `proofType=PIN_CODE`.
- [x] PASS In-app socket chat persisted message `cmpttaojo0011320hm2ukxv7p`.
- [x] PASS Client rating saved once for `RG-2026-2219E7`; duplicate rating was rejected.
- [x] PASS Active tracking smoke: `RG-2026-802173` returned a live rider location from `/orders/:id/location`, then was cancelled for cleanup.

### Connected Phone Campaign

- [x] PASS Client native app logged in, rendered dashboard, Orders, delivered order details, receipt state, payment state, rider card, schedule, notes, and rate action.
- [x] PASS Rider native app logged in, rendered online home, Deliveries, Active, Earnings, wallet balance, delivery earnings, platform commission, cancellation penalty, and cancellation compensation.
- [x] PASS Production order `RG-2026-28CEA3` appeared in the installed rider app's Available feed with pickup, dropoff, distance, duration, and earning.
- [x] PASS Rider app claim flow showed the native accept confirmation and navigated to the job detail map after accept.
- [x] PASS Rider job detail rendered Google Map content, pickup/dropoff markers, status, order number, earning, and pickup navigation action.
- [x] PASS API cleanup cancellation propagated live to the rider app as `Cancelled By Client` and `Delivery closed`.
- [x] PASS Client app Orders refreshed and showed `RG-2026-28CEA3` as Cancelled with pickup/dropoff and total.
- [x] PASS Filtered logcat showed no app fatal crash, no `ReactNativeJS` unhandled exception, no Google Maps authorization failure, and no route-name error.

### Coverage Note

The full geofenced status/proof campaign was driven through production API calls with explicit Accra pickup/dropoff coordinates because the physical phone was not located inside those Ghana geofences. The connected phone was still used for installed-app verification of authentication, live job feed, claim, map/detail rendering, cancellation propagation, order history/detail, wallet, and earnings surfaces.

## Document Corrections

- [x] PASS `RIDE_LIFECYCLE.md` now says the current audit target is the native app pair, not the PWAs.
- [x] PASS Mapbox references were corrected to Google Maps Platform.
- [x] PASS The document now includes a release verification checklist for native client, native rider, backend, proof, wallet, rating, cancellation, and recovery.

## Lifecycle Checklist

### 1. Client Intent And Order Setup

- [x] PASS Client native dashboard launches authenticated and exposes package delivery entry points.
- [x] PASS Client native Orders tab shows the delivered audit order after completion.
- [x] PASS Client native Order Details shows status, receipt, addresses, package type, payment method, rider card, and rate action.
- [x] PASS Source fix: quick-send requires coordinate-backed pickup/dropoff before estimate/order submission.
- [x] PASS Source fix: quick-send extra-stop sequences are zero-based for the shared validator.
- [x] PASS One-phone audit scope accepted: production API-created orders were used for dispatch/geofence practicality, while client native order surfaces, tracking, rating, and backend creation/validation paths were verified separately in this pass.

### 2. Dispatch And Assignment

- [x] PASS Rider native online flow works on corrected build and persists `ONLINE` plus coordinates.
- [x] PASS Audit order could be accepted and assigned to the seeded rider.
- [x] PASS Rider native Active tab showed the assigned audit order.
- [x] PASS Production API fix: timed-out auto-dispatch offers no longer persistently hide the returned order from `/orders/available`.
- [x] PASS Production smoke: temp order `RG-2026-5DB31C` returned to `PENDING`, appeared in `/orders/available`, then cancelled as `CANCELLED_BY_CLIENT`.

### 3. Pickup Phase

- [x] PASS Rider tapped pickup navigation; Google Maps app launched.
- [x] PASS Backend moved to `PICKUP_EN_ROUTE`.
- [x] PASS Rider confirmed pickup arrival; geofence passed and backend moved to `AT_PICKUP`.
- [x] PASS Rider marked package collected; backend moved to `PICKED_UP` and set `pickedUpAt=2026-05-31T07:48:32.099Z`.
- [x] PASS Source fix: status transitions use bounded GPS with last-known fallback instead of indefinite fresh-GPS waits.

### 4. Transit And Dropoff Phase

- [x] PASS Rider started dropoff route; Google Maps app launched and backend moved to `IN_TRANSIT`.
- [x] PASS Rider confirmed dropoff arrival; backend moved to `AT_DROPOFF`.
- [x] PASS Source fix: pickup/dropoff arrival confirmation no longer launches maps before the status patch.

### 5. Payment, Proof, And Completion

- [x] PASS Client native active order/tracking source exposes delivery PIN for handoff.
- [x] PASS Rider proof screen opened without the old bottom-sheet overlay after source fix and rebuild.
- [x] PASS Rider selected cash/PIN, entered `812027`, and submitted proof from the native app.
- [x] PASS Backend saved proof and delivered the order in the completion path.
- [x] PASS API proof validation now requires a 6-digit PIN format and was deployed with the API reload.

### 6. Wallet, Receipt, Rating, And History

- [x] PASS Rider wallet balance and total earned updated to `GHS 7.48`.
- [x] PASS Wallet transaction history contains `DELIVERY_EARNING` for `RG-2026-826AB7`.
- [x] PASS Receipt email timestamp is set: `2026-05-31T08:10:45.231Z`.
- [x] PASS Client history/detail shows delivered order and receipt available.
- [x] PASS Source fix: client rating/detail screens normalize `order.rider.user` so rider names no longer render as `undefined undefined`.
- [x] PASS Client-native release APK rebuilt, installed, and rating was submitted from the connected phone.

## Google Maps Configuration Audit

- [x] PASS Both native app configs use Google Maps Platform variables, not Mapbox.
- [x] PASS Both Android manifests now use `android:value="${GOOGLE_MAPS_API_KEY}"` for `com.google.android.geo.API_KEY`.
- [x] PASS Both Android Gradle builds resolve `GOOGLE_MAPS_API_KEY_ANDROID`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, or `GOOGLE_MAPS_API_KEY` from Gradle properties, environment, or app `.env`.
- [x] PASS Both Android Gradle builds reject missing/placeholder map keys with a clear build error.
- [x] PASS Removed the unsafe Firebase `google-services.json` API-key fallback after live Google Maps authorization failure proved it is not a valid Maps SDK Android key.
- [x] PASS `.env.example` now documents `GOOGLE_MAPS_API_KEY_ANDROID`, `GOOGLE_MAPS_API_KEY_IOS`, and `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
- [x] PASS Production backend `GET /orders/directions` returns a Google Routes polyline.
- [x] PASS Production backend `/orders/reverse-geocode` and `/places/reverse-geocode` now return a Plus Code/coordinate fallback instead of `null` or `404`.
- [x] PASS Live client tracking screen renders Google Maps tiles, labels, markers, and route overlay after rebuilding/installing with the Android Maps SDK key.
- [x] PASS Live rider job detail renders Google Maps tiles, pickup/dropoff markers, and the delivered-order sheet after rebuilding/installing with the Android Maps SDK key.
- [x] PASS Filtered logcat for both native apps no longer reports Google Maps SDK authorization failure.
- [x] PASS `gcloud` SDK installed locally (`570.0.0`) for future Cloud/API-key administration.

### Cloud Build Follow-up

The local native builds are configured and verified. For cloud/EAS builds, authenticate `gcloud` or EAS and store the same mobile Maps SDK key as a secret/env var named `GOOGLE_MAPS_API_KEY_ANDROID` or `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.

The Android-restricted Maps SDK key must include these Android application restrictions:

- `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25;com.riderguy.client`
- `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25;com.riderguy.rider`

Enable/restrict APIs:

- Mobile key: Maps SDK for Android.
- Server key: Routes API and Geocoding API; keep this server-side as `GOOGLE_MAPS_API_KEY`.
- For cloud/EAS builds, store the mobile key as an EAS secret or CI env var named `GOOGLE_MAPS_API_KEY_ANDROID` or `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.

Do not use the Firebase `google-services.json` API key for native map tiles.

Because the key was displayed in a screenshot during setup, rotate it in Google Cloud after this local validation pass and update the local/EAS secret values with the replacement key.

## Defects Found And Fix Status

- [x] FIXED Rider online toggle could hang indefinitely waiting for fresh GPS; added timeout plus last-known fallback in `apps/rider-native/app/(tabs)/index.tsx`.
- [x] FIXED Rider status transitions could hang on fresh GPS; added bounded GPS fallback in `apps/rider-native/app/(app)/jobs/[id].tsx`.
- [x] FIXED Rider arrival confirmation launched Google Maps before patching status; arrival actions now patch status directly.
- [x] FIXED Rider proof navigation left a prior bottom sheet over the proof screen; proof navigation dismisses the sheet first.
- [x] FIXED Client quick-send accepted typed addresses without coordinates; estimate/order creation now requires coordinates.
- [x] FIXED Client quick-send extra-stop sequence started at 1; now starts at 0.
- [x] FIXED Client active order/tracking screens did not expose the delivery PIN; they now show it before delivery.
- [x] FIXED Backend PIN proof accepted weak 4+ character strings before compare; now requires a 6-digit PIN.
- [x] FIXED Auto-dispatch timeout could hide a returned order from `/orders/available`; timed-out offers are not persisted as manual-feed declines.
- [x] FIXED Future scheduled orders could be dispatched, appear in the rider feed, or be manually accepted before their release window; creation, auto-dispatch, available jobs, and manual assign now all block early dispatch, with a scheduled release worker for due orders.
- [x] FIXED Direct `DELIVERED` status transitions could bypass the intended payment/proof sequence; backend completion now requires confirmed payment and saved proof before delivery can be finalized.
- [x] FIXED Client rating/detail screens rendered `undefined undefined` for nested rider user data; source fixed and APK installed.
- [x] FIXED Reverse geocoding could return `null`; API now falls back to a stable Plus Code/coordinate label.
- [x] FIXED Client fallback target `/places/reverse-geocode` was missing; API route added and deployed.
- [x] FIXED Native map tiles were blocked by an invalid/non-entitled key fallback; both native Android apps now require and consume the Android Maps SDK key from local env/Gradle configuration.
- [x] FIXED Rider native app routes lacked an auth guard; unauthenticated deep links now redirect through auth instead of letting protected screens make anonymous API calls.
- [x] FIXED Rider job detail treated failed/missing order loads as permanent loading; it now shows a retry/back error state.
- [x] FIXED Rider app layout referenced a non-existent `onboarding` route; it now references `onboarding/index`, removing the runtime route warning.

## Verification Commands

- [x] PASS `npm run type-check --workspace=@riderguy/rider-native`
- [x] PASS `npm run type-check --workspace=@riderguy/client-native`
- [x] PASS `npm run type-check --workspace=@riderguy/api`
- [x] PASS `npm run test --workspace=@riderguy/api -- auto-dispatch.service.test.ts order.service.test.ts tracking.service.test.ts pricing.service.test.ts auth.service.test.ts auth.contract.test.ts` (`189` tests passed)
- [x] PASS `npm run test --workspace=@riderguy/api -- auto-dispatch.service.test.ts order.service.test.ts` (`93` tests passed after scheduled-order and completion-guard fixes)
- [x] PASS Rider release APK rebuilt and installed after proof/status fixes.
- [x] PASS Client release APK rebuilt and installed after rating-name fix.
- [x] PASS Production API build/reload completed; `/health` returned database and Redis `ok`.
- [x] PASS Production `GET /orders/directions` smoke returned route count, distance, duration, and polyline.
- [x] PASS Production reverse-geocode smoke returned non-null fallback data from both `/orders` and `/places`.
- [x] PASS Gradle fail-fast check: both native Android projects fail with `Google Maps API key is missing` when only placeholder map env values are present.
- [x] PASS Local Google Maps key presence check: both native `.env` files contain a non-placeholder Android Maps SDK key.
- [x] PASS Client release APK rebuilt, installed, and live tracking map smoke passed with real Google map tiles.
- [x] PASS Rider release APK rebuilt, installed, and live job-detail map smoke passed with real Google map tiles.
- [x] PASS Rider release APK rebuilt/installed again after auth-guard/error-state fixes; final job deep link smoke still renders Google Map and delivered-order sheet.
- [x] PASS Filtered rider post-install logcat shows Maps SDK initialization and no `Authorization failure` or `No route named "onboarding"` warning.
- [x] PASS Connected phone recheck: client and rider native apps signed in, rider available feed showed a production job, rider accepted it, Google Map job detail rendered, API cancellation propagated to rider, and client Orders refreshed with the cancelled order.
- [x] PASS Filtered post-recheck logcat shows no app fatal crash, no `ReactNativeJS` unhandled exception, no Google Maps authorization failure, and no route-name error.
- [x] PASS `gcloud --version` verified after install; authentication/project selection remains intentionally unset until owner login.

## Final Status

Backend lifecycle, native rider delivery, wallet settlement, client post-delivery viewing, client rating, scheduled-order gating, Google Routes/reverse-geocode, and native Google Maps rendering are verified against the connected phone and production API.

Local native lifecycle audit status: 100% pass for the tested one-phone lifecycle and the follow-up full production campaign. Remaining release-operations follow-up: authenticate Google Cloud/EAS, rotate the exposed setup key, and store the replacement Android Maps SDK key in cloud build secrets before remote builds.
