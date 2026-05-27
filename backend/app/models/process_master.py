from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class ProcessMaster(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "process_masters"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(200), nullable=False, index=True)
    process_type = Column(String(50),  nullable=False)  # hole, cutout, farma, forma, polishing, toughening
    charge_type  = Column(String(30),  default="per_piece")  # per_piece, per_sqft, per_rft, per_sqmt, fixed
    rate         = Column(Float,       default=0)
    hsn_code     = Column(String(20),  nullable=True)
    company_id   = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
