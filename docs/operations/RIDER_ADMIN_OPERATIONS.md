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
