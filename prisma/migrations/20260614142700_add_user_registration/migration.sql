/*
  Warnings:

  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_name_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordHash" TEXT;
