from pydantic import BaseModel
from typing import Optional

class VendorCreate(BaseModel):
    model_config = {"extra": "allow"}
    address: Optional[str] = None
    address_line2: Optional[str] = None

class VendorUpdate(BaseModel):
    model_config = {"extra": "allow"}
    address: Optional[str] = None
    address_line2: Optional[str] = None

class VendorResponse(BaseModel):
    model_config = {"extra": "allow"}
    address: Optional[str] = None
    address_line2: Optional[str] = None
