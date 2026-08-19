"""delivery notes and document sequences

Revision ID: m8n9o0p1q2r3
Revises: k7l8m9n0o1p2
Create Date: 2026-08-19

Hand-written. Do NOT autogenerate on this project: the per-company partial
unique indexes are defined in migrations, not models, so autogenerate treats
them as drift and drops them.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'm8n9o0p1q2r3'
down_revision: Union[str, None] = 'k7l8m9n0o1p2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing = set(insp.get_table_names())

    if 'document_sequences' not in existing:
        op.create_table(
            'document_sequences',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('company_id', sa.Integer(),
                      sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
            sa.Column('doc_type', sa.String(50), nullable=False),
            sa.Column('financial_year', sa.String(20), nullable=False),
            sa.Column('current_sequence', sa.Integer(), nullable=False, server_default='0'),
        )
        op.create_index('ix_document_sequences_company', 'document_sequences', ['company_id'])
        op.create_index(
            'ix_document_sequences_unique', 'document_sequences',
            ['company_id', 'doc_type', 'financial_year'], unique=True,
        )

    if 'delivery_notes' not in existing:
        op.create_table(
            'delivery_notes',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('company_id', sa.Integer(),
                      sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
            sa.Column('note_number', sa.String(50), nullable=False),
            sa.Column('note_date', sa.String(20)),
            sa.Column('consignee_name', sa.String(255)),
            sa.Column('consignee_address', sa.Text()),
            sa.Column('consignee_state', sa.String(100)),
            sa.Column('consignee_state_code', sa.String(10)),
            sa.Column('consignee_gstin', sa.String(50)),
            sa.Column('buyer_name', sa.String(255)),
            sa.Column('buyer_address', sa.Text()),
            sa.Column('buyer_state', sa.String(100)),
            sa.Column('buyer_state_code', sa.String(10)),
            sa.Column('buyer_gstin', sa.String(50)),
            sa.Column('place_of_supply', sa.String(100)),
            sa.Column('eway_bill_no', sa.String(100)),
            sa.Column('payment_terms', sa.String(200)),
            sa.Column('reference_no', sa.String(100)),
            sa.Column('other_references', sa.Text()),
            sa.Column('buyers_order_no', sa.String(100)),
            sa.Column('buyers_order_date', sa.String(20)),
            sa.Column('dispatch_doc_no', sa.String(100)),
            sa.Column('dispatched_through', sa.String(100)),
            sa.Column('destination', sa.String(100)),
            sa.Column('terms_of_delivery', sa.Text()),
            sa.Column('lines', sa.JSON()),
            sa.Column('total_amount', sa.Float()),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id')),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True),
                      server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        )
        op.create_index('ix_delivery_notes_company', 'delivery_notes', ['company_id'])
        op.create_index(
            'ix_delivery_notes_note_number_company', 'delivery_notes',
            ['company_id', 'note_number'], unique=True,
            postgresql_where=sa.text('company_id IS NOT NULL'),
        )


def downgrade() -> None:
    op.drop_table('delivery_notes')
    op.drop_table('document_sequences')
