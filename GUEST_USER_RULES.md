# Guest User Governance Specification

This document provides the technical rules, boundaries, and validation policies governing guest users (e.g. guest Kabir) in SettleUp.

---

## 1. Defining Guest Users

A user in SettleUp is defined as a guest when their role is set to `GUEST` (role enum in the database). Unlike standard members, guest users have no joining or leaving dates associated with a group, representing transient or short-term visitors.

---

## 2. Roster and Splitting Rules

To maintain correct balance logic and comply with Meera's requirement for clear division boundaries, guest users are treated under strict restrictions:

### 1. Exclusion from EQUAL splits
- When an expense is created with split type `EQUAL` in a group, only standard members whose membership intervals contain the transaction date are auto-added as split participants.
- **Guest users are never auto-added to `EQUAL` split groups.**

### 2. Explicit List Requirement
- A guest user can only participate in splits when they are **explicitly listed** as a participant in the payload (with a custom exact amount, share weight, percentage value, or manually selected in an equal split).
- If they are not named in the payload, they do not participate and owe ₹0.

### 3. Excluded from Group Membership Checks
- Guest users do not have `joinedAt` or `leftAt` records in the `GroupMembership` table.
- When validating active memberships for transaction dates (e.g., in `ExpenseService` and `SettlementService`), any user with role `GUEST` **bypasses date boundary checks and is marked active by default**.

---

## 3. CSV Importer Restrictions

During historical records loading:
- **No Guest Inference**: The importer must never automatically assign a transaction partition to a guest user unless the CSV line explicitly lists them.
- **Separate Balance Auditing**: Guest balances are computed individually and never merged into any permanent user's net balances (e.g., Kabir's balance is separate from Dev's).
- **Traceability**: Guest user transactions are fully logged in `AuditLog` and included in the `Import Report` validation queues.
