import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import os

from main import app
from app.database import get_db, SessionLocal
from app.models import User, Company, Invoice, Customer
from app.services.auth_service import create_access_token, hash_password
from app.utils.helpers import get_next_code
from app.config import settings

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_t1_role_escalation_guard(db_session: Session):
    """Test that a non-superadmin (admin) cannot create users."""
    # User 2 is admin in DB
    admin_token = create_access_token(2, "admin", company_id=1, active_company_id=1)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Attempt to create user as admin
    res = client.post("/api/v1/users", json={
        "username": "hacker_user",
        "password": "Password123!",
        "name": "Hacker User",
        "role": "admin",
        "company_id": 1
    }, headers=headers)
    assert res.status_code == 403
    assert "Insufficient permissions" in res.json()["detail"]


def test_t1_self_lockout_guard():
    """Test that users cannot modify their own active status or role."""
    # User 1 is superadmin in DB
    super_token = create_access_token(1, "superadmin", company_id=1, active_company_id=1)
    headers = {"Authorization": f"Bearer {super_token}"}

    # Attempt to deactivate self (user id 1)
    res = client.put("/api/v1/users/1", json={"is_active": False}, headers=headers)
    assert res.status_code == 403
    assert "Cannot alter your own active status" in res.json()["detail"]


def test_t2_no_active_company_context_guard(db_session: Session):
    """Test that creating a company-scoped record without active_company_id raises 400."""
    # Create temp user with company_id = None
    unscoped_user = User(username="unscoped_test_user", password="hash", name="Unscoped", role="superadmin", company_id=None, permissions=["all"])
    db_session.add(unscoped_user)
    db_session.commit()
    db_session.refresh(unscoped_user)

    try:
        # Token for unscoped user with no active_company_id
        unscoped_token = create_access_token(unscoped_user.id, "superadmin", company_id=None, active_company_id=None)
        headers = {"Authorization": f"Bearer {unscoped_token}"}

        res = client.post("/api/v1/customers", json={
            "name": "Test Customer No Company",
            "customer_code": "TEST9999"
        }, headers=headers)
        assert res.status_code == 400
        assert "No active company context — cannot create record" in res.json()["detail"]
    finally:
        db_session.delete(unscoped_user)
        db_session.commit()


def test_t3_soft_delete_and_code_sequence(db_session: Session):
    """Test that deleting a record with is_active soft-deletes it and get_next_code includes it."""
    super_token = create_access_token(1, "superadmin", company_id=1, active_company_id=1)
    headers = {"Authorization": f"Bearer {super_token}"}

    # Generate next code for Customer (has is_active)
    next_code_1 = get_next_code(db_session, Customer, "customer_code", "CUST", company_id=1)
    
    # Create test customer
    res = client.post("/api/v1/customers", json={
        "name": "Soft Delete Test Customer",
        "customer_code": next_code_1
    }, headers=headers)
    assert res.status_code == 201
    cust_id = res.json()["id"]

    # Soft delete the customer
    res_del = client.delete(f"/api/v1/customers/{cust_id}", headers=headers)
    assert res_del.status_code == 200

    # Verify customer is_active is False in DB
    db_cust = db_session.query(Customer).filter(Customer.id == cust_id).first()
    assert db_cust is not None
    assert db_cust.is_active is False

    # Verify next code sequence does not reuse next_code_1
    next_code_2 = get_next_code(db_session, Customer, "customer_code", "CUST", company_id=1)
    assert next_code_2 != next_code_1


def test_t4_cors_headers_on_403_read_only():
    """Test that ReadOnlyMiddleware 403 response includes CORS header."""
    # Cross-company token (home company 1, active company 2) for User 2 (admin)
    cross_token = create_access_token(2, "admin", company_id=2, home_company_id=1, active_company_id=2)
    headers = {
        "Authorization": f"Bearer {cross_token}",
        "Origin": "http://localhost:5173"
    }

    res = client.post("/api/v1/customers", json={"name": "Forbidden Write"}, headers=headers)
    assert res.status_code == 403
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_t5_secret_key_length():
    """Test that SECRET_KEY setting is at least 32 characters long."""
    assert len(settings.SECRET_KEY) >= 32
    assert settings.SECRET_KEY != "your-super-secret-jwt-key-change-this-in-production-1234567890"


def test_t6_auto_create_tables_setting():
    """Test that AUTO_CREATE_TABLES defaults to False."""
    assert settings.AUTO_CREATE_TABLES is False


def test_g2_role_guards():
    """Test role access control for /users and /companies endpoints across roles."""
    sales_token = create_access_token(3, "sales", company_id=1, active_company_id=1)
    admin_token = create_access_token(2, "admin", company_id=1, active_company_id=1)
    sales_headers = {"Authorization": f"Bearer {sales_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # sales -> GET /api/v1/users/ returns 403
    res = client.get("/api/v1/users/", headers=sales_headers)
    assert res.status_code == 403

    # sales -> POST /api/v1/users/ returns 403
    res = client.post("/api/v1/users/", json={"username": "u1", "password": "p", "name": "N", "role": "sales", "company_id": 1}, headers=sales_headers)
    assert res.status_code == 403

    # admin -> GET /api/v1/users/ returns 200 (read access retained)
    res = client.get("/api/v1/users/", headers=admin_headers)
    assert res.status_code == 200

    # admin -> POST /api/v1/users/ returns 403 (write is superadmin-only)
    res = client.post("/api/v1/users/", json={"username": "u2", "password": "p", "name": "N", "role": "sales", "company_id": 1}, headers=admin_headers)
    assert res.status_code == 403

    # sales -> POST /api/v1/companies/ returns 403
    res = client.post("/api/v1/companies/", json={"name": "Comp S", "code": "CS"}, headers=sales_headers)
    assert res.status_code == 403

    # admin -> POST /api/v1/companies/ returns 403
    res = client.post("/api/v1/companies/", json={"name": "Comp A", "code": "CA"}, headers=admin_headers)
    assert res.status_code == 403


def test_g2_last_superadmin_archive_protection(db_session: Session):
    """Test that archiving the last active superadmin returns 403; archiving one of two succeeds."""
    # Create temporary second superadmin
    super2 = User(
        username="temp_superadmin2",
        password=hash_password("Password123!"),
        name="Temp Superadmin 2",
        role="superadmin",
        company_id=1,
        is_active=True,
    )
    db_session.add(super2)
    db_session.commit()
    db_session.refresh(super2)

    super1 = db_session.query(User).filter(User.id == 1).first()

    try:
        # Scenario A: Set super1 to inactive so super2 is the ONLY active superadmin (count = 1).
        super1.is_active = False
        db_session.commit()

        super2_token = create_access_token(super2.id, "superadmin", company_id=1, active_company_id=1)
        headers2 = {"Authorization": f"Bearer {super2_token}"}

        # super2 attempts to archive super1 when super2 is the last active superadmin -> 403
        res_last = client.patch(f"/api/v1/users/{super1.id}/archive", headers=headers2)
        assert res_last.status_code == 403
        assert "Cannot archive or delete the last remaining active superadmin" in res_last.json()["detail"]

        # Scenario B: Restore super1 to active so 2 active superadmins exist (super1 & super2).
        super1.is_active = True
        db_session.commit()

        super1_token = create_access_token(1, "superadmin", company_id=1, active_company_id=1)
        headers1 = {"Authorization": f"Bearer {super1_token}"}

        # super1 archives super2 when 2 exist -> succeeds (200)
        res_archive = client.patch(f"/api/v1/users/{super2.id}/archive", headers=headers1)
        assert res_archive.status_code == 200
        assert res_archive.json()["message"] == "Archived successfully"
    finally:
        # Clean up: restore super1 and delete super2
        if super1:
            super1.is_active = True
        db_session.query(User).filter(User.username == "temp_superadmin2").delete()
        db_session.commit()


def test_g2_sales_full_crud_regression_guard(db_session: Session):
    """Mandatory Regression Guard: sales role can perform full CRUD on quotations, sales orders, customers, and products."""
    sales_token = create_access_token(3, "sales", company_id=1, active_company_id=1)
    headers = {"Authorization": f"Bearer {sales_token}"}

    resources = [
        ("/api/v1/customers", {"name": "G2 Sales Customer"}),
        ("/api/v1/products", {"name": "G2 Sales Product"}),
        ("/api/v1/quotations", {"notes": "G2 Sales Quote"}),
        ("/api/v1/sales-orders", {"notes": "G2 Sales Order"}),
    ]

    for endpoint, payload in resources:
        # CREATE
        res_create = client.post(endpoint, json=payload, headers=headers)
        assert res_create.status_code == 201, f"Sales CREATE failed on {endpoint}: {res_create.text}"
        item_id = res_create.json()["id"]

        # READ
        res_get = client.get(f"{endpoint}/{item_id}", headers=headers)
        assert res_get.status_code == 200, f"Sales READ failed on {endpoint}: {res_get.text}"

        # UPDATE
        res_update = client.put(f"{endpoint}/{item_id}", json={"notes": "Updated by Sales"}, headers=headers)
        assert res_update.status_code == 200, f"Sales UPDATE failed on {endpoint}: {res_update.text}"

        # DELETE
        res_del = client.delete(f"{endpoint}/{item_id}", headers=headers)
        assert res_del.status_code == 200, f"Sales DELETE failed on {endpoint}: {res_del.text}"

