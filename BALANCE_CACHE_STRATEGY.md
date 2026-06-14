# Balance Caching Strategy (Snapshot Versioning)

SettleUp utilizes a **Snapshot Versioning Strategy** to cache pre-computed group balances. This ensures high read performance while guaranteeing consistency and preventing concurrent write anomalies.

---

## 1. Database Model Design

The `BalanceSnapshot` model is structured to support historical versioning without deletes:

```prisma
model BalanceSnapshot {
  id          String   @id @default(uuid())
  groupId     String
  balances    Json     // Detailed pre-computed net balances JSON
  version     Int      // Incremental version number (e.g. 1, 2, 3...)
  isCurrent   Boolean  @default(true) // Flags the active cache snapshot
  createdAt   DateTime @default(now())

  group       Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
}
```

---

## 2. Mutative Workflow

When a transaction (expense create/update/delete, or settlement) modifies the ledger:

```
[Ledger Mutation Commits]
           │
           ▼
[Fetch Latest Snapshot Version for Group] (e.g. v=3)
           │
           ▼
[Start DB Transaction]
 ┌────────────────────────────────────────────────────────┐
 │ 1. Compute new balances from ledger                    │
 │ 2. Create new BalanceSnapshot (isCurrent=true, ver=4)   │
 │ 3. Update previous snapshots (isCurrent=false)         │
 └────────────────────────────────────────────────────────┘
           │
           ▼
[Transaction Commits & Cache updated safely]
```

*Note: Historical snapshots are never deleted. This provides an audit trail of group balances over time.*

---

## 3. Concurrency Behavior & Race Conditions

Concurrent traffic can cause race conditions where two requests attempt to rebuild the snapshot at the same time.

### Concurrency Mitigations:
1. **DB Transaction Isolation**: Rebuilding the snapshot and marking old ones inactive is executed inside a PostgreSQL database transaction (`SERIALIZABLE` or `READ COMMITTED` with raw locks).
2. **Version Constraint / Optimistic Lock**: If a thread attempts to write version $V$, but a snapshot with version $\ge V$ was already committed by another thread, the request is aborted to prevent overwriting newer calculations.
3. **Current Flag Indexing**: An index on `(groupId, isCurrent)` ensures that reading the current cached balance is a fast $O(1)$ query:
   ```sql
   SELECT * FROM "BalanceSnapshot" WHERE "groupId" = $1 AND "isCurrent" = TRUE LIMIT 1;
   ```

---

## 4. Tradeoffs & Consistency Guarantees

### Consistency Guarantees
- **Strict Read Consistency**: Reading the balance queries only the snapshot where `isCurrent = true`. Because updates happen inside database transactions alongside the ledger mutations, reads are guaranteed to never see stale or partially-recalculated balances.
- **Auditable Ledger**: Storing historical versions enables audit checks to compare past snapshots against reconstructed histories.

### Tradeoffs
- **Write Amplification (Minor)**: Every ledger mutation writes a new `BalanceSnapshot` row instead of updating in-place. However, group changes are low-frequency write operations compared to high-frequency read operations (dashboard views).
- **Storage Overhead**: Database size grows linearly with mutations.
  - *Mitigation*: A periodic background worker can archive or prune snapshots older than 30 days that are marked `isCurrent = false`, retaining only `isCurrent = true` and key month-end history snapshots.
