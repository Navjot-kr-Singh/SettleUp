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
anomalies = []

# Helper to normalize username
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

for i, row in enumerate(rows, start=2):
    if not row or len(row) < len(header):
        anomalies.append({
            "row": i,
            "type": "Malformed Row",
            "description": "Blank or malformed row",
            "data": row
        })
        continue
    
    date_str, desc, paid_by, amount_str, currency, split_type, split_with, split_details, notes = row
    
    # 1. Parse date
    parsed_date = None
    date_err = False
    try:
        parsed_date = datetime.strptime(date_str.strip(), "%d-%m-%Y")
    except ValueError:
        try:
            parsed_date = datetime.strptime(date_str.strip() + "-2026", "%b-%d-%Y")
            anomalies.append({
                "row": i,
                "type": "Inconsistent Date Format",
                "description": f"Short date format '{date_str}' in row {i}, parsed as {parsed_date.strftime('%Y-%m-%d')}",
                "data": row
            })
        except ValueError:
            date_err = True
            anomalies.append({
                "row": i,
                "type": "Invalid Date",
                "description": f"Invalid date '{date_str}' in row {i}",
                "data": row
            })

    # 2. Parse amount
    amount = None
    try:
        clean_amount = amount_str.replace('"', '').replace(',', '').strip()
        amount = float(clean_amount)
    except ValueError:
        anomalies.append({
            "row": i,
            "type": "Invalid Amount",
            "description": f"Cannot parse amount '{amount_str}' in row {i}",
            "data": row
        })

    # 3. Payer
    payer = normalize_user(paid_by)
    if payer:
        users.add(payer)

    # 4. Currency
    curr = currency.strip().upper()
    if curr:
        currencies.add(curr)
    
    # 5. Split type
    st = split_type.strip()
    if st:
        split_types.add(st)
        
    # 6. Split with
    sw = [normalize_user(u) for u in split_with.split(';') if u.strip()]
    for u in sw:
        users.add(u)

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
        "raw": row
    })

# Now perform comparative anomalies checks

# Check chronological order
last_date = None
for r in parsed_rows:
    if r["date"]:
        if last_date and r["date"] < last_date:
            anomalies.append({
                "row": r["row_idx"],
                "type": "Out of Chronological Order",
                "description": f"Row {r['row_idx']} date {r['date_str']} is out of order (previous date was {last_date.strftime('%d-%m-%Y')})",
                "data": r["raw"]
            })
        last_date = r["date"]

# Check duplicate candidates: same date, same amount, similar names or description
# We will check all pairs
for idx1 in range(len(parsed_rows)):
    for idx2 in range(idx1 + 1, len(parsed_rows)):
        r1 = parsed_rows[idx1]
        r2 = parsed_rows[idx2]
        
        # Exact duplicate / near duplicate
        # Same date, same amount
        if r1["date"] and r2["date"] and r1["date"] == r2["date"] and r1["amount"] == r2["amount"]:
            # If paid by same person
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
                
        # Conflicting duplicates with slightly different amounts but same description keyword (e.g. Thalassa dinner)
        if r1["date"] and r2["date"] and r1["date"] == r2["date"]:
            words1 = set(r1["description"].lower().split())
            words2 = set(r2["description"].lower().split())
            common = words1.intersection(words2)
            if any(w in ['thalassa', 'marina', 'bites', 'parasailing', 'cab'] for w in common) and r1["row_idx"] != r2["row_idx"]:
                # If they were not caught by same amount check
                if r1["amount"] != r2["amount"]:
                    anomalies.append({
                        "row": r2["row_idx"],
                        "type": "Conflicting Duplicate Event",
                        "description": f"Row {r2['row_idx']} ('{r2['description']}' paid by {r2['paid_by']} amount {r2['amount']}) is a conflicting duplicate event of Row {r1['row_idx']} ('{r1['description']}' paid by {r1['paid_by']} amount {r1['amount']}) on date {r1['date_str']}",
                        "data": r2["raw"]
                    })

# Checking standard validation rules on each row
for r in parsed_rows:
    i = r["row_idx"]
    desc = r["description"]
    payer = r["paid_by"]
    amount = r["amount"]
    curr = r["currency"]
    split_type = r["split_type"]
    split_with = r["split_with"]
    split_details = r["split_details"]
    notes = r["notes"]
    
    # 1. Missing Payer
    if not payer:
        anomalies.append({
            "row": i,
            "type": "Missing Payer",
            "description": f"Row {i} is missing 'paid_by'",
            "data": r["raw"]
        })
        
    # 2. Missing Currency
    if not curr:
        anomalies.append({
            "row": i,
            "type": "Missing Currency",
            "description": f"Row {i} is missing 'currency'",
            "data": r["raw"]
        })
        
    # 3. Missing Split Type / Settlement candidate
    if not split_type:
        if "paid" in desc.lower() or "settle" in desc.lower() or "back" in desc.lower():
            anomalies.append({
                "row": i,
                "type": "Settlement Stored as Expense",
                "description": f"Row {i} ('{desc}') has empty split_type and appears to be a settlement rather than an expense",
                "data": r["raw"]
            })
        else:
            anomalies.append({
                "row": i,
                "type": "Missing Split Type",
                "description": f"Row {i} is missing 'split_type'",
                "data": r["raw"]
            })
            
    # 4. Negative Amount / Refund
    if amount is not None and amount < 0:
        anomalies.append({
            "row": i,
            "type": "Negative Amount (Refund)",
            "description": f"Row {i} ('{desc}') has a negative amount {amount} representing a refund",
            "data": r["raw"]
        })
        
    # 5. Zero Amount
    if amount == 0:
        anomalies.append({
            "row": i,
            "type": "Zero Amount",
            "description": f"Row {i} ('{desc}') has a zero amount",
            "data": r["raw"]
        })
        
    # 6. Precision anomaly
    if amount is not None and str(amount).split('.')[-1] and len(str(amount).split('.')[-1]) > 2:
        # Check raw amount string
        raw_amt = r["raw"][3].strip().replace('"', '').replace(',', '')
        if '.' in raw_amt and len(raw_amt.split('.')[1]) > 2:
            anomalies.append({
                "row": i,
                "type": "Decimal Precision Anomaly",
                "description": f"Row {i} has fractional paisa amount '{raw_amt}'",
                "data": r["raw"]
            })

    # 7. Split percentage check
    if split_type == 'percentage':
        parts = split_details.split(';')
        total_pct = 0
        for p in parts:
            p_match = re.search(r'(\d+)\s*%', p)
            if p_match:
                total_pct += int(p_match.group(1))
        if total_pct != 100:
            anomalies.append({
                "row": i,
                "type": "Invalid Percentage Sum",
                "description": f"Row {i} ('{desc}') has percentages sum of {total_pct}% (expected 100%)",
                "data": r["raw"]
            })
            
    # 8. Split share check vs equal
    if split_type == 'equal' and split_details.strip():
        anomalies.append({
            "row": i,
            "type": "Equal Split with Details",
            "description": f"Row {i} ('{desc}') split_type is 'equal' but split_details is not empty: '{split_details}'",
            "data": r["raw"]
        })

    # 9. Membership consistency checks
    # Meera leaves on Sunday March 28 or March 29 (Farewell dinner is Sunday 28-03-2026, notes say Meera moving out Sunday).
    # If date of expense > 2026-03-29 and Meera is in split_with
    if r["date"] and r["date"] > datetime(2026, 3, 29):
        if 'Meera' in split_with:
            anomalies.append({
                "row": i,
                "type": "Membership Inconsistency (Left Member Included)",
                "description": f"Row {i} ('{desc}' dated {r['date_str']}) includes Meera, who moved out on 2026-03-29",
                "data": r["raw"]
            })
            
    # Sam joins April 8 (Sam deposit share is 08-04-2026, notes say Sam moving in!).
    # If date of expense < 2026-04-08 and Sam is in split_with/paid_by
    if r["date"] and r["date"] < datetime(2026, 4, 8):
        if 'Sam' in split_with or payer == 'Sam':
            anomalies.append({
                "row": i,
                "type": "Membership Inconsistency (New Member Early Expense)",
                "description": f"Row {i} ('{desc}' dated {r['date_str']}) includes Sam, who joined the group on 2026-04-08",
                "data": r["raw"]
            })

    # Unknown member "Dev's friend Kabir" or "Kabir" in group split_with
    if 'Kabir' in split_with:
        anomalies.append({
            "row": i,
            "type": "Unknown Member (Kabir)",
            "description": f"Row {i} ('{desc}') includes Kabir in split_with, who is not in the regular group membership",
            "data": r["raw"]
        })

print(f"Total anomalies: {len(anomalies)}")
for a in anomalies:
    print(f"Row {a['row']} [{a['type']}]: {a['description']}")
