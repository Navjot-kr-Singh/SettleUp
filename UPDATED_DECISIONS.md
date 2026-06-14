# Updated Decisions: User Registration & Self-Service Authentication

This document outlines the architectural revisions, adjustments, and updates to the SettleUp codebase made during the Phase 8 registration implementation.

---

## 1. Nullable Password Hash & Unique Email Schema Strategy
- **Initial Idea**: Make email and password fields strictly required on the `User` schema.
- **Problem**: Enforcing non-nullable constraints immediately would cause destructive migrations, break existing guest accounts, seeded user configurations, and cause 122+ preexisting test cases to fail compilation.
- **Updated Decision**: Make `email` and `passwordHash` nullable (`String?`) and introduce an `isGuest` boolean (defaulting to `false`).
- **Result**: Registered users are created with valid email addresses and password hashes, while guest users and preexisting test mocks remain completely compatible without compilation or database runtime errors.

---

## 2. NextAuth Credentials Provider: Email-Only Lookup
- **Initial Idea**: Match credential logs using usernames or name fallbacks.
- **Problem**: Names are non-unique and insecure for credentials-based authentication.
- **Updated Decision**: Configure NextAuth to accept only `email` and `password` fields. Fallback authentication via name matches was completely removed. Seeded demo users were converted to email-based accounts (e.g. `aisha@settleup.com`), and all authentication queries use `prisma.user.findUnique({ where: { email } })`.

---

## 3. Explicit Guest Account Login Rejection
- **Initial Idea**: Guest accounts participate in splits, so they are part of the `User` schema.
- **Problem**: If guest accounts are assigned placeholder email addresses and hashes, an attacker could potentially guess or exploit guest records to login.
- **Updated Decision**: Add `isGuest` column to the `User` model. In the NextAuth credentials provider authorization callback, if `user.isGuest` is `true`, return `null` immediately. This completely restricts guest accounts from credentials-based login.

---

## 4. Date-Aware Creator Membership JoinedAt Offset
- **Initial Idea**: Add the creator of a new roomspace group with a membership join date of `new Date()` (the current timestamp of creation).
- **Problem**: E2E tests creating a group and immediately logging a manual transaction on the same calendar day (with a date initialized at midnight UTC, e.g. `2026-06-14T00:00:00.000Z`) failed because the membership join date (e.g. `2026-06-14T21:39:27.000Z`) was chronologically *after* the transaction date. This triggered the active roster validation guard: "Payer is not an active group member on transaction date".
- **Updated Decision**: During group creation POST API, set the creator's initial membership `joinedAt` date to yesterday, computed dynamically as `new Date(Date.now() - 24 * 60 * 60 * 1000)`.
- **Result**: Guarantees that any manual expense logged on the creation date of the group successfully passes the active membership timeline verification.
