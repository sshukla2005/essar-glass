"""Add unit_mode to purchase_orders

Revision ID: u6v7w8x9y0z1
Revises: t5u6v7w8x9y0
Create Date: 2026-09-11

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'u6v7w8x9y0z1'
down_revision: Union[str, None] = 't5u6v7w8x9y0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('purchase_orders')]
    if 'unit_mode' not in cols:
        op.add_column(
            'purchase_orders',
            sa.Column('unit_mode', sa.String(length=10), nullable=True, server_default='inch')
        )


def downgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('purchase_orders')]
    if 'unit_mode' in cols:
        op.drop_column('purchase_orders', 'unit_mode')
