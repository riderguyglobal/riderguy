-- AlterTable: Add roles array column to users table for multi-role support
ALTER TABLE "users" ADD COLUMN "roles" "UserRole"[] DEFAULT ARRAY[]::"UserRole"[];

-- Create index on status for faster auth lookups
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");

-- Backfill: populate roles[] from legacy single role column for existing users
UPDATE "users" SET "roles" = ARRAY["role"]::"UserRole"[] WHERE "roles" = '{}' OR "roles" IS NULL;
