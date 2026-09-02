# RiderGuy Administrator Platform Rework

**Assessment date:** 2 September 2026  
**Scope:** Administrator portal, operations API, Rider Android integration, production configuration, and RiderGuy visual consistency.

## Product standard

The administrator portal is an operational control room, not a collection of
CRUD screens. An operator must be able to understand what requires attention,
why it is blocked, what decision is safe, and what happened afterwards without
cross-referencing several pages.

The visual language must be recognisably RiderGuy:

- primary mint `#40BE89` and action green `#079B61`;
- near-black ink `#050505` / `#111814`;
- warm white and mist surfaces `#FFFFFF`, `#F7FAF8`, and `#F3FBF7`;
- Poppins typography, rounded but disciplined geometry, and restrained depth;
- amber, red, blue, and violet used only as semantic operational signals.

## Confirmed production defects

| Severity | Area | Finding | Required correction |
| --- | --- | --- | --- |
| Critical | API validation | Express 5 exposes `req.query` as getter-only. The shared validator assigns to it and crashes every query-validated endpoint. Rider cases, asset financing, events, feature requests, mentorship search, account recovery, and Rider history are affected. | Safely shadow the getter with parsed Zod output and add an Express 5 regression test. |
| High | Dispatch | The admin sends comma-separated status groups while the API passes the entire string to Prisma as one enum value. Filtered order views fail. | Parse, validate, de-duplicate, and convert multi-status filters to a Prisma `in` clause. |
| Critical | Dispatch UI contract | The queue reads `data.data` although the API returns `orders`, renders the wrong Rider shape, and sends `riderId` although assignment requires `riderProfileId`. The result is a false empty state and failed manual assignments. | Align the page with the API response and command contract; expose request failures instead of swallowing them. |
| High | Administrator credentials | The Settings page submits a password change to the nonexistent `PATCH /users/password` route. | Use the validated `POST /users/change-password` contract and update the local administrator identity after profile edits. |
| High | Rider decisions | Rejected Rider applications are counted as open and can satisfy the database “ready” filter. Restricted accounts are not represented in readiness. | Exclude terminal rejection from open/action/ready queues and add rejection/account-access blockers. |
| High | Error visibility | Several pages swallow request failures or use generic alerts, making a broken API look like an empty queue. | Give every operational page explicit loading, empty, error, retry, and success states with the API message preserved. |
| Verified | Production storage | S3/R2 endpoint, bucket, and credentials are present in the running API configuration. | Expose only a safe configured/unconfigured signal in the Super Admin readiness view; never expose secret values. |
| Verified | Google sign-in | The Rider EAS production environment has a web client ID and Google services file, and the API has an OAuth audience allowlist. | Retain the end-to-end sign-in acceptance test on the signed store build. |
| Medium | Geocoding | Paid Google Maps geocoding is disabled. The Ghana/community dataset fallback is active. | Keep the Ghana fallback visible as healthy degraded mode; configure a key only when paid Maps features are required. |
| Medium | Dependencies | Deployment reports seven inherited npm advisories, including one high-severity advisory. | Triage direct versus transitive packages and upgrade with regression tests; do not run a blind breaking `audit fix --force`. |

## Confirmed experience problems

1. The admin shell is generic white/gray navigation with text-only links; it
   does not share the Rider app’s identity, hierarchy, or visual confidence.
2. Admin metadata still declares a generic blue theme and Inter, while the Rider
   product uses Poppins and the mint/ink system.
3. The dashboard relies on emoji glyphs, some of which are mojibake in source,
   and presents metrics without an operational priority model.
4. The Rider Operations page is functionally dense but visually flat. Critical
   blockers, ready cases, evidence queues, and invitations compete equally.
5. Browser-native `alert`, `confirm`, and `prompt` interactions remain in core
   decision flows. They are inconsistent, inaccessible, and provide poor audit
   context.
6. Navigation is a long undifferentiated list. It needs groups for Operations,
   People, Growth, and Intelligence plus clear active and system-health states.
7. Empty datasets dominate production today, so polished empty states and clear
   next actions are part of the main experience—not edge cases.

## Reworked information architecture

### Command centre

- Live operational pulse: Riders online, active deliveries, orders today, and
  revenue today.
- Priority work: onboarding reviews, withdrawals, unassigned orders, stale
  cases, and asset-financing reviews.
- Direct actions into each queue, with timestamps and health/degraded signals.

### Rider operations

- A single case queue organised by action required, ready, waiting on Rider,
  rejected, and activated.
- Case detail with identity, documents, vehicle, training, financing, activity,
  blockers, safe decisions, and audit history.
- Invitation desk for targeted, expiring, one-time In-House Rider invitations.

### Other domains

- Delivery control: dispatch and zones.
- People: Riders and all accounts.
- Programmes: financing, gamification, and jobs.
- Intelligence: financials, analytics, and support messages.
- Workspace: administrator profile, credentials, and system status.

The Super Admin system-readiness view reports safe state only for the database,
object storage, Google sign-in, email, SMS, payments, Rider notifications, and
maps. It deliberately returns no credential, endpoint, project, or account
value. An intentional Ghana fallback is distinguished from an outage.

## Acceptance gates

- Every admin GET endpoint used by a page returns a successful, schema-compatible
  response for a production Super Admin.
- Unauthorized requests remain rejected and destructive decisions remain role
  gated, reasoned, concurrency-safe, and audited.
- Rider Android onboarding status and admin case readiness agree for the same
  Rider record.
- Filtered dispatch queues and every Zod-validated query route have automated
  regression coverage.
- Desktop and mobile admin layouts pass visual inspection for loading, populated,
  empty, error, modal, and long-content states.
- No production deployment is accepted until lint, type-check, unit tests,
  production builds, live endpoint smoke tests, and browser verification pass.
