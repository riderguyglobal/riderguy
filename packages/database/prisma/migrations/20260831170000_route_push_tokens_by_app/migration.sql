-- Push registration tokens are scoped to a Firebase project and can only have
-- one current account owner. Existing rows predate project routing, so they are
-- deliberately deactivated and will be refreshed by the next authenticated app
-- launch. This avoids guessing the originating app for multi-role accounts.
CREATE TYPE "PushAppProject" AS ENUM ('RIDER', 'CLIENT');

ALTER TABLE "push_tokens"
ADD COLUMN "appProject" "PushAppProject";

UPDATE "push_tokens"
SET "isActive" = false;

-- A token may currently exist once per user because the old constraint was
-- (userId, token). Keep only the most recently refreshed record before adding
-- the global unique constraint. All retained legacy records remain inactive.
WITH ranked_tokens AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "token"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS duplicate_rank
  FROM "push_tokens"
)
DELETE FROM "push_tokens" AS token_row
USING ranked_tokens
WHERE token_row."id" = ranked_tokens."id"
  AND ranked_tokens.duplicate_rank > 1;

DROP INDEX "push_tokens_userId_token_key";
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");
CREATE INDEX "push_tokens_appProject_isActive_idx" ON "push_tokens"("appProject", "isActive");
CREATE INDEX "push_tokens_deviceId_idx" ON "push_tokens"("deviceId");
