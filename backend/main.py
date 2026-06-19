from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config   import settings
from app.database import Base, engine, get_db
from app.deps import get_current_user

# Import all models so Alembic sees them
from app.models import *  # noqa

# Create tables
Base.metadata.create_all(bind=engine)

# Create upload directory
os.makedirs(f"{settings.UPLOAD_DIR}/artwork", exist_ok=True)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploads
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Import and register routers ───────────────────────────────
from app.routers.auth import router as auth_router
from app.routers      import make_crud_router
from app.models.customer       import Customer
from app.models.vendor         import Vendor
from app.models.product        import Product
from app.models.employee       import Employee
from app.models.crm            import CRMStage, CRMLead
from app.models.quotation      import Quotation
from app.models.sales_order    import SalesOrder
from app.models.purchase_order import PurchaseOrder
from app.models.delivery       import DeliveryChallan
from app.models.invoice        import Invoice
from app.models.inventory      import StockMovement
from app.models.workshop       import WorkshopOrder, TougheningBatch
from app.models.user           import User
from app.models.company        import Company
from app.models.process_master import ProcessMaster
from app.models.warehouse      import Warehouse
from app.models.company_settings import CompanySetting
from app.models.payment import Payment

from app.routers.settings import router as settings_router

PREFIX = "/api/v1"

# Auth
app.include_router(auth_router, prefix=f"{PREFIX}")

# Settings
app.include_router(settings_router)

# Auto CRUD routers (all modules in 3 lines each)
for router_cfg in [
    # (prefix, tag, model, code_prefix, code_field)
    ("/companies",    "Companies",   Company,        "COMP", None),
    ("/customers",    "Customers",   Customer,       "CUST", "customer_code"),
    ("/vendors",      "Vendors",     Vendor,         "VEND", "vendor_code"),
    ("/products",     "Products",    Product,        "PROD", "internal_ref"),
    ("/employees",    "Employees",   Employee,       "EMP",  "employee_code"),
    ("/crm/stages",   "CRM Stages",  CRMStage,       None,   None),
    ("/crm/leads",    "CRM Leads",   CRMLead,        "OPP",  "lead_number"),
    ("/quotations",   "Quotations",  Quotation,      "QT",   "quote_number"),
    ("/sales-orders", "Sales Orders",SalesOrder,     "SO",   "so_number"),
    ("/purchase-orders","PO",        PurchaseOrder,  "PO",   "po_number"),
    ("/delivery",     "Delivery",    DeliveryChallan,"DC",   "dc_number"),
    ("/invoices",     "Invoices",    Invoice,        "INV",  "invoice_number"),
    ("/inventory",    "Inventory",   StockMovement,  "SM",   "move_number"),
    ("/workshop",     "Workshop",    WorkshopOrder,  "WO",   "wo_number"),
    ("/toughening",   "Toughening",  TougheningBatch,"TB",   "tb_number"),
    ("/process-masters", "Process Masters", ProcessMaster, None, None),
    ("/warehouses",      "Warehouses",      Warehouse,     None, None),
    ("/users",        "Users",       User,           None,   None),
    ("/payments",     "Payments",    Payment,        "PMT",  "payment_number"),
]:
    prefix, tag, model, code_pref, code_fld = router_cfg
    # We need schemas — use dict-based for now (Pydantic auto later)
    from pydantic import BaseModel
    class DynCreate(BaseModel):
        model_config = {"extra": "allow"}
    class DynUpdate(BaseModel):
        model_config = {"extra": "allow"}

    r = make_crud_router(
        prefix=f"{PREFIX}{prefix}",
        tag=tag, model=model,
        create_schema=DynCreate,
        update_schema=DynUpdate,
        response_schema=DynCreate,
        code_prefix=code_pref,
        code_field=code_fld,
    )
    app.include_router(r)

# ── Receivables Summary (dashboard numbers) ───────────────────
@app.get("/api/v1/receivables/summary")
def receivables_summary(
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    from app.models.sales_order import SalesOrder
    from app.models.payment import Payment
    from sqlalchemy import func

    so_q = db.query(SalesOrder)
    pay_q = db.query(Payment)

    if user.role != "superadmin" and user.company_id:
        so_q = so_q.filter(SalesOrder.company_id == user.company_id)
        pay_q = pay_q.filter(Payment.company_id == user.company_id)

    so_q = so_q.filter(SalesOrder.is_active == True)
    pay_q = pay_q.filter(Payment.is_active == True)

    total_billed = so_q.with_entities(func.sum(SalesOrder.total_amount)).scalar() or 0
    total_collected = pay_q.with_entities(func.sum(Payment.amount)).scalar() or 0
    outstanding = max(0, total_billed - total_collected)
    advance = max(0, total_collected - total_billed)

    return {
        "total_billed": round(total_billed, 2),
        "total_collected": round(total_collected, 2),
        "outstanding": round(outstanding, 2),
        "advance": round(advance, 2),
    }


# ── Customer Ledger ────────────────────────────────────────────
@app.get("/api/v1/receivables/customer/{customer_id}")
def customer_ledger(
    customer_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    from app.models.sales_order import SalesOrder
    from app.models.payment import Payment
    from app.models.customer import Customer
    from fastapi import HTTPException

    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    sales_orders = db.query(SalesOrder).filter(
        SalesOrder.customer_id == customer_id,
        SalesOrder.is_active == True,
    ).order_by(SalesOrder.id.asc()).all()

    payments = db.query(Payment).filter(
        Payment.customer_id == customer_id,
        Payment.is_active == True,
    ).order_by(Payment.id.asc()).all()

    # Build transactions list — combine SOs and payments, sort by date
    transactions = []

    for so in sales_orders:
        transactions.append({
            "id": f"so_{so.id}",
            "date": so.order_date or str(so.created_at)[:10],
            "reference": so.so_number,
            "type": "invoice",
            "description": f"Sales Order {so.so_number}",
            "debit": round(so.total_amount or 0, 2),
            "credit": 0,
            "so_id": so.id,
            "payment_id": None,
        })

    for pay in payments:
        transactions.append({
            "id": f"pay_{pay.id}",
            "date": pay.payment_date or str(pay.created_at)[:10],
            "reference": pay.payment_number,
            "type": "payment",
            "description": f"Payment via {pay.payment_mode}" + (f" ({pay.payment_account})" if pay.payment_account else ""),
            "debit": 0,
            "credit": round(pay.amount or 0, 2),
            "so_id": pay.so_id,
            "payment_id": pay.id,
            "payment_mode": pay.payment_mode,
            "payment_account": pay.payment_account,
            "payment_reference": pay.payment_reference,
        })

    # Sort by date
    transactions.sort(key=lambda x: x["date"])

    # Running balance (positive = customer owes us, negative = we owe customer)
    running_balance = 0
    for t in transactions:
        running_balance += t["debit"] - t["credit"]
        t["balance"] = round(running_balance, 2)

    total_billed = sum(t["debit"] for t in transactions)
    total_paid = sum(t["credit"] for t in transactions)
    balance = round(total_billed - total_paid, 2)

    return {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "gstin": customer.gstin,
        },
        "transactions": transactions,
        "total_billed": round(total_billed, 2),
        "total_paid": round(total_paid, 2),
        "balance": balance,  # positive = outstanding, negative = advance/credit
    }


# ── Receivables per customer (for dashboard table) ────────────
@app.get("/api/v1/receivables/customers")
def receivables_by_customer(
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    from app.models.sales_order import SalesOrder
    from app.models.payment import Payment
    from app.models.customer import Customer
    from sqlalchemy import func

    company_filter_so = SalesOrder.company_id == user.company_id if user.role != "superadmin" and user.company_id else True
    company_filter_pay = Payment.company_id == user.company_id if user.role != "superadmin" and user.company_id else True

    # Get all customers who have SOs
    so_by_customer = db.query(
        SalesOrder.customer_id,
        func.sum(SalesOrder.total_amount).label("total_billed"),
        func.count(SalesOrder.id).label("so_count"),
    ).filter(
        SalesOrder.is_active == True,
        company_filter_so
    ).group_by(SalesOrder.customer_id).all()

    # Get all payments per customer
    pay_by_customer = db.query(
        Payment.customer_id,
        func.sum(Payment.amount).label("total_paid"),
    ).filter(
        Payment.is_active == True,
        company_filter_pay
    ).group_by(Payment.customer_id).all()

    pay_map = {p.customer_id: float(p.total_paid or 0) for p in pay_by_customer}

    result = []
    for row in so_by_customer:
        cust = db.query(Customer).filter(Customer.id == row.customer_id).first()
        if not cust:
            continue
        total_billed = float(row.total_billed or 0)
        total_paid = pay_map.get(row.customer_id, 0)
        balance = round(total_billed - total_paid, 2)
        result.append({
            "customer_id": row.customer_id,
            "customer_name": cust.name,
            "customer_phone": cust.phone or "",
            "total_billed": round(total_billed, 2),
            "total_paid": round(total_paid, 2),
            "balance": balance,  # positive = outstanding, negative = advance
            "so_count": row.so_count,
            "status": "advance" if balance < 0 else ("settled" if balance == 0 else "pending"),
        })

    result.sort(key=lambda x: abs(x["balance"]), reverse=True)
    return {"items": result, "total": len(result)}


@app.get("/")
def root():
    return {
        "app":     settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs":    "/api/docs",
        "status":  "running"
    }

@app.get("/api/v1/health")
def health():
    return {"status": "healthy", "database": "connected"}

@app.get("/api/v1/workshop/by-so/{so_id}")
def get_wo_by_so(
    so_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Get all Workshop Orders linked to a Sales Order"""
    wos = db.query(WorkshopOrder).filter(
        WorkshopOrder.so_id == so_id,
    ).all()
    return {
        "items": [
            {
                "id": wo.id,
                "wo_number": wo.wo_number,
                "status": wo.status,
                "order_date": wo.order_date,
                "customer_name": wo.customer_name,
                "lines_count": len(wo.lines or []),
            }
            for wo in wos
        ],
        "total": len(wos)
    }
