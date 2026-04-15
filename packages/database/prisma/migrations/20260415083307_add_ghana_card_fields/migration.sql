-- AlterTable
ALTER TABLE "User" ADD COLUMN "ghanaCardNumber" TEXT,
ADD COLUMN "securityQuestion" TEXT,
ADD COLUMN "securityAnswerHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_ghanaCardNumber_key" ON "User"("ghanaCardNumber");

-- CreateIndex
CREATE INDEX "User_ghanaCardNumber_idx" ON "User"("ghanaCardNumber");
