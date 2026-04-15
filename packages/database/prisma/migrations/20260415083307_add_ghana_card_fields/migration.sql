-- AlterTable
ALTER TABLE "users" ADD COLUMN "ghanaCardNumber" TEXT,
ADD COLUMN "securityQuestion" TEXT,
ADD COLUMN "securityAnswerHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_ghanaCardNumber_key" ON "users"("ghanaCardNumber");

-- CreateIndex
CREATE INDEX "users_ghanaCardNumber_idx" ON "users"("ghanaCardNumber");
