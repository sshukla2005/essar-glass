from sqlalchemy import (Column, Integer, String, Boolean,
                        Float, ForeignKey, Text, JSON)
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class WorkshopOrder(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "workshop_orders"

    id           = Column(Integer, primary_key=True, index=True)
    wo_number    = Column(String(20),  unique=True, nullable=False)
    so_id        = Column(Integer, ForeignKey("sales_orders.id"),
                          nullable=True)
    customer_id  = Column(Integer, ForeignKey("customers.id"),
                          nullable=True)
    order_date   = Column(String(20),  nullable=True)
    required_by  = Column(String(20),  nullable=True)
    priority     = Column(String(20),  default="normal")
    status       = Column(String(30),  default="draft", index=True)
    instructions = Column(Text,        nullable=True)
    lines        = Column(JSON,        nullable=True)
    so_number      = Column(String(20),  nullable=True)
    customer_name  = Column(String(200), nullable=True)
    jobwork_vendor = Column(String(200), nullable=True)
    company_id   = Column(Integer, ForeignKey("companies.id"),
                          nullable=True, index=True)

class TougheningBatch(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "toughening_batches"

    id              = Column(Integer, primary_key=True, index=True)
    tb_number       = Column(String(20),  unique=True, nullable=False)
    vendor_id       = Column(Integer, ForeignKey("vendors.id"),
                             nullable=True)
    sent_date       = Column(String(20),  nullable=True)
    expected_return = Column(String(20),  nullable=True)
    status          = Column(String(30),  default="draft", index=True)
    lines           = Column(JSON,        nullable=True)
    total_sqmt      = Column(Float,       default=0)
    total_amount    = Column(Float,       default=0)
    vendor_name    = Column(String(200), nullable=True)
    wo_ids         = Column(JSON,        nullable=True)
    batch_date     = Column(String(20),  nullable=True)
    total_pieces   = Column(Integer,     default=0)
    company_id      = Column(Integer, ForeignKey("companies.id"),
                             nullable=True, index=True)
