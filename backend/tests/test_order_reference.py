"""Order Reference (Architect, Builder, ...) on quotations and sales orders: saved, filtered, carried over."""
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


@pytest.mark.parametrize("prefix,table", [("quotations", "quotations"), ("sales-orders", "sales_orders")])
def test_order_reference_is_saved_updated_and_filterable(ctx, prefix, table):
    db, h, made = ctx
    res = client.post(f"/api/v1/{prefix}/", json={"status": "draft", "order_reference": "architect"}, headers=h)
    assert res.status_code == 201, res.text
    rid = res.json()["id"]
    made.append((table, rid))
    assert client.get(f"/api/v1/{prefix}/{rid}", headers=h).json()["order_reference"] == "architect"
    # a real column, not stashed in extra_data
    assert db.execute(text(f"select order_reference from {table} where id = :i"), {"i": rid}).scalar() == "architect"

    client.put(f"/api/v1/{prefix}/{rid}", json={"order_reference": "online"}, headers=h)
    ids = lambda ref: {r["id"] for r in client.get(f"/api/v1/{prefix}/", params={"order_reference": ref, "page_size": 1000},
                                                    headers=h).json()["items"]}
    assert rid in ids("online")
    assert rid not in ids("architect")
