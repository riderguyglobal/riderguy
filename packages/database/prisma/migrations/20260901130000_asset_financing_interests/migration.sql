CREATE TYPE "AssetFinancingAssetType" AS ENUM ('MOTORBIKE', 'ELECTRIC_VEHICLE');
CREATE TYPE "AssetFinancingInterestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'WITHDRAWN');

CREATE TABLE "asset_financing_interests" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "assetType" "AssetFinancingAssetType" NOT NULL,
    "status" "AssetFinancingInterestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "contactEmail" TEXT NOT NULL,
    "notes" TEXT,
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_financing_interests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_financing_interests_riderId_key"
  ON "asset_financing_interests"("riderId");
CREATE INDEX "asset_financing_interests_status_submittedAt_idx"
  ON "asset_financing_interests"("status", "submittedAt");
CREATE INDEX "asset_financing_interests_reviewedById_idx"
  ON "asset_financing_interests"("reviewedById");

ALTER TABLE "asset_financing_interests"
  ADD CONSTRAINT "asset_financing_interests_riderId_fkey"
  FOREIGN KEY ("riderId") REFERENCES "rider_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_financing_interests"
  ADD CONSTRAINT "asset_financing_interests_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
