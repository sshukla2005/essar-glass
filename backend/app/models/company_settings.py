from sqlalchemy import Column, Integer, String, Text, ForeignKey
from app.database import Base
from app.models.base import TimestampMixin

class CompanySetting(Base, TimestampMixin):
    __tablename__ = "company_settings"

    id         = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    key        = Column(String(100), nullable=False, index=True)
    value      = Column(Text, nullable=True)
    # company_id + key is unique
