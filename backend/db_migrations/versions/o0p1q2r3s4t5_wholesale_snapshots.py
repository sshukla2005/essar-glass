"""wholesale_snapshots table

Revision ID: o0p1q2r3s4t5
Revises: n9o0p1q2r3s4
Create Date: 2026-08-27

Hand-written. Do NOT autogenerate on this project — the per-company partial
unique indexes live in migrations, not models, and autogenerate drops them.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'o0p1q2r3s4t5'
down_revision: Union[str, None] = 'n9o0p1q2r3s4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'wholesale_snapshots',
        sa.Column('id',            sa.Integer(),                    nullable=False),
        sa.Column('source',        sa.String(50),                   nullable=False),
        sa.Column('stock_value',   sa.Float(),                      nullable=True,  server_default='0'),
        sa.Column('total_sheets',  sa.Integer(),                    nullable=True,  server_default='0'),
        sa.Column('total_sqm',     sa.Float(),                      nullable=True,  server_default='0'),
        sa.Column('total_tonnage', sa.Float(),                      nullable=True,  server_default='0'),
        sa.Column('total_skus',    sa.Integer(),                    nullable=True,  server_default='0'),
        sa.Column('low_stock',     sa.Integer(),                    nullable=True,  server_default='0'),
        sa.Column('month_revenue', sa.Float(),                      nullable=True,  server_default='0'),
        sa.Column('month_orders',  sa.Integer(),                    nullable=True,  server_default='0'),
        sa.Column('month_profit',  sa.Float(),                      nullable=True,  server_default='0'),
        sa.Column('open_orders',   sa.Integer(),                    nullable=True,  server_default='0'),
        sa.Column('trucks_active', sa.Integer(),                    nullable=True,  server_default='0'),
        sa.Column('synced_at',     sa.DateTime(timezone=True),      nullable=True,
                  server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_wholesale_snapshots_id'),       'wholesale_snapshots', ['id'],        unique=False)
    op.create_index(op.f('ix_wholesale_snapshots_source'),   'wholesale_snapshots', ['source'],    unique=False)
    op.create_index(op.f('ix_wholesale_snapshots_synced_at'),'wholesale_snapshots', ['synced_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_wholesale_snapshots_synced_at'), table_name='wholesale_snapshots')
    op.drop_index(op.f('ix_wholesale_snapshots_source'),    table_name='wholesale_snapshots')
    op.drop_index(op.f('ix_wholesale_snapshots_id'),        table_name='wholesale_snapshots')
    op.drop_table('wholesale_snapshots')
