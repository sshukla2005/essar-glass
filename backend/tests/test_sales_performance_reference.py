"""Sales Performance Reference filter (Architect, Online, ...): quotes, SOs, invoices, payments, history, export."""
import os
import sys
import secrets
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from app.database import SessionLocal
from app.models import User, SalesOrder, Quotation
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.customer import Customer
from app.services.auth_service import create_access_token, hash_password

client = TestClient(app)
PERIOD = {"from": "2019-05-01", "to": "2019-05-31"}   # isolated period


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _cleanup(db: Session):
    db.execute(text("delete from payments where payment_number like 'PAY-RF-%'"))
    db.execute(text("delete from invoices where invoice_number like 'INV-RF-%'"))
    db.query(SalesOrder).filter(SalesOrder.so_number.like("SO-RF-%")).delete(synchronize_session=False)
    db.query(Quotation).filter(Quotation.quote_number.like("QT-RF-%")).delete(synchronize_session=False)
    db.query(User).filter(User.username == "reference_admin").delete()
    db.commit()


@pytest.fixture
def headers(db_session: Session):
    _cleanup(db_session)
    admin = User(username="reference_admin", password=hash_password("Pass123!"), name="Reference Admin",
                 role="admin", company_id=1, data_scope="company")
    db_session.add(admin)
    db_session.commit()
    sid = secrets.token_urlsafe(16)
    admin.current_session_id = sid
    db_session.commit()
    yield {"Authorization": "Bearer " + create_access_token(admin.id, admin.role, company_id=1, active_company_id=1, session_id=sid)}
    _cleanup(db_session)


@pytest.fixture
def data(db_session: Session, headers):
    cust = db_session.query(Customer).filter(Customer.company_id == 1).first()
    q1 = Quotation(quote_number="QT-RF-ARCH", quote_date="2019-05-10", status="converted", company_id=1, is_active=True,
                   total_amount=1000, salesperson="Ref Rep", order_reference="architect")
    q2 = Quotation(quote_number="QT-RF-ONL", quote_date="2019-05-11", status="sent", company_id=1, is_active=True,
                   total_amount=500, salesperson="Ref Rep", order_reference="online")
    db_session.add_all([q1, q2]); db_session.flush()
    # so1 has no Reference of its own: it counts under its quotation's (architect)
    so1 = SalesOrder(so_number="SO-RF-ARCH", order_date="2019-05-12", status="confirmed", company_id=1, is_active=True,
                     total_amount=2000, salesperson="Ref Rep", quotation_id=q1.id, customer_id=cust.id)
    so2 = SalesOrder(so_number="SO-RF-ONL", order_date="2019-05-13", status="confirmed", company_id=1, is_active=True,
                     total_amount=700, salesperson="Ref Rep", order_reference="online", customer_id=cust.id)
    db_session.add_all([so1, so2]); db_session.flush()
    db_session.add_all([
        Invoice(invoice_number="INV-RF-1", invoice_date="2019-05-20", status="sent", company_id=1, is_active=True,
                so_id=so1.id, customer_id=cust.id, total_amount=2360),
        Payment(payment_number="PAY-RF-1", payment_date="2019-05-21", company_id=1, is_active=True, so_id=so1.id,
                customer_id=cust.id, amount=1000, payment_mode="cash"),
        Payment(payment_number="PAY-RF-2", payment_date="2019-05-22", company_id=1, is_active=True, so_id=so2.id,
                customer_id=cust.id, amount=300, payment_mode="cash"),
    ])
    db_session.commit()
    return headers


def _report(h, **extra):
    res = client.get("/api/v1/reports/sales-performance", params={**PERIOD, **extra}, headers=h)
    assert res.status_code == 200, res.text
    return res.json()


def _rep_row(report):
    return next(r for r in report["salespeople"] if r["salesperson"] == "Ref Rep")


def test_reference_filter_narrows_every_total(data):
    allr = _report(data)
    arch = _report(data, reference="architect")
    onl = _report(data, reference="online")
    s_all, s_a, s_o = allr["summary"], arch["summary"], onl["summary"]

    assert (s_a["quotes_created"], s_a["quotes_value"]) == (1, 1000)
    assert (s_o["quotes_created"], s_o["quotes_value"]) == (1, 500)
    assert (s_a["so_count"], s_a["so_value"]) == (1, 2000)        # SO inherits its quotation's Reference
    assert (s_o["so_count"], s_o["so_value"]) == (1, 700)
    assert s_a["invoiced_value"] == 2360 and s_o["invoiced_value"] == 0
    assert s_a["collected_value"] == 1000 and s_o["collected_value"] == 300
    # without the filter, both are included (other data in the period may add more)
    assert s_all["so_value"] >= 2700 and s_all["quotes_value"] >= 1500

    assert _rep_row(arch)["so_value"] == 2000 and _rep_row(arch)["quotes_value"] == 1000
    assert _rep_row(onl)["so_value"] == 700 and _rep_row(onl)["collected_value"] == 300
    assert len(arch["monthly"]) == len(allr["monthly"])          # trend still built with the filter


def test_reference_filter_on_history_and_export(data):
    res = client.get("/api/v1/reports/sales-performance/history", params={**PERIOD, "reference": "online", "page_size": 200},
                     headers=data)
    assert res.status_code == 200, res.text
    docs = {i["doc_number"] for i in res.json()["items"] if "-RF-" in i["doc_number"]}
    assert docs == {"QT-RF-ONL", "SO-RF-ONL"}

    res = client.get("/api/v1/reports/sales-performance/export", params={**PERIOD, "reference": "architect"}, headers=data)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["summary"]["so_value"] == 2000
    assert {i["doc_number"] for i in body["history"] if "-RF-" in i["doc_number"]} == {"QT-RF-ARCH", "SO-RF-ARCH"}


def test_export_without_reference_is_unfiltered(data):
    res = client.get("/api/v1/reports/sales-performance/export", params=PERIOD, headers=data)
    assert res.status_code == 200, res.text
    assert res.json()["summary"]["so_value"] >= 2700
