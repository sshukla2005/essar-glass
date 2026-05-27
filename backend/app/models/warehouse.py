from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class Warehouse(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "warehouses"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(200), nullable=False, index=True)
    code       = Column(String(20),  nullable=True)
    address    = Column(Text,        nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
