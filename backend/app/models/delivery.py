from sqlalchemy import (Column, Integer, String, Boolean,
                        Float, ForeignKey, Text, JSON)
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class DeliveryChallan(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "delivery_challans"

    id              = Column(Integer, primary_key=True, index=True)
    dc_number       = Column(String(20),  unique=True, nullable=False)
    customer_id     = Column(Integer, ForeignKey("customers.id"),
                             nullable=True)
    so_id           = Column(Integer, ForeignKey("sales_orders.id"),
                             nullable=True)
    dc_date         = Column(String(20),  nullable=True)
    vehicle_number  = Column(String(50),  nullable=True)
    driver_name     = Column(String(200), nullable=True)
    transporter     = Column(String(200), nullable=True)
    status          = Column(String(30),  default="draft", index=True)
    lines           = Column(JSON,        nullable=True)
    extra_data      = Column(JSON, nullable=True)
    company_id      = Column(Integer, ForeignKey("companies.id"),
                             nullable=True, index=True)
