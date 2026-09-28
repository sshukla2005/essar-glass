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
    company = db_session.query(Company).order_by(Company.id).first()
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
    company = db_session.query(Company).order_by(Company.id).first()
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


# ── Per-company WhatsApp configuration ───────────────────────────────────────

def _send(company=None, to_number="9702883617"):
    return send_quotation_confirmed(
        to_number=to_number,
        document_url="https://example.com/doc.pdf",
        customer_name="Test Customer",
        quote_number="QT1001",
        quote_date="2026-09-20",
        total_amount="1,000.00",
        company_name="Test Co",
        company=company,
    )


def _ok_response():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"messages": [{"id": "wamid.1"}]}
    return mock_response


def test_company_with_own_config_uses_it_not_the_global():
    company = Company(
        name="Excel Traders Test", whatsapp_enabled=True,
        whatsapp_phone_number_id="CO-PHONE-ID", whatsapp_token="co-token-xyz",
        whatsapp_template_quotation="excel_quote_tpl", whatsapp_api_url="https://co.example.com/v1/",
    )
    with patch.object(settings, "WHATSAPP_TOKEN", "global-token"), \
         patch.object(settings, "WHATSAPP_PHONE_NUMBER_ID", "GLOBAL-PHONE-ID"), \
         patch.object(settings, "WHATSAPP_TEMPLATE_QUOTATION", "global_tpl"), \
         patch.object(settings, "WHATSAPP_API_URL", "https://global.example.com/v19.0"), \
         patch("httpx.Client.post", return_value=_ok_response()) as mock_post:
        res = _send(company)
    assert res["sent"] is True
    url = mock_post.call_args.args[0]
    kwargs = mock_post.call_args.kwargs
    assert url == "https://co.example.com/v1/CO-PHONE-ID/messages"
    assert kwargs["headers"]["Authorization"] == "Bearer co-token-xyz"
    assert kwargs["json"]["template"]["name"] == "excel_quote_tpl"


def test_company_with_blank_fields_falls_back_to_settings():
    company = Company(
        name="Essar Test", whatsapp_enabled=True,
        whatsapp_phone_number_id="", whatsapp_token=None,
        whatsapp_template_quotation="  ", whatsapp_api_url=None,
    )
    with patch.object(settings, "WHATSAPP_TOKEN", "global-token"), \
         patch.object(settings, "WHATSAPP_PHONE_NUMBER_ID", "GLOBAL-PHONE-ID"), \
         patch.object(settings, "WHATSAPP_TEMPLATE_QUOTATION", "global_tpl"), \
         patch.object(settings, "WHATSAPP_API_URL", "https://global.example.com/v19.0"), \
         patch("httpx.Client.post", return_value=_ok_response()) as mock_post:
        res = _send(company)
    assert res["sent"] is True
    assert mock_post.call_args.args[0] == "https://global.example.com/v19.0/GLOBAL-PHONE-ID/messages"
    assert mock_post.call_args.kwargs["headers"]["Authorization"] == "Bearer global-token"
    assert mock_post.call_args.kwargs["json"]["template"]["name"] == "global_tpl"


def test_no_company_uses_global_settings():
    with patch.object(settings, "WHATSAPP_TOKEN", "global-token"), \
         patch.object(settings, "WHATSAPP_PHONE_NUMBER_ID", "GLOBAL-PHONE-ID"), \
         patch("httpx.Client.post", return_value=_ok_response()) as mock_post:
        res = _send(None)
    assert res["sent"] is True
    assert mock_post.call_args.kwargs["headers"]["Authorization"] == "Bearer global-token"


def test_disabled_company_skips_sending_without_raising():
    company = Company(name="Disabled Co", whatsapp_enabled=False,
                      whatsapp_phone_number_id="CO-PHONE-ID", whatsapp_token="co-token")
    with patch.object(settings, "WHATSAPP_TOKEN", "global-token"), \
         patch.object(settings, "WHATSAPP_PHONE_NUMBER_ID", "GLOBAL-PHONE-ID"), \
         patch("httpx.Client.post") as mock_post:
        res = _send(company)
    assert res == {"sent": False, "reason": "WhatsApp disabled for this company"}
    mock_post.assert_not_called()


SECRET = "tok-" + uuid.uuid4().hex   # unique so a leak anywhere in a response is detectable


@pytest.fixture
def wa_company(db_session: Session):
    company = Company(name=f"WA Test Co {uuid.uuid4().hex[:6]}", whatsapp_enabled=True,
                      whatsapp_phone_number_id="WA-TEST-PHONE", whatsapp_token=SECRET)
    db_session.add(company)
    db_session.commit()
    yield company
    db_session.query(Quotation).filter(Quotation.company_id == company.id).delete(synchronize_session=False)
    db_session.query(Customer).filter(Customer.company_id == company.id).delete(synchronize_session=False)
    db_session.query(Company).filter(Company.id == company.id).delete(synchronize_session=False)
    db_session.commit()


def test_company_responses_never_contain_the_token(db_session: Session, wa_company):
    headers = get_auth_headers(db_session)
    for path in (f"/api/v1/companies/{wa_company.id}", "/api/v1/companies/?page=1&page_size=1000", "/api/v1/companies/dropdown"):
        res = client.get(path, headers=headers)
        assert res.status_code == 200, (path, res.text)
        assert SECRET not in res.text, path
        assert '"whatsapp_token"' not in res.text, path
    item = client.get(f"/api/v1/companies/{wa_company.id}", headers=headers).json()
    assert item["whatsapp_token_set"] is True
    assert item["whatsapp_phone_number_id"] == "WA-TEST-PHONE"


def test_company_update_with_empty_token_keeps_stored_token(db_session: Session, wa_company):
    headers = get_auth_headers(db_session)
    url = f"/api/v1/companies/{wa_company.id}"

    for payload in ({"whatsapp_token": ""}, {"whatsapp_token": "   "}, {"whatsapp_token": None},
                    {"whatsapp_template_quotation": "tpl_only"}):
        res = client.put(url, json=payload, headers=headers)
        assert res.status_code == 200, res.text
        assert SECRET not in res.text
        assert res.json()["whatsapp_token_set"] is True
        db_session.expire_all()
        assert db_session.get(Company, wa_company.id).whatsapp_token == SECRET, payload

    # The computed flag is read-only: sending it back changes nothing
    res = client.put(url, json={"whatsapp_token_set": False}, headers=headers)
    assert res.status_code == 200 and res.json()["whatsapp_token_set"] is True

    # A non-empty value replaces it
    res = client.put(url, json={"whatsapp_token": "replacement-token"}, headers=headers)
    assert res.status_code == 200 and "replacement-token" not in res.text
    db_session.expire_all()
    assert db_session.get(Company, wa_company.id).whatsapp_token == "replacement-token"


def test_send_endpoint_uses_the_quotation_company_config(db_session: Session, wa_company):
    headers = get_auth_headers(db_session)
    cust = Customer(customer_code=f"CUST-WA-{uuid.uuid4().hex[:4].upper()}", name="WA Customer",
                    company_id=wa_company.id, phone="9702883617")
    db_session.add(cust)
    db_session.commit()
    quote = Quotation(quote_number=f"QT-WA-{uuid.uuid4().hex[:4].upper()}", company_id=wa_company.id,
                      customer_id=cust.id, status="confirmed", total_amount=1000.0)
    db_session.add(quote)
    db_session.commit()
    # superadmin viewing the test company
    user = db_session.query(User).filter(User.role == "superadmin", User.is_active == True).first()
    sid = uuid.uuid4().hex
    from datetime import datetime, timezone
    user.current_session_id, user.session_started_at = sid, datetime.now(timezone.utc)
    db_session.commit()
    token = create_access_token(user.id, user.role, company_id=user.company_id or 1, home_company_id=user.company_id or 1,
                                active_company_id=wa_company.id, session_id=sid)

    with patch.object(settings, "PUBLIC_BASE_URL", "https://erp.example.com"), \
         patch.object(settings, "WHATSAPP_TOKEN", "global-token"), \
         patch.object(settings, "WHATSAPP_PHONE_NUMBER_ID", "GLOBAL-PHONE-ID"), \
         patch("app.services.whatsapp_service.httpx.Client") as mock_client:
        # Patch only the service's httpx: TestClient itself is an httpx.Client
        mock_post = mock_client.return_value.__enter__.return_value.post
        mock_post.return_value = _ok_response()
        res = client.post(f"/api/v1/quotations/{quote.id}/send-whatsapp",
                          json={"document_url": "/uploads/quotations/x.pdf"},
                          headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    assert res.json().get("sent") is True, res.text
    assert "/WA-TEST-PHONE/messages" in mock_post.call_args.args[0]
    assert mock_post.call_args.kwargs["headers"]["Authorization"] == f"Bearer {SECRET}"
    assert mock_client.call_args.kwargs.get("timeout") == 30.0


# ── All-or-nothing credentials: never mix a company credential with a global one ──

GLOBAL_ENV = {
    "WHATSAPP_TOKEN": "global-token",
    "WHATSAPP_PHONE_NUMBER_ID": "GLOBAL-PHONE-ID",
    "WHATSAPP_TEMPLATE_QUOTATION": "global_tpl",
    "WHATSAPP_API_URL": "https://global.example.com/v19.0",
}


def _send_with_globals(company):
    """Send with known global settings; returns (result, mocked post)."""
    patches = [patch.object(settings, k, v) for k, v in GLOBAL_ENV.items()]
    for p in patches:
        p.start()
    try:
        with patch("app.services.whatsapp_service.httpx.Client") as mock_client:
            mock_post = mock_client.return_value.__enter__.return_value.post
            mock_post.return_value = _ok_response()
            return _send(company), mock_post
    finally:
        for p in patches:
            p.stop()


def test_both_credentials_set_uses_company_and_falls_back_for_template_and_url():
    company = Company(name="Excel Traders", whatsapp_enabled=True,
                      whatsapp_phone_number_id="CO-PHONE-ID", whatsapp_token="co-token",
                      whatsapp_template_quotation="", whatsapp_api_url=None)
    res, post = _send_with_globals(company)
    assert res["sent"] is True
    assert post.call_args.args[0] == "https://global.example.com/v19.0/CO-PHONE-ID/messages"
    assert post.call_args.kwargs["headers"]["Authorization"] == "Bearer co-token"
    assert post.call_args.kwargs["json"]["template"]["name"] == "global_tpl"


def test_neither_credential_set_uses_global_config_entirely():
    # Company template/URL are ignored without company credentials: global config as a whole
    company = Company(name="Essar", whatsapp_enabled=True,
                      whatsapp_phone_number_id="", whatsapp_token=None,
                      whatsapp_template_quotation="essar_tpl", whatsapp_api_url="https://co.example.com")
    res, post = _send_with_globals(company)
    assert res["sent"] is True
    assert post.call_args.args[0] == "https://global.example.com/v19.0/GLOBAL-PHONE-ID/messages"
    assert post.call_args.kwargs["headers"]["Authorization"] == "Bearer global-token"
    assert post.call_args.kwargs["json"]["template"]["name"] == "global_tpl"


@pytest.mark.parametrize("phone_id, token", [
    ("CO-PHONE-ID", None),        # phone number id only
    ("CO-PHONE-ID", "   "),       # phone number id, blank token
    (None, "co-secret-token-777"),  # token only
    ("", "co-secret-token-777"),    # blank phone number id, token
])
def test_partial_credentials_do_not_send_and_do_not_log_token(caplog, phone_id, token):
    company = Company(name="Excel Traders", whatsapp_enabled=True,
                      whatsapp_phone_number_id=phone_id, whatsapp_token=token)
    with caplog.at_level("WARNING", logger="app.services.whatsapp_service"):
        res, post = _send_with_globals(company)
    assert res == {"sent": False,
                   "reason": "WhatsApp config incomplete for Excel Traders — set both Phone Number ID and Token"}
    post.assert_not_called()
    warnings = [r for r in caplog.records if r.levelname == "WARNING"]
    assert warnings, "a warning is logged"
    assert "co-secret-token-777" not in caplog.text
    assert "global-token" not in caplog.text


@pytest.mark.parametrize("phone_id", [None, "", "  ", "CO-PHONE-ID"])
@pytest.mark.parametrize("token", [None, "", "  ", "co-token"])
def test_no_combination_mixes_company_and_global_credentials(phone_id, token):
    company = Company(name="Mix Check", whatsapp_enabled=True,
                      whatsapp_phone_number_id=phone_id, whatsapp_token=token)
    res, post = _send_with_globals(company)
    if not post.called:
        assert res["sent"] is False
        return
    used_phone = post.call_args.args[0].rsplit("/", 2)[-2]
    used_token = post.call_args.kwargs["headers"]["Authorization"].removeprefix("Bearer ")
    pair = (used_phone, used_token)
    assert pair in {("CO-PHONE-ID", "co-token"), ("GLOBAL-PHONE-ID", "global-token")}, pair
