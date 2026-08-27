from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, date

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.company import Company
from app.models.quotation import Quotation
from app.models.sales_order import SalesOrder
from app.models.purchase_order import PurchaseOrder
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.crm import CRMLead
from app.models.payment import Payment
from app.models.payment_allocation import PaymentAllocation
from app.models.wholesale_snapshot import WholesaleSnapshot

router = APIRouter(prefix="/super", tags=["SuperAdmin"])


@router.get("/group-overview")
def get_group_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Group overview aggregate metrics for SuperAdmin Dashboard.

    NOTE: This endpoint intentionally BYPASSES apply_company_filter.
    It is the superadmin-only cross-company aggregate view for the Group Overview Dashboard.
    """
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required",
        )

    # Fetch active companies
    companies = db.query(Company).filter(Company.is_active == True).all()

    # 1. Invoices aggregations (outstanding balance_due only; revenue is SO-based per AE2)
    inv_rows = db.query(
        Invoice.company_id,
        func.sum(case(((Invoice.status != 'cancelled') & (Invoice.balance_due > 0), Invoice.balance_due), else_=0)).label("outstanding"),
    ).filter(Invoice.is_active == True).group_by(Invoice.company_id).all()
    inv_map = {r.company_id: round(float(r.outstanding or 0), 2) for r in inv_rows}

    # 2. Collected per company = sum(PaymentAllocation.amount) for active allocations on active payments
    alloc_rows = db.query(
        PaymentAllocation.company_id,
        func.sum(PaymentAllocation.amount).label("collected"),
    ).join(
        Payment, PaymentAllocation.payment_id == Payment.id
    ).filter(
        PaymentAllocation.is_active == True,
        Payment.is_active == True,
    ).group_by(PaymentAllocation.company_id).all()
    alloc_map = {r.company_id: round(float(r.collected or 0), 2) for r in alloc_rows}

    # 3. Total payments per company (for on_account calc)
    pay_rows = db.query(
        Payment.company_id,
        func.sum(Payment.amount).label("total_payments"),
    ).filter(
        Payment.is_active == True,
    ).group_by(Payment.company_id).all()
    pay_map = {r.company_id: round(float(r.total_payments or 0), 2) for r in pay_rows}

    # 4. Purchase Orders aggregations (purchase_cost)
    po_rows = db.query(
        PurchaseOrder.company_id,
        func.sum(case((PurchaseOrder.status == 'received', PurchaseOrder.total_amount), else_=0)).label("purchase_cost"),
    ).filter(PurchaseOrder.is_active == True).group_by(PurchaseOrder.company_id).all()
    po_map = {r.company_id: float(r.purchase_cost or 0) for r in po_rows}

    # 5. Sales Orders aggregations (revenue, gross_margin inputs, total_sos, active_sos)
    so_committed_statuses = ['confirmed', 'in_production', 'ready', 'delivered']
    so_rows = db.query(
        SalesOrder.company_id,
        func.sum(case((SalesOrder.status.in_(so_committed_statuses), SalesOrder.total_amount), else_=0)).label("revenue"),
        func.sum(case((SalesOrder.status.in_(so_committed_statuses), SalesOrder.profit_amount), else_=None)).label("profit_amount"),
        func.sum(case((SalesOrder.status.in_(so_committed_statuses), SalesOrder.total_amount - func.coalesce(SalesOrder.tax_amount, 0)), else_=0)).label("net_revenue"),
        func.count(case((SalesOrder.status.in_(so_committed_statuses) & ((SalesOrder.profit_amount == None) | (SalesOrder.total_cost == None)), SalesOrder.id), else_=None)).label("missing_cost_count"),
        func.count(SalesOrder.id).label("total_sos"),
        func.count(case((SalesOrder.status.in_(['confirmed', 'in_production', 'ready']), SalesOrder.id), else_=None)).label("active_sos"),
    ).filter(SalesOrder.is_active == True).group_by(SalesOrder.company_id).all()

    so_map = {}
    for r in so_rows:
        rev = round(float(r.revenue or 0), 2)
        net_rev = float(r.net_revenue or 0)
        profit = float(r.profit_amount) if r.profit_amount is not None else None
        missing_cost = int(r.missing_cost_count or 0)
        if net_rev > 0 and profit is not None and missing_cost == 0:
            margin = round((profit / net_rev) * 100, 1)
        else:
            margin = None

        so_map[r.company_id] = {
            "revenue": rev,
            "gross_margin": margin,
            "total_sos": int(r.total_sos or 0),
            "active_sos": int(r.active_sos or 0),
        }

    # 6. Quotations aggregations (total_quotes)
    quote_rows = db.query(
        Quotation.company_id,
        func.count(Quotation.id).label("total_quotes"),
    ).filter(Quotation.is_active == True).group_by(Quotation.company_id).all()
    quote_map = {r.company_id: int(r.total_quotes or 0) for r in quote_rows}

    # 7. Customers aggregations (total_customers)
    cust_rows = db.query(
        Customer.company_id,
        func.count(Customer.id).label("total_customers"),
    ).filter(Customer.is_active == True).group_by(Customer.company_id).all()
    cust_map = {r.company_id: int(r.total_customers or 0) for r in cust_rows}

    # 8. Employees aggregations (total_employees)
    emp_rows = db.query(
        Employee.company_id,
        func.count(Employee.id).label("total_employees"),
    ).filter(Employee.is_active == True).group_by(Employee.company_id).all()
    emp_map = {r.company_id: int(r.total_employees or 0) for r in emp_rows}

    # 9. CRM Leads aggregations (total_leads, won_leads)
    lead_rows = db.query(
        CRMLead.company_id,
        func.count(CRMLead.id).label("total_leads"),
        func.count(case((CRMLead.stage_id == 4, CRMLead.id), else_=None)).label("won_leads"),
    ).filter(CRMLead.is_active == True).group_by(CRMLead.company_id).all()
    lead_map = {r.company_id: (int(r.total_leads or 0), int(r.won_leads or 0)) for r in lead_rows}

    # 10. Last 6 months monthly revenue per company (SO-based per AE2)
    now = datetime.now()
    month_names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    months_list = []
    for i in range(5, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        months_list.append({'year': year, 'month': month, 'name': month_names[month - 1]})

    so_monthly = db.query(
        SalesOrder.company_id,
        SalesOrder.order_date,
        SalesOrder.created_at,
        SalesOrder.total_amount,
    ).filter(
        SalesOrder.is_active == True,
        SalesOrder.status.in_(so_committed_statuses),
    ).all()

    monthly_map = {}
    for r in so_monthly:
        cid = r.company_id
        tot = float(r.total_amount or 0)
        yr, mo = None, None
        if r.order_date:
            try:
                parts = str(r.order_date).strip()[:10].split('-')
                if len(parts) >= 2:
                    yr = int(parts[0])
                    mo = int(parts[1])
            except Exception:
                yr, mo = None, None
        if (yr is None or mo is None) and r.created_at:
            yr = r.created_at.year
            mo = r.created_at.month

        if yr is not None and mo is not None:
            key = (cid, yr, mo)
            monthly_map[key] = round(monthly_map.get(key, 0.0) + tot, 2)

    company_metrics = []
    for c in companies:
        cid = c.id
        so_info = so_map.get(cid, {"revenue": 0.0, "gross_margin": None, "total_sos": 0, "active_sos": 0})
        revenue = so_info["revenue"]
        gross_margin = so_info["gross_margin"]
        total_sos = so_info["total_sos"]
        active_sos = so_info["active_sos"]
        outstanding = inv_map.get(cid, 0.0)
        collected = alloc_map.get(cid, 0.0)
        tot_pay = pay_map.get(cid, 0.0)
        on_account = round(max(0.0, tot_pay - collected), 2)
        purchase_cost = po_map.get(cid, 0.0)
        total_quotes = quote_map.get(cid, 0)
        total_customers = cust_map.get(cid, 0)
        total_employees = emp_map.get(cid, 0)
        total_leads, won_leads = lead_map.get(cid, (0, 0))

        monthly_revenue = []
        for m in months_list:
            m_rev = monthly_map.get((cid, m['year'], m['month']), 0.0)
            monthly_revenue.append({'month': m['name'], 'revenue': m_rev})

        company_metrics.append({
            'id': c.id,
            'name': c.name,
            'short_name': c.short_name or c.name[:4],
            'color': c.color or '#6366f1',
            'accent': getattr(c, 'accent', None) or c.color or '#6366f1',
            'revenue': revenue,
            'collected': collected,
            'onAccount': on_account,
            'on_account': on_account,
            'purchaseCost': purchase_cost,
            'purchase_cost': purchase_cost,
            'grossMargin': gross_margin,
            'gross_margin': gross_margin,
            'outstanding': outstanding,
            'activeSOs': active_sos,
            'active_sos': active_sos,
            'totalQuotes': total_quotes,
            'total_quotes': total_quotes,
            'totalSOs': total_sos,
            'total_sos': total_sos,
            'totalCustomers': total_customers,
            'total_customers': total_customers,
            'totalEmployees': total_employees,
            'total_employees': total_employees,
            'totalLeads': total_leads,
            'total_leads': total_leads,
            'wonLeads': won_leads,
            'won_leads': won_leads,
            'monthlyRevenue': monthly_revenue,
        })

    group_revenue = sum(c['revenue'] for c in company_metrics)
    total_group_collected = sum(c['collected'] for c in company_metrics)
    total_group_on_account = sum(c['on_account'] for c in company_metrics)
    total_group_customers = sum(c['totalCustomers'] for c in company_metrics)
    total_group_active_sos = sum(c['activeSOs'] for c in company_metrics)
    total_group_outstanding = sum(c['outstanding'] for c in company_metrics)

    group_revenue_data = []
    for idx, m in enumerate(months_list):
        entry = {'month': m['name']}
        for c in company_metrics:
            entry[c['short_name']] = c['monthlyRevenue'][idx]['revenue']
        group_revenue_data.append(entry)

    latest = db.query(WholesaleSnapshot).order_by(WholesaleSnapshot.synced_at.desc()).first()
    wholesale = None
    if latest:
        wholesale = {
            "stock_value":   latest.stock_value,
            "month_revenue": latest.month_revenue,
            "month_profit":  latest.month_profit,
            "open_orders":   latest.open_orders,
            "total_sheets":  latest.total_sheets,
            "total_tonnage": latest.total_tonnage,
            "low_stock":     latest.low_stock,
            "trucks_active": latest.trucks_active,
            "synced_at":     latest.synced_at.isoformat() if latest.synced_at else None,
        }

    return {
        'company_metrics': company_metrics,
        'companies': company_metrics,
        'totals': {
            'group_revenue': group_revenue,
            'total_collected': total_group_collected,
            'total_customers': total_group_customers,
            'active_orders': total_group_active_sos,
            'outstanding': total_group_outstanding,
            'on_account': total_group_on_account,
        },
        'group_revenue_data': group_revenue_data,
        'wholesale': wholesale,
    }
