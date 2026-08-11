"""Migrate invoice advance_received into real payments

Revision ID: h4i5j6k7l8m9
Revises: g3h4i5j6k7l8
Create Date: 2026-08-11

Phase 2A — C4 Option 1 Migration
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'h4i5j6k7l8m9'
down_revision = 'g3h4i5j6k7l8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Query active invoices with advance_received > 0
    invoices = conn.execute(text("""
        SELECT id, invoice_number, customer_id, company_id, advance_received,
               invoice_date, created_at, total_amount, amount_paid, balance_due
        FROM invoices
        WHERE is_active = true AND advance_received > 0
        ORDER BY id
    """)).fetchall()

    if not invoices:
        print("\nNo invoices with advance_received > 0 found. Skipping payment migration.")
        return

    # Track sequence per company for generating unique payment numbers
    max_seq_map = {}
    existing_payments = conn.execute(text("""
        SELECT company_id, payment_number
        FROM payments
        WHERE payment_number IS NOT NULL
    """)).fetchall()

    for cid, pnum in existing_payments:
        pnum_str = str(pnum or "").strip()
        if pnum_str.startswith("PAY"):
            digits = "".join(ch for ch in pnum_str[3:] if ch.isdigit())
            if digits:
                max_seq_map[cid] = max(max_seq_map.get(cid, 0), int(digits))

    before_map = {}
    for row in invoices:
        inv_id, inv_num, cust_id, comp_id, adv_amt, inv_date, created_at, tot_amt, old_paid, old_due = row
        before_map[inv_id] = {
            "invoice_number": inv_num,
            "company_id": comp_id,
            "advance_received": float(adv_amt or 0),
            "old_paid": float(old_paid or 0),
            "old_due": float(old_due or 0),
        }

    print("\n" + "=" * 75)
    print("MIGRATING INVOICE ADVANCE_RECEIVED TO PAYMENTS & ALLOCATIONS")
    print("=" * 75)
    print(f"{'Company':<8} | {'Invoice No':<12} | {'Advance':<10} | {'Old Paid':<10} | {'New Paid':<10} | {'Old Due':<10} | {'New Due':<10}")
    print("-" * 75)

    for row in invoices:
        inv_id = row[0]
        inv_num = row[1]
        cust_id = row[2]
        comp_id = row[3]
        adv_amt = float(row[4] or 0)
        inv_date = row[5]
        created_at = row[6]
        tot_amt = float(row[7] or 0)

        # Payment date fallback
        pay_date = inv_date if inv_date else (str(created_at)[:10] if created_at else "2026-08-11")

        # Next payment number per company
        seq = max_seq_map.get(comp_id, 0) + 1
        max_seq_map[comp_id] = seq
        pay_number = f"PAY{str(seq).zfill(4)}"

        notes_str = f"Migrated advance payment from invoice {inv_num}"

        # Insert Payment
        res = conn.execute(text("""
            INSERT INTO payments (
                payment_number, customer_id, company_id, amount, payment_mode,
                payment_date, notes, is_active, created_at, updated_at
            ) VALUES (
                :pay_number, :cust_id, :comp_id, :amount, 'advance',
                :pay_date, :notes, true, NOW(), NOW()
            ) RETURNING id
        """), {
            "pay_number": pay_number,
            "cust_id": cust_id,
            "comp_id": comp_id,
            "amount": adv_amt,
            "pay_date": pay_date,
            "notes": notes_str,
        })
        pay_id = res.fetchone()[0]

        # Insert PaymentAllocation
        conn.execute(text("""
            INSERT INTO payment_allocations (
                payment_id, invoice_id, amount, company_id, is_active, created_at, updated_at
            ) VALUES (
                :pay_id, :inv_id, :amount, :comp_id, true, NOW(), NOW()
            )
        """), {
            "pay_id": pay_id,
            "inv_id": inv_id,
            "amount": adv_amt,
            "comp_id": comp_id,
        })

    # Recompute invoice amount_paid, balance_due, and status from active allocations
    conn.execute(text("""
        UPDATE invoices
        SET amount_paid = COALESCE(sub.alloc_sum, 0),
            balance_due = COALESCE(invoices.total_amount, 0) - COALESCE(sub.alloc_sum, 0),
            status = CASE
                WHEN (COALESCE(invoices.total_amount, 0) - COALESCE(sub.alloc_sum, 0)) <= 0 THEN 'paid'
                WHEN COALESCE(sub.alloc_sum, 0) > 0 THEN 'partially_paid'
                ELSE 'unpaid'
            END
        FROM (
            SELECT invoice_id, SUM(amount) AS alloc_sum
            FROM payment_allocations
            WHERE is_active = true
            GROUP BY invoice_id
        ) sub
        WHERE invoices.id = sub.invoice_id
          AND invoices.is_active = true
          AND invoices.advance_received > 0
    """))

    # Fetch updated state for printout
    updated_invoices = conn.execute(text("""
        SELECT id, invoice_number, company_id, advance_received, amount_paid, balance_due
        FROM invoices
        WHERE is_active = true AND advance_received > 0
        ORDER BY id
    """)).fetchall()

    for row in updated_invoices:
        inv_id, inv_num, comp_id, adv_amt, new_paid, new_due = row[0], row[1], row[2], float(row[3] or 0), float(row[4] or 0), float(row[5] or 0)
        old_info = before_map.get(inv_id, {})
        old_p = old_info.get("old_paid", 0)
        old_d = old_info.get("old_due", 0)
        print(f"C{comp_id:<7} | {inv_num:<12} | ₹{adv_amt:<9,.2f} | ₹{old_p:<9,.2f} | ₹{new_paid:<9,.2f} | ₹{old_d:<9,.2f} | ₹{new_due:<9,.2f}")

    print("=" * 75 + "\n")


def downgrade() -> None:
    conn = op.get_bind()

    # Find migrated payments
    migrated_payments = conn.execute(text("""
        SELECT id FROM payments
        WHERE payment_mode = 'advance'
          AND notes LIKE 'Migrated advance payment from invoice%'
    """)).fetchall()

    if migrated_payments:
        pay_ids = [p[0] for p in migrated_payments]

        # Delete allocations for migrated payments
        conn.execute(text("""
            DELETE FROM payment_allocations
            WHERE payment_id = ANY(:pay_ids)
        """), {"pay_ids": pay_ids})

        # Delete migrated payments
        conn.execute(text("""
            DELETE FROM payments
            WHERE id = ANY(:pay_ids)
        """), {"pay_ids": pay_ids})

        # Recompute invoice amount_paid, balance_due, and status
        conn.execute(text("""
            UPDATE invoices
            SET amount_paid = COALESCE(sub.alloc_sum, 0),
                balance_due = COALESCE(invoices.total_amount, 0) - COALESCE(sub.alloc_sum, 0),
                status = CASE
                    WHEN (COALESCE(invoices.total_amount, 0) - COALESCE(sub.alloc_sum, 0)) <= 0 THEN 'paid'
                    WHEN COALESCE(sub.alloc_sum, 0) > 0 THEN 'partially_paid'
                    ELSE 'unpaid'
                END
            FROM (
                SELECT invoice_id, SUM(amount) AS alloc_sum
                FROM payment_allocations
                WHERE is_active = true
                GROUP BY invoice_id
            ) sub
            WHERE invoices.id = sub.invoice_id
              AND invoices.is_active = true
        """))

        conn.execute(text("""
            UPDATE invoices
            SET amount_paid = 0,
                balance_due = COALESCE(total_amount, 0),
                status = 'unpaid'
            WHERE is_active = true
              AND id NOT IN (
                  SELECT DISTINCT invoice_id
                  FROM payment_allocations
                  WHERE is_active = true
              )
        """))
