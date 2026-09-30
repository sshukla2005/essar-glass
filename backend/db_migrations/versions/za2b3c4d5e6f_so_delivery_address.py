"""Ship To address on sales orders

Revision ID: za2b3c4d5e6f
Revises: z1a2b3c4d5e6
Create Date: 2026-09-30

Adds sales_orders.delivery_address, the Ship To text printed on the SO PDF
(quotations already have this column; it now carries over on conversion).
Existing orders stay empty, meaning "same as billing", so their PDFs are
unchanged. No data is written.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'za2b3c4d5e6f'
down_revision: Union[str, None] = 'z1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('sales_orders')]
    if 'delivery_address' not in cols:
        op.add_column('sales_orders', sa.Column('delivery_address', sa.Text(), nullable=True))


def downgrade() -> None:
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('sales_orders')]
    if 'delivery_address' in cols:
        op.drop_column('sales_orders', 'delivery_address')
