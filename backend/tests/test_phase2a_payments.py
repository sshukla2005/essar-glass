import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from app.database import SessionLocal
from app.models import User, Invoice, Payment, PaymentAllocation, Customer
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
def payment_test_env(db_session: Session):
    """Fixture providing clean test users, customers, invoices, and auth headers."""
    # Clean up existing test data if any
    db_session.query(User).filter(User.username == "admin_p2a").delete()
    db_session.commit()

    admin_user = User(
        username="admin_p2a",
        password=hash_password("Pass123!"),
        name="Admin P2A",
        role="admin",
        company_id=1,
        data_scope="company",
    )
    db_session.add(admin_user)
    db_session.commit()
    db_session.refresh(admin_user)

    token = create_access_token(admin_user.id, admin_user.role, company_id=1, active_company_id=1)
    headers = {"Authorization": f"Bearer {token}"}

    cust1 = Customer(customer_code="CUST-P2A-1", name="P2A Cust 1", company_id=1, phone="9998887771")
    cust2 = Customer(customer_code="CUST-P2A-2", name="P2A Cust 2", company_id=1, phone="9998887772")
    db_session.add_all([cust1, cust2])
    db_session.commit()
    db_session.refresh(cust1)
    db_session.refresh(cust2)

    inv1 = Invoice(
        invoice_number="INV-P2A-001",
        customer_id=cust1.id,
        company_id=1,
        total_amount=1000.0,
        amount_paid=0.0,
        balance_due=1000.0,
        status="unpaid",
        is_active=True,
    )
    inv2 = Invoice(
        invoice_number="INV-P2A-002",
        customer_id=cust1.id,
        company_id=1,
        total_amount=500.0,
        amount_paid=0.0,
        balance_due=500.0,
        status="unpaid",
        is_active=True,
    )
    inv3_cust2 = Invoice(
        invoice_number="INV-P2A-003",
        customer_id=cust2.id,
        company_id=1,
        total_amount=2000.0,
        amount_paid=0.0,
        balance_due=2000.0,
        status="unpaid",
        is_active=True,
    )
    db_session.add_all([inv1, inv2, inv3_cust2])
    db_session.commit()
    db_session.refresh(inv1)
    db_session.refresh(inv2)
    db_session.refresh(inv3_cust2)

    env = {
        "admin_user": admin_user,
        "headers": headers,
        "cust1": cust1,
        "cust2": cust2,
        "inv1": inv1,
        "inv2": inv2,
        "inv3_cust2": inv3_cust2,
    }

    yield env

    # Teardown
    db_session.query(PaymentAllocation).filter(PaymentAllocation.company_id == 1, PaymentAllocation.payment_id.in_(
        db_session.query(Payment.id).filter(Payment.customer_id.in_([cust1.id, cust2.id]))
    )).delete(synchronize_session=False)
    db_session.query(Payment).filter(Payment.customer_id.in_([cust1.id, cust2.id])).delete(synchronize_session=False)
    db_session.query(Invoice).filter(Invoice.id.in_([inv1.id, inv2.id, inv3_cust2.id])).delete(synchronize_session=False)
    db_session.query(Customer).filter(Customer.id.in_([cust1.id, cust2.id])).delete(synchronize_session=False)
    db_session.delete(admin_user)
    db_session.commit()


def test_over_allocation_rejected(payment_test_env):
    """Allocating more than an invoice's outstanding balance must return HTTP 400."""
    headers = payment_test_env["headers"]
    cust1 = payment_test_env["cust1"]
    inv1 = payment_test_env["inv1"]

    res = client.post("/api/v1/payments", json={
        "customer_id": cust1.id,
        "amount": 1200.0,
        "payment_mode": "cash",
        "allocations": [
            {"invoice_id": inv1.id, "amount": 1200.0}
        ]
    }, headers=headers)

    assert res.status_code == 400
    assert "exceeds outstanding" in res.json()["detail"].lower()


def test_cross_customer_allocation_rejected(payment_test_env):
    """Allocating a payment to an invoice belonging to a different customer must return HTTP 400."""
    headers = payment_test_env["headers"]
    cust1 = payment_test_env["cust1"]
    inv3_cust2 = payment_test_env["inv3_cust2"]

    res = client.post("/api/v1/payments", json={
        "customer_id": cust1.id,
        "amount": 500.0,
        "payment_mode": "cash",
        "allocations": [
            {"invoice_id": inv3_cust2.id, "amount": 500.0}
        ]
    }, headers=headers)

    assert res.status_code == 400
    assert "belongs to a different customer" in res.json()["detail"].lower()


def test_cross_company_allocation_rejected(db_session: Session, payment_test_env):
    """Allocating a payment to an invoice belonging to a different company must return HTTP 400."""
    headers = payment_test_env["headers"]
    cust1 = payment_test_env["cust1"]

    inv_comp2 = Invoice(
        invoice_number="INV-P2A-C2-001",
        customer_id=cust1.id,
        company_id=2,
        total_amount=1000.0,
        amount_paid=0.0,
        balance_due=1000.0,
        status="unpaid",
        is_active=True,
    )
    db_session.add(inv_comp2)
    db_session.commit()
    db_session.refresh(inv_comp2)

    try:
        res = client.post("/api/v1/payments", json={
            "customer_id": cust1.id,
            "amount": 500.0,
            "payment_mode": "cash",
            "allocations": [
                {"invoice_id": inv_comp2.id, "amount": 500.0}
            ]
        }, headers=headers)

        assert res.status_code == 400
        assert "different company" in res.json()["detail"].lower()
    finally:
        db_session.delete(inv_comp2)
        db_session.commit()


def test_duplicate_invoice_id_rejected(payment_test_env):
    """Passing the same invoice_id twice in one request allocations array must return 400, explicitly NOT 500."""
    headers = payment_test_env["headers"]
    cust1 = payment_test_env["cust1"]
    inv1 = payment_test_env["inv1"]

    res = client.post("/api/v1/payments", json={
        "customer_id": cust1.id,
        "amount": 800.0,
        "payment_mode": "cash",
        "allocations": [
            {"invoice_id": inv1.id, "amount": 400.0},
            {"invoice_id": inv1.id, "amount": 400.0},
        ]
    }, headers=headers)

    assert res.status_code != 500, "Must not throw 500 IntegrityError"
    assert res.status_code == 400, f"Expected 400 Bad Request, got {res.status_code}"
    assert "duplicate allocation" in res.json()["detail"].lower()


def test_allocation_exceeds_payment_amount_rejected(payment_test_env):
    """Sum of allocations exceeding the payment amount received must return HTTP 400."""
    headers = payment_test_env["headers"]
    cust1 = payment_test_env["cust1"]
    inv1 = payment_test_env["inv1"]

    res = client.post("/api/v1/payments", json={
        "customer_id": cust1.id,
        "amount": 500.0,
        "payment_mode": "cash",
        "allocations": [
            {"invoice_id": inv1.id, "amount": 800.0}
        ]
    }, headers=headers)

    assert res.status_code == 400
    assert "exceeds payment amount" in res.json()["detail"].lower()


def test_group_overview_reconciles_with_receivables(db_session: Session, payment_test_env):
    """SuperAdmin /super/group-overview metrics must match /receivables/summary per company."""
    headers = payment_test_env["headers"]

    res_summary = client.get("/api/v1/receivables/summary", headers=headers)
    assert res_summary.status_code == 200
    sum_data = res_summary.json()

    super_user = db_session.query(User).filter(User.role == "superadmin").first()
    assert super_user is not None

    super_token = create_access_token(super_user.id, "superadmin")
    super_headers = {"Authorization": f"Bearer {super_token}"}

    res_group = client.get("/api/v1/super/group-overview", headers=super_headers)
    assert res_group.status_code == 200
    group_data = res_group.json()

    c1_metric = next(c for c in group_data["company_metrics"] if c["id"] == 1)
    assert c1_metric["revenue"] == sum_data["total_billed"]
    assert c1_metric["collected"] == sum_data["total_collected"]
    assert c1_metric["outstanding"] == sum_data["outstanding"]
    assert c1_metric["on_account"] == sum_data["on_account"]


def test_valid_payment_allocation_lifecycle(db_session: Session, payment_test_env):
    """Valid payment creation, invoice balance update, ledger reflection, and payment deletion balance restoration."""
    headers = payment_test_env["headers"]
    cust1 = payment_test_env["cust1"]
    inv1 = payment_test_env["inv1"]

    res_valid = client.post("/api/v1/payments", json={
        "customer_id": cust1.id,
        "amount": 1000.0,
        "payment_mode": "bank_transfer",
        "allocations": [
            {"invoice_id": inv1.id, "amount": 600.0}
        ]
    }, headers=headers)

    assert res_valid.status_code == 201
    pay_id = res_valid.json()["id"]

    db_session.commit()
    db_session.refresh(inv1)
    assert float(inv1.amount_paid) == 600.0
    assert float(inv1.balance_due) == 400.0
    assert inv1.status == "partially_paid"

    res_cust_ledger = client.get(f"/api/v1/receivables/customer/{cust1.id}", headers=headers)
    assert res_cust_ledger.status_code == 200
    ledger = res_cust_ledger.json()
    assert ledger["total_billed"] == 1500.0
    assert ledger["total_paid"] == 1000.0
    assert ledger["balance"] == 500.0
    assert ledger["on_account"] == 400.0

    res_del = client.delete(f"/api/v1/payments/{pay_id}", headers=headers)
    assert res_del.status_code == 200

    db_session.commit()
    db_session.refresh(inv1)
    assert float(inv1.amount_paid) == 0.0
    assert float(inv1.balance_due) == 1000.0
    assert inv1.status == "unpaid"
