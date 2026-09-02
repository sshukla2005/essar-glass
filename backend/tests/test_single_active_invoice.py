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
from app.models import User, SalesOrder, Invoice, Customer
from app.services.auth_service import create_access_token, hash_password

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def invoice_so_env(db_session: Session):
    # Cleanup
    db_session.query(Invoice).filter(
        Invoice.so_id.in_(db_session.query(SalesOrder.id).filter(SalesOrder.so_number.like("SO-SINGLE-%")))
    ).delete(synchronize_session=False)
    db_session.query(Invoice).filter(
        Invoice.customer_id.in_(db_session.query(Customer.id).filter(Customer.customer_code.like("CUST-SINGLE-%")))
    ).delete(synchronize_session=False)
    db_session.query(SalesOrder).filter(SalesOrder.so_number.like("SO-SINGLE-%")).delete(synchronize_session=False)
    db_session.query(Customer).filter(Customer.customer_code.like("CUST-SINGLE-%")).delete(synchronize_session=False)
    db_session.query(User).filter(User.username == "inv_so_admin").delete(synchronize_session=False)
    db_session.commit()

    admin = User(
        username="inv_so_admin",
        password=hash_password("Pass123!"),
        name="Inv SO Admin",
        role="admin",
        company_id=1,
        data_scope="company",
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)

    sid = secrets.token_urlsafe(16)
    admin.current_session_id = sid
    db_session.commit()

    token = create_access_token(admin.id, admin.role, company_id=1, active_company_id=1, session_id=sid)
    headers = {"Authorization": f"Bearer {token}"}

    cust = Customer(customer_code="CUST-SINGLE-1", name="Single Inv Cust", company_id=1)
    so = SalesOrder(so_number="SO-SINGLE-001", company_id=1, status="confirmed", total_amount=1000.0)
    db_session.add_all([cust, so])
    db_session.commit()
    db_session.refresh(cust)
    db_session.refresh(so)

    c_id = cust.id
    s_id = so.id

    env = {
        "admin": admin,
        "headers": headers,
        "cust": cust,
        "so": so,
    }
    yield env

    # Teardown
    db_session.commit()
    invoices = db_session.query(Invoice).filter((Invoice.customer_id == c_id) | (Invoice.so_id == s_id)).all()
    for inv in invoices:
        db_session.delete(inv)
    db_session.commit()

    so_obj = db_session.query(SalesOrder).filter(SalesOrder.id == s_id).first()
    if so_obj:
        db_session.delete(so_obj)
    cust_obj = db_session.query(Customer).filter(Customer.id == c_id).first()
    if cust_obj:
        db_session.delete(cust_obj)
    db_session.delete(admin)
    db_session.commit()


def test_one_active_invoice_per_so_lifecycle(db_session: Session, invoice_so_env):
    headers = invoice_so_env["headers"]
    cust = invoice_so_env["cust"]
    so = invoice_so_env["so"]

    # 1. Create first invoice for SO -> success 201
    res1 = client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "so_id": so.id,
        "total_amount": 1000.0,
        "status": "draft",
        "lines": [],
    }, headers=headers)
    assert res1.status_code == 201, f"First invoice creation failed: {res1.text}"
    inv1_data = res1.json()
    inv1_id = inv1_data["id"]
    inv1_num = inv1_data["invoice_number"]

    # 2. Try to create second active invoice for same SO -> fails with HTTP 400
    res2 = client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "so_id": so.id,
        "total_amount": 1000.0,
        "status": "draft",
        "lines": [],
    }, headers=headers)
    assert res2.status_code == 400
    assert f"Sales Order already has invoice {inv1_num}" in res2.json()["detail"]

    # 3. Cancel first invoice
    res_cancel = client.patch(f"/api/v1/invoices/{inv1_id}/status", json={"status": "cancelled"}, headers=headers)
    assert res_cancel.status_code == 200

    # 4. Create new invoice for same SO after cancellation -> success 201
    res3 = client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "so_id": so.id,
        "total_amount": 1000.0,
        "status": "draft",
        "lines": [],
    }, headers=headers)
    assert res3.status_code == 201
    inv3_data = res3.json()
    assert inv3_data["id"] != inv1_id

    # 5. Standalone invoices (without so_id) are not restricted
    res_standalone1 = client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "so_id": None,
        "total_amount": 500.0,
        "status": "draft",
        "lines": [],
    }, headers=headers)
    assert res_standalone1.status_code == 201

    res_standalone2 = client.post("/api/v1/invoices", json={
        "customer_id": cust.id,
        "so_id": None,
        "total_amount": 600.0,
        "status": "draft",
        "lines": [],
    }, headers=headers)
    assert res_standalone2.status_code == 201
