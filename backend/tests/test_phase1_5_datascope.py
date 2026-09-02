import os
import secrets
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from main import app
from app.database import SessionLocal
from app.models import User, Company, Quotation, CRMLead, Customer
from app.services.auth_service import create_access_token, hash_password

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_b_auto_created_by_and_scoping(db_session: Session):
    """Test auto-population of created_by, own-scoping list visibility, 404 direct lookup, and reassignment."""
    # Create two sales users and one admin user
    user_a = User(
        username="sales_user_a",
        password=hash_password("Pass123!"),
        name="Sales User A",
        role="sales",
        company_id=1,
        data_scope="own",
        permissions=["quotations", "leads", "customers"]
    )
    user_b = User(
        username="sales_user_b",
        password=hash_password("Pass123!"),
        name="Sales User B",
        role="sales",
        company_id=1,
        data_scope="own",
        permissions=["quotations", "leads", "customers"]
    )
    db_session.add_all([user_a, user_b])
    db_session.commit()
    db_session.refresh(user_a)
    db_session.refresh(user_b)

    import secrets
    sid_a, sid_b = secrets.token_urlsafe(16), secrets.token_urlsafe(16)
    user_a.current_session_id = sid_a
    user_b.current_session_id = sid_b
    db_session.commit()

    token_a = create_access_token(user_a.id, user_a.role, company_id=1, active_company_id=1, session_id=sid_a)
    token_b = create_access_token(user_b.id, user_b.role, company_id=1, active_company_id=1, session_id=sid_b)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    try:
        # 1. User A creates a quotation
        res_create = client.post("/api/v1/quotations", json={
            "quote_number": "QT-TEST-A1",
            "customer_id": 1,
            "salesperson": "Sales User A",
            "created_by": 99999  # Attempt to spoof created_by
        }, headers=headers_a)
        assert res_create.status_code == 201
        quote_data = res_create.json()
        quote_id = quote_data["id"]
        # created_by must be forced to user_a.id, ignoring the client-supplied 99999
        assert quote_data["created_by"] == user_a.id

        # 2. User A views list -> quote is visible
        res_list_a = client.get("/api/v1/quotations", headers=headers_a)
        assert res_list_a.status_code == 200
        ids_a = [q["id"] for q in res_list_a.json()["items"]]
        assert quote_id in ids_a

        # 3. User B views list -> quote is NOT visible
        res_list_b = client.get("/api/v1/quotations", headers=headers_b)
        assert res_list_b.status_code == 200
        ids_b = [q["id"] for q in res_list_b.json()["items"]]
        assert quote_id not in ids_b

        # 4. User B attempts direct GET -> must return 404
        res_get_b = client.get(f"/api/v1/quotations/{quote_id}", headers=headers_b)
        assert res_get_b.status_code == 404

        # 5. User A reassigns quote to User B (assigned_to_user_id = user_b.id)
        res_patch = client.put(f"/api/v1/quotations/{quote_id}", json={
            "assigned_to_user_id": user_b.id
        }, headers=headers_a)
        assert res_patch.status_code == 200

        # 6. User B now sees quote in list and direct GET
        res_list_b2 = client.get("/api/v1/quotations", headers=headers_b)
        ids_b2 = [q["id"] for q in res_list_b2.json()["items"]]
        assert quote_id in ids_b2

        res_get_b2 = client.get(f"/api/v1/quotations/{quote_id}", headers=headers_b)
        assert res_get_b2.status_code == 200

    finally:
        db_session.query(Quotation).filter(Quotation.quote_number == "QT-TEST-A1").delete()
        db_session.delete(user_a)
        db_session.delete(user_b)
        db_session.commit()


def test_b_module_scope_overrides(db_session: Session):
    """Test that per-module scope overrides take precedence over user default data_scope."""
    db_session.query(User).filter(User.username == "sales_override_user").delete()
    db_session.commit()

    # User default scope is own, but quotations is overridden to company
    user = User(
        username="sales_override_user",
        password=hash_password("Pass123!"),
        name="Override User",
        role="sales",
        company_id=1,
        data_scope="own",
        module_scopes={"quotations": "company"},
        permissions=["quotations", "leads"]
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    sid = secrets.token_urlsafe(16)
    user.current_session_id = sid
    db_session.commit()

    token = create_access_token(user.id, user.role, company_id=1, active_company_id=1, session_id=sid)
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # Check sales performance report API returns is_scoped
        res_rep = client.get("/api/v1/reports/sales-performance", headers=headers)
        assert res_rep.status_code == 200
        # Reports module defaults to data_scope (own) since module_scopes doesn't override reports
        assert res_rep.json().get("is_scoped") is True

    finally:
        db_session.delete(user)
        db_session.commit()
