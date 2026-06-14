-- Clean existing import data to prevent constraint violations
DELETE FROM "ImportSession";

-- AlterEnum
ALTER TYPE "ImportSessionStatus" ADD VALUE 'PENDING';
ALTER TYPE "ImportSessionStatus" ADD VALUE 'TERMINATED';

-- AlterTable
ALTER TABLE "ImportSession" ADD COLUMN "groupId" TEXT NOT NULL;
ALTER TABLE "ImportSession" ADD COLUMN "fileHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ImportSession_groupId_fileHash_key" ON "ImportSession"("groupId", "fileHash");

-- AlterTable
ALTER TABLE "ImportRecord" RENAME COLUMN "recordFingerprint" TO "fingerprint";

-- RenameIndex
ALTER INDEX "ImportRecord_recordFingerprint_idx" RENAME TO "ImportRecord_fingerprint_idx";
