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


def _filled(value) -> bool:
    return bool(value and str(value).strip())


def resolve_whatsapp_config(company=None) -> dict:
    """WhatsApp sending config for a company, all-or-nothing on credentials.

    - Company has BOTH phone number id and token: use the company's credentials;
      its template and API URL fall back to the global ones when blank.
    - Company has NEITHER: use the global WHATSAPP_* settings entirely.
    - Company has exactly ONE: misconfigured. Returns an "error" and no credentials,
      so a company credential is never mixed with a global one.
    No company (or no company row): global settings, sending enabled.
    """
    global_config = {
        "api_url": settings.WHATSAPP_API_URL,
        "phone_number_id": settings.WHATSAPP_PHONE_NUMBER_ID,
        "token": settings.WHATSAPP_TOKEN,
        "template": settings.WHATSAPP_TEMPLATE_QUOTATION,
    }
    if company is None:
        return {"enabled": True, "source": "global", **global_config}

    enabled = bool(getattr(company, "whatsapp_enabled", False))
    has_phone = _filled(getattr(company, "whatsapp_phone_number_id", None))
    has_token = _filled(getattr(company, "whatsapp_token", None))

    if has_phone and has_token:
        api_url = getattr(company, "whatsapp_api_url", None)
        template = getattr(company, "whatsapp_template_quotation", None)
        return {
            "enabled": enabled,
            "source": "company",
            "api_url": api_url if _filled(api_url) else global_config["api_url"],
            "phone_number_id": company.whatsapp_phone_number_id,
            "token": company.whatsapp_token,
            "template": template if _filled(template) else global_config["template"],
        }
    if not has_phone and not has_token:
        return {"enabled": enabled, "source": "global", **global_config}

    name = getattr(company, "name", None) or f"company {getattr(company, 'id', '?')}"
    return {
        "enabled": enabled,
        "source": "incomplete",
        "has_phone_number_id": has_phone,
        "has_token": has_token,
        "error": f"WhatsApp config incomplete for {name} — set both Phone Number ID and Token",
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
    if config.get("error"):
        # Never log the token itself, only which of the two fields is filled
        logger.warning(
            "WhatsApp not sent for quotation %s: %s (phone_number_id set: %s, token set: %s)",
            quote_number, config["error"], config["has_phone_number_id"], config["has_token"],
        )
        return {"sent": False, "reason": config["error"]}

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
