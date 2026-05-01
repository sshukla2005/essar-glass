import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ConfigProvider, theme, App as AntApp } from 'antd'
import AppLayout from './components/Layout/AppLayout'

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

// ── Auth ──────────────────────────────────────────────────────────────────────
import LoginPage from './pages/auth/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'

// ── Dashboard ─────────────────────────────────────────────────────────────────
import Dashboard from './pages/Dashboard'

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
import InvoiceList from './pages/invoices/InvoiceList'
import InvoiceForm from './pages/invoices/InvoiceForm'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:              1,
      staleTime:          30_000,
      refetchOnWindowFocus: false,
    },
  },
})

const App = () => (
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
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />

            {/* ── CRM ────────────────────────────────────────────────── */}
            <Route path="crm/pipeline"       element={<Pipeline />} />
            <Route path="crm/leads"          element={<LeadList />} />
            <Route path="crm/leads/new"      element={<LeadForm />} />
            <Route path="crm/leads/:id/edit" element={<LeadForm />} />
            <Route path="crm/stages"         element={<StageList />} />
            <Route path="crm/stages/new"     element={<StageForm />} />
            <Route path="crm/stages/:id/edit" element={<StageForm />} />

            {/* ── Quotations ─────────────────────────────────────────── */}
            <Route path="quotations"           element={<QuotationList />} />
            <Route path="quotations/new"       element={<QuotationForm />} />
            <Route path="quotations/:id/edit"  element={<QuotationForm />} />

            {/* ── Sales ──────────────────────────────────────────────── */}
            <Route path="sales-orders"              element={<SalesOrderList />} />
            <Route path="sales-orders/new"          element={<SalesOrderForm />} />
            <Route path="sales-orders/:id/edit"     element={<SalesOrderForm />} />

            {/* ── Purchase ───────────────────────────────────────────── */}
            <Route path="purchase-orders"           element={<PurchaseOrderList />} />
            <Route path="purchase-orders/new"       element={<PurchaseOrderForm />} />
            <Route path="purchase-orders/:id/edit"  element={<PurchaseOrderForm />} />

            {/* ── Inventory ──────────────────────────────────────────── */}
            <Route path="inventory/stock"           element={<StockOverview />} />
            <Route path="inventory/movements"       element={<StockMovements />} />
            <Route path="delivery-challans"         element={<DeliveryChallanList />} />
            <Route path="delivery-challans/new"     element={<DeliveryChallanForm />} />
            <Route path="delivery-challans/:id/edit" element={<DeliveryChallanForm />} />

            {/* ── Invoices ───────────────────────────────────────────── */}
            <Route path="invoices"                  element={<InvoiceList />} />
            <Route path="invoices/new"              element={<InvoiceForm />} />
            <Route path="invoices/:id/edit"         element={<InvoiceForm />} />

            {/* ── Masters: Customers ──────────────────────────────────── */}
            <Route path="masters/customers"          element={<CustomerList />} />
            <Route path="masters/customers/new"      element={<CustomerForm />} />
            <Route path="masters/customers/:id/edit" element={<CustomerForm />} />

            {/* ── Masters: Vendors ────────────────────────────────────── */}
            <Route path="masters/vendors"          element={<VendorList />} />
            <Route path="masters/vendors/new"      element={<VendorForm />} />
            <Route path="masters/vendors/:id/edit" element={<VendorForm />} />

            {/* ── Masters: Products ───────────────────────────────────── */}
            <Route path="masters/products"          element={<ProductList />} />
            <Route path="masters/products/new"      element={<ProductForm />} />
            <Route path="masters/products/:id/edit" element={<ProductForm />} />

            {/* ── Masters: Employees ──────────────────────────────────── */}
            <Route path="masters/employees"          element={<EmployeeList />} />
            <Route path="masters/employees/new"      element={<EmployeeForm />} />
            <Route path="masters/employees/:id/edit" element={<EmployeeForm />} />

            {/* ── Masters: UoMs ───────────────────────────────────────── */}
            <Route path="masters/uoms"           element={<UomList />} />
            <Route path="masters/uoms/new"       element={<UomForm />} />
            <Route path="masters/uoms/:id/edit"  element={<UomForm />} />

            {/* ── Masters: Taxes ──────────────────────────────────────── */}
            <Route path="masters/taxes"           element={<TaxList />} />
            <Route path="masters/taxes/new"       element={<TaxForm />} />
            <Route path="masters/taxes/:id/edit"  element={<TaxForm />} />

            {/* ── Masters: HSN / SAC Codes ────────────────────────────── */}
            <Route path="masters/hsn-codes"           element={<HsnList />} />
            <Route path="masters/hsn-codes/new"       element={<HsnForm />} />
            <Route path="masters/hsn-codes/:id/edit"  element={<HsnForm />} />

            {/* ── Settings: Company ───────────────────────────────────── */}
            <Route path="settings/company" element={<CompanyInfo />} />

            {/* ── Settings: Branches ──────────────────────────────────── */}
            <Route path="settings/branches"           element={<BranchList />} />
            <Route path="settings/branches/new"       element={<BranchForm />} />
            <Route path="settings/branches/:id/edit"  element={<BranchForm />} />

            {/* ── Settings: Currencies ────────────────────────────────── */}
            <Route path="settings/currencies"           element={<CurrencyList />} />
            <Route path="settings/currencies/new"       element={<CurrencyForm />} />
            <Route path="settings/currencies/:id/edit"  element={<CurrencyForm />} />

            {/* ── Settings: Tax Groups ────────────────────────────────── */}
            <Route path="settings/tax-groups"           element={<TaxGroupList />} />
            <Route path="settings/tax-groups/new"       element={<TaxGroupForm />} />
            <Route path="settings/tax-groups/:id/edit"  element={<TaxGroupForm />} />

            {/* ── Settings: UoM Categories ────────────────────────────── */}
            <Route path="settings/uom-categories"           element={<UomCategoryList />} />
            <Route path="settings/uom-categories/new"       element={<UomCategoryForm />} />
            <Route path="settings/uom-categories/:id/edit"  element={<UomCategoryForm />} />

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

export default App
