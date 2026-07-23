import api from './axios'

// ── Generic CRUD API factory ──────────────────────
const createApi = (endpoint, codeField = null) => ({

  list: async (params = {}) => {
    const { page = 1, page_size = 20, search = '',
      is_active, company_id, ...extra } = params
    const queryParams = {
      page, page_size,
      ...(search ? { search } : {}),
      ...(is_active !== undefined ? { is_active } : {}),
      ...(company_id ? { company_id } : {}),
      ...extra,
    }
    const res = await api.get(`/api/v1/${endpoint}/`, { params: queryParams })
    return { data: res.data }
  },

  get: async (id) => {
    const res = await api.get(`/api/v1/${endpoint}/${id}`)
    return { data: res.data }
  },

  create: async (data) => {
    const res = await api.post(`/api/v1/${endpoint}/`, data)
    return { data: res.data }
  },

  update: async (id, data) => {
    const res = await api.put(`/api/v1/${endpoint}/${id}`, data)
    return { data: res.data }
  },

  archive: async (id) => {
    const res = await api.patch(`/api/v1/${endpoint}/${id}/archive`)
    return { data: res.data }
  },

  changeStatus: async (id, status) => {
    const res = await api.patch(
      `/api/v1/${endpoint}/${id}/status`,
      { status }
    )
    return { data: res.data }
  },

  dropdown: async () => {
    const res = await api.get(`/api/v1/${endpoint}/dropdown`)
    return {
      data: Array.isArray(res.data) ? res.data : res.data?.items || []
    }
  },

  clone: async (id) => {
    const res = await api.post(`/api/v1/${endpoint}/${id}/clone`)
    return { data: res.data }
  },
})

// ── All module APIs ────────────────────────────────
export const companyApi = createApi('companies')
export const customerApi = createApi('customers', 'customer_code')
export const vendorApi = createApi('vendors', 'vendor_code')
export const productApi = createApi('products', 'internal_ref')
export const employeeApi = createApi('employees', 'employee_code')
export const crmStageApi = createApi('crm/stages')
export const crmLeadApi = createApi('crm/leads', 'lead_number')
export const quotationApi = createApi('quotations', 'quote_number')
export const salesOrderApi = createApi('sales-orders', 'so_number')
export const purchaseOrderApi = createApi('purchase-orders', 'po_number')
export const deliveryChallanApi = createApi('delivery', 'dc_number')
export const invoiceApi = createApi('invoices', 'invoice_number')
export const stockMovementApi = createApi('inventory', 'move_number')
export const workshopOrderApi = createApi('workshop', 'wo_number')
export const tougheningBatchApi = createApi('toughening', 'tb_number')
export const userApi = createApi('users')

// ── Now pointing to BACKEND (not localStorage) ────
export const warehouseApi = createApi('warehouses')
export const processMasterApi = {
  ...createApi('process-masters'),

  // Settings page calls processMasterApi.save(allItems)
  // We ignore bulk-save — individual create/update from backend is used instead
  save: async (items) => {
    return Promise.resolve({ data: items })
  },
}

// ── Still localStorage (not in backend scope yet) ─
import { createLocalApi } from './localStorage'
export const branchApi = createLocalApi('branches', { field: 'code', prefix: 'BR' })
export const uomCategoryApi = createLocalApi('uom_categories')
export const uomApi = createLocalApi('uoms')
export const taxGroupApi = createLocalApi('tax_groups')
export const taxApi = createLocalApi('taxes')
export const hsnApi = createLocalApi('hsn_codes')
export const currencyApi = createLocalApi('currencies')
export const paymentApi = createApi('payments')

// ── Glass rate matrix (localStorage — config only) ─
export { settingsApi } from './settingsApi'

export const glassRateApi = {
  get: () => {
    try {
      return Promise.resolve({
        data: JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
      })
    } catch { return Promise.resolve({ data: {} }) }
  },
  save: (data) => {
    localStorage.setItem('glass_rate_matrix', JSON.stringify({
      ...data,
      updated_at: new Date().toISOString()
    }))
    return Promise.resolve({ data })
  }
}

export const companyLogoApi = {
  upload: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post('/api/v1/settings/company/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return { data: res.data }
  },
  remove: async () => {
    const res = await api.delete('/api/v1/settings/company/logo')
    return { data: res.data }
  }
}

export const receivablesApi = {
  summary: async () => {
    const res = await api.get('/api/v1/receivables/summary')
    return { data: res.data }
  },
  byCustomer: async () => {
    const res = await api.get('/api/v1/receivables/customers')
    return { data: res.data }
  },
  customerLedger: async (customerId) => {
    const res = await api.get(`/api/v1/receivables/customer/${customerId}`)
    return { data: res.data }
  },
}

// ── Auth helpers ───────────────────────────────────
export const authApi = {
  // Returns { access_token, active_company_id, active_company, is_read_only, home_company_id, ... }
  switchCompany: (company_id) =>
    api.post('/api/v1/auth/switch-company', { company_id }),
}

// ── SuperAdmin Dashboard ───────────────────────────
export const superApi = {
  getGroupOverview: async () => {
    const res = await api.get('/api/v1/super/group-overview')
    return { data: res.data }
  },
}