"""add_payments_table

Revision ID: a1b2c3d4e5f6
Revises: 3b08e5add59d
Create Date: 2026-06-18 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '3b08e5add59d'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table('payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('payment_number', sa.String(length=20), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('so_id', sa.Integer(), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('payment_mode', sa.String(length=30), nullable=False),
        sa.Column('payment_account', sa.String(length=200), nullable=True),
        sa.Column('payment_reference', sa.String(length=200), nullable=True),
        sa.Column('payment_date', sa.String(length=20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('company_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id']),
        sa.ForeignKeyConstraint(['so_id'], ['sales_orders.id']),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('payment_number'),
    )
    op.create_index('ix_payments_id', 'payments', ['id'])
    op.create_index('ix_payments_customer_id', 'payments', ['customer_id'])
    op.create_index('ix_payments_so_id', 'payments', ['so_id'])
    op.create_index('ix_payments_company_id', 'payments', ['company_id'])

def downgrade() -> None:
    op.drop_table('payments')
