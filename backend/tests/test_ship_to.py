"""Ship To storage: customer shipping fields (extra_data) and sales_orders.delivery_address."""
import os
import sys
import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from dotenv import load_dotenv
from sqlalchemy import text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from main import app
from app.database import SessionLocal
from app.models import User
from app.services.auth_service import create_access_token

client = TestClient(app)


def _headers(db):
    user = db.query(User).filter(User.role == "superadmin", User.is_active == True).first()
    sid = uuid.uuid4().hex
    user.current_session_id = sid
    user.session_started_at = datetime.now(timezone.utc)
    db.commit()
    token = create_access_token(user.id, user.role, company_id=1, home_company_id=1, active_company_id=1, session_id=sid)
    return {"Authorization": f"Bearer {token}"}


def test_customer_shipping_fields_round_trip():
    db = SessionLocal()
    h = _headers(db)
    cid = None
    try:
        res = client.post("/api/v1/customers/", json={
            "name": f"ShipTo Test {uuid.uuid4().hex[:6]}", "address": "12 MG Road", "city": "Virar",
            "ship_same_as_billing": False, "ship_address": "Plot 7, MIDC", "ship_city": "Vasai", "ship_pincode": "401208",
        }, headers=h)
        assert res.status_code == 201, res.text
        cid = res.json()["id"]
        got = client.get(f"/api/v1/customers/{cid}", headers=h).json()
        assert (got["ship_same_as_billing"], got["ship_address"], got["ship_city"]) == (False, "Plot 7, MIDC", "Vasai")
        # editing another field keeps the shipping address
        client.put(f"/api/v1/customers/{cid}", json={"phone": "12345"}, headers=h)
        got = client.get(f"/api/v1/customers/{cid}", headers=h).json()
        assert got["ship_address"] == "Plot 7, MIDC"
        # switching back to same-as-billing
        client.put(f"/api/v1/customers/{cid}", json={"ship_same_as_billing": True}, headers=h)
        assert client.get(f"/api/v1/customers/{cid}", headers=h).json()["ship_same_as_billing"] is True
    finally:
        if cid:
            db.execute(text("delete from customers where id = :i"), {"i": cid})
            db.commit()
        db.close()


def test_sales_order_saves_delivery_address():
    db = SessionLocal()
    h = _headers(db)
    sid = None
    try:
        res = client.post("/api/v1/sales-orders/", json={"status": "draft", "delivery_address": "Site office\nBlock C"}, headers=h)
        assert res.status_code == 201, res.text
        sid = res.json()["id"]
        assert client.get(f"/api/v1/sales-orders/{sid}", headers=h).json()["delivery_address"] == "Site office\nBlock C"
        client.put(f"/api/v1/sales-orders/{sid}", json={"delivery_address": ""}, headers=h)
        assert client.get(f"/api/v1/sales-orders/{sid}", headers=h).json()["delivery_address"] in ("", None)
    finally:
        if sid:
            db.execute(text("delete from sales_orders where id = :i"), {"i": sid})
            db.commit()
        db.close()
