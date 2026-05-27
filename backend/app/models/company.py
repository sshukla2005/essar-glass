from sqlalchemy import Column, Integer, String, Boolean
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class Company(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "companies"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(200), nullable=False)
    short_name = Column(String(20),  nullable=True)
    color      = Column(String(20),  nullable=True)
    accent     = Column(String(20),  nullable=True)
    gstin      = Column(String(20),  nullable=True)
    address    = Column(String(500), nullable=True)
    city       = Column(String(100), nullable=True)
    state      = Column(String(100), nullable=True)
    pincode    = Column(String(10),  nullable=True)
    phone      = Column(String(20),  nullable=True)
    email      = Column(String(200), nullable=True)
    website    = Column(String(200), nullable=True)
    pan_number = Column(String(20),  nullable=True)
