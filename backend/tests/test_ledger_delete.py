"""Deleting entries from the customer ledger (Transaction History).

Payments: DELETE /payments/{id} reverses allocations so paid invoices are due again.
Invoices: archive/delete is refused while payments are still allocated to them.
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
    cust = client.post("/api/v1/customers/", json={"name": f"Ledger Test {uuid.uuid4().hex[:6]}"}, headers=h).json()
    inv = client.post("/api/v1/invoices/", json={"customer_id": cust["id"], "status": "sent", "total_amount": 1000,
                                                 "invoice_date": "2026-09-01"}, headers=h).json()
    made = {"h": h, "cust": cust["id"], "inv": inv["id"], "payments": []}
    yield made
    for pid in made["payments"]:
        db.execute(text("delete from payment_allocations where payment_id = :p"), {"p": pid})
        db.execute(text("delete from payments where id = :p"), {"p": pid})
    db.execute(text("delete from invoices where id = :i"), {"i": inv["id"]})
    db.execute(text("delete from customers where id = :c"), {"c": cust["id"]})
    db.commit()
    db.close()


def _pay(ctx, amount):
    res = client.post("/api/v1/payments/", json={
        "customer_id": ctx["cust"], "amount": amount, "payment_mode": "cash", "payment_date": "2026-09-05",
        "allocations": [{"invoice_id": ctx["inv"], "amount": amount}],
    }, headers=ctx["h"])
    assert res.status_code == 201, res.text
    ctx["payments"].append(res.json()["id"])
    return res.json()


def _ledger(ctx):
    res = client.get(f"/api/v1/receivables/customer/{ctx['cust']}", headers=ctx["h"])
    assert res.status_code == 200, res.text
    return res.json()


def _invoice(ctx):
    return client.get(f"/api/v1/invoices/{ctx['inv']}", headers=ctx["h"]).json()


def test_deleting_a_payment_removes_it_and_makes_the_invoice_due_again(ctx):
    pay = _pay(ctx, 400)
    assert _invoice(ctx)["balance_due"] == 600
    assert {t["type"] for t in _ledger(ctx)["transactions"]} == {"invoice", "payment"}

    res = client.delete(f"/api/v1/payments/{pay['id']}", headers=ctx["h"])
    assert res.status_code == 200, res.text

    ledger = _ledger(ctx)
    assert [t["type"] for t in ledger["transactions"]] == ["invoice"]
    assert ledger["balance"] == 1000
    assert _invoice(ctx)["balance_due"] == 1000


@pytest.mark.parametrize("how", ["archive", "delete"])
def test_invoice_with_payments_cannot_be_deleted(ctx, how):
    _pay(ctx, 400)
    res = (client.patch(f"/api/v1/invoices/{ctx['inv']}/archive", headers=ctx["h"]) if how == "archive"
           else client.delete(f"/api/v1/invoices/{ctx['inv']}", headers=ctx["h"]))
    assert res.status_code == 400
    assert "Delete those payments first" in res.json()["detail"]
    assert any(t["type"] == "invoice" for t in _ledger(ctx)["transactions"])


def test_invoice_without_payments_can_be_deleted_from_the_ledger(ctx):
    pay = _pay(ctx, 400)
    client.delete(f"/api/v1/payments/{pay['id']}", headers=ctx["h"])
    res = client.patch(f"/api/v1/invoices/{ctx['inv']}/archive", headers=ctx["h"])
    assert res.status_code == 200, res.text
    ledger = _ledger(ctx)
    assert ledger["transactions"] == []
    assert ledger["balance"] == 0
