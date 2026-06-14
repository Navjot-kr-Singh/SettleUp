/*
  Warnings:

  - You are about to drop the column `details` on the `AuditLog` table. All the data in the column will be lost.
  - Added the required column `correlationId` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityId` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityType` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `action` on the `AuditLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('CREATE_EXPENSE', 'UPDATE_EXPENSE', 'DELETE_EXPENSE', 'CREATE_SETTLEMENT', 'UPDATE_SETTLEMENT', 'DELETE_SETTLEMENT', 'CREATE_GROUP', 'UPDATE_GROUP', 'DELETE_GROUP', 'MEMBER_JOIN', 'MEMBER_LEAVE', 'IMPORT_START', 'IMPORT_COMPLETE', 'IMPORT_FAILED', 'ANOMALY_DETECTED', 'ANOMALY_RESOLVED', 'PROPOSAL_CREATED', 'PROPOSAL_APPROVED', 'PROPOSAL_REJECTED', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT');

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "details",
ADD COLUMN     "afterState" JSONB,
ADD COLUMN     "beforeState" JSONB,
ADD COLUMN     "changedFields" JSONB,
ADD COLUMN     "correlationId" TEXT NOT NULL,
ADD COLUMN     "entityId" TEXT NOT NULL,
ADD COLUMN     "entityType" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "proposalId" TEXT,
DROP COLUMN "action",
ADD COLUMN     "action" "AuditActionType" NOT NULL;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "DataChangeProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
