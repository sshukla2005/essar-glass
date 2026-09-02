import pytest
from fastapi.testclient import TestClient
from main import app
from app.services.auth_service import create_access_token
import app.database as db
from app.models.warehouse import Warehouse
from app.models.company import Company

client = TestClient(app)


def test_product_and_stock_movement_company_isolation():
    # 1. Generate access tokens for Company 4 (Alfa Lifters) and Company 2 (Excel Traders)
    import secrets
    from app.models.user import User
    session = db.SessionLocal()
    u = session.query(User).filter(User.id == 1).first()
    sid = secrets.token_urlsafe(16)
    if u:
        u.current_session_id = sid
        session.commit()
    session.close()

    token_co4 = create_access_token(
        user_id=1, role="superadmin", company_id=1, home_company_id=1, active_company_id=4, session_id=sid
    )
    token_co2 = create_access_token(
        user_id=1, role="superadmin", company_id=1, home_company_id=1, active_company_id=2, session_id=sid
    )

    headers_co4 = {"Authorization": f"Bearer {token_co4}"}
    headers_co2 = {"Authorization": f"Bearer {token_co2}"}

    # 2. Test product creation under active_company_id = 4
    prod_resp = client.post("/api/v1/products/", json={
        "name": "ISO-TEST Product 12mm",
        "glass_type": "Clear",
        "thickness_mm": 12,
        "sheet_width_mm": 2440,
        "sheet_height_mm": 3660,
        "stock_uom": "sheet"
    }, headers=headers_co4)
    assert prod_resp.status_code == 201
    prod_data = prod_resp.json()
    assert prod_data["company_id"] == 4
    prod_id = prod_data["id"]

    # 3. Test warehouse dropdown scoping for active_company_id = 4
    wh_resp = client.get("/api/v1/warehouses/dropdown", headers=headers_co4)
    assert wh_resp.status_code == 200
    wh_list = wh_resp.json()
    assert len(wh_list) > 0
    for w in wh_list:
        assert w["company_id"] == 4
    co4_wh_id = wh_list[0]["id"]

    # Also check warehouse dropdown for active_company_id = 2
    wh_co2_resp = client.get("/api/v1/warehouses/dropdown", headers=headers_co2)
    assert wh_co2_resp.status_code == 200
    wh_co2_list = wh_co2_resp.json()
    co2_wh_id = [w["id"] for w in wh_co2_list if w["company_id"] == 2][0]

    # 4. Test valid stock movement creation (active_company=4, warehouse=4, product=4)
    valid_sm_resp = client.post("/api/v1/inventory/", json={
        "product_id": prod_id,
        "movement_type": "adjustment",
        "quantity": 89.304,
        "quantity_sqm": 89.304,
        "quantity_sheets": 10.0,
        "warehouse_id": co4_wh_id,
        "reference": "TEST-ISOLATION-VALID",
        "remarks": "Valid company 4 movement"
    }, headers=headers_co4)
    assert valid_sm_resp.status_code == 201
    sm_data = valid_sm_resp.json()
    assert sm_data["company_id"] == 4
    assert sm_data["warehouse_id"] == co4_wh_id

    # 5. Test invalid cross-company stock movement (active_company=4, warehouse=2 belonging to Excel Traders)
    invalid_sm_resp = client.post("/api/v1/inventory/", json={
        "product_id": prod_id,
        "movement_type": "adjustment",
        "quantity": 10.0,
        "quantity_sqm": 10.0,
        "quantity_sheets": 1.12,
        "warehouse_id": co2_wh_id,
        "reference": "TEST-ISOLATION-INVALID",
        "remarks": "Cross-company warehouse movement"
    }, headers=headers_co4)
    assert invalid_sm_resp.status_code == 400
    err_detail = invalid_sm_resp.json().get("detail", "")
    assert "belongs to company" in err_detail or "does not belong" in err_detail
