import base64
import io
import json
import logging
import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from app.config import settings
from app.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["AI"])

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

EXTRACT_PROMPT = """You are reading a handwritten glass cutting list from an Indian glass fabrication workshop.

Return ONLY valid JSON. No markdown fences, no commentary.

Schema:
{
  "sheet_date": "DD/MM/YY or null",
  "unit": "mm" | "inch",
  "groups": [
    {
      "label": "exact heading as written",
      "stated_total": <number or null>,
      "rows": [
        {"width": <num>, "height": <num>, "qty": <num>,
         "confidence": "high" | "low", "note": "reason if low, else null"}
      ]
    }
  ]
}

Rules:
- Each row reads WIDTH x HEIGHT = QTY.
- Transcribe EVERY row in written order. If the SAME width x height pair appears more than once, emit BOTH rows separately. NEVER merge, sum, or deduplicate them. Duplicate pairs are common and intentional.
- "stated_total" is the handwritten group total (e.g. a line reading "= 374"). Use null if none is written.
- Indian handwriting frequently renders 3 like 8, 1 like 7, 5 like 6, and 0 like 6. If a digit is overwritten, smudged, or ambiguous, set "confidence":"low" and explain in "note".
- Values in the 100-2500 range with no inch marks or fractions are millimetres. Set "unit":"mm".
- A heading such as "D.H. Shutter Glass" or "D4 Fix Glass" is an ITEM LABEL, not a glass specification. Do NOT invent thickness, glass type, or toughening. There is no field for these.
- Do NOT compute totals, correct arithmetic, or reconcile anything. Transcribe exactly what is written."""


def _downscale(raw: bytes, media_type: str):
    """Best-effort downscale. Returns (bytes, media_type). No-op if Pillow missing."""
    try:
        from PIL import Image
    except ImportError:
        logger.warning("Pillow not installed; sending original image")
        return raw, media_type
    try:
        img = Image.open(io.BytesIO(raw))
        if getattr(img, "mode", "") != "RGB":
            img = img.convert("RGB")
        if max(img.size) > 2000:
            ratio = 2000 / max(img.size)
            img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=88)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        logger.warning("Downscale failed; sending original", exc_info=True)
        return raw, media_type


@router.post("/extract-cutting-list")
async def extract_cutting_list(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    api_key = (settings.ANTHROPIC_API_KEY or "").strip()
    if not api_key:
        raise HTTPException(503, "AI extraction is not configured on this server.")

    ctype = (file.content_type or "").lower()
    if ctype not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type '{ctype}'. Use JPEG, PNG or WebP.")

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file.")
    if len(raw) > MAX_IMAGE_BYTES * 4:
        raise HTTPException(413, "Image too large. Keep it under 20 MB.")

    raw, media_type = _downscale(raw, ctype)
    if media_type == "image/jpg":
        media_type = "image/jpeg"
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image still too large after downscaling. Retake at lower resolution.")

    payload = {
        "model": settings.ANTHROPIC_MODEL or "claude-sonnet-4-5",
        "max_tokens": 8000,
        "system": EXTRACT_PROMPT,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image", "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": base64.b64encode(raw).decode(),
                }},
                {"type": "text", "text": "Transcribe this cutting list."},
            ],
        }],
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(ANTHROPIC_URL, json=payload, headers={
                "content-type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            })
    except httpx.RequestError as exc:
        logger.error("Anthropic request failed: %s", exc)
        raise HTTPException(502, "Could not reach the AI service.")

    if r.status_code != 200:
        logger.error("Anthropic %s: %s", r.status_code, r.text[:500])
        raise HTTPException(502, f"AI service returned {r.status_code}.")

    body = r.json()
    text = "".join(b.get("text", "") for b in body.get("content", []) if b.get("type") == "text")
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.error("Unparseable model output: %s", text[:800])
        raise HTTPException(422, "Could not read that sheet. Try a sharper, straighter, well-lit photo.")

    if not isinstance(data, dict) or not isinstance(data.get("groups"), list):
        raise HTTPException(422, "Extraction returned an unexpected shape.")

    # Server-side checksum. FLAG ONLY — never auto-correct.
    warnings = []
    for g in data.get("groups", []):
        rows = g.get("rows") or []
        computed = 0
        for row in rows:
            try:
                computed += int(float(row.get("qty") or 0))
            except (TypeError, ValueError):
                pass
        g["computed_total"] = computed
        stated = g.get("stated_total")
        try:
            stated_int = int(float(stated)) if stated is not None else None
        except (TypeError, ValueError):
            stated_int = None
        g["checksum_ok"] = (stated_int is None) or (stated_int == computed)
        if stated_int is not None and stated_int != computed:
            warnings.append(
                f"\"{g.get('label')}\": sheet total is {stated_int} but rows add to {computed}."
            )
        low = [x for x in rows if x.get("confidence") == "low"]
        if low:
            warnings.append(f"\"{g.get('label')}\": {len(low)} row(s) flagged for checking.")

    data["warnings"] = warnings
    logger.info(
        "Cutting list extracted by user=%s company=%s groups=%s rows=%s warnings=%s",
        getattr(user, "username", "?"),
        getattr(user, "active_company_id", "?"),
        len(data.get("groups", [])),
        sum(len(g.get("rows") or []) for g in data.get("groups", [])),
        len(warnings),
    )
    return data
