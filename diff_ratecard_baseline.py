import json
import psycopg2
from psycopg2.extras import RealDictCursor

def verify_baseline():
    conn = psycopg2.connect('postgresql://essar:essar_local@localhost:5433/essar_glass')
    cur = conn.cursor(cursor_factory=RealDictCursor)

    with open('RATECARD-baseline.json') as f:
        baseline = json.load(f)

    all_matched = True
    print("=" * 70)
    print("      PROCESS RATE CARD ZERO-DIFF VERIFICATION REPORT")
    print("=" * 70)

    for key, b_data in baseline.items():
        doc_type = b_data['type']
        doc_id = b_data['id']
        table = 'quotations' if doc_type == 'quotation' else 'sales_orders'
        num_col = 'quote_number' if doc_type == 'quotation' else 'so_number'
        
        cur.execute(f'SELECT id, {num_col} as number, totals, total_amount, subtotal, process_rate_card FROM {table} WHERE id = %s', (doc_id,))
        row = cur.fetchone()
        if not row:
            print(f'❌ MISMATCH/MISSING: {key} not found in database')
            all_matched = False
            continue
        
        db_totals = row['totals'] or {}
        
        b_gt = float(b_data['grand_total'])
        b_pc = float(b_data['process_charges'])
        
        db_gt = float(db_totals.get('grandTotal', row['total_amount'] or 0))
        db_pc = float(db_totals.get('procTotal', 0))
        
        diff_gt = abs(b_gt - db_gt)
        diff_pc = abs(b_pc - db_pc)
        
        if diff_gt > 0.05 or diff_pc > 0.05:
            print(f'❌ DIFF IN {key} ({row["number"]}):')
            print(f'   Grand Total     : Baseline ₹{b_gt:.2f} vs Current ₹{db_gt:.2f} (diff: ₹{diff_gt:.2f})')
            print(f'   Process Charges : Baseline ₹{b_pc:.2f} vs Current ₹{db_pc:.2f} (diff: ₹{diff_pc:.2f})')
            all_matched = False
        else:
            print(f'✅ MATCH {key} ({row["number"]}): Grand Total ₹{db_gt:.2f}, Process Charges ₹{db_pc:.2f}')

    print("-" * 70)
    if all_matched:
        print("RESULT: SUCCESS - ZERO-CHANGE TO ALL EXISTING SAVED DOCUMENTS!")
    else:
        print("RESULT: FAILED - DIFFERENCES DETECTED!")
    print("=" * 70)

if __name__ == '__main__':
    verify_baseline()
