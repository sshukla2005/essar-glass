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

    # 1. Invoices aggregations (revenue, outstanding)
    inv_rows = db.query(
        Invoice.company_id,
        func.sum(case((Invoice.status.in_(['paid', 'sent', 'confirmed']), Invoice.total_amount), else_=0)).label("revenue"),
        func.sum(case((Invoice.status == 'sent', Invoice.total_amount), else_=0)).label("outstanding"),
    ).filter(Invoice.is_active == True).group_by(Invoice.company_id).all()
    inv_map = {r.company_id: (float(r.revenue or 0), float(r.outstanding or 0)) for r in inv_rows}

    # 2. Purchase Orders aggregations (purchase_cost)
    po_rows = db.query(
        PurchaseOrder.company_id,
        func.sum(case((PurchaseOrder.status == 'received', PurchaseOrder.total_amount), else_=0)).label("purchase_cost"),
    ).filter(PurchaseOrder.is_active == True).group_by(PurchaseOrder.company_id).all()
    po_map = {r.company_id: float(r.purchase_cost or 0) for r in po_rows}

    # 3. Sales Orders aggregations (total_sos, active_sos)
    so_rows = db.query(
        SalesOrder.company_id,
        func.count(SalesOrder.id).label("total_sos"),
        func.count(case((SalesOrder.status.in_(['confirmed', 'in_production', 'ready']), SalesOrder.id), else_=None)).label("active_sos"),
    ).filter(SalesOrder.is_active == True).group_by(SalesOrder.company_id).all()
    so_map = {r.company_id: (int(r.total_sos or 0), int(r.active_sos or 0)) for r in so_rows}

    # 4. Quotations aggregations (total_quotes)
    quote_rows = db.query(
        Quotation.company_id,
        func.count(Quotation.id).label("total_quotes"),
    ).filter(Quotation.is_active == True).group_by(Quotation.company_id).all()
    quote_map = {r.company_id: int(r.total_quotes or 0) for r in quote_rows}

    # 5. Customers aggregations (total_customers)
    cust_rows = db.query(
        Customer.company_id,
        func.count(Customer.id).label("total_customers"),
    ).filter(Customer.is_active == True).group_by(Customer.company_id).all()
    cust_map = {r.company_id: int(r.total_customers or 0) for r in cust_rows}

    # 6. Employees aggregations (total_employees)
    emp_rows = db.query(
        Employee.company_id,
        func.count(Employee.id).label("total_employees"),
    ).filter(Employee.is_active == True).group_by(Employee.company_id).all()
    emp_map = {r.company_id: int(r.total_employees or 0) for r in emp_rows}

    # 7. CRM Leads aggregations (total_leads, won_leads)
    lead_rows = db.query(
        CRMLead.company_id,
        func.count(CRMLead.id).label("total_leads"),
        func.count(case((CRMLead.stage_id == 4, CRMLead.id), else_=None)).label("won_leads"),
    ).filter(CRMLead.is_active == True).group_by(CRMLead.company_id).all()
    lead_map = {r.company_id: (int(r.total_leads or 0), int(r.won_leads or 0)) for r in lead_rows}

    # 8. Last 6 months monthly revenue per company
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

    inv_monthly = db.query(
        Invoice.company_id,
        func.extract('year', Invoice.created_at).label("yr"),
        func.extract('month', Invoice.created_at).label("mo"),
        func.sum(Invoice.total_amount).label("m_rev"),
    ).filter(
        Invoice.is_active == True,
        Invoice.status.in_(['paid', 'sent']),
    ).group_by(
        Invoice.company_id,
        func.extract('year', Invoice.created_at),
        func.extract('month', Invoice.created_at),
    ).all()

    monthly_map = {}
    for r in inv_monthly:
        cid = r.company_id
        yr = int(r.yr) if r.yr is not None else 0
        mo = int(r.mo) if r.mo is not None else 0
        rev = float(r.m_rev or 0)
        monthly_map[(cid, yr, mo)] = rev

    company_metrics = []
    for c in companies:
        cid = c.id
        revenue, outstanding = inv_map.get(cid, (0.0, 0.0))
        purchase_cost = po_map.get(cid, 0.0)
        gross_margin = round(((revenue - purchase_cost) / revenue * 100), 1) if revenue > 0 else 0.0
        total_sos, active_sos = so_map.get(cid, (0, 0))
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
    total_group_customers = sum(c['totalCustomers'] for c in company_metrics)
    total_group_active_sos = sum(c['activeSOs'] for c in company_metrics)
    total_group_outstanding = sum(c['outstanding'] for c in company_metrics)

    group_revenue_data = []
    for idx, m in enumerate(months_list):
        entry = {'month': m['name']}
        for c in company_metrics:
            entry[c['short_name']] = c['monthlyRevenue'][idx]['revenue']
        group_revenue_data.append(entry)

    return {
        'company_metrics': company_metrics,
        'companies': company_metrics,
        'totals': {
            'group_revenue': group_revenue,
            'total_customers': total_group_customers,
            'active_orders': total_group_active_sos,
            'outstanding': total_group_outstanding,
        },
        'group_revenue_data': group_revenue_data,
    }
