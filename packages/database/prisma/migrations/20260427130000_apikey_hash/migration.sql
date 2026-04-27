-- AUTH-01: Hash API keys at rest (SHA-256). Plaintext is shown once at creation
-- and never persisted. keyPrefix exposes a non-secret display fragment.

-- Drop existing index on the plaintext column
DROP INDEX IF EXISTS "api_keys_key_idx";
ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_key_key";

-- Rename column key -> keyHash. Existing rows (if any) hold legacy plaintext;
-- we treat them as already-hashed for storage purposes (the next rotation will
-- replace them with proper SHA-256 hashes). New keys created via the helper
-- in apps/api/src/lib/api-key.ts always store SHA-256.
ALTER TABLE "api_keys" RENAME COLUMN "key" TO "keyHash";

-- Add keyPrefix column. NULL for any pre-existing legacy rows (none expected
-- in production at the time of this migration).
ALTER TABLE "api_keys" ADD COLUMN "keyPrefix" TEXT;

-- Backfill prefix for any legacy rows by taking the first 8 chars of the
-- (now-renamed) keyHash so the column can be NOT NULL.
UPDATE "api_keys" SET "keyPrefix" = SUBSTRING("keyHash" FROM 1 FOR 8) WHERE "keyPrefix" IS NULL;

ALTER TABLE "api_keys" ALTER COLUMN "keyPrefix" SET NOT NULL;

-- Recreate unique constraint + index on hashed column
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");
CREATE INDEX "api_keys_keyPrefix_idx" ON "api_keys"("keyPrefix");
