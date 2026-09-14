import os
import sys
import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from main import app
from app.database import SessionLocal
from app.models import User, Company, Quotation
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

def test_quotation_lost_model_and_api(db_session: Session):
    headers = get_auth_headers(db_session)
    company = db_session.query(Company).first()
    cid = company.id if company else 1

    # 1. Create a draft quotation
    create_res = client.post("/api/v1/quotations/", json={
        "quote_number": f"QT-LOST-{uuid.uuid4().hex[:4].upper()}",
        "company_id": cid,
        "status": "draft",
        "total_amount": 12000.0,
    }, headers=headers)
    assert create_res.status_code == 201
    quote = create_res.json()
    qid = quote["id"]
    assert quote["status"] == "draft"
    assert quote.get("lost_reason") is None
    assert quote.get("lost_at") is None

    # 2. Mark quotation as lost: persist reason & lost_at then change status
    reason_text = "Customer selected a competitor offering lower lead times"
    now_iso = datetime.now(timezone.utc).isoformat()
    update_res = client.put(f"/api/v1/quotations/{qid}", json={
        "lost_reason": reason_text,
        "lost_at": now_iso,
    }, headers=headers)
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["lost_reason"] == reason_text
    assert updated["lost_at"] is not None

    status_res = client.patch(f"/api/v1/quotations/{qid}/status", json={"status": "lost"}, headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "lost"

    # 3. Check list filtering: lost quotation must NOT appear under active, but must appear under lost and all
    active_res = client.get("/api/v1/quotations/?status=active", headers=headers)
    assert active_res.status_code == 200
    active_items = active_res.json().get("items", [])
    assert not any(item["id"] == qid for item in active_items)

    lost_res = client.get("/api/v1/quotations/?status=lost", headers=headers)
    assert lost_res.status_code == 200
    lost_items = lost_res.json().get("items", [])
    assert any(item["id"] == qid for item in lost_items)

    # 4. Superadmin reopens to draft: lost_reason and lost_at must be retained
    reopen_res = client.patch(f"/api/v1/quotations/{qid}/status", json={"status": "draft"}, headers=headers)
    assert reopen_res.status_code == 200
    reopened = reopen_res.json()
    assert reopened["status"] == "draft"

    fetch_res = client.get(f"/api/v1/quotations/{qid}", headers=headers)
    assert fetch_res.status_code == 200
    persisted = fetch_res.json()
    assert persisted["status"] == "draft"
    assert persisted["lost_reason"] == reason_text
    assert persisted["lost_at"] is not None
