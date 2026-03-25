-- AlterEnum: Remove SIGNATURE, add LEFT_AT_DOOR
BEGIN;
CREATE TYPE "ProofOfDeliveryType_new" AS ENUM ('PHOTO', 'PIN_CODE', 'LEFT_AT_DOOR');
ALTER TABLE "orders" ALTER COLUMN "proofOfDeliveryType" TYPE "ProofOfDeliveryType_new" USING ("proofOfDeliveryType"::text::"ProofOfDeliveryType_new");
ALTER TABLE "order_stops" ALTER COLUMN "proofType" TYPE "ProofOfDeliveryType_new" USING ("proofType"::text::"ProofOfDeliveryType_new");
ALTER TYPE "ProofOfDeliveryType" RENAME TO "ProofOfDeliveryType_old";
ALTER TYPE "ProofOfDeliveryType_new" RENAME TO "ProofOfDeliveryType";
DROP TYPE "public"."ProofOfDeliveryType_old";
COMMIT;

-- AlterTable: Add rider payment confirmation columns
ALTER TABLE "orders" ADD COLUMN "actualPaymentMethod" "PaymentMethod",
ADD COLUMN "riderPaymentConfirmed" BOOLEAN NOT NULL DEFAULT false;
