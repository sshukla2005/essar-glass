"""company terms and warranty fields

Revision ID: q2r3s4t5u6v7
Revises: p1q2r3s4t5u6
Create Date: 2026-09-01

Hand-written migration adding terms_conditions and warranty_terms
(both Text, nullable) to the companies table.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'q2r3s4t5u6v7'
down_revision: Union[str, None] = 'p1q2r3s4t5u6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('companies')]
    if 'terms_conditions' not in cols:
        op.add_column('companies', sa.Column('terms_conditions', sa.Text(), nullable=True))
    if 'warranty_terms' not in cols:
        op.add_column('companies', sa.Column('warranty_terms', sa.Text(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('companies')]
    if 'warranty_terms' in cols:
        op.drop_column('companies', 'warranty_terms')
    if 'terms_conditions' in cols:
        op.drop_column('companies', 'terms_conditions')
