import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './queryClient'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ConfigProvider, theme, App as AntApp } from 'antd'
import AppLayout from './components/Layout/AppLayout'
import { settingsApi } from './api/settingsApi'

// ── Company ───────────────────────────────────────────────────────────────────
import CompanyList from './pages/masters/company/CompanyList'
import CompanyForm from './pages/masters/company/CompanyForm'

// ── Branch ────────────────────────────────────────────────────────────────────
import { BranchList } from './pages/masters/branch/BranchList'
import BranchForm    from './pages/masters/branch/BranchForm'

// ── Currency ──────────────────────────────────────────────────────────────────
import { CurrencyList } from './pages/masters/currency/CurrencyList'
import CurrencyForm     from './pages/masters/currency/CurrencyForm'

// ── UoM ───────────────────────────────────────────────────────────────────────
import { UomList, UomCategoryList }   from './pages/masters/uom/UomList'
import UomForm, { UomCategoryForm }   from './pages/masters/uom/UomForm'

// ── Tax ───────────────────────────────────────────────────────────────────────
import { TaxList, TaxGroupList }   from './pages/masters/tax/TaxList'
import TaxForm, { TaxGroupForm }   from './pages/masters/tax/TaxForm'

// ── HSN ───────────────────────────────────────────────────────────────────────
import { HsnList } from './pages/masters/hsn/HsnList'
import HsnForm     from './pages/masters/hsn/HsnForm'

// ── Customer ──────────────────────────────────────────────────────────────────
import CustomerList from './pages/masters/customer/CustomerList'
import CustomerForm from './pages/masters/customer/CustomerForm'

// ── Vendor ────────────────────────────────────────────────────────────────────
import VendorList from './pages/masters/vendor/VendorList'
import VendorForm from './pages/masters/vendor/VendorForm'

// ── Product ───────────────────────────────────────────────────────────────────
import ProductList from './pages/masters/product/ProductList'
import ProductForm from './pages/masters/product/ProductForm'

// ── Employee ──────────────────────────────────────────────────────────────────
import EmployeeList from './pages/masters/employee/EmployeeList'
import EmployeeForm from './pages/masters/employee/EmployeeForm'

// ── CRM ───────────────────────────────────────────────────────────────────────
import Pipeline  from './pages/crm/Pipeline'
import LeadList  from './pages/crm/LeadList'
import LeadForm  from './pages/crm/LeadForm'
import StageList from './pages/crm/StageList'
import StageForm from './pages/crm/StageForm'

// ── Quotations ────────────────────────────────────────────────────────────────
import QuotationList from './pages/quotations/QuotationList'
import QuotationForm from './pages/quotations/QuotationForm'

// ── Settings ──────────────────────────────────────────────────────────────────
import CompanyInfo from './pages/settings/CompanyInfo'
import GlassCalcSettings from './pages/settings/GlassCalcSettings'
import GlassRateMatrix from './pages/settings/GlassRateMatrix'
import GlassDropdownSettings from './pages/settings/GlassDropdownSettings'
import ProcessMasterList from './pages/settings/ProcessMasterList'
import ProcessMasterForm from './pages/settings/ProcessMasterForm'
import UomRateMaster from './pages/settings/UomRateMaster'
import AISettings from './pages/settings/AISettings'

// ── Workshop ──────────────────────────────────────────────────────────────────
import WorkshopOrderList from './pages/workshop/WorkshopOrderList'
import WorkshopOrderForm from './pages/workshop/WorkshopOrderForm'
import TougheningList from './pages/workshop/TougheningList'
import TougheningForm from './pages/workshop/TougheningForm'

// ── Auth ──────────────────────────────────────────────────────────────────────
import LoginPage from './pages/auth/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'

// ── Dashboard ─────────────────────────────────────────────────────────────────
import Dashboard from './pages/Dashboard'

// ── Super Admin ───────────────────────────────────────────────────────────────
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import UserManagement from './pages/super/UserManagement'

// ── Sales ─────────────────────────────────────────────────────────────────────
import SalesOrderList from './pages/sales/SalesOrderList'
import SalesOrderForm from './pages/sales/SalesOrderForm'

// ── Purchase ──────────────────────────────────────────────────────────────────
import PurchaseOrderList from './pages/purchase/PurchaseOrderList'
import PurchaseOrderForm from './pages/purchase/PurchaseOrderForm'

// ── Inventory / Delivery ──────────────────────────────────────────────────────
import DeliveryChallanList from './pages/delivery/DeliveryChallanList'
import DeliveryChallanForm from './pages/delivery/DeliveryChallanForm'
import StockOverview from './pages/inventory/StockOverview'
import StockMovements from './pages/inventory/StockMovements'

// ── Invoices ──────────────────────────────────────────────────────────────────
import InvoiceDashboard from './pages/invoices/InvoiceDashboard'
import InvoiceForm from './pages/invoices/InvoiceForm'
import CustomerLedger from './pages/invoices/CustomerLedger'
import PaymentAccounts from './pages/settings/PaymentAccounts'

// ── Reports ───────────────────────────────────────────────────────────────────
import SalesPerformance from './pages/reports/SalesPerformance'


const fixFarma = () => {
  try {
    const pm = JSON.parse(
      localStorage.getItem('process_masters') || '[]'
    )
    const updated = pm.map(p =>
      p.name === 'Forma / Template'
        ? { ...p, name: 'Farma / Template' }
        : p
    )
    localStorage.setItem('process_masters', JSON.stringify(updated))
  } catch {}
}
fixFarma()

const App = () => {
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      settingsApi.migrateFromLocalStorage()
      // Mirror process masters (backend = source of truth) into localStorage.
      // The shared calc engine (quotationCalc.js) reads toughening/process
      // rates from localStorage — without this mirror, a fresh machine or
      // cleared browser computes toughened quotations with a ZERO addon.
      import('./api').then(({ processMasterApi, companyApi }) => {
        processMasterApi.dropdown()
          .then(r => {
            const list = Array.isArray(r.data) ? r.data : (r.data?.items || [])
            if (Array.isArray(list) && list.length) {
              localStorage.setItem('process_masters', JSON.stringify(list))
            }
          })
          .catch(() => {})
        // Companies mirror — PDF letterhead (getCompany) reads companies_master
        // from localStorage; keep it fresh from the backend on every boot so
        // edits made on any machine reach every machine's PDFs.
        companyApi.dropdown()
          .then(r => {
            const list = Array.isArray(r.data) ? r.data : (r.data?.items || [])
            if (Array.isArray(list) && list.length) {
              localStorage.setItem('companies_master', JSON.stringify(list))
            }
          })
          .catch(() => {})
      })
    }
  }, [])

  return (
  <QueryClientProvider client={queryClient}>
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary:   '#1677ff',
          borderRadius:    6,
          fontFamily:     '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/super-dashboard" element={<ProtectedRoute requiredRole="superadmin"><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/super/users" element={<ProtectedRoute requiredRole="superadmin"><UserManagement /></ProtectedRoute>} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />

            {/* ── CRM ────────────────────────────────────────────────── */}
            <Route path="crm/pipeline"       element={<ProtectedRoute module="pipeline"><Pipeline /></ProtectedRoute>} />
            <Route path="crm/leads"          element={<ProtectedRoute module="leads"><LeadList /></ProtectedRoute>} />
            <Route path="crm/leads/new"      element={<ProtectedRoute module="leads"><LeadForm /></ProtectedRoute>} />
            <Route path="crm/leads/:id/edit" element={<ProtectedRoute module="leads"><LeadForm /></ProtectedRoute>} />
            <Route path="crm/stages"         element={<ProtectedRoute module="stages"><StageList /></ProtectedRoute>} />
            <Route path="crm/stages/new"     element={<ProtectedRoute module="stages"><StageForm /></ProtectedRoute>} />
            <Route path="crm/stages/:id/edit" element={<ProtectedRoute module="stages"><StageForm /></ProtectedRoute>} />

            {/* ── Quotations ─────────────────────────────────────────── */}
            <Route path="quotations"           element={<ProtectedRoute module="quotations"><QuotationList /></ProtectedRoute>} />
            <Route path="quotations/new"       element={<ProtectedRoute module="quotations"><QuotationForm /></ProtectedRoute>} />
            <Route path="quotations/:id/edit"  element={<ProtectedRoute module="quotations"><QuotationForm /></ProtectedRoute>} />

            {/* ── Sales ──────────────────────────────────────────────── */}
            <Route path="sales-orders"              element={<ProtectedRoute module="sales_orders"><SalesOrderList /></ProtectedRoute>} />
            <Route path="sales-orders/new"          element={<ProtectedRoute module="sales_orders"><SalesOrderForm /></ProtectedRoute>} />
            <Route path="sales-orders/:id/edit"     element={<ProtectedRoute module="sales_orders"><SalesOrderForm /></ProtectedRoute>} />

            {/* ── Purchase ───────────────────────────────────────────── */}
            <Route path="purchase-orders"           element={<ProtectedRoute module="purchase_orders"><PurchaseOrderList /></ProtectedRoute>} />
            <Route path="purchase-orders/new"       element={<ProtectedRoute module="purchase_orders"><PurchaseOrderForm /></ProtectedRoute>} />
            <Route path="purchase-orders/:id/edit"  element={<ProtectedRoute module="purchase_orders"><PurchaseOrderForm /></ProtectedRoute>} />

            {/* ── Inventory ──────────────────────────────────────────── */}
            <Route path="inventory/stock"           element={<ProtectedRoute module="stock"><StockOverview /></ProtectedRoute>} />
            <Route path="inventory/movements"       element={<ProtectedRoute module="stock_movements"><StockMovements /></ProtectedRoute>} />
            <Route path="delivery-challans"         element={<ProtectedRoute module="delivery_challans"><DeliveryChallanList /></ProtectedRoute>} />
            <Route path="delivery-challans/new"     element={<ProtectedRoute module="delivery_challans"><DeliveryChallanForm /></ProtectedRoute>} />
            <Route path="delivery-challans/:id/edit" element={<ProtectedRoute module="delivery_challans"><DeliveryChallanForm /></ProtectedRoute>} />

            {/* ── Invoices ───────────────────────────────────────────── */}
            <Route path="invoices"                        element={<ProtectedRoute module="invoices"><InvoiceDashboard /></ProtectedRoute>} />
            <Route path="invoices/new"                    element={<ProtectedRoute module="invoices"><InvoiceForm /></ProtectedRoute>} />
            <Route path="invoices/:id/edit"               element={<ProtectedRoute module="invoices"><InvoiceForm /></ProtectedRoute>} />
            <Route path="invoices/customer/:customerId"   element={<ProtectedRoute module="invoices"><CustomerLedger /></ProtectedRoute>} />

            {/* ── Masters: Customers ──────────────────────────────────── */}
            <Route path="masters/customers"          element={<ProtectedRoute module="customers"><CustomerList /></ProtectedRoute>} />
            <Route path="masters/customers/new"      element={<ProtectedRoute module="customers"><CustomerForm /></ProtectedRoute>} />
            <Route path="masters/customers/:id/edit" element={<ProtectedRoute module="customers"><CustomerForm /></ProtectedRoute>} />

            {/* ── Masters: Vendors ────────────────────────────────────── */}
            <Route path="masters/vendors"          element={<ProtectedRoute module="vendors"><VendorList /></ProtectedRoute>} />
            <Route path="masters/vendors/new"      element={<ProtectedRoute module="vendors"><VendorForm /></ProtectedRoute>} />
            <Route path="masters/vendors/:id/edit" element={<ProtectedRoute module="vendors"><VendorForm /></ProtectedRoute>} />

            {/* ── Masters: Products ───────────────────────────────────── */}
            <Route path="masters/products"          element={<ProtectedRoute module="products"><ProductList /></ProtectedRoute>} />
            <Route path="masters/products/new"      element={<ProtectedRoute module="products"><ProductForm /></ProtectedRoute>} />
            <Route path="masters/products/:id/edit" element={<ProtectedRoute module="products"><ProductForm /></ProtectedRoute>} />

            {/* ── Masters: Employees ──────────────────────────────────── */}
            <Route path="masters/employees"          element={<ProtectedRoute module="employees"><EmployeeList /></ProtectedRoute>} />
            <Route path="masters/employees/new"      element={<ProtectedRoute module="employees"><EmployeeForm /></ProtectedRoute>} />
            <Route path="masters/employees/:id/edit" element={<ProtectedRoute module="employees"><EmployeeForm /></ProtectedRoute>} />

            {/* ── Masters: UoMs ───────────────────────────────────────── */}
            <Route path="masters/uoms"           element={<ProtectedRoute module="uoms"><UomList /></ProtectedRoute>} />
            <Route path="masters/uoms/new"       element={<ProtectedRoute module="uoms"><UomForm /></ProtectedRoute>} />
            <Route path="masters/uoms/:id/edit"  element={<ProtectedRoute module="uoms"><UomForm /></ProtectedRoute>} />

            {/* ── Masters: Taxes ──────────────────────────────────────── */}
            <Route path="masters/taxes"           element={<ProtectedRoute module="taxes"><TaxList /></ProtectedRoute>} />
            <Route path="masters/taxes/new"       element={<ProtectedRoute module="taxes"><TaxForm /></ProtectedRoute>} />
            <Route path="masters/taxes/:id/edit"  element={<ProtectedRoute module="taxes"><TaxForm /></ProtectedRoute>} />

            {/* ── Masters: HSN / SAC Codes ────────────────────────────── */}
            <Route path="masters/hsn-codes"           element={<ProtectedRoute module="hsn_codes"><HsnList /></ProtectedRoute>} />
            <Route path="masters/hsn-codes/new"       element={<ProtectedRoute module="hsn_codes"><HsnForm /></ProtectedRoute>} />
            <Route path="masters/hsn-codes/:id/edit"  element={<ProtectedRoute module="hsn_codes"><HsnForm /></ProtectedRoute>} />

            {/* ── Settings: Company ───────────────────────────────────── */}
            <Route path="settings/company" element={<ProtectedRoute module="company"><CompanyInfo /></ProtectedRoute>} />
            <Route path="settings/ai" element={<ProtectedRoute module="ai"><AISettings /></ProtectedRoute>} />
            <Route path="settings/glass-calc" element={<ProtectedRoute module="glass_calc"><GlassCalcSettings /></ProtectedRoute>} />
            <Route path="settings/glass-rate-matrix" element={<ProtectedRoute module="glass_rate_matrix"><GlassRateMatrix /></ProtectedRoute>} />
            <Route path="settings/glass-dropdowns" element={<ProtectedRoute module="glass_dropdowns"><GlassDropdownSettings /></ProtectedRoute>} />
            <Route path="settings/uom-rates" element={<ProtectedRoute module="uom_rates"><UomRateMaster /></ProtectedRoute>} />

            {/* ── Settings: Branches ──────────────────────────────────── */}
            <Route path="settings/branches"           element={<ProtectedRoute module="branches"><BranchList /></ProtectedRoute>} />
            <Route path="settings/branches/new"       element={<ProtectedRoute module="branches"><BranchForm /></ProtectedRoute>} />
            <Route path="settings/branches/:id/edit"  element={<ProtectedRoute module="branches"><BranchForm /></ProtectedRoute>} />

            {/* ── Settings: Currencies ────────────────────────────────── */}
            <Route path="settings/currencies"           element={<ProtectedRoute module="currencies"><CurrencyList /></ProtectedRoute>} />
            <Route path="settings/currencies/new"       element={<ProtectedRoute module="currencies"><CurrencyForm /></ProtectedRoute>} />
            <Route path="settings/currencies/:id/edit"  element={<ProtectedRoute module="currencies"><CurrencyForm /></ProtectedRoute>} />

            {/* ── Settings: Tax Groups ────────────────────────────────── */}
            <Route path="settings/tax-groups"           element={<ProtectedRoute module="tax_groups"><TaxGroupList /></ProtectedRoute>} />
            <Route path="settings/tax-groups/new"       element={<ProtectedRoute module="tax_groups"><TaxGroupForm /></ProtectedRoute>} />
            <Route path="settings/tax-groups/:id/edit"  element={<ProtectedRoute module="tax_groups"><TaxGroupForm /></ProtectedRoute>} />

            {/* ── Settings: UoM Categories ────────────────────────────── */}
            <Route path="settings/uom-categories"           element={<ProtectedRoute module="uom_categories"><UomCategoryList /></ProtectedRoute>} />
            <Route path="settings/uom-categories/new"       element={<ProtectedRoute module="uom_categories"><UomCategoryForm /></ProtectedRoute>} />
            <Route path="settings/uom-categories/:id/edit"  element={<ProtectedRoute module="uom_categories"><UomCategoryForm /></ProtectedRoute>} />

            {/* ── Workshop ──────────────────────────────────────────── */}
            <Route path="workshop/orders"              element={<ProtectedRoute module="workshop_orders"><WorkshopOrderList /></ProtectedRoute>} />
            <Route path="workshop/orders/new"          element={<ProtectedRoute module="workshop_orders"><WorkshopOrderForm /></ProtectedRoute>} />
            <Route path="workshop/orders/:id/edit"     element={<ProtectedRoute module="workshop_orders"><WorkshopOrderForm /></ProtectedRoute>} />
            <Route path="workshop/toughening"          element={<ProtectedRoute module="toughening"><TougheningList /></ProtectedRoute>} />
            <Route path="workshop/toughening/new"      element={<ProtectedRoute module="toughening"><TougheningForm /></ProtectedRoute>} />
            <Route path="workshop/toughening/:id/edit" element={<ProtectedRoute module="toughening"><TougheningForm /></ProtectedRoute>} />

            {/* ── Settings: Process Masters ─────────────────────────── */}
            <Route path="settings/process-masters"           element={<ProtectedRoute module="process_masters"><ProcessMasterList /></ProtectedRoute>} />
            <Route path="settings/payment-accounts"          element={<ProtectedRoute module="payment_accounts"><PaymentAccounts /></ProtectedRoute>} />
            <Route path="settings/process-masters/new"       element={<ProtectedRoute module="process_masters"><ProcessMasterForm /></ProtectedRoute>} />
            <Route path="settings/process-masters/:id/edit"  element={<ProtectedRoute module="process_masters"><ProcessMasterForm /></ProtectedRoute>} />

            {/* ── Reports ─────────────────────────────────────────────── */}
            <Route path="reports/sales-performance" element={<ProtectedRoute module="sales_performance"><SalesPerformance /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </AntApp>
    </ConfigProvider>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
  )
}

export default App

