"""Phase 3B dual-unit stock and warehouse fields

Revision ID: j6k7l8m9n0o1
Revises: i5j6k7l8m9n0
Create Date: 2026-08-13

Phase 3B — Dual-unit stock (sqm & sheets), brand, and warehouse link
"""
from alembic import op
import sqlalchemy as sa

revision = 'j6k7l8m9n0o1'
down_revision = 'i5j6k7l8m9n0'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Products table
    op.add_column('products', sa.Column('brand', sa.String(length=50), nullable=True))
    op.add_column('products', sa.Column('on_hand_sqm', sa.Float(), nullable=True, server_default='0'))
    op.add_column('products', sa.Column('on_hand_sheets', sa.Float(), nullable=True, server_default='0'))

    # Stock movements table
    op.add_column('stock_movements', sa.Column('quantity_sqm', sa.Float(), nullable=True))
    op.add_column('stock_movements', sa.Column('quantity_sheets', sa.Float(), nullable=True))
    op.add_column('stock_movements', sa.Column('warehouse_id', sa.Integer(), sa.ForeignKey('warehouses.id'), nullable=True))
    op.add_column('stock_movements', sa.Column('unit_rate', sa.Float(), nullable=True))
    op.add_column('stock_movements', sa.Column('total_value', sa.Float(), nullable=True))

def downgrade() -> None:
    op.drop_column('stock_movements', 'total_value')
    op.drop_column('stock_movements', 'unit_rate')
    op.drop_column('stock_movements', 'warehouse_id')
    op.drop_column('stock_movements', 'quantity_sheets')
    op.drop_column('stock_movements', 'quantity_sqm')

    op.drop_column('products', 'on_hand_sheets')
    op.drop_column('products', 'on_hand_sqm')
    op.drop_column('products', 'brand')
