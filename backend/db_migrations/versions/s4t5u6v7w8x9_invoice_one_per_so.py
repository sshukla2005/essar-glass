"""invoice_one_per_so

Revision ID: s4t5u6v7w8x9
Revises: r3s4t5u6v7w8
Create Date: 2026-09-02

Partial unique index enforcing at most one active, non-cancelled invoice per Sales Order.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 's4t5u6v7w8x9'
down_revision: Union[str, None] = 'r3s4t5u6v7w8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'uq_invoice_one_active_per_so',
        'invoices',
        ['so_id'],
        unique=True,
        postgresql_where=sa.text("so_id IS NOT NULL AND is_active = true AND status != 'cancelled'"),
    )


def downgrade() -> None:
    op.drop_index('uq_invoice_one_active_per_so', table_name='invoices', if_exists=True)
