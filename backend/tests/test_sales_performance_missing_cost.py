import os
import sys
import secrets
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from app.database import SessionLocal
from app.models import User, SalesOrder
from app.services.auth_service import create_access_token, hash_password

client = TestClient(app)

# An isolated period so other data in the database does not affect the counts
PERIOD = {"from": "2019-03-01", "to": "2019-03-31"}


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _cleanup(db: Session):
    db.query(SalesOrder).filter(SalesOrder.so_number.like("SO-MC-%")).delete(synchronize_session=False)
    db.query(User).filter(User.username == "missing_cost_admin").delete()
    db.commit()


@pytest.fixture
def headers(db_session: Session):
    _cleanup(db_session)
    admin = User(username="missing_cost_admin", password=hash_password("Pass123!"), name="Missing Cost Admin",
                 role="admin", company_id=1, data_scope="company")
    db_session.add(admin)
    db_session.commit()
    sid = secrets.token_urlsafe(16)
    admin.current_session_id = sid
    db_session.commit()
    token = create_access_token(admin.id, admin.role, company_id=1, active_company_id=1, session_id=sid)
    yield {"Authorization": f"Bearer {token}"}
    _cleanup(db_session)


def _so(num, total_cost, day=10, status="confirmed", company_id=1, is_active=True, amount=1000.0):
    return SalesOrder(so_number=num, order_date=f"2019-03-{day:02d}", status=status, company_id=company_id,
                      is_active=is_active, total_amount=amount, tax_amount=0, total_cost=total_cost,
                      profit_amount=(amount - total_cost) if total_cost else None,
                      customer_name="MC Customer", salesperson="MC Rep")


def _report(headers):
    resp = client.get("/api/v1/reports/sales-performance", params=PERIOD, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_missing_cost_list_matches_alert_count(db_session: Session, headers):
    db_session.add_all([
        _so("SO-MC-NULL", None, day=12),
        _so("SO-MC-ZERO", 0, day=11),
        _so("SO-MC-COSTED", 600.0),                              # has a cost rate: not listed
        _so("SO-MC-CANCELLED", None, status="cancelled"),        # not in the report at all
        _so("SO-MC-INACTIVE", None, is_active=False),
        _so("SO-MC-OTHERCO", None, company_id=2),
    ])
    db_session.commit()

    data = _report(headers)
    dq = data["data_quality"]
    assert data["summary"]["so_without_cost_count"] == 2
    assert dq["so_missing_cost_count"] == 2
    assert [r["so_number"] for r in dq["so_missing_cost"]] == ["SO-MC-NULL", "SO-MC-ZERO"]  # newest first
    row = dq["so_missing_cost"][0]
    assert set(row) == {"id", "so_number", "customer_name", "order_date", "total_amount", "salesperson"}
    assert row["customer_name"] == "MC Customer" and row["order_date"] == "2019-03-12" and row["salesperson"] == "MC Rep"
    # Profit only uses the costed SO, exactly as before
    assert data["summary"]["so_with_cost_count"] == 1 and data["summary"]["profit_amount"] == 400.0
    assert "_so_missing_cost" not in data["summary"] and "_so_missing_cost" not in data["previous"]


def test_missing_cost_list_is_capped(db_session: Session, headers):
    db_session.add_all([_so(f"SO-MC-{i:03d}", None, day=1 + i % 28) for i in range(105)])
    db_session.commit()

    dq = _report(headers)["data_quality"]
    assert dq["so_missing_cost_count"] == 105
    assert dq["so_missing_cost_limit"] == 100
    assert len(dq["so_missing_cost"]) == 100
