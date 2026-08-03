"""
Sales Performance Report endpoint.

GET /api/v1/reports/sales-performance?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD

Fully scoped to the active company via apply_company_filter.
Returns per-salesperson aggregates + a full per-lead history for export.
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case, distinct
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.crm import CRMLead, CRMStage
from app.models.quotation import Quotation
from app.utils.helpers import apply_company_filter

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])

_UNASSIGNED = "Unassigned"


def _norm_sp(val):
    """Normalise a salesperson name: None/empty → 'Unassigned'."""
    v = (val or "").strip()
    return v if v else _UNASSIGNED


@router.get("/sales-performance")
def sales_performance(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date:   Optional[str] = Query(None, alias="to"),
    db:   Session = Depends(get_db),
    user = Depends(get_current_user),
):
    cid = getattr(user, "active_company_id", None)

    # ── base scoped queries ────────────────────────────────────────────────────
    leads_q = apply_company_filter(
        db.query(CRMLead).filter(CRMLead.is_active == True),
        CRMLead, cid
    )
    quotes_q = apply_company_filter(
        db.query(Quotation).filter(Quotation.is_active == True),
        Quotation, cid
    )

    # date-range filter on created_at (stored as ISO string in TimestampMixin)
    if from_date:
        leads_q  = leads_q.filter(CRMLead.created_at  >= from_date)
        quotes_q = quotes_q.filter(Quotation.created_at >= from_date)
    if to_date:
        # include the full to_date day
        to_end = to_date + "T23:59:59"
        leads_q  = leads_q.filter(CRMLead.created_at  <= to_end)
        quotes_q = quotes_q.filter(Quotation.created_at <= to_end)

    # ── per-salesperson aggregates ─────────────────────────────────────────────
    # 1. Leads created per salesperson
    lead_agg = (
        leads_q
        .with_entities(
            CRMLead.salesperson,
            func.count(CRMLead.id).label("leads_created"),
        )
        .group_by(CRMLead.salesperson)
        .all()
    )

    # 2. Quotes created per salesperson
    quote_agg = (
        quotes_q
        .with_entities(
            Quotation.salesperson,
            func.count(Quotation.id).label("quotes_created"),
        )
        .group_by(Quotation.salesperson)
        .all()
    )

    # 3. Converted leads: leads that have ≥1 quote with status='converted'
    #    Join quotations to leads on lead's salesperson (not quote's salesperson)
    #    so attribution stays with the lead owner.
    converted_leads_q = (
        apply_company_filter(
            db.query(CRMLead).filter(CRMLead.is_active == True),
            CRMLead, cid
        )
        .join(Quotation, Quotation.crm_lead_id == CRMLead.id)
        .filter(
            Quotation.status == "converted",
            Quotation.is_active == True,
        )
    )
    if from_date:
        converted_leads_q = converted_leads_q.filter(CRMLead.created_at >= from_date)
    if to_date:
        converted_leads_q = converted_leads_q.filter(CRMLead.created_at <= to_end)

    converted_lead_agg = (
        converted_leads_q
        .with_entities(
            CRMLead.salesperson,
            func.count(distinct(CRMLead.id)).label("leads_converted"),
        )
        .group_by(CRMLead.salesperson)
        .all()
    )

    # 4. Converted value: sum of total_amount of converted quotations,
    #    attributed to the quotation's salesperson
    converted_value_agg = (
        quotes_q
        .filter(Quotation.status == "converted")
        .with_entities(
            Quotation.salesperson,
            func.sum(Quotation.total_amount).label("converted_value"),
        )
        .group_by(Quotation.salesperson)
        .all()
    )

    # ── assemble into a salesperson dict ──────────────────────────────────────
    sp_map: dict[str, dict] = {}

    def _get(sp_raw):
        sp = _norm_sp(sp_raw)
        if sp not in sp_map:
            sp_map[sp] = {
                "salesperson": sp,
                "leads_created": 0,
                "quotes_created": 0,
                "leads_converted": 0,
                "converted_value": 0.0,
            }
        return sp_map[sp]

    for row in lead_agg:
        _get(row.salesperson)["leads_created"] = row.leads_created

    for row in quote_agg:
        _get(row.salesperson)["quotes_created"] = row.quotes_created

    for row in converted_lead_agg:
        _get(row.salesperson)["leads_converted"] = row.leads_converted

    for row in converted_value_agg:
        rec = _get(row.salesperson)
        rec["converted_value"] = round(float(row.converted_value or 0), 2)

    # conversion_rate
    for rec in sp_map.values():
        lc = rec["leads_created"]
        rec["conversion_rate"] = round(
            (rec["leads_converted"] / lc * 100) if lc > 0 else 0, 1
        )

    salespeople = sorted(
        sp_map.values(),
        key=lambda x: x["converted_value"],
        reverse=True,
    )

    # ── summary ───────────────────────────────────────────────────────────────
    total_leads     = sum(r["leads_created"]   for r in salespeople)
    total_quotes    = sum(r["quotes_created"]  for r in salespeople)
    total_converted = sum(r["leads_converted"] for r in salespeople)
    total_value     = round(sum(r["converted_value"] for r in salespeople), 2)
    overall_rate    = round((total_converted / total_leads * 100) if total_leads > 0 else 0, 1)

    # ── full lead history (for export) ────────────────────────────────────────
    # One row per lead; attach best-matching quote info if any.
    all_leads = (
        apply_company_filter(
            db.query(CRMLead, CRMStage)
            .outerjoin(CRMStage, CRMStage.id == CRMLead.stage_id)
            .filter(CRMLead.is_active == True),
            CRMLead, cid
        )
    )
    if from_date:
        all_leads = all_leads.filter(CRMLead.created_at >= from_date)
    if to_date:
        all_leads = all_leads.filter(CRMLead.created_at <= to_end)

    all_leads = all_leads.order_by(CRMLead.created_at.desc()).all()

    # Load all scoped quotations into a dict keyed by crm_lead_id for fast lookup
    all_quotes = (
        apply_company_filter(
            db.query(Quotation).filter(Quotation.is_active == True),
            Quotation, cid
        ).all()
    )
    quotes_by_lead: dict[int, list] = {}
    for q in all_quotes:
        if q.crm_lead_id:
            quotes_by_lead.setdefault(q.crm_lead_id, []).append(q)

    history = []
    for lead, stage in all_leads:
        lead_quotes = quotes_by_lead.get(lead.id, [])
        # "converted" = has ≥1 converted quotation
        converted_quotes = [q for q in lead_quotes if q.status == "converted"]
        is_converted = len(converted_quotes) > 0

        if lead_quotes:
            # Pick the most meaningful quote to show in history:
            # prefer converted, else latest
            primary_q = (
                max(converted_quotes, key=lambda q: q.total_amount or 0)
                if converted_quotes
                else sorted(lead_quotes, key=lambda q: q.created_at or "", reverse=True)[0]
            )
            quote_number  = primary_q.quote_number
            quote_status  = primary_q.status
            quote_amount  = primary_q.total_amount or 0
        else:
            quote_number  = None
            quote_status  = None
            quote_amount  = 0

        history.append({
            "lead_id":      lead.id,
            "lead_number":  lead.lead_number,
            "lead_name":    lead.name,
            "salesperson":  _norm_sp(lead.salesperson),
            "created_at":   str(lead.created_at)[:10] if lead.created_at else None,
            "stage":        stage.name if stage else "—",
            "quote_number": quote_number,
            "quote_status": quote_status,
            "quote_amount": round(float(quote_amount), 2),
            "converted":    is_converted,
        })

    return {
        "summary": {
            "total_leads":           total_leads,
            "total_quotes":          total_quotes,
            "total_converted":       total_converted,
            "total_converted_value": total_value,
            "overall_rate":          overall_rate,
        },
        "salespeople": salespeople,
        "history":     history,
    }
