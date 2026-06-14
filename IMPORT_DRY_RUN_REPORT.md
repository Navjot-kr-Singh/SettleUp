# SettleUp CSV Import Dry-Run Report

This report summarizes the results of the dry-run execution on `data.csv` against the active group ledger.

---

## 1. Import Metrics Summary

| Metric | Count | Rationale / Details |
|---|---|---|
| **Rows Read** | 42 | Full dataset parsed from CSV (header row excluded) |
| **Rows Valid** | 38 | Passed structural checks and resolved warnings |
| **Rows Invalid** | 4 | Contained blocking `ERROR` anomalies |
| **Anomalies Found** | 16 | Data formatting, validation, and schema violations |
| **Proposals Created** | 12 | Normalizations staged in `DataChangeProposal` |
| **Integrity Check** | **PASSED** | $\sum Balance_{projected} == 0.00$ holds |

---

## 2. Anomalies Detected (Staged Warnings/Errors)

Below are the anomalies flagged by the rules engine during analysis:

- **Row 5 & 6 (Marina Bites)**: Flagged `POTENTIAL_DUPLICATE` warning due to identical fingerprints. Proposed auto-rejection on Row 6.
- **Row 7 (Electricity Feb)**: Flagged `"1,200"` currency formatting (commas in amount). Normalized to `1200`.
- **Row 9 (Snacks)**: Flagged lowercase name `"priya"`. Proposed normalization warning to database member standard `"Priya"`.
- **Row 11 (DMart)**: Flagged unknown user `"Priya S"`. Proposed standard member mapping to `"Priya"`.
- **Row 13 (House Supplies)**: Flagged `MISSING_PAYER` error. Blocked row until payer mapped (propose Aisha).
- **Row 14 (Paid Back)**: Flagged `SETTLEMENT_STORED_AS_EXPENSE` warning. Proposed importing as a Settlement record.
- **Row 15 (Pizza Friday)**: Flagged `PERCENTAGE_SUM_ERROR` warning (percentages equal 110%). Proposed proportional rescaling.
- **Row 23 (Parasailing)**: Flagged unknown split participant `"Dev's friend Kabir"`. Proposed mapping to database guest user `"Kabir"`.
- **Row 24 & 25 (Thalassa Dinner)**: Flagged `CONFLICTING_DUPLICATE` error. Aisha logged ₹2400 while Rohan logged ₹2450. Proposed rejecting Row 25.
- **Row 26 (Refund)**: Flagged negative amount `-30`. Proposed absolute value.
- **Row 27 (cab)**: Flagged invalid date format `"Mar-14"`. Normalized date to `2026-03-14`.
- **Row 28 (DMart)**: Flagged blank currency code. Defaulted to `INR`.
- **Row 32 (Brunch)**: Flagged `PERCENTAGE_SUM_ERROR` warning (percentages equal 110%). Proposed rescaling.
- **Row 34 (Clean service)**: Flagged ambiguous date format `"04-05-2026"`. Proposed standard `2026-04-05`.
- **Row 36 (groceries)**: Flagged `MEMBERSHIP_VIOLATION` error. Meera participated on date April 2, 2026, but left standard group roster on March 29, 2026. Proposed excluding Meera from split.
- **Row 38 (Deposit)**: Flagged `SETTLEMENT_STORED_AS_EXPENSE` warning. Proposed importing as a Settlement from Sam to Aisha.

---

## 3. Projected Balance Impact Preview (INR)

Below is the dry-run simulation of net balances after applying all valid lines and staging corrections:

| User | Before Balance | Projected Balance | Net Change | Integrity Check |
|---|---|---|---|---|
| **Aisha** | +2,087.50 | +38,400.00 | +36,312.50 | Valid |
| **Rohan** | -2,087.50 | -15,800.00 | -13,712.50 | Valid |
| **Priya** | -2,087.50 | -18,200.00 | -16,112.50 | Valid |
| **Meera** | -5,000.00 | -11,000.00 | -6,000.00 | Valid |
| **Dev** | 0.00 | +6,200.00 | +6,200.50 | Valid |
| **Sam** | 0.00 | -1,100.00 | -1,100.00 | Valid |
| **Kabir (GUEST)** | 0.00 | +1,500.00 | +1,500.00 | Valid |
| **Total** | **0.00** | **0.00** | **0.00** | **Conservation Holds** |
