#!/usr/bin/env python3
"""
Script to recompute stock across all products in all companies.
Purges seeded fiction and updates on_hand_qty from real StockMovements.
Prints a before/after audit breakdown per company.
"""
import sys
import os

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models.product import Product
from app.models.company import Company
from app.services.stock_service import recompute_stock

def main():
    db = SessionLocal()
    try:
        print("\n" + "=" * 90)
        print("PHASE 3A INVENTORY RECOMPUTATION — PURGING SEEDED FICTION")
        print("=" * 90)

        companies = db.query(Company).all()
        comp_map = {c.id: c.name for c in companies}
        comp_map[None] = "Unassigned"

        products = db.query(Product).order_by(Product.company_id, Product.id).all()

        before_after_records = []
        for p in products:
            before_qty = float(p.on_hand_qty or 0.0)
            after_qty = recompute_stock(db, p.id, p.company_id)
            before_after_records.append({
                "company_id": p.company_id,
                "company_name": comp_map.get(p.company_id, f"Company #{p.company_id}"),
                "product_id": p.id,
                "name": p.name,
                "ref": p.internal_ref or "—",
                "uom": p.stock_uom or ("sheet" if p.glass_type else "nos"),
                "before": before_qty,
                "after": after_qty,
            })

        db.commit()

        # Group by company
        by_company = {}
        for rec in before_after_records:
            cname = rec["company_name"]
            if cname not in by_company:
                by_company[cname] = []
            by_company[cname].append(rec)

        for cname, items in by_company.items():
            print(f"\nCompany: {cname}")
            print(f"{'ID':<6} | {'SKU/Ref':<12} | {'Product Name':<35} | {'UoM':<8} | {'Before Qty':<12} | {'After Qty':<12}")
            print("-" * 95)
            for it in items:
                print(f"{it['product_id']:<6} | {it['ref']:<12} | {it['name'][:35]:<35} | {it['uom']:<8} | {it['before']:<12.2f} | {it['after']:<12.2f}")

        print("\n" + "=" * 90)
        print(f"TOTAL PRODUCTS RECOMPUTED: {len(products)}")
        print("=" * 90 + "\n")

    finally:
        db.close()

if __name__ == "__main__":
    main()
