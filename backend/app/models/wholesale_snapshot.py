from sqlalchemy import Column, Integer, String, Float, DateTime, Index
from sqlalchemy.sql import func
from app.database import Base


class WholesaleSnapshot(Base):
    __tablename__ = "wholesale_snapshots"

    id            = Column(Integer, primary_key=True, index=True)
    source        = Column(String(50), nullable=False, index=True)
    stock_value   = Column(Float, default=0)
    total_sheets  = Column(Integer, default=0)
    total_sqm     = Column(Float, default=0)
    total_tonnage = Column(Float, default=0)
    total_skus    = Column(Integer, default=0)
    low_stock     = Column(Integer, default=0)
    month_revenue = Column(Float, default=0)
    month_orders  = Column(Integer, default=0)
    month_profit  = Column(Float, default=0)
    open_orders   = Column(Integer, default=0)
    trucks_active = Column(Integer, default=0)
    synced_at     = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
