"""HS code mapping by glass type and category

Revision ID: y0z1a2b3c4d5
Revises: x9y0z1a2b3c4
Create Date: 2026-09-30

Creates hsn_mappings and seeds the global rules (company_id NULL = every company).
Only one active row may exist per company / type / category. The unique index
compares type and category trimmed and lowercased, matching how lookups work, and
treats NULL company and NULL category as values so global and type-level rows
cannot be duplicated either.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'y0z1a2b3c4d5'
down_revision: Union[str, None] = 'x9y0z1a2b3c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED = (
    ('Annealed',  'Clear',      '70052990'),
    ('Annealed',  'Xtra Clear', '70052990'),
    ('Annealed',  'Reflective', '70051090'),
    ('Annealed',  'Tinted',     '70051010'),
    ('Annealed',  'Patterned',  '70031990'),
    ('Annealed',  'Mirror',     '70099100'),
    ('Toughened', None,         '70071900'),
    ('Laminated', None,         '70071900'),
    ('DGU',       None,         '70080010'),
)


def upgrade() -> None:
    conn = op.get_bind()
    if 'hsn_mappings' not in sa.inspect(conn).get_table_names():
        op.create_table(
            'hsn_mappings',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=True),
            sa.Column('glass_type', sa.String(100), nullable=False),
            sa.Column('glass_category', sa.String(100), nullable=True),
            sa.Column('hs_code', sa.String(20), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index('ix_hsn_mappings_id', 'hsn_mappings', ['id'])
        op.create_index('ix_hsn_mappings_company_id', 'hsn_mappings', ['company_id'])
        op.execute(
            "CREATE UNIQUE INDEX uq_hsn_mappings_active ON hsn_mappings ("
            "COALESCE(company_id, 0), lower(trim(glass_type)), COALESCE(lower(trim(glass_category)), '')"
            ") WHERE is_active"
        )

    table = sa.table(
        'hsn_mappings',
        sa.column('company_id', sa.Integer),
        sa.column('glass_type', sa.String),
        sa.column('glass_category', sa.String),
        sa.column('hs_code', sa.String),
        sa.column('is_active', sa.Boolean),
    )
    existing = conn.execute(sa.text("SELECT count(*) FROM hsn_mappings WHERE company_id IS NULL")).scalar()
    if not existing:
        op.bulk_insert(table, [
            {'company_id': None, 'glass_type': t, 'glass_category': c, 'hs_code': code, 'is_active': True}
            for t, c, code in SEED
        ])


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_hsn_mappings_active")
    op.drop_index('ix_hsn_mappings_company_id', table_name='hsn_mappings')
    op.drop_index('ix_hsn_mappings_id', table_name='hsn_mappings')
    op.drop_table('hsn_mappings')
