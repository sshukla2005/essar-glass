from pydantic import BaseModel
from typing import Optional

class CustomerCreate(BaseModel):
    model_config = {"extra": "allow"}
    address: Optional[str] = None
    address_line2: Optional[str] = None

class CustomerUpdate(BaseModel):
    model_config = {"extra": "allow"}
    address: Optional[str] = None
    address_line2: Optional[str] = None

class CustomerResponse(BaseModel):
    model_config = {"extra": "allow"}
    address: Optional[str] = None
    address_line2: Optional[str] = None
