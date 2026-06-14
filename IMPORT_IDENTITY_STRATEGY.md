# Import Identity Strategy

This document details the cryptographic record fingerprinting strategy used to uniquely identify and check transactions for duplicate and conflict patterns.

---

## The Fingerprint Formula

Instead of relying on unstable row numbers (which change when rows are filtered, deleted, or inserted), SettleUp computes a deterministic SHA-256 fingerprint for every imported row.

The payload combines the four core transaction pillars: **Date, Payer, Amount, and Description**.

### Mathematical Formula
$$Fingerprint = SHA256(Normalize(Date) + "|" + Normalize(Payer) + "|" + Normalize(Amount) + "|" + Normalize(Description))$$

---

## Normalization Rules

To ensure that formatting variations (such as commas in numeric amounts or trailing spaces) do not bypass duplicate detection, the payload fields are normalized prior to hashing:

1. **Date**: Trimmed and lowercased.
2. **Payer**: Trimmed and lowercased.
3. **Amount**: Stripped of commas (e.g., `"1,200"` $\rightarrow$ `"1200"`), trimmed of spaces, and formatted as a lowercase string.
4. **Description**: Trimmed, stripped of punctuation, and lowercased.

### Code Implementation
```typescript
import crypto from 'crypto';

export function calculateRecordFingerprint(
  rawDate: string,
  rawPayer: string,
  rawAmount: string,
  rawDesc: string
): string {
  const normDate = rawDate.trim().toLowerCase();
  const normPayer = rawPayer.trim().toLowerCase();
  const normAmount = rawAmount.trim().replace(/,/g, '').toLowerCase();
  const normDesc = rawDesc.trim().toLowerCase().replace(/[^a-z0-9]/g, ' ');

  const payload = `${normDate}|${normPayer}|${normAmount}|${normDesc}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
```

---

## Rationale & Use Cases

### 1. Duplicate Detection
When checking for duplicate rows within a session, the engine compares full fingerprints. If two records share the exact same hash, one is flagged as a duplicate of the other.

### 2. Conflicting Duplicate Detection
To identify conflicts (e.g. Row 24 Aisha Thalassa ₹2400 and Row 25 Rohan Thalassa ₹2450), the engine checks for rows that share a **prefix identity hash**:
$$PrefixPayload = Normalize(Date) + "|" + Normalize(Description)$$
If two records have the same prefix payload hash but different full fingerprints, they represent conflicting claims for the same event, triggering a `CONFLICTING_DUPLICATE` error.
