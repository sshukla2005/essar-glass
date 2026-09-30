from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from app.database import Base
from app.models.base import TimestampMixin


class HsnMapping(Base, TimestampMixin):
    """HS code for a glass type (and optionally category). company_id NULL applies
    to every company; glass_category NULL applies to every category of the type.
    Matching is case-insensitive and trimmed; see app/services/hsn_service.py."""
    __tablename__ = "hsn_mappings"

    id             = Column(Integer, primary_key=True, index=True)
    company_id     = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    glass_type     = Column(String(100), nullable=False)
    glass_category = Column(String(100), nullable=True)
    hs_code        = Column(String(20),  nullable=False)
    is_active      = Column(Boolean, nullable=False, default=True, server_default="true")
