from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON
from app.database import Base
from app.models.base import TimestampMixin

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id          = Column(Integer, primary_key=True, index=True)
    username    = Column(String(100), unique=True, nullable=False, index=True)
    password    = Column(String(255), nullable=False)
    name        = Column(String(200), nullable=False)
    role        = Column(String(50),  nullable=False, default="sales")
    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=True)
    permissions = Column(JSON, default=list)
    is_active   = Column(Boolean, default=True)
    email       = Column(String(200), nullable=True)
    phone       = Column(String(20),  nullable=True)
