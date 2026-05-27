import React from 'react'
import { Form, Select, Tag } from 'antd'
import { useAuth } from '../../hooks/useAuth'

// Use this component in every New/Edit form
// Shows company selector only for superadmin
// For regular users, auto-fills their company silently

const CompanySelector = ({ form, required = true }) => {
  const { user, isSuperAdmin } = useAuth()

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
      label="Company"
      rules={required ? [{ required: true, message: 'Select company' }] : []}
    >
      <Select
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
