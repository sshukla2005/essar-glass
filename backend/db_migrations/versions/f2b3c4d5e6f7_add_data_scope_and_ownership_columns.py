"""add data_scope and ownership columns

Revision ID: f2b3c4d5e6f7
Revises: b1c2d3e4f5a6
Create Date: 2026-08-10 14:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f2b3c4d5e6f7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None

SCOPED_TABLES = [
    "crm_leads",
    "quotations",
    "sales_orders",
    "workshop_orders",
    "toughening_batches",
    "delivery_challans",
    "purchase_orders",
    "invoices",
    "payments",
]


def upgrade():
    # 1. Add data_scope and module_scopes to users table
    op.add_column('users', sa.Column('data_scope', sa.String(length=20), nullable=False, server_default='company'))
    op.add_column('users', sa.Column('module_scopes', sa.JSON(), nullable=True))

    # 2. Add created_by and assigned_to_user_id to the 9 scoped tables
    for table in SCOPED_TABLES:
        op.add_column(table, sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
        op.create_index(f'ix_{table}_created_by', table, ['created_by'])
        
        op.add_column(table, sa.Column('assigned_to_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
        op.create_index(f'ix_{table}_assigned_to_user_id', table, ['assigned_to_user_id'])


def downgrade():
    for table in SCOPED_TABLES:
        op.drop_index(f'ix_{table}_assigned_to_user_id', table_name=table)
        op.drop_column(table, 'assigned_to_user_id')
        
        op.drop_index(f'ix_{table}_created_by', table_name=table)
        op.drop_column(table, 'created_by')

    op.drop_column('users', 'module_scopes')
    op.drop_column('users', 'data_scope')
