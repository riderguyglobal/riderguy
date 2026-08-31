# RiderGuy launch hardening audit — 2026-08-25

## Executive status

The Android client and rider applications are already in Google Play production at version code 19 with a 100% rollout and target SDK 36. The source tree now passes the complete lint, type-check, test, and production-build checks available on this workstation. A fresh Rider Android JavaScript/Hermes export also succeeds.

The launch is not yet considered fully closed because three product/console decisions remain:

1. The client production track currently targets Ghana and Nigeria. The stated launch scope is Ghana only, so Nigeria must be removed in Play Console after explicit action-time confirmation.
2. Play Console still displays the Android 16 / API 36 policy warning even though production version 19 reports target SDK 36. This must be monitored until Play finishes propagation, and any older active testing track should be inspected if the warning remains before 2026-08-31.
3. Every rider registration path currently creates an `ACTIVATED`, verified rider. This intentionally bypasses document review, but it allows newly registered riders to accept jobs without admin approval. Product ownership must either reconfirm this risk or restore the `REGISTERED` → document review → activation workflow.

## Verified live state

- API health: `https://api.myriderguy.com/health` returned HTTP 200 with database and Redis both `ok`.
- Rider Play production: version 19, 100% rollout, Ghana only, target SDK 36.
- Client Play production: version 19, 100% rollout, Ghana and Nigeria, target SDK 36.
- Rider closed testing remains active at version 6. Tester accounts can therefore still see a Beta label; this does not mean production is inactive.
- Both Play dashboards have too little installation volume to draw a reliable crash/ANR conclusion. An empty metric is not evidence of zero crashes.
- Privacy policy, account deletion page, and Android `assetlinks.json` endpoints return HTTP 200.
- Live reset/verification web fallbacks currently return 404. Source fallbacks are implemented, but the marketing application must be deployed for them to become live.
- iOS AASA endpoints return 404 and EAS iOS submission IDs are placeholders. This audit therefore certifies the Android path, not an iOS launch.

## High-priority defects fixed

- Fixed concurrent native token refresh so queued requests resolve after a successful refresh and reject after a failed refresh instead of hanging forever.
- Added regression tests for concurrent token refresh success and failure.
- Restored rider online services after process/app restart: socket, foreground GPS, background location, keep-awake, and authenticated location updates.
- Prevented rider job-offer navigation during render and hardened offer socket cleanup/reconnection.
- Fixed direct community chat to use the validated `targetUserId` field; it previously passed `undefined` to the service.
- Applied existing validators to chat read markers, poll votes, and payment verification path parameters.
- Fixed production rate-limit configuration detection so a missing `REDIS_URL` cannot silently masquerade as configured Redis.
- Migrated Firebase Admin push messaging to the supported modular API.
- Migrated the BullMQ recurring cleanup job to the v6 scheduler API.
- Added correct client/rider-specific verification and password-reset links plus safe web fallback pages.
- Passed Google Places session tokens into Place Details requests.
- Removed an unused, vulnerable admin AI-chat dependency surface and its dead routes.
- Made production admin/marketing API fallbacks use `https://api.myriderguy.com/api/v1` instead of localhost.
- Corrected the Ghana zone UI, which still suggested Johannesburg and South African coordinates.
- Configured Android production EAS submissions for the production track and validated Firebase package/application-ID matching.

## Verification evidence

- Root lint: 15/15 tasks passed with no warnings.
- Root type-check: 16/16 tasks passed.
- API tests: 279/279 passed across 11 files.
- Native auth regression tests: 2/2 passed.
- Root production build: 7/7 build tasks passed, including API, admin, and marketing.
- Rider Android export: 1,841 modules bundled; 5.4 MB Hermes bundle generated successfully.
- Client Android export: previously regenerated successfully during this audit; 1,837 modules and a 5.37 MB Hermes bundle.
- Expo Doctor: 17/18 checks for both native apps. The only warning is the expected managed-config/native-folder synchronization warning; native Android configuration was manually checked for package IDs, intents, permissions, and deep links.
- `git diff --check`: passed.
- Secret scan: no committed production keys, keystores, Play service-account file, Firebase config, or local `.env` files were found.
- Dependency tree: valid after cleanup; no critical production advisories.

## Residual technical risks

- `npm audit --omit=dev` reports 27 transitive advisories: 14 moderate and 13 high. They are concentrated in Expo/Metro, Prisma CLI/config, and Firebase/Google Cloud dependencies. The offered fixes are major upgrades or unsafe downgrades, so `npm audit fix --force` must not be used. Plan a tested Expo SDK 57 migration separately.
- Expo Doctor warns because committed `android`/`ios` folders coexist with `app.config.ts`. EAS will not automatically synchronize all config fields into committed native projects. Continue reviewing native diffs whenever app config changes, or schedule a controlled move back to CNG/prebuild.
- A native Gradle/AAB build could not be executed locally because this workstation has no Java or Android SDK configured. EAS should remain the authoritative Android builder; inspect the resulting AAB before the next Play upload.
- Production configuration currently logs warnings rather than refusing startup when payment, SMS, email, Firebase, S3, Maps, or WebAuthn values are absent. Add service-level readiness probes and deployment smoke tests before scaling traffic.
- Monitoring data is not mature enough to call the system “foolproof.” Add Sentry release tracking, Play vitals alerts, synthetic booking/payment tests, and an operational rollback procedure.

## Recommended release sequence

1. Confirm and remove Nigeria from the client production-country list.
2. Decide whether rider auto-activation is acceptable for the Ghana launch.
3. Deploy the API and marketing changes; smoke-test client and rider reset/verification links.
4. Build new Android AABs with EAS, verify package IDs, signatures, target SDK 36, version codes, and 16 KB compatibility, then release through a staged production rollout.
5. Recheck Play policy status before 2026-08-31 and inspect/deactivate obsolete testing releases only if they are the remaining source of the warning.
6. Monitor auth failures, order creation, payment webhooks, dispatch latency, background rider tracking, crashes, and ANRs during rollout.
