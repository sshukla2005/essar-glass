from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, Text, JSON
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class Vendor(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "vendors"

    id            = Column(Integer, primary_key=True, index=True)
    vendor_code   = Column(String(20),  nullable=False, index=True)  # unique per-company (see migration)
    name          = Column(String(200), nullable=False, index=True)
    gstin         = Column(String(20),  nullable=True)
    address       = Column(Text,        nullable=True)
    city          = Column(String(100), nullable=True)
    state         = Column(String(100), nullable=True)
    phone         = Column(String(20),  nullable=True)
    email         = Column(String(200), nullable=True)
    payment_terms = Column(String(50),  nullable=True)
    lead_time     = Column(Integer,     default=7)
    extra_data    = Column(JSON, nullable=True)
    company_id    = Column(Integer, ForeignKey("companies.id"),
                           nullable=True, index=True)
