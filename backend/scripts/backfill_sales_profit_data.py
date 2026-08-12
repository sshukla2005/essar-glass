import os
import sys

# Add parent dir to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models.sales_order import SalesOrder
from app.models.quotation import Quotation
from app.utils.helpers import compute_profit_fields

def run_backfill():
    db = SessionLocal()
    try:
        print("Starting backfill for active SalesOrders and Quotations...")

        # Sales Orders
        sos = db.query(SalesOrder).filter(SalesOrder.is_active == True).all()
        so_processed = 0
        so_null = 0
        so_zero_cost = 0

        for so in sos:
            tot_cost, prof_amt, prof_pct = compute_profit_fields(so)
            so.total_cost = tot_cost
            so.profit_amount = prof_amt
            so.profit_percent = prof_pct

            if tot_cost is not None and tot_cost > 0:
                so_processed += 1
            else:
                so_null += 1
                if tot_cost == 0:
                    so_zero_cost += 1

        # Quotations
        quotes = db.query(Quotation).filter(Quotation.is_active == True).all()
        q_processed = 0
        q_null = 0
        q_zero_cost = 0

        for q in quotes:
            tot_cost, prof_amt, prof_pct = compute_profit_fields(q)
            q.total_cost = tot_cost
            q.profit_amount = prof_amt
            q.profit_percent = prof_pct

            if tot_cost is not None and tot_cost > 0:
                q_processed += 1
            else:
                q_null += 1
                if tot_cost == 0:
                    q_zero_cost += 1

        db.commit()

        print("\n=== Backfill Summary Report ===")
        print(f"Sales Orders total active: {len(sos)}")
        print(f"  - Filled (total_cost > 0): {so_processed}")
        print(f"  - NULL / Incomplete cost:  {so_null} (zero cost count: {so_zero_cost})")

        print(f"\nQuotations total active: {len(quotes)}")
        print(f"  - Filled (total_cost > 0): {q_processed}")
        print(f"  - NULL / Incomplete cost:  {q_null} (zero cost count: {q_zero_cost})")

    except Exception as e:
        db.rollback()
        print(f"Backfill failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    run_backfill()
