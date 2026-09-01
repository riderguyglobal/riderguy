# RiderGuy Play Console Setup Kit

Last updated: 2026-08-31

This is a fill-in-the-console kit. Everything Google asks for in Play Console is pre-written below for both apps. Where a field can only be set in the Play Console UI (no public API), copy the text from here. Items already pushed automatically via the Android Publisher API are marked **[API-pushed]**.

Apps:

- **RiderGuy** — package `com.riderguy.client` — EAS project `0d13ec59-ec6f-4650-89b2-16f3826190a7`
- **RiderGuy Rider** — package `com.riderguy.rider` — EAS project `d41a49c6-5a28-407a-bffb-8b278e90b627`

Shared URLs:

- Privacy policy: `https://myriderguy.com/privacy`
- Terms: `https://myriderguy.com/terms`
- Account deletion (web): `https://myriderguy.com/delete-account`
- Support email: `hello@myriderguy.com`
- Privacy/data requests: `privacy@myriderguy.com`
- Website: `https://myriderguy.com`

---

## 1. Store Listing — RiderGuy (Client) `com.riderguy.client`  **[API-pushed]**

- **App name (≤30):** `RiderGuy`
- **Short description (≤80):** `Send packages across the city. Book a rider, track live, pay in-app.`
- **Full description (≤4000):**

```
RiderGuy is a fast, reliable way to send and receive packages in your city. Book a trusted rider in seconds, track your delivery live on the map, and pay securely in-app — no cash needed.

WHAT YOU CAN DO
• Request a delivery in a few taps — set pickup and drop-off, add notes, and go.
• Get an upfront price before you book, based on distance and zone.
• Track your rider live on the map from pickup to drop-off.
• Add multiple stops and schedule deliveries for later.
• Pay securely in-app with mobile money, card, or bank transfer — powered by Paystack.
• Chat with your rider and get real-time status updates.
• Rate your delivery and view your full order history.

WHY RIDERGUY
• Upfront, transparent pricing.
• Live tracking and delivery updates.
• Secure in-app payments.
• Friendly support when you need it.

Location is used to detect your pickup point and show your delivery on the map. You can also enter addresses manually.

Have feedback? Reach us at hello@myriderguy.com.
```

- **App category:** `Maps & Navigation` (alternative: `Business`)
- **Tags:** delivery, courier, package delivery, logistics, tracking
- **Contact email:** `hello@myriderguy.com` · **Website:** `https://myriderguy.com` · **Phone:** *(optional — add a support line if available)*
- **Privacy policy URL:** `https://myriderguy.com/privacy`

---

## 2. Store Listing — RiderGuy Rider `com.riderguy.rider`  **[API-pushed]**

- **App name (≤30):** `RiderGuy Rider`
- **Short description (≤80):** `Earn by delivering with RiderGuy. Accept jobs, navigate, and track earnings.`
- **Full description (≤4000):**

```
RiderGuy Rider is the app for approved RiderGuy delivery partners. Go online, accept nearby delivery jobs, navigate to pickup and drop-off, and track your earnings — all in one place.

WHAT YOU CAN DO
• Go online and receive nearby job offers in real time.
• See pickup and drop-off details, distance, and payout before you accept.
• Navigate with built-in maps and live routing.
• Capture proof of delivery and update order status as you go.
• Track your earnings and cash out to mobile money or bank.
• Chat with customers and support during active deliveries.

LOCATION & TRACKING
When you are online or completing a delivery, RiderGuy Rider uses your location in the
background and while the app is closed or not in use to match you with nearby jobs, share
your live position with the customer and support, and calculate distances and fares. A
tracking notification is shown while you work, and location sharing stops when you go offline.

RiderGuy Rider is intended for approved delivery partners aged 18+. To become a rider, complete
onboarding and identity verification in the app.

Questions? Reach us at hello@myriderguy.com.
```

- **App category:** `Business` (alternative: `Productivity`)
- **Tags:** delivery driver, courier, earnings, gig, logistics
- **Contact email:** `hello@myriderguy.com` · **Website:** `https://myriderguy.com`
- **Privacy policy URL:** `https://myriderguy.com/privacy`

> Avoid income guarantees or "fastest/best" claims in screenshots or copy — Google rejects unverifiable claims.

---

## 3. Graphic Assets (UI upload — prepare these files)

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG, 32-bit | App already ships an adaptive icon (`apps/*/assets/icon.png`); export a 512×512 store version |
| Feature graphic | 1024×500 PNG/JPG | **To create** |
| Phone screenshots | 2–8, 16:9 or 9:16, ≥1080px | **To create** from real app screens (see flows below) |
| Tablet screenshots | optional | Only if you support tablets |

Screenshot flows to capture:

- **Client:** request delivery, live map tracking, order detail, wallet/payment, order history.
- **Rider:** online/available jobs, job detail + map, active delivery, proof of delivery, earnings.

---

## 4. Data Safety form

Answer in Play Console → App content → Data safety. Both apps **collect** and **encrypt in transit**, and users **can request deletion** (in-app + web). None of this data is "sold." The table differs slightly per app.

### Shared answers

- **Is data encrypted in transit?** Yes (TLS).
- **Do you provide a way to request data deletion?** Yes — in-app (Account → Delete Account) and `https://myriderguy.com/delete-account`.
- **Is all collected data optional?** No — some is required to provide the service.

### RiderGuy (Client) — data types collected

| Data type | Collected | Shared | Purpose | Required |
|---|---|---|---|---|
| Name | Yes | Yes (assigned rider) | App functionality, account | Required |
| Email address | Yes | No | Account, support | Required |
| Phone number | Yes | Yes (assigned rider) | App functionality, account | Required |
| Precise location | Yes | Yes (assigned rider during delivery) | App functionality (pickup/tracking) | Optional (can enter manually) |
| Approximate location | Yes | No | App functionality | Optional |
| Address (pickup/drop-off/saved) | Yes | Yes (assigned rider) | App functionality | Required for an order |
| Payment info (wallet/transactions) | Yes | Yes (Paystack) | Payments | Required to pay |
| Photos (profile, optional) | Yes | No | Account personalization | Optional |
| In-app messages | Yes | Yes (assigned rider/support) | App functionality, support | Optional |
| App activity (orders, ratings) | Yes | No | App functionality, analytics | Required |
| Crash logs / diagnostics | Yes | No | App stability | Optional |
| Device or other IDs (push token, install ID) | Yes | Yes (FCM) | Notifications, functionality | Required for notifications |

### RiderGuy Rider — additional/changed data types

Everything above (with rider counterparts) **plus**:

| Data type | Collected | Shared | Purpose | Required |
|---|---|---|---|---|
| **Precise location (background)** | Yes | Yes (customer/support during active delivery) | App functionality — job matching, live delivery tracking | Required to go online |
| Government ID / national ID (Ghana Card) | Yes | No | Identity verification, fraud prevention | Required (onboarding) |
| Photos (selfie, documents, vehicle, proof of delivery) | Yes | Limited (proof shared with customer/order) | Verification, proof of delivery | Required |
| Financial info (earnings, payouts, withdrawal/bank/mobile-money) | Yes | Yes (Paystack/payout processor) | Payouts | Required |

> The Data Safety answers must match the Privacy Policy and actual app behaviour. The rewritten policy at `https://myriderguy.com/privacy` already reflects all of the above, including **background location**.

---

## 5. App access (reviewer credentials)

Both apps are login-gated, so Google needs working test accounts. Provide in Play Console → App content → App access → "All or some functionality is restricted."

**2026-07-08 rejection root cause:** Google's reviewer entered `rider@test.com` (the **RIDER** app's account) into the **RiderGuy (client)** app's login screen. The client app's own role guard correctly refused it ("This account is not registered for this app" — this is a real safety feature, not a bug; see `hasExpectedRole` in `packages/auth-native/src/auth-actions.ts`). Both accounts below were verified live against `api.myriderguy.com` on 2026-07-08 and work correctly for their **own** app. **The fix is entirely in the Play Console App access forms — use the exact account for the exact app, do not mix them up:**

**Client (`com.riderguy.client` / "RiderGuy") instructions — use this account ONLY here:**

```
Login: email + password
Test client account: client@test.com / Test1234
Steps: 1) Open the app — the sign-in screen defaults to Email. Log in with the
credentials above (no OTP/SMS required for this path).
2) If a "verify your email" code screen appears, it was only sent when a
non-email method is used — with email+password login this step is skipped.
3) Allow location (or enter an address manually). 4) Set pickup + drop-off.
5) Confirm the upfront price and book.
Wallet is pre-funded with test balance; no real payment needed.
```

**Rider (`com.riderguy.rider` / "RiderGuy Rider") instructions — use this account ONLY here:**

```
Login: email + password
Test rider account: rider@test.com / Test1234 (onboarding already approved)
Steps: 1) Open the app — the sign-in screen defaults to Email. Log in with the
credentials above (no OTP/SMS required for this path).
2) Tap "Go online" — accept the background-location disclosure + permission.
3) A test job is dispatched; accept it. 4) Follow the map; mark picked up / delivered;
capture a proof photo. 5) View earnings/wallet.
Note: tracking is geofenced to Ghana; use location simulation if testing elsewhere.
```

> Both apps also support Phone OTP and Ghana Card sign-in, tucked under "More sign-in options" on the login screen — but Phone/Ghana Card logins additionally require a one-time code emailed to the account (Google reviewers often can't receive Ghana SMS, so email is the one channel guaranteed to reach them). **For review purposes, always use the email + password path above** — it's the fastest and needs no second code.
>
> These two accounts are recreated from scratch (all data wiped) by `node scripts/seed-test-accounts.js` against `DATABASE_URL` — re-run it if they ever need to be reset, and re-verify with a live login call before submitting for review.

---

## 5b. Internal testers (your team)

The Play Developer API cannot add individual tester emails (only Google Groups), so add these in the UI once — the list is reusable across both apps and all test tracks.

**Tester emails (paste-ready, comma-separated):**

```
dziwornurobert@gmail.com, ebdarko@gmail.com, asantr403@gmail.com, kelvinbosomprah42@gmail.com, redmanovcoltd@gmail.com, tmstore.online26@gmail.com, prayercave.online@gmail.com
```

**Steps (per app — do RiderGuy Rider first, then RiderGuy):**

1. App → **Test and release → Testing → Internal testing** → **Testers** tab.
2. Click **Create email list** → name it `RiderGuy Testers` → paste the emails above → **Save changes**.
3. Tick the **RiderGuy Testers** checkbox to attach the list to this track → **Save changes**.
4. Scroll to **How testers join your test** → **Copy link** → send that link to every tester.
5. For the second app, the `RiderGuy Testers` list already exists — just tick it and copy that app's link.

Each tester: open the link on an Android phone signed in with their Gmail → **Become a tester** → install from Google Play. (Up to 100 internal testers; no Google review needed.)

---

## 6. Content rating (IARC questionnaire)

Play Console → App content → Content rating. Category: **Utility, Productivity, Communication, or Other** (not a game).

Suggested answers (verify against actual app):

- Violence / scary content / sexual content / nudity: **No**
- Profanity / crude humor: **No**
- Controlled substances (drugs, alcohol, tobacco): **No**
- Gambling (real or simulated): **No**
- User-to-user communication / shares location: **Yes** (in-app chat; rider shares location during deliveries) — disclose this honestly.
- User-generated content shared publicly: **No** (chat is 1:1, not public broadcast)
- Digital purchases: **No** (physical delivery services only)

Expected result: rated for everyone / low maturity. The "users interact + share location" answers are important for accuracy.

---

## 7. Target audience & content

- **Target age group:** 18 and over (both apps). Do **not** target children.
- Appeals to children? **No.**
- Rider app: adults only (approved delivery partners).

---

## 8. Ads declaration

- **Does your app contain ads?** **No** (no ad SDK detected in the codebase). Update if ads are ever added.

---

## 9. Financial features declaration

Play Console → App content → Financial features.

- **Client app:** keep the closed-loop delivery balance/payment declaration accurate. If the form includes digital wallets or payments, declare the applicable feature rather than selecting "none."
- **Rider app:** do **not** answer "My app doesn't provide any of these financial features." The app now promotes a reviewed 12-month bike/EV lease program and accepts interest requests. For the current interest-only flow, select **Support services → Other** and explain that no approval, credit decision, vehicle reservation, agreement, or lease payment happens in the app.
- Also select **Support services → Insurance** because the Rider sign-in page promotes insurance. State that the current app provides guidance only and does not quote, sell, underwrite, bind, or collect payment for coverage; identify any provider and terms before real coverage is offered.
- If the final commercial structure transfers ownership, extends credit, or connects Riders to a lender, reclassify it accurately (for example **Buy now, pay later** or **Loan facilitator**) and provide all requested provider/licensing documents.
- ⚠️ **Production blocker:** Google Play requires apps providing financial products/services to use a verified **Organization** developer account. Do not submit the Rider app to Production from a personal account with the lease feature present.
- ⚠️ **Ghana legal blocker:** keep the current screen to information + interest registration until Ghana-qualified counsel confirms whether RiderGuy or its partner needs a Bank of Ghana leasing or credit licence and approves the commercial disclosures/agreement.
- **Google Play Billing is not required** here — physical transportation/delivery services use third-party processors (Paystack). Do **not** add in-app digital subscriptions without re-checking Play Billing policy.

---

## 10. Background location declaration (Rider app)  ← most scrutinized

Play Console → App content → Sensitive app permissions → Location.

- **Why the app needs background location:** "RiderGuy Rider shares a delivery partner's location with the customer and support while a delivery is active, and matches partners with nearby jobs, when the rider is online — including when the app is in the background or closed. This is core delivery-tracking functionality."
- **Use case:** Background Location Updates — *User-initiated ride/delivery sharing* (and Navigation).
- **Prominent in-app disclosure (already implemented; this is the wording):**

```
RiderGuy Rider collects location in the background — when the app is closed or not in use —
to share your live location with customers and support during active deliveries and to match
you with nearby jobs while you are online. Tracking stops when you go offline.
```

- **Demo video (≤30s) shot list — record and upload (YouTube unlisted link):**
  1. Rider taps "Go online."
  2. The background-location disclosure screen appears.
  3. The Android runtime permission prompt (Allow all the time) appears.
  4. The foreground-service / tracking notification is visible.
  5. A delivery is accepted and the live location shows on a customer/order view.

---

## 11. Foreground service declaration (Rider app)

Play Console → App content → Foreground service permissions → `FOREGROUND_SERVICE_LOCATION`.

- **Functionality:** Active-delivery location tracking shown via a persistent notification while the rider is online or delivering.
- **User benefit:** Customers and support see live delivery progress; missing tracking would break delivery visibility.
- **Demo:** same video as Section 10 (shows the rider triggering the service).
- Native services declare `android:foregroundServiceType="location"`.

---

## 12. Permissions summary (what reviewers will see)

- **Client:** Internet, foreground location, camera (optional uploads), notifications, biometric. Broad media/storage/audio/overlay permissions are blocked in the release manifest.
- **Rider:** Internet, foreground + **background** location, foreground-service location, camera (proof/documents/vehicle), notifications, vibrate, biometric. Broad media/storage/audio/overlay blocked.

---

## 13. Release & signing notes

- Both apps are signed by the upload key (`upload-key.jks`, alias `upload`) and use **Play App Signing**.
- The **Play App Signing SHA-256** certificates from Play Console are checked into `apps/marketing/public/.well-known/assetlinks.json`: the client package verifies `app.myriderguy.com`, and the rider package verifies `rider.myriderguy.com`. Deploy the marketing/nginx changes and also register these certificates with Google Maps, Firebase, and Google OAuth where used.
- Current workflow: `play-internal` builds the Play Internal Testing AAB; `preview` builds the directly installable QA APK; EAS `internal` submits only to Play's internal track.
- Version codes are remote and auto-incremented. Query EAS and Play before every build; never rely on a number recorded in documentation or assume a draft version code is reusable.
- No EAS production build or submit profile exists in this repo.

---

## 14. Final publish checklist (per app)

- [ ] Main store listing (text **[API-pushed]**; add icon, feature graphic, screenshots)
- [ ] Privacy policy URL set → `https://myriderguy.com/privacy`
- [ ] Data safety completed (Section 4)
- [ ] App access / reviewer credentials added (Section 5)
- [ ] Content rating questionnaire completed (Section 6)
- [ ] Target audience = 18+ (Section 7)
- [ ] Ads = No (Section 8)
- [ ] Financial features declared (Section 9)
- [ ] Background location declaration + demo video (Rider, Section 10)
- [ ] Foreground service declaration + demo video (Rider, Section 11)
- [ ] Account deletion URL set → `https://myriderguy.com/delete-account`
- [ ] Upload the inspected `play-internal` AAB to Internal Testing only
- [ ] Share the Play tester link and separate `preview` APK link for QA
- [ ] Leave closed testing and production unchanged pending separate explicit approval
```
