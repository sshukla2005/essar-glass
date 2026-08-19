"""add jurisdiction to companies

Revision ID: n9o0p1q2r3s4
Revises: m8n9o0p1q2r3
Create Date: 2026-08-19

Hand-written. Do NOT autogenerate on this project — the per-company partial
unique indexes live in migrations, not models, and autogenerate drops them.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'n9o0p1q2r3s4'
down_revision: Union[str, None] = 'm8n9o0p1q2r3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('companies')]
    if 'jurisdiction' not in cols:
        op.add_column('companies', sa.Column('jurisdiction', sa.String(100), nullable=True))
        # Existing companies are all in Palghar — matches the previously
        # hardcoded terms text so no document wording changes.
        op.execute("UPDATE companies SET jurisdiction = 'Palghar' WHERE jurisdiction IS NULL")


def downgrade() -> None:
    op.drop_column('companies', 'jurisdiction')
