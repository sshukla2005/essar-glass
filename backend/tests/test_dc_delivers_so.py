"""Marking a Delivery Challan delivered moves its Sales Order to DELIVERED."""
import os
import sys
import uuid
from datetime import datetime, timezone

import pytest
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


@pytest.fixture
def ctx():
    db = SessionLocal()
    user = db.query(User).filter(User.role == "superadmin", User.is_active == True).first()
    sid = uuid.uuid4().hex
    user.current_session_id = sid
    user.session_started_at = datetime.now(timezone.utc)
    db.commit()
    h = {"Authorization": "Bearer " + create_access_token(user.id, user.role, company_id=1, home_company_id=1,
                                                            active_company_id=1, session_id=sid)}
    made = {"so": [], "dc": []}
    yield db, h, made
    for dc in made["dc"]:
        db.execute(text("delete from stock_movements where reference = (select dc_number from delivery_challans where id = :i)"), {"i": dc})
        db.execute(text("delete from delivery_challans where id = :i"), {"i": dc})
    for so in made["so"]:
        db.execute(text("delete from sales_orders where id = :i"), {"i": so})
    db.commit()
    db.close()


def _so_status(db, so_id):
    db.expire_all()
    return db.execute(text("select status from sales_orders where id = :i"), {"i": so_id}).scalar()


def _make(h, made, so_status):
    so = client.post("/api/v1/sales-orders/", json={"status": "draft"}, headers=h).json()
    made["so"].append(so["id"])
    if so_status != "draft":
        client.patch(f"/api/v1/sales-orders/{so['id']}/status", json={"status": so_status}, headers=h)
    dc = client.post("/api/v1/delivery/", json={"so_id": so["id"], "status": "draft", "lines": []}, headers=h)
    assert dc.status_code == 201, dc.text
    made["dc"].append(dc.json()["id"])
    return so["id"], dc.json()["id"]


@pytest.mark.parametrize("so_status", ["confirmed", "ready"])
def test_delivering_the_challan_marks_the_so_delivered(ctx, so_status):
    db, h, made = ctx
    so_id, dc_id = _make(h, made, so_status)
    assert _so_status(db, so_id) == so_status

    client.patch(f"/api/v1/delivery/{dc_id}/status", json={"status": "dispatched"}, headers=h)
    assert _so_status(db, so_id) == so_status          # dispatched only: not yet delivered

    res = client.patch(f"/api/v1/delivery/{dc_id}/status", json={"status": "delivered"}, headers=h)
    assert res.status_code == 200, res.text
    assert _so_status(db, so_id) == "delivered"


def test_a_cancelled_so_is_left_alone(ctx):
    db, h, made = ctx
    so_id, dc_id = _make(h, made, "cancelled")
    client.patch(f"/api/v1/delivery/{dc_id}/status", json={"status": "delivered"}, headers=h)
    assert _so_status(db, so_id) == "cancelled"
