# Phase 2A Demo Data Seeder Verification Report

**Execution Timestamp**: 2026-08-11 23:36:11
**Database Target**: `postgresql://essar:essar_local@localhost:5433/essar_glass`

## 1. Seeded Entity Summary Table

| Entity | Essar Sons | Excel Traders | Alfa Enterprise | Alfa Lifters | Total |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `users` | 3 | 3 | 3 | 3 | **12** |
| `customers` | 6 | 6 | 6 | 6 | **24** |
| `vendors` | 3 | 3 | 3 | 3 | **12** |
| `products` | 8 | 8 | 8 | 8 | **32** |
| `employees` | 3 | 3 | 3 | 3 | **12** |
| `crm_leads` | 5 | 5 | 5 | 5 | **20** |
| `quotations` | 6 | 6 | 6 | 6 | **24** |
| `sales_orders` | 4 | 4 | 4 | 4 | **16** |
| `workshop_orders` | 2 | 2 | 2 | 2 | **8** |
| `toughening_batches` | 1 | 1 | 1 | 1 | **4** |
| `delivery_challans` | 2 | 2 | 2 | 2 | **8** |
| `invoices` | 8 | 8 | 8 | 8 | **32** |
| `payments` | 7 | 7 | 7 | 7 | **28** |
| `payment_allocations` | 7 | 7 | 7 | 7 | **28** |

---

## 2. Multi-Invoice Customer Individual Balance & amount_paid Verification

> **Defect Fix Verification**: Proves that each invoice tracks its own `amount_paid` from allocations, rather than displaying the customer's lifetime total payment.

### Company 1: Essar Sons (Customer: `DEMO Multi-Invoice Customer`)
| Invoice Number | Total Amount | Allocated Paid | Balance Due | Status | Defect Status |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `INV0001` | ₹10,000.00 | ₹10,000.00 | ₹0.00 | `paid` | ✅ Correct (Independent) |
| `INV0002` | ₹15,000.00 | ₹5,000.00 | ₹10,000.00 | `partially_paid` | ✅ Correct (Independent) |
| `INV0003` | ₹20,000.00 | ₹10,000.00 | ₹10,000.00 | `partially_paid` | ✅ Correct (Independent) |
| `INV0004` | ₹12,000.00 | ₹8,000.00 | ₹4,000.00 | `partially_paid` | ✅ Correct (Independent) |
| `INV0005` | ₹8,000.00 | ₹0.00 | ₹8,000.00 | `unpaid` | ✅ Correct (Independent) |
**Customer Lifetime Total Payments**: ₹43,000.00

### Company 2: Excel Traders (Customer: `DEMO Multi-Invoice Customer`)
| Invoice Number | Total Amount | Allocated Paid | Balance Due | Status | Defect Status |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `INV0001` | ₹10,000.00 | ₹10,000.00 | ₹0.00 | `paid` | ✅ Correct (Independent) |
| `INV0002` | ₹15,000.00 | ₹5,000.00 | ₹10,000.00 | `partially_paid` | ✅ Correct (Independent) |
| `INV0003` | ₹20,000.00 | ₹10,000.00 | ₹10,000.00 | `partially_paid` | ✅ Correct (Independent) |
| `INV0004` | ₹12,000.00 | ₹8,000.00 | ₹4,000.00 | `partially_paid` | ✅ Correct (Independent) |
| `INV0005` | ₹8,000.00 | ₹0.00 | ₹8,000.00 | `unpaid` | ✅ Correct (Independent) |
**Customer Lifetime Total Payments**: ₹43,000.00

### Company 3: Alfa Enterprise (Customer: `DEMO Multi-Invoice Customer`)
| Invoice Number | Total Amount | Allocated Paid | Balance Due | Status | Defect Status |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `INV0003` | ₹10,000.00 | ₹10,000.00 | ₹0.00 | `paid` | ✅ Correct (Independent) |
| `INV0004` | ₹15,000.00 | ₹5,000.00 | ₹10,000.00 | `partially_paid` | ✅ Correct (Independent) |
| `INV0005` | ₹20,000.00 | ₹10,000.00 | ₹10,000.00 | `partially_paid` | ✅ Correct (Independent) |
| `INV0006` | ₹12,000.00 | ₹8,000.00 | ₹4,000.00 | `partially_paid` | ✅ Correct (Independent) |
| `INV0007` | ₹8,000.00 | ₹0.00 | ₹8,000.00 | `unpaid` | ✅ Correct (Independent) |
**Customer Lifetime Total Payments**: ₹43,000.00

### Company 4: Alfa Lifters (Customer: `DEMO Multi-Invoice Customer`)
| Invoice Number | Total Amount | Allocated Paid | Balance Due | Status | Defect Status |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `INV0003` | ₹10,000.00 | ₹10,000.00 | ₹0.00 | `paid` | ✅ Correct (Independent) |
| `INV0004` | ₹15,000.00 | ₹5,000.00 | ₹10,000.00 | `partially_paid` | ✅ Correct (Independent) |
| `INV0005` | ₹20,000.00 | ₹10,000.00 | ₹10,000.00 | `partially_paid` | ✅ Correct (Independent) |
| `INV0006` | ₹12,000.00 | ₹8,000.00 | ₹4,000.00 | `partially_paid` | ✅ Correct (Independent) |
| `INV0007` | ₹8,000.00 | ₹0.00 | ₹8,000.00 | `unpaid` | ✅ Correct (Independent) |
**Customer Lifetime Total Payments**: ₹43,000.00

---

## 3. Financial Equation Verification per Company

`sum(payments) == sum(allocations) + sum(on-account)`

| Company | Total Payments | Total Allocations | Total On-Account | Equation Verified |
| :--- | :---: | :---: | :---: | :---: |
| Essar Sons | ₹50,000.00 | ₹40,000.00 | ₹10,000.00 | ✅ PASS |
| Excel Traders | ₹50,000.00 | ₹40,000.00 | ₹10,000.00 | ✅ PASS |
| Alfa Enterprise | ₹50,000.00 | ₹40,000.00 | ₹10,000.00 | ✅ PASS |
| Alfa Lifters | ₹50,000.00 | ₹40,000.00 | ₹10,000.00 | ✅ PASS |

---

## 4. Invoice Allocation Integrity

`amount_paid == sum(its allocations)` and `balance_due == total_amount - amount_paid`

- **Result**: ✅ PASS — All demo invoices match exact allocation sums

---

## 5. Dashboard Receivables Summary API Verification

| Company | Total Billed | Total Collected | Outstanding | On-Account | API vs DB Match |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Essar Sons | ₹122,000.00 | ₹40,000.00 | ₹82,000.00 | ₹10,000.00 | ✅ PASS |
| Excel Traders | ₹122,000.00 | ₹40,000.00 | ₹82,000.00 | ₹10,000.00 | ✅ PASS |
| Alfa Enterprise | ₹122,000.00 | ₹40,000.00 | ₹82,000.00 | ₹10,000.00 | ✅ PASS |
| Alfa Lifters | ₹122,000.00 | ₹40,000.00 | ₹82,000.00 | ₹10,000.00 | ✅ PASS |

---

## 6. Ageing Buckets Distribution

Verifies that invoice dates span all four ageing bands (0–30, 31–60, 61–90, 90+ days).

| Ageing Band | Invoices Count | Band Status |
| :--- | :---: | :--- |
| `0-30 days` | 12 | ✅ Populated |
| `31-60 days` | 8 | ✅ Populated |
| `61-90 days` | 4 | ✅ Populated |
| `90+ days` | 8 | ✅ Populated |

---

## 7. Company Isolation & User Access Scoping Verification

- **Own-Scoped User (Sales A)** Sees: `10` Quotations
- **Company-Scoped User (Sales B)** Sees: `14` Quotations
- **Security Scoping Status**: ✅ PASS

---

## 8. Financial Invariance Script Execution (verify_phase1_invariance.py)

```
======================================================================
      PHASE 1 FINANCIAL INVARIANCE REPORT (WITH MARGINS)
======================================================================
✅ SUCCESS: 100% INVARIANCE CONFIRMED — 0 FINANCIAL / MARGIN DIFFS DETECTED!
======================================================================
```

✅ **Invariance Status**: PASS (0 diffs on baseline 10 quotes & 10 SOs)

---

## 9. Notes & Limitations

> [!NOTE]
> Seeded quotation totals in this script are pre-calculated values passed directly to the backend API rather than computed through the browser frontend `quotationCalc.js` engine. This seeder validates backend accounting, payment allocations, company isolation, and security scoping, but does not validate client-side glass pricing calculation engines.
