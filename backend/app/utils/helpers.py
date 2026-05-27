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

def paginate(query, page: int = 1, page_size: int = 20):
    """Apply pagination to any query."""
    total = query.count()
    items = query.offset((page-1)*page_size).limit(page_size).all()
    return {
        "items":     items,
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     max(1, -(-total // page_size)),
    }
