from sqlalchemy import (Column, Integer, String, Boolean,
                        Float, ForeignKey, Text)
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class Customer(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "customers"

    id              = Column(Integer, primary_key=True, index=True)
    customer_code   = Column(String(20),  unique=True, nullable=False)
    name            = Column(String(200), nullable=False, index=True)
    customer_type   = Column(String(50),  default="company")
    gstin           = Column(String(20),  nullable=True)
    gst_treatment   = Column(String(50),  nullable=True)
    pan_number      = Column(String(20),  nullable=True)
    address         = Column(Text,        nullable=True)
    city            = Column(String(100), nullable=True)
    state           = Column(String(100), nullable=True)
    pincode         = Column(String(10),  nullable=True)
    phone           = Column(String(20),  nullable=True)
    mobile          = Column(String(20),  nullable=True)
    email           = Column(String(200), nullable=True)
    payment_terms   = Column(String(50),  nullable=True)
    credit_limit    = Column(Float,       default=0)
    salesperson     = Column(String(200), nullable=True)
    company_id      = Column(Integer, ForeignKey("companies.id"),
                             nullable=True, index=True)
