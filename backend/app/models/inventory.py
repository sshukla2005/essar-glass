from sqlalchemy import (Column, Integer, String, Float,
                        ForeignKey, Text)
from app.database import Base
from app.models.base import TimestampMixin

class StockMovement(Base, TimestampMixin):
    __tablename__ = "stock_movements"

    id             = Column(Integer, primary_key=True, index=True)
    move_number    = Column(String(20),  nullable=False, index=True)  # unique per-company (see migration)
    product_id     = Column(Integer, ForeignKey("products.id"),
                            nullable=True)
    movement_type  = Column(String(20),  nullable=False)
    quantity       = Column(Float,       nullable=False)
    quantity_sqm   = Column(Float,       nullable=True)
    quantity_sheets= Column(Float,       nullable=True)
    warehouse_id   = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    unit_rate      = Column(Float,       nullable=True)
    total_value    = Column(Float,       nullable=True)
    reference      = Column(String(100), nullable=True)
    remarks        = Column(Text,        nullable=True)
    date           = Column(String(30),  nullable=True)
    company_id     = Column(Integer, ForeignKey("companies.id"),
                            nullable=True, index=True)
