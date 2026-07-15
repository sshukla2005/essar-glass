from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
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
    value: str
    company_id: Optional[int] = None

@router.get("/")
def list_settings(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    # Use active_company_id so settings are scoped to the currently viewed company
    company_id = user.active_company_id
    settings = db.query(CompanySetting).filter(
        CompanySetting.company_id == company_id
    ).all()
    return { "items": [{ "key": s.key, "value": s.value } for s in settings] }

@router.post("/")
def upsert_setting(
    data: SettingUpsert,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    # Write settings against the user's HOME company (active = RO, blocked by middleware).
    # This endpoint is only reached in non-RO mode (middleware blocks writes when RO).
    company_id = user.active_company_id or getattr(user, 'company_id', None)
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

@router.post("/company/logo")
async def upload_company_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    import base64
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 2MB.")
    mime_type = file.content_type or "image/png"
    b64 = base64.b64encode(contents).decode("utf-8")
    logo_data = f"data:{mime_type};base64,{b64}"
    
    from app.models.company import Company
    company_id = user.active_company_id or getattr(user, 'company_id', None)
    
    if company_id:
        company = db.query(Company).filter(Company.id == company_id).first()
    else:
        company = db.query(Company).first()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company.logo = logo_data
    db.commit()
    return {"logo": logo_data, "message": "Logo uploaded successfully"}

@router.delete("/company/logo")
def delete_company_logo(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    from app.models.company import Company
    company_id = user.active_company_id or getattr(user, 'company_id', None)
    company = db.query(Company).filter(Company.id == company_id).first()
    if company:
        company.logo = None
        db.commit()
    return {"message": "Logo removed"}

@router.get("/{key}")
def get_setting(
    key: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    # Read settings from active company
    company_id = user.active_company_id
    setting = db.query(CompanySetting).filter(
        CompanySetting.key == key,
        CompanySetting.company_id == company_id
    ).first()
    if not setting:
        setting = db.query(CompanySetting).filter(
            CompanySetting.key == key,
            CompanySetting.company_id == None
        ).first()
    if not setting:
        return { "key": key, "value": None }
    return { "key": key, "value": setting.value }