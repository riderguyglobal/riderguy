-- Preserve known legacy approvals without guessing whether legacy false values
-- represented pending or rejected decisions.
CREATE TYPE "VehicleReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "vehicles"
  ADD COLUMN "reviewStatus" "VehicleReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

UPDATE "vehicles"
SET "reviewStatus" = 'APPROVED'::"VehicleReviewStatus"
WHERE "isApproved" = true;

-- Canonicalize historical plates with the same trim/upper/separator rule used
-- by the API. Existing duplicates are intentionally preserved; serialised
-- runtime checks will now see every legacy spelling of a canonical plate.
UPDATE "vehicles"
SET "plateNumber" = upper(regexp_replace(btrim("plateNumber"), '[[:space:]-]+', '-', 'g'));

ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_review_status_consistency"
  CHECK ("isApproved" = ("reviewStatus" = 'APPROVED'::"VehicleReviewStatus"));

ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_rejection_reason_check"
  CHECK (
    ("reviewStatus" = 'REJECTED'::"VehicleReviewStatus"
      AND "rejectionReason" IS NOT NULL
      AND char_length(btrim("rejectionReason")) BETWEEN 5 AND 500)
    OR
    ("reviewStatus" <> 'REJECTED'::"VehicleReviewStatus" AND "rejectionReason" IS NULL)
  );

ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Deliberately non-unique: a unique migration could fail when historical
-- duplicates exist. Runtime plate writes use a transaction advisory lock.
CREATE INDEX "vehicles_plateNumber_idx" ON "vehicles"("plateNumber");
CREATE INDEX "vehicles_reviewStatus_idx" ON "vehicles"("reviewStatus");
CREATE INDEX "vehicles_reviewedById_idx" ON "vehicles"("reviewedById");
