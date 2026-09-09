from pydantic import BaseModel
from typing import Optional, List, Any

class PurchaseOrderCreate(BaseModel):
    model_config = {"extra": "allow"}
    gst_mode: Optional[str] = "cgst_sgst"

class PurchaseOrderUpdate(BaseModel):
    model_config = {"extra": "allow"}
    gst_mode: Optional[str] = None

class PurchaseOrderResponse(BaseModel):
    model_config = {"extra": "allow"}
    gst_mode: Optional[str] = "cgst_sgst"
