from pydantic import BaseModel
from typing import Generic, TypeVar, List, Optional
from datetime import datetime

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items:     List[T]
    total:     int
    page:      int
    page_size: int
    pages:     int

class StatusUpdate(BaseModel):
    status: str

class MessageResponse(BaseModel):
    message: str
    success: bool = True

class DropdownItem(BaseModel):
    id:    int
    name:  str
    code:  Optional[str] = None
