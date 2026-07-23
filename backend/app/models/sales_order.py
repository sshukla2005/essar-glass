from sqlalchemy import (Column, Integer, String, Boolean,
                        Float, ForeignKey, Text, JSON)
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class SalesOrder(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "sales_orders"

    id               = Column(Integer, primary_key=True, index=True)
    so_number        = Column(String(20),  nullable=False, index=True)  # unique per-company (see migration)
    customer_id      = Column(Integer, ForeignKey("customers.id"),
                              nullable=True)
    quotation_id     = Column(Integer, ForeignKey("quotations.id"),
                              nullable=True)
    crm_lead_id      = Column(Integer, ForeignKey("crm_leads.id"),
                              nullable=True)
    order_date       = Column(String(20),  nullable=True)
    delivery_date    = Column(String(20),  nullable=True)
    salesperson      = Column(String(200), nullable=True)
    payment_terms    = Column(String(50),  nullable=True)
    status           = Column(String(30),  default="draft", index=True)
    lines            = Column(JSON,        nullable=True)
    groups           = Column(JSON,        nullable=True)
    hardware_items   = Column(JSON,        nullable=True, default=list)
    labor_items      = Column(JSON,        nullable=True, default=list)
    wastage_items    = Column(JSON,        nullable=True, default=list)
    dc_cost          = Column(Float,       default=0)
    totals           = Column(JSON,        nullable=True)
    processes        = Column(JSON,        nullable=True, default=list)
    subtotal         = Column(Float,       default=0)
    tax_amount       = Column(Float,       default=0)
    total_amount     = Column(Float,       default=0)
    notes            = Column(Text,        nullable=True)
    gst_mode         = Column(String(20), default='cgst_sgst')
    dc_charges       = Column(Float, default=0)
    discount_amount  = Column(Float, default=0)
    advance_received = Column(Float, default=0)
    customer_name    = Column(String(200), nullable=True)
    warehouse_id     = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    internal_notes   = Column(Text, nullable=True)
    customer_note    = Column(Text, nullable=True)
    company_id       = Column(Integer, ForeignKey("companies.id"),
                              nullable=True, index=True)
