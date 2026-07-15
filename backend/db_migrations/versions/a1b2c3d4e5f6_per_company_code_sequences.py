"""per_company_code_sequences

Remove the global UNIQUE constraint on document number columns and replace
with per-company uniqueness so that ESSAR and Alfa Lifters can both have
QT0001, SO0001, INV0001, etc.

Existing records are NOT renumbered.

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-07-15

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Quotations ─────────────────────────────────────────────────────────
    op.drop_index('ix_quotations_quote_number', table_name='quotations', if_exists=True)
    with op.batch_alter_table('quotations') as batch_op:
        batch_op.drop_constraint('quotations_quote_number_key', type_='unique')
    op.create_index(
        'ix_quotations_quote_number_company',
        'quotations',
        ['company_id', 'quote_number'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )

    # ── Sales Orders ───────────────────────────────────────────────────────
    op.drop_index('ix_sales_orders_so_number', table_name='sales_orders', if_exists=True)
    with op.batch_alter_table('sales_orders') as batch_op:
        batch_op.drop_constraint('sales_orders_so_number_key', type_='unique')
    op.create_index(
        'ix_sales_orders_so_number_company',
        'sales_orders',
        ['company_id', 'so_number'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )

    # ── Purchase Orders ────────────────────────────────────────────────────
    op.drop_index('ix_purchase_orders_po_number', table_name='purchase_orders', if_exists=True)
    with op.batch_alter_table('purchase_orders') as batch_op:
        batch_op.drop_constraint('purchase_orders_po_number_key', type_='unique')
    op.create_index(
        'ix_purchase_orders_po_number_company',
        'purchase_orders',
        ['company_id', 'po_number'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )

    # ── Delivery Challans ──────────────────────────────────────────────────
    op.drop_index('ix_delivery_challans_dc_number', table_name='delivery_challans', if_exists=True)
    with op.batch_alter_table('delivery_challans') as batch_op:
        batch_op.drop_constraint('delivery_challans_dc_number_key', type_='unique')
    op.create_index(
        'ix_delivery_challans_dc_number_company',
        'delivery_challans',
        ['company_id', 'dc_number'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )

    # ── Invoices ───────────────────────────────────────────────────────────
    op.drop_index('ix_invoices_invoice_number', table_name='invoices', if_exists=True)
    with op.batch_alter_table('invoices') as batch_op:
        batch_op.drop_constraint('invoices_invoice_number_key', type_='unique')
    op.create_index(
        'ix_invoices_invoice_number_company',
        'invoices',
        ['company_id', 'invoice_number'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )

    # ── Payments ───────────────────────────────────────────────────────────
    op.drop_index('ix_payments_payment_number', table_name='payments', if_exists=True)
    with op.batch_alter_table('payments') as batch_op:
        batch_op.drop_constraint('payments_payment_number_key', type_='unique')
    op.create_index(
        'ix_payments_payment_number_company',
        'payments',
        ['company_id', 'payment_number'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )

    # ── Workshop Orders ────────────────────────────────────────────────────
    op.drop_index('ix_workshop_orders_wo_number', table_name='workshop_orders', if_exists=True)
    with op.batch_alter_table('workshop_orders') as batch_op:
        batch_op.drop_constraint('workshop_orders_wo_number_key', type_='unique')
    op.create_index(
        'ix_workshop_orders_wo_number_company',
        'workshop_orders',
        ['company_id', 'wo_number'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )

    # ── Toughening Batches ─────────────────────────────────────────────────
    op.drop_index('ix_toughening_batches_tb_number', table_name='toughening_batches', if_exists=True)
    with op.batch_alter_table('toughening_batches') as batch_op:
        batch_op.drop_constraint('toughening_batches_tb_number_key', type_='unique')
    op.create_index(
        'ix_toughening_batches_tb_number_company',
        'toughening_batches',
        ['company_id', 'tb_number'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )

    # ── Stock Movements ────────────────────────────────────────────────────
    op.drop_index('ix_stock_movements_move_number', table_name='stock_movements', if_exists=True)
    with op.batch_alter_table('stock_movements') as batch_op:
        batch_op.drop_constraint('stock_movements_move_number_key', type_='unique')
    op.create_index(
        'ix_stock_movements_move_number_company',
        'stock_movements',
        ['company_id', 'move_number'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )

    # ── CRM Leads ──────────────────────────────────────────────────────────
    op.drop_index('ix_crm_leads_lead_number', table_name='crm_leads', if_exists=True)
    with op.batch_alter_table('crm_leads') as batch_op:
        batch_op.drop_constraint('crm_leads_lead_number_key', type_='unique')
    op.create_index(
        'ix_crm_leads_lead_number_company',
        'crm_leads',
        ['company_id', 'lead_number'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )


def downgrade() -> None:
    # Re-add global unique constraints (will fail if duplicates exist)
    tables = [
        ('quotations',        'quote_number',    'quotations_quote_number_key',       'ix_quotations_quote_number_company'),
        ('sales_orders',      'so_number',       'sales_orders_so_number_key',        'ix_sales_orders_so_number_company'),
        ('purchase_orders',   'po_number',       'purchase_orders_po_number_key',     'ix_purchase_orders_po_number_company'),
        ('delivery_challans', 'dc_number',       'delivery_challans_dc_number_key',   'ix_delivery_challans_dc_number_company'),
        ('invoices',          'invoice_number',  'invoices_invoice_number_key',       'ix_invoices_invoice_number_company'),
        ('payments',          'payment_number',  'payments_payment_number_key',       'ix_payments_payment_number_company'),
        ('workshop_orders',   'wo_number',       'workshop_orders_wo_number_key',     'ix_workshop_orders_wo_number_company'),
        ('toughening_batches','tb_number',       'toughening_batches_tb_number_key',  'ix_toughening_batches_tb_number_company'),
        ('stock_movements',   'move_number',     'stock_movements_move_number_key',   'ix_stock_movements_move_number_company'),
        ('crm_leads',         'lead_number',     'crm_leads_lead_number_key',         'ix_crm_leads_lead_number_company'),
    ]
    for table, col, constraint_name, idx_name in tables:
        op.drop_index(idx_name, table_name=table, if_exists=True)
        with op.batch_alter_table(table) as batch_op:
            batch_op.create_unique_constraint(constraint_name, [col])
