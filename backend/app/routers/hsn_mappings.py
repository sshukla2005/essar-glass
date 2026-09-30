"""HS code mapping admin (superadmin only) and lookup.

GET    /api/v1/hsn-mappings              list rows (all companies and global)
POST   /api/v1/hsn-mappings              add a row
PATCH  /api/v1/hsn-mappings/{id}         change hs_code and/or is_active
GET    /api/v1/hsn-mappings/resolve      HS code for a product or a type/category (any user)
"""
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.company import Company
from app.models.hsn_mapping import HsnMapping
from app.models.product import Product
from app.services.hsn_service import normalize, resolve_hs_code, DEFAULT_HS_CODE
from app.utils.helpers import apply_company_filter

router = APIRouter(prefix="/api/v1/hsn-mappings", tags=["HSN Mapping"])

HS_CODE_RE = re.compile(r"^\d{4,8}$")


def _superadmin(user = Depends(get_current_user)):
    if user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin access required")
    return user


class HsnMappingCreate(BaseModel):
    company_id: Optional[int] = None
    glass_type: str
    glass_category: Optional[str] = None
    hs_code: str


class HsnMappingUpdate(BaseModel):
    hs_code: Optional[str] = None
    is_active: Optional[bool] = None


def _clean_code(code: str) -> str:
    code = (code or "").strip()
    if not HS_CODE_RE.match(code):
        raise HTTPException(status_code=400, detail="HS code must be 4 to 8 digits")
    return code


def _find_active_duplicate(db, company_id, glass_type, glass_category, exclude_id=None):
    q = db.query(HsnMapping).filter(
        HsnMapping.is_active == True,
        func.lower(func.trim(HsnMapping.glass_type)) == normalize(glass_type),
    )
    q = q.filter(HsnMapping.company_id == company_id) if company_id is not None else q.filter(HsnMapping.company_id.is_(None))
    if exclude_id is not None:
        q = q.filter(HsnMapping.id != exclude_id)
    cat = normalize(glass_category)
    return next((r for r in q.all() if normalize(r.glass_category) == cat), None)


def _row(r: HsnMapping, company_names: dict) -> dict:
    return {
        "id": r.id,
        "company_id": r.company_id,
        "company_name": company_names.get(r.company_id) if r.company_id else None,
        "glass_type": r.glass_type,
        "glass_category": r.glass_category,
        "hs_code": r.hs_code,
        "is_active": r.is_active,
        "updated_at": r.updated_at,
    }


def _company_names(db) -> dict:
    return dict(db.query(Company.id, Company.name).all())


@router.get("/resolve")
def resolve(
    product_id:     Optional[int] = Query(None),
    glass_type:     Optional[str] = Query(None),
    glass_category: Optional[str] = Query(None),
    db:   Session = Depends(get_db),
    user = Depends(get_current_user),
):
    cid = user.active_company_id
    if product_id is not None:
        q = apply_company_filter(db.query(Product).filter(Product.id == product_id), Product, cid)
        product = q.first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        code = resolve_hs_code(db, company_id=cid, glass_type=product.glass_type,
                               glass_category=product.glass_category, product_hsn_code=product.hsn_code)
    else:
        code = resolve_hs_code(db, company_id=cid, glass_type=glass_type, glass_category=glass_category)
    return {"hs_code": code, "default": DEFAULT_HS_CODE}


@router.get("")
def list_mappings(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    user = Depends(_superadmin),
):
    q = db.query(HsnMapping)
    if not include_inactive:
        q = q.filter(HsnMapping.is_active == True)
    rows = q.order_by(HsnMapping.company_id.nullsfirst(), HsnMapping.glass_type, HsnMapping.glass_category.nullsfirst()).all()
    names = _company_names(db)
    return {"items": [_row(r, names) for r in rows], "default_hs_code": DEFAULT_HS_CODE}


@router.post("", status_code=201)
def create_mapping(data: HsnMappingCreate, db: Session = Depends(get_db), user = Depends(_superadmin)):
    glass_type = (data.glass_type or "").strip()
    if not glass_type:
        raise HTTPException(status_code=400, detail="Glass type is required")
    glass_category = (data.glass_category or "").strip() or None
    if data.company_id is not None and not db.query(Company).filter(Company.id == data.company_id).first():
        raise HTTPException(status_code=400, detail="Company not found")
    if _find_active_duplicate(db, data.company_id, glass_type, glass_category):
        raise HTTPException(status_code=409, detail="An active mapping for this company, type and category already exists")
    row = HsnMapping(company_id=data.company_id, glass_type=glass_type, glass_category=glass_category,
                     hs_code=_clean_code(data.hs_code), is_active=True)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row(row, _company_names(db))


@router.patch("/{mapping_id}")
def update_mapping(mapping_id: int, data: HsnMappingUpdate, db: Session = Depends(get_db), user = Depends(_superadmin)):
    row = db.query(HsnMapping).filter(HsnMapping.id == mapping_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if data.hs_code is not None:
        row.hs_code = _clean_code(data.hs_code)
    if data.is_active is not None:
        if data.is_active and not row.is_active and _find_active_duplicate(
                db, row.company_id, row.glass_type, row.glass_category, exclude_id=row.id):
            raise HTTPException(status_code=409, detail="An active mapping for this company, type and category already exists")
        row.is_active = data.is_active
    db.commit()
    db.refresh(row)
    return _row(row, _company_names(db))
