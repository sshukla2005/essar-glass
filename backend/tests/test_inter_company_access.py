"""Link to Supplier Co.: who may use it, and the stage of the SO it creates.

- superadmin/admin, or a user with the inter_company_link permission (User Management tick)
- non-superadmins only link from the company they are viewing
- confirming an SO that already has a WO (the inter-company SO) goes straight to IN PRODUCTION
"""
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
LINES = [{"description": "Clear Annealed 5mm", "act_w_in": 24, "act_h_in": 24, "qty": 1}]


def _manager(db, perms):
    u = User(username=f"ic_mgr_{uuid.uuid4().hex[:8]}", password=hash_password("Pass123!"), name="IC Manager",
             role="manager", company_id=1, permissions=perms, data_scope="company", is_active=True)
    db.add(u)
    db.commit()
    sid = uuid.uuid4().hex
    u.current_session_id = sid
    u.session_started_at = datetime.now(timezone.utc)
    db.commit()
    token = create_access_token(u.id, u.role, company_id=1, home_company_id=1, active_company_id=1, session_id=sid)
    return u, {"Authorization": f"Bearer {token}"}


@pytest.fixture
def ctx():
    db = SessionLocal()
    made = {"users": [], "links": [], "sos": []}
    yield db, made
    for res in made["links"]:
        db.execute(text("delete from workshop_orders where id = :i"), {"i": res["wo_id"]})
        db.execute(text("delete from purchase_orders where id = :i"), {"i": res["po_id"]})
        db.execute(text("delete from sales_orders where id = :i"), {"i": res["so_id"]})
    for sid in made["sos"]:
        db.execute(text("delete from workshop_orders where so_id = :i"), {"i": sid})
        db.execute(text("delete from sales_orders where id = :i"), {"i": sid})
    for uid in made["users"]:
        db.execute(text("delete from users where id = :i"), {"i": uid})
    db.commit()
    db.close()


def _link(headers, source=1, supplier=2):
    return client.post("/api/v1/inter-company/link", headers=headers, json={
        "source_company_id": source, "supplier_company_id": supplier, "lines": LINES})


def test_manager_without_the_tick_cannot_link(ctx):
    db, made = ctx
    u, h = _manager(db, ["workshop_orders"])
    made["users"].append(u.id)
    assert client.get("/api/v1/inter-company/supplier-companies", headers=h).status_code == 403
    assert _link(h).status_code == 403


def test_manager_with_the_tick_links_from_own_company_only(ctx):
    db, made = ctx
    u, h = _manager(db, ["workshop_orders", "inter_company_link"])
    made["users"].append(u.id)

    res = client.get("/api/v1/inter-company/supplier-companies", headers=h)
    assert res.status_code == 200, res.text
    ids = [c["id"] for c in res.json()]
    assert 1 not in ids and 2 in ids

    res = _link(h)
    assert res.status_code == 201, res.text
    made["links"].append(res.json())

    # the company being viewed is 1: linking on behalf of another company is refused
    assert _link(h, source=2, supplier=3).status_code == 403


def test_confirming_the_linked_so_moves_it_to_production(ctx):
    db, made = ctx
    u, h = _manager(db, ["workshop_orders", "inter_company_link"])
    made["users"].append(u.id)
    res = _link(h)
    assert res.status_code == 201, res.text
    link = res.json()
    made["links"].append(link)

    so_id = link["so_id"]
    assert db.execute(text("select status from sales_orders where id = :i"), {"i": so_id}).scalar() == "draft"
    # the SO lives in the supplier company: act as a superadmin viewing it
    admin = db.query(User).filter(User.role == "superadmin", User.is_active == True).first()
    sid = uuid.uuid4().hex
    admin.current_session_id = sid
    admin.session_started_at = datetime.now(timezone.utc)
    db.commit()
    sh = {"Authorization": "Bearer " + create_access_token(admin.id, admin.role, company_id=1, home_company_id=1,
                                                             active_company_id=2, session_id=sid)}

    res = client.patch(f"/api/v1/sales-orders/{so_id}/status", json={"status": "confirmed"}, headers=sh)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "in_production"

    # stepping back to confirmed on purpose is kept
    res = client.patch(f"/api/v1/sales-orders/{so_id}/status", json={"status": "confirmed"}, headers=sh)
    assert res.json()["status"] == "confirmed"


def test_confirming_an_so_without_a_wo_stays_confirmed(ctx):
    db, made = ctx
    admin = db.query(User).filter(User.role == "superadmin", User.is_active == True).first()
    sid = uuid.uuid4().hex
    admin.current_session_id = sid
    admin.session_started_at = datetime.now(timezone.utc)
    db.commit()
    h = {"Authorization": "Bearer " + create_access_token(admin.id, admin.role, company_id=1, home_company_id=1,
                                                            active_company_id=1, session_id=sid)}
    res = client.post("/api/v1/sales-orders/", json={"status": "draft"}, headers=h)
    assert res.status_code == 201, res.text
    made["sos"].append(res.json()["id"])
    res = client.patch(f"/api/v1/sales-orders/{res.json()['id']}/status", json={"status": "confirmed"}, headers=h)
    assert res.json()["status"] == "confirmed"


def _superadmin_headers(db, *company_ids):
    """One superadmin session, one header per company viewed (a new login would end the session)."""
    admin = db.query(User).filter(User.role == "superadmin", User.is_active == True).first()
    sid = uuid.uuid4().hex
    admin.current_session_id = sid
    admin.session_started_at = datetime.now(timezone.utc)
    db.commit()
    return [{"Authorization": "Bearer " + create_access_token(admin.id, admin.role, company_id=1, home_company_id=1,
                                                                active_company_id=cid, session_id=sid)}
            for cid in company_ids]


@pytest.mark.parametrize("how", ["status", "save"])
def test_starting_the_wo_moves_an_already_confirmed_so_to_production(ctx, how):
    """SO confirmed before PR #14 (or by an older path) while its WO already existed."""
    db, made = ctx
    h1, h = _superadmin_headers(db, 1, 2)
    res = _link(h1)
    assert res.status_code == 201, res.text
    link = res.json()
    made["links"].append(link)
    db.execute(text("update sales_orders set status = 'confirmed' where id = :i"), {"i": link["so_id"]})
    db.commit()

    if how == "status":
        res = client.patch(f"/api/v1/workshop/{link['wo_id']}/status", json={"status": "in_progress"}, headers=h)
    else:  # a cut recorded on a line makes the save derive in_progress
        wo = client.get(f"/api/v1/workshop/{link['wo_id']}", headers=h).json()
        lines = [{**l, "cut_started_at": "2026-10-01T10:00:00"} for l in wo["lines"]]
        res = client.put(f"/api/v1/workshop/{link['wo_id']}", json={"lines": lines, "status": "draft"}, headers=h)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "in_progress"

    db.expire_all()
    assert db.execute(text("select status from sales_orders where id = :i"), {"i": link["so_id"]}).scalar() == "in_production"


def test_a_draft_wo_leaves_the_so_confirmed(ctx):
    db, made = ctx
    h1, h = _superadmin_headers(db, 1, 2)
    res = _link(h1)
    link = res.json()
    made["links"].append(link)
    db.execute(text("update sales_orders set status = 'confirmed' where id = :i"), {"i": link["so_id"]})
    db.commit()
    res = client.put(f"/api/v1/workshop/{link['wo_id']}", json={"priority": "high"}, headers=h)
    assert res.status_code == 200, res.text
    db.expire_all()
    assert db.execute(text("select status from sales_orders where id = :i"), {"i": link["so_id"]}).scalar() == "confirmed"


def test_linked_po_so_wo_keep_the_entered_quantity(ctx):
    db, made = ctx
    h1, = _superadmin_headers(db, 1)
    res = client.post("/api/v1/inter-company/link", headers=h1, json={
        "source_company_id": 1, "supplier_company_id": 2,
        "lines": [{"description": "Clear Annealed 5mm", "width_inch": 24, "height_inch": 36, "qty": 5},
                  {"description": "Clear Annealed 8mm", "width_inch": 12, "height_inch": 12, "qty": 3}]})
    assert res.status_code == 201, res.text
    link = res.json()
    made["links"].append(link)

    def col(table, column, id_):
        return db.execute(text(f"select {column} from {table} where id = :i"), {"i": id_}).scalar()

    po_lines = col("purchase_orders", "lines", link["po_id"])
    so_lines = col("sales_orders", "lines", link["so_id"])
    so_groups = col("sales_orders", "groups", link["so_id"])
    wo_lines = col("workshop_orders", "lines", link["wo_id"])
    assert [l["quantity"] for l in po_lines] == [5, 3]       # the PO form reads `quantity`
    assert [l["quantity"] for l in so_lines] == [5, 3]       # the SO form rebuilds sizes from lines
    assert [g["sizes"][0]["quantity"] for g in so_groups] == [5, 3]
    assert [l["qty"] for l in wo_lines] == [5, 3]


def test_linked_po_so_reference_is_the_source_so(ctx):
    """The PO's SO Reference is the source company's own SO behind the linked WO, not the supplier's name."""
    db, made = ctx
    h1, = _superadmin_headers(db, 1)
    so = client.post("/api/v1/sales-orders/", json={"status": "draft"}, headers=h1).json()
    made["sos"].append(so["id"])
    wo = client.post("/api/v1/workshop/", json={"so_id": so["id"], "so_number": so["so_number"], "lines": LINES}, headers=h1)
    assert wo.status_code == 201, wo.text
    res = client.post("/api/v1/inter-company/link", headers=h1, json={
        "source_company_id": 1, "supplier_company_id": 2, "source_wo_id": wo.json()["id"], "lines": LINES})
    assert res.status_code == 201, res.text
    link = res.json()
    made["links"].append(link)
    ref = db.execute(text("select vendor_reference from purchase_orders where id = :i"), {"i": link["po_id"]}).scalar()
    assert ref == so["so_number"]


@pytest.mark.parametrize("how", ["delete", "archive"])  # the lists' red delete icon calls archive
def test_deleting_the_linked_so_deletes_only_the_supplier_side(ctx, how):
    """Delete the linked SO in the supplier company: its WO and POs there go, the source company's PO stays."""
    db, made = ctx
    h1, h2 = _superadmin_headers(db, 1, 2)
    res = client.post("/api/v1/inter-company/link", headers=h1, json={
        "source_company_id": 1, "supplier_company_id": 2, "lines": LINES})
    assert res.status_code == 201, res.text
    link = res.json()
    made["links"].append(link)
    supplier_po = client.post("/api/v1/purchase-orders/", json={"so_id": link["so_id"], "lines": []}, headers=h2)
    assert supplier_po.status_code == 201, supplier_po.text
    other_so = client.post("/api/v1/sales-orders/", json={"status": "draft"}, headers=h2).json()
    made["sos"].append(other_so["id"])
    other_wo = client.post("/api/v1/workshop/", json={"so_id": other_so["id"], "lines": LINES}, headers=h2).json()

    if how == "delete":
        assert client.delete(f"/api/v1/sales-orders/{link['so_id']}", headers=h2).status_code == 200
    else:
        assert client.patch(f"/api/v1/sales-orders/{link['so_id']}/archive", headers=h2).status_code == 200

    def active(table, id_):
        db.expire_all()
        return db.execute(text(f"select is_active from {table} where id = :i"), {"i": id_}).scalar()
    try:
        assert active("sales_orders", link["so_id"]) is False
        assert active("workshop_orders", link["wo_id"]) is False
        assert active("purchase_orders", supplier_po.json()["id"]) is False
        assert active("purchase_orders", link["po_id"]) is True       # source company's PO untouched
        assert active("workshop_orders", other_wo["id"]) is True       # unrelated WO untouched
    finally:
        db.execute(text("delete from purchase_orders where id = :i"), {"i": supplier_po.json()["id"]})
        db.commit()


def test_deleting_a_normal_so_leaves_its_wo(ctx):
    db, made = ctx
    h1, = _superadmin_headers(db, 1)
    so = client.post("/api/v1/sales-orders/", json={"status": "draft"}, headers=h1).json()
    made["sos"].append(so["id"])
    wo = client.post("/api/v1/workshop/", json={"so_id": so["id"], "lines": LINES}, headers=h1).json()
    assert client.delete(f"/api/v1/sales-orders/{so['id']}", headers=h1).status_code == 200
    db.expire_all()
    assert db.execute(text("select is_active from workshop_orders where id = :i"), {"i": wo["id"]}).scalar() is True
