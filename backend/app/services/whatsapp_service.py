import re
import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


def normalize_phone_number(to_number: str | int | None) -> tuple[bool, str]:
    """Normalise phone number:
    - Strip non-digits
    - If 10 digits, prefix '91'
    - If 12 digits starting with '91', leave unchanged
    - Anything else is invalid
    """
    digits = re.sub(r"\D", "", str(to_number or ""))
    if len(digits) == 10:
        return True, f"91{digits}"
    elif len(digits) == 12 and digits.startswith("91"):
        return True, digits
    else:
        return False, digits


def resolve_whatsapp_config(company=None) -> dict:
    """WhatsApp sending config for a company.

    Each value is the company's own when it is filled in, otherwise the global
    WHATSAPP_* setting from .env. With no company (or no company row), everything
    comes from the global settings and sending is enabled.
    """
    def pick(field: str, global_value):
        value = getattr(company, field, None) if company is not None else None
        return value if (value and str(value).strip()) else global_value

    return {
        "enabled": True if company is None else bool(getattr(company, "whatsapp_enabled", False)),
        "api_url": pick("whatsapp_api_url", settings.WHATSAPP_API_URL),
        "phone_number_id": pick("whatsapp_phone_number_id", settings.WHATSAPP_PHONE_NUMBER_ID),
        "token": pick("whatsapp_token", settings.WHATSAPP_TOKEN),
        "template": pick("whatsapp_template_quotation", settings.WHATSAPP_TEMPLATE_QUOTATION),
    }


def send_quotation_confirmed(
    to_number,
    document_url,
    customer_name,
    quote_number,
    quote_date,
    total_amount,
    company_name,
    company=None,
) -> dict:
    """Send WhatsApp quotation confirmation template with document header.

    Provider: 1automations, Meta Cloud API compatible.
    Endpoint: POST {api_url}/{phone_number_id}/messages, with config resolved per
    company (see resolve_whatsapp_config). Never raises for configuration problems.
    """
    config = resolve_whatsapp_config(company)
    if not config["enabled"]:
        return {"sent": False, "reason": "WhatsApp disabled for this company"}

    token = config["token"]
    phone_number_id = config["phone_number_id"]

    if not token or not phone_number_id:
        missing = []
        if not token:
            missing.append("WHATSAPP_TOKEN")
        if not phone_number_id:
            missing.append("WHATSAPP_PHONE_NUMBER_ID")
        return {"sent": False, "reason": f"{', '.join(missing)} not configured"}

    valid, normalized_number = normalize_phone_number(to_number)
    if not valid:
        return {"sent": False, "reason": "invalid number"}

    api_base = str(config["api_url"]).rstrip("/")
    url = f"{api_base}/{phone_number_id}/messages"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": normalized_number,
        "type": "template",
        "template": {
            "name": config["template"],
            "language": {
                "code": "en",
                "policy": "deterministic",
            },
            "components": [
                {
                    "type": "header",
                    "parameters": [
                        {
                            "type": "document",
                            "document": {
                                "link": document_url,
                            },
                        }
                    ],
                },
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": str(customer_name or "")},
                        {"type": "text", "text": str(quote_number or "")},
                        {"type": "text", "text": str(quote_date or "")},
                        {"type": "text", "text": str(total_amount or "")},
                        {"type": "text", "text": str(company_name or "")},
                    ],
                },
            ],
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                try:
                    data = response.json()
                except Exception:
                    data = {"text": response.text}
                return {"sent": True, "response": data}
            else:
                logger.error(
                    "WhatsApp API error for recipient %s: status %s, body: %s",
                    normalized_number,
                    response.status_code,
                    response.text,
                )
                return {
                    "sent": False,
                    "reason": f"WhatsApp API error {response.status_code}: {response.text}",
                }
    except Exception as exc:
        logger.error(
            "WhatsApp API request failed for recipient %s: %s",
            normalized_number,
            str(exc),
        )
        return {"sent": False, "reason": str(exc)}
