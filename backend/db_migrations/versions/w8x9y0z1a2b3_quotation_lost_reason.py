"""Add lost_reason and lost_at to quotations

Revision ID: w8x9y0z1a2b3
Revises: v7w8x9y0z1a2
Create Date: 2026-09-14

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'w8x9y0z1a2b3'
down_revision: Union[str, None] = 'v7w8x9y0z1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('quotations')]
    if 'lost_reason' not in cols:
        op.add_column(
            'quotations',
            sa.Column('lost_reason', sa.Text(), nullable=True)
        )
    if 'lost_at' not in cols:
        op.add_column(
            'quotations',
            sa.Column('lost_at', sa.DateTime(timezone=True), nullable=True)
        )


def downgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('quotations')]
    if 'lost_at' in cols:
        op.drop_column('quotations', 'lost_at')
    if 'lost_reason' in cols:
        op.drop_column('quotations', 'lost_reason')
