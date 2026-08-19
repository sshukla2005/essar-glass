from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_user
from app.models.delivery_note import DeliveryNote, DocumentSequence
from app.models.company_settings import CompanySetting
from app.utils.helpers import apply_company_filter, paginate, serialize_row

router = APIRouter(prefix="/delivery-notes", tags=["Delivery Notes"])

class DeliveryNoteCreateSchema(BaseModel):
    note_date: Optional[str] = None
    consignee_name: Optional[str] = None
    consignee_address: Optional[str] = None
    consignee_state: Optional[str] = None
    consignee_state_code: Optional[str] = None
    consignee_gstin: Optional[str] = None

    buyer_name: Optional[str] = None
    buyer_address: Optional[str] = None
    buyer_state: Optional[str] = None
    buyer_state_code: Optional[str] = None
    buyer_gstin: Optional[str] = None

    place_of_supply: Optional[str] = None
    eway_bill_no: Optional[str] = None
    payment_terms: Optional[str] = None
    reference_no: Optional[str] = None
    other_references: Optional[str] = None
    buyers_order_no: Optional[str] = None
    buyers_order_date: Optional[str] = None
    dispatch_doc_no: Optional[str] = None
    dispatched_through: Optional[str] = None
    destination: Optional[str] = None
    terms_of_delivery: Optional[str] = None

    lines: Optional[List[dict]] = None
    total_amount: Optional[float] = 0.0

def get_financial_year(doc_date_str=None):
    if doc_date_str:
        try:
            d = datetime.strptime(str(doc_date_str)[:10], "%Y-%m-%d")
        except Exception:
            d = datetime.now()
    else:
        d = datetime.now()
    
    year = d.year
    if d.month < 4:
        start_year = year - 1
        end_year = year
    else:
        start_year = year
        end_year = year + 1
    
    return f"{str(start_year)[-2:]}-{str(end_year)[-2:]}"

def generate_delivery_note_number(db: Session, company_id: int, doc_date_str=None) -> str:
    fy = get_financial_year(doc_date_str)
    
    prefix = "og"
    start_seq = 211
    
    try:
        s_prefix = db.query(CompanySetting).filter(
            CompanySetting.company_id == company_id,
            CompanySetting.key == "delivery_note_prefix"
        ).first()
        if s_prefix and s_prefix.value and str(s_prefix.value).strip():
            prefix = str(s_prefix.value).strip()
    except Exception:
        pass
        
    try:
        s_seq = db.query(CompanySetting).filter(
            CompanySetting.company_id == company_id,
            CompanySetting.key == "delivery_note_start_seq"
        ).first()
        if s_seq and s_seq.value and str(s_seq.value).strip():
            start_seq = int(str(s_seq.value).strip())
    except Exception:
        pass

    # Lock sequence row using SELECT FOR UPDATE
    seq_record = db.query(DocumentSequence).filter(
        DocumentSequence.company_id == company_id,
        DocumentSequence.doc_type == "delivery_note",
        DocumentSequence.financial_year == fy
    ).with_for_update().first()

    if not seq_record:
        next_seq = start_seq
        seq_record = DocumentSequence(
            company_id=company_id,
            doc_type="delivery_note",
            financial_year=fy,
            current_sequence=next_seq
        )
        db.add(seq_record)
    else:
        next_seq = seq_record.current_sequence + 1
        seq_record.current_sequence = next_seq

    db.flush()
    return f"{prefix}-{next_seq}-{fy}"

@router.get("/")
def list_delivery_notes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    is_active: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    cid = user.active_company_id or user.company_id
    q = db.query(DeliveryNote)
    q = apply_company_filter(q, DeliveryNote, cid)

    if is_active is None or is_active.lower() not in ('all', 'any'):
        active_bool = True if is_active is None else (is_active.lower() in ('true', '1'))
        q = q.filter(DeliveryNote.is_active == active_bool)

    if search:
        s = f"%{search}%"
        q = q.filter(
            (DeliveryNote.note_number.ilike(s)) |
            (DeliveryNote.consignee_name.ilike(s)) |
            (DeliveryNote.buyer_name.ilike(s)) |
            (DeliveryNote.reference_no.ilike(s))
        )

    return paginate(q.order_by(DeliveryNote.id.desc()), page, page_size)

@router.get("/{item_id}")
def get_delivery_note(
    item_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    cid = user.active_company_id or user.company_id
    note = db.query(DeliveryNote).filter(
        DeliveryNote.id == item_id,
        DeliveryNote.company_id == cid
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Delivery Note not found")
    return serialize_row(note)

@router.post("/", status_code=201)
def create_delivery_note(
    data: DeliveryNoteCreateSchema,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    cid = user.active_company_id or user.company_id
    if not cid:
        raise HTTPException(status_code=400, detail="No active company context")

    obj_data = data.model_dump()
    obj_data["company_id"] = cid
    obj_data["created_by"] = user.id

    if not obj_data.get("note_date"):
        obj_data["note_date"] = datetime.now().strftime("%Y-%m-%d")

    obj_data["note_number"] = generate_delivery_note_number(db, cid, obj_data["note_date"])

    note = DeliveryNote(**obj_data)
    db.add(note)
    db.commit()
    db.refresh(note)
    return serialize_row(note)

@router.put("/{item_id}")
def update_delivery_note(
    item_id: int,
    data: DeliveryNoteCreateSchema,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    cid = user.active_company_id or user.company_id
    note = db.query(DeliveryNote).filter(
        DeliveryNote.id == item_id,
        DeliveryNote.company_id == cid
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Delivery Note not found")

    update_data = data.model_dump(exclude_unset=True)
    update_data.pop("company_id", None)
    update_data.pop("note_number", None)

    for k, v in update_data.items():
        setattr(note, k, v)

    db.commit()
    db.refresh(note)
    return serialize_row(note)

@router.delete("/{item_id}")
def delete_delivery_note(
    item_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    cid = user.active_company_id or user.company_id
    note = db.query(DeliveryNote).filter(
        DeliveryNote.id == item_id,
        DeliveryNote.company_id == cid
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Delivery Note not found")

    note.is_active = False
    db.commit()
    return {"message": "Delivery Note deleted"}
