import os
import sys
import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from main import app, format_indian_currency
from app.config import settings
from app.database import SessionLocal
from app.models import User, Company, Quotation, Customer
from app.services.auth_service import create_access_token
from app.services.whatsapp_service import normalize_phone_number, send_quotation_confirmed

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


def get_auth_headers(db: Session, role="superadmin"):
    user = db.query(User).filter(User.role == role, User.is_active == True).first()
    if not user:
        user = db.query(User).first()
    sid = uuid.uuid4().hex
    user.current_session_id = sid
    from datetime import datetime, timezone
    user.session_started_at = datetime.now(timezone.utc)
    db.commit()
    company_id = user.company_id or 1
    token = create_access_token(
        user.id, user.role, company_id=company_id, home_company_id=company_id, active_company_id=company_id, session_id=sid
    )
    return {"Authorization": f"Bearer {token}"}


def test_normalize_phone_number():
    # 10 digits -> prefix 91
    valid, num = normalize_phone_number("9702883617")
    assert valid is True
    assert num == "919702883617"

    # 12 digits starting with 91 -> unchanged
    valid, num = normalize_phone_number("919702883617")
    assert valid is True
    assert num == "919702883617"

    # Invalid numbers
    valid, num = normalize_phone_number("12345")
    assert valid is False
    assert num == "12345"

    valid, num = normalize_phone_number("")
    assert valid is False

    # Strips formatting characters
    valid, num = normalize_phone_number("+91 97028-83617")
    assert valid is True
    assert num == "919702883617"


def test_format_indian_currency():
    assert format_indian_currency(806554.00) == "8,06,554.00"
    assert format_indian_currency(0) == "0.00"
    assert format_indian_currency(None) == "0.00"
    assert format_indian_currency(500) == "500.00"
    assert format_indian_currency(1000) == "1,000.00"
    assert format_indian_currency(100000) == "1,00,000.00"
    assert format_indian_currency(12345678.9) == "1,23,45,678.90"


def test_send_quotation_confirmed_missing_config():
    with patch.object(settings, "WHATSAPP_TOKEN", ""):
        res = send_quotation_confirmed(
            to_number="9702883617",
            document_url="https://example.com/doc.pdf",
            customer_name="Test Customer",
            quote_number="QT1001",
            quote_date="2026-09-20",
            total_amount="8,06,554.00",
            company_name="Essar Glass",
        )
        assert res["sent"] is False
        assert "WHATSAPP_TOKEN" in res["reason"]

    with patch.object(settings, "WHATSAPP_PHONE_NUMBER_ID", ""):
        res = send_quotation_confirmed(
            to_number="9702883617",
            document_url="https://example.com/doc.pdf",
            customer_name="Test Customer",
            quote_number="QT1001",
            quote_date="2026-09-20",
            total_amount="8,06,554.00",
            company_name="Essar Glass",
        )
        assert res["sent"] is False
        assert "WHATSAPP_PHONE_NUMBER_ID" in res["reason"]


def test_send_quotation_confirmed_invalid_number():
    with patch.object(settings, "WHATSAPP_TOKEN", "mock_token"), \
         patch.object(settings, "WHATSAPP_PHONE_NUMBER_ID", "123456"):
        res = send_quotation_confirmed(
            to_number="12345",
            document_url="https://example.com/doc.pdf",
            customer_name="Test Customer",
            quote_number="QT1001",
            quote_date="2026-09-20",
            total_amount="8,06,554.00",
            company_name="Essar Glass",
        )
        assert res["sent"] is False
        assert res["reason"] == "invalid number"


def test_send_quotation_confirmed_success():
    with patch.object(settings, "WHATSAPP_TOKEN", "mock_token"), \
         patch.object(settings, "WHATSAPP_PHONE_NUMBER_ID", "123456"), \
         patch("httpx.Client.post") as mock_post:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"messages": [{"id": "wamid.123"}]}
        mock_post.return_value = mock_response

        res = send_quotation_confirmed(
            to_number="9702883617",
            document_url="https://example.com/doc.pdf",
            customer_name="Test Customer",
            quote_number="QT1001",
            quote_date="2026-09-20",
            total_amount="8,06,554.00",
            company_name="Essar Glass",
        )
        assert res["sent"] is True
        assert "messages" in res["response"]


def test_send_whatsapp_endpoint_customer_no_phone(db_session: Session):
    headers = get_auth_headers(db_session)
    company = db_session.query(Company).first()
    cid = company.id if company else 1

    # Customer with no phone
    cust = Customer(
        customer_code=f"CUST-NOPHONE-{uuid.uuid4().hex[:4].upper()}",
        name="Customer No Phone",
        company_id=cid,
        phone=None,
        mobile=None,
    )
    db_session.add(cust)
    db_session.commit()

    quote = Quotation(
        quote_number=f"QT-NOPHONE-{uuid.uuid4().hex[:4].upper()}",
        company_id=cid,
        customer_id=cust.id,
        status="draft",
        total_amount=5000.0,
    )
    db_session.add(quote)
    db_session.commit()

    res = client.post(
        f"/api/v1/quotations/{quote.id}/send-whatsapp",
        json={"document_url": "/uploads/quotations/test.pdf"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["sent"] is False
    assert data["reason"] == "customer has no phone"


def test_send_whatsapp_endpoint_public_base_url_empty(db_session: Session):
    headers = get_auth_headers(db_session)
    company = db_session.query(Company).first()
    cid = company.id if company else 1

    cust = Customer(
        customer_code=f"CUST-PHONE-{uuid.uuid4().hex[:4].upper()}",
        name="Customer With Phone",
        company_id=cid,
        phone="9702883617",
    )
    db_session.add(cust)
    db_session.commit()

    quote = Quotation(
        quote_number=f"QT-PHONE-{uuid.uuid4().hex[:4].upper()}",
        company_id=cid,
        customer_id=cust.id,
        status="draft",
        total_amount=5000.0,
    )
    db_session.add(quote)
    db_session.commit()

    with patch.object(settings, "PUBLIC_BASE_URL", ""):
        res = client.post(
            f"/api/v1/quotations/{quote.id}/send-whatsapp",
            json={"document_url": "/uploads/quotations/test.pdf"},
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["sent"] is False
        assert data["reason"] == "PUBLIC_BASE_URL not configured"
