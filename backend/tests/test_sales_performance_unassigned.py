"""Data Quality Warning: the quotes / SOs with no salesperson are listed, matching the counts."""
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
from app.models import User, SalesOrder, Quotation
from app.services.auth_service import create_access_token, hash_password

client = TestClient(app)
PERIOD = {"from": "2019-04-01", "to": "2019-04-30"}   # isolated period


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _cleanup(db: Session):
    db.query(SalesOrder).filter(SalesOrder.so_number.like("SO-UA-%")).delete(synchronize_session=False)
    db.query(Quotation).filter(Quotation.quote_number.like("QT-UA-%")).delete(synchronize_session=False)
    db.query(User).filter(User.username == "unassigned_admin").delete()
    db.commit()


@pytest.fixture
def headers(db_session: Session):
    _cleanup(db_session)
    admin = User(username="unassigned_admin", password=hash_password("Pass123!"), name="Unassigned Admin",
                 role="admin", company_id=1, data_scope="company")
    db_session.add(admin)
    db_session.commit()
    sid = secrets.token_urlsafe(16)
    admin.current_session_id = sid
    db_session.commit()
    yield {"Authorization": "Bearer " + create_access_token(admin.id, admin.role, company_id=1, active_company_id=1, session_id=sid)}
    _cleanup(db_session)


def test_unassigned_documents_are_listed(db_session: Session, headers):
    db_session.add_all([
        SalesOrder(so_number="SO-UA-1", order_date="2019-04-12", status="confirmed", company_id=1, is_active=True,
                   total_amount=1500, customer_name="UA Customer", salesperson=""),
        SalesOrder(so_number="SO-UA-REP", order_date="2019-04-13", status="confirmed", company_id=1, is_active=True,
                   total_amount=900, customer_name="UA Customer", salesperson="Some Rep"),     # assigned: not listed
        SalesOrder(so_number="SO-UA-OTHERCO", order_date="2019-04-13", status="confirmed", company_id=2,
                   is_active=True, total_amount=900, salesperson=None),                     # other company
        Quotation(quote_number="QT-UA-1", quote_date="2019-04-20", status="draft", company_id=1, is_active=True,
                  total_amount=700, salesperson=None),
    ])
    db_session.commit()

    resp = client.get("/api/v1/reports/sales-performance", params=PERIOD, headers=headers)
    assert resp.status_code == 200, resp.text
    dq = resp.json()["data_quality"]
    docs = dq["blank_salesperson_docs"]
    assert dq["blank_salesperson_sos"] == 1 and dq["blank_salesperson_quotes"] == 1
    assert [(d["type"], d["number"]) for d in docs] == [("quotation", "QT-UA-1"), ("sales_order", "SO-UA-1")]  # newest first
    so = docs[1]
    assert so["customer_name"] == "UA Customer" and so["date"] == "2019-04-12" and so["total_amount"] == 1500
