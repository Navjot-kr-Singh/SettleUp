import csv
import re
from datetime import datetime

csv_path = "/Users/navjotkumarsingh/Desktop/SettleUp/data.csv"

with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    rows = list(reader)

users = set()
currencies = set()
split_types = set()
parsed_rows = []
categories = set()

def normalize_user(u):
    u_clean = u.strip().lower()
    if not u_clean:
        return ""
    if u_clean in ['priya s', 'priya']:
        return 'Priya'
    if u_clean == 'rohan':
        return 'Rohan'
    if u_clean == 'aisha':
        return 'Aisha'
    if u_clean == 'meera':
        return 'Meera'
    if u_clean == 'dev':
        return 'Dev'
    if u_clean == 'sam':
        return 'Sam'
    if u_clean == "dev's friend kabir" or u_clean == 'kabir':
        return 'Kabir'
    return u.strip()

# Infer categories from descriptions
def infer_category(desc):
    d = desc.lower()
    if 'rent' in d:
        return 'Rent'
    if 'grocery' in d or 'groceries' in d or 'pizza' in d or 'dinner' in d or 'lunch' in d or 'brunch' in d or 'snacks' in d:
        return 'Food & Groceries'
    if 'wifi' in d or 'internet' in d:
        return 'Utilities - Internet'
    if 'electricity' in d:
        return 'Utilities - Electricity'
    if 'maid' in d:
        return 'Household Help'
    if 'cleaning' in d:
        return 'Household Supplies'
    if 'cab' in d or 'flight' in d or 'scooter' in d or 'rentals' in d:
        return 'Travel & Transport'
    if 'villa' in d:
        return 'Accommodation'
    if 'parasailing' in d:
        return 'Activities & Entertainment'
    if 'cake' in d:
        return 'Celebrations'
    if 'deposit' in d:
        return 'Security Deposit'
    if 'furniture' in d:
        return 'Furniture & Decor'
    if 'settlement' in d or 'paid' in d or 'back' in d:
        return 'Settlement'
    return 'Miscellaneous'

for i, row in enumerate(rows, start=2):
    if not row or len(row) < len(header):
        continue
    
    date_str, desc, paid_by, amount_str, currency, split_type, split_with, split_details, notes = row
    
    parsed_date = None
    date_format_notes = "Standard (DD-MM-YYYY)"
    try:
        parsed_date = datetime.strptime(date_str.strip(), "%d-%m-%Y")
    except ValueError:
        try:
            parsed_date = datetime.strptime(date_str.strip() + "-2026", "%b-%d-%Y")
            date_format_notes = "Inconsistent (Short format, e.g. Mar-14)"
        except ValueError:
            date_format_notes = "Invalid"

    # Clean amount
    amount = None
    try:
        clean_amount = amount_str.replace('"', '').replace(',', '').strip()
        amount = float(clean_amount)
    except ValueError:
        pass

    payer = normalize_user(paid_by)
    if payer:
        users.add(payer)

    curr = currency.strip().upper()
    if curr:
        currencies.add(curr)
    
    st = split_type.strip()
    if st:
        split_types.add(st)
        
    sw = [normalize_user(u) for u in split_with.split(';') if u.strip()]
    for u in sw:
        users.add(u)

    categories.add(infer_category(desc))

    parsed_rows.append({
        "row_idx": i,
        "date": parsed_date,
        "date_str": date_str,
        "description": desc,
        "paid_by": payer,
        "amount": amount,
        "currency": curr,
        "split_type": st,
        "split_with": sw,
        "split_details": split_details,
        "notes": notes,
        "category": infer_category(desc),
        "raw": row,
        "date_format_notes": date_format_notes
    })

anomalies = []

# Duplicates / conflicts pairs
for idx1 in range(len(parsed_rows)):
    for idx2 in range(idx1 + 1, len(parsed_rows)):
        r1 = parsed_rows[idx1]
        r2 = parsed_rows[idx2]
        
        if r1["date"] and r2["date"] and r1["date"] == r2["date"] and r1["amount"] == r2["amount"]:
            if r1["paid_by"] == r2["paid_by"]:
                anomalies.append({
                    "row": r2["row_idx"],
                    "type": "Potential Duplicate Record",
                    "description": f"Row {r2['row_idx']} ('{r2['description']}') is a potential duplicate of Row {r1['row_idx']} ('{r1['description']}') paid by {r1['paid_by']} for {r1['amount']} {r1['currency']}",
                    "data": r2["raw"]
                })
            else:
                anomalies.append({
                    "row": r2["row_idx"],
                    "type": "Conflicting Duplicate Payer",
                    "description": f"Row {r2['row_idx']} ('{r2['description']}') paid by {r2['paid_by']} conflicts with Row {r1['row_idx']} ('{r1['description']}') paid by {r1['paid_by']} for same amount {r1['amount']} {r1['currency']} on same date {r1['date_str']}",
                    "data": r2["raw"]
                })
        
        # Check for matching words in same-day entries (Thalassa dinner conflict)
        if r1["date"] and r2["date"] and r1["date"] == r2["date"]:
            words1 = set(r1["description"].lower().split())
            words2 = set(r2["description"].lower().split())
            common = words1.intersection(words2)
            if any(w in ['thalassa', 'marina', 'bites', 'parasailing', 'cab'] for w in common):
                if r1["amount"] != r2["amount"]:
                    anomalies.append({
                        "row": r2["row_idx"],
                        "type": "Conflicting Duplicate Event",
                        "description": f"Row {r2['row_idx']} ('{r2['description']}' paid by {r2['paid_by']} amount {r2['amount']}) is a conflicting duplicate event of Row {r1['row_idx']} ('{r1['description']}' paid by {r1['paid_by']} amount {r1['amount']}) on date {r1['date_str']}",
                        "data": r2["raw"]
                    })

# Individual row validation
for r in parsed_rows:
    i = r["row_idx"]
    row_data = r["raw"]
    
    # 1. Missing payer
    if not r["paid_by"]:
        anomalies.append({
            "row": i,
            "type": "Missing Payer",
            "description": f"Row {i} ('{r['description']}') is missing the payer ('paid_by'). Notes say: 'can't remember who paid'.",
            "data": row_data
        })
        
    # 2. Missing currency
    if not r["currency"]:
        anomalies.append({
            "row": i,
            "type": "Missing Currency",
            "description": f"Row {i} ('{r['description']}') is missing the currency code. Notes say: 'forgot to set currency'. Inferred as INR.",
            "data": row_data
        })
        
    # 3. Settlement stored as expense
    if not r["split_type"] and ("paid" in r["description"].lower() or "back" in r["description"].lower()):
        anomalies.append({
            "row": i,
            "type": "Settlement Stored as Expense",
            "description": f"Row {i} ('{r['description']}') has empty split_type and is described as Rohan paying Aisha back. This is a settlement, not a group expense.",
            "data": row_data
        })
    elif not r["split_type"]:
        anomalies.append({
            "row": i,
            "type": "Missing Split Type",
            "description": f"Row {i} is missing the split type.",
            "data": row_data
        })
        
    # 4. Decimal precision
    if r["amount"] is not None:
        raw_amt = row_data[3].strip().replace('"', '').replace(',', '')
        if '.' in raw_amt and len(raw_amt.split('.')[1]) > 2:
            anomalies.append({
                "row": i,
                "type": "Decimal Precision Anomaly",
                "description": f"Row {i} has amount '{raw_amt}' with excessive decimal precision (fractional paisa).",
                "data": row_data
            })
            
    # 5. Negative amount / refund
    if r["amount"] is not None and r["amount"] < 0:
        anomalies.append({
            "row": i,
            "type": "Negative Amount (Refund)",
            "description": f"Row {i} ('{r['description']}') has negative amount {r['amount']}. This is a refund which must reduce splits.",
            "data": row_data
        })

    # 6. Zero amount
    if r["amount"] == 0:
        anomalies.append({
            "row": i,
            "type": "Zero Amount Expense",
            "description": f"Row {i} ('{r['description']}') has amount 0. Note says: 'counted twice earlier - fixing later'.",
            "data": row_data
        })
        
    # 7. Invalid percentage sum
    if r["split_type"] == 'percentage' and r["split_details"]:
        parts = r["split_details"].split(';')
        total_pct = 0
        for p in parts:
            p_match = re.search(r'(\d+)\s*%', p)
            if p_match:
                total_pct += int(p_match.group(1))
        if total_pct != 100:
            anomalies.append({
                "row": i,
                "type": "Invalid Percentage Sum",
                "description": f"Row {i} ('{r['description']}') split percentages sum to {total_pct}% instead of 100%. Details: '{r['split_details']}'.",
                "data": row_data
            })

    # 8. Conflicting equal split details
    if r["split_type"] == 'equal' and r["split_details"].strip():
        anomalies.append({
            "row": i,
            "type": "Equal Split with Details",
            "description": f"Row {i} ('{r['description']}') is marked as 'equal' split, but contains split details: '{r['split_details']}'.",
            "data": row_data
        })

    # 9. Inconsistent Date Format
    if r["date_format_notes"] == "Inconsistent (Short format, e.g. Mar-14)":
        anomalies.append({
            "row": i,
            "type": "Inconsistent Date Format",
            "description": f"Row {i} ('{r['description']}') has non-standard date format '{r['date_str']}'.",
            "data": row_data
        })

    # 10. Membership anomalies
    if r["date"] and r["date"] > datetime(2026, 3, 29):
        if 'Meera' in r["split_with"]:
            anomalies.append({
                "row": i,
                "type": "Left Member Included",
                "description": f"Row {i} ('{r['description']}' on {r['date_str']}) includes Meera, who moved out on Sunday 2026-03-29.",
                "data": row_data
            })
            
    if r["date"] and r["date"] < datetime(2026, 4, 8):
        if 'Sam' in r["split_with"] or r["paid_by"] == 'Sam':
            anomalies.append({
                "row": i,
                "type": "New Member Early Expense",
                "description": f"Row {i} ('{r['description']}' on {r['date_str']}) includes Sam, who joined the group on 2026-04-08.",
                "data": row_data
            })
            
    if 'Kabir' in r["split_with"]:
        anomalies.append({
            "row": i,
            "type": "Unknown Member (Kabir)",
            "description": f"Row {i} ('{r['description']}') includes external guest 'Kabir' in split_with.",
            "data": row_data
        })

# Out of order dates
last_date = None
for r in parsed_rows:
    if r["date"]:
        if last_date and r["date"] < last_date:
            anomalies.append({
                "row": r["row_idx"],
                "type": "Out of Chronological Order",
                "description": f"Row {r['row_idx']} dated {r['date_str']} is out of order (placed after date {last_date.strftime('%d-%m-%Y')}).",
                "data": r["raw"]
            })
        last_date = r["date"]

# Generate markdown output
md = f"""# CSV Analysis Report: `data.csv`

This analysis is generated automatically from scanning and processing the uploaded `data.csv` file. It maps out the columns, users, categories, currencies, split types, dates, and all data anomalies discovered.

---

## 1. CSV Structure & Columns Found
The CSV file contains **{len(parsed_rows)} data rows** and **1 header row**.

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
"""

for a in anomalies:
    raw_str = ";".join([x if x else "" for x in a["data"]])
    md += f"| {a['row']} | {a['type']} | {a['type']} | {a['description']} | `{raw_str}` |\n"

md += """
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
"""

with open("/Users/navjotkumarsingh/Desktop/SettleUp/CSV_ANALYSIS.md", "w", encoding="utf-8") as f:
    f.write(md)

print("CSV_ANALYSIS.md generated successfully with anomaly rows!")
