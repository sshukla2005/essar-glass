"""companies.pdf_footer_text: seeded by migration z1a2b3c4d5e6, editable through the company API."""
import os
import sys
import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from main import app
from app.database import SessionLocal
from app.models import User, Company
from app.services.auth_service import create_access_token

client = TestClient(app)


def _superadmin_headers(db, company_id):
    user = db.query(User).filter(User.role == "superadmin", User.is_active == True).first()
    sid = uuid.uuid4().hex
    user.current_session_id = sid
    user.session_started_at = datetime.now(timezone.utc)
    db.commit()
    token = create_access_token(user.id, user.role, company_id=company_id, home_company_id=company_id,
                                active_company_id=company_id, session_id=sid)
    return {"Authorization": f"Bearer {token}"}


def test_existing_companies_have_the_factory_footer():
    db = SessionLocal()
    try:
        footers = [c.pdf_footer_text or "" for c in db.query(Company).all()]
        assert footers and all(f.strip() for f in footers)
        assert any("Factory outlet & Reg. Sales Off: EXCEL TRADERS" in f for f in footers)
    finally:
        db.close()


def test_footer_round_trips_and_can_be_cleared():
    db = SessionLocal()
    company = db.query(Company).order_by(Company.id).first()
    original = company.pdf_footer_text
    h = _superadmin_headers(db, company.id)
    try:
        text = "Line one: factory\nGoogle Maps: https://example.test/x\nemail: a@b.test"
        res = client.put(f"/api/v1/companies/{company.id}", json={"pdf_footer_text": text}, headers=h)
        assert res.status_code == 200, res.text
        got = client.get(f"/api/v1/companies/{company.id}", headers=h).json()
        assert got["pdf_footer_text"] == text

        res = client.put(f"/api/v1/companies/{company.id}", json={"pdf_footer_text": ""}, headers=h)
        assert res.status_code == 200, res.text
        assert client.get(f"/api/v1/companies/{company.id}", headers=h).json()["pdf_footer_text"] in ("", None)
    finally:
        db.expire_all()
        c = db.get(Company, company.id)
        c.pdf_footer_text = original
        db.commit()
        db.close()
