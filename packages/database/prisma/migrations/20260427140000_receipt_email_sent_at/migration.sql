-- PAY-07 (Wave 3): Track receipt email send to make worker idempotent.
ALTER TABLE "orders" ADD COLUMN "receiptEmailSentAt" TIMESTAMP(3);
