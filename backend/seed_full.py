import sys
sys.path.append(".")

from app.database import SessionLocal
from app.models import *
from app.services.auth_service import hash_password

db = SessionLocal()

# Companies
companies = [
    Company(id=1, name="Essar Sons", short_name="ESSAR", color="#1a237e", gstin="27AAIFE0491M1Z4", address="Shop No.11, Rashmi Shopping Centre, Agashi Road", city="Virar West", state="Maharashtra", phone="08047515289", website="www.essarsons.in"),
    Company(id=2, name="Excel Traders", short_name="EXCEL", color="#1b5e20", city="Virar East", state="Maharashtra"),
    Company(id=3, name="Alfa Enterprise", short_name="ALFA-E", color="#4a148c", city="Virar", state="Maharashtra"),
    Company(id=4, name="Alfa Lifters", short_name="ALFA-L", color="#bf360c", city="Virar", state="Maharashtra"),
]
for c in companies:
    db.merge(c)
db.commit()
print("Companies done")

# Users
users = [
    User(id=1, username="superadmin", password=hash_password("super@123"), name="Super Admin", role="superadmin", company_id=None, permissions=["all"]),
    User(id=2, username="admin", password=hash_password("essar@123"), name="Fakhruddin Arsiwala", role="admin", company_id=1, permissions=["all"]),
    User(id=3, username="sales", password=hash_password("sales@123"), name="Rajesh Patil", role="sales", company_id=1, permissions=["crm","quotations","sales_orders"]),
    User(id=4, username="accounts", password=hash_password("acc@123"), name="Priya Mehta", role="accounts", company_id=1, permissions=["invoices","payments"]),
]
for u in users:
    db.merge(u)
db.commit()
print("Users done")

# Customers
customers = [
    Customer(id=1, customer_code="CUST0001", name="Patel Construction Co.", customer_type="company", phone="9820444444", email="patel@gmail.com", city="Mumbai", state="Maharashtra", company_id=1),
    Customer(id=2, customer_code="CUST0002", name="Agarwal Glass Works", customer_type="company", phone="9820888888", email="agarwal@gmail.com", city="Thane", state="Maharashtra", company_id=1),
    Customer(id=3, customer_code="CUST0003", name="Sunrise Developers", customer_type="company", phone="9820777777", email="sunrise@gmail.com", city="Virar", state="Maharashtra", company_id=1),
    Customer(id=4, customer_code="CUST0004", name="Skyline Builders Pvt Ltd", customer_type="company", phone="9820111111", email="skyline@gmail.com", city="Mumbai", state="Maharashtra", company_id=1),
    Customer(id=5, customer_code="CUST0005", name="Royal Furnishers", customer_type="company", phone="9820333333", email="royal@gmail.com", city="Vasai", state="Maharashtra", company_id=1),
    Customer(id=6, customer_code="CUST0006", name="Om Interiors", customer_type="company", phone="9820222222", email="om@gmail.com", city="Virar", state="Maharashtra", company_id=1),
    Customer(id=7, customer_code="CUST0007", name="Horizon Infra Projects", customer_type="company", phone="9821010101", email="horizon@gmail.com", city="Navi Mumbai", state="Maharashtra", company_id=1),
    Customer(id=8, customer_code="CUST0008", name="GlassHub Solutions", customer_type="company", phone="9820666666", email="glasshub@gmail.com", city="Pune", state="Maharashtra", company_id=1),
    Customer(id=9, customer_code="CUST0009", name="Mehta Architecture Studio", customer_type="company", phone="9820555555", email="mehta@gmail.com", city="Mumbai", state="Maharashtra", company_id=1),
    Customer(id=10, customer_code="CUST0010", name="Shivang Shukla", customer_type="individual", phone="9702883613", email="shivang@gmail.com", city="Virar", state="Maharashtra", company_id=1),
]
for c in customers:
    db.merge(c)
db.commit()
print("Customers done")

# Vendors
vendors = [
    Vendor(id=1, vendor_code="VEND0001", name="Sapphire Glass Solutions Pvt Ltd", gstin="27AASCS5707K1ZP", phone="9867543242", email="inquiry@sapphiretuff.com", city="Navi Mumbai", state="Maharashtra", company_id=1),
    Vendor(id=2, vendor_code="VEND0002", name="Saint Gobain India", phone="9820123456", email="info@saintgobain.com", city="Mumbai", state="Maharashtra", company_id=1),
    Vendor(id=3, vendor_code="VEND0003", name="Gold Plus Glass Industry", phone="9820234567", email="info@goldplus.com", city="Delhi", state="Delhi", company_id=1),
    Vendor(id=4, vendor_code="VEND0004", name="Asahi India Glass Ltd", phone="9820345678", email="info@asahiindia.com", city="Mumbai", state="Maharashtra", company_id=1),
    Vendor(id=5, vendor_code="VEND0005", name="Modi Guard Glass", phone="9820456789", email="info@modiguard.com", city="Pune", state="Maharashtra", company_id=1),
]
for v in vendors:
    db.merge(v)
db.commit()
print("Vendors done")

# Products
products = [
    Product(id=1,  internal_ref="PROD0001", name="Clear Annealed 4mm",        glass_type="Annealed",  glass_category="Clear",      thickness_mm=4,  hsn_code="7007", sale_price=37.13,  cost_price=26.0,  on_hand_qty=350, company_id=1),
    Product(id=2,  internal_ref="PROD0002", name="Clear Annealed 5mm",        glass_type="Annealed",  glass_category="Clear",      thickness_mm=5,  hsn_code="7007", sale_price=46.41,  cost_price=32.5,  on_hand_qty=280, company_id=1),
    Product(id=3,  internal_ref="PROD0003", name="Clear Annealed 6mm",        glass_type="Annealed",  glass_category="Clear",      thickness_mm=6,  hsn_code="7007", sale_price=55.69,  cost_price=39.0,  on_hand_qty=320, company_id=1),
    Product(id=4,  internal_ref="PROD0004", name="Clear Annealed 12mm",       glass_type="Annealed",  glass_category="Clear",      thickness_mm=12, hsn_code="7007", sale_price=111.38, cost_price=78.0,  on_hand_qty=150, company_id=1),
    Product(id=5,  internal_ref="PROD0005", name="Xtra Clear Annealed 6mm",   glass_type="Annealed",  glass_category="Xtra Clear", thickness_mm=6,  hsn_code="7007", sale_price=83.61,  cost_price=58.5,  on_hand_qty=200, company_id=1),
    Product(id=6,  internal_ref="PROD0006", name="Xtra Clear Annealed 12mm",  glass_type="Annealed",  glass_category="Xtra Clear", thickness_mm=12, hsn_code="7007", sale_price=167.22, cost_price=117.0, on_hand_qty=120, company_id=1),
    Product(id=7,  internal_ref="PROD0007", name="Xtra Clear Toughened 6mm",  glass_type="Toughened", glass_category="Xtra Clear", thickness_mm=6,  hsn_code="7007", sale_price=83.61,  cost_price=58.5,  on_hand_qty=180, company_id=1),
    Product(id=8,  internal_ref="PROD0008", name="Xtra Clear Toughened 12mm", glass_type="Toughened", glass_category="Xtra Clear", thickness_mm=12, hsn_code="7007", sale_price=167.22, cost_price=117.0, on_hand_qty=100, company_id=1),
    Product(id=9,  internal_ref="PROD0009", name="Grey Mirror 5mm",           glass_type="Annealed",  glass_category="Mirror",     thickness_mm=5,  hsn_code="7009", sale_price=81.25,  cost_price=56.9,  on_hand_qty=250, company_id=1),
    Product(id=10, internal_ref="PROD0010", name="Tinted Green 6mm",          glass_type="Annealed",  glass_category="Tinted",     thickness_mm=6,  hsn_code="7007", sale_price=69.61,  cost_price=48.7,  on_hand_qty=160, company_id=1),
]
for p in products:
    db.merge(p)
db.commit()
print("Products done")

# Employees
employees = [
    Employee(id=1, employee_code="EMP0001", name="Fakhruddin Arsiwala", designation="Director",         department="Management", work_phone="9226205654", company_id=1),
    Employee(id=2, employee_code="EMP0002", name="Rajesh Patil",        designation="Sales Manager",    department="Sales",      work_phone="9820100001", company_id=1),
    Employee(id=3, employee_code="EMP0003", name="Priya Mehta",         designation="Accounts Manager", department="Accounts",   work_phone="9820100002", company_id=1),
    Employee(id=4, employee_code="EMP0004", name="Amit Sharma",         designation="Salesperson",      department="Sales",      work_phone="9820100003", company_id=1),
    Employee(id=5, employee_code="EMP0005", name="Husein Arsiwala",     designation="Operations",       department="Operations", work_phone="9820100004", company_id=1),
]
for e in employees:
    db.merge(e)
db.commit()
print("Employees done")

# CRM Stages
stages = [
    CRMStage(id=1, name="New",         sequence=10, probability=10,  is_won=False, is_lost=False, company_id=1),
    CRMStage(id=2, name="Quote Given", sequence=20, probability=30,  is_won=False, is_lost=False, company_id=1),
    CRMStage(id=3, name="Won",         sequence=40, probability=100, is_won=True,  is_lost=False, company_id=1),
    CRMStage(id=4, name="Lost",        sequence=50, probability=0,   is_won=False, is_lost=True,  is_active=False, company_id=1),
]
for s in stages:
    db.merge(s)
db.commit()
print("CRM Stages done")

# CRM Leads
leads = [
    CRMLead(id=1,  lead_number="OPP0001", name="Home Window Glass Replacement",        stage_id=1, customer_id=1,  company_name="Patel Construction Co.",   phone="9820444444", expected_revenue=18000,  priority="low",    salesperson="Amit Sharma",  company_id=1),
    CRMLead(id=2,  lead_number="OPP0002", name="Back Painted Glass Kitchen - Agarwal", stage_id=1, customer_id=2,  company_name="Agarwal Glass Works",      phone="9820888888", expected_revenue=55000,  priority="normal", salesperson="Rajesh Patil", company_id=1),
    CRMLead(id=3,  lead_number="OPP0003", name="Laminated Glass Staircase Railing",    stage_id=1, customer_id=3,  company_name="Sunrise Developers",       phone="9820777777", expected_revenue=95000,  priority="high",   salesperson="Amit Sharma",  company_id=1),
    CRMLead(id=4,  lead_number="OPP0004", name="DGU Glass for Commercial Building",    stage_id=3, customer_id=4,  company_name="Skyline Builders Pvt Ltd", phone="9820111111", expected_revenue=185000, priority="urgent", salesperson="Rajesh Patil", company_id=1),
    CRMLead(id=5,  lead_number="OPP0005", name="Toughened Glass Balcony - Royal",      stage_id=3, customer_id=5,  company_name="Royal Furnishers",         phone="9820333333", expected_revenue=145000, priority="high",   salesperson="Amit Sharma",  company_id=1),
    CRMLead(id=6,  lead_number="OPP0006", name="Shower Partition - Om Interiors",      stage_id=3, customer_id=6,  company_name="Om Interiors",             phone="9820222222", expected_revenue=92000,  priority="normal", salesperson="Rajesh Patil", company_id=1),
    CRMLead(id=7,  lead_number="OPP0007", name="Curtain Wall Glass - Horizon Tower",   stage_id=2, customer_id=7,  company_name="Horizon Infra Projects",   phone="9821010101", expected_revenue=850000, priority="urgent", salesperson="Amit Sharma",  company_id=1),
    CRMLead(id=8,  lead_number="OPP0008", name="Float Glass Supply - Monthly Order",   stage_id=2, customer_id=8,  company_name="GlassHub Solutions",       phone="9820666666", expected_revenue=120000, priority="normal", salesperson="Rajesh Patil", company_id=1),
    CRMLead(id=9,  lead_number="OPP0009", name="Mirror Glass for Hotel Lobby",         stage_id=2, customer_id=9,  company_name="Mehta Architecture Studio",phone="9820555555", expected_revenue=75000,  priority="normal", salesperson="Amit Sharma",  company_id=1),
    CRMLead(id=10, lead_number="OPP0010", name="Office Partition Glass - Skyline HQ",  stage_id=3, customer_id=4,  company_name="Skyline Builders Pvt Ltd", phone="9820111111", expected_revenue=185000, priority="high",   salesperson="Rajesh Patil", company_id=1),
]
for l in leads:
    db.merge(l)
db.commit()
print("CRM Leads done")


# Quotations
from datetime import date

quotations = [
    Quotation(
        id=1, quote_number="QT0001",
        customer_id=4, crm_lead_id=4,
        quote_date="2026-05-01", valid_until="2026-06-01",
        salesperson="Amit Sharma", payment_terms="30_days",
        status="confirmed",
        groups=[], lines=[],
        subtotal=63219.99, process_total=5000,
        dc_charges=1000, discount_amount=0,
        cgst=5689.80, sgst=5689.80, igst=0,
        total_amount=74599.59,
        advance_received=10000, balance_due=64599.59,
        company_id=1
    ),
    Quotation(
        id=2, quote_number="QT0002",
        customer_id=5, crm_lead_id=5,
        quote_date="2026-05-03", valid_until="2026-06-03",
        salesperson="Rajesh Patil", payment_terms="immediate",
        status="confirmed",
        groups=[], lines=[],
        subtotal=145000, process_total=8000,
        dc_charges=1500, discount_amount=5000,
        cgst=13455, sgst=13455, igst=0,
        total_amount=176410,
        advance_received=50000, balance_due=126410,
        company_id=1
    ),
    Quotation(
        id=3, quote_number="QT0003",
        customer_id=6, crm_lead_id=6,
        quote_date="2026-05-05", valid_until="2026-06-05",
        salesperson="Amit Sharma", payment_terms="15_days",
        status="sent",
        groups=[], lines=[],
        subtotal=92000, process_total=3000,
        dc_charges=500, discount_amount=0,
        cgst=8595, sgst=8595, igst=0,
        total_amount=112690,
        advance_received=0, balance_due=112690,
        company_id=1
    ),
    Quotation(
        id=4, quote_number="QT0004",
        customer_id=7, crm_lead_id=7,
        quote_date="2026-05-08", valid_until="2026-06-08",
        salesperson="Rajesh Patil", payment_terms="30_days",
        status="sent",
        groups=[], lines=[],
        subtotal=850000, process_total=25000,
        dc_charges=5000, discount_amount=10000,
        cgst=78300, sgst=78300, igst=0,
        total_amount=1026600,
        advance_received=200000, balance_due=826600,
        company_id=1
    ),
    Quotation(
        id=5, quote_number="QT0005",
        customer_id=9, crm_lead_id=9,
        quote_date="2026-05-10", valid_until="2026-06-10",
        salesperson="Amit Sharma", payment_terms="immediate",
        status="draft",
        groups=[], lines=[],
        subtotal=75000, process_total=4000,
        dc_charges=1000, discount_amount=0,
        cgst=7200, sgst=7200, igst=0,
        total_amount=94400,
        advance_received=0, balance_due=94400,
        company_id=1
    ),
]
for q in quotations:
    db.merge(q)
db.commit()
print("Quotations done")

# Sales Orders
sales_orders = [
    SalesOrder(
        id=1, so_number="SO0001",
        customer_id=4, quotation_id=1, crm_lead_id=4,
        order_date="2026-05-02", delivery_date="2026-05-15",
        salesperson="Amit Sharma", payment_terms="30_days",
        status="confirmed",
        lines=[], groups=[],
        subtotal=63219.99, tax_amount=11379.60,
        total_amount=74599.59,
        company_id=1
    ),
    SalesOrder(
        id=2, so_number="SO0002",
        customer_id=5, quotation_id=2, crm_lead_id=5,
        order_date="2026-05-04", delivery_date="2026-05-20",
        salesperson="Rajesh Patil", payment_terms="immediate",
        status="in_production",
        lines=[], groups=[],
        subtotal=149500, tax_amount=26910,
        total_amount=176410,
        company_id=1
    ),
    SalesOrder(
        id=3, so_number="SO0003",
        customer_id=6, quotation_id=3, crm_lead_id=6,
        order_date="2026-05-06", delivery_date="2026-05-25",
        salesperson="Amit Sharma", payment_terms="15_days",
        status="ready",
        lines=[], groups=[],
        subtotal=95500, tax_amount=17190,
        total_amount=112690,
        company_id=1
    ),
]
for s in sales_orders:
    db.merge(s)
db.commit()
print("Sales Orders done")

# Purchase Orders
purchase_orders = [
    PurchaseOrder(
        id=1, po_number="PO0001",
        vendor_id=1, so_id=1,
        po_date="2026-05-02",
        expected_delivery="2026-05-12",
        payment_terms="advance",
        status="received",
        lines=[],
        subtotal=188920.35, tax_amount=34005.66,
        total_amount=223221.00,
        company_id=1
    ),
    PurchaseOrder(
        id=2, po_number="PO0002",
        vendor_id=2, so_id=2,
        po_date="2026-05-04",
        expected_delivery="2026-05-18",
        payment_terms="30_days",
        status="ordered",
        lines=[],
        subtotal=95000, tax_amount=17100,
        total_amount=112100,
        company_id=1
    ),
]
for p in purchase_orders:
    db.merge(p)
db.commit()
print("Purchase Orders done")

# Invoices
invoices = [
    Invoice(
        id=1, invoice_number="INV0001",
        customer_id=4, so_id=1,
        invoice_date="2026-05-15", due_date="2026-06-15",
        payment_terms="30_days", status="paid",
        is_inter_state=False,
        lines=[],
        subtotal=63219.99, cgst=5689.80, sgst=5689.80,
        igst=0, tax_amount=11379.60,
        total_amount=74599.59,
        advance_received=10000,
        company_id=1
    ),
    Invoice(
        id=2, invoice_number="INV0002",
        customer_id=6, so_id=3,
        invoice_date="2026-05-25", due_date="2026-06-09",
        payment_terms="15_days", status="paid",
        is_inter_state=False,
        lines=[],
        subtotal=95500, cgst=8595, sgst=8595,
        igst=0, tax_amount=17190,
        total_amount=112690,
        advance_received=0,
        company_id=1
    ),
    Invoice(
        id=3, invoice_number="INV0003",
        customer_id=8, so_id=None,
        invoice_date="2026-05-10", due_date="2026-06-10",
        payment_terms="30_days", status="sent",
        is_inter_state=False,
        lines=[],
        subtotal=102000, cgst=9180, sgst=9180,
        igst=0, tax_amount=18360,
        total_amount=120360,
        advance_received=0,
        company_id=1
    ),
]
for i in invoices:
    db.merge(i)
db.commit()
print("Invoices done")

# Delivery Challans
challans = [
    DeliveryChallan(
        id=1, dc_number="DC0001",
        customer_id=4, so_id=1,
        dc_date="2026-05-14",
        vehicle_number="MH04-AB-1234",
        driver_name="Ramesh Kumar",
        status="delivered",
        lines=[],
        company_id=1
    ),
    DeliveryChallan(
        id=2, dc_number="DC0002",
        customer_id=6, so_id=3,
        dc_date="2026-05-24",
        vehicle_number="MH04-CD-5678",
        driver_name="Suresh Patil",
        status="delivered",
        lines=[],
        company_id=1
    ),
]
for c in challans:
    db.merge(c)
db.commit()
print("Delivery Challans done")

db.close()
print("")
print("FULL SEED COMPLETE!")