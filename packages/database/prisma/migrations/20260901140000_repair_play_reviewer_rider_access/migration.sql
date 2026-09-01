-- Repair only the dedicated Google Play Rider reviewer account. The secure
-- channel and approved-vehicle gates remain unchanged for every real Rider.

UPDATE "rider_profiles" AS rider
SET
  "riderChannel" = 'GUEST',
  "requestedRiderChannel" = 'GUEST',
  "channelVerifiedAt" = COALESCE(rider."channelVerifiedAt", CURRENT_TIMESTAMP),
  "channelInvitationId" = NULL,
  "onboardingStatus" = 'ACTIVATED',
  "isVerified" = TRUE,
  "activatedAt" = COALESCE(rider."activatedAt", CURRENT_TIMESTAMP),
  "availability" = 'OFFLINE',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "users" AS account
WHERE rider."userId" = account."id"
  AND LOWER(account."email") = 'rider@test.com'
  AND account."role" = 'RIDER';

UPDATE "vehicles" AS vehicle
SET "isPrimary" = FALSE,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "rider_profiles" AS rider
JOIN "users" AS account ON account."id" = rider."userId"
WHERE vehicle."riderId" = rider."id"
  AND LOWER(account."email") = 'rider@test.com'
  AND vehicle."id" <> 'play-reviewer-rider-vehicle-v1';

INSERT INTO "vehicles" (
  "id",
  "riderId",
  "type",
  "make",
  "model",
  "year",
  "color",
  "plateNumber",
  "isPrimary",
  "photoFrontUrl",
  "photoBackUrl",
  "photoLeftUrl",
  "photoRightUrl",
  "isApproved",
  "reviewStatus",
  "reviewedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'play-reviewer-rider-vehicle-v1',
  rider."id",
  'MOTORCYCLE',
  'RiderGuy',
  'Reviewer Bike',
  2026,
  'Green',
  'RG-PLAY-TEST',
  TRUE,
  'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
  'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
  'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
  'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
  TRUE,
  'APPROVED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "rider_profiles" AS rider
JOIN "users" AS account ON account."id" = rider."userId"
WHERE LOWER(account."email") = 'rider@test.com'
  AND account."role" = 'RIDER'
ON CONFLICT ("id") DO UPDATE SET
  "riderId" = EXCLUDED."riderId",
  "type" = EXCLUDED."type",
  "make" = EXCLUDED."make",
  "model" = EXCLUDED."model",
  "year" = EXCLUDED."year",
  "color" = EXCLUDED."color",
  "plateNumber" = EXCLUDED."plateNumber",
  "isPrimary" = TRUE,
  "photoFrontUrl" = EXCLUDED."photoFrontUrl",
  "photoBackUrl" = EXCLUDED."photoBackUrl",
  "photoLeftUrl" = EXCLUDED."photoLeftUrl",
  "photoRightUrl" = EXCLUDED."photoRightUrl",
  "isApproved" = TRUE,
  "reviewStatus" = 'APPROVED',
  "rejectionReason" = NULL,
  "reviewedAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP;
