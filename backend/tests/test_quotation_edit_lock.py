"""MOM 28/09: quotation creator-only edits, manager has no Sales Performance,
and creating a Workshop Order moves its confirmed Sales Order to in_production."""
import os
import sys
import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import text
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from main import app
from app.database import SessionLocal
from app.models import User, Company
from app.services.auth_service import create_access_token

client = TestClient(app)

LOCK_MSG = "Only the creator can edit this quotation"


@pytest.fixture
def ctx():
    """Users for each role in one company. Everything created here is removed afterwards."""
    db = SessionLocal()
    company = db.query(Company).order_by(Company.id).first()
    tag = uuid.uuid4().hex[:6]
    made = {}
    specs = {
        "creator":    ("sales",      ["quotations", "sales_orders", "customers"]),
        "other":      ("sales",      ["quotations", "sales_orders", "customers"]),
        "manager":    ("manager",    ["quotations", "sales_orders", "customers", "workshop_orders"]),
        # A manager whose permission list wrongly includes it must still be refused
        "manager_sp": ("manager",    ["sales_performance"]),
        "superadmin": ("superadmin", ["all"]),
    }
    for key, (role, perms) in specs.items():
        u = User(username=f"t_{key}_{tag}", password="x", name=f"Test {key.title()} {tag}",
                 role=role, company_id=company.id, permissions=perms, data_scope="company", is_active=True)
        db.add(u)
        made[key] = u
    db.commit()

    headers = {}
    for key, u in made.items():
        sid = uuid.uuid4().hex
        u.current_session_id = sid
        u.session_started_at = datetime.now(timezone.utc)
        headers[key] = {"Authorization": "Bearer " + create_access_token(
            u.id, u.role, company_id=company.id, home_company_id=company.id,
            active_company_id=company.id, session_id=sid)}
    db.commit()

    created = {"quotations": [], "sales_orders": [], "workshop_orders": [], "customers": []}
    yield {"db": db, "users": made, "h": headers, "created": created, "company": company}

    for table in ("workshop_orders", "sales_orders", "quotations", "customers"):
        for rid in created[table]:
            db.execute(text(f"delete from {table} where id = :id"), {"id": rid})
    for u in made.values():
        db.execute(text("delete from users where id = :id"), {"id": u.id})
    db.commit()
    db.close()


def _new_quotation(ctx, who="creator"):
    res = client.post("/api/v1/quotations/", json={"status": "draft", "total_amount": 1000.0}, headers=ctx["h"][who])
    assert res.status_code == 201, res.text
    ctx["created"]["quotations"].append(res.json()["id"])
    return res.json()


# ── C. Quotation edit lock ──────────────────────────────────────────────────

def test_creator_can_update_own_quotation(ctx):
    q = _new_quotation(ctx)
    assert q["created_by"] == ctx["users"]["creator"].id
    res = client.put(f"/api/v1/quotations/{q['id']}", json={"internal_notes": "creator edit"}, headers=ctx["h"]["creator"])
    assert res.status_code == 200, res.text
    assert res.json()["internal_notes"] == "creator edit"


def test_other_sales_user_gets_403(ctx):
    q = _new_quotation(ctx)
    res = client.put(f"/api/v1/quotations/{q['id']}", json={"internal_notes": "not mine"}, headers=ctx["h"]["other"])
    assert res.status_code == 403
    assert res.json()["detail"] == LOCK_MSG
    ctx["db"].expire_all()
    got = client.get(f"/api/v1/quotations/{q['id']}", headers=ctx["h"]["creator"]).json()
    assert got.get("internal_notes") != "not mine"


def test_manager_gets_403(ctx):
    q = _new_quotation(ctx)
    res = client.put(f"/api/v1/quotations/{q['id']}", json={"internal_notes": "manager edit"}, headers=ctx["h"]["manager"])
    assert res.status_code == 403
    assert res.json()["detail"] == LOCK_MSG


def test_superadmin_can_update_any_quotation(ctx):
    q = _new_quotation(ctx)
    res = client.put(f"/api/v1/quotations/{q['id']}", json={"internal_notes": "superadmin edit"}, headers=ctx["h"]["superadmin"])
    assert res.status_code == 200, res.text
    assert res.json()["internal_notes"] == "superadmin edit"


def test_superadmin_can_edit_a_converted_quotation_and_it_stays_converted(ctx):
    q = _new_quotation(ctx)
    assert client.patch(f"/api/v1/quotations/{q['id']}/status", json={"status": "converted"},
                        headers=ctx["h"]["creator"]).status_code == 200
    res = client.put(f"/api/v1/quotations/{q['id']}", json={"salesperson": "Reassigned", "internal_notes": "after SO"},
                     headers=ctx["h"]["superadmin"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["salesperson"], body["internal_notes"], body["status"]) == ("Reassigned", "after SO", "converted")
    # Non-creators are still locked out of it
    assert client.put(f"/api/v1/quotations/{q['id']}", json={"internal_notes": "x"},
                      headers=ctx["h"]["other"]).status_code == 403


def test_non_creator_can_still_read_and_sees_creator_name(ctx):
    q = _new_quotation(ctx)
    res = client.get(f"/api/v1/quotations/{q['id']}", headers=ctx["h"]["manager"])
    assert res.status_code == 200
    assert res.json()["created_by_name"] == ctx["users"]["creator"].name


@pytest.mark.parametrize("who", ["other", "manager"])
@pytest.mark.parametrize("status", ["confirmed", "converted", "cancelled", "lost", "draft"])
def test_non_creator_cannot_change_status(ctx, who, status):
    q = _new_quotation(ctx)
    res = client.patch(f"/api/v1/quotations/{q['id']}/status", json={"status": status}, headers=ctx["h"][who])
    assert res.status_code == 403
    assert res.json()["detail"] == LOCK_MSG
    got = client.get(f"/api/v1/quotations/{q['id']}", headers=ctx["h"]["creator"]).json()
    assert got["status"] == "draft"


@pytest.mark.parametrize("who", ["creator", "superadmin"])
def test_creator_and_superadmin_can_change_status(ctx, who):
    q = _new_quotation(ctx)
    res = client.patch(f"/api/v1/quotations/{q['id']}/status", json={"status": "confirmed"}, headers=ctx["h"][who])
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "confirmed"


def test_non_creator_cannot_archive_or_delete(ctx):
    q = _new_quotation(ctx)
    for who in ("other", "manager"):
        res = client.patch(f"/api/v1/quotations/{q['id']}/archive", headers=ctx["h"][who])
        assert res.status_code == 403
        assert res.json()["detail"] == LOCK_MSG
        res = client.delete(f"/api/v1/quotations/{q['id']}", headers=ctx["h"][who])
        assert res.status_code == 403
    got = client.get(f"/api/v1/quotations/{q['id']}", headers=ctx["h"]["creator"])
    assert got.status_code == 200
    assert got.json()["is_active"] is True


def test_creator_can_archive(ctx):
    q = _new_quotation(ctx)
    res = client.patch(f"/api/v1/quotations/{q['id']}/archive", headers=ctx["h"]["creator"])
    assert res.status_code == 200, res.text


def test_quotation_without_creator_is_superadmin_only(ctx):
    q = _new_quotation(ctx)
    ctx["db"].execute(text("update quotations set created_by = null where id = :id"), {"id": q["id"]})
    ctx["db"].commit()
    res = client.put(f"/api/v1/quotations/{q['id']}", json={"internal_notes": "x"}, headers=ctx["h"]["creator"])
    assert res.status_code == 403
    res = client.put(f"/api/v1/quotations/{q['id']}", json={"internal_notes": "x"}, headers=ctx["h"]["superadmin"])
    assert res.status_code == 200, res.text


def test_other_models_status_is_unchanged(ctx):
    so = client.post("/api/v1/sales-orders/", json={"status": "draft"}, headers=ctx["h"]["creator"])
    assert so.status_code == 201, so.text
    ctx["created"]["sales_orders"].append(so.json()["id"])
    res = client.patch(f"/api/v1/sales-orders/{so.json()['id']}/status", json={"status": "confirmed"}, headers=ctx["h"]["other"])
    assert res.status_code == 200, res.text


def test_other_models_update_is_unchanged(ctx):
    # Customers and Sales Orders share the same generic update path and stay editable by any permitted user
    cust = client.post("/api/v1/customers/", json={"name": f"Lock Test {uuid.uuid4().hex[:6]}"}, headers=ctx["h"]["creator"])
    assert cust.status_code == 201, cust.text
    ctx["created"]["customers"].append(cust.json()["id"])
    res = client.put(f"/api/v1/customers/{cust.json()['id']}", json={"remarks": "edited by other"}, headers=ctx["h"]["other"])
    assert res.status_code == 200, res.text

    so = client.post("/api/v1/sales-orders/", json={"status": "draft"}, headers=ctx["h"]["creator"])
    assert so.status_code == 201, so.text
    ctx["created"]["sales_orders"].append(so.json()["id"])
    res = client.put(f"/api/v1/sales-orders/{so.json()['id']}", json={"remarks": "edited by other"}, headers=ctx["h"]["other"])
    assert res.status_code == 200, res.text


# ── A. Sales Performance ────────────────────────────────────────────────────

@pytest.mark.parametrize("path", [
    "/api/v1/reports/sales-performance",
    "/api/v1/reports/sales-performance/history",
    "/api/v1/reports/sales-performance/export",
])
@pytest.mark.parametrize("who", ["manager", "manager_sp"])
def test_sales_performance_refused_for_managers(ctx, path, who):
    # Refused even when the module is in the manager's permission list
    res = client.get(path, headers=ctx["h"][who])
    assert res.status_code == 403


def test_sales_performance_superadmin_allowed(ctx):
    res = client.get("/api/v1/reports/sales-performance", headers=ctx["h"]["superadmin"])
    assert res.status_code == 200, res.text


# ── D. Workshop Order from Sales Order ──────────────────────────────────────

def _new_so(ctx, status):
    so = client.post("/api/v1/sales-orders/", json={"status": status}, headers=ctx["h"]["superadmin"])
    assert so.status_code == 201, so.text
    ctx["created"]["sales_orders"].append(so.json()["id"])
    return so.json()


def _new_wo(ctx, so_id):
    wo = client.post("/api/v1/workshop/", json={"so_id": so_id, "status": "draft", "lines": []}, headers=ctx["h"]["superadmin"])
    assert wo.status_code == 201, wo.text
    ctx["created"]["workshop_orders"].append(wo.json()["id"])
    return wo.json()


def test_creating_wo_moves_confirmed_so_to_in_production(ctx):
    so = _new_so(ctx, "confirmed")
    wo = _new_wo(ctx, so["id"])
    assert wo["status"] == "draft"
    got = client.get(f"/api/v1/sales-orders/{so['id']}", headers=ctx["h"]["superadmin"]).json()
    assert got["status"] == "in_production"


def test_creating_wo_leaves_other_so_stages_alone(ctx):
    so = _new_so(ctx, "ready")
    _new_wo(ctx, so["id"])
    got = client.get(f"/api/v1/sales-orders/{so['id']}", headers=ctx["h"]["superadmin"]).json()
    assert got["status"] == "ready"
