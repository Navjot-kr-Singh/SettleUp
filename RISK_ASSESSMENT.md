# Risk Assessment: SettleUp Shared Expenses Platform

This document analyzes potential risks associated with the SettleUp architecture, data workflows, and deployment setup, and outlines mitigation strategies to ensure the system is production-ready.

---

## 1. Assignment Requirements Failure Risks

### Risk 1: Inability to Trace Historical Roster Adjustments
- **Risk Description**: Rohan requires every balance to be explainable. If membership history events (e.g. Meera leaving, Sam joining) are not tracked chronologically, the balance engine cannot reconstruct the group roster for past transactions.
- **Impact**: High. Rohan's explainability requirement fails.
- **Probability**: Low.
- **Mitigation Strategy**: The schema includes a `MembershipHistory` log table. The balance engine queries this table to reconstruct the active roster for any transaction date, rather than relying on current memberships.

---

## 2. Technical Risks

### Risk 2: floating-point Precision Errors in Financial Splits
- **Risk Description**: Using native JavaScript `number` (IEEE 754 float) for split calculations can introduce rounding errors (e.g., fractional decimals like `899.995` in Row 10).
- **Impact**: Medium. Balances may deviate by fractions of a paisa, leading to audit failures.
- **Probability**: High.
- **Mitigation Strategy**: Store amounts using the Prisma `Decimal` type (PostgreSQL `Decimal(12, 4)`) and perform math calculations using the `decimal.js` library.

---

## 3. Data Integrity Risks

### Risk 3: Double-processing of Duplicate Claims
- **Risk Description**: Conflicting duplicate claims (like Thalassa dinner rows 24 & 25) could both be imported, artificially inflating user balances.
- **Impact**: High. Double-charges user accounts, causing balance errors.
- **Probability**: Medium.
- **Mitigation Strategy**: The import pipeline flags duplicate claims and stores them in the `DataChangeProposal` review queue. The user must resolve the duplicate by choosing which transaction to import, preventing double-entry errors.

---

## 4. Import Pipeline Risks

### Risk 4: Silent Automatic Modifications
- **Risk Description**: The parser could silently modify dates, currencies, or splits without user review.
- **Impact**: High. Fails Meera's data governance requirement.
- **Probability**: High.
- **Mitigation Strategy**: The pipeline uses a unified `DataChangeProposal` table. Any modification (including date adjustments, percentage rescaling, and currency inferences) is staged in the review queue and requires user approval before execution.

---

## 5. Balance Calculation Risks

### Risk 5: Transient Guest Balances
- **Risk Description**: Guest users (e.g. Kabir) participating in transient transactions (e.g. parasailing) could have their balances incorrectly merged into standard user accounts.
- **Impact**: Medium. Distorts core resident balances.
- **Probability**: Medium.
- **Mitigation Strategy**: Seed Kabir as a user with a `role` of `"GUEST"`. The balance engine processes Kabir's transactions separately and tracks guest user balances without merging them into permanent member accounts.

---

## 6. Membership History Risks

### Risk 6: Roster Boundary Violations
- **Risk Description**: An expense could be logged including Meera after she moved out (Row 36) or Sam before he moved in.
- **Impact**: Medium. Distorts user balances by charging members for expenses they did not participate in.
- **Probability**: Medium.
- **Mitigation Strategy**: The balance engine compares the expense date against membership history limits. Violations are flagged in the import review queue for user resolution.

---

## 7. Multi-Currency Risks

### Risk 7: Exchange Rate Inconsistencies
- **Risk Description**: Converting USD transactions to INR using outdated exchange rates can lead to inconsistent balance calculations.
- **Impact**: High. Fails Priya's requirement for correct USD/INR handling.
- **Probability**: Medium.
- **Mitigation Strategy**: We store historical rates in the `ExchangeRate` table. Converted amounts are stored in both original and base currencies, with conversion details recorded in the `ImportReport`.

---

## 8. Audit Trail Risks

### Risk 8: Lack of Change History
- **Risk Description**: Changes to records could be made without audit logs, making it difficult to trace balance adjustments.
- **Impact**: High. Fails interview audits and verification requirements.
- **Probability**: Low.
- **Mitigation Strategy**: The system writes all database changes and user approvals to the `AuditLog` table.

---

## 9. Deployment Risks

### Risk 9: Neon Server Connection Latency
- **Risk Description**: Serverless Neon PostgreSQL database connections can experience cold start delays.
- **Impact**: Low. Marginally slows down page load times.
- **Probability**: Medium.
- **Mitigation Strategy**: Use Prisma's connection pooling features and cache balances in the `BalanceSnapshot` table to speed up dashboard loads.

---

## 10. Interview Review Risks

### Risk 10: Inability to Defend Design Choices
- **Risk Description**: The candidate is unable to explain schema structures or architectural decisions during the review.
- **Impact**: High. Fails the internship assignment review.
- **Probability**: Low.
- **Mitigation Strategy**: Provide the `INTERVIEW_DEFENSE.md` guide, detailing common questions and explanations for all database tables and logic decisions.
