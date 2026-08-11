"""Add payment_allocations table and backfill from existing payments

Revision ID: g3h4i5j6k7l8
Revises: f2b3c4d5e6f7
Create Date: 2026-08-11

Phase 2A — T1
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'g3h4i5j6k7l8'
down_revision = 'f2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Step 1: Create payment_allocations table ─────────────────────────
    op.create_table(
        'payment_allocations',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('payment_id', sa.Integer(),
                  sa.ForeignKey('payments.id', ondelete='RESTRICT'),
                  nullable=False, index=True),
        sa.Column('invoice_id', sa.Integer(),
                  sa.ForeignKey('invoices.id'),
                  nullable=False, index=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('company_id', sa.Integer(),
                  sa.ForeignKey('companies.id'),
                  nullable=True, index=True),
        sa.Column('is_active', sa.Boolean(), nullable=False,
                  server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('payment_id', 'invoice_id',
                            name='uq_allocation_payment_invoice_active'),
    )

    # ── Step 2: Conservative backfill ────────────────────────────────────
    #
    # For each active payment that has so_id set:
    #   - Find active invoices sharing that so_id
    #   - If exactly ONE invoice matches, create an allocation for
    #     min(payment.amount, invoice.total_amount - already_allocated)
    #   - Otherwise leave unallocated (on-account)
    #
    # We do NOT FIFO-guess across a customer's invoices — that is a
    # bookkeeping decision, not a migration decision.

    conn = op.get_bind()

    # Fetch all active payments
    payments = conn.execute(text("""
        SELECT id, so_id, amount, company_id, customer_id
        FROM payments
        WHERE is_active = true
        ORDER BY id
    """)).fetchall()

    total_payments = len(payments)
    count_allocated = 0
    count_on_account = 0
    total_on_account_value = 0.0

    for pay in payments:
        pay_id, so_id, pay_amount, company_id, customer_id = pay

        if so_id is None or pay_amount is None or pay_amount <= 0:
            count_on_account += 1
            total_on_account_value += (pay_amount or 0)
            continue

        # Find active invoices sharing this so_id
        invoices = conn.execute(text("""
            SELECT id, total_amount
            FROM invoices
            WHERE so_id = :so_id AND is_active = true
        """), {"so_id": so_id}).fetchall()

        if len(invoices) != 1:
            # Zero or multiple invoices for this SO — don't guess
            count_on_account += 1
            total_on_account_value += pay_amount
            continue

        inv_id, inv_total = invoices[0]
        inv_total = inv_total or 0

        # Check how much is already allocated to this invoice
        already = conn.execute(text("""
            SELECT COALESCE(SUM(amount), 0)
            FROM payment_allocations
            WHERE invoice_id = :inv_id AND is_active = true
        """), {"inv_id": inv_id}).scalar()

        remaining_on_invoice = max(0, inv_total - already)
        alloc_amount = min(pay_amount, remaining_on_invoice)

        if alloc_amount > 0:
            conn.execute(text("""
                INSERT INTO payment_allocations
                    (payment_id, invoice_id, amount, company_id, is_active)
                VALUES
                    (:pay_id, :inv_id, :amount, :company_id, true)
            """), {
                "pay_id": pay_id,
                "inv_id": inv_id,
                "amount": alloc_amount,
                "company_id": company_id,
            })
            count_allocated += 1
            unallocated = pay_amount - alloc_amount
            if unallocated > 0:
                total_on_account_value += unallocated
        else:
            count_on_account += 1
            total_on_account_value += pay_amount

    # ── Step 3: Recompute invoice amount_paid and balance_due ────────────
    # Snapshot BEFORE for reporting
    before_snapshot = conn.execute(text("""
        SELECT id, invoice_number, amount_paid, balance_due, total_amount
        FROM invoices
        WHERE is_active = true
        ORDER BY id
    """)).fetchall()

    before_map = {}
    before_sum_paid = 0.0
    for row in before_snapshot:
        inv_id, inv_num, old_paid, old_bal, total = row
        before_map[inv_id] = {
            "invoice_number": inv_num,
            "old_paid": old_paid or 0,
            "old_balance": old_bal or 0,
            "total": total or 0,
        }
        before_sum_paid += (old_paid or 0)

    # Update every active invoice's amount_paid from allocations
    conn.execute(text("""
        UPDATE invoices
        SET amount_paid = COALESCE(sub.alloc_sum, 0),
            balance_due = COALESCE(invoices.total_amount, 0) - COALESCE(sub.alloc_sum, 0)
        FROM (
            SELECT invoice_id, SUM(amount) AS alloc_sum
            FROM payment_allocations
            WHERE is_active = true
            GROUP BY invoice_id
        ) sub
        WHERE invoices.id = sub.invoice_id
          AND invoices.is_active = true
    """))

    # Also reset invoices with NO allocations to 0 paid
    conn.execute(text("""
        UPDATE invoices
        SET amount_paid = 0,
            balance_due = COALESCE(total_amount, 0)
        WHERE is_active = true
          AND id NOT IN (
              SELECT DISTINCT invoice_id
              FROM payment_allocations
              WHERE is_active = true
          )
    """))

    # ── Step 4: Report ───────────────────────────────────────────────────
    after_snapshot = conn.execute(text("""
        SELECT id, invoice_number, amount_paid, balance_due, total_amount
        FROM invoices
        WHERE is_active = true
        ORDER BY id
    """)).fetchall()

    changed_count = 0
    after_sum_paid = 0.0
    for row in after_snapshot:
        inv_id, inv_num, new_paid, new_bal, total = row
        after_sum_paid += (new_paid or 0)
        old = before_map.get(inv_id, {})
        if abs((old.get("old_paid", 0) or 0) - (new_paid or 0)) > 0.001:
            changed_count += 1
            print(f"  CHANGED: {inv_num} (id={inv_id}): "
                  f"amount_paid {old.get('old_paid', 0)} -> {new_paid}, "
                  f"balance_due {old.get('old_balance', 0)} -> {new_bal}")

    print(f"\n{'='*60}")
    print(f"PHASE 2A MIGRATION REPORT")
    print(f"{'='*60}")
    print(f"Total active payments:            {total_payments}")
    print(f"Payments allocated to invoices:   {count_allocated}")
    print(f"Payments left on-account:         {count_on_account}")
    print(f"Total on-account value:           {total_on_account_value:.2f}")
    print(f"Invoices whose amount_paid changed: {changed_count}")
    print(f"  Before sum(amount_paid):        {before_sum_paid:.2f}")
    print(f"  After  sum(amount_paid):        {after_sum_paid:.2f}")
    print(f"{'='*60}\n")


def downgrade() -> None:
    # Restore invoice amount_paid / balance_due to 0 before dropping
    conn = op.get_bind()
    conn.execute(text("""
        UPDATE invoices
        SET amount_paid = 0,
            balance_due = COALESCE(total_amount, 0)
        WHERE is_active = true
    """))
    op.drop_table('payment_allocations')
