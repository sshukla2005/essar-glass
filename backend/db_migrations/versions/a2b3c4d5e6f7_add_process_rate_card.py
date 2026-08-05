"""add_process_rate_card

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-08-05

Adds a per-document process_rate_card JSON column to quotations and
sales_orders so each document can store its own process selling/cost
rate table that syncs with size-specific process rows.
"""
from alembic import op
import sqlalchemy as sa

revision = 'a2b3c4d5e6f7'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('quotations',   sa.Column('process_rate_card', sa.JSON(), nullable=True))
    op.add_column('sales_orders', sa.Column('process_rate_card', sa.JSON(), nullable=True))

def downgrade() -> None:
    op.drop_column('sales_orders', 'process_rate_card')
    op.drop_column('quotations',   'process_rate_card')
