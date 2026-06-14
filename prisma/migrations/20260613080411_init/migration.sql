-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'GUEST');

-- CreateEnum
CREATE TYPE "MembershipEventType" AS ENUM ('JOIN', 'LEAVE');

-- CreateEnum
CREATE TYPE "SplitType" AS ENUM ('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'REVIEW_REQUIRED', 'IMPORTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'REVIEW_REQUIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipHistory" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventType" "MembershipEventType" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "MembershipHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "paidById" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "originalAmount" DECIMAL(12,4) NOT NULL,
    "originalCurrency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1.0,
    "baseCurrencyAmount" DECIMAL(12,4) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "splitType" "SplitType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "importRecordId" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseParticipant" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shareValue" DECIMAL(12,4),
    "calculatedAmount" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "ExpenseParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1.0,
    "baseCurrencyAmount" DECIMAL(12,4) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importRecordId" TEXT,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL DEFAULT 'INR',
    "rate" DECIMAL(10,6) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportSession" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawContent" JSONB NOT NULL,
    "normalizedData" JSONB,
    "status" TEXT NOT NULL,

    CONSTRAINT "ImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportAnomaly" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "recordId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "severity" "AnomalySeverity" NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ImportAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataChangeProposal" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "recordId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "originalValue" TEXT NOT NULL,
    "proposedValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedValue" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "DataChangeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importSessionId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceSnapshot" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "balances" JSONB NOT NULL,

    CONSTRAINT "BalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_groupId_userId_key" ON "GroupMembership"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseParticipant_expenseId_userId_key" ON "ExpenseParticipant"("expenseId", "userId");

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipHistory" ADD CONSTRAINT "MembershipHistory_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipHistory" ADD CONSTRAINT "MembershipHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "ImportRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseParticipant" ADD CONSTRAINT "ExpenseParticipant_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseParticipant" ADD CONSTRAINT "ExpenseParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "ImportRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRecord" ADD CONSTRAINT "ImportRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportAnomaly" ADD CONSTRAINT "ImportAnomaly_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportAnomaly" ADD CONSTRAINT "ImportAnomaly_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ImportRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataChangeProposal" ADD CONSTRAINT "DataChangeProposal_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataChangeProposal" ADD CONSTRAINT "DataChangeProposal_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataChangeProposal" ADD CONSTRAINT "DataChangeProposal_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ImportRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
