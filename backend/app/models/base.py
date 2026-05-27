from sqlalchemy import Column, Integer, Boolean, DateTime, String
from sqlalchemy.sql import func
from app.database import Base

class TimestampMixin:
    created_at = Column(DateTime(timezone=True),
                        server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(),
                        onupdate=func.now(), nullable=False)

class SoftDeleteMixin:
    is_active = Column(Boolean, default=True, nullable=False)

class CompanyMixin:
    # Every record belongs to a company
    from sqlalchemy import ForeignKey
    company_id = Column(Integer,
                        ForeignKey("companies.id", ondelete="CASCADE"),
                        nullable=True, index=True)
