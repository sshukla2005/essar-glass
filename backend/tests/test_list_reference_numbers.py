"""Lists show the linked document's real number, not 'QT'/'SO' + its database id."""
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
from app.models.quotation import Quotation
from app.models.sales_order import SalesOrder
from app.models.invoice import Invoice
from app.models.delivery import DeliveryChallan
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
    tag = uuid.uuid4().hex[:5].upper()
    q = Quotation(quote_number=f"QT-R{tag}", company_id=1, status="converted", is_active=True)
    db.add(q); db.flush()
    so = SalesOrder(so_number=f"SO-R{tag}", company_id=1, status="confirmed", is_active=True, quotation_id=q.id)
    db.add(so); db.flush()
    inv = Invoice(invoice_number=f"INV-R{tag}", company_id=1, status="draft", is_active=True, so_id=so.id)
    dc = DeliveryChallan(dc_number=f"DC-R{tag}", company_id=1, status="draft", is_active=True, so_id=so.id)
    db.add_all([inv, dc]); db.commit()
    yield h, q, so, inv, dc
    for table, id_ in [("invoices", inv.id), ("delivery_challans", dc.id), ("sales_orders", so.id), ("quotations", q.id)]:
        db.execute(text(f"delete from {table} where id = :i"), {"i": id_})
    db.commit()
    db.close()


def _row(h, prefix, id_):
    res = client.get(f"/api/v1/{prefix}/", params={"page_size": 1000}, headers=h)
    assert res.status_code == 200, res.text
    return next(r for r in res.json()["items"] if r["id"] == id_)


def test_sales_order_list_shows_the_quotation_number(ctx):
    h, q, so, _, _ = ctx
    row = _row(h, "sales-orders", so.id)
    assert row["quotation_id"] == q.id
    assert row["quotation_number"] == q.quote_number


@pytest.mark.parametrize("prefix,idx", [("invoices", 3), ("delivery", 4)])
def test_invoice_and_dc_lists_show_the_so_number(ctx, prefix, idx):
    h, _, so, *_rest = ctx
    doc = ctx[idx]
    assert _row(h, prefix, doc.id)["so_ref_number"] == so.so_number
