# CSV Analysis Report: `data.csv`

This analysis is generated automatically from scanning and processing the uploaded `data.csv` file. It maps out the columns, users, categories, currencies, split types, dates, and all data anomalies discovered.

---

## 1. CSV Structure & Columns Found
The CSV file contains **42 data rows** and **1 header row**.

The following columns were found in the header:
| Column Index | Column Name | Description / Expected Data |
|---|---|---|
| 0 | `date` | Date of the transaction (expected format: `DD-MM-YYYY` or `MMM-DD` short-date) |
| 1 | `description` | Text description of the expense or settlement |
| 2 | `paid_by` | The name of the member who paid for the expense |
| 3 | `amount` | The total numeric amount of the expense (may contain commas/quotes) |
| 4 | `currency` | Currency symbol/code (e.g. `INR`, `USD`, or blank) |
| 5 | `split_type` | How the expense is split (e.g., `equal`, `unequal`, `percentage`, `share`, or blank) |
| 6 | `split_with` | Semicolon-separated list of group members involved in the split |
| 7 | `split_details` | Additional metadata showing details of splits for unequal/share/percentage |
| 8 | `notes` | Free-text notes or comments regarding the expense |

---

## 2. Identified Users
Based on scanning all payer names (`paid_by`) and participants (`split_with`), we identified the following users:
- **Aisha** (Resident, present from start)
- **Rohan** (Resident, present from start; also appeared in raw data as lowercase `"rohan "` and `"rohan"`)
- **Priya** (Resident, present from start; also appeared as lowercase `"priya"` and `"Priya S"`)
- **Meera** (Resident, present from start, moved out on **2026-03-29**)
- **Dev** (Visitor / short-term guest, visiting in Feb, joined Goa trip in March)
- **Sam** (Resident, moved in on **2026-04-08**)
- **Kabir** (External user, listed as `"Dev's friend Kabir"`, participated in a single parasailing activity on **2026-03-11**)

---

## 3. Expense Categories
Categories inferred from the descriptions and notes:
- **Rent**: Housing rent expenses (`February rent`, `March rent`, `April rent`).
- **Food & Groceries**: Grocery stores and meals (`Groceries BigBasket`, `Groceries DMart`, `Dinner at Marina Bites`, `Pizza Friday`, `Beach shack lunch`, `Dinner at Thalassa`, `Weekend brunch`, `Meera farewell dinner`, `Dinner order Swiggy`).
- **Utilities - Internet**: Internet connection bill (`Wifi bill Feb`, `Wifi bill Mar`, `Wifi bill Apr`).
- **Utilities - Electricity**: Power bills (`Electricity Feb`, `Electricity Mar`, `Electricity Apr`).
- **Household Help**: Maid salaries (`Maid salary Feb`, `Maid salary Mar`, `Maid salary Apr`).
- **Household Supplies**: Maintenance / consumables (`House cleaning supplies`, `Deep cleaning service`).
- **Travel & Transport**: Flight bookings and local transport (`Goa flights`, `Scooter rentals`, `Airport cab`).
- **Accommodation**: Villa bookings (`Goa villa booking`).
- **Activities & Entertainment**: Fun/activities (`Movie night snacks`, `Parasailing`, `Parasailing refund`).
- **Celebrations**: Social events and cakes (`Aisha birthday cake`, `Housewarming drinks`).
- **Security Deposit**: Move-in deposits (`Sam deposit share`).
- **Furniture & Decor**: Common space upgrades (`Furniture for common room`).
- **Settlement**: Back-and-forth repayments (`Rohan paid Aisha back`).

---

## 4. Currencies Used
We identified two distinct currencies in the dataset:
1. **INR** (Indian Rupee) - The default base currency for the majority of the expenses.
2. **USD** (United States Dollar) - Used for international transactions during the Goa trip (rows 20, 21, 23, 26).
*Note: One record (Row 28) has a missing currency, which is inferred to be INR based on context.*

---

## 5. Split Types
The following split strategies were found:
- `equal`: Cost is shared equally among all people listed in `split_with`.
- `unequal`: Specific monetary amounts are owed by each participant, specified in `split_details`.
- `percentage`: Specific percentage shares of the total are owed by participants, specified in `split_details`.
- `share`: Specific numeric ratios/shares of the total are owed, specified in `split_details`.
- *(Blank)*: Found on the settlement transaction (Row 14), which has no group split.

---

## 6. Date Ranges & Order
- **Earliest Transaction**: `01-02-2026` (Row 2, February rent)
- **Latest Transaction**: `20-04-2026` (Row 43, Maid salary Apr)
- **Date Order Anomaly**: Row 34 is dated `04-05-2026` (May 4, 2026) but is placed between March 28 and April 1. This is a chronological out-of-order anomaly and suggests a day/month flip error (was meant to be April 5, i.e., `05-04-2026` or April 4).

---

## 7. Duplicate Candidates
We identified the following potential duplicates:
| Row | Duplicate Row | Payer | Amount | Date | Description Comparison | Resolution Action Required |
|---|---|---|---|---|---|---|
| **5** | **6** | Dev | 3200 INR | 08-02-2026 | `Dinner at Marina Bites` vs `dinner - marina bites` | Merge/Delete duplicate (identical transaction details, slightly different case) |

---

## 8. Settlement Candidates (Incorrectly Stored as Expenses)
The following row was identified as a direct settlement repayment rather than a shared group expense:
- **Row 14**: `25-02-2026, Rohan paid Aisha back, Rohan, 5000, INR,, Aisha,, this is a settlement not an expense??`
  - *Reason*: Split type is empty, paid by Rohan, split with Aisha, description indicates a direct repayment.
  - *Handling*: Must be parsed as a `Settlement` record in the database, bypasses the shared expense split logic, and directly reduces Rohan's debt to Aisha by 5000 INR.

---

## 9. Conflict Candidates (Conflicting Duplicate Entries)
We identified the following conflicting claims where multiple users logged what appears to be the same event:
- **Row 24 & Row 25** (Thalassa Dinner on `11-03-2026`):
  - Row 24: `Dinner at Thalassa` paid by **Aisha** for **2400 INR** (split with Aisha;Rohan;Priya;Dev)
  - Row 25: `Thalassa dinner` paid by **Rohan** for **2450 INR** (split with Aisha;Rohan;Priya;Dev)
  - *Note*: Row 25 note says "Aisha also logged this I think hers is wrong".
  - *Conflict*: Two different payers logged the same restaurant dinner on the same date with slightly different amounts (2400 vs 2450). This requires user review to choose the correct bill amount and payer, or merge/correct them.

---

## 10. Membership Change Events
Based on chronological notes, the group membership has two major transitions:
1. **Meera Moves Out**:
   - **Date**: **2026-03-29** (Sunday)
   - **Source**: Row 33 (`28-03-2026`, "Meera farewell dinner", note "Meera moving out Sunday :(")
   - **Rule**: Meera should be excluded from all expenses dated after 2026-03-29.
2. **Sam Moves In**:
   - **Date**: **2026-04-08**
   - **Source**: Row 38 (`08-04-2026`, "Sam deposit share", note "Sam moving in!")
   - **Rule**: Sam should be excluded from all expenses dated before 2026-04-08.

---

## 11. Complete List of All Anomalies Discovered
Here is the exact list of all data anomalies detected in `data.csv`, which the import engine must identify and report to the user for validation:

| Row | Category | Anomaly Type | Description | Raw Data |
|---|---|---|---|---|
| 6 | Potential Duplicate Record | Potential Duplicate Record | Row 6 ('dinner - marina bites') is a potential duplicate of Row 5 ('Dinner at Marina Bites') paid by Dev for 3200.0 INR | `08-02-2026;dinner - marina bites;Dev;3200;INR;equal;Aisha;Rohan;Priya;Dev;;` |
| 25 | Conflicting Duplicate Event | Conflicting Duplicate Event | Row 25 ('Thalassa dinner' paid by Rohan amount 2450.0) is a conflicting duplicate event of Row 24 ('Dinner at Thalassa' paid by Aisha amount 2400.0) on date 11-03-2026 | `11-03-2026;Thalassa dinner;Rohan;2450;INR;equal;Aisha;Rohan;Priya;Dev;;Aisha also logged this I think hers is wrong` |
| 10 | Decimal Precision Anomaly | Decimal Precision Anomaly | Row 10 has amount '899.995' with excessive decimal precision (fractional paisa). | `15-02-2026;Cylinder refill;Rohan;899.995;INR;equal;Aisha;Rohan;Priya;Meera;;` |
| 13 | Missing Payer | Missing Payer | Row 13 ('House cleaning supplies') is missing the payer ('paid_by'). Notes say: 'can't remember who paid'. | `22-02-2026;House cleaning supplies;;780;INR;equal;Aisha;Rohan;Priya;Meera;;can't remember who paid` |
| 14 | Settlement Stored as Expense | Settlement Stored as Expense | Row 14 ('Rohan paid Aisha back') has empty split_type and is described as Rohan paying Aisha back. This is a settlement, not a group expense. | `25-02-2026;Rohan paid Aisha back;Rohan;5000;INR;;Aisha;;this is a settlement not an expense??` |
| 15 | Invalid Percentage Sum | Invalid Percentage Sum | Row 15 ('Pizza Friday') split percentages sum to 110% instead of 100%. Details: 'Aisha 30%; Rohan 30%; Priya 30%; Meera 20%'. | `28-02-2026;Pizza Friday;Aisha;1440;INR;percentage;Aisha;Rohan;Priya;Meera;Aisha 30%; Rohan 30%; Priya 30%; Meera 20%;percentages might be off` |
| 23 | Unknown Member (Kabir) | Unknown Member (Kabir) | Row 23 ('Parasailing') includes external guest 'Kabir' in split_with. | `11-03-2026;Parasailing;Dev;150;USD;equal;Aisha;Rohan;Priya;Dev;Dev's friend Kabir;;Kabir joined for the day` |
| 26 | Negative Amount (Refund) | Negative Amount (Refund) | Row 26 ('Parasailing refund') has negative amount -30.0. This is a refund which must reduce splits. | `12-03-2026;Parasailing refund;Dev;-30;USD;equal;Aisha;Rohan;Priya;Dev;;one slot got cancelled` |
| 27 | Inconsistent Date Format | Inconsistent Date Format | Row 27 ('Airport cab') has non-standard date format 'Mar-14'. | `Mar-14;Airport cab;rohan ;1100;INR;equal;Aisha;Rohan;Priya;Dev;;` |
| 28 | Missing Currency | Missing Currency | Row 28 ('Groceries DMart') is missing the currency code. Notes say: 'forgot to set currency'. Inferred as INR. | `15-03-2026;Groceries DMart;Priya;2105;;equal;Aisha;Rohan;Priya;Meera;;forgot to set currency` |
| 31 | Zero Amount Expense | Zero Amount Expense | Row 31 ('Dinner order Swiggy') has amount 0. Note says: 'counted twice earlier - fixing later'. | `22-03-2026;Dinner order Swiggy;Priya;0;INR;equal;Aisha;Rohan;Priya;Meera;;counted twice earlier - fixing later` |
| 32 | Invalid Percentage Sum | Invalid Percentage Sum | Row 32 ('Weekend brunch') split percentages sum to 110% instead of 100%. Details: 'Aisha 30%; Rohan 30%; Priya 30%; Meera 20%'. | `25-03-2026;Weekend brunch;Meera;2200;INR;percentage;Aisha;Rohan;Priya;Meera;Aisha 30%; Rohan 30%; Priya 30%; Meera 20%;` |
| 36 | Left Member Included | Left Member Included | Row 36 ('Groceries BigBasket' on 02-04-2026) includes Meera, who moved out on Sunday 2026-03-29. | `02-04-2026;Groceries BigBasket;Priya;2640;INR;equal;Aisha;Rohan;Priya;Meera;;oops Meera still in the group list` |
| 42 | Equal Split with Details | Equal Split with Details | Row 42 ('Furniture for common room') is marked as 'equal' split, but contains split details: 'Aisha 1; Rohan 1; Priya 1; Sam 1'. | `18-04-2026;Furniture for common room;Aisha;12000;INR;equal;Aisha;Rohan;Priya;Sam;Aisha 1; Rohan 1; Priya 1; Sam 1;split_type says equal but someone added shares anyway` |
| 35 | Out of Chronological Order | Out of Chronological Order | Row 35 dated 01-04-2026 is out of order (placed after date 04-05-2026). | `01-04-2026;April rent;Aisha;48000;INR;share;Aisha;Rohan;Priya;Aisha 2; Rohan 1; Priya 1;Aisha took Meera's room too` |

---

## 12. Proposed Import & Normalization Rules
To handle these anomalies in production:
1. **User Normalization**: Map case variations (e.g. `priya` -> `Priya`, `Priya S` -> `Priya`, `rohan ` -> `Rohan`) automatically.
2. **Settlement Extraction**: Auto-convert Row 14 to a `Settlement` entity.
3. **Payer Backfill**: Flag Row 13 as high-severity validation error. Block execution until the user manually assigns a payer.
4. **Currency Backfill**: Set Row 28's currency to `INR` automatically (with a warning) or prompt the user.
5. **Percentage Normalization**: Normalize percentages that sum to 110% (Rows 15 and 32). The system should offer:
   - Rescale to 100% (e.g. divide by 1.1: Aisha 27.27%, Rohan 27.27%, Priya 27.27%, Meera 18.18%).
   - Reject/Prompt user to input correct percentages.
6. **Refund Processing**: Negative amount in Row 26 represents a refund. In the balance engine, this acts as a negative expense, meaning Dev gets credited 30 USD, while Aisha, Rohan, Priya, and Dev each get their share reduced by 7.50 USD.
7. **Zero Amount Handling**: Highlight Row 31 as 0-value. It can be imported as a deactivated/archived expense since it represents a double-entry correction.
8. **Inconsistent Date Format**: Parse `Mar-14` as `14-03-2026` using contextual year 2026.
9. **Out-of-order/Ambiguous Date**: Date `04-05-2026` in Row 34 should be flagged. Suggest correction to `05-04-2026` (April 5) or prompt user to confirm if it was May 4 or April 5.
10. **Membership Enforcement**:
    - Highlight Row 36 (dated 02-04-2026) because Meera was included after she moved out.
    - Highlight Row 23 because "Kabir" is an external visitor. Suggest registering Kabir as a guest user or adding him to the split as a transient entity.
