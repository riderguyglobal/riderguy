-- Secure Rider onboarding and make referral/training progress durable.

ALTER TYPE "RiderOnboardingStatus" ADD VALUE 'APPLICATION_REJECTED';

-- A channel is an explicit, verified onboarding choice. It must never be
-- inferred by a database default (including for Google-created accounts).
ALTER TABLE "rider_profiles"
  ALTER COLUMN "riderChannel" DROP DEFAULT,
  ALTER COLUMN "riderChannel" DROP NOT NULL;

ALTER TABLE "rider_profiles"
  ADD COLUMN "requestedRiderChannel" "RiderChannel",
  ADD COLUMN "channelVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "channelInvitationId" TEXT,
  ADD COLUMN "applicationRejectionReason" TEXT,
  ADD COLUMN "applicationReviewedAt" TIMESTAMP(3),
  ADD COLUMN "applicationReviewedById" TEXT,
  ADD COLUMN "referralCode" TEXT,
  ADD COLUMN "referredByRiderId" TEXT;

-- Backfill every existing rider with a stable, non-guessable-enough public
-- referral identifier before making it required. MD5 is used only as a
-- deterministic identifier generator here, never for credentials.
UPDATE "rider_profiles"
SET "referralCode" = 'RGR-' || UPPER(SUBSTRING(MD5("id" || "createdAt"::text) FROM 1 FOR 10));

-- The preceding legacy migration originally stamped every existing row as
-- GUEST. NULL is the honest legacy/admin-review state: existing ACTIVATED
-- riders retain work access, but no training/channel history is fabricated.
UPDATE "rider_profiles"
SET "riderChannel" = NULL,
    "requestedRiderChannel" = NULL,
    "channelVerifiedAt" = NULL;

-- ACTIVATED is a pre-existing administrative approval decision. Reconcile the
-- legacy verification bit so the hardened work gate does not strand approved
-- riders; inactive/suspended User accounts remain blocked independently.
UPDATE "rider_profiles"
SET "isVerified" = TRUE
WHERE "onboardingStatus" = 'ACTIVATED';

ALTER TABLE "rider_profiles"
  ALTER COLUMN "referralCode" SET NOT NULL;

CREATE UNIQUE INDEX "rider_profiles_channelInvitationId_key" ON "rider_profiles"("channelInvitationId");
CREATE UNIQUE INDEX "rider_profiles_referralCode_key" ON "rider_profiles"("referralCode");
CREATE INDEX "rider_profiles_riderChannel_idx" ON "rider_profiles"("riderChannel");
CREATE INDEX "rider_profiles_requestedRiderChannel_idx" ON "rider_profiles"("requestedRiderChannel");
CREATE INDEX "rider_profiles_referredByRiderId_idx" ON "rider_profiles"("referredByRiderId");

CREATE TABLE "rider_invitations" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "targetEmail" TEXT,
  "targetPhone" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rider_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rider_invitations_codeHash_key" ON "rider_invitations"("codeHash");
CREATE INDEX "rider_invitations_expiresAt_idx" ON "rider_invitations"("expiresAt");
CREATE INDEX "rider_invitations_targetEmail_idx" ON "rider_invitations"("targetEmail");
CREATE INDEX "rider_invitations_targetPhone_idx" ON "rider_invitations"("targetPhone");

CREATE TABLE "rider_training_completions" (
  "id" TEXT NOT NULL,
  "riderId" TEXT NOT NULL,
  "moduleKey" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  "verifiedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rider_training_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rider_training_completions_riderId_moduleKey_key"
  ON "rider_training_completions"("riderId", "moduleKey");
CREATE INDEX "rider_training_completions_verifiedAt_idx"
  ON "rider_training_completions"("verifiedAt");

ALTER TABLE "rider_profiles"
  ADD CONSTRAINT "rider_profiles_channelInvitationId_fkey"
  FOREIGN KEY ("channelInvitationId") REFERENCES "rider_invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "rider_profiles_applicationReviewedById_fkey"
  FOREIGN KEY ("applicationReviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "rider_profiles_referredByRiderId_fkey"
  FOREIGN KEY ("referredByRiderId") REFERENCES "rider_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rider_invitations"
  ADD CONSTRAINT "rider_invitations_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rider_training_completions"
  ADD CONSTRAINT "rider_training_completions_riderId_fkey"
  FOREIGN KEY ("riderId") REFERENCES "rider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
