# CSV Import Engine Architectural Report

This report presents the system design, parser mechanics, dynamic rules engine, identity fingerprinting, and state machine transitions for the SettleUp CSV Import Engine.

---

## 1. Import Pipeline Design

The import engine is designed to parse, validate, stage, check, and simulate CSV transactions without mutating production tables.

### The 6-Stage Lifecycle Pipeline
1. **Ingestion & Parsing**: Parse CSV string content using a custom cell parser honoring quote block text boundaries.
2. **Staging**: Insert raw content as database `ImportRecord` staging entities. Generate unique record fingerprints.
3. **Anomaly Checks**: Run `AnomalyDetectorEngine` plugins.
4. **Governance Proposal**: Create `DataChangeProposal` corrections (e.g. casing, percentage rescalings).
5. **Simulated Balance Impact**: Run dry-run calculations using the active `BalanceEngineService` to compute a projected balance impact map.
6. **Zero-Sum Verification**: Asserts that $\sum Balance_{projected} == 0.00$ holds before committing. Creates a `BALANCE_INTEGRITY_FAILURE` error if conservation is broken.

---

## 2. Dynamic Rules Engine (Plugin Architecture)

Anomaly detectors are decoupled from a monolithic detector and split into class detector plugins conforming to the `AnomalyRule` interface.

- **Contract Interface**: `AnomalyRule` interface with `evaluate(record, context): Promise<RuleEvaluationResult[]>` method.
- **RuleContext**: Injects database transaction clients, `MembershipService` boundary check APIs, and visibility of all other rows in the uploaded session.
- **All 16 Detector Plugins Registered**:
  1. `DuplicateRecordDetector`: Checks for row duplicates by comparing cryptographic fingerprints.
  2. `ConflictingDuplicateDetector`: Flags date/description collisions with differing payers or amounts.
  3. `MissingPayerDetector`: Flags blank payers.
  4. `MissingParticipantDetector`: Flags blank split participant lists.
  5. `InvalidDateDetector`: Flags unparseable dates.
  6. `AmbiguousDateDetector`: Flags numeric ambiguity (e.g., DD-MM/MM-DD dates).
  7. `InvalidAmountDetector`: Flags non-numeric or zero amounts.
  8. `NegativeAmountDetector`: Flags negative amounts (e.g., refunds).
  9. `MissingCurrencyDetector`: Flags rows missing currency codes (defaulting to INR).
  10. `InvalidCurrencyDetector`: Validates currency codes against the Currency schema.
  11. `SettlementAsExpenseDetector`: Identifies settlement-like keywords in description/notes.
  12. `UnknownUserDetector`: Resolves fuzzy mappings for names or case mismatches.
  13. `MembershipViolationDetector`: Checks dynamic membership intervals.
  14. `PercentageSumDetector`: Validates split percentages total exactly 100%.
  15. `ShareAllocationDetector`: Validates split share counts.
  16. `BlankRowDetector`: Identifies and filters entirely empty rows.

---

## 3. Cryptographic Identity Hashing (Row Fingerprints)

Instead of relying on unstable row numbers, SettleUp computes a deterministic SHA-256 fingerprint for every imported record.

- **Formula**:
  $$Fingerprint = SHA256(Normalize(Date) + "|" + Normalize(Payer) + "|" + Normalize(Amount) + "|" + Normalize(Description))$$
- **Index**: Composite B-Tree index on `ImportRecord(fingerprint)` optimizes duplicate scans.

---

## 4. Import Session State Machine Transition Matrix

Lifecycle transitions are controlled by strict validation guards inside `ImportDryRunService`.

### Allowed Transitions Table

| Current State | Target State | Trigger / Conditions | Valid |
|---|---|---|---|
| **PENDING** | `PARSING` | Session starts parsing | Yes |
| **PENDING** | `FAILED` | Ingestion error / Idempotency fail | Yes |
| **PARSING** | `ANALYZED` | Records staged | Yes |
| **PARSING** | `FAILED` | Parsing error / Header missing | Yes |
| **ANALYZED** | `REVIEW_REQUIRED` | Anomaly rules found anomalies | Yes |
| **ANALYZED** | `APPROVED` | No anomalies found | Yes |
| **ANALYZED** | `FAILED` | Run-time evaluation error | Yes |
| **REVIEW_REQUIRED** | `APPROVED` | Proposals resolved / anomalies cleared | Yes |
| **REVIEW_REQUIRED** | `REJECTED` | User explicitly rejects session | Yes |
| **REVIEW_REQUIRED** | `FAILED` | Technical failure | Yes |
| **APPROVED** | `COMMITTED` | Ledger updates applied | Yes |
| **APPROVED** | `FAILED` | Commit gate integrity checks fail | Yes |
| **REJECTED** | `TERMINATED` | Reject closed out | Yes |
| **REJECTED** | `FAILED` | Technical failure | Yes |
| **FAILED** | Any | None | No |
| **COMMITTED** | Any | None | No |
| **TERMINATED** | Any | None | No |

---

## 5. Next.js API Routes Implementation

All endpoints are protected by `NextAuth` sessions, validated with Zod, and support offset-based pagination and filter criteria:
1. **GET `/api/imports/session/[id]`**: Retrieves import session metadata along with paginated/filtered staging record views.
2. **GET `/api/imports/session/[id]/report`**: Dynamically reconstructs and compiles a dry-run report for a staged session.
3. **POST `/api/imports/dry-run`**: Receives CSV payload, hashes files for idempotency, validates headers, and stages record information.
4. **GET `/api/imports/proposals`**: Returns list of paginated/filtered data correction proposals.
5. **PUT `/api/imports/proposals/[id]`**: Approves/rejects proposals and updates audit records.
