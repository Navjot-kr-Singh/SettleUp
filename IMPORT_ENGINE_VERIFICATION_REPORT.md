# CSV Import Engine Verification Report

This report documents verification proofs for dry-run isolation, rollback safety, balance integrity conservation, state machine transitions, and test suite execution.

---

## 1. Dry-Run Isolation Proof

During dry-run execution, the import engine MUST NOT write to production tables: `Expense`, `ExpenseParticipant`, `Settlement`, or `BalanceSnapshot`.

### Verified Isolation Mechanisms
1. **Transaction Scope**: The database staging transaction ONLY inserts into `ImportSession`, `ImportRecord`, `ImportAnomaly`, and `DataChangeProposal`.
2. **Read-Only Ledger Queries**: Balance simulations query historical snapshots and calculate impacts entirely in-memory using `Decimal.js` variables:
   ```typescript
   // Balance simulation block inside ImportDryRunService:
   const simulatedBalances: Record<string, Decimal> = {};
   currentBalances.forEach((b) => {
     simulatedBalances[b.userId] = new Decimal(b.netBalance);
   });
   
   // ... apply simulated offsets ...
   // No DB writes are performed to Expense or Settlement models!
   ```
3. **Mocks and Spies**: Tests in `import.test.ts` verify isolation by spying on core prisma methods and asserting they are never called:
   ```typescript
   expect(mockPrisma.expense.create).not.toHaveBeenCalled();
   expect(mockPrisma.expense.update).not.toHaveBeenCalled();
   expect(mockPrisma.expenseParticipant.create).not.toHaveBeenCalled();
   expect(mockPrisma.settlement.create).not.toHaveBeenCalled();
   expect(mockPrisma.settlement.update).not.toHaveBeenCalled();
   expect(mockPrisma.balanceSnapshot.create).not.toHaveBeenCalled();
   expect(mockPrisma.balanceSnapshot.update).not.toHaveBeenCalled();
   ```

---

## 2. Failure Survivability & Rollback Safety Proof

If an error or validation failure occurs inside the transaction (e.g. database disconnect, header error, zero-sum breach), the staging tables must roll back cleanly, but the parent `ImportSession` must survive outside the transaction and record `FAILED` status along with a `IMPORT_FAILED` audit log.

### Architecture Flow
1. **Outside Transaction**: Session created in `PENDING` state and `IMPORT_START` logged.
2. **Inside Transaction**: The engine parses, validates, and stages.
3. **If Error Thrown**: Transaction triggers Prisma ROLLBACK (dropping `ImportRecord`, `ImportAnomaly`, `DataChangeProposal` changes).
4. **Catch Block**: Updates parent session to `FAILED` and logs `IMPORT_FAILED`.

### Rollback Assertion Code
```typescript
it('shouldSurviveTransactionFailureAndRecordFailedStatus', async () => {
  await expect(
    dryRunService.importDryRun('g-1', 'test.csv', csvContent)
  ).rejects.toThrow('Forced transaction rollback error');

  expect(mockPrisma.importSession.create).toHaveBeenCalled();
  expect(mockPrisma.importSession.update).toHaveBeenCalledWith({
    where: { id: 'sess-failed-1' },
    data: { status: ImportSessionStatus.FAILED },
  });

  // Verify that all staging operations inside the transaction were aborted
  expect(mockPrisma.importRecord.create).not.toHaveBeenCalled();
  expect(mockPrisma.importAnomaly.create).not.toHaveBeenCalled();
  expect(mockPrisma.dataChangeProposal.create).not.toHaveBeenCalled();

  // Verify failure audit event was logged
  expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        action: AuditActionType.IMPORT_FAILED,
      }),
    })
  );
});
```

---

## 3. Balance Integrity (Zero-Sum Conservation) Proof

To prevent corrupt ledger calculations, the engine enforces that the sum of all participant balances is zero:
$$\sum_{u \in Users} Balance_u = 0.00$$
This is validated twice:
1. **Before simulation**: Enforces that the group is in a mathematically clean state.
2. **After simulation**: Enforces that the hypothetical imports conserve zero-sum integrity.

### Zero-Sum Verification Implementation
```typescript
// Before simulation check
let beforeSum = new Decimal(0);
currentBalances.forEach((b) => {
  beforeSum = beforeSum.plus(b.netBalance);
});
if (beforeSum.abs().gt(0.01)) {
  throw new Error(`BALANCE_INTEGRITY_FAILURE: Sum of balances before simulation is non-zero: ${beforeSum.toFixed(4)}`);
}

// ... apply offsets ...

// After simulation check
let afterSum = new Decimal(0);
for (const val of Object.values(simulatedBalances)) {
  afterSum = afterSum.plus(val);
}
if (afterSum.abs().gt(0.01)) {
  throw new Error(`BALANCE_INTEGRITY_FAILURE: Sum of simulated balances is non-zero: ${afterSum.toFixed(4)}`);
}
```

---

## 4. State Machine Transition Rules Proof

The state machine strictly enforces permitted routes. Attempting forbidden paths throws validation errors.

### Transition Guards Implementation
```typescript
export function validateStateTransition(
  current: ImportSessionStatus,
  target: ImportSessionStatus
): boolean {
  const allowed: Record<ImportSessionStatus, ImportSessionStatus[]> = {
    PENDING: ['PARSING', 'FAILED'],
    PARSING: ['ANALYZED', 'FAILED'],
    ANALYZED: ['REVIEW_REQUIRED', 'APPROVED', 'FAILED'],
    REVIEW_REQUIRED: ['APPROVED', 'REJECTED', 'FAILED'],
    APPROVED: ['COMMITTED', 'FAILED'],
    REJECTED: ['TERMINATED', 'FAILED'],
    COMMITTED: [],
    TERMINATED: [],
    FAILED: [],
    UPLOADED: ['PARSING', 'FAILED'],
  };
  return allowed[current]?.includes(target) ?? false;
}
```

If validation fails, `transitionSessionStatus` throws a custom `InvalidStateTransition` exception:
```typescript
if (!validateStateTransition(current, targetStatus)) {
  throw new Error(`InvalidStateTransition: Cannot transition import session from "${current}" to "${targetStatus}"`);
}
```

---

## 5. Test Suite Execution Output

Run via Vitest: All 103 tests pass successfully.

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
