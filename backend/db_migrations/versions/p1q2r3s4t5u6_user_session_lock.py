"""user session lock

Revision ID: p1q2r3s4t5u6
Revises: o0p1q2r3s4t5
Create Date: 2026-08-31

Hand-written migration adding current_session_id and session_started_at to users table.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'p1q2r3s4t5u6'
down_revision: Union[str, None] = 'o0p1q2r3s4t5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('users')]
    if 'current_session_id' not in cols:
        op.add_column('users', sa.Column('current_session_id', sa.String(64), nullable=True))
    if 'session_started_at' not in cols:
        op.add_column('users', sa.Column('session_started_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('users')]
    if 'session_started_at' in cols:
        op.drop_column('users', 'session_started_at')
    if 'current_session_id' in cols:
        op.drop_column('users', 'current_session_id')
