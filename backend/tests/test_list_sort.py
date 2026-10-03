"""List column sort (?sort_by=&sort_order=): Sales Orders by delivery date."""
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
    tag = uuid.uuid4().hex[:6]
    ids = []
    for d in ["2026-11-05", "", "2026-10-20", None, "2026-12-01"]:
        res = client.post("/api/v1/sales-orders/", json={"status": "draft", "delivery_date": d,
                                                         "customer_name": f"Sort {tag}"}, headers=h)
        assert res.status_code == 201, res.text
        ids.append(res.json()["id"])
    yield h, set(ids)
    for i in ids:
        db.execute(text("delete from sales_orders where id = :i"), {"i": i})
    db.commit()
    db.close()


def _dates(h, ids, order):
    res = client.get("/api/v1/sales-orders/", params={"sort_by": "delivery_date", "sort_order": order,
                                                       "page_size": 1000}, headers=h)
    assert res.status_code == 200, res.text
    return [r["delivery_date"] for r in res.json()["items"] if r["id"] in ids]


def test_sort_by_delivery_date_both_ways_blanks_last(ctx):
    h, ids = ctx
    asc = _dates(h, ids, "ascend")
    assert asc[:3] == ["2026-10-20", "2026-11-05", "2026-12-01"] and set(asc[3:]) <= {"", None}
    desc = _dates(h, ids, "descend")
    assert desc[:3] == ["2026-12-01", "2026-11-05", "2026-10-20"] and set(desc[3:]) <= {"", None}


def test_unknown_sort_column_is_ignored(ctx):
    h, _ = ctx
    res = client.get("/api/v1/sales-orders/", params={"sort_by": "id; drop table x", "sort_order": "ascend"}, headers=h)
    assert res.status_code == 200
