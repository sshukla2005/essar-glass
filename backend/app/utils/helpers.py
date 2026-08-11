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

    LOCKING REQUIREMENT (GST Compliance):
    Do NOT filter on is_active == True here. All rows (including soft-deleted
    ones) must be scanned so that document numbers (e.g. INV0042) are never
    reissued after soft deletion.
    """
    from sqlalchemy import func

    q = db.query(model)

    # Scope to company if possible
    if company_id is not None and hasattr(model, "company_id"):
        q = q.filter(model.company_id == company_id)

    # Derive the next number from THIS company's existing codes, never from the
    # global primary key — the PK is shared across companies and makes numbers
    # jump (Company B's 2nd doc became QT0007 instead of QT0002).
    col = getattr(model, code_field)
    rows = q.with_entities(col).filter(col.isnot(None)).all()

    max_n = 0
    for (code,) in rows:
        code_str = str(code or "").strip()
        if not code_str.upper().startswith(prefix.upper()):
            continue
        digits = "".join(ch for ch in code_str[len(prefix):] if ch.isdigit())
        if digits:
            try:
                max_n = max(max_n, int(digits))
            except ValueError:
                pass

    return f"{prefix}{str(max_n + 1).zfill(4)}"


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


def apply_scope_filter(query, model, user, module: Optional[str] = None):
    """Scope a query based on user's data_scope and per-module overrides.

    - superadmin and admin roles bypass scoping completely.
    - Master data models (no created_by / assigned_to_user_id) are never scoped.
    - When effective scope is 'own', filters to records created by OR assigned to user,
      or legacy records where created_by IS NULL (Option A decision).
    """
    # 1. Admin / superadmin bypass
    if not user:
        return query
    if getattr(user, "role", None) in ("superadmin", "admin"):
        return query

    # 2. Master data bypass
    if not (hasattr(model, "created_by") or hasattr(model, "assigned_to_user_id")):
        return query

    # 3. Resolve effective scope for module
    eff_scope = None
    module_scopes = getattr(user, "module_scopes", None)
    if isinstance(module_scopes, dict) and module:
        if module in module_scopes:
            eff_scope = module_scopes[module]
        elif module in ("crm_leads", "leads") and "crm" in module_scopes:
            eff_scope = module_scopes["crm"]
        elif module in ("sales_orders", "quotations", "invoices") and "sales" in module_scopes:
            eff_scope = module_scopes["sales"]
        elif module in ("purchase_orders",) and "purchase" in module_scopes:
            eff_scope = module_scopes["purchase"]
        elif module in ("stock_movements", "delivery_challans", "stock") and "inventory" in module_scopes:
            eff_scope = module_scopes["inventory"]
        elif module in ("workshop_orders", "toughening") and "workshop" in module_scopes:
            eff_scope = module_scopes["workshop"]
        elif module in ("sales_performance", "reports") and "reports" in module_scopes:
            eff_scope = module_scopes["reports"]

    if not eff_scope:
        eff_scope = getattr(user, "data_scope", "company") or "company"

    # 4. Apply filter if own
    if eff_scope == "own":
        from sqlalchemy import or_
        filters = []
        if hasattr(model, "created_by"):
            filters.append(model.created_by == user.id)
            filters.append(model.created_by == None)  # Option A: legacy NULL visible to all
        if hasattr(model, "assigned_to_user_id"):
            filters.append(model.assigned_to_user_id == user.id)

        if filters:
            query = query.filter(or_(*filters))

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


def serialize_item(obj):
    """Serialize either a model instance or a SQLAlchemy result Row (joined query tuple)."""
    if hasattr(obj, '__table__'):
        return serialize_row(obj)
    if hasattr(obj, '_mapping'):
        main_obj = obj[0]
        data = serialize_row(main_obj)
        for k, v in obj._mapping.items():
            if k != main_obj.__class__.__name__:
                # Only set if key does not exist or if v is not None
                if k not in data or v is not None:
                    data[k] = v
        return data
    return serialize_row(obj)


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


def paginate(query, page: int = 1, page_size: int = 20, counts: Optional[dict] = None):
    """Apply pagination to any query."""
    total = query.count()
    items = [serialize_item(o) for o in
             query.offset((page-1)*page_size).limit(page_size).all()]
    res = {
        "items":     items,
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     max(1, -(-total // page_size)),
    }
    if counts is not None:
        res["counts"] = counts
    return res

