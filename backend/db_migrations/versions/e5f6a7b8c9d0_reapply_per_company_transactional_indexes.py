"""reapply_per_company_transactional_indexes

Re-apply per-company unique index changes for transactional tables, dropping any
stale global UNIQUE constraints if present and creating composite indexes on
(company_id, <number_col>).

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None

TRANSACTIONAL_TABLES = [
    ('quotations',        'quote_number',    'ix_quotations_quote_number',        'quotations_quote_number_key',       'ix_quotations_quote_number_company'),
    ('sales_orders',      'so_number',       'ix_sales_orders_so_number',          'sales_orders_so_number_key',        'ix_sales_orders_so_number_company'),
    ('purchase_orders',   'po_number',       'ix_purchase_orders_po_number',      'purchase_orders_po_number_key',     'ix_purchase_orders_po_number_company'),
    ('delivery_challans', 'dc_number',       'ix_delivery_challans_dc_number',    'delivery_challans_dc_number_key',   'ix_delivery_challans_dc_number_company'),
    ('invoices',          'invoice_number',  'ix_invoices_invoice_number',        'invoices_invoice_number_key',       'ix_invoices_invoice_number_company'),
    ('payments',          'payment_number',  'ix_payments_payment_number',        'payments_payment_number_key',       'ix_payments_payment_number_company'),
    ('workshop_orders',   'wo_number',       'ix_workshop_orders_wo_number',      'workshop_orders_wo_number_key',     'ix_workshop_orders_wo_number_company'),
    ('toughening_batches','tb_number',       'ix_toughening_batches_tb_number',   'toughening_batches_tb_number_key',  'ix_toughening_batches_tb_number_company'),
    ('stock_movements',   'move_number',     'ix_stock_movements_move_number',    'stock_movements_move_number_key',   'ix_stock_movements_move_number_company'),
    ('crm_leads',         'lead_number',     'ix_crm_leads_lead_number',          'crm_leads_lead_number_key',         'ix_crm_leads_lead_number_company'),
]


def upgrade() -> None:
    for table, col, single_idx, constraint_name, comp_idx in TRANSACTIONAL_TABLES:
        # 1. Drop single-column index if present
        op.drop_index(single_idx, table_name=table, if_exists=True)

        # 2. Idempotently drop the global UNIQUE constraint if present
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {constraint_name}")

        # 3. Drop existing composite index if present before creating
        op.drop_index(comp_idx, table_name=table, if_exists=True)

        # 4. Create composite unique index
        op.create_index(
            comp_idx,
            table,
            ['company_id', col],
            unique=True,
            postgresql_where=sa.text('company_id IS NOT NULL'),
        )


def downgrade() -> None:
    for table, col, _single_idx, constraint_name, comp_idx in TRANSACTIONAL_TABLES:
        op.drop_index(comp_idx, table_name=table, if_exists=True)
        with op.batch_alter_table(table) as batch_op:
            batch_op.create_unique_constraint(constraint_name, [col])
