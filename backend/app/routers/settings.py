from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.company_settings import CompanySetting
from app.deps import get_current_user
from pydantic import BaseModel
from typing import Optional
import json

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

class SettingUpsert(BaseModel):
    key: str
    value: str  # JSON string
    company_id: Optional[int] = None

@router.get("/{key}")
def get_setting(
    key: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    company_id = getattr(user, 'company_id', None)
    setting = db.query(CompanySetting).filter(
        CompanySetting.key == key,
        CompanySetting.company_id == company_id
    ).first()
    if not setting:
        # Try global (company_id = None)
        setting = db.query(CompanySetting).filter(
            CompanySetting.key == key,
            CompanySetting.company_id == None
        ).first()
    if not setting:
        return { "key": key, "value": None }
    return { "key": key, "value": setting.value }

@router.post("/")
def upsert_setting(
    data: SettingUpsert,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    company_id = data.company_id or getattr(user, 'company_id', None)
    setting = db.query(CompanySetting).filter(
        CompanySetting.key == data.key,
        CompanySetting.company_id == company_id
    ).first()
    if setting:
        setting.value = data.value
    else:
        setting = CompanySetting(
            key=data.key,
            value=data.value,
            company_id=company_id
        )
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return { "key": setting.key, "value": setting.value }

@router.get("/")
def list_settings(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    company_id = getattr(user, 'company_id', None)
    settings = db.query(CompanySetting).filter(
        CompanySetting.company_id == company_id
    ).all()
    return { "items": [{ "key": s.key, "value": s.value } for s in settings] }
