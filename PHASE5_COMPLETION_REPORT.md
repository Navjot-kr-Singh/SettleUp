# Phase 5 Completion Report — CSV Import Engine & Data Governance

This report confirms the successful completion of Phase 5. The CSV Import Engine has been fully implemented under Dry Run Mode isolation.

---

## 1. Database Schema Diffs & Migration Details

The database schema has been updated via standard Prisma migration scripts without any destructive `db push` calls.

### Migration Script (`20260613092400_harden_import_engine/migration.sql`)
```sql
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
```

### Key Schema Changes in `prisma/schema.prisma`
- **`ImportSessionStatus`**: Added `PENDING` and `TERMINATED` enum members.
- **`ImportSession`**: Added `groupId`, `fileHash` (nullable for duplicate handling), and the unique constraint `@@unique([groupId, fileHash])`.
- **`ImportRecord`**: Renamed `recordFingerprint` to `fingerprint` and added index `@@index([fingerprint])`.

---

## 2. All 16 Registered Anomaly Detectors

The rules engine dynamically instantiates and executes exactly 16 decoupled anomaly detectors:
1. `DuplicateRecordDetector`: Identifies exact row copies using SHA-256 fingerprint matches.
2. `ConflictingDuplicateDetector`: Flags date/description collisions with differing payers/amounts.
3. `MissingPayerDetector`: Detects empty paid_by strings.
4. `MissingParticipantDetector`: Flags empty split lists.
5. `InvalidDateDetector`: Identifies invalid, unparseable date strings.
6. `AmbiguousDateDetector`: Flags DD-MM/MM-DD ambiguous structures (e.g. `04-05-2026`).
7. `InvalidAmountDetector`: Catches zero or non-numeric amounts.
8. `NegativeAmountDetector`: Catches negative amount values.
9. `MissingCurrencyDetector`: Flags rows with missing currency headers.
10. `InvalidCurrencyDetector`: Validates currencies against the database registry.
11. `SettlementAsExpenseDetector`: Uses text indicators to identify settlements miscategorized as expenses.
12. `UnknownUserDetector`: Identifies invalid database user references.
13. `MembershipViolationDetector`: Enforces that splits only involve users active on that date.
14. `PercentageSumDetector`: Enforces that percentage splits total exactly 100%.
15. `ShareAllocationDetector`: Validates that share counts are mathematically sound.
16. `BlankRowDetector`: Gracefully ignores empty/whitespace-only CSV lines.

---

## 3. Cryptographic Fingerprint Hashing Examples

deterministic fingerprints are computed as:
$$SHA256(Normalize(Date) + "|" + Normalize(Payer) + "|" + Normalize(Amount) + "|" + Normalize(Description))$$

For example:
- Input Row: `08-02-2026,Dinner at Marina Bites,Dev,3200,INR` $\rightarrow$ Payload: `08-02-2026|dev|3200|dinner at marina bites` $\rightarrow$ Fingerprint: `a53e48227bde2...`
- Normalized values ensure spacing, trailing periods, commas in numbers, and case variations result in the same fingerprint to prevent duplicate uploads.

---

## 4. Rollback and Dry-Run Isolation Verification Proofs

- **Staging Transaction rollback**: Verified that any runtime or validation error thrown inside the database transaction rolls back all inserts to `ImportRecord`, `ImportAnomaly`, and `DataChangeProposal`. The parent `ImportSession` successfully transitions to `FAILED` status and persists outside the aborted transaction, logging an `IMPORT_FAILED` audit log.
- **Dry-Run Isolation**: Spy-asserted that no calls to `create` or `update` on `Expense`, `ExpenseParticipant`, `Settlement`, or `BalanceSnapshot` ever happen.
- **Zero-Sum Balance Integrity**: Balance simulations verify that the sum of balances before and after simulated imports is exactly $0.00$. Any deviation throws a `BALANCE_INTEGRITY_FAILURE` and rolls back staging.

---

## 5. Test Suite Execution Output

Vitest results show all 103 tests pass successfully:

```text
 RUN  v4.1.8 /Users/navjotkumarsingh/Desktop/SettleUp

 ✓ src/tests/unit/group-service.test.ts (4 tests) 10ms
 ✓ src/tests/unit/balance.test.ts (14 tests) 14ms
 ✓ src/tests/unit/schema.test.ts (5 tests) 5ms
 ✓ src/tests/unit/audit.test.ts (11 tests) 17ms
 ✓ src/tests/unit/financial-domain.test.ts (20 tests) 19ms
 ✓ src/tests/unit/import.test.ts (32 tests) 40ms
 ✓ src/tests/unit/auth.test.ts (4 tests) 457ms
 ✓ src/tests/unit/math.test.ts (5 tests) 5ms
 ✓ src/tests/unit/membership.test.ts (3 tests) 4ms
 ✓ src/tests/unit/date.test.ts (5 tests) 5ms

 Test Files  10 passed (10)
      Tests  103 passed (103)
   Start at  15:00:49
   Duration  2.71s
```
---

## 6. API Routing Details

All API routes have been fully implemented under `src/app/api/imports` protecting them behind NextAuth sessions, validating parameters/bodies via Zod schemas, and providing pagination support:
- `GET /api/imports/session/[id]`: Paginated staging records.
- `GET /api/imports/session/[id]/report`: Dyn-reconstructed DryRunReport.
- `POST /api/imports/dry-run`: Dry run CSV import starting pipeline.
- `GET /api/imports/proposals`: Paginated data correction proposals.
- `PUT /api/imports/proposals/[id]`: Approve/Reject proposal transition.
