from sqlalchemy.orm import Session
from typing import Type, Any, Optional


def get_next_code(
    db: Session,
    model: Type,
    code_field: str,
    prefix: str,
    company_id: Optional[int] = None,
) -> str:
    """Generate next auto-code like CUST0001, QT0001 etc.

    When company_id is supplied (and the model has a company_id column) the
    sequence is scoped per-company so that two companies can independently
    have QT0001, SO0001, etc.
    """
    from sqlalchemy import func

    q = db.query(model)

    # Scope to company if possible
    if company_id is not None and hasattr(model, "company_id"):
        q = q.filter(model.company_id == company_id)

    last = q.order_by(getattr(model, "id").desc()).first()
    next_id = (last.id + 1) if last else 1
    return f"{prefix}{str(next_id).zfill(4)}"


def apply_company_filter(query, model, active_company_id: Optional[int]):
    """Scope a query to active_company_id.

    Unlike the old implementation this no longer grants superadmin a free pass:
    whatever company is currently active in the token is what gets filtered.
    If active_company_id is None (no company context) the query is returned
    unfiltered — this should only happen for the Companies list itself.
    """
    if active_company_id is not None and hasattr(model, "company_id"):
        query = query.filter(model.company_id == active_company_id)
    return query


def serialize_row(obj):
    """ORM row → plain dict with extra_data (JSON) merged flat into the top
    level. Real columns always win over extra_data keys on collision, so a
    stale stashed value can never shadow a real column added later."""
    if not hasattr(obj, '__table__'):
        return obj
    cols = {c.key: getattr(obj, c.key) for c in obj.__table__.columns}
    extra = cols.pop('extra_data', None)
    if isinstance(extra, dict) and extra:
        return {**extra, **cols}
    return cols


def stash_extra_fields(model, payload):
    """Split payload by the model's real columns. Unknown keys are stashed
    into the extra_data JSON column when the model has one; models without
    extra_data keep the old silent-strip behavior."""
    valid = {c.key for c in model.__table__.columns}
    known   = {k: v for k, v in payload.items() if k in valid}
    unknown = {k: v for k, v in payload.items() if k not in valid}
    if unknown and 'extra_data' in valid:
        base = known.get('extra_data')
        base = dict(base) if isinstance(base, dict) else {}
        base.update(unknown)
        known['extra_data'] = base
    return known


def paginate(query, page: int = 1, page_size: int = 20):
    """Apply pagination to any query."""
    total = query.count()
    items = [serialize_row(o) for o in
             query.offset((page-1)*page_size).limit(page_size).all()]
    return {
        "items":     items,
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     max(1, -(-total // page_size)),
    }
