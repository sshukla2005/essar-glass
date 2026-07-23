"""per_company_code_sequences_master_tables

Remove the global UNIQUE constraint on master-table code columns and replace
with per-company uniqueness so that two companies can independently have
CUST0001, VEND0001, PROD0001, EMP0001, etc.

Existing records are NOT renumbered.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-22

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Customers ──────────────────────────────────────────────────────────
    op.drop_index('ix_customers_customer_code', table_name='customers', if_exists=True)
    op.execute("ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_customer_code_key")
    op.drop_index('ix_customers_customer_code_company', table_name='customers', if_exists=True)
    op.create_index(
        'ix_customers_customer_code_company',
        'customers',
        ['company_id', 'customer_code'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )

    # ── Vendors ────────────────────────────────────────────────────────────
    op.drop_index('ix_vendors_vendor_code', table_name='vendors', if_exists=True)
    op.execute("ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_vendor_code_key")
    op.drop_index('ix_vendors_vendor_code_company', table_name='vendors', if_exists=True)
    op.create_index(
        'ix_vendors_vendor_code_company',
        'vendors',
        ['company_id', 'vendor_code'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )

    # ── Products ───────────────────────────────────────────────────────────
    op.drop_index('ix_products_internal_ref', table_name='products', if_exists=True)
    op.execute("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_internal_ref_key")
    op.drop_index('ix_products_internal_ref_company', table_name='products', if_exists=True)
    op.create_index(
        'ix_products_internal_ref_company',
        'products',
        ['company_id', 'internal_ref'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )

    # ── Employees ──────────────────────────────────────────────────────────
    op.drop_index('ix_employees_employee_code', table_name='employees', if_exists=True)
    op.execute("ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_code_key")
    op.drop_index('ix_employees_employee_code_company', table_name='employees', if_exists=True)
    op.create_index(
        'ix_employees_employee_code_company',
        'employees',
        ['company_id', 'employee_code'],
        unique=True,
        postgresql_where=sa.text('company_id IS NOT NULL'),
    )


def downgrade() -> None:
    # Re-add global unique constraints (will fail if per-company duplicates exist)
    tables = [
        ('customers', 'customer_code', 'customers_customer_code_key', 'ix_customers_customer_code_company'),
        ('vendors',   'vendor_code',   'vendors_vendor_code_key',     'ix_vendors_vendor_code_company'),
        ('products',  'internal_ref',  'products_internal_ref_key',   'ix_products_internal_ref_company'),
        ('employees', 'employee_code', 'employees_employee_code_key', 'ix_employees_employee_code_company'),
    ]
    for table, col, constraint_name, idx_name in tables:
        op.drop_index(idx_name, table_name=table, if_exists=True)
        with op.batch_alter_table(table) as batch_op:
            batch_op.create_unique_constraint(constraint_name, [col])
