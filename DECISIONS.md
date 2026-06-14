# Architectural Decisions: SettleUp Shared Expenses

This document records the major engineering decisions, options considered, and tradeoffs for the SettleUp codebase.

---

## 1. Prisma Version Selection (Prisma 6 vs Prisma 7)
- **Problem**: Prisma v7 introduces breaking changes, removing the `url` datasource field from `schema.prisma` files and requiring custom driver adapter libraries (e.g. `@prisma/adapter-pg` and `pg`) for PostgreSQL database connections.
- **Options Considered**:
  - *Option A*: Adopt Prisma 7 and write custom driver adapter setups in `prisma.config.ts` and code loaders.
  - *Option B*: Downgrade to Prisma 6 to preserve direct database URL connection mapping.
- **Chosen Option**: **Option B (Prisma 6)**.
- **Reason**: Using Prisma 6 simplifies the database setup by keeping the standard `url = env("DATABASE_URL")` configuration directly in `schema.prisma`. It also avoids unnecessary boilerplate packages like `@prisma/adapter-pg` and `pg`.
- **Tradeoffs**: Missing out on minor schema formatting options in Prisma 7, which do not impact our target features.

---

## 2. Guest User Representation (Polymorphic vs. Single Table with Roles)
- **Problem**: Guest users (like Kabir) participate in splits and settlements but are not permanent group members and lack joinedAt/leftAt dates.
- **Options Considered**:
  - *Option A*: Separate `GuestUser` and `Member` tables.
  - *Option B*: Store both in a single `User` table with a `role` enum (`MEMBER` or `GUEST`).
- **Chosen Option**: **Option B (Single Table with Roles)**.
- **Reason**: Simplifies relationships. Core transaction tables (`Expense`, `Settlement`) can refer to the `User` table directly without requiring polymorphic foreign keys (which complicate queries and slow down indexes).
- **Tradeoffs**: Standard member queries must filter by `role` when evaluating roster boundaries, which is handled cleanly in the service layer.

---

## 3. Persistent Import Staging vs. Memory Session Caching
- **Problem**: Raw CSV data must be staged and reviewed before committing to the core expense ledger.
- **Options Considered**:
  - *Option A*: Parse CSV rows and store uncommitted data in user-session memory.
  - *Option B*: Save uncommitted rows in staging tables (`ImportRecord`, `DataChangeProposal`, `ImportAnomaly`).
- **Chosen Option**: **Option B (Staging Tables)**.
- **Reason**: Ensures data persistence. Users can reload the page, lose connection, or collaborate on review queues without losing staged import data. It also provides a clear audit log of uncommitted records and proposals.
- **Tradeoffs**: Increases write operations during uploads, but prioritizes data accuracy and trace audits.

---

## 4. Database Client Instance (Singleton vs. In-line Instantiation)
- **Problem**: Repeatedly calling `new PrismaClient()` in API route handlers creates multiple connection pools, which can exhaust PostgreSQL's connection limits.
- **Options Considered**:
  - *Option A*: Instantiate `new PrismaClient()` in each API route.
  - *Option B*: Implement a singleton pattern in a shared helper (`src/lib/prisma.ts`).
- **Chosen Option**: **Option B (Prisma Client Singleton)**.
- **Reason**: Ensures a single connection pool is shared across the Next.js application, preventing connection leaks. It also simplifies database mocking in unit tests.
- **Tradeoffs**: Requires importing the shared client across all services and repositories.

---

## 5. Split Calculation Architecture (Strategy Pattern vs. Unified Big Function)
- **Problem**: Different split types (Equal, Exact, Percentage, Shares) have wildly different validation constraints and arithmetic requirements. Having them in a single massive function leads to spaghetti code.
- **Options Considered**:
  - *Option A*: Create a unified helper function with nested `switch`/`case` branches.
  - *Option B*: Implement a strategy-based pattern using a polymorphic interface.
- **Chosen Option**: **Option B (Split Strategy Design Pattern)**.
- **Reason**: Decouples calculation and validation logic for each split type. If we add new split types in future phases, we only write a new class implementing the `SplitStrategy` interface without touching existing strategy code.
- **Tradeoffs**: Minor overhead of class instantiation and dispatching in `SplitCalculationService`, but vastly superior code isolation and readability.

---

## 6. Currency Exchange Rate Lookup (Closest Historical Rate vs. Fixed Realtime Rates)
- **Problem**: When importing historic data, we must convert non-INR expenses using historical exchange rates matching the transaction date to preserve balance integrity.
- **Options Considered**:
  - *Option A*: Query a real-time exchange rate API during execution.
  - *Option B*: Look up the closest rate in the database effective on or before the transaction date.
- **Chosen Option**: **Option B (Closest Effective Date Lookup)**.
- **Reason**: Real-time APIs do not offer free historical query access and introduce network dependencies that break reproducibility. Storing historical rates locally and performing a query for `effectiveDate <= date` sorted by date descending guarantees that conversions are deterministic, reproducible, and fully offline-capable.
- **Tradeoffs**: Requires seeding and maintaining an `ExchangeRate` table, which is easily managed using admin utility routes or seed files.

---

## 7. Soft Delete Pattern (Soft Delete vs. Hard Cascading Delete)
- **Problem**: Deleting an expense could corrupt the import audit trail or historical logs if the transaction records are completely deleted from the database.
- **Options Considered**:
  - *Option A*: Perform a hard delete on `Expense` (cascades and deletes `ExpenseParticipant` splits).
  - *Option B*: Add a nullable `deletedAt` field to `Expense` to flag records as soft-deleted.
- **Chosen Option**: **Option B (Soft Delete)**.
- **Reason**: Retains complete history for audit and validation purposes. Soft-deleted expenses are filtered out in active calculations but remain queryable for audit reports and administrative logs.
- **Tradeoffs**: Requires repository functions to explicitly exclude `deletedAt: null` from active queries (handled by default in `expense.repo.ts`), but keeps the ledger complete and resilient.

---

## 8. Centralized and Best-Effort Audit Trail System
- **Problem**: Writing database logs in multiple controller endpoints or domain services creates duplicated parsing logic. Furthermore, if the audit database table encounters a validation lock or connection issue, it could crash business-critical functions like payments or expense creations.
- **Options Considered**:
  - *Option A*: Direct Prisma writes inside API routes or services.
  - *Option B*: A centralized, dependency-injected `AuditService` with try-catch swallow guards.
- **Chosen Option**: **Option B (Centralized AuditService)**.
- **Reason**: Keeps all audit creation, before/after snapshot formatting, and delta diffing centralized in one component. Adding try-catch guards that swallow errors and log them separately ensures the audit trail is a best-effort side-effect that never forms a single point of failure for core business actions.
- **Tradeoffs**: Requires services to receive the actor's user ID and correlation tags, adding parameters to signatures, but protects transaction safety and decouples logging rules.

## 9. Single Source of Truth for Balance Calculations
- **Problem**: Allowing multiple components (like `ExpenseService`, `SettlementService`, `DebtSimplificationService`, `BalanceExplanationService`, or API route handlers) to independently aggregate ledger totals leads to divergent balance math, code duplication, and bugs.
- **Options Considered**:
  - *Option A*: Implement inline balance summing across various services and routes as needed.
  - *Option B*: Establish `BalanceEngineService` as the single source of truth for all net balance calculations.
- **Chosen Option**: **Option B (BalanceEngineService as Single Source of Truth)**.
- **Reason**: Guarantees consistency across all features (balances, debt simplification, explainability, reports). Every other service and route queries `BalanceEngineService` for pre-calculated or dynamically reconstructed balances, preventing calculation drift.
- **Tradeoffs**: Requires services to depend on `BalanceEngineService` and coordinate parameter passing, but ensures strict data integrity.

---

## 10. Snapshot Versioning Strategy (Persistent History vs. In-Place Deletion)
- **Problem**: Recalculating balances from raw ledger tables under high concurrent traffic is expensive and slow. Deleting the cache and recomputing in-place causes query failures if a read occurs during a recompute.
- **Options Considered**:
  - *Option A*: In-place deletion and rebuild of the current snapshot record.
  - *Option B*: Snapshot Versioning where historical snapshots are preserved, new versions are created, and `isCurrent` is flipped inside a database transaction.
- **Chosen Option**: **Option B (Snapshot Versioning)**.
- **Reason**: Guarantees read-safety and history retention. Because previous versions are never deleted and we update the `isCurrent` flag inside a transaction, readers can retrieve the last known version without blocking. This also preserves historical records for auditing.
- **Tradeoffs**: Increases storage overhead in the `BalanceSnapshot` table, which is easily mitigated by table indexing and archiving policies.

---

## 11. Anomaly rules architecture (Plugin Pattern vs. Monolithic Class)
- **Problem**: Ingesting CSV files requires verifying a large number of anomalies. A single monolithic detector class containing checks for missing fields, date formatting, user roles, currency, splits, and duplicates becomes unmaintainable and violates the Open/Closed Principle.
- **Options Considered**:
  - *Option A*: Single monolithic `AnomalyDetector` class.
  - *Option B*: Plugin-based architecture registering individual `AnomalyRule` classes.
- **Chosen Option**: **Option B (Plugin-based AnomalyRule System)**.
- **Reason**: Isolates rule logic. Each checker implements a common interface. Adding new validators requires writing a separate rule class and registering it, keeping rules testable, isolated, and extensible.
- **Tradeoffs**: Minor overhead of rule list dispatch loops, but improves modularity.

---

## 12. Transaction Identity (Cryptographic Record Fingerprinting vs. Row Number Mapping)
- **Problem**: Standard database rows depend on row numbers to identify duplicate claims. However, row numbers are unstable (if a row is filtered out or deleted, numbers shift, breaking mappings).
- **Options Considered**:
  - *Option A*: Map staged proposals and anomalies to row numbers.
  - *Option B*: Compute deterministic cryptographic fingerprints based on transaction data.
- **Chosen Option**: **Option B (Cryptographic Record Hashing)**.
- **Reason**: Generates a SHA-256 fingerprint from Date, Payer, Amount, and Description. Fingerprints are stored in the database, allowing stable O(1) duplicate checks and prefix-collision scans that survive row deletions and session restarts.
- **Tradeoffs**: Cryptographic hashing takes slightly more CPU overhead, which is negligible for imports of under 10k rows.

---

## 13. Migration Strategy (Prisma Migrate vs. Db Push)
- **Problem**: Changing enum values and adding unique constraints in production requires strict history preservation. Directly pushing the database schema drops and recreates schema changes, which can lead to untraceable schema states and potential data loss in deployments.
- **Options Considered**:
  - *Option A*: Run `prisma db push` to push schema changes directly to the database.
  - *Option B*: Generate structured SQL migration scripts with `npx prisma migrate dev` / `npx prisma migrate deploy` and commit them to Git.
- **Chosen Option**: **Option B (Structured Migration)**.
- **Reason**: Preserves migration history, allows easy rollbacks, provides a record of database changes, and enables repeatable, non-interactive migration execution via `prisma migrate deploy`.
- **Tradeoffs**: Requires managing migration SQL files in source control.

---

## 14. Import Session Status Lifecycle (Rejected vs. Terminated States)
- **Problem**: Distinguishing between temporary review states, a user rejecting the import data, and the final state of the session lifecycle.
- **Options Considered**:
  - *Option A*: Collapse user-rejected states into a single terminal `FAILED` status.
  - *Option B*: Retain both `REJECTED` and `TERMINATED` statuses.
- **Chosen Option**: **Option B (Retaining both REJECTED and TERMINATED)**.
- **Reason**: Separates the business logic meanings:
  - `REJECTED`: The user explicitly rejects the import review.
  - `TERMINATED`: The workflow is permanently closed following rejection.
  - `FAILED`: Indicates a technical execution failure during processing.
- **Tradeoffs**: Requires a two-step state machine transition for rejected flows (`REVIEW_REQUIRED -> REJECTED -> TERMINATED`).

---

## 15. Import Session Idempotency (File Hash vs. Checksum Checking)
- **Problem**: Repeatedly importing the same CSV file into the same group can duplicate expenses and corrupt calculations.
- **Options Considered**:
  - *Option A*: Perform line-by-line comparison during processing.
  - *Option B*: Hash the raw CSV content and check for unique `(groupId, fileHash)` pairs before starting.
- **Chosen Option**: **Option B (SHA-256 File Hashing)**.
- **Reason**: Computing `SHA256(csvContent)` and checking against `ImportSession` tables in O(1) time stops processing instantly if a duplicate file upload is detected, preventing resource consumption and database bloat.
- **Tradeoffs**: Changes to file whitespace or trivial characters alter the hash, but this is standard for file-level signature validation.

---

## 16. Transactional Staging & Failure Survivability (Out-of-Transaction Session Creation)
- **Problem**: Running all staging actions inside a single transaction means that if staging fails (e.g. balance integrity check fails), the entire transaction rolls back. If the session itself was created inside that transaction, it disappears, leaving no record of the failure or audit trail.
- **Options Considered**:
  - *Option A*: Create the `ImportSession` inside the database transaction.
  - *Option B*: Create the `ImportSession` and log `IMPORT_START` OUTSIDE the transaction. Perform the bulk import staging inside the transaction. On failure, catch the error, roll back staging, and update the session status to `FAILED` outside the transaction.
- **Chosen Option**: **Option B (Out-of-Transaction Session Creation)**.
- **Reason**: Guarantees traceability. The `ImportSession` survives the transaction rollback, recording the technical execution error and preserving audit evidence (`IMPORT_FAILED`), while preventing corrupt/partial staging records from polluting the DB.
- **Tradeoffs**: Requires multiple sequential database connections (one for creation, one for transaction, one for fallback update), which is fully supported by modern PostgreSQL connection pools.

---

## 17. Custom Visual Primitives (Tailwind Custom Styles vs. UI Component Libraries)
- **Problem**: Building interactive modal dialogs, select dropdowns, tables, and cards requires maintaining clear visual structures while keeping dependency weight light and testable.
- **Options Considered**:
  - *Option A*: Install massive decorative pre-packaged component libraries (e.g. Material UI, Semantic UI).
  - *Option B*: Implement lightweight custom functional React wrappers styled directly with Tailwind CSS.
- **Chosen Option**: **Option B (Lightweight Tailwind Primitives)**.
- **Reason**: Keeps application bundles small, provides maximum style customization matching dark/light themes, and allows native browser controls (like selects) which behave predictably in automated test browsers.
- **Tradeoffs**: Requires writing custom state controls for overlay modals and timelines.

## 18. E2E Browser Testing Strategy (Playwright vs. Unit Snapshot Tests)
- **Problem**: Verifying file ingestion workflows, proposal resolution clicks, and final ledger transaction saves cannot be reliably proven through unit logic checks alone.
- **Options Considered**:
  - *Option A*: Rely solely on unit mocks and snapshot tests.
  - *Option B*: Configure Playwright to start a test server, open headless browsers, and execute visual flows against a live seeded database.
- **Chosen Option**: **Option B (Playwright E2E Testing)**.
- **Reason**: Playwright provides authentic verification of session cookies, redirects, DOM interactions, file uploading streams, and real database writes. Running workers sequentially prevents database collision.
- **Tradeoffs**: E2E tests take longer to run than unit tests, but guarantee compliance with user-facing workflows.

---

## 19. Staging Ingested records with NormalizedData
- **Problem**: The commit engine validates that all unrejected staging records have `normalizedData` stored in the database. However, the dry-run engine initially only computed this state in-memory during simulated balance checks.
- **Options Considered**:
  - *Option A*: Parse and normalize records on the fly during the commit phase.
  - *Option B*: Compute and persist the `normalizedData` JSON blob directly into the `ImportRecord` table during the dry-run simulation.
- **Chosen Option**: **Option B (Persisted NormalizedData in Dry-Run)**.
- **Reason**: Guarantees that uncommitted records are fully staged, queryable, and auditable in the database. It allows other service endpoints (like the report viewer) to display staged/committed details and lets users apply manual approvals or overrides on top of a concrete baseline.
- **Tradeoffs**: Adds a database write operation per CSV row during parsing, but ensures transactional atomic consistency at commit time.

## 20. Active Roster Checks in Split Checklists
- **Problem**: The system has date-aware memberships (e.g., Meera left on March 29, 2026). When creating a new expense on a later date, including an inactive member in an equal split triggers a backend membership violation error.
- **Options Considered**:
  - *Option A*: Rely on the user to manually uncheck inactive members in the UI form.
  - *Option B*: Filter out inactive members from the default checked state when initializing the form.
- **Chosen Option**: **Option B (Active-Only Default Selection)**.
- **Reason**: Prevents silent inclusion of inactive members in the split payload, making the UI date-aware and preventing validation errors before submission.
- **Tradeoffs**: Requires active-only roster check logic on form initialization.

## 21. Dynamic CSV File Fingerprints in Visual Automation
- **Problem**: E2E tests upload a static mock CSV file. If run multiple times, subsequent uploads fail with `DUPLICATE_IMPORT_SESSION` due to duplicate file hash validation.
- **Options Considered**:
  - *Option A*: Disable duplicate file validation during test mode.
  - *Option B*: Append a dynamic timestamp to the E2E mock CSV content on each run to guarantee a unique hash.
- **Chosen Option**: **Option B (Dynamic CSV descriptions)**.
- **Reason**: Preserves the integrity of the core backend idempotency check engine while allowing tests to run reliably in any environment.
- **Tradeoffs**: Requires dynamic string interpolation in the test spec.

---

## 22. Public User Registration & Self-Service Authentication Architecture
- **Problem**: Enabling new public users to register and login securely without breaking existing guest user behaviors or seeded demo user configurations.
- **Options Considered**:
  - *Option A*: Make `email` and `passwordHash` mandatory fields on the `User` schema.
  - *Option B*: Make `email` and `passwordHash` nullable fields, add `isGuest: Boolean` (default `false`), and enforce validation checks inside the registration and authentication services.
- **Chosen Option**: **Option B (Nullable credentials and explicit role-based validation)**.
- **Reason**: Allows seamless co-existence of registered users, seeded demo accounts, and guest accounts. Registered and demo users have email and hashed passwords, while guest accounts (represented as `isGuest: true`) have placeholder credentials and are explicitly blocked from authenticating via the NextAuth Credentials provider.
- **Tradeoffs**: Requires explicit logic checks in the authorization handler to block guest logins and verify passwords using 12-round bcrypt hash comparison, but avoids destructive database migrations and retains seed script validity.


