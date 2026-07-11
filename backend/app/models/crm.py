from sqlalchemy import (Column, Integer, String, Boolean,
                        Float, ForeignKey, Text, DateTime, JSON)
from sqlalchemy.sql import func
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class CRMStage(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "crm_stages"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(100), nullable=False)
    sequence    = Column(Integer,     default=10)
    probability = Column(Integer,     default=10)
    is_won      = Column(Boolean,     default=False)
    is_lost     = Column(Boolean,     default=False)
    fold        = Column(Boolean,     default=False)
    company_id  = Column(Integer, ForeignKey("companies.id"),
                         nullable=True)

class CRMLead(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "crm_leads"

    id                = Column(Integer, primary_key=True, index=True)
    lead_number       = Column(String(20),  unique=True, nullable=False)
    name              = Column(String(300), nullable=False)
    stage_id          = Column(Integer, ForeignKey("crm_stages.id"),
                               nullable=True)
    customer_id       = Column(Integer, ForeignKey("customers.id"),
                               nullable=True)
    contact_name      = Column(String(200), nullable=True)
    company_name      = Column(String(200), nullable=True)
    phone             = Column(String(20),  nullable=True)
    email             = Column(String(200), nullable=True)
    expected_revenue  = Column(Float,       default=0)
    probability       = Column(Integer,     default=10)
    priority          = Column(String(20),  default="normal")
    salesperson       = Column(String(200), nullable=True)
    expected_closing  = Column(String(20),  nullable=True)
    lost_reason       = Column(Text,        nullable=True)
    lead_type         = Column(String(20),  default="opportunity")
    extra_data        = Column(JSON, nullable=True)
    company_id        = Column(Integer, ForeignKey("companies.id"),
                               nullable=True, index=True)
