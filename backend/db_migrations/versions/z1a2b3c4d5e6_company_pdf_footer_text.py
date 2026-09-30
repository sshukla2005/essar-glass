"""PDF footer (factory address) text on companies

Revision ID: z1a2b3c4d5e6
Revises: y0z1a2b3c4d5
Create Date: 2026-09-30

Adds companies.pdf_footer_text, printed line by line in the address box at the
bottom of quotation and SO PDFs. Existing companies with no footer get the group
factory address supplied by the business; each company can edit or clear it in
Settings > Company. Downgrade drops the column.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'z1a2b3c4d5e6'
down_revision: Union[str, None] = 'y0z1a2b3c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FACTORY_FOOTER = "\n".join([
    "Factory outlet & Reg. Sales Off: EXCEL TRADERS, Rai Pada, opp Siddhesh Garage, Next to Shushila Autotech, "
    "Virar Phata Road, 1 Km East from RTO Off; Virar-E.401305",
    "Google Maps: Alfa Enterprise Virar: https://goo.gl/maps/GtfNa2Xa2GH2",
    "email: essarsons@live.com",
    "Google Maps: Alfa Enterprises Virar East: https://goo.gl/maps/GtfNa2Xa2GH2",
])


def upgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('companies')]
    if 'pdf_footer_text' not in cols:
        op.add_column('companies', sa.Column('pdf_footer_text', sa.Text(), nullable=True))
    conn.execute(
        sa.text("UPDATE companies SET pdf_footer_text = :t WHERE pdf_footer_text IS NULL OR trim(pdf_footer_text) = ''"),
        {"t": FACTORY_FOOTER},
    )


def downgrade() -> None:
    conn = op.get_bind()
    cols = [c['name'] for c in sa.inspect(conn).get_columns('companies')]
    if 'pdf_footer_text' in cols:
        op.drop_column('companies', 'pdf_footer_text')
