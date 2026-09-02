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
from app.models import User, WorkshopOrder, Product
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
def cutting_test_env(db_session: Session):
    """Fixture creating test user, products, and workshop orders."""
    # Clean up test user and orders if exist
    db_session.query(WorkshopOrder).filter(WorkshopOrder.wo_number.in_(["WO-TEST-001", "WO-TEST-002", "WO-TEST-FLOW-001", "WO-LEGACY-001"])).delete(synchronize_session=False)
    db_session.query(User).filter(User.username == "cutting_admin").delete()
    db_session.commit()

    admin_user = User(
        username="cutting_admin",
        password=hash_password("Pass123!"),
        name="Cutting Admin",
        role="admin",
        company_id=1,
        data_scope="company",
    )
    db_session.add(admin_user)
    db_session.commit()
    db_session.refresh(admin_user)

    import secrets
    sid = secrets.token_urlsafe(16)
    admin_user.current_session_id = sid
    db_session.commit()

    token = create_access_token(admin_user.id, admin_user.role, company_id=1, active_company_id=1, session_id=sid)
    headers = {"Authorization": f"Bearer {token}"}

    # Create test WOs with specific line configurations
    wo1 = WorkshopOrder(
        wo_number="WO-TEST-001",
        company_id=1,
        status="draft",
        is_active=True,
        customer_name="Test Customer 1",
        lines=[
            {
                "description": "Xtra Clear Annealed 12mm",
                "act_w_in": 36.0,
                "act_h_in": 48.0,
                "quantity": 1,
            },
            {
                "description": "Custom Glass 5mm",
                "glass_thickness": 5,
                "chg_w_in": 24.0,
                "chg_h_in": 36.0,
                "quantity": 2,
            },
            {
                "description": "Custom Glass 7mm",
                "glass_thickness": 7,
                "charged_w_inch": 12.0,
                "charged_h_inch": 24.0,
                "qty": 1,
            },
            {
                "description": "Heavy Glass 8mm",
                "glass_thickness": 8,
                "charged_w": 30.0,
                "charged_h": 40.0,
                "qty": 1,
            },
            {
                "description": "Unknown Spec Glass",
                "act_w_in": 12.0,
                "act_h_in": 12.0,
                "qty": 1,
            }
        ]
    )

    wo2 = WorkshopOrder(
        wo_number="WO-TEST-002",
        company_id=1,
        status="in_progress",
        is_active=True,
        customer_name="Test Customer 2",
        lines=[
            {
                "description": "Clear Float 6mm",
                "thickness": 6,
                "chg_w_in": 60.0,
                "chg_h_in": 80.0,
                "quantity": 1,
            }
        ]
    )

    db_session.add_all([wo1, wo2])
    db_session.commit()

    env = {
        "admin_user": admin_user,
        "headers": headers,
        "wo1": wo1,
        "wo2": wo2,
    }

    yield env

    # Teardown
    db_session.query(WorkshopOrder).filter(WorkshopOrder.id.in_([wo1.id, wo2.id])).delete(synchronize_session=False)
    db_session.delete(admin_user)
    db_session.commit()


def test_cutting_register_endpoint_logic(cutting_test_env):
    """Verify thickness parsing, continuous boundary (<8, >=8), charged size, status mapping, and unclassified bucket."""
    headers = cutting_test_env["headers"]

    res = client.get("/api/v1/workshop/cutting-register", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Find test WO1
    wo1_item = next((item for item in data["items"] if item["wo_number"] == "WO-TEST-001"), None)
    assert wo1_item is not None

    # Draft status must map to PENDING
    assert wo1_item["status_label"] == "PENDING"

    # WO1 Breakdown:
    # Line 0: "Xtra Clear Annealed 12mm" -> regex extracts 12mm -> THICK (>= 8). Actual size: 36x48x1 / 144 = 12.0 sqft (fallback)
    # Line 1: 5mm -> THIN (< 8). Charged size: 24x36x2 / 144 = 12.0 sqft
    # Line 2: 7mm -> THIN (< 8). Charged size: 12x24x1 / 144 = 2.0 sqft
    # Line 3: 8mm -> THICK (>= 8). Charged size: 30x40x1 / 144 = 8.333 sqft
    # Line 4: Unknown -> UNCLASSIFIED. Actual size: 12x12x1 / 144 = 1.0 sqft (fallback)

    # Total Thin for WO1 = 12.0 + 2.0 = 14.0 sqft
    # Total Thick for WO1 = 12.0 + 8.33 = 20.33 sqft
    # Total Unclassified for WO1 = 1.0 sqft

    assert wo1_item["thin_sqft"] == 14.0
    assert wo1_item["thick_sqft"] == 20.33
    assert wo1_item["unclassified_sqft"] == 1.0
    assert wo1_item["total_sqft"] == 35.33

    # Find test WO2
    wo2_item = next((item for item in data["items"] if item["wo_number"] == "WO-TEST-002"), None)
    assert wo2_item is not None
    # in_progress status must map to UNDR CTNG
    assert wo2_item["status_label"] == "UNDR CTNG"
    # Line 0: 6mm -> THIN. Charged size: 60x80x1 / 144 = 33.33 sqft
    assert wo2_item["thin_sqft"] == 33.33
    assert wo2_item["thick_sqft"] is None


def test_cutting_progress_and_status_derivation(cutting_test_env):
    """Test creation, modification of WorkshopOrders, and verify correct derivation of status and timestamps."""
    headers = cutting_test_env["headers"]
    
    # 1. Create a WO with 2 lines (one qty 2, one qty 1)
    wo_payload = {
        "wo_number": "WO-TEST-FLOW-001",
        "customer_name": "Flow Customer",
        "status": "draft",
        "is_active": True,
        "lines": [
            {
                "description": "Glass A 6mm",
                "thickness": 6,
                "act_w_in": 36.0,
                "act_h_in": 48.0,
                "qty": 2,
                "qty_cut": 0
            },
            {
                "description": "Glass B 8mm",
                "thickness": 8,
                "act_w_in": 36.0,
                "act_h_in": 48.0,
                "qty": 1,
                "qty_cut": 0
            }
        ]
    }
    
    res = client.post("/api/v1/workshop/", json=wo_payload, headers=headers)
    assert res.status_code in (200, 201)
    wo_data = res.json()
    assert wo_data["status"] == "draft"
    assert wo_data["lines"][0]["qty_cut"] == 0
    assert wo_data["lines"][0].get("cut_started_at") is None
    assert wo_data["lines"][0].get("cut_completed_at") is None

    wo_id = wo_data["id"]

    # 2. Update line 1 qty_cut to 1 (in-progress)
    updated_lines = wo_data["lines"]
    updated_lines[0]["qty_cut"] = 1
    
    res = client.put(f"/api/v1/workshop/{wo_id}", json={
        "status": "draft",
        "lines": updated_lines
    }, headers=headers)
    assert res.status_code == 200
    updated_wo = res.json()
    
    # Status should auto-upgrade to in_progress because first line is partially cut
    assert updated_wo["status"] == "in_progress"
    assert updated_wo["lines"][0]["qty_cut"] == 1
    assert updated_wo["lines"][0]["cut_started_at"] is not None
    assert updated_wo["lines"][0]["cut_completed_at"] is None
    assert updated_wo["lines"][0]["cut_by_user_id"] == cutting_test_env["admin_user"].id

    # 3. Update all lines to be fully cut
    updated_lines = updated_wo["lines"]
    updated_lines[0]["qty_cut"] = 2
    updated_lines[1]["qty_cut"] = 1
    
    res = client.put(f"/api/v1/workshop/{wo_id}", json={
        "status": "in_progress",
        "lines": updated_lines
    }, headers=headers)
    assert res.status_code == 200
    fully_cut_wo = res.json()
    
    # Status should auto-upgrade to completed because all lines are fully cut
    assert fully_cut_wo["status"] == "completed"
    assert fully_cut_wo["lines"][0]["cut_completed_at"] is not None
    assert fully_cut_wo["lines"][1]["cut_completed_at"] is not None

    # 4. Manually set status to cancelled. Verify that status remains cancelled even if we make updates.
    res = client.put(f"/api/v1/workshop/{wo_id}", json={
        "status": "cancelled",
        "lines": fully_cut_wo["lines"]
    }, headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"

    # 5. Verify backend guards: setting status = completed with uncut lines should return HTTP 400.
    res = client.post("/api/v1/workshop/", json=wo_payload, headers=headers)
    assert res.status_code in (200, 201)
    wo_data2 = res.json()
    wo_id2 = wo_data2["id"]

    # PATCH status to completed -> should fail with 400
    res = client.patch(f"/api/v1/workshop/{wo_id2}/status", json={"status": "completed"}, headers=headers)
    assert res.status_code == 400
    assert "Cannot mark workshop order as completed when lines are uncut" in res.json()["detail"]

    # PUT status to completed with uncut lines -> should fail with 400
    res = client.put(f"/api/v1/workshop/{wo_id2}", json={
        "status": "completed",
        "lines": wo_data2["lines"]
    }, headers=headers)
    assert res.status_code == 400
    assert "Cannot mark workshop order as completed when lines are uncut" in res.json()["detail"]

    # Clean up both orders
    client.delete(f"/api/v1/workshop/{wo_id}", headers=headers)
    client.delete(f"/api/v1/workshop/{wo_id2}", headers=headers)


def test_cutting_register_filters_and_hydration(cutting_test_env, db_session: Session):
    """Test date filters, presets, and lazy hydration for legacy orders."""
    headers = cutting_test_env["headers"]
    
    # Create a legacy WO where lines have NO qty_cut key
    legacy_wo = WorkshopOrder(
        wo_number="WO-LEGACY-001",
        company_id=1,
        status="completed",
        is_active=True,
        customer_name="Legacy Customer",
        lines=[
            {
                "description": "Legacy Glass 6mm",
                "thickness": 6,
                "act_w_in": 36.0,
                "act_h_in": 48.0,
                "qty": 5
                # No qty_cut field
            }
        ]
    )
    db_session.add(legacy_wo)
    db_session.commit()
    db_session.refresh(legacy_wo)

    # Call cutting-register and check hydration logic
    res = client.get("/api/v1/workshop/cutting-register", headers=headers)
    assert res.status_code == 200
    data = res.json()
    
    # Check that legacy WO was hydrated: qty_cut defaults to qty for completed orders
    # completed tile should have it
    assert data["completed"]["thin_sqft"] > 0
    
    # Verify date presets return correct structure
    res_today = client.get("/api/v1/workshop/cutting-register?preset=today", headers=headers)
    assert res_today.status_code == 200
    today_data = res_today.json()
    assert "cut_today" in today_data
    assert "in_progress" in today_data
    assert "pending" in today_data
    assert "completed" in today_data

    # Clean up
    db_session.delete(legacy_wo)
    db_session.commit()
