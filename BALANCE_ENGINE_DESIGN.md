# Balance Engine Design Specification

This document details the mathematical models, database interaction rules, debt simplification algorithms, and worked examples for the SettleUp Balance Engine.

---

## 1. Exact Balance Calculation Formula

The net balance of a user $U_i$ in a group $G$ at a specific point in time is computed by summing the net effects of all expenses paid or participated in, and all settlements sent or received.

### Net Balance Formula
$$Balance(U_i) = Balance_{expenses}(U_i) + Balance_{settlements}(U_i)$$

Where:
- **Net Expense Impact**:
  $$Balance_{expenses}(U_i) = \sum_{e \in E_{active}} \Delta Balance(e, U_i)$$
  $$\Delta Balance(e, U_i) = \begin{cases} 
    Amount_{base}(e) - Share(e, U_i) & \text{if } U_i = Payer(e) \\
    -Share(e, U_i) & \text{if } U_i \neq Payer(e) \text{ and } U_i \in Participants(e) \\
    0 & \text{otherwise}
  \end{cases}$$
  
- **Net Settlement Impact**:
  $$Balance_{settlements}(U_i) = \sum_{s \in S_{active}} \Delta Balance(s, U_i)$$
  $$\Delta Balance(s, U_i) = \begin{cases}
    +Amount_{base}(s) & \text{if } U_i = Sender(s) \\
    -Amount_{base}(s) & \text{if } U_i = Receiver(s) \\
    0 & \text{otherwise}
  \end{cases}$$

### Ledger Consistency Guarantee
At all times, the sum of all user balances in the group must equal exactly zero:
$$\sum_{U \in G} Balance(U) = 0$$

- **Net Balance > 0**: The user is a **Creditor** (owed money by the group).
- **Net Balance < 0**: The user is a **Debtor** (owes money to the group).

---

## 2. Membership-Aware Balance Rules

Standard group members are bound by join and leave dates recorded in the `GroupMembership` table. 

### Roster Check Logic
When an expense or settlement is registered at a transaction date $T_{tx}$, the user's active membership status is verified:
- **Active Membership Condition**: A standard user $U$ is active if and only if:
  $$JoinedAt(U) \le T_{tx} \quad \text{and} \quad (LeftAt(U) = \text{null} \quad \text{or} \quad LeftAt(U) \ge T_{tx})$$
- **Equal split checks**: If the split type is `EQUAL`, only group members active on date $T_{tx}$ are included in the default participants list.
- **Payer validation**: The payer of an expense (or sender/receiver of a settlement) must have been active in the group on $T_{tx}$.

### Historic Roster Tracing
If a user is inactive on $T_{tx}$, they are mathematically excluded from calculations for that transaction, protecting historical calculations from retrospection errors.

---

## 3. Settlement Application Rules

Settlements (repayments) represent transfers of money between two users to resolve debts.

- **Sender Credit Increase**: When user $A$ sends a settlement of amount $X$ to user $B$, $A$'s balance increases by $+X$ (debt reduced or credit added).
- **Receiver Credit Decrease**: When user $B$ receives a settlement of amount $X$ from user $A$, $B$'s balance decreases by $-X$ (credit reduced or debt offset).
- **Duplicate Prevention**: Settlements are validated against expense records. Settlements can never be split among other group members. They are strictly 1-to-1 operations.

---

## 4. Currency Conversion Rules

To calculate aggregate group balances, all transaction amounts must be converted to the base currency, Indian Rupees (**INR**).

- **Deterministic Rate Resolution**:
  Given from currency $C$, transaction date $T$, the exchange rate $R$ is fetched:
  $$R = \text{ExchangeRate}(C \to \text{INR}) \text{ effective on or before } T \text{ with max date } \le T$$
- **Reproducibility Guarantee**:
  Every transaction stores its `originalAmount`, `originalCurrency`, resolve `exchangeRate`, and `baseCurrencyAmount` directly in the database row. Conversions are never computed on-the-fly from variable external API states.
- **Precision Lock**:
  All conversions utilize `decimal.js` set to 20 decimal places of precision, rounding to 2 decimal places at database write boundaries using `Decimal.ROUND_HALF_UP` to prevent drift.

---

## 5. Guest User Handling

Guest users (role = `GUEST`) bypass normal membership boundaries.

- **Transient Status**: Guest users do not have `joinedAt` or `leftAt` records and are never automatically pulled into `EQUAL` splits.
- **Explicit Splits Only**: Guests only participate in splits when explicitly named as a participant in `EXACT`, `PERCENTAGE`, or `SHARES` splits (or selected in custom `EQUAL` splits).
- **Independent Balances**: Guests have their own independent net balance calculated via standard formulas. They are never merged into any standard member's balance.

---

## 6. Debt Simplification Algorithm

To resolve balances with the fewest possible transactions, the engine runs a **Greedy Net-Balance Matching Algorithm**.

### The Algorithm Steps:
1. Compute the net balance for all users in the group.
2. Split users into two sorted arrays:
   - **Creditors**: $\{ C_j \}$ with $Balance(C_j) > 0$, sorted descending.
   - **Debtors**: $\{ D_k \}$ with $Balance(D_k) < 0$, sorted ascending (largest absolute debt first).
3. Loop while both arrays are non-empty:
   - Let $C_{max}$ be the largest creditor, and $D_{max}$ be the largest debtor.
   - Calculate transfer amount: $Amount = \min(Balance(C_{max}), |Balance(D_{max})|)$.
   - Record suggested settlement: **$D_{max}$ pays $Amount$ to $C_{max}$**.
   - Adjust balances:
     - $Balance(C_{max}) \leftarrow Balance(C_{max}) - Amount$
     - $Balance(D_{max}) \leftarrow Balance(D_{max}) + Amount$
   - Remove any user from arrays if their adjusted balance becomes $0$.
4. Return the list of suggested transactions.

### Computational Complexity:
Sorting $N$ users takes $O(N \log N)$. The greedy matching loops at most $N-1$ times, each taking $O(1)$ operations with pointers.
Total Complexity: **$O(N \log N)$**.

---

## 7. Explainability Architecture

To ensure the "drill-down" feature is fully explainable, the engine computes a step-by-step audit reconstruction for any user's balance.

### Data Flow for Explainability
```
[User Selects Drill-down]
         │
         ▼
[API: GET /api/groups/[id]/balances/explain/[userId]]
         │
         ▼
1. Fetch all active Expenses where userId is Payer or Participant
2. Fetch all Settlements where userId is Sender or Receiver
3. Sort all records chronologically
4. Map each record to a Step JSON:
   {
     "date": "ISO Date",
     "type": "EXPENSE_PAID" | "EXPENSE_OWED" | "SETTLEMENT_SENT" | "SETTLEMENT_RECEIVED",
     "description": "description text",
     "originalAmount": 100,
     "originalCurrency": "USD",
     "exchangeRate": 83.5,
     "splitFraction": "1/4" (or shares ratio),
     "adjustedINR": -2087.50
   }
         │
         ▼
[UI renders Chronological Drill-down Table]
```

---

## 8. Balance Caching Strategy

Computing balances from scratch over thousands of transactions is expensive. SettleUp utilizes a **Write-Through Snapshot Caching Strategy**.

- **Prisma Model**: `BalanceSnapshot` stores pre-computed balances as a JSON array.
- **Cache Invalidation**:
  When an expense or settlement is created, updated, or deleted, the system invalidates the cached state by deleting previous snapshots for that group and computing a new one in a background task (best-effort).
- **Read Path**:
  ```
  GET /balances
       │
       ├──► Check if BalanceSnapshot exists for groupId
       │          │
       │          ├──► YES: Return cached balances JSON (O(1) database read)
       │          │
       │          └──► NO: Compute from ledger, save snapshot, return (O(E*N) write-through)
  ```

---

## 9. Computational Complexity Analysis

Let:
- $E$ = Number of non-deleted expenses in the group.
- $S$ = Number of settlements in the group.
- $N$ = Number of users in the group.
- $P$ = Average number of participants per expense ($P \le N$).

| Operation | Complexity (No Cache) | Complexity (With Cache) |
|---|---|---|
| Fetch Net Balances | $O(E \cdot P + S)$ | $O(1)$ |
| Debt Simplification | $O(N \log N)$ | $O(N \log N)$ |
| Explain Balance | $O(E + S)$ | $O(E + S)$ |

---

## 10. Edge Case Handling

1. **Perfect Circle Debts**:
   If $A$ owes $B$, $B$ owes $C$, and $C$ owes $A$ the same amount, the net balances are all $0$. The debt simplification engine will output **0 recommended transactions**, resolving the circle automatically.
2. **Penny Discrepancy (Floating Point)**:
   Equal splits that yield repeating decimals (e.g. ₹100 divided by 3) are handled by the Split Strategy allocating the remainder penny (₹0.01) to the first participant. The balance engine works directly on these calculated splits, ensuring no rounding drift.
3. **Mid-Day Membership Transitions**:
   If a user joins or leaves on a specific date, transactions on that exact date are evaluated using timestamps. Standard timestamps default to the start of the day (`00:00:00`) unless specified, preventing timezone boundaries errors.

---

## 11. Worked Examples (CSV Scenarios)

These examples show how different scenarios from the CSV are processed.

### Scenario A: Meera leaves earlier
- **Roster**: Aisha, Rohan, Priya, Meera (Active from `2026-02-01`).
- **Meera Exit Date**: `2026-03-29`
- **Transactions**:
  1. **Feb 15**: Rent expense of ₹20,000 paid by Aisha. Split: EQUAL.
     - Active roster on Feb 15: Aisha, Rohan, Priya, Meera (4 users).
     - Each owes: ₹5,000.
     - Meera balance: -₹5,000.
  2. **Apr 02**: Electricity expense of ₹4,000 paid by Rohan. Split: EQUAL.
     - Active roster on Apr 02: Aisha, Rohan, Priya (3 users. Meera is inactive).
     - Each owes: ₹1,333.33.
     - Meera split: Excluded.
     - Meera balance remains: -₹5,000.

### Scenario B: Sam joins later
- **Sam Entry Date**: `2026-04-08`
- **Transactions**:
  1. **Mar 10**: Internet expense of ₹1,200 paid by Priya. Split: EQUAL.
     - Active roster on Mar 10: Aisha, Rohan, Priya, Meera (4 users. Sam is not joined yet).
     - Each owes: ₹300.
     - Sam split: Excluded (owes ₹0).
  2. **Apr 10**: Internet expense of ₹1,200 paid by Priya. Split: EQUAL.
     - Active roster on Apr 10: Aisha, Rohan, Priya, Sam (4 users. Meera left, Sam joined).
     - Each owes: ₹300.
     - Sam split: Included (owes ₹300).

### Scenario C: USD Transactions & Historical Rates
- **Transaction**: **Mar 09**: Goa Villa expense of \$100 paid by Aisha. Split: EQUAL (Aisha, Rohan, Priya, Meera).
- **Exchange rate**: \$1 USD = ₹83.50 INR (Effective effective date `2026-02-01`).
- **Calculations**:
  - Base currency amount: $100 \times 83.50 = \text{₹8,350.00}$.
  - Split shares (4 participants):
    - Aisha (1st participant gets remainder penny): ₹2,087.50
    - Rohan, Priya, Meera: ₹2,087.50
  - Net Balance impact for Rohan: -₹2,087.50 INR.

### Scenario D: Guest User Participation
- **Transaction**: **Mar 20**: Dinner expense of ₹3,000 paid by Dev. Split: SHARES.
  - Participants: Dev (2 shares), Kabir (GUEST, 1 share).
  - Total shares: 3.
  - Kabir split share: $1/3 \times 3000 = \text{₹1,000}$.
  - Kabir balance: -₹1,000 INR (Kabir is audited and tracked despite not having group membership bounds).

### Scenario E: Settlement Adjustment
- **Initial Balances**: Rohan owes Aisha ₹2,087.50 INR.
- **Transaction**: **Mar 12**: Rohan pays Aisha ₹2,000 INR. notes: "Partial repayment".
- **Net Balances**:
  - Aisha: $+2087.50 \text{ (expense owed)} - 2000.00 \text{ (settlement received)} = \text{+₹87.50 INR}$.
  - Rohan: $-2087.50 \text{ (expense share)} + 2000.00 \text{ (settlement sent)} = \text{-₹87.50 INR}$.
- **Suggested Debt Simplification**: Rohan pays Aisha ₹87.50 INR.
