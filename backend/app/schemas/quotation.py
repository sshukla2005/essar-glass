from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class QuotationCreate(BaseModel):
    model_config = {"extra": "allow"}
    lost_reason: Optional[str] = None
    lost_at: Optional[datetime] = None

class QuotationUpdate(BaseModel):
    model_config = {"extra": "allow"}
    lost_reason: Optional[str] = None
    lost_at: Optional[datetime] = None

class QuotationResponse(BaseModel):
    model_config = {"extra": "allow"}
    lost_reason: Optional[str] = None
    lost_at: Optional[datetime] = None
