# End-to-End Rider ↔ Client Flow — Deep Audit (2026-04-27)

**Author:** Senior dev / project lead pass  
**Scope:** Full pipeline — Client request → matching → rider accept → pickup → delivery → payment → review.  
Apps: `apps/client`, `apps/rider`, `apps/api`. Shared: `packages/database`, `packages/types`, `packages/validators`, `packages/auth`.

This audit was produced by 5 parallel deep-read passes (client app, rider app, API order lifecycle, sockets/payments/jobs, schema/types/auth). All findings below are **post-verified** against the live source — items the subagents flagged as critical but already fixed in prior waves were dropped or downgraded. The audit is the basis for the staged fix plan that follows in `docs/audits/E2E_FIX_PLAN_2026_04_27.md` (next).

---

## Items the audits flagged but are already fixed (no action)

| Subagent claim | Reality |
|---|---|
| IDOR on `GET /orders/:id` | Already enforced — `order.routes.ts` lines 614-635 (client/rider/admin gate). |
| Webhook raw-body not captured | Captured via `express.json({ verify })` in `app.ts:42-43`. |
| Refresh token rotation not implemented | `refreshTokenHash` stored & rotated across all auth flows in `auth.service.ts`. |
| Logout doesn't invalidate session server-side | `AuthService.logout()` deletes the `Session` row (line 1120). |
| Soft-delete filter not applied | Prisma `$extends` extension at `packages/database/src/index.ts` injects `deletedAt: null` on all `find*` / `count`. |
| Cancellation request status guard missing | `authorizeCancelRequest` checks `request.status !== 'PENDING'` at line 146. |
| `disconnectSocket()` not called on logout | Wired in prior wave (`rider_audit_fixes_completed.md`). |

These represent earlier fix waves working as intended.

---

## Confirmed findings — categorized & severity-rated

Severity scale: **C** = Critical (production blocker / money or PII at risk), **H** = High (real user impact, data integrity or UX-blocking), **M** = Medium (degraded reliability), **L** = Low (polish / hardening).

### A. Payments, Wallet, Settlement

| ID | Sev | Title | Where |
|---|---|---|---|
| **PAY-01** | **C** | No idempotency by Paystack event-id. `charge.success` retried in <1s of first delivery can both pass `paymentStatus !== 'COMPLETED'` check before either commit, racing against `/verify`. Need `WebhookEvent` table keyed by `event.id`. | `apps/api/src/routes/payments/payment.routes.ts` `charge.success` block |
| **PAY-02** | **C** | Payout retry double-creates Paystack transfer recipient. Recipient code never persisted on `Withdrawal`, so a worker retry after partial failure hits Paystack's recipient endpoint again. | `apps/api/src/jobs/workers.ts` payout worker |
| **PAY-03** | **H** | Decimal money math uses `roundGhs()` (float `Math.round`) on intermediate steps. Across 4–5 multipliers (surge × ToD × weather × cross-zone × express) accumulates ±1 GHS over thousands of orders → settlement mismatches. | `apps/api/src/services/pricing.service.ts` |
| **PAY-04** | **H** | Cancellation `executeCancellation` is invoked from two `authorizeCancelRequest` branches (lines 196, 234) — guard against double-execution depends entirely on caller ordering. Add status-was-pending re-check inside `executeCancellation` (defense-in-depth). | `apps/api/src/services/cancellation-request.service.ts` |
| **PAY-05** | **H** | Promo per-user limit race: `tx.promoCodeUsage.count` runs inside the transaction but two concurrent `createOrder` calls from same user can both see `count = 0` if the `PromoCodeUsage` row isn't unique on `(promoCodeId, userId)`. Verify schema; if missing, add unique index + handle P2002. | `apps/api/src/services/order.service.ts:210-235` + schema |
| **PAY-06** | **M** | No `CHECK (balance >= 0)` constraint at DB level. Any direct SQL bug bypasses the optimistic `gte: amount` guard. | `packages/database/prisma/schema.prisma` `Wallet` |
| **PAY-07** | **M** | Receipt email may double-send on worker retry. No `receiptEmailSentAt` flag. | `apps/api/src/jobs/workers.ts` receipt worker |
| **PAY-08** | **M** | Client payment page can call `/payments/verify/:ref` twice on rapid double-click; server is safe via `updateMany` but the second call still hits Paystack. Add a `verifyInProgressRef` guard. | `apps/client/src/app/(dashboard)/dashboard/orders/[id]/payment/page.tsx:195-211` |
| **PAY-09** | **L** | Commission rounding mode not documented. Reconciliation report missing. | `pricing.service.ts:186-188` |

### B. Auth, Sessions, Multi-tenant Isolation

| ID | Sev | Title | Where |
|---|---|---|---|
| **AUTH-01** | **H** | API key stored in plaintext (`ApiKey.key @unique`). Should be SHA-256 `keyHash`. | `schema.prisma` `ApiKey` model line 547 |
| **AUTH-02** | **H** | Per-user (phone) rate-limit bucket missing. Rate limiting is per-IP only — NAT'd attackers each get 10 attempts. | `apps/api/src/middleware/rate-limit.ts` auth limiter |
| **AUTH-03** | **H** | Email verification (`emailVerified`) never enforced on email-based password reset. Anyone who registers with someone else's email and skips verification can later trigger reset for that email. | `auth.service.ts` reset flow + `auth.routes.ts` |
| **AUTH-04** | **M** | Socket reconnect re-uses verified JWT but doesn't check token-revocation list (no Redis blocklist). Stolen access token survives until expiry (~15 min). | `apps/api/src/socket/index.ts:61-78` |
| **AUTH-05** | **M** | `Session.ipAddress` / `deviceInfo` captured but never validated on subsequent calls. No velocity/geo check. | `auth.service.ts` |
| **AUTH-06** | **M** | IDOR sweep needed on rider-facing GETs: `GET /riders/:id`, `GET /riders/:id/vehicle/:vId`, `GET /documents`. Verify each enforces `req.user.userId === resource owner` (or admin role). | `apps/api/src/routes/riders/**`, `documents/**` |
| **AUTH-07** | **L** | OTP entropy (6 digits) sufficient with rate-limit + 5-min TTL, but for high-value financial actions (withdrawals) consider 8 digits. | `auth.service.ts` |

### C. Order Lifecycle, Dispatch, Realtime

| ID | Sev | Title | Where |
|---|---|---|---|
| **ORD-01** | **H** | Pending-offer re-emit on socket reconnect doesn't validate rider state (`availability`, `suspendedUntil`, `onboardingStatus`) or order state (still unassigned). Suspended rider mid-flight can see a stale offer. | `apps/api/src/socket/index.ts:144-185` |
| **ORD-02** | **H** | Job-offer respond from rider PWA has **no client-side dedup**. Double-tap "Accept" emits `job:offer:respond` twice; server may treat both as concurrent acceptances. | `apps/rider/src/hooks/use-socket.ts:253-280` |
| **ORD-03** | **M** | Multi-stop order has no upper bound on `stops.length`, no contiguous-sequence enforcement, no balanced pickups/dropoffs validation. Hostile/ill-formed payload → unrealistic price + impossible route. | `apps/api/src/routes/orders/order.routes.ts` createOrderSchema |
| **ORD-04** | **M** | Reconnect replays only the pending offer; does **not** replay missed `order:status`, `message:new`, or `admin:*` events while disconnected. Rider may miss client cancellation. | `socket/index.ts:120-190` |
| **ORD-05** | **M** | Per-event-type socket rate-limit absent. One event type (`rider:updateLocation`) can consume the global 60/10s bucket. | `socket/index.ts:85-114` |
| **ORD-06** | **M** | Stale estimate submitted from client. `estimatedAtRef` recorded but not consulted on submit; if the user idles 5+ min before tapping confirm, surge/ToD has changed. | `apps/client/src/app/(dashboard)/dashboard/send/page.tsx:280-420` |
| **ORD-07** | **M** | Auto-dispatch scoring doesn't filter `suspendedUntil > now()`. Suspended riders receive offers that simply expire silently. | `auto-dispatch.service.ts` |
| **ORD-08** | **L** | N+1 on admin dashboard stats — 16 separate aggregate queries fired per dashboard load. Batch into `groupBy` / single `$queryRaw`. | `apps/api/src/routes/admin/admin.routes.ts:30-60` |
| **ORD-09** | **L** | Breadcrumb-flush failure silent — buffer caps at 500 then drops oldest with no rider notification. | `socket/index.ts:268-276` |

### D. Client PWA — Reliability & UX

| ID | Sev | Title | Where |
|---|---|---|---|
| **CLI-01** | **H** | Service worker `ORDER_STATUS_CHECK` snapshot includes a JWT that may expire while app is backgrounded. SW has no refresh path. | `apps/client/src/sw.ts:68-214` |
| **CLI-02** | **H** | Socket auth token stale during reconnect. `(sharedSocket as any).auth = { token: tokenStorage.getAccessToken() }` reads token at reconnect time but isn't synchronized with the Axios refresh interceptor. | `apps/client/src/hooks/use-socket.ts:39-43, 85` |
| **CLI-03** | **H** | Socket emit helpers (`sendMessage`, `sendTyping`, `subscribeToOrder`) emit blindly without checking `connected` — silent drops with no user feedback. | `apps/client/src/hooks/use-socket.ts:189-200` |
| **CLI-04** | **H** | Nearby-riders 15s polling started on the send page is only cleared on unmount; persists across in-app navigation while user is on tracking page. | `apps/client/src/components/client-map.tsx:131-143` |
| **CLI-05** | **H** | Photo upload partial-failure UX: per-photo failures only surface as a final `setError(`${n} photos failed`)` banner — easy to miss. | `send/page.tsx:357-377` |
| **CLI-06** | **M** | Tracking map silently swallows directions fetch failures (`if (!routes?.[0]) return;`) — user sees markers, no route, no message. | `apps/client/src/components/tracking-map.tsx:66-84` |
| **CLI-07** | **M** | `forgot-pin/page.tsx` uses raw `fetch()` instead of the auth-aware Axios client → no auth refresh, no retry, inconsistent with rest of app. | `apps/client/src/app/(auth)/forgot-pin/page.tsx:70-135` |
| **CLI-08** | **M** | `submittingRef` double-tap guard has no timeout — if the request hangs it's reset only by `finally`, but a network freeze can lock the button. | `send/page.tsx:396-398` |
| **CLI-09** | **L** | `MAX_SERVICE_DISTANCE_KM = 50` hardcoded; should come from `/config` (or zone). | `send/page.tsx:33` |
| **CLI-10** | **L** | Offline SW redirects every document request to `/~offline` with no preservation of the intended URL. | `sw.ts:47-50` |
| **CLI-11** | **L** | API base URL inconsistency — `use-socket.ts` does `replace('/api/v1', '')` instead of an explicit `API_WS_URL` constant. | `lib/constants.ts` & `hooks/use-socket.ts:10` |

### E. Rider PWA — Reliability, Battery, Resilience

| ID | Sev | Title | Where |
|---|---|---|---|
| **RID-01** | **H** | Continuous high-accuracy `watchPosition` + 30 s REST heartbeat + per-position socket emit = severe battery drain. Need debounce by distance/heading + adaptive accuracy. | `apps/rider/src/hooks/use-rider-availability.ts:117-145` |
| **RID-02** | **H** | Geolocation watcher restart on `visibilitychange === 'visible'` doesn't `clearWatch` the existing watcher first → racey duplicate watchers if the visibility flip is fast. | `use-rider-availability.ts:165-180` |
| **RID-03** | **H** | Service worker token is set once (`idbSetConfig`) and never refreshed when the main thread rotates the access token. Background syncs eventually 401. | `apps/rider/src/sw.ts:200` + `use-socket.ts:131-134` |
| **RID-04** | **M** | Offline socket-queue drops events silently after `QUEUE_MAX_AGE_MS = 120_000`. Rider doesn't know their ack/decline never reached the server. | `apps/rider/src/hooks/use-socket.ts:37-60` |
| **RID-05** | **M** | Location POST errors (`api.post('/riders/location').catch(() => {})`) are entirely swallowed. Three+ consecutive failures should warn the rider. | `use-rider-availability.ts:150` |
| **RID-06** | **M** | Push notification (FCM) token never re-registered. FCM tokens can rotate; rider stops getting pushes mid-shift with no recovery. | `use-push-notifications.ts:36-52` |
| **RID-07** | **M** | Proof-of-delivery `api.post('/orders/:id/proof', formData)` has no timeout. Large photo on weak network can hang indefinitely. | `dashboard/jobs/[id]/page.tsx:190-195` |
| **RID-08** | **M** | `forgot-pin` page uses hardcoded `API_BASE_URL` + raw fetch (same pattern as client app). | `apps/rider/src/app/(auth)/forgot-pin/page.tsx:71` |
| **RID-09** | **M** | `subscribedOrders` set has no cap. Visiting many job detail pages without unsubscribing accumulates rooms. | `apps/rider/src/hooks/use-socket.ts:12-14` |
| **RID-10** | **L** | `OFFER_COUNTDOWN`, heartbeat, reconnect delays all hardcoded — should be derivable from offer payload (`expiresAt`) or config endpoint. | `apps/rider/src/lib/constants.ts` |
| **RID-11** | **L** | Audio-keepalive `AudioContext` not closed on early-return path. | `use-audio-keep-alive.ts:72-95` |

### F. Background Jobs / Observability

| ID | Sev | Title | Where |
|---|---|---|---|
| **JOB-01** | **C** | Critical job failures (payout, settlement) have **no admin alert**. Failed → DLQ → silent. Rider's withdrawal stuck in `PROCESSING` forever. | `apps/api/src/jobs/workers.ts` (all `.on('failed', ...)`) |
| **JOB-02** | **M** | Receipt / commission / push workers have no `limiter:` clause — bursts can saturate downstream (email provider, FCM). Only payout worker is rate-limited. | `apps/api/src/jobs/workers.ts` |
| **JOB-03** | **M** | No correlation IDs linking HTTP request → enqueued job → retries. Hard to debug at scale. | `jobs/queues.ts`, `jobs/workers.ts` |
| **JOB-04** | **L** | Cron runs in UTC; `Africa/Accra` (GMT+0) is fine in practice but make `tz` explicit for future-proofing. | `jobs/queues.ts:106` |
| **JOB-05** | **L** | LocationHistory `retentionDays: 90` hardcoded. | `jobs/workers.ts:508-524` |

---

## Severity rollup

| Severity | Count |
|---|---|
| **Critical (C)** | 3 — `PAY-01`, `PAY-02`, `JOB-01` |
| **High (H)** | 18 |
| **Medium (M)** | 22 |
| **Low (L)** | ~12 |

---

## Fix plan — staged

### Wave 1 — Critical (this session)
1. **PAY-01** — `WebhookEvent` table + idempotent `charge.success` / `transfer.*` handler.
2. **PAY-02** — persist `paystackRecipientCode` on `Withdrawal`; reuse on retry.
3. **JOB-01** — central `notifyAdminJobFailure(...)` helper + wire to all worker `failed` handlers.
4. **PAY-05** — verify schema unique on `PromoCodeUsage(promoCodeId, userId)`; if missing, add migration + P2002 handling.

### Wave 2 — High (this session, after Wave 1 verifies)
5. **PAY-03** — switch `pricing.service.ts` to `decimal.js` (or pesewas integer math) for all intermediates; round once at the boundary.
6. **PAY-04** — defense-in-depth idempotency in `executeCancellation`.
7. **AUTH-01** — `ApiKey.keyHash` (SHA-256) + back-compat creation flow.
8. **AUTH-02** — composite per-(IP, phone) rate-limit key on auth limiter.
9. **AUTH-03** — block password reset for `emailVerified === false`.
10. **ORD-01** — pending-offer re-emit validates rider + order state.
11. **ORD-02** — client-side dedup of `job:offer:respond` (in-flight set keyed by orderId).
12. **CLI-01 / RID-03** — token-refresh broadcast channel between main thread and SW (`postMessage('TOKEN_REFRESHED')`).
13. **CLI-02** — single source of truth for token in socket auth callback (Zustand getter, refresh-aware).
14. **CLI-03** — guard socket emits with `connected` check + queue or surface error.
15. **RID-01** — debounce GPS by distance/heading; switch to `LOW_ACCURACY` when stationary.
16. **RID-02** — `clearWatch` before restart on visibility change.

### Wave 3 — Medium (this session, scoped batches)
17. **ORD-03** — multi-stop validation (max 20, contiguous sequence, ≥1 pickup ≥1 dropoff).
18. **ORD-04** — reconnect event replay (last 5 min status history + last 20 messages for subscribed orders).
19. **ORD-05** — per-event-type rate-limit buckets.
20. **ORD-06** — stale-estimate refresh (>120 s → refetch before submit).
21. **ORD-07** — exclude `suspendedUntil > now()` in auto-dispatch query.
22. **CLI-04** — pass `enabled` prop to nearby-riders polling; clear on tracking page.
23. **CLI-05** — per-photo upload feedback (toast + retry).
24. **CLI-06** — directions-fetch failure surfaces visible error.
25. **CLI-07 / RID-08** — replace raw `fetch()` in forgot-pin with shared auth client.
26. **CLI-08** — `AbortController` 60 s timeout on order submission.
27. **PAY-07** — `receiptEmailSentAt` flag on `Order` (or `ReceiptJob` row).
28. **PAY-08** — `verifyInProgressRef` on client payment page.
29. **RID-04** — reconnect notice if queue dropped events.
30. **RID-05** — log + threshold-warn on consecutive location-POST failures.
31. **RID-06** — daily FCM-token re-register check.
32. **RID-07** — 60 s timeout + progress on POD upload.
33. **RID-09** — cap `subscribedOrders` at 10; unsubscribe LRU.
34. **JOB-02** — `limiter:` on receipt / commission / push workers.
35. **JOB-03** — `correlationId` propagated through job data.
36. **AUTH-04** — short-lived Redis revocation list checked at socket auth.
37. **AUTH-06** — IDOR sweep on rider-facing GETs.

### Wave 4 — Low / polish (deferred unless time permits)
- `PAY-06` (CHECK constraint), `PAY-09` (rounding doc), `AUTH-05`, `AUTH-07`, `ORD-08`, `ORD-09`, `CLI-09–11`, `RID-10–11`, `JOB-04–05`.

---

## Verification gates

After each wave:
- `pnpm -w turbo run typecheck` clean across all apps and packages.
- `pnpm --filter @riderguy/api test` green (existing service tests).
- Manual flow trace for the single end-to-end happy path: client request → search → rider accept → pickup → POD → delivered → wallet credit → review.
- Regression spot-check: prior-fix items still pass (logout disconnect, soft-delete filter, `/orders/:id` IDOR, refresh rotation, webhook signature).

---

*This document is the source of truth for the audit. Implementation diffs are tracked per-wave in commits and summarized in `/memories/repo/rider_audit_fixes_completed.md` as each wave completes.*
