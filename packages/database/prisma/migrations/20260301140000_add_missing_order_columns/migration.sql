-- ============================================================
-- Migration: Add missing columns & tables for order creation
-- Fixes P2022 error: columns isMultiStop, stopsJson,
-- scheduledDeliveryId do not exist on orders table.
-- Also adds OrderStop table, ScheduledDelivery table,
-- and required enums.
-- ============================================================

-- CreateEnum: StopType
DO $$ BEGIN CREATE TYPE "StopType" AS ENUM ('PICKUP', 'DROPOFF'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum: StopStatus
DO $$ BEGIN CREATE TYPE "StopStatus" AS ENUM ('PENDING', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'SKIPPED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum: ScheduleFrequency
DO $$ BEGIN CREATE TYPE "ScheduleFrequency" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum: ScheduledDeliveryStatus
DO $$ BEGIN CREATE TYPE "ScheduledDeliveryStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable: scheduled_deliveries (must exist before orders FK)
CREATE TABLE IF NOT EXISTS "scheduled_deliveries" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "zoneId" TEXT,
    "title" TEXT,
    "frequency" "ScheduleFrequency" NOT NULL DEFAULT 'ONCE',
    "scheduledDate" TIMESTAMP(3),
    "scheduledTime" TEXT,
    "daysOfWeek" INTEGER[],
    "dayOfMonth" INTEGER,
    "customCronExpression" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "maxOccurrences" INTEGER,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "pickupAddress" TEXT NOT NULL,
    "pickupLatitude" DOUBLE PRECISION NOT NULL,
    "pickupLongitude" DOUBLE PRECISION NOT NULL,
    "pickupContactName" TEXT,
    "pickupContactPhone" TEXT,
    "pickupInstructions" TEXT,
    "dropoffAddress" TEXT NOT NULL,
    "dropoffLatitude" DOUBLE PRECISION NOT NULL,
    "dropoffLongitude" DOUBLE PRECISION NOT NULL,
    "dropoffContactName" TEXT,
    "dropoffContactPhone" TEXT,
    "dropoffInstructions" TEXT,
    "isMultiStop" BOOLEAN NOT NULL DEFAULT false,
    "stopsTemplate" JSONB,
    "packageType" "PackageType",
    "packageDescription" TEXT,
    "estimatedPrice" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "paymentMethod" "PaymentMethod",
    "status" "ScheduledDeliveryStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastGeneratedAt" TIMESTAMP(3),
    "nextScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_deliveries_pkey" PRIMARY KEY ("id")
);

-- AddColumn: orders.isMultiStop
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isMultiStop" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn: orders.stopsJson
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stopsJson" JSONB;

-- AddColumn: orders.scheduledDeliveryId
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "scheduledDeliveryId" TEXT;

-- CreateTable: order_stops
CREATE TABLE IF NOT EXISTS "order_stops" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "StopType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "StopStatus" NOT NULL DEFAULT 'PENDING',
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "placeId" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "instructions" TEXT,
    "proofType" "ProofOfDeliveryType",
    "proofUrl" TEXT,
    "pinCode" TEXT,
    "packageType" "PackageType",
    "packageDescription" TEXT,
    "packagePhotoUrl" TEXT,
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_stops_pkey" PRIMARY KEY ("id")
);

-- AddColumn: rider_profiles.rewardPoints (IF NOT EXISTS — may exist from prior fix)
ALTER TABLE "rider_profiles" ADD COLUMN IF NOT EXISTS "rewardPoints" INTEGER NOT NULL DEFAULT 0;

-- AddColumn: rider_profiles.bio
ALTER TABLE "rider_profiles" ADD COLUMN IF NOT EXISTS "bio" TEXT;

-- AddColumn: rider_profiles.publicProfileUrl
ALTER TABLE "rider_profiles" ADD COLUMN IF NOT EXISTS "publicProfileUrl" TEXT;

-- CreateIndex: order_stops.orderId
CREATE INDEX IF NOT EXISTS "order_stops_orderId_idx" ON "order_stops"("orderId");

-- CreateIndex: order_stops.orderId + sequence
CREATE INDEX IF NOT EXISTS "order_stops_orderId_sequence_idx" ON "order_stops"("orderId", "sequence");

-- CreateIndex: scheduled_deliveries.clientId
CREATE INDEX IF NOT EXISTS "scheduled_deliveries_clientId_idx" ON "scheduled_deliveries"("clientId");

-- CreateIndex: scheduled_deliveries.status
CREATE INDEX IF NOT EXISTS "scheduled_deliveries_status_idx" ON "scheduled_deliveries"("status");

-- CreateIndex: scheduled_deliveries.nextScheduledAt
CREATE INDEX IF NOT EXISTS "scheduled_deliveries_nextScheduledAt_idx" ON "scheduled_deliveries"("nextScheduledAt");

-- CreateIndex: orders.paymentStatus
CREATE INDEX IF NOT EXISTS "orders_paymentStatus_idx" ON "orders"("paymentStatus");

-- CreateIndex: orders.scheduledDeliveryId
CREATE INDEX IF NOT EXISTS "orders_scheduledDeliveryId_idx" ON "orders"("scheduledDeliveryId");

-- CreateIndex: rider_profiles.publicProfileUrl (unique)
CREATE UNIQUE INDEX IF NOT EXISTS "rider_profiles_publicProfileUrl_key" ON "rider_profiles"("publicProfileUrl");

-- AddForeignKey: order_stops → orders
DO $$ BEGIN ALTER TABLE "order_stops" ADD CONSTRAINT "order_stops_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: orders → scheduled_deliveries
DO $$ BEGIN ALTER TABLE "orders" ADD CONSTRAINT "orders_scheduledDeliveryId_fkey" FOREIGN KEY ("scheduledDeliveryId") REFERENCES "scheduled_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: scheduled_deliveries → users
DO $$ BEGIN ALTER TABLE "scheduled_deliveries" ADD CONSTRAINT "scheduled_deliveries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
