-- AlterTable: Add Decimal(12,2) precision to Order pricing fields
ALTER TABLE "orders" ALTER COLUMN "base_fare" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "orders" ALTER COLUMN "distance_charge" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "orders" ALTER COLUMN "service_fee" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "orders" ALTER COLUMN "total_price" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "orders" ALTER COLUMN "rider_earnings" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "orders" ALTER COLUMN "platform_commission" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "orders" ALTER COLUMN "tip_amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable: Add Decimal(12,2) precision to ScheduledDelivery
ALTER TABLE "scheduled_deliveries" ALTER COLUMN "estimated_price" SET DATA TYPE DECIMAL(12,2);

-- Add CHECK constraint: RiderProfile.currentLevel must be 1-7
ALTER TABLE "rider_profiles" ADD CONSTRAINT "chk_current_level" CHECK ("current_level" >= 1 AND "current_level" <= 7);
