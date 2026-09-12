import os
import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from dotenv import load_dotenv

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from main import app
from app.database import SessionLocal
from app.models import User, Company, PurchaseOrder
from app.services.auth_service import create_access_token

client = TestClient(app)

@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()

def get_auth_headers(db: Session, role="superadmin"):
    user = db.query(User).filter(User.role == role, User.is_active == True).first()
    if not user:
        user = db.query(User).first()
    sid = uuid.uuid4().hex
    user.current_session_id = sid
    user.session_started_at = datetime.now(timezone.utc)
    db.commit()
    company_id = user.company_id or 1
    token = create_access_token(
        user.id, user.role, company_id=company_id, home_company_id=company_id, active_company_id=company_id, session_id=sid
    )
    return {"Authorization": f"Bearer {token}"}

def test_po_unit_mode_model(db_session: Session):
    company = db_session.query(Company).first()
    company_id = company.id if company else 1

    # 1. Default should be 'inch'
    po1 = PurchaseOrder(
        po_number=f"PO-TEST-{uuid.uuid4().hex[:4].upper()}",
        company_id=company_id,
        subtotal=1000.0,
        tax_amount=180.0,
        total_amount=1180.0,
    )
    db_session.add(po1)
    db_session.commit()
    db_session.refresh(po1)
    assert po1.unit_mode == "inch"

    # 2. Explicit 'mm' mode
    po2 = PurchaseOrder(
        po_number=f"PO-TEST-{uuid.uuid4().hex[:4].upper()}",
        company_id=company_id,
        unit_mode="mm",
        subtotal=1000.0,
        tax_amount=180.0,
        total_amount=1180.0,
    )
    db_session.add(po2)
    db_session.commit()
    db_session.refresh(po2)
    assert po2.unit_mode == "mm"

def test_po_unit_mode_api(db_session: Session):
    headers = get_auth_headers(db_session)
    company = db_session.query(Company).first()
    cid = company.id if company else 1

    # Create PO with unit_mode = 'mm'
    res = client.post(
        "/api/v1/purchase-orders/",
        json={
            "po_number": f"PO-API-{uuid.uuid4().hex[:4].upper()}",
            "subtotal": 500.0,
            "tax_amount": 90.0,
            "total_amount": 590.0,
            "unit_mode": "mm",
            "company_id": cid,
        },
        headers=headers,
    )
    assert res.status_code in (200, 201), res.text
    data = res.json()
    assert data.get("unit_mode") == "mm"

    # Update PO to 'inch'
    po_id = data["id"]
    update_res = client.put(
        f"/api/v1/purchase-orders/{po_id}",
        json={"unit_mode": "inch"},
        headers=headers,
    )
    assert update_res.status_code == 200, update_res.text
    updated = update_res.json()
    assert updated.get("unit_mode") == "inch"
