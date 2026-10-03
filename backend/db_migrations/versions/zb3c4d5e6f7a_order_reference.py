"""Order Reference on quotations and sales orders

Revision ID: zb3c4d5e6f7a
Revises: za2b3c4d5e6f
Create Date: 2026-10-03

Adds quotations.order_reference and sales_orders.order_reference: where the order
came from (architect, builder, fabricator, individual, company, online), picked on
the form and copied from the quotation to its Sales Order. Existing rows stay empty.
No data is written.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'zb3c4d5e6f7a'
down_revision: Union[str, None] = 'za2b3c4d5e6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ('quotations', 'sales_orders')


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    for table in TABLES:
        if 'order_reference' not in [c['name'] for c in insp.get_columns(table)]:
            op.add_column(table, sa.Column('order_reference', sa.String(40), nullable=True))
            op.create_index(f'ix_{table}_order_reference', table, ['order_reference'])


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    for table in TABLES:
        if 'order_reference' in [c['name'] for c in insp.get_columns(table)]:
            op.drop_index(f'ix_{table}_order_reference', table_name=table)
            op.drop_column(table, 'order_reference')
