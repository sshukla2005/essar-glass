"""Per-company WhatsApp sending configuration on companies

Revision ID: x9y0z1a2b3c4
Revises: w8x9y0z1a2b3
Create Date: 2026-09-28

Adds empty per-company WhatsApp settings. Blank fields fall back to the global
WHATSAPP_* settings in .env. No credentials are written here.

whatsapp_enabled defaults to false for new companies, but companies that already
exist are set to true so they keep sending exactly as they did before (all of them
used the global sender until now).

The existing `whatsapp` column (display phone number) is not touched.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'x9y0z1a2b3c4'
down_revision: Union[str, None] = 'w8x9y0z1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_COLUMNS = (
    'whatsapp_phone_number_id',
    'whatsapp_token',
    'whatsapp_template_quotation',
    'whatsapp_api_url',
    'whatsapp_enabled',
)


def upgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('companies')]
    if 'whatsapp_phone_number_id' not in cols:
        op.add_column('companies', sa.Column('whatsapp_phone_number_id', sa.String(), nullable=True))
    if 'whatsapp_token' not in cols:
        op.add_column('companies', sa.Column('whatsapp_token', sa.Text(), nullable=True))
    if 'whatsapp_template_quotation' not in cols:
        op.add_column('companies', sa.Column('whatsapp_template_quotation', sa.String(), nullable=True))
    if 'whatsapp_api_url' not in cols:
        op.add_column('companies', sa.Column('whatsapp_api_url', sa.String(), nullable=True))
    if 'whatsapp_enabled' not in cols:
        op.add_column(
            'companies',
            sa.Column('whatsapp_enabled', sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        # Existing companies keep sending as before; only companies created later start disabled
        op.execute("UPDATE companies SET whatsapp_enabled = true")


def downgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('companies')]
    for name in reversed(NEW_COLUMNS):
        if name in cols:
            op.drop_column('companies', name)
