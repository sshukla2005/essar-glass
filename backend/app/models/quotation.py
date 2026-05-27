from sqlalchemy import (Column, Integer, String, Boolean,
                        Float, ForeignKey, Text, JSON)
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class Quotation(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "quotations"

    id               = Column(Integer, primary_key=True, index=True)
    quote_number     = Column(String(20),  unique=True, nullable=False)
    customer_id      = Column(Integer, ForeignKey("customers.id"),
                              nullable=True)
    crm_lead_id      = Column(Integer, ForeignKey("crm_leads.id"),
                              nullable=True)
    quote_date       = Column(String(20),  nullable=True)
    valid_until      = Column(String(20),  nullable=True)
    salesperson      = Column(String(200), nullable=True)
    payment_terms    = Column(String(50),  nullable=True)
    delivery_address = Column(Text,        nullable=True)
    status           = Column(String(30),  default="draft", index=True)
    # Glass calc settings snapshot
    ceiling_default  = Column(Integer,     default=6)
    is_inter_state   = Column(Boolean,     default=False)
    # Line items stored as JSON (groups with sizes)
    groups           = Column(JSON,        nullable=True)
    lines            = Column(JSON,        nullable=True)
    # Totals
    subtotal         = Column(Float,       default=0)
    process_total    = Column(Float,       default=0)
    dc_charges       = Column(Float,       default=0)
    discount_amount  = Column(Float,       default=0)
    cgst             = Column(Float,       default=0)
    sgst             = Column(Float,       default=0)
    igst             = Column(Float,       default=0)
    total_amount     = Column(Float,       default=0)
    advance_received = Column(Float,       default=0)
    balance_due      = Column(Float,       default=0)
    # Notes
    customer_notes   = Column(Text,        nullable=True)
    internal_notes   = Column(Text,        nullable=True)
    hardware_items   = Column(JSON, nullable=True, default=list)
    labor_items      = Column(JSON, nullable=True, default=list)
    gst_mode         = Column(String(20), default='cgst_sgst')
    company_id       = Column(Integer, ForeignKey("companies.id"),
                              nullable=True, index=True)
