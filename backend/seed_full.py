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
    User(id=1, username="superadmin", password=hash_password("EssarAdmin@2026"), name="Super Admin", role="superadmin", company_id=None, permissions=["all"]),
    User(id=2, username="admin", password=hash_password("EssarUser@2026"), name="Fakhruddin Arsiwala", role="admin", company_id=1, permissions=["all"]),
    User(id=3, username="sales", password=hash_password("EssarSales@2026"), name="Rajesh Patil", role="sales", company_id=1, permissions=["crm","quotations","sales_orders"]),
    User(id=4, username="accounts", password=hash_password("EssarAcc@2026"), name="Priya Mehta", role="accounts", company_id=1, permissions=["invoices","payments"]),
]
for u in users:
    db.merge(u)
db.commit()
print("Users done")

# REMOVED FOR PRODUCTION — Customers
# (Real customers are managed via the app UI)

# REMOVED FOR PRODUCTION — Vendors
# (Real vendors are managed via the app UI)

# Products (Master Data)
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

# REMOVED FOR PRODUCTION — CRM Leads
# (Real leads are managed via the app UI)

# REMOVED FOR PRODUCTION — Quotations
# (Real quotations are managed via the app UI)

# REMOVED FOR PRODUCTION — Sales Orders
# (Real sales orders are managed via the app UI)

# REMOVED FOR PRODUCTION — Purchase Orders
# (Real purchase orders are managed via the app UI)

# REMOVED FOR PRODUCTION — Invoices
# (Real invoices are managed via the app UI)

# REMOVED FOR PRODUCTION — Delivery Challans
# (Real delivery challans are managed via the app UI)

db.close()
print("")
print("PRODUCTION SEED COMPLETE!")