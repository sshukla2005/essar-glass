import json
import psycopg2
from psycopg2.extras import RealDictCursor

import os

def run_verification():
    conn = psycopg2.connect('postgresql://essar:essar_local@localhost:5433/essar_glass')
    cur = conn.cursor(cursor_factory=RealDictCursor)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    baseline_path = os.path.join(base_dir, 'PHASE1-baseline.json')
    after_path = os.path.join(base_dir, 'PHASE1-after.json')

    with open(baseline_path) as f:
        baseline = json.load(f)

    after = {"quotations": [], "sales_orders": []}

    # Fetch Quotations
    q_ids = [q["id"] for q in baseline["quotations"]]
    for qid in q_ids:
        cur.execute("""
            SELECT q.id, q.quote_number, q.subtotal, q.cgst, q.sgst, q.igst,
                   q.total_amount, q.balance_due, q.totals, q.lines
            FROM quotations q WHERE q.id = %s
        """, (qid,))
        row = cur.fetchone()
        if row:
            totals_dict = row["totals"] if isinstance(row["totals"], dict) else json.loads(row["totals"]) if row["totals"] else None
            lines_data = row["lines"] if isinstance(row["lines"], list) else json.loads(row["lines"]) if row["lines"] else []
            cgst = float(row["cgst"]) if row["cgst"] is not None else 0.0
            sgst = float(row["sgst"]) if row["sgst"] is not None else 0.0
            igst = float(row["igst"]) if row["igst"] is not None else 0.0
            margin_amt = float(totals_dict["marginAmt"]) if (totals_dict and totals_dict.get("marginAmt") is not None) else None
            margin_pct = float(totals_dict["marginPct"]) if (totals_dict and totals_dict.get("marginPct") is not None) else None
            after["quotations"].append({
                "id": row["id"],
                "quote_number": row["quote_number"],
                "subtotal": float(row["subtotal"]) if row["subtotal"] is not None else 0.0,
                "cgst": cgst,
                "sgst": sgst,
                "igst": igst,
                "tax_amount": cgst + sgst + igst,
                "total_amount": float(row["total_amount"]) if row["total_amount"] is not None else 0.0,
                "balance_due": float(row["balance_due"]) if row["balance_due"] is not None else 0.0,
                "margin_amount": margin_amt,
                "margin_pct": margin_pct,
                "totals_dict": totals_dict,
                "lines_count": len(lines_data)
            })

    # Fetch Sales Orders
    so_ids = [s["id"] for s in baseline["sales_orders"]]
    for soid in so_ids:
        cur.execute("""
            SELECT s.id, s.so_number, s.subtotal, s.tax_amount, s.total_amount,
                   s.totals, s.lines
            FROM sales_orders s WHERE s.id = %s
        """, (soid,))
        row = cur.fetchone()
        if row:
            totals_dict = row["totals"] if isinstance(row["totals"], dict) else json.loads(row["totals"]) if row["totals"] else None
            lines_data = row["lines"] if isinstance(row["lines"], list) else json.loads(row["lines"]) if row["lines"] else []
            tot_amt = float(row["total_amount"]) if row["total_amount"] is not None else 0.0
            margin_amt = float(totals_dict["marginAmt"]) if (totals_dict and totals_dict.get("marginAmt") is not None) else None
            margin_pct = float(totals_dict["marginPct"]) if (totals_dict and totals_dict.get("marginPct") is not None) else None
            after["sales_orders"].append({
                "id": row["id"],
                "so_number": row["so_number"],
                "subtotal": float(row["subtotal"]) if row["subtotal"] is not None else 0.0,
                "tax_amount": float(row["tax_amount"]) if row["tax_amount"] is not None else 0.0,
                "total_amount": tot_amt,
                "balance_due": tot_amt,
                "margin_amount": margin_amt,
                "margin_pct": margin_pct,
                "totals_dict": totals_dict,
                "lines_count": len(lines_data)
            })

    with open(after_path, 'w') as f:
        json.dump(after, f, indent=2)

    diffs = []
    check_fields = ["subtotal", "total_amount", "balance_due", "margin_amount", "margin_pct", "lines_count"]
    # Compare key fields
    for b_q, a_q in zip(baseline["quotations"], after["quotations"]):
        for k in check_fields:
            if b_q.get(k) != a_q.get(k):
                diffs.append(f"Quotation {b_q['id']} ({b_q['quote_number']}) field '{k}': baseline {b_q.get(k)} vs after {a_q.get(k)}")

    for b_so, a_so in zip(baseline["sales_orders"], after["sales_orders"]):
        for k in check_fields:
            if b_so.get(k) != a_so.get(k):
                diffs.append(f"SalesOrder {b_so['id']} ({b_so['so_number']}) field '{k}': baseline {b_so.get(k)} vs after {a_so.get(k)}")

    print("=" * 70)
    print("      PHASE 1 FINANCIAL INVARIANCE REPORT (WITH MARGINS)")
    print("=" * 70)
    if not diffs:
        print("✅ SUCCESS: 100% INVARIANCE CONFIRMED — 0 FINANCIAL / MARGIN DIFFS DETECTED!")
    else:
        print(f"❌ FAILED: {len(diffs)} DIFFS DETECTED:")
        for d in diffs:
            print("   -", d)
    print("=" * 70)

if __name__ == "__main__":
    run_verification()
