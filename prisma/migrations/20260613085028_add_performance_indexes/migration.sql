-- CreateIndex
CREATE INDEX "BalanceSnapshot_groupId_idx" ON "BalanceSnapshot"("groupId");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_groupId_isCurrent_idx" ON "BalanceSnapshot"("groupId", "isCurrent");

-- CreateIndex
CREATE INDEX "DataChangeProposal_recordId_idx" ON "DataChangeProposal"("recordId");

-- CreateIndex
CREATE INDEX "Expense_groupId_idx" ON "Expense"("groupId");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "ExpenseParticipant_userId_idx" ON "ExpenseParticipant"("userId");

-- CreateIndex
CREATE INDEX "GroupMembership_userId_idx" ON "GroupMembership"("userId");

-- CreateIndex
CREATE INDEX "GroupMembership_groupId_idx" ON "GroupMembership"("groupId");

-- CreateIndex
CREATE INDEX "ImportAnomaly_recordId_idx" ON "ImportAnomaly"("recordId");

-- CreateIndex
CREATE INDEX "ImportRecord_sessionId_idx" ON "ImportRecord"("sessionId");

-- CreateIndex
CREATE INDEX "MembershipHistory_userId_idx" ON "MembershipHistory"("userId");

-- CreateIndex
CREATE INDEX "Settlement_groupId_idx" ON "Settlement"("groupId");

-- CreateIndex
CREATE INDEX "Settlement_date_idx" ON "Settlement"("date");
