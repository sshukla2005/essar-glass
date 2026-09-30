"""HS code mapping: seeded rules, resolution order, matching, and the admin API."""
import os
import sys
import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from main import app
from app.database import SessionLocal
from app.models import User, Company, HsnMapping, Product
from app.services.auth_service import create_access_token
from app.services.hsn_service import resolve_hs_code, resolve_product_hs_code, DEFAULT_HS_CODE

client = TestClient(app)


@pytest.fixture
def db():
    """Session; any hsn_mappings rows a test adds to `db.info['added']` are deleted afterwards."""
    s = SessionLocal()
    s.info["added"] = []
    try:
        yield s
    finally:
        s.rollback()
        for rid in s.info["added"]:
            s.query(HsnMapping).filter(HsnMapping.id == rid).delete()
        s.commit()
        s.close()


@pytest.fixture
def company_id(db):
    return db.query(Company).order_by(Company.id).first().id


def _add(db, **kw):
    row = HsnMapping(is_active=True, **kw)
    db.add(row)
    db.commit()
    db.info["added"].append(row.id)
    return row


def _headers(db, role):
    user = db.query(User).filter(User.role == role, User.is_active == True).first()
    sid = uuid.uuid4().hex
    user.current_session_id = sid
    user.session_started_at = datetime.now(timezone.utc)
    db.commit()
    cid = user.company_id or 1
    token = create_access_token(user.id, user.role, company_id=cid, home_company_id=cid,
                                active_company_id=cid, session_id=sid)
    return {"Authorization": f"Bearer {token}"}


# ── Seeded rules ────────────────────────────────────────────────────────────

SEEDED = [
    ("Annealed", "Clear", "70052990"),
    ("Annealed", "Xtra Clear", "70052990"),
    ("Annealed", "Reflective", "70051090"),
    ("Annealed", "Tinted", "70051010"),
    ("Annealed", "Patterned", "70031990"),
    ("Annealed", "Mirror", "70099100"),
    ("Toughened", None, "70071900"),
    ("Laminated", None, "70071900"),
    ("DGU", None, "70080010"),
]


def test_all_nine_rules_are_seeded_globally(db):
    rows = db.query(HsnMapping).filter(HsnMapping.company_id.is_(None), HsnMapping.is_active == True).all()
    seeded = {(r.glass_type, r.glass_category, r.hs_code) for r in rows}
    assert set(SEEDED) <= seeded


@pytest.mark.parametrize("glass_type,glass_category,expected", SEEDED)
def test_each_seeded_rule_resolves(db, company_id, glass_type, glass_category, expected):
    assert resolve_hs_code(db, company_id=company_id, glass_type=glass_type, glass_category=glass_category) == expected


# ── Matching ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("category", ["xtra clear", "Xtra Clear", " XTRA CLEAR ", "\tXtra clear\n"])
def test_category_match_is_case_insensitive_and_trimmed(db, company_id, category):
    assert resolve_hs_code(db, company_id=company_id, glass_type="Annealed", glass_category=category) == "70052990"


@pytest.mark.parametrize("glass_type", ["toughened", "TOUGHENED", "  Toughened  "])
def test_type_match_is_case_insensitive_and_trimmed(db, company_id, glass_type):
    assert resolve_hs_code(db, company_id=company_id, glass_type=glass_type, glass_category="Clear") == "70071900"


def test_stored_values_with_odd_case_and_spaces_still_match(db, company_id):
    _add(db, company_id=company_id, glass_type="  sPeCiAl  ", glass_category=" GREY ", hs_code="11112222")
    assert resolve_hs_code(db, company_id=company_id, glass_type="Special", glass_category="grey") == "11112222"


@pytest.mark.parametrize("glass_type,glass_category", [
    ("Unobtanium", "Clear"), ("Unobtanium", None), (None, None), ("", "Clear"), ("   ", None),
])
def test_unknown_or_missing_type_falls_back_to_default(db, company_id, glass_type, glass_category):
    assert resolve_hs_code(db, company_id=company_id, glass_type=glass_type, glass_category=glass_category) == DEFAULT_HS_CODE
    assert DEFAULT_HS_CODE == "70051090"


def test_unknown_category_falls_back_to_default_when_type_has_no_type_level_rule(db, company_id):
    # Annealed only has category rules, so an unknown category gets the default
    assert resolve_hs_code(db, company_id=company_id, glass_type="Annealed", glass_category="Frosted") == DEFAULT_HS_CODE


# ── Resolution order ────────────────────────────────────────────────────────

def test_product_own_hsn_code_is_not_overridden(db, company_id):
    assert resolve_hs_code(db, company_id=company_id, glass_type="Toughened", glass_category="Clear",
                           product_hsn_code="7007") == "7007"
    assert resolve_hs_code(db, company_id=company_id, glass_type="Toughened",
                           product_hsn_code="  7007 ") == "7007"


@pytest.mark.parametrize("blank", ["", "   ", None])
def test_blank_product_hsn_code_is_ignored(db, company_id, blank):
    assert resolve_hs_code(db, company_id=company_id, glass_type="Toughened", product_hsn_code=blank) == "70071900"


def test_resolve_product_hs_code_uses_product_fields(db, company_id):
    p = Product(glass_type="annealed ", glass_category="MIRROR", hsn_code=None, company_id=company_id)
    assert resolve_product_hs_code(db, p) == "70099100"
    p.hsn_code = "70099200"
    assert resolve_product_hs_code(db, p) == "70099200"


def test_type_level_null_category_rule_applies_to_any_category(db, company_id):
    for cat in ("Clear", "Tinted", "Mirror", None, "Anything"):
        assert resolve_hs_code(db, company_id=company_id, glass_type="Toughened", glass_category=cat) == "70071900"


def test_company_type_category_row_beats_global(db, company_id):
    _add(db, company_id=company_id, glass_type="Annealed", glass_category="Clear", hs_code="11110001")
    assert resolve_hs_code(db, company_id=company_id, glass_type="annealed", glass_category="clear") == "11110001"
    other = db.query(Company).filter(Company.id != company_id).order_by(Company.id).first()
    if other:
        assert resolve_hs_code(db, company_id=other.id, glass_type="Annealed", glass_category="Clear") == "70052990"


def test_company_type_level_row_beats_global_category_row(db, company_id):
    # Step 3 (company, type, NULL) comes before step 4 (global, type, category)
    _add(db, company_id=company_id, glass_type="Annealed", glass_category=None, hs_code="11110002")
    assert resolve_hs_code(db, company_id=company_id, glass_type="Annealed", glass_category="Clear") == "11110002"


def test_company_category_row_beats_company_type_level_row(db, company_id):
    _add(db, company_id=company_id, glass_type="Toughened", glass_category=None, hs_code="11110003")
    _add(db, company_id=company_id, glass_type="Toughened", glass_category="Tinted", hs_code="11110004")
    assert resolve_hs_code(db, company_id=company_id, glass_type="Toughened", glass_category="tinted") == "11110004"
    assert resolve_hs_code(db, company_id=company_id, glass_type="Toughened", glass_category="Clear") == "11110003"


def test_deactivated_row_falls_through(db, company_id):
    row = _add(db, company_id=company_id, glass_type="Annealed", glass_category="Clear", hs_code="11110005")
    assert resolve_hs_code(db, company_id=company_id, glass_type="Annealed", glass_category="Clear") == "11110005"
    row.is_active = False
    db.commit()
    assert resolve_hs_code(db, company_id=company_id, glass_type="Annealed", glass_category="Clear") == "70052990"


# ── Admin API ───────────────────────────────────────────────────────────────

def test_api_is_superadmin_only(db):
    sales = _headers(db, "sales")
    assert client.get("/api/v1/hsn-mappings", headers=sales).status_code == 403
    assert client.post("/api/v1/hsn-mappings", json={"glass_type": "X", "hs_code": "1234"}, headers=sales).status_code == 403
    assert client.patch("/api/v1/hsn-mappings/1", json={"hs_code": "1234"}, headers=sales).status_code == 403


def test_api_list_add_edit_deactivate(db, company_id):
    h = _headers(db, "superadmin")
    listed = client.get("/api/v1/hsn-mappings", headers=h)
    assert listed.status_code == 200
    assert {(r["glass_type"], r["glass_category"], r["hs_code"]) for r in listed.json()["items"]} >= set(SEEDED)

    res = client.post("/api/v1/hsn-mappings", json={
        "company_id": company_id, "glass_type": " Annealed ", "glass_category": " Clear ", "hs_code": " 70052999 "}, headers=h)
    assert res.status_code == 201, res.text
    row = res.json()
    db.info["added"].append(row["id"])
    assert (row["glass_type"], row["glass_category"], row["hs_code"]) == ("Annealed", "Clear", "70052999")

    # Same company/type/category in any case is a duplicate while active
    dup = client.post("/api/v1/hsn-mappings", json={
        "company_id": company_id, "glass_type": "ANNEALED", "glass_category": "clear", "hs_code": "70050000"}, headers=h)
    assert dup.status_code == 409

    edited = client.patch(f"/api/v1/hsn-mappings/{row['id']}", json={"hs_code": "70052998"}, headers=h)
    assert edited.status_code == 200 and edited.json()["hs_code"] == "70052998"
    assert client.patch(f"/api/v1/hsn-mappings/{row['id']}", json={"hs_code": "70A5"}, headers=h).status_code == 400

    off = client.patch(f"/api/v1/hsn-mappings/{row['id']}", json={"is_active": False}, headers=h)
    assert off.status_code == 200 and off.json()["is_active"] is False
    assert row["id"] not in [r["id"] for r in client.get("/api/v1/hsn-mappings", headers=h).json()["items"]]
    assert row["id"] in [r["id"] for r in client.get("/api/v1/hsn-mappings?include_inactive=true", headers=h).json()["items"]]


def test_api_duplicate_global_type_level_rule_is_rejected(db):
    h = _headers(db, "superadmin")
    res = client.post("/api/v1/hsn-mappings", json={"glass_type": "toughened", "hs_code": "70071901"}, headers=h)
    assert res.status_code == 409


def test_api_reactivating_into_a_duplicate_is_rejected(db, company_id):
    h = _headers(db, "superadmin")
    old = _add(db, company_id=company_id, glass_type="Laminated", glass_category=None, hs_code="11110006")
    old.is_active = False
    db.commit()
    _add(db, company_id=company_id, glass_type="Laminated", glass_category=None, hs_code="11110007")
    res = client.patch(f"/api/v1/hsn-mappings/{old.id}", json={"is_active": True}, headers=h)
    assert res.status_code == 409


def test_resolve_endpoint(db):
    h = _headers(db, "sales")
    res = client.get("/api/v1/hsn-mappings/resolve", params={"glass_type": " dgu ", "glass_category": "Clear"}, headers=h)
    assert res.status_code == 200
    assert res.json()["hs_code"] == "70080010"
    res = client.get("/api/v1/hsn-mappings/resolve", params={"glass_type": "Nope"}, headers=h)
    assert res.json()["hs_code"] == DEFAULT_HS_CODE


# ── Batch resolve (used by the PDFs and invoice lines) ─────────────────────

@pytest.fixture
def products(db, company_id):
    """Two temporary glass products: one with its own hsn_code, one without."""
    tag = uuid.uuid4().hex[:6]
    own = Product(internal_ref=f"T{tag}A", name=f"HSN test own {tag}", glass_type="Toughened",
                  glass_category="Clear", hsn_code="7007", company_id=company_id)
    auto = Product(internal_ref=f"T{tag}B", name=f"HSN test auto {tag}", glass_type=" annealed ",
                   glass_category="MIRROR", hsn_code="  ", company_id=company_id)
    db.add_all([own, auto])
    db.commit()
    yield {"own": own, "auto": auto}
    db.query(Product).filter(Product.id.in_([own.id, auto.id])).delete(synchronize_session=False)
    db.commit()


def _batch(headers, items):
    res = client.post("/api/v1/hsn-mappings/resolve-batch", json={"items": items}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["codes"]


def test_batch_product_own_hsn_code_wins(db, products):
    h = _headers(db, "sales")
    # Even when the document line says another type, the product's own code is used
    assert _batch(h, [{"product_id": products["own"].id, "glass_type": "DGU"}]) == ["7007"]


def test_batch_product_without_own_code_uses_mapping(db, products):
    h = _headers(db, "sales")
    assert _batch(h, [{"product_id": products["auto"].id}]) == ["70099100"]


def test_batch_document_type_and_category_override_product_fields(db, products):
    h = _headers(db, "sales")
    assert _batch(h, [{"product_id": products["auto"].id, "glass_type": "Toughened", "glass_category": "Clear"}]) == ["70071900"]


def test_batch_default_when_nothing_matches(db):
    h = _headers(db, "sales")
    assert _batch(h, [{"glass_type": "Unobtanium"}, {}, {"product_id": 999999999}]) == [DEFAULT_HS_CODE] * 3


def test_batch_keeps_order_for_a_twenty_line_document(db):
    h = _headers(db, "sales")
    kinds = [("Annealed", "Clear", "70052990"), (" toughened ", None, "70071900"),
             ("DGU", "Clear", "70080010"), ("Annealed", "xtra clear", "70052990"), ("Nope", None, DEFAULT_HS_CODE)]
    items = [{"glass_type": t, "glass_category": c} for t, c, _ in kinds] * 4
    assert _batch(h, items) == [code for _, _, code in kinds] * 4


def test_batch_rejects_oversized_requests(db):
    h = _headers(db, "sales")
    res = client.post("/api/v1/hsn-mappings/resolve-batch", json={"items": [{}] * 501}, headers=h)
    assert res.status_code == 400
