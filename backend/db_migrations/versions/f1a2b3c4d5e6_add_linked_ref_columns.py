"""add_linked_ref_columns

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-08-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'f1a2b3c4d5e6'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('purchase_orders', sa.Column('linked_ref', sa.JSON(), nullable=True))
    op.add_column('sales_orders', sa.Column('linked_ref', sa.JSON(), nullable=True))
    op.add_column('workshop_orders', sa.Column('linked_ref', sa.JSON(), nullable=True))

def downgrade() -> None:
    op.drop_column('workshop_orders', 'linked_ref')
    op.drop_column('sales_orders', 'linked_ref')
    op.drop_column('purchase_orders', 'linked_ref')
