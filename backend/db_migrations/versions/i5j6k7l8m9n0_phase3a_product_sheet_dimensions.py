"""Add sheet_width_mm, sheet_height_mm, and stock_uom to products table

Revision ID: i5j6k7l8m9n0
Revises: h4i5j6k7l8m9
Create Date: 2026-08-13

Phase 3A — Sheet-based inventory foundation (T2)
"""
from alembic import op
import sqlalchemy as sa

revision = 'i5j6k7l8m9n0'
down_revision = 'c98be1935a69'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('products', sa.Column('sheet_width_mm', sa.Float(), nullable=True))
    op.add_column('products', sa.Column('sheet_height_mm', sa.Float(), nullable=True))
    op.add_column('products', sa.Column('stock_uom', sa.String(length=20), nullable=True, server_default='sheet'))

    # Set default stock_uom for existing products: 'service' if product_type == 'service', 'sheet' for storable glass, 'nos' for hardware/others
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE products
        SET stock_uom = CASE
            WHEN product_type = 'service' THEN 'service'
            WHEN product_type = 'storable' AND (glass_type IS NOT NULL OR glass_category IS NOT NULL OR name ILIKE '%glass%') THEN 'sheet'
            ELSE 'nos'
        END
        WHERE stock_uom IS NULL OR stock_uom = 'sheet'
    """))

def downgrade() -> None:
    op.drop_column('products', 'stock_uom')
    op.drop_column('products', 'sheet_height_mm')
    op.drop_column('products', 'sheet_width_mm')
