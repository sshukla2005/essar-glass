import os
import sys
import secrets
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from app.database import SessionLocal
from app.models import User, TougheningBatch
from app.services.auth_service import create_access_token, hash_password

client = TestClient(app)

TB_NUMBERS = ["TB-REG-DRAFT", "TB-REG-SENT-OD", "TB-REG-PART-OD", "TB-REG-PARTLY", "TB-REG-RECV-OD",
              "TB-REG-OLD-OD", "TB-REG-CANC", "TB-REG-INACTIVE", "TB-REG-OTHERCO"]


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _cleanup(db: Session):
    db.query(TougheningBatch).filter(TougheningBatch.tb_number.in_(TB_NUMBERS)).delete(synchronize_session=False)
    db.query(User).filter(User.username == "tough_reg_admin").delete()
    db.commit()


@pytest.fixture
def register_env(db_session: Session):
    _cleanup(db_session)
    admin = User(username="tough_reg_admin", password=hash_password("Pass123!"), name="Tough Reg Admin",
                 role="admin", company_id=1, data_scope="company")
    db_session.add(admin)
    db_session.commit()
    sid = secrets.token_urlsafe(16)
    admin.current_session_id = sid
    db_session.commit()
    token = create_access_token(admin.id, admin.role, company_id=1, active_company_id=1, session_id=sid)
    yield {"Authorization": f"Bearer {token}"}
    _cleanup(db_session)


def _get(headers, **params):
    resp = client.get("/api/v1/workshop/toughening-register", params=params, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _bucket(data, status):
    return next((s for s in data["statuses"] if s["status"] == status), {"batches": 0, "pieces": 0, "sqmt": 0.0})


def test_toughening_register_buckets_overdue_and_scoping(db_session: Session, register_env):
    headers = register_env
    today = date.today()
    t, past, future = today.isoformat(), (today - timedelta(days=3)).isoformat(), (today + timedelta(days=3)).isoformat()
    old_sent = (today - timedelta(days=40)).isoformat()

    before = _get(headers, preset="today")

    def tb(num, status, sent, expected, company_id=1, is_active=True, pieces=0, lines=None, sqmt=1.0, batch_date=None):
        return TougheningBatch(tb_number=num, status=status, sent_date=sent, expected_return=expected,
                               batch_date=batch_date, company_id=company_id, is_active=is_active,
                               total_pieces=pieces, total_sqmt=sqmt, lines=lines or [], vendor_name="Reg Vendor")

    db_session.add_all([
        tb("TB-REG-DRAFT", "draft", None, None, batch_date=t, lines=[{"quantity": 4}, {"quantity": 6}]),  # pieces from lines
        tb("TB-REG-SENT-OD", "sent", t, past, pieces=5),                    # sent today, already overdue
        tb("TB-REG-PART-OD", "partial_received", t, past, pieces=3),         # overdue
        tb("TB-REG-PARTLY", "partially_received", t, future, lines=[{"qty_sent": 7}]),  # alias, not overdue
        tb("TB-REG-RECV-OD", "received", t, past, pieces=2),                 # returned: never overdue
        tb("TB-REG-OLD-OD", "sent", old_sent, past, pieces=9),               # outside period but overdue
        tb("TB-REG-CANC", "cancelled", t, past, pieces=1),                   # unknown status: own bucket, not overdue
        tb("TB-REG-INACTIVE", "sent", t, past, is_active=False, pieces=50),  # soft-deleted: excluded
        tb("TB-REG-OTHERCO", "sent", t, past, company_id=2, pieces=50),      # other company: excluded
    ])
    db_session.commit()

    after = _get(headers, preset="today")

    def delta(status, field):
        return _bucket(after, status)[field] - _bucket(before, status)[field]

    assert delta("draft", "batches") == 1 and delta("draft", "pieces") == 10
    assert delta("sent", "batches") == 1 and delta("sent", "pieces") == 5
    assert delta("partial_received", "batches") == 2 and delta("partial_received", "pieces") == 10
    assert delta("received", "batches") == 1
    assert delta("cancelled", "batches") == 1
    assert not any(s["status"] == "partially_received" for s in after["statuses"])

    # Overdue: SENT-OD, PART-OD, OLD-OD (old one is outside the period but still counted)
    assert after["overdue"] - before["overdue"] == 3
    assert after["overdue_pieces"] - before["overdue_pieces"] == 17

    items = {i["tb_number"]: i for i in after["items"] if i["tb_number"] in TB_NUMBERS}
    assert "TB-REG-INACTIVE" not in items and "TB-REG-OTHERCO" not in items
    assert items["TB-REG-OLD-OD"]["is_overdue"] and not items["TB-REG-OLD-OD"]["in_period"]
    assert items["TB-REG-SENT-OD"]["days_overdue"] == 3
    assert not items["TB-REG-RECV-OD"]["is_overdue"]
    assert not items["TB-REG-CANC"]["is_overdue"]
    assert items["TB-REG-PARTLY"]["status"] == "partial_received" and items["TB-REG-PARTLY"]["total_pieces"] == 7

    # A period with none of the new batches: status tiles unchanged, overdue still reported
    yesterday = _get(headers, preset="custom", date=(today - timedelta(days=400)).isoformat())
    assert yesterday["overdue"] == after["overdue"]
    assert "TB-REG-DRAFT" not in {i["tb_number"] for i in yesterday["items"]}
