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
from app.models import User, SalesOrder
from app.services.auth_service import create_access_token, hash_password

client = TestClient(app)

SO_NUMBERS = ["SO-TD-MIX", "SO-TD-DRAFT", "SO-TD-INPROD", "SO-TD-OLD", "SO-TD-INACTIVE",
              "SO-TD-OTHERCO", "SO-TD-LEGACY", "SO-TD-NOTOUGH"]


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _cleanup(db: Session):
    db.query(SalesOrder).filter(SalesOrder.so_number.in_(SO_NUMBERS)).delete(synchronize_session=False)
    db.query(User).filter(User.username == "tough_demand_admin").delete()
    db.commit()


@pytest.fixture
def demand_env(db_session: Session):
    _cleanup(db_session)
    admin = User(username="tough_demand_admin", password=hash_password("Pass123!"), name="Tough Demand Admin",
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


def _group(thickness, toughened, *sizes, description=""):
    return {"glass_thickness": thickness, "is_toughened": toughened, "description": description, "sizes": list(sizes)}


def test_toughening_demand_from_confirmed_sales_orders(db_session: Session, demand_env):
    headers = demand_env
    today = date.today().isoformat()
    old = (date.today() - timedelta(days=30)).isoformat()
    before = _get(headers, preset="today")

    # 24x24 in = 4 sqft per piece; charged 36x24 = 6 sqft per piece
    thin_size = {"width_inch": 24, "height_inch": 24, "quantity": 3, "charged_w_inch": 0, "charged_h_inch": 0}
    thick_size = {"width_inch": 24, "height_inch": 24, "quantity": 2, "charged_w_inch": 36, "charged_h_inch": 24}
    big_thick = {"width_inch": 24, "height_inch": 24, "quantity": 50}

    def so(num, status="confirmed", order_date=today, company_id=1, is_active=True, groups=None, lines=None):
        return SalesOrder(so_number=num, status=status, order_date=order_date, company_id=company_id,
                          is_active=is_active, customer_name="TD Customer", groups=groups or [], lines=lines or [])

    db_session.add_all([
        so("SO-TD-MIX", groups=[
            _group(5, True, thin_size),                                  # thin: 3 pcs, 12 sqft
            _group(10, True, thick_size),                                # thick: 2 pcs, 12 sqft (charged dims)
            _group(12, False, big_thick),                                # not toughened: ignored
            _group(None, True, {"width_inch": 12, "height_inch": 12, "quantity": 1}, description="Clear 8 mm"),  # thick via description
            _group(None, True, {"width_inch": 12, "height_inch": 12, "quantity": 4}, description="Frosted"),     # unclassified
        ]),
        so("SO-TD-DRAFT", status="draft", groups=[_group(10, True, big_thick)]),
        so("SO-TD-INPROD", status="in_production", groups=[_group(10, True, big_thick)]),
        so("SO-TD-OLD", order_date=old, groups=[_group(10, True, big_thick)]),
        so("SO-TD-INACTIVE", is_active=False, groups=[_group(10, True, big_thick)]),
        so("SO-TD-OTHERCO", company_id=2, groups=[_group(10, True, big_thick)]),
        so("SO-TD-LEGACY", lines=[                                       # no groups: flat lines fallback
            {"is_toughened": True, "glass_thickness": 6, "width_inch": 24, "height_inch": 24, "quantity": 2},
            {"is_toughened": False, "glass_thickness": 6, "width_inch": 24, "height_inch": 24, "quantity": 9},
        ]),
        so("SO-TD-NOTOUGH", groups=[_group(10, False, big_thick)]),
    ])
    db_session.commit()

    after = _get(headers, preset="today")

    def delta(bucket, field):
        return round(after[bucket][field] - before[bucket][field], 2)

    assert delta("thin", "pieces") == 3 + 2            # MIX thin + LEGACY
    assert delta("thin", "sqft") == 12 + 8
    assert delta("thick", "pieces") == 2 + 1
    assert delta("thick", "sqft") == 12 + 1
    assert delta("unclassified", "pieces") == 4
    assert delta("total", "pieces") == 3 + 2 + 1 + 4 + 2
    assert after["total"]["pieces"] == sum(after[b]["pieces"] for b in ("thin", "thick", "unclassified"))

    items = {i["so_number"]: i for i in after["items"] if i["so_number"] in SO_NUMBERS}
    assert set(items) == {"SO-TD-MIX", "SO-TD-LEGACY"}
    mix = items["SO-TD-MIX"]
    assert mix["thin_sqft"] == 12 and mix["thick_sqft"] == 13 and mix["unclassified_sqft"] == 4
    assert mix["total_pieces"] == 10 and mix["toughened_lines"] == 4

    # Outside the period: none of today's SOs
    far = _get(headers, preset="custom", date=(date.today() - timedelta(days=400)).isoformat())
    assert not {i["so_number"] for i in far["items"]} & set(SO_NUMBERS)


def test_register_all_time_preset_skips_date_filter(db_session: Session, demand_env):
    headers = demand_env
    old = (date.today() - timedelta(days=400)).isoformat()
    db_session.add(SalesOrder(so_number="SO-TD-OLD", status="confirmed", order_date=old, company_id=1, is_active=True,
                              customer_name="TD Customer", lines=[],
                              groups=[_group(10, True, {"width_inch": 24, "height_inch": 24, "quantity": 7})]))
    db_session.commit()

    all_time = _get(headers, preset="all_time")
    assert all_time["start_date"] is None and all_time["end_date"] is None and all_time["selected_date"] is None
    assert "SO-TD-OLD" in {i["so_number"] for i in all_time["items"]}
    assert "SO-TD-OLD" not in {i["so_number"] for i in _get(headers, preset="today")["items"]}
    assert "SO-TD-OLD" in {i["so_number"] for i in _get(headers, preset="custom", date=old)["items"]}

    cut = client.get("/api/v1/workshop/cutting-register", params={"preset": "all_time"}, headers=headers)
    assert cut.status_code == 200, cut.text
    cut = cut.json()
    assert cut["start_date"] is None and cut["end_date"] is None and cut["selected_date"] is None
    cut_today = client.get("/api/v1/workshop/cutting-register", params={"preset": "today"}, headers=headers).json()
    assert cut["cut_today"]["total_sqft"] >= cut_today["cut_today"]["total_sqft"]
