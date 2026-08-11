/**
 * Single source of truth for Application Modules & Permissions.
 * Used by navigation menu, route guards, and User Management permission editor.
 */

export const MODULE_SECTIONS = [
  { key: 'crm', label: 'CRM', icon: 'TeamOutlined' },
  { key: 'sales', label: 'Sales', icon: 'FileTextOutlined' },
  { key: 'purchase', label: 'Purchase', icon: 'ShoppingCartOutlined' },
  { key: 'inventory', label: 'Inventory', icon: 'DatabaseOutlined' },
  { key: 'workshop', label: 'Workshop', icon: 'ToolOutlined' },
  { key: 'reports', label: 'Reports', icon: 'BarChartOutlined' },
  { key: 'masters', label: 'Masters', icon: 'ReconciliationOutlined' },
  { key: 'settings', label: 'Settings', icon: 'SettingOutlined' },
]

export const MODULES = [
  // ── CRM ──────────────────────────────────────────────────────────────────────
  { key: 'pipeline',         label: 'Pipeline',            section: 'crm',       route: '/crm/pipeline' },
  { key: 'leads',            label: 'All Leads',           section: 'crm',       route: '/crm/leads' },
  { key: 'stages',           label: 'Stages',              section: 'crm',       route: '/crm/stages' },

  // ── Sales ────────────────────────────────────────────────────────────────────
  { key: 'quotations',       label: 'Quotations',          section: 'sales',     route: '/quotations' },
  { key: 'sales_orders',     label: 'Sales Orders',        section: 'sales',     route: '/sales-orders' },
  { key: 'invoices',         label: 'Invoices',            section: 'sales',     route: '/invoices' },

  // ── Purchase ─────────────────────────────────────────────────────────────────
  { key: 'purchase_orders',  label: 'Purchase Orders',     section: 'purchase',  route: '/purchase-orders' },

  // ── Inventory ────────────────────────────────────────────────────────────────
  { key: 'stock',            label: 'Stock Overview',      section: 'inventory', route: '/inventory/stock' },
  { key: 'delivery_challans', label: 'Delivery Challans',  section: 'inventory', route: '/delivery-challans' },
  { key: 'stock_movements',  label: 'Stock Movements',     section: 'inventory', route: '/inventory/movements' },

  // ── Workshop ─────────────────────────────────────────────────────────────────
  { key: 'workshop_orders',  label: 'Workshop Orders',     section: 'workshop',  route: '/workshop/orders' },
  { key: 'toughening',       label: 'Toughening',          section: 'workshop',  route: '/workshop/toughening' },

  // ── Reports ──────────────────────────────────────────────────────────────────
  { key: 'sales_performance', label: 'Sales Performance',  section: 'reports',   route: '/reports/sales-performance' },

  // ── Masters ──────────────────────────────────────────────────────────────────
  { key: 'customers',        label: 'Customers',           section: 'masters',   route: '/masters/customers' },
  { key: 'vendors',          label: 'Vendors',             section: 'masters',   route: '/masters/vendors' },
  { key: 'products',         label: 'Products',            section: 'masters',   route: '/masters/products' },
  { key: 'employees',        label: 'Employees',           section: 'masters',   route: '/masters/employees' },

  // ── Settings ─────────────────────────────────────────────────────────────────
  { key: 'company',          label: 'Company Info',        section: 'settings',  route: '/settings/company' },
  { key: 'ai',               label: 'AI Assistant',        section: 'settings',  route: '/settings/ai' },
  { key: 'payment_accounts', label: 'Payment Accounts',   section: 'settings',  route: '/settings/payment-accounts' },
  { key: 'glass_calc',       label: 'Glass Calc Settings', section: 'settings',  route: '/settings/glass-calc' },
  { key: 'glass_rate_matrix', label: 'Glass Rate Matrix',  section: 'settings',  route: '/settings/glass-rate-matrix' },
  { key: 'glass_dropdowns',   label: 'Glass Dropdowns',     section: 'settings',  route: '/settings/glass-dropdowns' },
  { key: 'branches',         label: 'Branches',            section: 'settings',  route: '/settings/branches' },
  { key: 'currencies',       label: 'Currencies',          section: 'settings',  route: '/settings/currencies' },
  { key: 'tax_groups',       label: 'Tax Groups',          section: 'settings',  route: '/settings/tax-groups' },
  { key: 'taxes',            label: 'Taxes',               section: 'settings',  route: '/settings/taxes' },
  { key: 'hsn_codes',        label: 'HSN/SAC Codes',       section: 'settings',  route: '/settings/hsn-codes' },
  { key: 'uom_categories',   label: 'UoM Categories',      section: 'settings',  route: '/settings/uom-categories' },
  { key: 'uoms',             label: 'Units of Measure',    section: 'settings',  route: '/settings/uoms' },
  { key: 'process_masters',  label: 'Process Masters',     section: 'settings',  route: '/settings/process-masters' },
  { key: 'uom_rates',        label: 'UOM Rates',           section: 'settings',  route: '/settings/uom-rates' },
]

export const DEFAULT_ROLE_PERMISSIONS = {
  superadmin: ['all'],
  admin: ['all'],
  sales: ['pipeline', 'leads', 'stages', 'quotations', 'sales_orders', 'customers'],
  accounts: ['invoices', 'payment_accounts', 'customers'],
  warehouse: ['stock', 'delivery_challans', 'stock_movements', 'products'],
  workshop: ['workshop_orders', 'toughening'],
  viewer: ['sales_performance'],
}
