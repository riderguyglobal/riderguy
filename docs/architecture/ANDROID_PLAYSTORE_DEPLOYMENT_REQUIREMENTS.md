# RiderGuy Android Play Store Deployment Requirements

Last researched: 2026-06-01

Scope:

- Client native app: `apps/client-native`, package `com.riderguy.client`, store name `RiderGuy`.
- Rider native app: `apps/rider-native`, package `com.riderguy.rider`, store name `RiderGuy Rider`.
- Platform: Google Play Store for Android phones and tablets.
- Build stack: Expo / React Native with generated native Android projects and EAS profiles.

This document is a practical launch checklist. It is not legal advice; privacy, payments, rider onboarding, insurance, labor, and transportation requirements still need jurisdiction-specific legal review.

---

## 1. Current Launch Status

This status reflects the native Play Store configuration pass completed on 2026-06-01. Items marked "repo configured" still need real Play Console, credential, legal, and QA follow-through before upload.

| Area | Current state | Requirement / risk | Required action |
|---|---|---|---|
| Target SDK | Repo configured: both Android projects default `targetSdkVersion` to `35`. Fresh release manifest checks showed target SDK 35. | New mobile apps and app updates submitted to Google Play currently need Android 15 / API 35 or higher. | Test Android 15 behavior before upload. |
| Release signing | Repo configured: release signing now reads app-specific or generic keystore secrets, with debug signing only as a local/EAS fallback. | Production releases must be signed with a real upload key. Debug signing is not acceptable for Play deployment. | Add real EAS/CI upload keystore credentials for both packages. Use Play App Signing. |
| Rider background location | Rider app declares `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, and `FOREGROUND_SERVICE_LOCATION`. | Play requires background location approval and foreground service declarations for Android 14+. | Prepare location permission declaration, prominent disclosure, privacy policy, and short demo video showing active-delivery tracking. |
| Photo access | Repo configured: broad photo/storage permissions are blocked from release manifests. Image selection remains through picker/camera flows. | Play restricts broad photo/video permissions unless core functionality needs persistent or frequent access. | QA profile, package-photo, rider document, vehicle-photo, selfie, and proof-of-delivery flows on Android 13-15. |
| Extra manifest permissions | Repo configured: `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, and broad media permissions are blocked from release manifests. | Sensitive or special permissions must be necessary, disclosed, and justifiable. | Keep monitoring release manifests after dependency changes. |
| Account deletion | Repo configured: both apps include a signed-in account deletion request screen, and marketing has `/delete-account`. | If users can create accounts, Google Play requires an in-app account deletion path and a web link for account/data deletion requests. | Deploy the marketing page, configure the Play Console deletion URL, and operationalize the admin/support deletion workflow. |
| Reviewer access | Both apps require login. Rider app has onboarding, dispatch, wallet, and location flows. | Reviewers must be able to access restricted parts of the app. Missing credentials can block release. | Create durable reviewer accounts and written test instructions for client and rider roles. |
| Deep links / app links | Both apps use `android:autoVerify="true"` for `riderguy.com`, `www.riderguy.com`, and `app.myriderguy.com`. | Verified App Links need `assetlinks.json` per host with the Play app signing SHA-256 certificate. | After first upload, copy app signing SHA-256 values from Play Console and publish asset links for both packages. |

---

## 2. Play Console Account Requirements

### 2.1 Account setup

Create or use a Google Play Console developer account:

- Account owner must be at least 18.
- Accept the Google Play Developer Distribution Agreement and Play Console Terms of Service.
- Pay the one-time Google Play developer registration fee, currently US$25.
- Choose the right account type:
  - Use an Organization account for a real company/commercial service.
  - Organization accounts require a D-U-N-S number and organization verification.
  - If the app is considered to provide financial products/services, health, VPN, or government services, Google requires an Organization account.
- Verify account contact details and identity information.
- Keep private account contact email/phone operational.
- Provide public developer contact details shown on Google Play.

Recommended for RiderGuy: use an Organization account, not a personal account. RiderGuy is a commercial delivery/transport service, uses payments/payouts, and may need company identity continuity over time.

### 2.2 Personal-account testing requirement

If a new personal developer account is used, Google requires a closed test before production access:

- At least 12 testers.
- Testers must be opted in continuously for at least 14 days.
- Apply for production access from Play Console after the criteria are met.
- New personal accounts may also need to verify access to a real Android device using the Play Console mobile app.

This requirement does not apply the same way to Organization accounts, but internal/closed testing is still recommended before production.

---

## 3. Play Console Apps To Create

Create two separate Play Console app records:

| Store app | Package | Type | Price | Primary category suggestion |
|---|---|---|---|---|
| RiderGuy | `com.riderguy.client` | App | Free | Maps & Navigation, Lifestyle, or Shopping/Business depending final positioning |
| RiderGuy Rider | `com.riderguy.rider` | App | Free | Business or Productivity; avoid consumer-facing claims if intended for approved riders only |

Before creating/uploading, confirm package names. Google Play treats package names as unique and permanent; they cannot be deleted or reused later.

For each app:

- Default language.
- App name.
- App/game type.
- Free or paid.
- Support email.
- Developer policy acknowledgements.
- Play App Signing Terms of Service.
- US export laws declaration.

---

## 4. Android Build And Artifact Requirements

### 4.1 Android App Bundle

Google Play requires new apps to publish using Android App Bundle (`.aab`). APKs are still useful for local/internal distribution, but Play production uploads should be AABs.

Required:

- Use `eas build --platform android --profile production` or equivalent Gradle bundle task.
- Verify the output is `.aab`, not only `.apk`.
- Keep per-app package IDs stable.
- Confirm the bundle contains production API endpoints.
- Confirm no dev menu, network inspector, mock URLs, or debug-only behavior is enabled.

### 4.2 Target API level

Current Play requirement for new mobile apps and app updates:

- Target Android 15 / API 35 or higher.
- Existing apps must at least target Android 14 / API 34 to remain available to new users on newer Android versions.

RiderGuy repo status:

- `apps/client-native/android/build.gradle` defaults `targetSdkVersion` to `35`.
- `apps/rider-native/android/build.gradle` defaults `targetSdkVersion` to `35`.
- Fresh release manifest checks on 2026-06-01 produced `android:targetSdkVersion="35"` for both apps.

Required action:

- Test Android 15 runtime behavior, especially location, notification, storage/media selection, edge-to-edge layout, and foreground service behavior.
- Re-check the official target API page immediately before upload; Google Play updates this requirement on an annual cadence.

### 4.3 Versioning

Required:

- Each upload must increment `versionCode`.
- `versionCode` must stay below Play Console's maximum of `2100000000`.
- `versionName` should be human-readable, for example `1.0.0`.
- EAS `autoIncrement` can manage production version codes, but confirm remote version state for both apps.

Current:

- Both apps currently have native `versionCode 1` and `versionName "1.0.0"`.

### 4.4 Signing

Required:

- Use Play App Signing.
- Create a separate upload key for each app, or let EAS manage credentials per package.
- Keep upload keystores outside git.
- Keep backup copies in a secure password manager/secret vault.
- Register Play app signing certificate fingerprints, not only local upload-key fingerprints, with:
  - Firebase Android apps.
  - Google Maps API key restrictions.
  - Google OAuth Android client IDs.
  - Digital Asset Links for verified app links.

Current repo config:

- Both native Gradle files now define a `release` signing config.
- Client-specific variables: `CLIENT_ANDROID_KEYSTORE_PATH`, `CLIENT_ANDROID_KEYSTORE_PASSWORD`, `CLIENT_ANDROID_KEY_ALIAS`, `CLIENT_ANDROID_KEY_PASSWORD`.
- Rider-specific variables: `RIDER_ANDROID_KEYSTORE_PATH`, `RIDER_ANDROID_KEYSTORE_PASSWORD`, `RIDER_ANDROID_KEY_ALIAS`, `RIDER_ANDROID_KEY_PASSWORD`.
- Generic fallback variables: `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- Common React Native upload-key aliases are also supported: `ANDROID_UPLOAD_STORE_FILE`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD`.
- Android Studio / CI injected signing properties are supported through `android.injected.signing.*`.

Remaining action:

- Add real upload keystores to EAS secrets or CI secrets. Do not commit keystores or passwords.
- Confirm the generated AAB is signed with the intended upload key before uploading to Play.

### 4.5 Architectures and device support

Current:

- `reactNativeArchitectures=arm64-v8a` in both Android projects.

Requirement:

- Google Play requires 64-bit support for apps with native code. `arm64-v8a` satisfies 64-bit, but excludes 32-bit-only devices.

Decision:

- Keep arm64-only if modern-device coverage is acceptable.
- Add `armeabi-v7a` if RiderGuy wants broader low-end Android coverage. Test bundle size and native library compatibility.

---

## 5. Permissions And Policy Requirements

### 5.1 Permission audit

Before upload, produce a release manifest for both apps and verify only required permissions remain.

Client app expected permissions:

- `INTERNET`
- Foreground location: pickup/dropoff detection and maps.
- Camera/photo picker: profile photo or support uploads, if the feature exists.
- Push notifications through Firebase/Expo, with Android notification runtime request.
- Biometric/local authentication if actively used.

Rider app expected permissions:

- `INTERNET`
- Foreground location: rider map and job state.
- Background location: only while online or actively delivering, if truly required.
- Foreground service location: active delivery tracking.
- Camera/photo picker: proof of delivery, documents, vehicle photos.
- Push notifications.
- Biometric/local authentication if actively used.

Permissions to remove unless clearly required:

- `SYSTEM_ALERT_WINDOW`
- `RECORD_AUDIO`
- `MODIFY_AUDIO_SETTINGS`
- `READ_EXTERNAL_STORAGE`
- `WRITE_EXTERNAL_STORAGE`
- Broad `READ_MEDIA_IMAGES` if system picker is enough.

Repo status after the 2026-06-01 native config pass:

- Both Expo configs include `android.blockedPermissions` for broad media, microphone/audio, overlay, and legacy storage permissions.
- Fresh release manifest checks confirmed these permissions are absent from both release manifests.
- Client release manifest keeps foreground location, camera, notifications, biometric/fingerprint, vibration, and standard notification/Google service permissions.
- Rider release manifest keeps background location and foreground service location for active rider tracking.

### 5.2 Location

Client app:

- Prefer foreground location only.
- Request location incrementally when users need pickup/dropoff detection.
- Explain location usage in the permission prompt and privacy policy.

Rider app:

- Background location can be justified for active delivery tracking, rider availability, dispatch, and customer/admin tracking, but Google will review it.
- Background location must be core functionality and visibly described in the app/store listing.
- It cannot be used solely for ads or analytics.
- Provide a prominent in-app disclosure before requesting background location.
- Prepare a demo video, preferably 30 seconds or less, showing:
  - Rider going online or accepting a job.
  - The location disclosure.
  - Runtime permission prompts.
  - Background/foreground-service tracking notification.
  - Customer/order tracking outcome.

Suggested disclosure draft for rider app:

> RiderGuy Rider uses location in the background when the app is closed or not in use to share your location during active deliveries, match nearby jobs, show customers delivery progress, and help support resolve delivery issues.

Tune this to the final actual behavior. If tracking only runs while online, say "while you are online or completing deliveries" rather than "at all times".

### 5.3 Foreground services

Because the rider app targets Android 14+ and uses location foreground services, Play Console requires a foreground service declaration.

For `FOREGROUND_SERVICE_LOCATION`, prepare:

- Description of the delivery tracking functionality.
- User impact if location tracking is delayed or interrupted.
- Demo video showing how the rider triggers the service.
- Use case selection, likely:
  - Background Location Updates: Navigation.
  - Background Location Updates: User-initiated location sharing.
  - Vehicle activity tracking / ride or delivery tracking.

Also verify native services declare `android:foregroundServiceType="location"` where applicable.

### 5.4 Photo and video permissions

Google Play restricts broad photo/video access such as `READ_MEDIA_IMAGES` and `READ_MEDIA_VIDEO`.

Required action:

- If the app only needs one-time uploads for profile photos, delivery proof, vehicle photos, or documents, use a system picker and remove broad media permissions.
- If broad media access remains, complete the Play declaration and prove persistent/frequent access is core functionality.

Recommendation for RiderGuy: remove broad media permissions if possible. Proof/document/profile upload flows should not need persistent gallery access.

### 5.5 Push notifications

Required:

- Android 13+ runtime notification request must be handled gracefully.
- Data Safety should disclose push token/device identifiers if collected or transmitted.
- Firebase Cloud Messaging configuration must match each package.
- Reviewer accounts should trigger notifications or at least allow reviewers to understand the feature.

### 5.6 Sensitive APIs and SDKs

Required:

- Review Google Play SDK Index warnings for Firebase, maps, Expo/React Native related SDKs, and any payment/analytics SDKs.
- Remove SDKs that collect data not disclosed in Data Safety.
- Do not ship SDKs that download executable code or update APKs outside Google Play.

---

## 6. App Content Declarations

Each app must complete Play Console App Content sections.

### 6.1 Privacy policy

Required:

- Active public URL.
- Linked in Play Console.
- Linked inside both apps, preferably Settings/About.
- Names the app and/or developer entity shown in Google Play.
- Explains collection, use, sharing, retention, deletion, and security for all data categories.

RiderGuy privacy policy must cover at least:

- Names, phone numbers, emails, account identifiers.
- Ghana Card or identity fields if collected.
- Pickup/dropoff/saved addresses.
- Precise location and rider background location.
- Order history, package details, recipient info, delivery notes.
- Chat/in-app messages.
- Photos/documents/proof of delivery.
- Wallet, payout, purchase, transaction, and payment processor data.
- Device IDs, push tokens, diagnostics/crash logs if used.
- Third parties: Google Maps, Firebase, payment processors such as Paystack, SMS/email providers, hosting/storage, analytics/crash monitoring.
- Account deletion and data deletion paths.

### 6.2 Data Safety form

Prepare a data inventory per app before answering. Google displays a summary to users, and mismatches between app behavior, policy, and privacy policy can cause rejection.

Likely Data Safety categories for RiderGuy:

| Category | Client app | Rider app |
|---|---|---|
| Location | Precise/approximate pickup, dropoff, tracking | Precise/approximate foreground and background rider tracking |
| Personal info | Name, phone, email, user ID, addresses, Ghana Card if used | Name, phone, email, user ID, identity/onboarding data |
| Financial info | Payment method, wallet/top-up/transaction history | Wallet, earnings, payout information, withdrawal history |
| Photos and videos | Profile photo, support/proof uploads if available | Profile, document, vehicle, and proof photos |
| Files and docs | Support attachments if available | Rider onboarding documents |
| Messages | Chat/support/order messages | Chat/support/community messages |
| App activity | Orders, searches, saved addresses, ratings, promos | Jobs, online state, training/community, ratings, cancellations |
| App info/performance | Crash logs, diagnostics if collected | Crash logs, diagnostics if collected |
| Device or other IDs | Push token, Firebase install ID/device ID | Push token, Firebase install ID/device ID |

For each data type, document:

- Collected or shared.
- Required or optional.
- Purpose: app functionality, analytics, developer communications, fraud prevention, account management, etc.
- Whether encrypted in transit.
- Whether users can request deletion.
- Whether collection is ephemeral.

### 6.3 Account deletion

If users can create accounts in app, required:

- In-app path to request/delete account and associated data.
- Web link resource for account/data deletion requests.
- Data Safety "Data deletion" questions completed.
- Clear explanation of what data is deleted, retained, and why.

Recommended implementation:

- Add Settings -> Security/Account -> Delete account in both apps.
- Require re-authentication or PIN confirmation.
- Show retention exceptions, for example financial records, fraud prevention, legal/tax obligations, delivery dispute records.
- Publish `https://myriderguy.com/delete-account` or equivalent. The repo now includes the marketing route and native app links; the page still needs to be deployed before Play review.

### 6.4 App access

Required because both apps are login-gated:

- Provide reviewer credentials.
- Provide role-specific instructions.
- Provide any OTP/MFA bypass or stable test code.
- Explain test geography if flows are Ghana/geofence-dependent.
- Include up to five instruction sets if needed.

Minimum reviewer kit:

- Client test account with email/password/PIN and a preloaded wallet or test payment method.
- Rider test account with completed onboarding or instructions to pass onboarding.
- Test order already created or steps to create one.
- Backend/test data instructions if geofencing prevents normal physical completion.
- Any required location simulation note.

### 6.5 Ads declaration

Declare accurately whether the apps contain ads.

Current code scan did not show an obvious ad SDK. If that remains true, answer "No". If ads, sponsored placements, or ad SDKs are added later, update:

- Ads declaration.
- Data Safety.
- Privacy policy.
- Ad SDK compliance.

### 6.6 Target audience and content

Required:

- Declare target age group.
- If the app targets or appeals to children, Families policies apply.

Recommendation:

- Rider app should target adults only, likely 18+ or 21+ depending legal/business policy.
- Client app likely should not target children. If minors can use it, legal review is needed for account, location, payments, and courier safety.

### 6.7 Content rating

Required:

- Complete IARC content rating questionnaire for both apps.
- Apps without ratings can be treated as unrated and removed.

Expected likely result:

- Low maturity if no user-generated public content, violence, gambling, sexual content, or controlled substances.
- Community/chat features in rider app may change answers. Moderation and report/block flows matter.

### 6.8 Financial features declaration

Because RiderGuy includes wallets, payments, rider earnings, payouts, and withdrawals, complete or review the Financial features declaration carefully.

Required:

- Declare financial features if Play Console asks.
- Confirm the app does not offer loans, credit, crypto, investment, gambling, or unrelated financial products unless licensed and compliant.
- Keep payment/payout wording accurate.
- Be ready to provide licenses or documentation if Google requests them for target countries.

### 6.9 Payments policy

For physical delivery/transportation services:

- Google Play Billing is not used for physical services such as transportation or food delivery.
- Third-party processors such as Paystack/Google Pay can be appropriate for physical goods/services.

But:

- Digital goods, subscriptions, premium app features, or cloud/software services consumed in the app generally require Google Play Billing unless an approved regional alternative applies.
- Do not sell digital credits or subscriptions in-app through Paystack unless policy-reviewed.

RiderGuy recommendation:

- Keep client/rider payments clearly tied to physical delivery/transport services and wallet balances for those services.
- Avoid in-app digital subscriptions at launch.
- If a membership/priority/support subscription is added later, review Play Billing first.

---

## 7. Store Listing Requirements

Each app needs its own complete listing.

### 7.1 Text fields

Required:

- App name: 30 characters max.
- Short description: 80 characters max.
- Full description: 4000 characters max.

Avoid:

- Repetitive keywords.
- Claims not visible in the app.
- Overstated safety, income, delivery speed, or availability claims.
- Mentions of unsupported cities/countries.

### 7.2 Graphic assets

Required/recommended for phone apps:

- App icon.
- Feature graphic.
- Phone screenshots.
- Up to 8 screenshots per supported device type.
- Alt text for graphics.

Screenshot guidance:

- Use real app screens from current version.
- Show core flows:
  - Client: request delivery, map/tracking, order detail, wallet/payment, safety/support.
  - Rider: online/available jobs, job detail/map, active delivery, proof, earnings.
- Avoid placing misleading marketing text that is not part of the app UI.
- Do not show placeholder data that looks broken.

Large screen assets:

- If targeting tablets/Chromebooks, provide large-screen screenshots and test responsive behavior.
- If not ready for large screens, constrain supported devices appropriately in Play Console/device catalog after review.

### 7.3 Contact details

Required:

- Support email.

Recommended:

- Support website.
- Support phone number.
- Separate operational support inbox from the Play Console owner account.

### 7.4 Category, tags, country availability

Required:

- Choose category and up to five relevant tags.
- Choose countries/regions.
- Confirm local availability matches operational coverage.

RiderGuy recommendation:

- Do not publish globally at launch if service only operates in Ghana or selected cities.
- Restrict country availability to launch markets.
- Ensure privacy policy, terms, pricing, and support are valid for those countries.

---

## 8. External Services To Prepare

### 8.1 Google Maps Platform

Required:

- Android Maps SDK key restricted by package name and SHA-1/SHA-256.
- Separate entries for:
  - `com.riderguy.client`
  - `com.riderguy.rider`
- Use Play app signing fingerprints after Play App Signing is enabled.
- Keep server-side routes/geocoding keys restricted separately from mobile keys.

### 8.2 Firebase / FCM

Required:

- Firebase Android app for `com.riderguy.client`.
- Firebase Android app for `com.riderguy.rider`.
- Correct `google-services.json` per app.
- SHA-1/SHA-256 fingerprints added for release signing.
- Push notification path tested from production backend.

### 8.3 Google OAuth

Required if Google sign-in is active:

- Android OAuth client IDs for both packages and release SHA-1 certificates.
- Redirect URIs/deep links aligned with the native apps.
- Test sign-in after installing Play-signed builds, not only local builds.

### 8.4 Android App Links

Current hosts:

- `riderguy.com`
- `www.riderguy.com`
- `app.myriderguy.com`

Required:

- Publish `https://<host>/.well-known/assetlinks.json` for every host in the verified intent filters.
- Include both packages and release SHA-256 fingerprints.
- Use the Play App Signing certificate fingerprint, not only local upload key.
- Test with `adb shell pm get-app-links --user 0 <package>`.

### 8.5 Payment processors

Required:

- Payment processor production accounts.
- Webhook endpoints live and secured.
- Refund/dispute process documented.
- Receipts and support contact ready.
- Payment data reflected in privacy policy and Data Safety.
- Google Play Payments policy reviewed for every monetized feature.

---

## 9. Release Track Plan

Recommended sequence:

1. Internal app sharing or internal testing:
   - Upload first AABs.
   - Validate signing, maps, Firebase, OAuth, app links, login, and crash-free startup.
2. Closed testing:
   - Test with internal team/riders.
   - Include at least one realistic client order and one rider delivery path.
   - For personal accounts, satisfy 12 testers / 14 continuous days.
3. Production readiness review:
   - Complete App Content.
   - Fix policy warnings.
   - Run pre-launch report and Android vitals checks.
   - Confirm no unsupported permissions.
4. Staged production rollout:
   - Start small, for example 5% or a city-limited release.
   - Monitor crashes, ANRs, login failures, payment failures, dispatch latency, and support tickets.
5. Increase rollout:
   - Move to 25%, 50%, 100% only after operational checks pass.

Recommended launch order:

- Client app can be reviewed first if it does not depend on background location.
- Rider app likely needs more review time because of background location, foreground service, identity documents, earnings/payouts, and restricted operational access.

---

## 10. Production QA Checklist

Run this against Play-signed builds from an internal or closed track.

### 10.1 Client app

- Fresh install opens without crash.
- Register/login works.
- Email/phone/Ghana Card login modes behave as documented.
- Password/PIN reset works.
- Maps render.
- Pickup/dropoff location permission prompt appears at the right time.
- User can book a delivery.
- Estimate, price, scheduled delivery, and extra stops are correct.
- Payment/wallet path works in production mode.
- Order tracking works with rider location.
- Notifications arrive.
- Chat/support works.
- Rating works.
- Settings/About includes privacy policy, terms, support, and account deletion.
- App works if location permission is denied, with manual address entry.
- App works if notification permission is denied.

### 10.2 Rider app

- Fresh install opens without crash.
- Rider login works.
- Onboarding/document upload works.
- Going online requests location permissions in the right order.
- Background location disclosure appears before background location request.
- Foreground service notification is clear while tracking.
- Available jobs load.
- Accept/decline job works.
- Job map renders.
- Status transitions work.
- Navigation/deep links work.
- Proof of delivery works.
- Wallet/earnings/withdrawal screens work.
- Push notifications arrive for job offers/status changes.
- Going offline stops background tracking.
- App works or degrades gracefully if location permission is denied.
- Settings/About includes privacy policy, rider terms, support, and account deletion.

### 10.3 Shared backend/release checks

- Production API URL is correct.
- Socket URL is correct.
- No staging secrets in app bundle.
- Google Maps key is not placeholder.
- Firebase config is for production project.
- Push token registration succeeds.
- Logs do not leak PII/secrets.
- Rate limits do not block Play reviewers.
- Test accounts remain valid through review.
- Data retention jobs run as documented.
- Privacy policy matches actual API behavior.

---

## 11. Documents And Assets To Prepare

For each app:

- Final AAB.
- Store listing copy.
- App icon.
- Feature graphic.
- 6 to 8 phone screenshots.
- Optional tablet screenshots if supported.
- Privacy policy URL.
- Terms of service URL.
- Account deletion URL.
- Support email, support website, support phone.
- Reviewer access instructions.
- Data Safety worksheet.
- Content rating questionnaire answers.
- Target audience answers.
- Ads declaration answer.
- Financial features declaration answer.
- Permission declaration answers.
- Background location demo video for rider app.
- Foreground service demo video for rider app.
- `assetlinks.json` entries after Play App Signing certificate is available.
- Google Maps/Firebase/OAuth release certificate fingerprints.

---

## 12. RiderGuy Launch Readiness Matrix

| Item | Client app | Rider app | Status |
|---|---|---|---|
| Package name final | `com.riderguy.client` | `com.riderguy.rider` | Looks final, confirm before first upload |
| Target SDK 35+ | Yes | Yes | Repo configured; QA Android 15 behavior |
| AAB production profile | Yes | Yes | `eas.json` production uses `app-bundle` |
| Release signing | Configurable via secrets | Configurable via secrets | Add real upload keystores in EAS/CI |
| Google Maps key | Required | Required | Needs release SHA restrictions |
| Firebase config | Required | Required | Needs release SHA fingerprints |
| Background location | Not expected | Yes | Rider policy blocker until declared/approved |
| Foreground service | Not expected | Yes, location | Rider declaration required |
| Photo/media broad access | Removed from release | Removed from release | QA camera/picker flows |
| Account deletion | In app and web | In app and web | Deploy `/delete-account` and configure Play URL |
| Privacy policy in app | Exists | Exists | Must be complete and active |
| Reviewer credentials | Needed | Needed | Must prepare |
| Data Safety | Needed | Needed | Must prepare |
| Store assets | Needed | Needed | Must prepare |

---

## 13. Official Sources

- Google Play target API level requirements: https://developer.android.com/google/play/requirements/target-sdk
- Create and set up your app in Play Console: https://support.google.com/googleplay/android-developer/answer/9859152
- Android App Bundle requirement: https://developer.android.com/guide/app-bundle
- Play App Signing: https://support.google.com/googleplay/android-developer/answer/9842756
- Prepare your app for review / App Content declarations: https://support.google.com/googleplay/android-developer/answer/9859455
- Data Safety form: https://support.google.com/googleplay/android-developer/answer/10787469
- Account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Background location permissions: https://support.google.com/googleplay/android-developer/answer/9799150
- Foreground service and full-screen intent requirements: https://support.google.com/googleplay/android-developer/answer/13392821
- Permissions and APIs that access sensitive information: https://support.google.com/googleplay/android-developer/answer/9888170
- Photo and video permissions policy: https://support.google.com/googleplay/android-developer/answer/14115180
- Store listing preview assets: https://support.google.com/googleplay/android-developer/answer/9866151
- Content ratings: https://support.google.com/googleplay/android-developer/answer/9898843
- Target audience and content: https://support.google.com/googleplay/android-developer/answer/9867159
- Personal-account testing requirements: https://support.google.com/googleplay/android-developer/answer/14151465
- Set up internal/closed/open testing: https://support.google.com/googleplay/android-developer/answer/9845334
- Developer account type: https://support.google.com/googleplay/android-developer/answer/13634885
- Required Play Console account information: https://support.google.com/googleplay/android-developer/answer/13628312
- Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Understanding Google Play payments: https://support.google.com/googleplay/android-developer/answer/10281818
- Financial Services policy: https://support.google.com/googleplay/android-developer/answer/16322411
- Google Play SDK Index: https://developer.android.com/distribute/sdk-index
- Android App Links and Digital Asset Links: https://developer.android.com/training/app-links/configure-assetlinks
