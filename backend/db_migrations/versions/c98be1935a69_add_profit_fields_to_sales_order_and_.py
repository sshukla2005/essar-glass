"""add_profit_fields_to_sales_order_and_quotation

Revision ID: c98be1935a69
Revises: h4i5j6k7l8m9
Create Date: 2026-08-12 11:51:36.214969

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c98be1935a69'
down_revision: Union[str, None] = 'h4i5j6k7l8m9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sales_orders', sa.Column('total_cost', sa.Float(), nullable=True))
    op.add_column('sales_orders', sa.Column('profit_amount', sa.Float(), nullable=True))
    op.add_column('sales_orders', sa.Column('profit_percent', sa.Float(), nullable=True))

    op.add_column('quotations', sa.Column('total_cost', sa.Float(), nullable=True))
    op.add_column('quotations', sa.Column('profit_amount', sa.Float(), nullable=True))
    op.add_column('quotations', sa.Column('profit_percent', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('quotations', 'profit_percent')
    op.drop_column('quotations', 'profit_amount')
    op.drop_column('quotations', 'total_cost')

    op.drop_column('sales_orders', 'profit_percent')
    op.drop_column('sales_orders', 'profit_amount')
    op.drop_column('sales_orders', 'total_cost')
