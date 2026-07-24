import React from 'react'
import { Form, Select, Tag } from 'antd'
import { useAuth } from '../../hooks/useAuth'

// Use this component in every New/Edit form
// Shows company selector only for superadmin
// For regular users, auto-fills their company silently

const CompanySelector = ({ form, required = true }) => {
  const { user, isSuperAdmin, activeCompanyId } = useAuth()

  const companies = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('companies_master') || '[]')
        .filter(c => c.is_active !== false)
    } catch { return [] }
  }, [])

  // Auto-fill company_id for non-superadmin
  React.useEffect(() => {
    if (!isSuperAdmin && user?.company_id) {
      form.setFieldValue('company_id', user.company_id)
    }
    // Superadmin: agar header "Viewing" selector mein specific company chuni hai
    // (e.g. Essar Sons), to naye documents mein Company field auto-fill ho.
    // Sirf tab set karo jab field khali ho — edit mode mein record ki company
    // ko overwrite nahi karna.
    if (isSuperAdmin && activeCompanyId && !form.getFieldValue('company_id')) {
      form.setFieldValue('company_id', Number(activeCompanyId))
    }
  }, [])

  if (!isSuperAdmin) {
    // Hidden field — auto-set
    return (
      <Form.Item name="company_id" hidden>
        <input type="hidden" />
      </Form.Item>
    )
  }

  // Superadmin sees selector
  return (
    <Form.Item
      name="company_id"
      label={<span>Company <span style={{ fontWeight: 400, fontSize: 11, color: '#94a3b8' }}>(set by the company you are viewing)</span></span>}
      rules={required ? [{ required: true, message: 'Select company' }] : []}
    >
      <Select
        disabled
        placeholder="Select company"
        options={companies.map(c => ({
          value: c.id,
          label: (
            <span>
              <Tag color={c.color} style={{ marginRight: 6 }}>{c.short_name}</Tag>
              {c.name}
            </span>
          )
        }))}
      />
    </Form.Item>
  )
}

export default CompanySelector
