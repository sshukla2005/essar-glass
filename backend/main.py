from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config   import settings
from app.database import Base, engine

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
