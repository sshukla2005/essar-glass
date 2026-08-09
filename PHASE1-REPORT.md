# Phase 1 Security & Data Integrity Remediation Report

**Date**: August 9, 2026  
**Target System**: Essar Glass ERP (FastAPI + React)  
**Status**: Phase 1 & Gap Closure Completed (100% Verified, 0 Financial / Margin Regressions)

---

## 1. Task Commit Log (T1 – T6 & G1 – G5)

| Task ID | Commit Hash | Summary Description |
| :--- | :--- | :--- |
| **T1** | `ed442ee` | Privilege escalation hardening & role checks in `make_crud_router` |
| **T2** | `ca9f6e6` | Prevent NULL-company records and backfill superadmin company_id |
| **T3** | `995a77a` | Soft-delete models with `is_active` to preserve code sequence integrity |
| **T4** | `36149a4` | Reorder `ReadOnlyMiddleware` before `CORSMiddleware` |
| **T5** | `4df968a` | Secrets and environment hygiene (`.env` untracking, assertions, rotation doc) |
| **T6** | `3953661` | Gate schema auto-creation behind `AUTO_CREATE_TABLES` flag |
| **Verification** | `185ae26` | Initial test suite & financial invariance baseline report |
| **G1** | `27a05e3` | Document approved spec deviation for superadmin-only user management |
| **G2** | `c1681bb` | Test role guards and sales full CRUD regression guard |
| **G3** | `3ac75fe` | Support superadmin target `company_id` for users & bypass read-only middleware for user admin |
| **G4** | `d29f46e` | Default `list_items` to active-only unless explicitly overridden |
| **G5** | `cee90a2` | Extend financial invariance check to include margin amount & margin percentage |

---

## 2. Summary of Completed Tasks & Remediations

### Task 1 & G1 — Role-Based Access Control & Privilege Escalation
- **Role Enforcement**: `/companies` write restricted to `superadmin`. `/users` read restricted to `admin`/`superadmin`, write restricted to `superadmin`.
- **Approved Spec Deviation (G1)**: User management is superadmin-only by product decision. The original spec acceptance criterion "admin creates a user with role sales → 201" is void and replaced by "admin creates a user → 403".
- **Security Guards**:
  - Non-superadmins cannot create or promote users to `superadmin` role (returns `403`).
  - Users cannot alter their own `is_active` status or `role` (returns `403`).
  - Archiving or deleting the final remaining active `superadmin` is blocked (returns `403`).

### Task 2 & G3 — NULL-Company Prevention & Cross-Company User Administration
- **Alembic Migration (`b1c2d3e4f5a6`)**: Backfilled `users.company_id` to company `1`. NULL `company_id` counts reported across business tables:
  - `customers`: **10** rows
  - `employees`: **1** row
  - `company_settings`: **4** rows
  - All other business tables: **0** NULL rows.
- **Cross-Company User Creation (G3)**:
  - `create_item` allows explicit `company_id` in request body for `POST /api/v1/users` **only** when acting user is `superadmin` and target company exists & is active. For all other roles and models, `company_id` is strictly forced from the user's active company.
  - `ReadOnlyMiddleware` permits superadmin operations on `/api/v1/users` across active company switches without granting blanket path whitelisting.

### Task 3 & G4 — Document Number Integrity & Soft-Delete Visibility
- **Soft Deletion**: `delete_item` in `make_crud_router()` soft-deletes models having an `is_active` column (`is_active = False`). `get_next_code()` scans soft-deleted records to prevent document code collisions (GST compliance).
- **Soft-Delete Visibility Audit (G4)**: Updated `list_items` in `backend/app/routers/__init__.py` to default to `is_active = True` when unparameterized (`is_active is None`).

#### G4 Frontend & API Endpoint Soft-Delete Audit Table:

| Module | Endpoint | Does Frontend Pass `is_active`? | Does List Default to Active-Only? | Current / Fixed Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Customers** | `GET /api/v1/customers` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted customers hidden by default |
| **Vendors** | `GET /api/v1/vendors` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted vendors hidden by default |
| **Products** | `GET /api/v1/products` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted products hidden by default |
| **Employees** | `GET /api/v1/employees` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted employees hidden by default |
| **Companies** | `GET /api/v1/companies` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Inactive companies hidden by default |
| **CRM Stages** | `GET /api/v1/crm/stages` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted stages hidden by default |
| **CRM Leads** | `GET /api/v1/crm/leads` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted leads hidden by default |
| **Quotations** | `GET /api/v1/quotations` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted quotations hidden by default |
| **Sales Orders** | `GET /api/v1/sales-orders` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted sales orders hidden by default |
| **Purchase Orders** | `GET /api/v1/purchase-orders` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted POs hidden by default |
| **Delivery Challans**| `GET /api/v1/delivery` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted DCs hidden by default |
| **Invoices** | `GET /api/v1/invoices` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted invoices hidden by default |
| **Inventory** | `GET /api/v1/inventory` | No | N/A (no `is_active` field) | Transactional stock movements log |
| **Workshop Orders** | `GET /api/v1/workshop` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted WOs hidden by default |
| **Toughening** | `GET /api/v1/toughening` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted batches hidden by default |
| **Process Masters** | `GET /api/v1/process-masters` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted processes hidden by default |
| **Warehouses** | `GET /api/v1/warehouses` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted warehouses hidden by default |
| **Users** | `GET /api/v1/users` | Explicitly passes `is_active='all'` in `UserManagement.jsx` | **Yes** (defaults active-only for unparameterized API) | `UserManagement.jsx` requests `is_active='all'` to allow active toggle management; unparameterized calls return active users only |
| **Payments** | `GET /api/v1/payments` | Optional (`MasterList` status filter) | **Yes** (defaults to `is_active=True`) | Soft-deleted payments hidden by default |

### Task 4 — Middleware Registration Order
- Swapped registration order in `backend/main.py` so `ReadOnlyMiddleware` is registered before `CORSMiddleware`. CORS headers are now present on `403` responses.

### Task 5 — Secrets & Environment Hygiene
- Removed hardcoded credentials from `alembic.ini`.
- Untracked `.env` and updated `.env.example`.
- Added startup assertions enforcing `len(SECRET_KEY) >= 32` and rejecting default keys. Created `backend/SECRET_ROTATION.md`.

### Task 6 — Schema Auto-Creation Gating
- Gated `Base.metadata.create_all` behind `AUTO_CREATE_TABLES` (`False` by default). Documented Alembic migration rules in `backend/readme.md`.

---

## 3. Automated Security Test Results (G2 & G3)

Automated test suite executed in `backend/tests/test_phase1_security.py`:

```
====================== 11 passed, 2 warnings in 16.23s ======================
```

| Test Function | Target Covered | Result |
| :--- | :--- | :--- |
| `test_t1_role_escalation_guard` | Non-superadmin cannot create users | **PASSED** |
| `test_t1_self_lockout_guard` | Users cannot modify own role/is_active | **PASSED** |
| `test_t2_no_active_company_context_guard` | Rejects company-scoped creates without active company | **PASSED** |
| `test_t3_soft_delete_and_code_sequence` | Soft-deletes record and preserves code sequence | **PASSED** |
| `test_t4_cors_headers_on_403_read_only` | CORS headers present on 403 ReadOnly responses | **PASSED** |
| `test_t5_secret_key_length` | Asserts `SECRET_KEY` length >= 32 and non-default | **PASSED** |
| `test_t6_auto_create_tables_setting` | Asserts `AUTO_CREATE_TABLES` defaults to `False` | **PASSED** |
| `test_g2_role_guards` | `sales` (403 on `/users`, `/companies`), `admin` (200 GET `/users`, 403 POST `/users`, 403 POST `/companies`) | **PASSED** |
| `test_g2_last_superadmin_archive_protection` | Rejects archiving last active superadmin (403); archiving 1 of 2 succeeds (200) | **PASSED** |
| `test_g2_sales_full_crud_regression_guard` | Mandatory regression guard: `sales` full CRUD on quotations, sales orders, customers, products | **PASSED** |
| `test_g3_cross_company_user_creation` | Superadmin cross-company user create (201), non-existent company (400), sales company override ignored | **PASSED** |

---

## 4. Financial & Margin Invariance Verification (G5)

Financial baseline (`PHASE1-baseline.json`) vs post-remediation capture (`PHASE1-after.json`):

```
======================================================================
      PHASE 1 FINANCIAL INVARIANCE REPORT (WITH MARGINS)
======================================================================
✅ SUCCESS: 100% INVARIANCE CONFIRMED — 0 FINANCIAL / MARGIN DIFFS DETECTED!
======================================================================
```

- **Quotations Evaluated**: 10
- **Sales Orders Evaluated**: 10
- **Fields Evaluated per Document**: `subtotal`, `total_amount`, `balance_due`, `margin_amount`, `margin_pct`, `lines_count`.
- **Total Discrepancies**: 0 (Subtotals, taxes, grand totals, margin amounts, margin percentages, and line counts remain 100% identical).

---

## 5. Migration Sanity & Database Audit (G6 & G7)

### G6 — Alembic Migration Sanity
- **Single Head Confirmation**: `alembic heads` returns exactly one head: `b1c2d3e4f5a6 (head)`.
- **Revision Chain**: `a2b3c4d5e6f7 -> b1c2d3e4f5a6 (head)`.
- **Reversibility Verification**: Executed `alembic downgrade -1` followed by `alembic upgrade head` on the database without errors or schema corruption.

### G7 — Superadmin Account Count & Flag
- **Active Superadmin Count**: **1** (`superadmin`).
- ⚠️ **FLAGGED (RISK WARNING)**: Only **1** active superadmin account currently exists in the system. Because user management is superadmin-only, if this single account loses access or is locked out, no administrative user management will be possible. Provisioning a secondary backup superadmin account is recommended during operational setup.

---

## 6. Deferred / Found But Not Fixed (Phase 2 Scoping)

The following items were identified during Phase 1 audit and analysis but deferred to Phase 2 per scope boundaries:

1. **Financial Document Immutability & Ledger Logging**: Invoices, Quotations, and Sales Orders currently permit in-place updates without writing immutable change logs or financial ledger audit entries.
2. **Database / Schema-Level Multi-Tenant Isolation**: Multi-company separation currently relies on application-level `company_id` filter conditions rather than PostgreSQL row-level security (RLS) or schema-per-tenant isolation.
3. **Pydantic V2 Class-Based `Config` Deprecation**: Legacy schema classes use class-based `Config` rather than `ConfigDict`, generating Pydantic V2 migration warnings during test runs.
4. **SQLAlchemy 2.0 `declarative_base()` Function Warning**: `app/database.py` imports legacy `declarative_base()` instead of `sqlalchemy.orm.declarative_base()`.
5. **Authentication Rate Limiting**: `/api/v1/auth/login` endpoint does not enforce rate limiting or IP throttling against brute-force attacks.
6. **JWT Algorithm Asymmetric Upgrade**: JWT signing uses symmetric `HS256` HMAC shared key rather than asymmetric `RS256` public/private key pairs.
