"""
Sales Performance Report Router.

GET /api/v1/reports/sales-performance
GET /api/v1/reports/sales-performance/history
GET /api/v1/reports/sales-performance/export

Fully scoped to the active company via apply_company_filter.
Pipeline: Lead -> Quotation -> Sales Order -> Invoice -> Payment
"""
import math
import re
from datetime import date, datetime, time, timedelta
from collections import Counter
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import func, case, distinct, or_, cast, String
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.crm import CRMLead
from app.models.quotation import Quotation
from app.models.sales_order import SalesOrder
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.employee import Employee
from app.models.customer import Customer
from app.utils.helpers import apply_company_filter, apply_scope_filter

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])

_UNASSIGNED = "Unassigned"


def _clean_str(val: Optional[str]) -> str:
    if not val:
        return ""
    return re.sub(r"\s+", " ", str(val).strip())


def _normalize_sp(val: Optional[str]) -> str:
    c = _clean_str(val)
    return c.lower() if c else "unassigned"


def _get_fy_dates(today: date) -> tuple[date, date, str]:
    if today.month >= 4:
        start_year = today.year
    else:
        start_year = today.year - 1
    end_year = start_year + 1
    start_date = date(start_year, 4, 1)
    end_date = date(end_year, 3, 31)
    label = f"FY {start_year}-{str(end_year)[2:]}"
    return start_date, end_date, label


def _parse_dates(from_str: Optional[str], to_str: Optional[str]) -> tuple[date, date, str]:
    today = date.today()
    default_from, default_to, default_label = _get_fy_dates(today)

    if not from_str and not to_str:
        return default_from, default_to, default_label

    try:
        f_date = date.fromisoformat(from_str) if from_str else default_from
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 'from' date format. Expected YYYY-MM-DD"
        )

    try:
        t_date = date.fromisoformat(to_str) if to_str else default_to
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 'to' date format. Expected YYYY-MM-DD"
        )

    if f_date > t_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'from' date cannot be after 'to' date"
        )

    label = f"{f_date.strftime('%d/%m/%Y')} - {t_date.strftime('%d/%m/%Y')}"
    return f_date, t_date, label


def _calc_summary(
    f_date: date,
    t_date: date,
    cid: Optional[int],
    db: Session,
    user=None,
) -> Dict[str, Any]:
    f_str = f_date.isoformat()
    t_str = t_date.isoformat()
    start_dt = datetime.combine(f_date, time.min)
    end_dt = datetime.combine(t_date, time.max)

    # 1. CRM Leads created in period
    leads_q = apply_scope_filter(
        apply_company_filter(
            db.query(CRMLead).filter(
                CRMLead.is_active == True,
                CRMLead.created_at >= start_dt,
                CRMLead.created_at <= end_dt
            ),
            CRMLead, cid
        ),
        CRMLead, user, "crm_leads"
    )
    leads_created = leads_q.count()
    expected_rev_sum = float(leads_q.with_entities(func.sum(CRMLead.expected_revenue)).scalar() or 0.0)

    # 2. Quotations in period
    q_date_expr = cast(
        func.coalesce(
            func.nullif(Quotation.quote_date, ''),
            func.to_char(Quotation.created_at, 'YYYY-MM-DD')
        ),
        String
    )
    q_sp_expr = func.coalesce(func.nullif(Quotation.salesperson, ''), func.nullif(CRMLead.salesperson, ''))

    quotes_q = apply_scope_filter(
        apply_company_filter(
            db.query(Quotation).filter(Quotation.is_active == True, Quotation.status != 'cancelled'),
            Quotation, cid
        ),
        Quotation, user, "quotations"
    ).outerjoin(CRMLead, Quotation.crm_lead_id == CRMLead.id).filter(q_date_expr >= f_str, q_date_expr <= t_str)

    quotes_created = quotes_q.count()
    quotes_value = round(float(quotes_q.with_entities(func.sum(Quotation.total_amount)).scalar() or 0.0), 2)

    # Won Quotes (status = 'converted')
    quotes_won_q = quotes_q.filter(Quotation.status == 'converted')
    quotes_won = quotes_won_q.count()
    quotes_won_value = round(float(quotes_won_q.with_entities(func.sum(Quotation.total_amount)).scalar() or 0.0), 2)

    # Leads with at least 1 quotation created
    leads_with_q = (
        leads_q
        .join(Quotation, Quotation.crm_lead_id == CRMLead.id)
        .filter(Quotation.is_active == True, Quotation.status != 'cancelled')
        .with_entities(func.count(distinct(CRMLead.id)))
        .scalar() or 0
    )

    # 3. Sales Orders in period
    so_date_expr = cast(
        func.coalesce(
            func.nullif(SalesOrder.order_date, ''),
            func.to_char(SalesOrder.created_at, 'YYYY-MM-DD')
        ),
        String
    )
    so_sp_expr = func.coalesce(
        func.nullif(SalesOrder.salesperson, ''),
        func.nullif(Quotation.salesperson, ''),
        func.nullif(CRMLead.salesperson, '')
    )

    sos_q = apply_scope_filter(
        apply_company_filter(
            db.query(SalesOrder).filter(SalesOrder.is_active == True, SalesOrder.status != 'cancelled'),
            SalesOrder, cid
        ),
        SalesOrder, user, "sales_orders"
    ).outerjoin(Quotation, SalesOrder.quotation_id == Quotation.id).outerjoin(CRMLead, func.coalesce(SalesOrder.crm_lead_id, Quotation.crm_lead_id) == CRMLead.id).filter(so_date_expr >= f_str, so_date_expr <= t_str)

    so_count = sos_q.count()
    so_value = round(float(sos_q.with_entities(func.sum(SalesOrder.total_amount)).scalar() or 0.0), 2)

    # 4. Invoices in period
    inv_date_expr = cast(
        func.coalesce(
            func.nullif(Invoice.invoice_date, ''),
            func.to_char(Invoice.created_at, 'YYYY-MM-DD')
        ),
        String
    )
    invs_q = apply_scope_filter(
        apply_company_filter(
            db.query(Invoice).filter(Invoice.is_active == True, Invoice.status != 'cancelled'),
            Invoice, cid
        ),
        Invoice, user, "invoices"
    ).filter(inv_date_expr >= f_str, inv_date_expr <= t_str)

    invoiced_count = invs_q.count()
    invoiced_value = round(float(invs_q.with_entities(func.sum(Invoice.total_amount)).scalar() or 0.0), 2)

    # 5. Payments in period
    pay_date_expr = cast(
        func.coalesce(
            func.nullif(Payment.payment_date, ''),
            func.to_char(Payment.created_at, 'YYYY-MM-DD')
        ),
        String
    )
    pays_q = apply_scope_filter(
        apply_company_filter(
            db.query(Payment).filter(Payment.is_active == True),
            Payment, cid
        ),
        Payment, user, "payment_accounts"
    ).filter(pay_date_expr >= f_str, pay_date_expr <= t_str)
    collected_count = pays_q.count()
    collected_value = round(float(pays_q.with_entities(func.sum(Payment.amount)).scalar() or 0.0), 2)

    # 6. Avg days to convert (Quotation created_at -> SalesOrder created_at)
    avg_days_sql = (
        sos_q.filter(
            SalesOrder.quotation_id.isnot(None),
            SalesOrder.created_at >= Quotation.created_at
        )
        .with_entities(
            func.avg(func.extract('epoch', SalesOrder.created_at - Quotation.created_at) / 86400.0)
        )
        .scalar()
    )
    avg_days_to_convert = round(float(avg_days_sql), 1) if avg_days_sql is not None else None

    # Computed Ratios (return null when denominator is zero)
    win_rate_count = round((quotes_won / quotes_created * 100.0), 1) if quotes_created > 0 else None
    win_rate_value = round((quotes_won_value / quotes_value * 100.0), 1) if quotes_value > 0 else None
    lead_conversion_rate = round((leads_with_q / leads_created * 100.0), 1) if leads_created > 0 else None
    avg_deal_size = round((so_value / so_count), 2) if so_count > 0 else None

    return {
        "leads_created": leads_created,
        "quotes_created": quotes_created,
        "quotes_value": quotes_value,
        "quotes_won": quotes_won,
        "quotes_won_value": quotes_won_value,
        "win_rate_count": win_rate_count,
        "win_rate_value": win_rate_value,
        "lead_conversion_rate": lead_conversion_rate,
        "so_count": so_count,
        "so_value": so_value,
        "invoiced_count": invoiced_count,
        "invoiced_value": invoiced_value,
        "collected_count": collected_count,
        "collected_value": collected_value,
        "avg_deal_size": avg_deal_size,
        "avg_days_to_convert": avg_days_to_convert,
        "expected_rev_sum": round(expected_rev_sum, 2)
    }


@router.get("/sales-performance")
def sales_performance(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date:   Optional[str] = Query(None, alias="to"),
    db:   Session = Depends(get_db),
    user = Depends(get_current_user),
):
    cid = getattr(user, "active_company_id", None)
    f_date, t_date, period_label = _parse_dates(from_date, to_date)
    f_str = f_date.isoformat()
    t_str = t_date.isoformat()
    start_dt = datetime.combine(f_date, time.min)
    end_dt = datetime.combine(t_date, time.max)

    # Summary for current period
    summary = _calc_summary(f_date, t_date, cid, db, user)

    # Previous period calculation for deltas
    duration_days = (t_date - f_date).days + 1
    prev_to = f_date - timedelta(days=1)
    prev_from = prev_to - timedelta(days=duration_days - 1)
    previous = _calc_summary(prev_from, prev_to, cid, db, user)

    # ── Per-Salesperson Aggregation ──────────────────────────────────────────
    # Dictionary structure keyed by normalized salesperson name
    sp_raw_casing: Dict[str, Counter] = {}
    sp_map: Dict[str, Dict[str, Any]] = {}

    def _init_sp(sp_raw: Optional[str]) -> str:
        clean = _clean_str(sp_raw)
        norm = _normalize_sp(sp_raw)
        display = clean if clean else _UNASSIGNED
        if norm not in sp_raw_casing:
            sp_raw_casing[norm] = Counter()
        sp_raw_casing[norm][display] += 1

        if norm not in sp_map:
            sp_map[norm] = {
                "norm_key": norm,
                "leads_created": 0,
                "leads_with_q": 0,
                "quotes_created": 0,
                "quotes_value": 0.0,
                "quotes_won": 0,
                "quotes_won_value": 0.0,
                "so_count": 0,
                "so_value": 0.0,
                "invoiced_value": 0.0,
                "collected_value": 0.0,
                "avg_days_to_convert": None
            }
        return norm

    # 1. Leads per salesperson
    lead_rows = (
        apply_company_filter(
            db.query(CRMLead).filter(
                CRMLead.is_active == True,
                CRMLead.created_at >= start_dt,
                CRMLead.created_at <= end_dt
            ),
            CRMLead, cid
        )
        .with_entities(CRMLead.salesperson, func.count(CRMLead.id).label("cnt"))
        .group_by(CRMLead.salesperson)
        .all()
    )
    for row in lead_rows:
        n = _init_sp(row.salesperson)
        sp_map[n]["leads_created"] += row.cnt

    # 2. Quotations per salesperson
    q_date_expr = cast(
        func.coalesce(
            func.nullif(Quotation.quote_date, ''),
            func.to_char(Quotation.created_at, 'YYYY-MM-DD')
        ),
        String
    )
    q_sp_expr = func.coalesce(func.nullif(Quotation.salesperson, ''), func.nullif(CRMLead.salesperson, ''))

    quotes_q = (
        apply_company_filter(
            db.query(Quotation).filter(Quotation.is_active == True, Quotation.status != 'cancelled'),
            Quotation, cid
        )
        .outerjoin(CRMLead, Quotation.crm_lead_id == CRMLead.id)
        .filter(q_date_expr >= f_str, q_date_expr <= t_str)
    )

    quote_rows = (
        quotes_q
        .with_entities(
            q_sp_expr.label("sp"),
            func.count(Quotation.id).label("cnt"),
            func.sum(Quotation.total_amount).label("amt"),
            func.count(case((Quotation.status == 'converted', Quotation.id))).label("won_cnt"),
            func.sum(case((Quotation.status == 'converted', Quotation.total_amount), else_=0.0)).label("won_amt"),
        )
        .group_by(q_sp_expr)
        .all()
    )
    for row in quote_rows:
        n = _init_sp(row.sp)
        sp_map[n]["quotes_created"] += row.cnt
        sp_map[n]["quotes_value"] += float(row.amt or 0.0)
        sp_map[n]["quotes_won"] += row.won_cnt
        sp_map[n]["quotes_won_value"] += float(row.won_amt or 0.0)

    # Leads with quotation per salesperson
    leads_q_rows = (
        apply_company_filter(
            db.query(CRMLead).filter(
                CRMLead.is_active == True,
                CRMLead.created_at >= start_dt,
                CRMLead.created_at <= end_dt
            ),
            CRMLead, cid
        )
        .join(Quotation, Quotation.crm_lead_id == CRMLead.id)
        .filter(Quotation.is_active == True, Quotation.status != 'cancelled')
        .with_entities(CRMLead.salesperson, func.count(distinct(CRMLead.id)).label("cnt"))
        .group_by(CRMLead.salesperson)
        .all()
    )
    for row in leads_q_rows:
        n = _init_sp(row.salesperson)
        sp_map[n]["leads_with_q"] += row.cnt

    # 3. Sales Orders per salesperson
    so_date_expr = cast(
        func.coalesce(
            func.nullif(SalesOrder.order_date, ''),
            func.to_char(SalesOrder.created_at, 'YYYY-MM-DD')
        ),
        String
    )
    so_sp_expr = func.coalesce(
        func.nullif(SalesOrder.salesperson, ''),
        func.nullif(Quotation.salesperson, ''),
        func.nullif(CRMLead.salesperson, '')
    )

    sos_q = (
        apply_company_filter(
            db.query(SalesOrder).filter(SalesOrder.is_active == True, SalesOrder.status != 'cancelled'),
            SalesOrder, cid
        )
        .outerjoin(Quotation, SalesOrder.quotation_id == Quotation.id)
        .outerjoin(CRMLead, func.coalesce(SalesOrder.crm_lead_id, Quotation.crm_lead_id) == CRMLead.id)
        .filter(so_date_expr >= f_str, so_date_expr <= t_str)
    )

    so_rows = (
        sos_q
        .with_entities(
            so_sp_expr.label("sp"),
            func.count(SalesOrder.id).label("cnt"),
            func.sum(SalesOrder.total_amount).label("amt")
        )
        .group_by(so_sp_expr)
        .all()
    )
    for row in so_rows:
        n = _init_sp(row.sp)
        sp_map[n]["so_count"] += row.cnt
        sp_map[n]["so_value"] += float(row.amt or 0.0)

    # 4. Invoices per salesperson
    inv_date_expr = cast(
        func.coalesce(
            func.nullif(Invoice.invoice_date, ''),
            func.to_char(Invoice.created_at, 'YYYY-MM-DD')
        ),
        String
    )
    inv_sp_expr = func.coalesce(
        func.nullif(SalesOrder.salesperson, ''),
        func.nullif(Quotation.salesperson, ''),
        func.nullif(CRMLead.salesperson, '')
    )

    inv_rows = (
        apply_company_filter(
            db.query(Invoice).filter(Invoice.is_active == True, Invoice.status != 'cancelled'),
            Invoice, cid
        )
        .outerjoin(SalesOrder, Invoice.so_id == SalesOrder.id)
        .outerjoin(Quotation, SalesOrder.quotation_id == Quotation.id)
        .outerjoin(CRMLead, func.coalesce(SalesOrder.crm_lead_id, Quotation.crm_lead_id) == CRMLead.id)
        .filter(inv_date_expr >= f_str, inv_date_expr <= t_str)
        .with_entities(inv_sp_expr.label("sp"), func.sum(Invoice.total_amount).label("amt"))
        .group_by(inv_sp_expr)
        .all()
    )
    for row in inv_rows:
        n = _init_sp(row.sp)
        sp_map[n]["invoiced_value"] += float(row.amt or 0.0)

    # 5. Payments per salesperson
    pay_date_expr = cast(
        func.coalesce(
            func.nullif(Payment.payment_date, ''),
            func.to_char(Payment.created_at, 'YYYY-MM-DD')
        ),
        String
    )
    pay_sp_expr = func.coalesce(
        func.nullif(SalesOrder.salesperson, ''),
        func.nullif(Quotation.salesperson, ''),
        func.nullif(CRMLead.salesperson, '')
    )

    pay_rows = (
        apply_company_filter(
            db.query(Payment).filter(Payment.is_active == True),
            Payment, cid
        )
        .outerjoin(SalesOrder, Payment.so_id == SalesOrder.id)
        .outerjoin(Quotation, SalesOrder.quotation_id == Quotation.id)
        .outerjoin(CRMLead, func.coalesce(SalesOrder.crm_lead_id, Quotation.crm_lead_id) == CRMLead.id)
        .filter(pay_date_expr >= f_str, pay_date_expr <= t_str)
        .with_entities(pay_sp_expr.label("sp"), func.sum(Payment.amount).label("amt"))
        .group_by(pay_sp_expr)
        .all()
    )
    for row in pay_rows:
        n = _init_sp(row.sp)
        sp_map[n]["collected_value"] += float(row.amt or 0.0)

    # 6. Days to convert per salesperson (SQL func.avg)
    converted_so_rows = (
        sos_q.filter(
            SalesOrder.quotation_id.isnot(None),
            SalesOrder.created_at >= Quotation.created_at
        )
        .with_entities(
            so_sp_expr.label("sp"),
            func.avg(func.extract('epoch', SalesOrder.created_at - Quotation.created_at) / 86400.0).label("avg_days")
        )
        .group_by(so_sp_expr)
        .all()
    )
    for row in converted_so_rows:
        if row.avg_days is not None:
            n = _init_sp(row.sp)
            sp_map[n]["avg_days_to_convert"] = round(float(row.avg_days), 1)

    # Format salesperson list
    salespeople = []
    for norm, data_rec in sp_map.items():
        most_common_name = sp_raw_casing[norm].most_common(1)[0][0] if sp_raw_casing.get(norm) else _UNASSIGNED
        lc = data_rec["leads_created"]
        qc = data_rec["quotes_created"]
        qv = round(data_rec["quotes_value"], 2)
        qw = data_rec["quotes_won"]
        qwv = round(data_rec["quotes_won_value"], 2)
        soc = data_rec["so_count"]
        sov = round(data_rec["so_value"], 2)
        inv_v = round(data_rec["invoiced_value"], 2)
        col_v = round(data_rec["collected_value"], 2)

        salespeople.append({
            "salesperson": most_common_name,
            "leads_created": lc,
            "quotes_created": qc,
            "quotes_value": qv,
            "quotes_won": qw,
            "quotes_won_value": qwv,
            "win_rate_count": round(qw / qc * 100.0, 1) if qc > 0 else None,
            "win_rate_value": round(qwv / qv * 100.0, 1) if qv > 0 else None,
            "so_count": soc,
            "so_value": sov,
            "invoiced_value": inv_v,
            "collected_value": col_v,
            "avg_deal_size": round(sov / soc, 2) if soc > 0 else None,
            "avg_days_to_convert": data_rec["avg_days_to_convert"],
            "lead_conversion_rate": round(data_rec["leads_with_q"] / lc * 100.0, 1) if lc > 0 else None,
        })

    # Sort salespeople by so_value descending
    salespeople.sort(key=lambda x: (x["so_value"], x["quotes_value"]), reverse=True)

    # ── Funnel Pipeline ──────────────────────────────────────────────────────
    funnel = [
        {"stage": "Leads",        "count": summary["leads_created"],  "value": summary["expected_rev_sum"]},
        {"stage": "Quotes",       "count": summary["quotes_created"], "value": summary["quotes_value"]},
        {"stage": "Won",          "count": summary["quotes_won"],     "value": summary["quotes_won_value"]},
        {"stage": "Sales Orders", "count": summary["so_count"],       "value": summary["so_value"]},
        {"stage": "Invoiced",     "count": summary["invoiced_count"], "value": summary["invoiced_value"]},
        {"stage": "Collected",    "count": summary["collected_count"],"value": summary["collected_value"]},
    ]

    # ── Monthly Trend (Last 12 Months) ───────────────────────────────────────
    monthly = []
    # Build 12 months array ending at t_date's month
    cur_year = t_date.year
    cur_month = t_date.month
    month_slots = []
    for i in range(11, -1, -1):
        m = cur_month - i
        y = cur_year
        while m <= 0:
            m += 12
            y -= 1
        m_start = date(y, m, 1)
        if m == 12:
            m_end = date(y, 12, 31)
        else:
            m_end = date(y, m + 1, 1) - timedelta(days=1)
        month_slots.append((y, m, m_start.strftime("%b"), m_start.isoformat(), m_end.isoformat()))

    for y, m, m_label, ms_str, me_str in month_slots:
        so_m_val = float(
            apply_company_filter(
                db.query(func.sum(SalesOrder.total_amount)).filter(
                    SalesOrder.is_active == True,
                    SalesOrder.status != 'cancelled',
                    cast(func.coalesce(func.nullif(SalesOrder.order_date, ''), func.to_char(SalesOrder.created_at, 'YYYY-MM-DD')), String) >= ms_str,
                    cast(func.coalesce(func.nullif(SalesOrder.order_date, ''), func.to_char(SalesOrder.created_at, 'YYYY-MM-DD')), String) <= me_str,
                ),
                SalesOrder, cid
            ).scalar() or 0.0
        )
        pay_m_val = float(
            apply_company_filter(
                db.query(func.sum(Payment.amount)).filter(
                    Payment.is_active == True,
                    cast(func.coalesce(func.nullif(Payment.payment_date, ''), func.to_char(Payment.created_at, 'YYYY-MM-DD')), String) >= ms_str,
                    cast(func.coalesce(func.nullif(Payment.payment_date, ''), func.to_char(Payment.created_at, 'YYYY-MM-DD')), String) <= me_str,
                ),
                Payment, cid
            ).scalar() or 0.0
        )
        monthly.append({
            "month": m_label,
            "year": y,
            "so_value": round(so_m_val, 2),
            "collected_value": round(pay_m_val, 2)
        })

    # ── Data Quality Block ───────────────────────────────────────────────────
    blank_q_count = (
        quotes_q.filter(q_sp_expr.is_(None) | (q_sp_expr == '')).count()
    )
    blank_so_count = (
        sos_q.filter(so_sp_expr.is_(None) | (so_sp_expr == '')).count()
    )

    emp_q = apply_company_filter(
        db.query(Employee).filter(Employee.is_active == True),
        Employee, cid
    )
    active_emp_names = { _normalize_sp(e.name) for e in emp_q.all() }

    # All non-unassigned salespersons in company
    unmatched_names_set = set()
    for sp_rec in salespeople:
        n_key = _normalize_sp(sp_rec["salesperson"])
        if n_key != "unassigned" and n_key not in active_emp_names:
            unmatched_names_set.add(sp_rec["salesperson"])

    data_quality = {
        "blank_salesperson_quotes": blank_q_count,
        "blank_salesperson_sos": blank_so_count,
        "unmatched_names": sorted(list(unmatched_names_set))
    }

    eff_scope = getattr(user, "data_scope", "company")
    if isinstance(getattr(user, "module_scopes", None), dict):
        eff_scope = user.module_scopes.get("reports", eff_scope)
    is_scoped = (user.role not in ("superadmin", "admin")) and (eff_scope == "own")

    return {
        "period": {
            "from": f_str,
            "to": t_str,
            "label": period_label
        },
        "summary": summary,
        "previous": previous,
        "funnel": funnel,
        "salespeople": salespeople,
        "monthly": monthly,
        "data_quality": data_quality,
        "is_scoped": is_scoped,
    }


def _get_history_dataset(
    f_date: date,
    t_date: date,
    cid: Optional[int],
    db: Session,
    salesperson_filter: Optional[str] = None,
    doc_type_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    f_str = f_date.isoformat()
    t_str = t_date.isoformat()
    items = []

    sp_norm_filter = _normalize_sp(salesperson_filter) if isinstance(salesperson_filter, str) and salesperson_filter else None
    search_norm = _clean_str(search).lower() if isinstance(search, str) and search else None
    doc_type_norm = doc_type_filter.lower() if isinstance(doc_type_filter, str) and doc_type_filter else None

    # Quotations
    if not doc_type_norm or doc_type_norm in ("quotation", "quote"):
        q_date_expr = cast(
            func.coalesce(
                func.nullif(Quotation.quote_date, ''),
                func.to_char(Quotation.created_at, 'YYYY-MM-DD')
            ),
            String
        )
        q_sp_expr = func.coalesce(func.nullif(Quotation.salesperson, ''), func.nullif(CRMLead.salesperson, ''))

        quotes_q = (
            apply_company_filter(
                db.query(Quotation).filter(Quotation.is_active == True, Quotation.status != 'cancelled'),
                Quotation, cid
            )
            .outerjoin(CRMLead, Quotation.crm_lead_id == CRMLead.id)
            .outerjoin(Customer, Quotation.customer_id == Customer.id)
            .filter(q_date_expr >= f_str, q_date_expr <= t_str)
        )

        so_sub = (
            apply_company_filter(
                db.query(SalesOrder.quotation_id, SalesOrder.so_number).filter(
                    SalesOrder.is_active == True,
                    SalesOrder.quotation_id.isnot(None)
                ),
                SalesOrder, cid
            ).all()
        )
        so_by_q = {s.quotation_id: s.so_number for s in so_sub}

        for q, lead, cust in quotes_q.with_entities(Quotation, CRMLead, Customer).all():
            sp_display = _clean_str(q.salesperson or (lead.salesperson if lead else '')) or _UNASSIGNED
            if sp_norm_filter and _normalize_sp(sp_display) != sp_norm_filter:
                continue

            cust_name = cust.name if cust else (lead.name if lead else '—')
            if search_norm and (
                search_norm not in q.quote_number.lower() and
                search_norm not in cust_name.lower()
            ):
                continue

            items.append({
                "id": f"q_{q.id}",
                "doc_type": "Quotation",
                "doc_number": q.quote_number,
                "date": q.quote_date or (str(q.created_at)[:10] if q.created_at else ''),
                "customer_name": cust_name,
                "salesperson": sp_display,
                "status": q.status,
                "amount": round(float(q.total_amount or 0.0), 2),
                "linked_lead_number": lead.lead_number if lead else None,
                "linked_so_number": so_by_q.get(q.id),
                "created_at_str": str(q.created_at or '')
            })

    # Sales Orders
    if not doc_type_norm or doc_type_norm in ("sales order", "salesorder", "so"):
        so_date_expr = cast(
            func.coalesce(
                func.nullif(SalesOrder.order_date, ''),
                func.to_char(SalesOrder.created_at, 'YYYY-MM-DD')
            ),
            String
        )
        so_sp_expr = func.coalesce(
            func.nullif(SalesOrder.salesperson, ''),
            func.nullif(Quotation.salesperson, ''),
            func.nullif(CRMLead.salesperson, '')
        )

        sos_q = (
            apply_company_filter(
                db.query(SalesOrder).filter(SalesOrder.is_active == True, SalesOrder.status != 'cancelled'),
                SalesOrder, cid
            )
            .outerjoin(Quotation, SalesOrder.quotation_id == Quotation.id)
            .outerjoin(CRMLead, func.coalesce(SalesOrder.crm_lead_id, Quotation.crm_lead_id) == CRMLead.id)
            .outerjoin(Customer, SalesOrder.customer_id == Customer.id)
            .filter(so_date_expr >= f_str, so_date_expr <= t_str)
        )

        for so, q, lead, cust in sos_q.with_entities(SalesOrder, Quotation, CRMLead, Customer).all():
            sp_raw_resolved = so.salesperson or (q.salesperson if q else '') or (lead.salesperson if lead else '')
            sp_display = _clean_str(sp_raw_resolved) or _UNASSIGNED

            if sp_norm_filter and _normalize_sp(sp_display) != sp_norm_filter:
                continue

            cust_name = so.customer_name or (cust.name if cust else (lead.name if lead else '—'))
            if search_norm and (
                search_norm not in so.so_number.lower() and
                search_norm not in cust_name.lower()
            ):
                continue

            items.append({
                "id": f"so_{so.id}",
                "doc_type": "Sales Order",
                "doc_number": so.so_number,
                "date": so.order_date or (str(so.created_at)[:10] if so.created_at else ''),
                "customer_name": cust_name,
                "salesperson": sp_display,
                "status": so.status,
                "amount": round(float(so.total_amount or 0.0), 2),
                "linked_lead_number": lead.lead_number if lead else None,
                "linked_so_number": q.quote_number if q else None,
                "created_at_str": str(so.created_at or '')
            })

    items.sort(key=lambda x: (x["date"], x["created_at_str"]), reverse=True)
    return items


@router.get("/sales-performance/history")
def sales_performance_history(
    from_date:   Optional[str] = Query(None, alias="from"),
    to_date:     Optional[str] = Query(None, alias="to"),
    page:        int = Query(1, ge=1),
    page_size:   int = Query(25, ge=1, le=200),
    salesperson: Optional[str] = Query(None),
    doc_type:    Optional[str] = Query(None),
    search:      Optional[str] = Query(None),
    db:          Session = Depends(get_db),
    user = Depends(get_current_user),
):
    cid = getattr(user, "active_company_id", None)
    f_date, t_date, _ = _parse_dates(from_date, to_date)

    dataset = _get_history_dataset(
        f_date, t_date, cid, db,
        salesperson_filter=salesperson,
        doc_type_filter=doc_type,
        search=search
    )

    total = len(dataset)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    items_page = dataset[start_idx:end_idx]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0,
        "items": items_page
    }


@router.get("/sales-performance/export")
def sales_performance_export(
    from_date:   Optional[str] = Query(None, alias="from"),
    to_date:     Optional[str] = Query(None, alias="to"),
    salesperson: Optional[str] = Query(None),
    db:          Session = Depends(get_db),
    user = Depends(get_current_user),
):
    cid = getattr(user, "active_company_id", None)
    f_date, t_date, period_label = _parse_dates(from_date, to_date)

    report_data = sales_performance(from_date=f_date.isoformat(), to_date=t_date.isoformat(), db=db, user=user)
    history_dataset = _get_history_dataset(f_date, t_date, cid, db, salesperson_filter=salesperson)

    report_data["history"] = history_dataset
    return report_data
