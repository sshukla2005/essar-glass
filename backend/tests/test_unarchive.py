"""Archive / Unarchive from the lists: an archived record can be reactivated."""
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
    made = []
    yield db, h, made
    for table, id_ in made:
        db.execute(text(f"delete from {table} where id = :i"), {"i": id_})
    db.commit()
    db.close()


@pytest.mark.parametrize("prefix,table,payload", [
    ("purchase-orders", "purchase_orders", {"status": "draft"}),
    ("sales-orders", "sales_orders", {"status": "draft"}),
    ("vendors", "vendors", {"name": "Unarchive Test Vendor"}),
])
def test_archived_record_can_be_reactivated(ctx, prefix, table, payload):
    db, h, made = ctx
    res = client.post(f"/api/v1/{prefix}/", json=payload, headers=h)
    assert res.status_code == 201, res.text
    rid = res.json()["id"]
    made.append((table, rid))

    def active():
        db.expire_all()
        return db.execute(text(f"select is_active from {table} where id = :i"), {"i": rid}).scalar()

    assert client.patch(f"/api/v1/{prefix}/{rid}/archive", headers=h).status_code == 200
    assert active() is False
    res = client.patch(f"/api/v1/{prefix}/{rid}/unarchive", headers=h)
    assert res.status_code == 200, res.text
    assert active() is True


def test_unarchive_respects_company(ctx):
    db, h, made = ctx
    rid = client.post("/api/v1/purchase-orders/", json={"status": "draft"}, headers=h).json()["id"]
    made.append(("purchase_orders", rid))
    client.patch(f"/api/v1/purchase-orders/{rid}/archive", headers=h)
    user = db.query(User).filter(User.role == "superadmin", User.is_active == True).first()
    other = {"Authorization": "Bearer " + create_access_token(user.id, user.role, company_id=1, home_company_id=1,
                                                                active_company_id=2, session_id=user.current_session_id)}
    assert client.patch(f"/api/v1/purchase-orders/{rid}/unarchive", headers=other).status_code == 404
