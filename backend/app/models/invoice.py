from sqlalchemy import (Column, Integer, String, Boolean,
                        Float, ForeignKey, Text, JSON)
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class Invoice(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "invoices"

    id               = Column(Integer, primary_key=True, index=True)
    invoice_number   = Column(String(20),  unique=True, nullable=False)
    customer_id      = Column(Integer, ForeignKey("customers.id"),
                              nullable=True)
    so_id            = Column(Integer, ForeignKey("sales_orders.id"),
                              nullable=True)
    dc_id            = Column(Integer, ForeignKey("delivery_challans.id"),
                              nullable=True)
    invoice_date     = Column(String(20),  nullable=True)
    due_date         = Column(String(20),  nullable=True)
    payment_terms    = Column(String(50),  nullable=True)
    status           = Column(String(30),  default="draft", index=True)
    is_inter_state   = Column(Boolean,     default=False)
    lines            = Column(JSON,        nullable=True)
    subtotal         = Column(Float,       default=0)
    cgst             = Column(Float,       default=0)
    sgst             = Column(Float,       default=0)
    igst             = Column(Float,       default=0)
    tax_amount       = Column(Float,       default=0)
    total_amount     = Column(Float,       default=0)
    advance_received = Column(Float,       default=0)
    # Fields the frontend saves/reads — were being silently stripped
    gst_mode         = Column(String(20),  default="cgst_sgst")
    discount_amount  = Column(Float,       default=0)
    dc_charges       = Column(Float,       default=0)
    amount_paid      = Column(Float,       default=0)
    balance_due      = Column(Float,       default=0)
    customer_notes   = Column(Text,        nullable=True)
    notes            = Column(Text,        nullable=True)
    company_id       = Column(Integer, ForeignKey("companies.id"),
                              nullable=True, index=True)
