"""Add unit_mode to quotations and sales_orders

Revision ID: k7l8m9n0o1p2
Revises: j6k7l8m9n0o1
Create Date: 2026-08-17

"""
from alembic import op
import sqlalchemy as sa

revision = 'k7l8m9n0o1p2'
down_revision = 'j6k7l8m9n0o1'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('quotations', sa.Column('unit_mode', sa.String(length=10), nullable=True, server_default='inch'))
    op.add_column('sales_orders', sa.Column('unit_mode', sa.String(length=10), nullable=True, server_default='inch'))

def downgrade() -> None:
    op.drop_column('sales_orders', 'unit_mode')
    op.drop_column('quotations', 'unit_mode')
