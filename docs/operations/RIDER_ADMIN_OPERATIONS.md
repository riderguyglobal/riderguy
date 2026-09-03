# Rider Operations Runbook

## Purpose

The Rider Operations workspace is the administrative control plane for Rider
onboarding and continuing access. It is available to `ADMIN` and `SUPER_ADMIN`
accounts at `/dashboard/riders`; the API independently enforces the same roles.

## Work queues

- **Open cases**: every Rider who has not been activated.
- **Needs admin action**: a channel decision, pending document, reviewable
  vehicle, or completed training module is waiting for an administrator.
- **Ready to activate**: all server-enforced activation requirements pass.
- **Waiting on Rider**: the case is incomplete but there is no evidence ready
  for an administrator to review.
- **Rejected**: a prior application decision was rejected with a reason.
- **Activated**: Rider work access has been granted.

Cases older than 48 hours are shown as stale so the operations team can prevent
applications from being abandoned in the queue.

## Activation controls

A Guest Rider can be activated only when all of the following are true:

1. The Rider channel is authorized.
2. National ID, driver's licence, and selfie are approved.
3. At least one vehicle is approved.
4. That approved vehicle has front, back, left, and right evidence photos.

An In-House Rider must satisfy the same controls and have all three RiderGuy
training modules completed and administrator-verified. The API checks these
requirements again inside the activation transaction; the button state in the
Admin interface is not treated as authority.

## In-House invitations

An administrator targets an invitation to one email address or Ghanaian phone
number. The API generates a cryptographically random one-time code, stores only
its SHA-256 hash, and attempts delivery by email or SMS. The plaintext code is
shown to the issuing administrator once as a manual-delivery fallback.

Codes expire after the selected validity period (seven days in the Admin UI),
can only be used by the targeted account identity, and can only be consumed
once. An active unused invitation can be revoked with a mandatory reason.
Consumed, expired, and revoked codes cannot be used.

## Evidence decisions

- Open each protected document or vehicle image before deciding.
- A rejection or revocation requires a meaningful correction reason.
- Updated vehicle details or photos reset vehicle approval automatically.
- Re-uploaded identity evidence is reviewed as a new decision.
- Training verification can be revoked if it was entered incorrectly.
- An activated Rider cannot be moved back through application rejection;
  suspend or deactivate the account through the account-access control.

## Account access

Account restrictions immediately revoke refresh sessions, remove push tokens,
and disconnect live sockets. Administrators cannot restrict their own account,
and the last active super administrator cannot be restricted. Suspension,
deactivation, and banning require an operational reason.

## Audit trail

Privileged decisions are written to `audit_logs` with the actor, entity, old
state, new state, timestamp, IP address, and user agent. For critical Rider
decisions, the state change and audit entry share one database transaction.
The Rider case page resolves reviewer identities and displays the latest 50
events. Plaintext invitation codes and authentication secrets are never logged.

## Asset financing

Eligible In-House Rider interest appears in the Asset Financing queue. Status
changes are concurrency-protected, require the administrator to act on the
latest record version, record the reviewer, and create an audit event. Declines
require review notes.

Review notes are visible to the Rider in the Asset Financing screen, but the
administrator's identity is not exposed. A declined or withdrawn Rider can
submit a fresh request after correcting the issue.

## Rider Experience control centre

`/dashboard/rider-experience` is the control plane for Rider-facing programmes
outside onboarding and dispatch:

- **Broadcasts** publishes targeted announcements directly to the Rider home
  screen. Drafts can be published later, and live messages can be unpublished.
- **Community** creates events, resolves reported content, and activates,
  completes, or cancels mentorship pairings with a required decision note.
- **Welfare** closes flagged cancellation investigations and decides Rider
  appeals, including an eligible penalty refund or suspension lift.

Mentorship, cancellation, reward, payout, training, evidence, and financing
decisions use guarded state transitions. If another administrator acts first,
the later request is rejected and must refresh rather than overwriting the
newer decision.

## Rider-to-admin correlation

| Rider experience                 | Administrator control | Rider feedback                                        |
| -------------------------------- | --------------------- | ----------------------------------------------------- |
| Onboarding evidence and channel  | Rider Operations      | Live readiness and correction reasons                 |
| Training and certification       | Rider Operations      | Verified module state                                 |
| Asset lease interest             | Asset Financing       | Live status and review notes                          |
| Wallet cash-out                  | Financials            | Pending, processing, paid, failed, or rejected status |
| Community reports and mentorship | Rider Experience      | Moderation and pairing notifications                  |
| Cancellation appeal              | Rider Experience      | Decision notification and applied remedy              |
| Home announcements and events    | Rider Experience      | Published Rider feed content                          |

## Payout decisions

Rejecting a pending withdrawal atomically changes the request state, restores
the Rider wallet balance, writes the refund ledger entry, and records the
administrator audit event. Failed or reversed provider transfers use the same
idempotent refund path, so retries cannot credit the Rider twice. Riders can see
the resulting payout state and failure or rejection reason in Earnings.

Provider submission uses a stable withdrawal reference reserved before the
external transfer call. An ambiguous timeout remains `PROCESSING` for
reconciliation instead of submitting a duplicate or prematurely refunding the
wallet. Provider amount mismatches are held for manual review.

## Community, safety, and Rider feedback

- Riders can report forum posts, comments, and chat messages directly into the
  Rider Experience moderation queue.
- Safety incidents submitted in the Rider Safety Center enter the administrator
  Support Inbox; Ghana emergency calling remains a separate explicit action.
- Mentors and mentees can accept, cancel, complete, and record check-ins from
  the Rider app. Administrator and participant decisions use the same guarded
  lifecycle and notify the other participant.
- Training, channel classification, asset-financing, cancellation, payout, and
  mentorship outcomes include a Rider-facing notification and deep link where
  an actionable screen exists.

## Delivery and work-access integrity

Delivery completion commits the order history, Rider earnings, wallet ledger,
Rider and client statistics, cash-payment state, and Rider availability as one
serialized database decision. A retry cannot pay or count the delivery twice.
Wait-time and pickup adjustments are RiderGuy-funded additions to Rider
earnings; they do not mutate a client's already-captured electronic payment.

Only activated, verified, active, fully compliant Riders are included in job
offer broadcasts. Broadcast recipients are cursor-paginated and processed in
batches so an arbitrary first-page limit cannot hide work from later Riders.
Suspending, banning, deactivating, or invalidating required evidence prevents
new work and safely releases or escalates any affected active delivery.
