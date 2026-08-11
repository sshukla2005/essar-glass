#!/usr/bin/env python3
"""
Teardown script for Essar Glass ERP Demo Data.

Removes all [DEMO] records in reverse dependency order:
payment_allocations -> payments -> invoices -> delivery_challans -> toughening_batches ->
workshop_orders -> sales_orders -> quotations -> crm_leads -> masters -> users.

Rules:
- Refuses to run unless DATABASE_URL points at localhost / 127.0.0.1
- Requires explicit --yes-i-mean-it CLI flag
- Reports deleted row counts per table
"""

import sys
import os
import argparse
from urllib.parse import urlparse

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from app.database import SessionLocal, engine
from app.config import settings
from app.models.payment_allocation import PaymentAllocation
from app.models.payment import Payment
from app.models.invoice import Invoice
from app.models.delivery import DeliveryChallan
from app.models.workshop import WorkshopOrder, TougheningBatch
from app.models.sales_order import SalesOrder
from app.models.quotation import Quotation
from app.models.crm import CRMLead
from app.models.customer import Customer
from app.models.vendor import Vendor
from app.models.product import Product
from app.models.employee import Employee
from app.models.user import User


def check_safety(require_flag=True):
    db_url = os.environ.get("DATABASE_URL") or settings.DATABASE_URL
    if not db_url:
        print("❌ FATAL: DATABASE_URL is not set.", file=sys.stderr)
        sys.exit(1)

    parsed = urlparse(db_url)
    hostname = parsed.hostname or ""
    if hostname not in ("localhost", "127.0.0.1"):
        print(f"❌ FATAL: Refusing to run. DATABASE_URL points to non-local host: {hostname}", file=sys.stderr)
        sys.exit(1)

    if require_flag:
        parser = argparse.ArgumentParser(description="Teardown DEMO data")
        parser.add_argument("--yes-i-mean-it", action="store_true", help="Explicit confirmation flag required to run teardown")
        args, _ = parser.parse_known_args()
        if not getattr(args, 'yes_i_mean_it', False) and "--yes-i-mean-it" not in sys.argv:
            print("❌ FATAL: Teardown aborted. Must pass --yes-i-mean-it flag to confirm execution.", file=sys.stderr)
            sys.exit(1)

    return db_url


def run_teardown(silent=False):
    db_url = check_safety(require_flag=False)

    if not silent:
        print("======================================================================")
        print("                ESSAR GLASS DEMO DATA TEARDOWN")
        print("======================================================================")
        print(f"Target Database: {db_url}")

    db = SessionLocal()
    counts = {}

    try:
        # 1. Identify Demo Customers, Vendors, Products, Employees, Users
        demo_cust_ids = [c.id for c in db.query(Customer).filter((Customer.name.like("DEMO %")) | (Customer.customer_code.like("CUST-DEMO%"))).all()]
        demo_vend_ids = [v.id for v in db.query(Vendor).filter((Vendor.name.like("DEMO %")) | (Vendor.vendor_code.like("VEND-DEMO%"))).all()]
        demo_user_ids = [u.id for u in db.query(User).filter((User.username.like("demo_%")) | (User.name.like("DEMO %"))).all()]

        # 2. Payment Allocations (delete allocations linked to demo payments or demo invoices)
        demo_pay_ids = [p.id for p in db.query(Payment).filter((Payment.notes.like("[DEMO]%")) | (Payment.payment_reference.like("DEMO%")) | (Payment.customer_id.in_(demo_cust_ids if demo_cust_ids else [-1]))).all()]
        demo_inv_ids = [i.id for i in db.query(Invoice).filter((Invoice.notes.like("[DEMO]%")) | (Invoice.customer_notes.like("[DEMO]%")) | (Invoice.customer_id.in_(demo_cust_ids if demo_cust_ids else [-1]))).all()]

        q_alloc = db.query(PaymentAllocation).filter(
            (PaymentAllocation.payment_id.in_(demo_pay_ids if demo_pay_ids else [-1])) |
            (PaymentAllocation.invoice_id.in_(demo_inv_ids if demo_inv_ids else [-1]))
        )
        counts["payment_allocations"] = q_alloc.delete(synchronize_session=False)

        # 3. Payments
        q_pay = db.query(Payment).filter(
            (Payment.notes.like("[DEMO]%")) |
            (Payment.payment_reference.like("DEMO%")) |
            (Payment.customer_id.in_(demo_cust_ids if demo_cust_ids else [-1]))
        )
        counts["payments"] = q_pay.delete(synchronize_session=False)

        # 4. Invoices
        q_inv = db.query(Invoice).filter(
            (Invoice.notes.like("[DEMO]%")) |
            (Invoice.customer_notes.like("[DEMO]%")) |
            (Invoice.customer_id.in_(demo_cust_ids if demo_cust_ids else [-1]))
        )
        counts["invoices"] = q_inv.delete(synchronize_session=False)

        # 5. Delivery Challans
        q_dc = db.query(DeliveryChallan).filter(
            (DeliveryChallan.driver_name.like("DEMO%")) |
            (DeliveryChallan.customer_id.in_(demo_cust_ids if demo_cust_ids else [-1]))
        )
        counts["delivery_challans"] = q_dc.delete(synchronize_session=False)

        # 6. Toughening Batches
        q_tb = db.query(TougheningBatch).filter(
            (TougheningBatch.vendor_name.like("DEMO%")) |
            (TougheningBatch.vendor_id.in_(demo_vend_ids if demo_vend_ids else [-1]))
        )
        counts["toughening_batches"] = q_tb.delete(synchronize_session=False)

        # 7. Workshop Orders
        q_wo = db.query(WorkshopOrder).filter(
            (WorkshopOrder.customer_name.like("DEMO%")) |
            (WorkshopOrder.customer_id.in_(demo_cust_ids if demo_cust_ids else [-1])) |
            (WorkshopOrder.instructions.like("[DEMO]%"))
        )
        counts["workshop_orders"] = q_wo.delete(synchronize_session=False)

        # 8. Sales Orders
        q_so = db.query(SalesOrder).filter(
            (SalesOrder.notes.like("[DEMO]%")) |
            (SalesOrder.internal_notes.like("[DEMO]%")) |
            (SalesOrder.customer_note.like("[DEMO]%")) |
            (SalesOrder.customer_id.in_(demo_cust_ids if demo_cust_ids else [-1]))
        )
        counts["sales_orders"] = q_so.delete(synchronize_session=False)

        # 9. Quotations
        q_qt = db.query(Quotation).filter(
            (Quotation.customer_notes.like("[DEMO]%")) |
            (Quotation.internal_notes.like("[DEMO]%")) |
            (Quotation.customer_id.in_(demo_cust_ids if demo_cust_ids else [-1]))
        )
        counts["quotations"] = q_qt.delete(synchronize_session=False)

        # 10. CRM Leads
        q_lead = db.query(CRMLead).filter(
            (CRMLead.name.like("[DEMO]%")) |
            (CRMLead.name.like("DEMO%")) |
            (CRMLead.company_name.like("DEMO%")) |
            (CRMLead.customer_id.in_(demo_cust_ids if demo_cust_ids else [-1]))
        )
        counts["crm_leads"] = q_lead.delete(synchronize_session=False)

        # 11. Master Records
        counts["customers"] = db.query(Customer).filter((Customer.name.like("DEMO %")) | (Customer.customer_code.like("CUST-DEMO%"))).delete(synchronize_session=False)
        counts["vendors"] = db.query(Vendor).filter((Vendor.name.like("DEMO %")) | (Vendor.vendor_code.like("VEND-DEMO%"))).delete(synchronize_session=False)
        counts["products"] = db.query(Product).filter((Product.name.like("DEMO %")) | (Product.internal_ref.like("PROD-DEMO%"))).delete(synchronize_session=False)
        counts["employees"] = db.query(Employee).filter((Employee.name.like("DEMO %")) | (Employee.employee_code.like("EMP-DEMO%"))).delete(synchronize_session=False)

        # 12. Users
        counts["users"] = db.query(User).filter((User.username.like("demo_%")) | (User.name.like("DEMO %"))).delete(synchronize_session=False)

        db.commit()

        if not silent:
            print("Purged Records Summary (Reverse Dependency Order):")
            for table, count in counts.items():
                print(f"  - {table:<22}: {count} rows deleted")
            print("----------------------------------------------------------------------")
            print("✅ Teardown complete. All [DEMO] records removed successfully.")
            print("======================================================================")

        return counts

    except Exception as e:
        db.rollback()
        print(f"❌ ERROR during teardown: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    check_safety(require_flag=True)
    run_teardown()
