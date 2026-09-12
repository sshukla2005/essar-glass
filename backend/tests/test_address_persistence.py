import os
import sys
import uuid
import pytest
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from main import app
from app.database import SessionLocal
from app.models import User, Company, Customer, Vendor
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

def test_customer_address_persistence(db_session: Session):
    headers = get_auth_headers(db_session)
    company = db_session.query(Company).first()
    cid = company.id if company else 1

    # 1. Create Customer with both address and address_line2
    payload = {
        "name": f"Test Cust {uuid.uuid4().hex[:6]}",
        "customer_type": "company",
        "address": "123 Industrial Area, Block B",
        "address_line2": "Suite 404, Near Central Depot",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001",
        "company_id": cid,
    }
    res = client.post("/api/v1/customers/", json=payload, headers=headers)
    assert res.status_code in (200, 201), res.text
    data = res.json()
    cust_id = data["id"]
    assert data["address"] == "123 Industrial Area, Block B"
    assert data["address_line2"] == "Suite 404, Near Central Depot"

    # 2. Fetch directly from database to verify real column persistence
    db_cust = db_session.query(Customer).filter(Customer.id == cust_id).first()
    assert db_cust is not None
    assert db_cust.address == "123 Industrial Area, Block B"
    assert db_cust.address_line2 == "Suite 404, Near Central Depot"

    # 3. Fetch via GET endpoint
    get_res = client.get(f"/api/v1/customers/{cust_id}", headers=headers)
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["address"] == "123 Industrial Area, Block B"
    assert get_data["address_line2"] == "Suite 404, Near Central Depot"

    # 4. Update address_line2
    put_res = client.put(
        f"/api/v1/customers/{cust_id}",
        json={"address_line2": "Floor 2, Updated Building"},
        headers=headers,
    )
    assert put_res.status_code == 200
    updated_data = put_res.json()
    assert updated_data["address"] == "123 Industrial Area, Block B"
    assert updated_data["address_line2"] == "Floor 2, Updated Building"

    db_session.refresh(db_cust)
    assert db_cust.address_line2 == "Floor 2, Updated Building"

def test_vendor_address_persistence(db_session: Session):
    headers = get_auth_headers(db_session)
    company = db_session.query(Company).first()
    cid = company.id if company else 1

    # 1. Create Vendor with both address and address_line2
    payload = {
        "name": f"Test Vendor {uuid.uuid4().hex[:6]}",
        "address": "456 Glassworks Lane",
        "address_line2": "Sector 9, Phase 1",
        "city": "Pune",
        "state": "Maharashtra",
        "company_id": cid,
    }
    res = client.post("/api/v1/vendors/", json=payload, headers=headers)
    assert res.status_code in (200, 201), res.text
    data = res.json()
    vend_id = data["id"]
    assert data["address"] == "456 Glassworks Lane"
    assert data["address_line2"] == "Sector 9, Phase 1"

    # 2. Fetch directly from database to verify real column persistence
    db_vend = db_session.query(Vendor).filter(Vendor.id == vend_id).first()
    assert db_vend is not None
    assert db_vend.address == "456 Glassworks Lane"
    assert db_vend.address_line2 == "Sector 9, Phase 1"

    # 3. Fetch via GET endpoint
    get_res = client.get(f"/api/v1/vendors/{vend_id}", headers=headers)
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["address"] == "456 Glassworks Lane"
    assert get_data["address_line2"] == "Sector 9, Phase 1"

    # 4. Update address_line2
    put_res = client.put(
        f"/api/v1/vendors/{vend_id}",
        json={"address_line2": "Warehouse B, Gate 3"},
        headers=headers,
    )
    assert put_res.status_code == 200
    updated_data = put_res.json()
    assert updated_data["address"] == "456 Glassworks Lane"
    assert updated_data["address_line2"] == "Warehouse B, Gate 3"

    db_session.refresh(db_vend)
    assert db_vend.address_line2 == "Warehouse B, Gate 3"

def test_customer_single_and_no_address(db_session: Session):
    headers = get_auth_headers(db_session)
    company = db_session.query(Company).first()
    cid = company.id if company else 1

    # Only line 1
    c1 = Customer(
        customer_code=f"CUST-{uuid.uuid4().hex[:4].upper()}",
        name="Only Line 1 Customer",
        address="789 Single Street",
        address_line2=None,
        company_id=cid,
    )
    db_session.add(c1)
    db_session.commit()
    db_session.refresh(c1)
    assert c1.address == "789 Single Street"
    assert c1.address_line2 is None

    # No address
    c2 = Customer(
        customer_code=f"CUST-{uuid.uuid4().hex[:4].upper()}",
        name="No Address Customer",
        address=None,
        address_line2=None,
        company_id=cid,
    )
    db_session.add(c2)
    db_session.commit()
    db_session.refresh(c2)
    assert c2.address is None
    assert c2.address_line2 is None
