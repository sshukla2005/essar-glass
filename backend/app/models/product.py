from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, Text
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class Product(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "products"

    id             = Column(Integer, primary_key=True, index=True)
    internal_ref   = Column(String(20),  unique=True, nullable=False)
    name           = Column(String(200), nullable=False, index=True)
    product_type   = Column(String(50),  default="storable")
    glass_type     = Column(String(100), nullable=True)
    glass_category = Column(String(100), nullable=True)
    thickness_mm   = Column(Float,       nullable=True)
    hsn_code       = Column(String(20),  nullable=True)
    sale_price     = Column(Float,       default=0)
    cost_price     = Column(Float,       default=0)
    on_hand_qty    = Column(Float,       default=0)
    min_qty        = Column(Float,       default=0)
    max_qty        = Column(Float,       nullable=True)
    company_id     = Column(Integer, ForeignKey("companies.id"),
                            nullable=True, index=True)
