from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, Date
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class Payment(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "payments"

    id               = Column(Integer, primary_key=True, index=True)
    payment_number   = Column(String(20), nullable=False, index=True)  # unique per-company (see migration)
    customer_id      = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    so_id            = Column(Integer, ForeignKey("sales_orders.id"), nullable=True, index=True)
    amount           = Column(Float, nullable=False, default=0)
    payment_mode     = Column(String(30), nullable=False)  # cash, upi, neft, cheque, card
    payment_account  = Column(String(200), nullable=True)  # e.g. "HDFC UPI - essar@hdfcbank"
    payment_reference = Column(String(200), nullable=True) # UTR / cheque no
    payment_date     = Column(String(20), nullable=True)
    notes            = Column(Text, nullable=True)
    company_id       = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
