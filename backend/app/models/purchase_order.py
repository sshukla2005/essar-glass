from sqlalchemy import (Column, Integer, String, Boolean,
                        Float, ForeignKey, Text, JSON)
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class PurchaseOrder(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "purchase_orders"

    id                = Column(Integer, primary_key=True, index=True)
    po_number         = Column(String(20),  unique=True, nullable=False)
    vendor_id         = Column(Integer, ForeignKey("vendors.id"),
                               nullable=True)
    so_id             = Column(Integer, ForeignKey("sales_orders.id"),
                               nullable=True)
    po_date           = Column(String(20),  nullable=True)
    expected_delivery = Column(String(20),  nullable=True)
    payment_terms     = Column(String(50),  nullable=True)
    status            = Column(String(30),  default="draft", index=True)
    lines             = Column(JSON,        nullable=True)
    subtotal          = Column(Float,       default=0)
    tax_amount        = Column(Float,       default=0)
    total_amount      = Column(Float,       default=0)
    vendor_reference  = Column(String(200), nullable=True)
    company_id        = Column(Integer, ForeignKey("companies.id"),
                               nullable=True, index=True)
