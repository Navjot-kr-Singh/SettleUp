# SettleUp: Spreetail Shared Expenses Platform

SettleUp is a production-grade, audit-ready shared expense management platform built for the Software Developer internship assignment. It features a multi-stage import pipeline, generic data change proposals for governance, and a date-aware balance engine.

---

## Credentials Log (Seed Data)

The database is pre-seeded with the following demo users (all passwords are `<name-lowercase>123`):

| User | Role | Email | Password | Notes / Membership Status |
|---|---|---|---|---|
| **Aisha** | `MEMBER` | `aisha@settleup.com` | `aisha123` | Active from `2026-02-01` |
| **Rohan** | `MEMBER` | `rohan@settleup.com` | `rohan123` | Active from `2026-02-01` |
| **Priya** | `MEMBER` | `priya@settleup.com` | `priya123` | Active from `2026-02-01` |
| **Meera** | `MEMBER` | `meera@settleup.com` | `meera123` | Active from `2026-02-01` to `2026-03-29` (Moved out) |
| **Dev** | `MEMBER` | `dev@settleup.com` | `dev123` | Active from `2026-02-01` |
| **Sam** | `MEMBER` | `sam@settleup.com` | `sam123` | Active from `2026-04-08` (Moved in) |
| **Kabir** | `GUEST` | `kabir@settleup.com` | `kabir123` | Guest User (blocked from credential login; transient guest participation only) |

*Note: The `/login` page provides a "Quick Login" selector to easily impersonate the active seeded members. New users can sign up independently at `/signup`.*

---

## Setup Instructions

### 1. Prerequisites
- Node.js v18+
- PostgreSQL v15+ (Local or remote)

### 2. Installation
Install project dependencies:
```bash
npm install
```

### 3. Database Migration & Setup
Configure your database connection URL in `.env` (e.g. using the local port 5432):
```text
DATABASE_URL="postgresql://username:password@localhost:5432/settleup"
```

Then create the PostgreSQL database and run migrations:
```bash
npx prisma migrate dev --name init
```

### 4. Run Seeding Script
Seed standard users, groups, memberships, and default conversion rates:
```bash
npx prisma db seed
```

### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the portal.

### 6. Run Automated Unit Tests
```bash
npx vitest run
```

### 7. Run E2E Browser Verification Tests
```bash
npx playwright test
```

---

## Core Features & Governance

### Date-Aware Memberships
Roster boundaries are calculated dynamically from database logs:
- **Meera** is automatically excluded from equal splits after **2026-03-29**.
- **Sam** is automatically excluded from equal splits before **2026-04-08**.
- Guest user **Kabir** is a transient guest who only participates in splits where he is explicitly named, bypassing permanent membership checks.

### Generic DataChangeProposals
To prevent silent data changes, any normalization (e.g., date formats, name mapping, rescaling percentages, duplicate resolving) generates a `DataChangeProposal` that blocks imports until explicitly approved by an authorized user.

---

## Financial Domain & Architecture

### 1. Split Strategy Pattern
Expense split calculations are implemented using the **Strategy Design Pattern**.
- **Unified Interface**: The `SplitStrategy` interface defines a single contract: `calculate(amount: Decimal, participants: SplitParticipantInput[]): SplitResult[]`.
- **Encapsulated Logic**: The strategies (`EqualSplitStrategy`, `ExactSplitStrategy`, `PercentageSplitStrategy`, `SharesSplitStrategy`) handle their own validation and arithmetic.
- **Dispatcher Context**: The `SplitCalculationService` maps the `SplitType` enum to the correct strategy at runtime.
- **Extensibility**: Adding new split types requires no changes to existing strategies or controller endpoints, conforming to the Open/Closed Principle.

### 2. Multi-Currency Design & Conversions
To compute overall net balances, all transactions are normalized to a base currency (**INR**).
- **Date-Aware Historical Rate Lookup**: The `ExchangeRateService` queries the database for the closest exchange rate effective on or before the transaction date.
- **Traceability & Reproducibility**: Each `Expense` and `Settlement` stores the `originalAmount`, `originalCurrency`, `exchangeRate`, and `baseCurrencyAmount` directly in the database.
- **Floating-Point Precision**: Multi-currency mathematics are computed with 20 decimal places using `decimal.js`, and rounded to 2 decimal places at the boundaries.

### 3. Settlement Architecture
Settlements (repayments) represent direct transfers of funds between users.
- **Data Model**: Includes `sender`, `receiver`, `amount`, `currency`, `exchangeRate`, `baseCurrencyAmount` (INR), `date`, and audit notes.
- **Roster Validation**: Both sender and receiver are dynamically validated to ensure they are active group members (or guests) on the settlement date.
- **Self-Settlement Check**: The settlement service throws an error if a user tries to settle with themselves.

### 4. Audit Trail Architecture
The platform implements a centralized, system-wide Audit Trail system acting as the single source of truth for all mutations and auth actions.
- **Centralized Auditing**: All modules write to the audit ledger through `AuditService`, preventing raw inline writes.
- **Fail-Safe Execution (Best-Effort)**: Core business operations (like expense creation and settlements) never block if logging fails. Logging errors are caught, directed to separate failure logs, and return control normally.
- **Automatic Diffing**: For `UPDATE` events, the system compares `beforeState` and `afterState` snapshots and calculates exactly what fields changed.
- **Correlation ID**: Generates and maps unique request correlation tags to trace complex sequences.

### 5. Balance Engine, Debt Simplification, & Snapshots
The core balance and repayment resolution engine.
- **Single Source of Truth**: All balance calculations flow exclusively through `BalanceEngineService`. Individual services (e.g., `ExpenseService`, `SettlementService`, etc.) are prohibited from performing independent balance math.
- **Snapshot Versioning**: To avoid recalculating balances on every read, group balances are cached in the `BalanceSnapshot` table. Updates create new snapshot records with incrementing version numbers. Previous versions are marked `isCurrent = false` and preserved. Only one snapshot is marked current at any time.
- **Debt Simplification**: Implements a greedy pointer-matching algorithm ($O(N \log N)$) that matches debtors with creditors to resolve balances in the minimum possible number of transactions.
- **Explainability Engine**: The `BalanceExplanationService` reconstructs a step-by-step timeline of all ledger items (expenses paid, shares owed, settlements sent, settlements received) that affect a user's running balance, showing the base INR impact and cumulative totals chronologically.



