/*
  Warnings:

  - You are about to drop the column `timestamp` on the `BalanceSnapshot` table. All the data in the column will be lost.
  - Added the required column `version` to the `BalanceSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BalanceSnapshot" DROP COLUMN "timestamp",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "version" INTEGER NOT NULL;
