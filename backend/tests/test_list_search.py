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
from app.models import User, Quotation, SalesOrder, Invoice, WorkshopOrder, PurchaseOrder, Customer
from app.services.auth_service import create_access_token, hash_password

client = TestClient(app)
TAG = "ZQSRCH"   # unique token so other rows in the database never match


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _cleanup(db: Session):
    db.query(Quotation).filter(Quotation.quote_number.like(f"{TAG}%")).delete(synchronize_session=False)
    db.query(SalesOrder).filter(SalesOrder.so_number.like(f"{TAG}%")).delete(synchronize_session=False)
    db.query(Invoice).filter(Invoice.invoice_number.like(f"{TAG}%")).delete(synchronize_session=False)
    db.query(WorkshopOrder).filter(WorkshopOrder.wo_number.like(f"{TAG}%") | WorkshopOrder.customer_name.like(f"{TAG}%")).delete(synchronize_session=False)
    db.query(PurchaseOrder).filter(PurchaseOrder.po_number.like(f"{TAG}%")).delete(synchronize_session=False)
    db.query(Customer).filter(Customer.customer_code.like(f"{TAG}%")).delete(synchronize_session=False)
    db.query(User).filter(User.username == "list_search_admin").delete()
    db.commit()


@pytest.fixture
def headers(db_session: Session):
    _cleanup(db_session)
    admin = User(username="list_search_admin", password=hash_password("Pass123!"), name="List Search Admin",
                 role="admin", company_id=1, data_scope="company")
    db_session.add(admin)
    db_session.commit()
    sid = secrets.token_urlsafe(16)
    admin.current_session_id = sid
    db_session.commit()
    token = create_access_token(admin.id, admin.role, company_id=1, active_company_id=1, session_id=sid)
    yield {"Authorization": f"Bearer {token}"}
    _cleanup(db_session)


def _search(headers, endpoint, term, **extra):
    resp = client.get(f"/api/v1/{endpoint}/", params={"page": 1, "page_size": 200, "search": term, **extra}, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_list_search_filters_each_model(db_session: Session, headers):
    common = dict(company_id=1, is_active=True)
    db_session.add_all([
        Quotation(quote_number=f"{TAG}-Q1", salesperson=f"{TAG} Rep Alpha", status="draft", **common),
        Quotation(quote_number=f"{TAG}-Q2", salesperson="Someone Else", status="draft", **common),
        SalesOrder(so_number=f"{TAG}-S1", salesperson="Rep", customer_name=f"{TAG} Buyer", status="draft", **common),
        SalesOrder(so_number=f"{TAG}-S2", salesperson=f"{TAG} Rep", customer_name="Other", status="draft", **common),
        Invoice(invoice_number=f"{TAG}-I1", status="draft", **common),
        WorkshopOrder(wo_number=f"{TAG}-W1", customer_name="Plain", status="draft", **common),
        WorkshopOrder(wo_number="WO-PLAIN-ZQ", customer_name=f"{TAG} Glass Co", status="draft", **common),
        PurchaseOrder(po_number=f"{TAG}-P1", status="draft", **common),
        Customer(customer_code=f"{TAG}-C1", name=f"{TAG} Customer", **common),
    ])
    db_session.commit()

    def numbers(data, field):
        return sorted(i[field] for i in data["items"])

    # Quotations: quote number and salesperson, case-insensitive
    assert numbers(_search(headers, "quotations", f"{TAG}-Q", status="all"), "quote_number") == [f"{TAG}-Q1", f"{TAG}-Q2"]
    assert numbers(_search(headers, "quotations", f"{TAG.lower()} rep alpha", status="all"), "quote_number") == [f"{TAG}-Q1"]
    # Sales orders: number, salesperson, customer name
    assert numbers(_search(headers, "sales-orders", f"{TAG} Buyer"), "so_number") == [f"{TAG}-S1"]
    assert numbers(_search(headers, "sales-orders", f"{TAG} Rep"), "so_number") == [f"{TAG}-S2"]
    # Invoices, workshop orders, purchase orders
    assert numbers(_search(headers, "invoices", f"{TAG}-I"), "invoice_number") == [f"{TAG}-I1"]
    assert numbers(_search(headers, "workshop", TAG), "wo_number") == sorted([f"{TAG}-W1", "WO-PLAIN-ZQ"])
    assert numbers(_search(headers, "purchase-orders", f"{TAG}-P"), "po_number") == [f"{TAG}-P1"]
    # Customers still search by name
    assert [i["name"] for i in _search(headers, "customers", f"{TAG} Customer")["items"]] == [f"{TAG} Customer"]

    # A search matching nothing returns nothing, on every model
    for endpoint, extra in (("quotations", {"status": "all"}), ("sales-orders", {}), ("invoices", {}),
                            ("workshop", {}), ("purchase-orders", {}), ("customers", {})):
        data = _search(headers, endpoint, f"{TAG}-no-such-thing", **extra)
        assert data["total"] == 0 and data["items"] == [], endpoint
