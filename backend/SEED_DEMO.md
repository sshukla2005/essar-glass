# ESSAR GLASS ERP — DEMO DATA SEEDER & TEARDOWN GUIDE

This directory contains the automated, API-driven demo data seeder (`seed_demo.py`) and safety-enforced teardown script (`seed_demo_teardown.py`) for the Essar Glass ERP system.

---

## 1. Safety Guardrails & Non-Negotiables

To protect staging and production environments, both scripts strictly enforce the following safety rules:

1. **Local-Only Execution**: Aborts immediately with a loud error unless `DATABASE_URL` resolves to `localhost` or `127.0.0.1`.
2. **Explicit Confirmation**: Requires the `--yes-i-mean-it` flag to execute.
3. **API-Driven Seeding**: All demo entities are created strictly through the running FastAPI HTTP endpoints (`http://localhost:8000/api/v1/...`) using authentic JWT tokens. Direct SQL inserts are prohibited for seeding.
4. **Distinct Tagging & Removability**: All seeded records carry a marker: `notes` / `customer_notes` begin with `[DEMO]`, names are prefixed `DEMO `, and usernames are prefixed `demo_`.
5. **Additive Only**: Real records (such as existing orders in Alfa Lifters or Essar Sons) are left completely untouched.

---

## 2. Environment Setup

Set the demo password environment variable before running:

```bash
export DEMO_USER_PASSWORD="YourSecurePassword123!"
```

If `DEMO_USER_PASSWORD` is not explicitly set, the scripts fall back to `SEED_SUPERADMIN_PASSWORD` or `SUPERADMIN_PASSWORD`.

---

## 3. Running the Seeder

Ensure the FastAPI server is running locally on port 8000:

```bash
# Terminal 1: Start backend server (if not already running)
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Run the seeder:

```bash
# Terminal 2: Execute demo data seeder
cd backend
python seed_demo.py --yes-i-mean-it
```

### Reset / Re-seed Mode

To purge existing demo records and re-seed from scratch in one command:

```bash
python seed_demo.py --yes-i-mean-it --reset
```

If `[DEMO]` records already exist in the database and `--reset` is **not** passed, `seed_demo.py` will skip execution to prevent double-seeding.

---

## 4. Running the Teardown Script

To safely purge all demo records in reverse dependency order (`allocations` -> `payments` -> `invoices` -> `delivery_challans` -> `toughening_batches` -> `workshop_orders` -> `sales_orders` -> `quotations` -> `crm_leads` -> `masters` -> `users`):

```bash
python seed_demo_teardown.py --yes-i-mean-it
```

---

## 5. Seeded Inventory per Company

When executed, `seed_demo.py` creates records across all four companies (**Essar Sons**, **Excel Traders**, **Alfa Enterprise**, **Alfa Lifters**):

| Entity | Per Company | Total (4 Companies) | Key Characteristics |
| :--- | :---: | :---: | :--- |
| **Users** | 3 | 12 | 2 Sales users (User A `own` scope, User B `company` scope) + 1 Accounts user |
| **Customers** | 6 | 24 | 1 Multi-Invoice customer, 3 local customers, 2 inter-state customers (Gujarat, Delhi) |
| **Vendors** | 3 | 12 | Float glass and processing suppliers |
| **Products** | 8 | 32 | Clear 5/6/8/10mm, Xtra Clear 12mm, Tinted 6/8mm, Grey Mirror 5mm |
| **Employees** | 3 | 12 | Sales, Accounts, Operations personnel |
| **CRM Leads** | 5 | 20 | Mixed stages (New, Quote Given, Won) split between User A & User B |
| **Quotations** | 6 | 24 | Includes Toughened, CEP Polish, HW/Labour/Wastage, and Process Rate Card quotes |
| **Sales Orders** | 4 | 16 | Converted from quotations |
| **Workshop Orders** | 2 | 8 | Linked to Sales Orders (1 in-progress, 1 completed) |
| **Toughening Batches** | 1 | 4 | Partially received state (`qty_sent` = 10, `qty_received` = 6) |
| **Delivery Challans** | 2 | 8 | Vehicle and driver details assigned |
| **Invoices** | 8 | 32 | 5 for Multi-Invoice Customer, 3 for other customers (includes unpaid & advance) |
| **Payments** | 7 | 28 | Covers allocation test cases 1–5 |
| **Allocations** | 5 | 20 | Invoice-specific payment allocations |

---

## 6. Payment Allocation Edge Cases Evaluated

The seeder automatically tests and asserts the following 8 Phase 2A financial edge cases per company:

1. **Case 1 (Full Payment)**: ₹10,000 payment fully settles Invoice 1 (`balance_due` becomes ₹0).
2. **Case 2 (Split Allocation)**: ₹20,000 payment split across Invoice 2 (₹5,000) and Invoice 3 (₹10,000), leaving ₹5,000 on-account credit.
3. **Case 3 (Partial Payment)**: ₹3,000 payment allocated to Invoice 4 (reduces `balance_due`).
4. **Case 4 (On-Account Payment)**: ₹5,000 payment with zero allocations (increases customer credit).
5. **Case 5 (Multi-Payment Allocation)**: Two separate payments (₹2,000 + ₹3,000) allocated to Invoice 4.
6. **Case 6 (Over-Allocation Rejection)**: Attempts allocating ₹10,000 to an invoice with ₹8,000 balance -> **Asserts HTTP 400**.
7. **Case 7 (Cross-Customer Rejection)**: Attempts allocating Customer A's payment to Customer B's invoice -> **Asserts HTTP 400**.
8. **Case 8 (Cross-Company Rejection)**: Attempts allocating Company 1's payment to Company 2's invoice -> **Asserts HTTP 400**.

---

## 7. Verification Artifact

Every execution of `seed_demo.py` automatically generates a comprehensive verification report in `SEED-DEMO-REPORT.md` at the project root, covering financial equations, ageing band distributions, company isolation, user scoping, and Phase 1 invariance results.
