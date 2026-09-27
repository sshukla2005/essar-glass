import os
import sys
import secrets
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from app.database import SessionLocal
from app.models import User, Quotation, CRMLead
from app.services.auth_service import create_access_token, hash_password

client = TestClient(app)
PERIOD = {"from": "2019-05-01", "to": "2019-05-31"}   # isolated from other data


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _cleanup(db: Session):
    db.query(Quotation).filter(Quotation.quote_number.like("QT-SPK-%")).delete(synchronize_session=False)
    db.query(CRMLead).filter(CRMLead.lead_number == "LEAD-SPK-1").delete(synchronize_session=False)
    db.query(User).filter(User.username == "spk_admin").delete()
    db.commit()


@pytest.fixture
def headers(db_session: Session):
    _cleanup(db_session)
    admin = User(username="spk_admin", password=hash_password("Pass123!"), name="SPK Admin",
                 role="admin", company_id=1, data_scope="company")
    db_session.add(admin)
    db_session.commit()
    sid = secrets.token_urlsafe(16)
    admin.current_session_id = sid
    db_session.commit()
    token = create_access_token(admin.id, admin.role, company_id=1, active_company_id=1, session_id=sid)
    yield {"Authorization": f"Bearer {token}"}
    _cleanup(db_session)


def test_quote_salesperson_keys_follow_report_resolution(db_session: Session, headers):
    lead = CRMLead(lead_number="LEAD-SPK-1", name="SPK lead", salesperson="Zed Spk", company_id=1, is_active=True)
    db_session.add(lead)
    db_session.commit()

    def q(num, salesperson, status, lead_id=None):
        return Quotation(quote_number=num, salesperson=salesperson, status=status, crm_lead_id=lead_id,
                         quote_date="2019-05-10", total_amount=100.0, company_id=1, is_active=True)

    db_session.add_all([
        q("QT-SPK-1", "Zed Spk", "converted"),
        q("QT-SPK-2", "  zed   SPK ", "lost"),                 # other spelling, same person
        q("QT-SPK-3", "", "draft", lead_id=lead.id),           # blank: falls back to the lead's salesperson
        q("QT-SPK-4", None, "sent"),                           # blank, no lead: Unassigned
        q("QT-SPK-5", "Zed Spk", "cancelled"),                 # cancelled: not counted, not mapped
    ])
    db_session.commit()
    ids = {x.quote_number: x.id for x in db_session.query(Quotation).filter(Quotation.quote_number.like("QT-SPK-%"))}

    resp = client.get("/api/v1/reports/sales-performance", params=PERIOD, headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    keys = {int(k): v for k, v in data["quote_salesperson_keys"].items()}

    assert keys[ids["QT-SPK-1"]] == keys[ids["QT-SPK-2"]] == keys[ids["QT-SPK-3"]] == "zed spk"
    assert keys[ids["QT-SPK-4"]] == "unassigned"
    assert ids["QT-SPK-5"] not in keys

    rows = {r["sp_key"]: r for r in data["salespeople"]}
    zed = rows["zed spk"]
    assert zed["salesperson"].lower() == "zed spk"   # display casing is picked by the report
    assert (zed["quotes_won"], zed["quotes_lost"], zed["quotes_pending"]) == (1, 1, 1)
    # every row's quotation count equals the quotations mapped to its key
    for key, row in rows.items():
        assert row["quotes_created"] == sum(1 for v in keys.values() if v == key), key
