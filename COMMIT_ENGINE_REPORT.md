# Commit Engine Architecture Report

This report documents the architecture, transaction boundaries, commit flow, rollback flow, audit chain, and balance verification for the SettleUp Phase 6 Commit Engine.

---

## 1. Overview

The Commit Engine is the first phase that writes production financial records. It transforms approved dry-run import sessions into permanent `Expense`, `ExpenseParticipant`, and `Settlement` records while:

- Preserving full transactional atomicity
- Rebuilding balance snapshots within the same transaction
- Generating a complete, correlated audit trail
- Enforcing idempotency (committed sessions cannot be re-committed)
- Validating zero-sum balance integrity before and after commit

---

## 2. Commit Pipeline — 7 Steps

| Step | Name | Description | Boundary |
|---|---|---|---|
| **1** | Session Validation | 9 pre-commit checks on session state, groupId, fileHash, records | Outside TX |
| **2** | Commit Gate | Error anomalies, pending proposals, normalized data presence | Outside TX |
| **3** | Commit Lock | Set `status = COMMITTING` to prevent concurrent commits | Outside TX |
| **4** | Record Construction | Build Expense/Settlement objects from `normalizedData` + approved proposal overrides | Inside TX |
| **5** | Atomic Commit | Create Expenses, ExpenseParticipants, Settlements atomically | Inside TX |
| **6** | Snapshot Rebuild | Archive old snapshots, recompute balances, create new snapshot | Inside TX |
| **7** | Finalize | Mark session `COMMITTED`, write `IMPORT_COMMIT_COMPLETE` audit log | Inside TX |

---

## 3. Transaction Boundaries

```
[Outside Transaction]
  1. findUnique session (read)
  2. Validate all session state conditions
  3. importSession.update → status = COMMITTING  ← Commit Lock
  4. auditLog: IMPORT_COMMIT_START

[Inside prisma.$transaction]
  5. For each ImportRecord (status != REJECTED, normalizedData != null):
     a. Apply approved proposal overrides
     b. exchangeRate.convertToBase(amount, currency, date)
     c. IF type == SETTLEMENT:
           tx.settlement.create(...)
           tx.auditLog: IMPORT_COMMIT_SETTLEMENT_CREATED
        ELSE:
           tx.expense.create({ participants: { create: [...] } })
           tx.auditLog: IMPORT_COMMIT_EXPENSE_CREATED
     d. tx.importRecord.update → status = IMPORTED
  6. tx.balanceSnapshot.updateMany → isCurrent = false
  7. Recalculate balances from all active expenses + settlements
  8. tx.balanceSnapshot.create → new snapshot, isCurrent = true
  9. tx.auditLog: IMPORT_COMMIT_BALANCE_REBUILT
  10. tx.importSession.update → status = COMMITTED, committedAt, committedBy
  11. tx.auditLog: IMPORT_COMMIT_COMPLETE
  ← [COMMIT]

[Outside Transaction — on success]
  12. validateZeroSumBalance (POST) — reads new snapshot
  13. Return CommitResult

[Outside Transaction — on failure]
  Catch:
    importSession.update → status = FAILED
    auditLog: IMPORT_COMMIT_FAILED
    re-throw error
```

---

## 4. Proposal Override Resolution

Before writing financial records, the engine resolves any **approved** `DataChangeProposal` overrides. Rejected proposals are ignored. Only `APPROVED` proposals apply:

| Proposal Field | Applied To |
|---|---|
| `paid_by` | `paidById` on expense/settlement sender |
| `amount` | `originalAmount` |
| `currency` | `originalCurrency` |
| `split_type` | `splitType` enum |

---

## 5. Commit Lock Mechanism

The `COMMITTING` state prevents duplicate or concurrent commits:

```
APPROVED → COMMITTING  (set before transaction starts — outside TX)
COMMITTING → COMMITTED (set inside transaction on success)
COMMITTING → FAILED    (set in catch block on failure)
```

Any second request hitting `COMMITTING` status immediately receives:
> `COMMIT_REJECTED: Session is already COMMITTING. Concurrent commit blocked.`

Any second request hitting `COMMITTED` status immediately receives:
> `COMMIT_REJECTED: Session is already COMMITTED. Duplicate commit blocked.`

---

## 6. Balance Snapshot Rebuild

The engine rebuilds the balance snapshot **inside the same atomic transaction** to guarantee consistency between financial records and cached balances:

1. Archive: `balanceSnapshot.updateMany({ isCurrent: false })`
2. Recalculate: Sum all active expenses and settlements for the group
3. Create: New snapshot with `version = prev.version + 1`, `isCurrent = true`

Historical snapshots are **never deleted** — only `isCurrent` is toggled.

---

## 7. Audit Chain — 6 Commit Events

All events share a single `correlationId` UUID generated at the start of each commit:

| Audit Action | Trigger | Notes |
|---|---|---|
| `IMPORT_COMMIT_START` | After COMMITTING lock set | Outside transaction |
| `IMPORT_COMMIT_EXPENSE_CREATED` | Per expense written | Inside transaction |
| `IMPORT_COMMIT_SETTLEMENT_CREATED` | Per settlement written | Inside transaction |
| `IMPORT_COMMIT_BALANCE_REBUILT` | After snapshot creation | Inside transaction |
| `IMPORT_COMMIT_COMPLETE` | Session marked COMMITTED | Inside transaction |
| `IMPORT_COMMIT_FAILED` | Catch block | Outside transaction |

---

## 8. Commit Gate Preconditions

Before acquiring the COMMITTING lock, all of the following must pass:

| # | Check | Error Message |
|---|---|---|
| 1 | Session exists | `Import session not found` |
| 2 | Status = `APPROVED` | `Session must be APPROVED before committing` |
| 3 | Status ≠ `COMMITTED` | `Session is already COMMITTED. Duplicate commit blocked` |
| 4 | Status ≠ `COMMITTING` | `Session is already COMMITTING. Concurrent commit blocked` |
| 5 | Status ≠ `FAILED` | `Cannot commit a FAILED session` |
| 6 | Status ≠ `TERMINATED` | `Cannot commit a TERMINATED session` |
| 7 | Status ≠ `REJECTED` | `Cannot commit a REJECTED session` |
| 8 | `groupId` present | `Session has no valid groupId` |
| 9 | `fileHash` present | `Session is missing fileHash integrity marker` |
| 10 | Records exist | `Session contains no ImportRecords to commit` |
| 11 | No ERROR anomalies | `unresolved ERROR anomalies` |
| 12 | No PENDING proposals | `unresolved DataChangeProposals` |
| 13 | Audit trail exists | `Audit trail is missing` |
| 14 | All records have `normalizedData` | `records are missing normalizedData` |

---

## 9. API Routes

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/imports/commit/[sessionId]` | Trigger atomic commit | NextAuth |
| `GET` | `/api/imports/commit/[sessionId]/status` | Poll commit status and metrics | NextAuth |

### POST Response Shape (`CommitResult`)
```json
{
  "sessionId": "uuid",
  "status": "COMMITTED",
  "committedAt": "2026-06-13T15:11:42.000Z",
  "expensesCreated": 14,
  "settlementsCreated": 3,
  "snapshotVersion": 7,
  "correlationId": "uuid"
}
```

### GET Status Response Shape
```json
{
  "sessionId": "uuid",
  "status": "COMMITTED",
  "committedAt": "2026-06-13T15:11:42.000Z",
  "expensesCreated": 14,
  "settlementsCreated": 3,
  "snapshotVersion": 7
}
```
