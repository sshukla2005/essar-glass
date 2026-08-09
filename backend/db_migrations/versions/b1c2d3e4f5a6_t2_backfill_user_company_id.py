"""T2 backfill user company_id and report NULL company_id counts

Revision ID: b1c2d3e4f5a6
Revises: a2b3c4d5e6f7
Create Date: 2026-08-09 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine import reflection


# revision identifiers, used by Alembic.
revision = 'b1c2d3e4f5a6'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Backfill users.company_id for any user where it is NULL, pointing at the lowest-id active company
    op.execute("""
        UPDATE users
        SET company_id = (
            SELECT id FROM companies WHERE is_active IS NOT FALSE ORDER BY id ASC LIMIT 1
        )
        WHERE company_id IS NULL;
    """)

    # 2. Report row counts in business tables where company_id IS NULL
    conn = op.get_bind()
    inspector = reflection.Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    company_scoped_tables = [
        'users', 'customers', 'vendors', 'products', 'employees', 'crm_leads',
        'quotations', 'sales_orders', 'purchase_orders', 'delivery_challans',
        'invoices', 'stock_movements', 'workshop_orders', 'toughening_batches',
        'warehouses', 'company_settings', 'payments'
    ]

    print("\n--- T2: NULL company_id row counts in business tables ---")
    for t in company_scoped_tables:
        if t in tables:
            cnt = conn.execute(sa.text(f"SELECT COUNT(*) FROM {t} WHERE company_id IS NULL")).scalar()
            print(f"Table '{t}': {cnt} rows with company_id IS NULL")
    print("----------------------------------------------------------\n")


def downgrade():
    pass
