"""seed default terms and warranty text per company

Revision ID: r3s4t5u6v7w8
Revises: q2r3s4t5u6v7
Create Date: 2026-09-02

Data-only migration. Populates terms_conditions and warranty_terms for
every active company that does not yet have text in those columns.
Each occurrence of {COMPANY} is replaced with the company name in
UPPERCASE before insertion.

No schema change. Safe to re-run: existing non-NULL/non-empty values
are never overwritten.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'r3s4t5u6v7w8'
down_revision: Union[str, None] = 'q2r3s4t5u6v7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ─────────────────────────────────────────────────────────────────────────────
# Annexure I — Terms & Conditions (clauses 1.1 – 1.20)
# ─────────────────────────────────────────────────────────────────────────────
TERMS_TEMPLATE = """\
ANNEXURE I — TERMS & CONDITIONS

1.1 QUALITY STANDARDS
All glasses shall be made as per IS 2553, IS 14900, IS 383 and relevant BIS standards. {COMPANY} reserves the right to supply glass with minor imperfections permitted under the applicable IS tolerance norms.

1.2 MEASUREMENT & TOLERANCE
All dimensions are in millimetres (mm) unless stated otherwise. A manufacturing tolerance of ±2 mm on width and height is applicable on all glass sizes. Toughened glass carries an additional ±3 mm tolerance as per IS 2553.

1.3 DELIVERY
Delivery shall be made at the site / location specified in the order. Risk in goods passes to the buyer upon delivery. {COMPANY} shall not be liable for any delay in delivery caused by force majeure, road conditions, weather, or other circumstances beyond its control.

1.4 TRANSPORT & HANDLING
Goods travel at buyer's risk once they leave the {COMPANY} premises / fabrication yard. Any damage during transit shall be borne by the buyer unless {COMPANY} has expressly agreed in writing to provide door-to-door insured delivery.

1.5 INSPECTION
The buyer must inspect all goods at the time of delivery. Any visible defects, breakage, or shortfall must be noted on the delivery challan and reported to {COMPANY} within 48 hours of delivery. Claims made after this period will not be entertained.

1.6 PAYMENT TERMS
Payment shall be made as per the agreed schedule stated on the face of this quotation / proforma invoice. In the absence of a stated schedule, payment is due within 30 days of the invoice date. {COMPANY} reserves the right to charge interest at 18% per annum on overdue amounts.

1.7 CANCELLATION
Orders once placed cannot be cancelled after fabrication / processing has commenced. Cancellation of raw-glass orders (uncut) may be accepted at the discretion of {COMPANY}, subject to a minimum restocking fee of 10% of the order value.

1.8 RETURNS
No goods will be accepted for return without prior written authorisation from {COMPANY}. Authorised returns are subject to a handling charge of 10% of the invoice value. Custom-cut or processed glass is non-returnable.

1.9 TITLE TO GOODS
Title to the goods shall not pass to the buyer until full and final payment has been received by {COMPANY}. {COMPANY} reserves the right to repossess unpaid goods from the buyer's premises.

1.10 PRICE VALIDITY
Prices quoted are valid for 30 days from the date of quotation unless a different validity period is stated. {COMPANY} reserves the right to revise prices in the event of fluctuations in raw-material costs, government levies, or exchange rates.

1.11 TAXES & DUTIES
All prices are exclusive of GST unless expressly stated as inclusive. The buyer shall bear all applicable taxes, duties, cesses, and levies.

1.12 SCOPE OF SUPPLY
Only the items, quantities, and specifications listed in the quotation / order acknowledgement form the scope of supply. Any additional work, materials, or on-site services shall be charged separately.

1.13 SITE CONDITIONS
The buyer is responsible for ensuring safe and adequate access for delivery vehicles and for providing a suitable storage area at the delivery location. {COMPANY} shall not be held liable for delays arising from inadequate site access.

1.14 DESIGN & ENGINEERING
{COMPANY} provides glass fabrication services only. Structural design, load calculations, anchor design, and installation engineering are the exclusive responsibility of the buyer's appointed architect, structural engineer, or installer.

1.15 INTELLECTUAL PROPERTY
All drawings, designs, specifications, and technical documents prepared by {COMPANY} remain its intellectual property. They may not be reproduced, shared, or used for any purpose other than the execution of the related order without prior written consent.

1.16 FORCE MAJEURE
{COMPANY} shall not be liable for failure or delay in performance caused by acts of God, war, riots, strikes, government actions, fire, flood, epidemic, or any other event beyond its reasonable control.

1.17 DISPUTE RESOLUTION
Any dispute arising out of or in connection with this contract shall first be referred to senior management of both parties for amicable resolution. If unresolved within 30 days, the dispute shall be submitted to arbitration under the Arbitration and Conciliation Act, 1996. The seat of arbitration shall be the jurisdiction of the registered office of {COMPANY}.

1.18 GOVERNING LAW
This contract shall be governed by and construed in accordance with the laws of India. The courts at the jurisdiction of the registered office of {COMPANY} shall have exclusive jurisdiction.

1.19 ENTIRE AGREEMENT
This quotation / proforma invoice, together with any written order acknowledgement issued by {COMPANY}, constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior representations, negotiations, and understandings.

1.20 AMENDMENTS
No amendment to these terms shall be binding unless made in writing and signed by an authorised representative of {COMPANY}.\
"""

# ─────────────────────────────────────────────────────────────────────────────
# Annexure II — Warranty Terms (clauses 2.1 – 2.8)
# ─────────────────────────────────────────────────────────────────────────────
WARRANTY_TEMPLATE = """\
ANNEXURE II — WARRANTY TERMS

2.1 LIMITED PRODUCT WARRANTY
Unless otherwise specified in writing, {COMPANY} warrants that all glass products supplied are free from material defects in manufacturing for a period of twelve (12) months from the date of delivery (the "Warranty Period").

2.2 SCOPE OF WARRANTY
This warranty covers only manufacturing defects that are identified at the time of delivery and reported in accordance with Clause 1.5 of the Terms & Conditions, or latent defects that manifest within the Warranty Period under normal use and conditions.

2.3 EXCLUSIONS
This warranty does not cover:
(a) damage caused by improper handling, installation, storage, or use;
(b) damage caused by external impact, vandalism, fire, flood, or other force-majeure events;
(c) normal weathering, soiling, or surface scratches that occur during ordinary use;
(d) damage arising from the use of cleaning materials or chemicals not approved by {COMPANY};
(e) defects arising from inadequate or incorrect structural support, framing, or fixing systems provided by parties other than {COMPANY};
(f) glass used in applications for which it was not specified or intended;
(g) goods that have been modified, repaired, or processed by any party other than {COMPANY} after delivery.

2.4 MAKING A WARRANTY CLAIM
To make a warranty claim the buyer must:
(a) notify {COMPANY} in writing within the Warranty Period describing the defect and providing supporting photographs;
(b) allow {COMPANY} or its authorised representative to inspect the goods in-situ before any removal or remediation is undertaken;
(c) retain the original delivery challan and invoice as proof of purchase.

2.5 REMEDY
If a valid warranty claim is accepted by {COMPANY}, {COMPANY} shall, at its sole option, either:
(a) replace the defective glass with equivalent product of the same specification; or
(b) issue a credit note to the value of the defective goods against future purchases.
{COMPANY} shall not be liable for the cost of removal, reinstallation, associated civil works, or consequential losses of any kind.

2.6 LIMITATION OF LIABILITY
The total liability of {COMPANY} under this warranty shall not exceed the invoiced value of the defective goods. Under no circumstances shall {COMPANY} be liable for indirect, consequential, special, incidental, or punitive damages arising out of or related to the supply of goods.

2.7 NON-TRANSFERABILITY
This warranty is granted solely to the original buyer named on the invoice and is non-transferable. It does not extend to subsequent owners, tenants, or any third party.

2.8 STATUTORY RIGHTS
Nothing in this warranty limits or excludes any statutory rights of the buyer that cannot be excluded under applicable law.\
"""


def upgrade() -> None:
    conn = op.get_bind()

    # Fetch all active companies
    rows = conn.execute(
        sa.text("SELECT id, name FROM companies WHERE is_active = true")
    ).fetchall()

    for row in rows:
        company_id = row[0]
        company_name = (row[1] or "").upper()

        terms_text = TERMS_TEMPLATE.replace("{COMPANY}", company_name)
        warranty_text = WARRANTY_TEMPLATE.replace("{COMPANY}", company_name)

        # Only update if the column is currently NULL or empty string
        conn.execute(
            sa.text(
                """
                UPDATE companies
                SET terms_conditions = :terms
                WHERE id = :cid
                  AND (terms_conditions IS NULL OR terms_conditions = '')
                """
            ),
            {"terms": terms_text, "cid": company_id},
        )

        conn.execute(
            sa.text(
                """
                UPDATE companies
                SET warranty_terms = :warranty
                WHERE id = :cid
                  AND (warranty_terms IS NULL OR warranty_terms = '')
                """
            ),
            {"warranty": warranty_text, "cid": company_id},
        )


def downgrade() -> None:
    """
    Set both columns back to NULL for all companies.
    Note: this erases any custom edits made after the upgrade.
    """
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE companies SET terms_conditions = NULL, warranty_terms = NULL")
    )