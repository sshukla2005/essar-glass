from sqlalchemy import (Column, Integer, String, Float, ForeignKey, Text, JSON)
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class DeliveryNote(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "delivery_notes"

    id                  = Column(Integer, primary_key=True, index=True)
    company_id          = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    note_number         = Column(String(50), nullable=False, index=True)
    note_date           = Column(String(20), nullable=True)
    
    consignee_name      = Column(String(255), nullable=True)
    consignee_address   = Column(Text, nullable=True)
    consignee_state     = Column(String(100), nullable=True)
    consignee_state_code= Column(String(10), nullable=True)
    consignee_gstin     = Column(String(50), nullable=True)

    buyer_name          = Column(String(255), nullable=True)
    buyer_address       = Column(Text, nullable=True)
    buyer_state         = Column(String(100), nullable=True)
    buyer_state_code    = Column(String(10), nullable=True)
    buyer_gstin         = Column(String(50), nullable=True)

    place_of_supply     = Column(String(100), nullable=True)
    eway_bill_no        = Column(String(100), nullable=True)
    payment_terms       = Column(String(200), nullable=True)
    reference_no        = Column(String(100), nullable=True)
    other_references    = Column(Text, nullable=True)
    buyers_order_no     = Column(String(100), nullable=True)
    buyers_order_date   = Column(String(20), nullable=True)
    dispatch_doc_no     = Column(String(100), nullable=True)
    dispatched_through  = Column(String(100), nullable=True)
    destination         = Column(String(100), nullable=True)
    terms_of_delivery   = Column(Text, nullable=True)

    lines               = Column(JSON, nullable=True)
    total_amount        = Column(Float, default=0.0)
    
    created_by          = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)


class DocumentSequence(Base):
    __tablename__ = "document_sequences"

    id                  = Column(Integer, primary_key=True, index=True)
    company_id          = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    doc_type            = Column(String(50), nullable=False, index=True)
    financial_year      = Column(String(20), nullable=False, index=True)
    current_sequence    = Column(Integer, nullable=False, default=1)
