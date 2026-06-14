/*
  Warnings:

  - Changed the type of `status` on the `ImportSession` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ImportSessionStatus" AS ENUM ('UPLOADED', 'PARSING', 'ANALYZED', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'COMMITTED', 'FAILED');

-- AlterTable
ALTER TABLE "ImportRecord" ADD COLUMN     "recordFingerprint" TEXT;

-- AlterTable
ALTER TABLE "ImportSession" DROP COLUMN "status",
ADD COLUMN     "status" "ImportSessionStatus" NOT NULL;

-- DropEnum
DROP TYPE "ImportStatus";

-- CreateIndex
CREATE INDEX "ImportRecord_recordFingerprint_idx" ON "ImportRecord"("recordFingerprint");
