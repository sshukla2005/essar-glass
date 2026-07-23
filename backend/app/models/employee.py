from sqlalchemy import Column, Integer, String, Boolean, Date, ForeignKey, JSON
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin

class Employee(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "employees"

    id            = Column(Integer, primary_key=True, index=True)
    employee_code = Column(String(20),  nullable=False, index=True)  # unique per-company (see migration)
    name          = Column(String(200), nullable=False, index=True)
    designation   = Column(String(200), nullable=True)
    department    = Column(String(100), nullable=True)
    work_email    = Column(String(200), nullable=True)
    work_phone    = Column(String(20),  nullable=True)
    joining_date  = Column(Date,        nullable=True)
    extra_data    = Column(JSON, nullable=True)
    company_id    = Column(Integer, ForeignKey("companies.id"),
                           nullable=True, index=True)
