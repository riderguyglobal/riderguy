-- Repair only the dedicated Google Play Rider reviewer fixture. A prior repair
-- activated this account and supplied its approved vehicle, but the hardened
-- compliance recalculation correctly revoked `isVerified` because the latest
-- National ID, driver's licence, and selfie records were still pending.
--
-- Preserve every pre-existing document and its review history. The three
-- deterministic, synthetic fixture rows below are placed strictly after the
-- newest evidence of the same type, making the latest-document rule explicit.

BEGIN;

-- Absence is expected outside reviewer-enabled environments. If the reserved
-- email is present, however, require exactly one full identity/profile match
-- before writing anything. This prevents a partially matching real account
-- from ever being repaired as the reviewer fixture.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users" AS account
    WHERE LOWER(account."email") = 'rider@test.com'
  ) AND (
    SELECT COUNT(*)
    FROM "users" AS account
    JOIN "rider_profiles" AS rider ON rider."userId" = account."id"
    WHERE LOWER(account."email") = 'rider@test.com'
      AND account."phone" = '+233200000001'
      AND account."firstName" = 'Play'
      AND account."lastName" = 'Reviewer Rider'
      AND account."role" = 'RIDER'
      AND account."roles" @> ARRAY['RIDER'::"UserRole"]
  ) <> 1 THEN
    RAISE EXCEPTION 'Reserved Play reviewer email exists without exactly one strict Rider fixture match';
  END IF;
END $$;

WITH "reviewer" AS (
  SELECT account."id" AS "userId"
  FROM "users" AS account
  JOIN "rider_profiles" AS rider ON rider."userId" = account."id"
  WHERE LOWER(account."email") = 'rider@test.com'
    AND account."phone" = '+233200000001'
    AND account."firstName" = 'Play'
    AND account."lastName" = 'Reviewer Rider'
    AND account."role" = 'RIDER'
    AND account."roles" @> ARRAY['RIDER'::"UserRole"]
),
"requiredEvidence" ("id", "type", "fileName") AS (
  VALUES
    (
      'play-reviewer-rider-document-national-id-v1',
      'NATIONAL_ID'::"DocumentType",
      'play-reviewer-synthetic-national-id.png'
    ),
    (
      'play-reviewer-rider-document-drivers-license-v1',
      'DRIVERS_LICENSE'::"DocumentType",
      'play-reviewer-synthetic-drivers-license.png'
    ),
    (
      'play-reviewer-rider-document-selfie-v1',
      'SELFIE'::"DocumentType",
      'play-reviewer-synthetic-selfie.png'
    )
),
"fixtureRows" AS (
  SELECT
    evidence."id",
    reviewer."userId",
    evidence."type",
    evidence."fileName",
    GREATEST(
      CURRENT_TIMESTAMP,
      COALESCE(
        (
          SELECT MAX(document."createdAt") + INTERVAL '1 millisecond'
          FROM "documents" AS document
          WHERE document."userId" = reviewer."userId"
            AND document."type" = evidence."type"
        ),
        CURRENT_TIMESTAMP
      )
    ) AS "evidenceCreatedAt"
  FROM "reviewer" AS reviewer
  CROSS JOIN "requiredEvidence" AS evidence
)
INSERT INTO "documents" (
  "id",
  "userId",
  "type",
  "fileUrl",
  "fileName",
  "fileSizeBytes",
  "mimeType",
  "status",
  "rejectionReason",
  "reviewedBy",
  "reviewedAt",
  "expiresAt",
  "createdAt",
  "updatedAt"
)
SELECT
  fixture."id",
  fixture."userId",
  fixture."type",
  'https://myriderguy.com/images/new/Display%20of%20Fleet.png',
  fixture."fileName",
  2510676,
  'image/png',
  'APPROVED',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  NULL,
  fixture."evidenceCreatedAt",
  CURRENT_TIMESTAMP
FROM "fixtureRows" AS fixture
ON CONFLICT ("id") DO UPDATE SET
  "fileUrl" = EXCLUDED."fileUrl",
  "fileName" = EXCLUDED."fileName",
  "fileSizeBytes" = EXCLUDED."fileSizeBytes",
  "mimeType" = EXCLUDED."mimeType",
  "status" = 'APPROVED',
  "rejectionReason" = NULL,
  "reviewedBy" = NULL,
  "reviewedAt" = CURRENT_TIMESTAMP,
  "expiresAt" = NULL,
  "createdAt" = EXCLUDED."createdAt",
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "documents"."userId" = EXCLUDED."userId"
  AND "documents"."type" = EXCLUDED."type";

UPDATE "rider_profiles" AS rider
SET
  "isVerified" = TRUE,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "users" AS account
WHERE rider."userId" = account."id"
  AND LOWER(account."email") = 'rider@test.com'
  AND account."phone" = '+233200000001'
  AND account."firstName" = 'Play'
  AND account."lastName" = 'Reviewer Rider'
  AND account."role" = 'RIDER'
  AND account."roles" @> ARRAY['RIDER'::"UserRole"]
  AND rider."onboardingStatus" = 'ACTIVATED';

-- Fail closed after every write. A present reviewer email must finish as the
-- one strict, activated and verified Rider fixture, with each deterministic
-- synthetic row being the latest approved evidence for its document type.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users" AS account
    WHERE LOWER(account."email") = 'rider@test.com'
  ) AND NOT EXISTS (
    SELECT 1
    FROM "users" AS account
    JOIN "rider_profiles" AS rider ON rider."userId" = account."id"
    WHERE LOWER(account."email") = 'rider@test.com'
      AND account."phone" = '+233200000001'
      AND account."firstName" = 'Play'
      AND account."lastName" = 'Reviewer Rider'
      AND account."role" = 'RIDER'
      AND account."roles" @> ARRAY['RIDER'::"UserRole"]
      AND rider."onboardingStatus" = 'ACTIVATED'
      AND rider."isVerified" IS TRUE
  ) THEN
    RAISE EXCEPTION 'Play reviewer repair did not finish with an activated, verified strict fixture';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "users" AS account
    JOIN "rider_profiles" AS rider ON rider."userId" = account."id"
    CROSS JOIN (
      VALUES
        ('play-reviewer-rider-document-national-id-v1', 'NATIONAL_ID'::"DocumentType"),
        ('play-reviewer-rider-document-drivers-license-v1', 'DRIVERS_LICENSE'::"DocumentType"),
        ('play-reviewer-rider-document-selfie-v1', 'SELFIE'::"DocumentType")
    ) AS required("id", "type")
    WHERE LOWER(account."email") = 'rider@test.com'
      AND account."phone" = '+233200000001'
      AND account."firstName" = 'Play'
      AND account."lastName" = 'Reviewer Rider'
      AND account."role" = 'RIDER'
      AND account."roles" @> ARRAY['RIDER'::"UserRole"]
      AND COALESCE(
        (
          SELECT (
            document."id" = required."id"
            AND document."status" = 'APPROVED'
          )
          FROM "documents" AS document
          WHERE document."userId" = account."id"
            AND document."type" = required."type"
          ORDER BY document."createdAt" DESC, document."id" DESC
          LIMIT 1
        ),
        FALSE
      ) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Play reviewer required-document repair did not satisfy the latest-evidence invariant';
  END IF;
END $$;

COMMIT;

-- Rollback posture: this migration never mutates or deletes pre-existing
-- evidence. To disable the fixture, set `isVerified` false for this exact
-- reviewer identity and remove only the three deterministic IDs above. Do not
-- mass-revert document statuses; none were changed by this migration.
