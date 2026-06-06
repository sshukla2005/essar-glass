from pydantic import BaseModel
from typing import Optional, List, Any

class SalesOrderCreate(BaseModel):
    model_config = {"extra": "allow"}
    hardware_items: Optional[List[Any]] = []
    labor_items: Optional[List[Any]] = []
    wastage_items: Optional[List[Any]] = []
    dc_cost: Optional[float] = 0
    totals: Optional[dict] = None
    processes: Optional[List[Any]] = []

class SalesOrderUpdate(BaseModel):
    model_config = {"extra": "allow"}
    hardware_items: Optional[List[Any]] = []
    labor_items: Optional[List[Any]] = []
    wastage_items: Optional[List[Any]] = []
    dc_cost: Optional[float] = 0
    totals: Optional[dict] = None
    processes: Optional[List[Any]] = []

class SalesOrderResponse(BaseModel):
    model_config = {"extra": "allow"}
    hardware_items: Optional[List[Any]] = []
    labor_items: Optional[List[Any]] = []
    wastage_items: Optional[List[Any]] = []
    dc_cost: Optional[float] = 0
    totals: Optional[dict] = None
    processes: Optional[List[Any]] = []
