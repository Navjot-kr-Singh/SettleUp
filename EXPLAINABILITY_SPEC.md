# Balance Explainability Specification

This document details the API structure and calculation rules for reconstructing a user's net balance chronologically, including a running total ledger.

---

## 1. API Endpoint Contract

- **Route**: `GET /api/groups/[id]/balances/explain/[userId]`
- **Method**: `GET`
- **Response Format (JSON)**:
  ```json
  {
    "userId": "uuid-string",
    "userName": "Rohan",
    "netBalance": -100.00,
    "steps": [
      {
        "date": "2026-02-15T00:00:00Z",
        "type": "EXPENSE_SHARE",
        "amount": 300.00,
        "currency": "INR",
        "exchangeRate": 1.0,
        "impact": -300.00,
        "runningBalance": -300.00,
        "description": "Electricity bill (Share)"
      },
      {
        "date": "2026-03-01T00:00:00Z",
        "type": "EXPENSE_PAID",
        "amount": 100.00,
        "currency": "USD",
        "exchangeRate": 83.50,
        "impact": 6262.50,
        "runningBalance": 5962.50,
        "description": "Goa Villa (Paid)"
      },
      {
        "date": "2026-03-12T00:00:00Z",
        "type": "SETTLEMENT_SENT",
        "amount": 2000.00,
        "currency": "INR",
        "exchangeRate": 1.0,
        "impact": 2000.00,
        "runningBalance": 7962.50,
        "description": "Repayment to Aisha"
      }
    ]
  }
  ```

---

## 2. Event Types & Balance Impact Logic

| Step Event Type | Context | Math Sign | Formula for `impact` (INR) |
|---|---|---|---|
| **`EXPENSE_PAID`** | User paid the expense bill. | **Positive** | `+ (originalAmount * exchangeRate) - userShare` |
| **`EXPENSE_SHARE`** | User participated in the expense. | **Negative** | `- userShare` |
| **`SETTLEMENT_SENT`** | User sent a repayment transfer. | **Positive** | `+ (settlementAmount * exchangeRate)` |
| **`SETTLEMENT_RECEIVED`** | User received a repayment transfer. | **Negative** | `- (settlementAmount * exchangeRate)` |

---

## 3. Running Balance Calculation Rules

To prevent floating-point representation anomalies in the chronological list:
1. Fetch all records (expenses paid, splits participated in, settlements sent, and settlements received) for the user.
2. Sort them in ascending chronological order (`date` ascending).
3. Initialize `runningBalance = new Decimal(0)`.
4. Loop through sorted events:
   - Compute the event's net base currency impact (`impact` as a `Decimal`).
   - Add impact to the running total: `runningBalance = runningBalance.add(impact)`.
   - Assign the rounded decimal values (to 2 decimal places) for `impact` and `runningBalance` in the returned step objects.
5. Verify that the final step's `runningBalance` exactly matches the user's aggregate `netBalance`.
