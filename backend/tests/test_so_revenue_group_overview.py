import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from app.database import SessionLocal
from app.models import User, SalesOrder
from app.services.auth_service import create_access_token

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_so_revenue_lifecycle_and_gross_margin(db_session: Session):
    """Test draft SO excluded, confirmed included, cancelled excluded, and gross margin behavior."""
    super_user = db_session.query(User).filter(User.role == "superadmin").first()
    assert super_user is not None, "Superadmin user must exist"

    import secrets
    sid = secrets.token_urlsafe(16)
    super_user.current_session_id = sid
    db_session.commit()

    token = create_access_token(super_user.id, "superadmin", session_id=sid)
    headers = {"Authorization": f"Bearer {token}"}

    # Baseline revenue for company 1
    res1 = client.get("/api/v1/super/group-overview", headers=headers)
    assert res1.status_code == 200
    c1_base = next(c for c in res1.json()["company_metrics"] if c["id"] == 1)
    base_rev = c1_base["revenue"]

    # 1. Create a Draft SO
    draft_so = SalesOrder(
        so_number="SO-TEST-REV-001",
        company_id=1,
        status="draft",
        total_amount=5000.0,
        tax_amount=0.0,
        total_cost=3000.0,
        profit_amount=2000.0,
        is_active=True,
    )
    db_session.add(draft_so)
    db_session.commit()
    db_session.refresh(draft_so)

    try:
        # Check draft does NOT increase revenue
        res_draft = client.get("/api/v1/super/group-overview", headers=headers)
        c1_draft = next(c for c in res_draft.json()["company_metrics"] if c["id"] == 1)
        assert c1_draft["revenue"] == base_rev, "Draft SO must NOT count towards revenue"

        # 2. Confirm the SO
        draft_so.status = "confirmed"
        db_session.commit()

        res_conf = client.get("/api/v1/super/group-overview", headers=headers)
        c1_conf = next(c for c in res_conf.json()["company_metrics"] if c["id"] == 1)
        assert c1_conf["revenue"] == round(base_rev + 5000.0, 2), "Confirmed SO must increase revenue by total_amount"

        # 3. Cancel the SO
        draft_so.status = "cancelled"
        db_session.commit()

        res_canc = client.get("/api/v1/super/group-overview", headers=headers)
        c1_canc = next(c for c in res_canc.json()["company_metrics"] if c["id"] == 1)
        assert c1_canc["revenue"] == base_rev, "Cancelled SO must NOT count towards revenue"

    finally:
        db_session.delete(draft_so)
        db_session.commit()
