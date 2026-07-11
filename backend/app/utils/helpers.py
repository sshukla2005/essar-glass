from sqlalchemy.orm import Session
from typing import Type, Any

def get_next_code(db: Session, model: Type,
                  code_field: str, prefix: str) -> str:
    """Generate next auto-code like CUST0001, QT0001 etc."""
    from sqlalchemy import func
    last = db.query(model).order_by(
        getattr(model, "id").desc()
    ).first()
    next_id = (last.id + 1) if last else 1
    return f"{prefix}{str(next_id).zfill(4)}"

def apply_company_filter(query, model, user):
    """Auto-filter by company unless superadmin."""
    if user.role != "superadmin" and user.company_id:
        query = query.filter(
            model.company_id == user.company_id
        )
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
