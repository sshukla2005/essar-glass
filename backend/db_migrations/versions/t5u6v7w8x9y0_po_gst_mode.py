"""Add gst_mode to purchase_orders

Revision ID: t5u6v7w8x9y0
Revises: s4t5u6v7w8x9
Create Date: 2026-09-09

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 't5u6v7w8x9y0'
down_revision: Union[str, None] = 's4t5u6v7w8x9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'purchase_orders',
        sa.Column('gst_mode', sa.String(length=20), nullable=True, server_default='cgst_sgst')
    )


def downgrade() -> None:
    op.drop_column('purchase_orders', 'gst_mode')
