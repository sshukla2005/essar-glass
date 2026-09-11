"""Add address_line2 to customers and vendors

Revision ID: v7w8x9y0z1a2
Revises: u6v7w8x9y0z1
Create Date: 2026-09-11

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v7w8x9y0z1a2'
down_revision: Union[str, None] = 'u6v7w8x9y0z1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    cust_cols = [c['name'] for c in sa.inspect(conn).get_columns('customers')]
    if 'address_line2' not in cust_cols:
        op.add_column(
            'customers',
            sa.Column('address_line2', sa.Text(), nullable=True)
        )

    vend_cols = [c['name'] for c in sa.inspect(conn).get_columns('vendors')]
    if 'address_line2' not in vend_cols:
        op.add_column(
            'vendors',
            sa.Column('address_line2', sa.Text(), nullable=True)
        )


def downgrade() -> None:
    conn = op.get_bind()
    cust_cols = [c['name'] for c in sa.inspect(conn).get_columns('customers')]
    if 'address_line2' in cust_cols:
        op.drop_column('customers', 'address_line2')

    vend_cols = [c['name'] for c in sa.inspect(conn).get_columns('vendors')]
    if 'address_line2' in vend_cols:
        op.drop_column('vendors', 'address_line2')
