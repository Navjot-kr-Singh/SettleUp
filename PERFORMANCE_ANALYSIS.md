# Performance Analysis & Indexing Strategy

This document details SettleUp's database indexing plan, database query complexity, and expected PostgreSQL query plans.

---

## 1. Indexing Strategy

To guarantee $O(1)$ index seek performance under concurrent ledger reads and writes, we enforce indexes on key foreign keys and query boundaries.

### Prisma Schema Index Declarations
We configure the following indexes directly in the [schema.prisma](file:///Users/navjotkumarsingh/Desktop/SettleUp/prisma/schema.prisma) file:

```prisma
model Expense {
  // ...
  @@index([groupId])
  @@index([date])
}

model ExpenseParticipant {
  // ...
  @@index([userId])
}

model Settlement {
  // ...
  @@index([groupId])
  @@index([date])
}

model GroupMembership {
  // ...
  @@index([userId])
  @@index([groupId])
}

model MembershipHistory {
  // ...
  @@index([userId])
}

model BalanceSnapshot {
  // ...
  @@index([groupId])
  @@index([groupId, isCurrent]) // Composite index for cached balance retrieval
}

model ImportRecord {
  // ...
  @@index([sessionId])
}

model ImportAnomaly {
  // ...
  @@index([recordId])
}

model DataChangeProposal {
  // ...
  @@index([recordId])
}
```

---

## 2. Database Query Complexity Analysis

### Query 1: Fetch Group Expenses
- **Operation**: `SELECT * FROM "Expense" WHERE "groupId" = $1 AND "deletedAt" IS NULL ORDER BY "date" DESC;`
- **Without Index**: $O(E)$ sequential table scan.
- **With Index**: $O(\log E)$ index-scan seek on `Expense(groupId)`.

### Query 2: Date-Aware Membership Check
- **Operation**: `SELECT * FROM "GroupMembership" WHERE "groupId" = $1 AND "userId" = $2;`
- **Without Index**: $O(M)$ sequential table scan.
- **With Index**: $O(1)$ unique key seek (B-tree index on `groupId_userId` composite unique index).

### Query 3: Retrieve Current Balance Snapshot
- **Operation**: `SELECT * FROM "BalanceSnapshot" WHERE "groupId" = $1 AND "isCurrent" = TRUE LIMIT 1;`
- **Without Index**: $O(B)$ table scan where $B$ is the number of snapshot versions.
- **With Index**: $O(\log B)$ index seek using the composite B-Tree index `(groupId, isCurrent)`.

---

## 3. Expected PostgreSQL Query Execution Plans

### Plan A: Fetching Current Cached Balance Snapshot
```sql
EXPLAIN ANALYZE SELECT * FROM "BalanceSnapshot" WHERE "groupId" = 'g-1' AND "isCurrent" = TRUE LIMIT 1;
```
**Expected Output**:
```text
Limit  (cost=0.15..8.17 rows=1 width=143) (actual time=0.015..0.016 rows=1 loops=1)
  ->  Index Scan using "BalanceSnapshot_groupId_isCurrent_idx" on "BalanceSnapshot"  (cost=0.15..8.17 rows=1 width=143)
        Index Cond: (("groupId" = 'g-1'::text) AND ("isCurrent" = true))
Planning Time: 0.082 ms
Execution Time: 0.035 ms
```
*Note: Uses the B-Tree index condition directly, avoiding a sequential scan of the historical snapshot versions.*

### Plan B: Fetching chronological user expenses for explainability
```sql
EXPLAIN ANALYZE SELECT * FROM "ExpenseParticipant" WHERE "userId" = 'u-1';
```
**Expected Output**:
```text
Index Scan using "ExpenseParticipant_userId_idx" on "ExpenseParticipant" (cost=0.15..12.30 rows=5 width=68)
  Index Cond: ("userId" = 'u-1'::text)
Planning Time: 0.075 ms
Execution Time: 0.045 ms
```
*Note: Directly executes an index seek on participant allocations, scaling efficiently with thousands of rows.*
