"""Internal Notes on quotations and sales orders: superadmin only (hidden from and not editable by others)."""
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
from app.services.auth_service import create_access_token, hash_password

client = TestClient(app)


def _login(db, user):
    sid = uuid.uuid4().hex
    user.current_session_id = sid
    user.session_started_at = datetime.now(timezone.utc)
    db.commit()
    return {"Authorization": "Bearer " + create_access_token(user.id, user.role, company_id=1, home_company_id=1,
                                                               active_company_id=1, session_id=sid)}


@pytest.fixture
def ctx():
    db = SessionLocal()
    admin = db.query(User).filter(User.role == "superadmin", User.is_active == True).first()
    mgr = User(username=f"notes_mgr_{uuid.uuid4().hex[:6]}", password=hash_password("Pass123!"), name="Notes Manager",
               role="manager", company_id=1, permissions=["quotations", "sales_orders"], data_scope="company", is_active=True)
    db.add(mgr); db.commit()
    made = []
    yield db, _login(db, admin), _login(db, mgr), made
    for table, id_ in reversed(made):
        db.execute(text(f"delete from {table} where id = :i"), {"i": id_})
    db.execute(text("delete from users where id = :i"), {"i": mgr.id})
    db.commit()
    db.close()


def _notes(db, table, id_):
    db.expire_all()
    return db.execute(text(f"select internal_notes from {table} where id = :i"), {"i": id_}).scalar()


@pytest.mark.parametrize("prefix,table", [("quotations", "quotations"), ("sales-orders", "sales_orders")])
def test_only_superadmin_sees_and_edits_internal_notes(ctx, prefix, table):
    db, admin, mgr, made = ctx
    # created by the manager (quotations are editable by their creator), note added by the superadmin
    res = client.post(f"/api/v1/{prefix}/", json={"status": "draft"}, headers=mgr)
    assert res.status_code == 201, res.text
    rid = res.json()["id"]
    made.append((table, rid))
    res = client.put(f"/api/v1/{prefix}/{rid}", json={"internal_notes": "margin is thin"}, headers=admin)
    assert res.status_code == 200, res.text
    assert res.json()["internal_notes"] == "margin is thin"
    assert client.get(f"/api/v1/{prefix}/{rid}", headers=admin).json()["internal_notes"] == "margin is thin"

    # manager: not in the record, the list or the dropdown
    assert "internal_notes" not in client.get(f"/api/v1/{prefix}/{rid}", headers=mgr).json()
    rows = client.get(f"/api/v1/{prefix}/", params={"page_size": 1000}, headers=mgr).json()["items"]
    assert all("internal_notes" not in r for r in rows)
    assert all("internal_notes" not in r for r in client.get(f"/api/v1/{prefix}/dropdown", headers=mgr).json())

    # manager edits are ignored for this field (the rest of the edit still saves)
    res = client.put(f"/api/v1/{prefix}/{rid}", json={"internal_notes": "changed", "status": "draft"}, headers=mgr)
    assert res.status_code == 200, res.text
    assert "internal_notes" not in res.json()
    assert _notes(db, table, rid) == "margin is thin"

    # superadmin can change it
    client.put(f"/api/v1/{prefix}/{rid}", json={"internal_notes": "updated by admin"}, headers=admin)
    assert _notes(db, table, rid) == "updated by admin"


def test_manager_cannot_set_notes_on_create_but_so_keeps_quotation_notes(ctx):
    db, admin, mgr, made = ctx
    res = client.post("/api/v1/quotations/", json={"status": "draft", "internal_notes": "from manager"}, headers=mgr)
    assert res.status_code == 201, res.text
    made.append(("quotations", res.json()["id"]))
    assert _notes(db, "quotations", res.json()["id"]) is None

    q = client.post("/api/v1/quotations/", json={"status": "confirmed", "internal_notes": "admin note"}, headers=admin).json()
    made.append(("quotations", q["id"]))
    so = client.post("/api/v1/sales-orders/", json={"status": "draft", "quotation_id": q["id"]}, headers=mgr)
    assert so.status_code == 201, so.text
    made.append(("sales_orders", so.json()["id"]))
    assert _notes(db, "sales_orders", so.json()["id"]) == "admin note"   # carried over, still hidden from the manager
    assert "internal_notes" not in so.json()
