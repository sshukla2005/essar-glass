import { createMasterApi } from './axios'
import api from './axios'

export const companyApi     = createMasterApi('companies')
export const branchApi      = createMasterApi('branches')
export const uomCategoryApi = createMasterApi('uom-categories')
export const uomApi         = createMasterApi('uoms')
export const taxGroupApi    = createMasterApi('tax-groups')
export const taxApi         = createMasterApi('taxes')
export const hsnApi         = createMasterApi('hsn-codes')
export const currencyApi    = createMasterApi('currencies')
export const customerApi    = createMasterApi('customers')
export const vendorApi      = createMasterApi('vendors')
export const employeeApi    = createMasterApi('employees')
export const productApi     = createMasterApi('products')
export const crmStageApi    = createMasterApi('crm-stages')
export const crmLeadApi     = createMasterApi('crm-leads')

export const quotationApi = {
  ...createMasterApi('quotations'),
  confirm: (id) => api.post(`/quotations/${id}/confirm`),
  cancel:  (id) => api.post(`/quotations/${id}/cancel`),
}
