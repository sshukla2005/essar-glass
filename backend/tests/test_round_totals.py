"""Quotations, SOs and POs store whole-rupee totals (Round Off), half rounding up."""
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


@pytest.mark.parametrize("prefix,table", [
    ("quotations", "quotations"), ("sales-orders", "sales_orders"), ("purchase-orders", "purchase_orders"),
])
def test_total_is_stored_in_whole_rupees(ctx, prefix, table):
    db, h, made = ctx
    res = client.post(f"/api/v1/{prefix}/", json={"status": "draft", "total_amount": 6893.39}, headers=h)
    assert res.status_code == 201, res.text
    rid = res.json()["id"]
    made.append((table, rid))
    assert res.json()["total_amount"] == 6893

    res = client.put(f"/api/v1/{prefix}/{rid}", json={"total_amount": 75156.5}, headers=h)
    assert res.status_code == 200, res.text
    db.expire_all()
    assert db.execute(text(f"select total_amount from {table} where id = :i"), {"i": rid}).scalar() == 75157


def test_invoice_totals_are_not_rounded(ctx):
    db, h, made = ctx
    res = client.post("/api/v1/invoices/", json={"status": "draft", "total_amount": 100.4}, headers=h)
    assert res.status_code == 201, res.text
    made.append(("invoices", res.json()["id"]))
    assert res.json()["total_amount"] == 100.4
