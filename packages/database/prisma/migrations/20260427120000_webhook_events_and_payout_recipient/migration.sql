-- Wave 1 — Webhook idempotency + Paystack recipient persistence
-- Date: 2026-04-27
-- See: docs/audits/E2E_RIDER_CLIENT_FLOW_AUDIT_2026_04_27.md (PAY-01, PAY-02)

-- 1) Add paystack recipient code persistence to withdrawals
ALTER TABLE "withdrawals"
  ADD COLUMN IF NOT EXISTS "paystackRecipientCode" TEXT;

-- 2) Webhook events idempotency log
CREATE TYPE "WebhookEventStatus" AS ENUM ('PROCESSED', 'FAILED', 'SKIPPED');

CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PROCESSED',
    "payload" JSONB,
    "error" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_provider_eventId_key"
  ON "webhook_events"("provider", "eventId");

CREATE INDEX "webhook_events_provider_eventType_idx"
  ON "webhook_events"("provider", "eventType");

CREATE INDEX "webhook_events_processedAt_idx"
  ON "webhook_events"("processedAt");
