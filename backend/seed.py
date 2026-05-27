cat > seed_full.py << 'SEEDEOF'
import sys
sys.path.append(".")

from app.database import SessionLocal
from app.models import *
from app.services.auth_service import hash_password
from datetime import datetime

db = SessionLocal()
now = datetime.utcnow()

# ── Companies ─────────────────────────────────────
companies = [
    Company(id=1, name="Essar Sons",      short_name="ESSAR",  color="#1a237e", gstin="27AAIFE0491M1Z4", address="Shop No.11, Rashmi Shopping Centre, Agashi Road", city="Virar West", state="Maharashtra", phone="08047515289", website="www.essarsons.in", email="sales@essarsons.in"),
    Company(id=2, name="Excel Traders",   short_name="EXCEL",  color="#1b5e20", city="Virar East",  state="Maharashtra"),
    Company(id=3, name="Alfa Enterprise", short_name="ALFA-E", color="#4a148c", city="Virar",       state="Maharashtra"),
    Company(id=4, name="Alfa Lifters",    short_name="ALFA-L", color="#bf360c", city="Virar",       state="Maharashtra"),
]
for c in companies:
    db.merge(c)
db.commit()
print("✅ Companies done")

# ── Users ─────────────────────────────────────────
users = [
    User(id=1, username="superadmin", password=hash_password("super@123"), name="Super Admin",         role="superadmin", company_id=None, permissions=["all"]),
    User(id=2, username="admin",      password=hash_password("essar@123"), name="Fakhruddin Arsiwala", role="admin",      company_id=1,    permissions=["all"]),
    User(id=3, username="sales",      password=hash_password("sales@123"), name="Rajesh Patil",        role="sales",      company_id=1,    permissions=["crm","quotations","sales_orders"]),
    User(id=4, username="accounts",   password=hash_password("acc@123"),   name="Priya Mehta",         role="accounts",   company_id=1,    permissions=["invoices","payments"]),
]
for u in users:
    db.merge(u)
db.commit()
print("✅ Users done")

# ── Customers ─────────────────────────────────────
customers = [
    Customer(id=1,  customer_code="CUST0001", name="Patel Construction Co.",      customer_type="company",    phone="9820444444", email="patelconstruction@gmail.com", city="Mumbai",    state="Maharashtra", company_id=1),
    Customer(id=2,  customer_code="CUST0002", name="Agarwal Glass Works",         customer_type="company",    phone="9820888888", email="agarwal@glassworks.com",      city="Thane",     state="Maharashtra", company_id=1),
    Customer(id=3,  customer_code="CUST0003", name="Sunrise Developers",          customer_type="company",    phone="9820777777", email="sunrise@developers.com",      city="Virar",     state="Maharashtra", company_id=1),
    Customer(id=4,  customer_code="CUST0004", name="Skyline Builders Pvt Ltd",    customer_type="company",    phone="9820111111", email="skyline@builders.com",        city="Mumbai",    state="Maharashtra", company_id=1),
    Customer(id=5,  customer_code="CUST0005", name="Royal Furnishers",            customer_type="company",    phone="9820333333", email="royal@furnishers.com",        city="Vasai",     state="Maharashtra", company_id=1),
    Customer(id=6,  customer_code="CUST0006", name="Om Interiors & Decorators",   customer_type="company",    phone="9820222222", email="om@interiors.com",            city="Virar",     state="Maharashtra", company_id=1),
    Customer(id=7,  customer_code="CUST0007", name="Horizon Infra Projects",      customer_type="company",    phone="9821010101", email="horizon@infra.com",           city="Navi Mumbai",state="Maharashtra", company_id=1),
    Customer(id=8,  customer_code="CUST0008", name="GlassHub Solutions",          customer_type="company",    phone="9820666666", email="glasshub@solutions.com",      city="Pune",      state="Maharashtra", company_id=1),
    Customer(id=9,  customer_code="CUST0009", name="Mehta Architecture Studio",   customer_type="company",    phone="9820555555", email="mehta@architecture.com",      city="Mumbai",    state="Maharashtra", company_id=1),
    Customer(id=10, customer_code="CUST0010", name="Shivang Shukla",              customer_type="individual", phone="9702883613", email="shivang@gmail.com",           city="Virar",     state="Maharashtra", company_id=1),
]
for c in customers:
    db.merge(c)
db.commit()
print("✅ Customers done")

# ── Vendors ───────────────────────────────────────
vendors = [
    Vendor(id=1, vendor_code="VEND0001", name="Sapphire Glass Solutions Pvt Ltd", gstin="27AASCS5707K1ZP", phone="9867543242", email="inquiry@sapphiretuff.com",  city="Navi Mumbai", state="Maharashtra", company_id=1),
    Vendor(id=2, vendor_code="VEND0002", name="Saint Gobain India",               phone="9820123456", email="info@saintgobain.com",      city="Mumbai",    state="Maharashtra", company_id=1),
    Vendor(id=3, vendor_code="VEND0003", name="Gold Plus Glass Industry",         phone="9820234567", email="info@goldplus.com",         city="Delhi",     state="Delhi",       company_id=1),
    Vendor(id=4, vendor_code="VEND0004", name="Asahi India Glass Ltd",            phone="9820345678", email="info@asahiindia.com",       city="Mumbai",    state="Maharashtra", company_id=1),
    Vendor(id=5, vendor_code="VEND0005", name="Modi Guard Glass",                 phone="9820456789", email="info@modiguard.com",        city="Pune",      state="Maharashtra", company_id=1),
]
for v in vendors:
    db.merge(v)
db.commit()
print("✅ Vendors done")

# ── Products ──────────────────────────────────────
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
print("✅ Products done")

# ── Employees ─────────────────────────────────────
employees = [
    Employee(id=1, employee_code="EMP0001", name="Fakhruddin Arsiwala", designation="Director",        department="Management", work_phone="9226205654", company_id=1),
    Employee(id=2, employee_code="EMP0002", name="Rajesh Patil",        designation="Sales Manager",   department="Sales",      work_phone="9820100001", company_id=1),
    Employee(id=3, employee_code="EMP0003", name="Priya Mehta",         designation="Accounts Manager",department="Accounts",   work_phone="9820100002", company_id=1),
    Employee(id=4, employee_code="EMP0004", name="Amit Sharma",         designation="Salesperson",     department="Sales",      work_phone="9820100003", company_id=1),
    Employee(id=5, employee_code="EMP0005", name="Husein Arsiwala",     designation="Operations",      department="Operations", work_phone="9820100004", company_id=1),
]
for e in employees:
    db.merge(e)
db.commit()
print("✅ Employees done")

# ── CRM Stages ────────────────────────────────────
stages = [
    CRMStage(id=1, name="New",         sequence=10, probability=10,  is_won=False, is_lost=False, company_id=1),
    CRMStage(id=2, name="Quote Given", sequence=20, probability=30,  is_won=False, is_lost=False, company_id=1),
    CRMStage(id=3, name="Won",         sequence=40, probability=100, is_won=True,  is_lost=False, company_id=1),
    CRMStage(id=4, name="Lost",        sequence=50, probability=0,   is_won=False, is_lost=True,  is_active=False, company_id=1),
]
for s in stages:
    db.merge(s)
db.commit()
print("✅ CRM Stages done")

# ── CRM Leads ─────────────────────────────────────
leads = [
    CRMLead(id=1,  lead_number="OPP0001", name="Home Window Glass Replacement",       stage_id=1, customer_id=1,  company_name="Patel Construction Co.",   phone="9820444444", expected_revenue=18000,  priority="low",    salesperson="Amit Sharma",  company_id=1),
    CRMLead(id=2,  lead_number="OPP0002", name="Back Painted Glass Kitchen - Agarwal",stage_id=1, customer_id=2,  company_name="Agarwal Glass Works",      phone="9820888888", expected_revenue=55000,  priority="normal", salesperson="Rajesh Patil", company_id=1),
    CRMLead(id=3,  lead_number="OPP0003", name="Laminated Glass Staircase Railing",   stage_id=1, customer_id=3,  company_name="Sunrise Developers",       phone="9820777777", expected_revenue=95000,  priority="high",   salesperson="Amit Sharma",  company_id=1),
    CRMLead(id=4,  lead_number="OPP0004", name="DGU Glass for Commercial Building",   stage_id=3, customer_id=4,  company_name="Skyline Builders Pvt Ltd", phone="9820111111", expected_revenue=185000, priority="urgent", salesperson="Rajesh Patil", company_id=1),
    CRMLead(id=5,  lead_number="OPP0005", name="Toughened Glass Balcony - Royal",     stage_id=3, customer_id=5,  company_name="Royal Furnishers",         phone="9820333333", expected_revenue=145000, priority="high",   salesperson="Amit Sharma",  company_id=1),
    CRMLead(id=6,  lead_number="OPP0006", name="Shower Partition - Om Interiors",     stage_id=3, customer_id=6,  company_name="Om Interiors & Decorators",phone="9820222222", expected_revenue=92000,  priority="normal", salesperson="Rajesh Patil", company_id=1),
    CRMLead(id=7,  lead_number="OPP0007", name="Curtain Wall Glass - Horizon Tower",  stage_id=2, customer_id=7,  company_name="Horizon Infra Projects",   phone="9821010101", expected_revenue=850000, priority="urgent", salesperson="Amit Sharma",  company_id=1),
    CRMLead(id=8,  lead_number="OPP0008", name="Float Glass Supply - Monthly Order",  stage_id=2, customer_id=8,  company_name="GlassHub Solutions",       phone="9820666666", expected_revenue=120000, priority="normal", salesperson="Rajesh Patil", company_id=1),
    CRMLead(id=9,  lead_number="OPP0009", name="Mirror Glass for Hotel Lobby",        stage_id=2, customer_id=9,  company_name="Mehta Architecture Studio",phone="9820555555", expected_revenue=75000,  priority="normal", salesperson="Amit Sharma",  company_id=1),
    CRMLead(id=10, lead_number="OPP0010", name="Office Partition Glass - Skyline HQ", stage_id=3, customer_id=4,  company_name="Skyline Builders Pvt Ltd", phone="9820111111", expected_revenue=185000, priority="high",   salesperson="Rajesh Patil", company_id=1),
]
for l in leads:
    db.merge(l)
db.commit()
print("✅ CRM Leads done")

db.close()
print("")
print("🎉 FULL SEED COMPLETE!")
print("   Companies: 4")
print("   Users:     4")
print("   Customers: 10")
print("   Vendors:   5")
print("   Products:  10")
print("   Employees: 5")
print("   CRM Stages:4")
print("   CRM Leads: 10")
