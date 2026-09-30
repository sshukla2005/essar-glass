"""HS code resolution for glass products and lines. Every caller goes through
resolve_hs_code, so the order below is the only rule:

  1. the product's own hsn_code, if non-empty
  2. mapping for (company, type, category)
  3. mapping for (company, type, any category)
  4. mapping for (all companies, type, category)
  5. mapping for (all companies, type, any category)
  6. DEFAULT_HS_CODE

glass_type and glass_category are free text, so they are compared trimmed and
lowercased on both sides.
"""
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.hsn_mapping import HsnMapping

DEFAULT_HS_CODE = "70051090"


def normalize(value: Optional[str]) -> Optional[str]:
    """Trimmed, lowercased text; None for missing or blank."""
    if value is None:
        return None
    value = str(value).strip().lower()
    return value or None


def resolve_hs_code(
    db: Session,
    *,
    company_id: Optional[int],
    glass_type: Optional[str],
    glass_category: Optional[str] = None,
    product_hsn_code: Optional[str] = None,
) -> str:
    own = (product_hsn_code or "").strip()
    if own:
        return own

    gtype = normalize(glass_type)
    if gtype is None:
        return DEFAULT_HS_CODE
    gcat = normalize(glass_category)

    rows = (
        db.query(HsnMapping)
        .filter(
            HsnMapping.is_active == True,
            func.lower(func.trim(HsnMapping.glass_type)) == gtype,
            or_(HsnMapping.company_id == company_id, HsnMapping.company_id.is_(None))
            if company_id is not None else HsnMapping.company_id.is_(None),
        )
        .all()
    )

    def pick(company, category):
        for r in rows:
            if r.company_id == company and normalize(r.glass_category) == category:
                return r.hs_code
        return None

    candidates = []
    if company_id is not None:
        if gcat is not None:
            candidates.append((company_id, gcat))
        candidates.append((company_id, None))
    if gcat is not None:
        candidates.append((None, gcat))
    candidates.append((None, None))

    for company, category in candidates:
        code = pick(company, category)
        if code:
            return code
    return DEFAULT_HS_CODE


def resolve_product_hs_code(db: Session, product, company_id: Optional[int] = None) -> str:
    """resolve_hs_code for a Product row (its own hsn_code wins)."""
    return resolve_hs_code(
        db,
        company_id=company_id if company_id is not None else product.company_id,
        glass_type=product.glass_type,
        glass_category=product.glass_category,
        product_hsn_code=product.hsn_code,
    )
