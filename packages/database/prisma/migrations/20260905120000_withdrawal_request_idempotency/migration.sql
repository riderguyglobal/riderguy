-- Existing withdrawals predate client-generated idempotency keys, so the
-- column remains nullable for a zero-downtime additive rollout. PostgreSQL
-- unique indexes permit multiple NULL values while enforcing every supplied
-- request ID globally.
ALTER TABLE "withdrawals"
  ADD COLUMN "requestId" TEXT;

CREATE UNIQUE INDEX "withdrawals_requestId_key"
  ON "withdrawals"("requestId");
