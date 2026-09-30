import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Input, Select, AutoComplete, Button, Tag, Space, Switch, Typography, Popconfirm, App, Alert } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { hsnMappingApi, companyApi } from '../../api'

const { Title, Text } = Typography

// A string `detail` from the API, else the fallback (422 responses carry a list, not a message)
const apiError = (err, fallback) => {
  const detail = err?.response?.data?.detail
  return typeof detail === 'string' && detail ? detail : fallback
}

const HS_CODE_RE = /^\d{4,8}$/

const glassTypeOptions = () => {
  try {
    const cfg = JSON.parse(localStorage.getItem('glass_dropdown_config') || '{}')
    const types = cfg.glass_types?.length ? cfg.glass_types : ['Annealed', 'Toughened', 'Laminated', 'DGU']
    return types.map(t => ({ value: t }))
  } catch {
    return ['Annealed', 'Toughened', 'Laminated', 'DGU'].map(t => ({ value: t }))
  }
}

const categoryOptions = () => {
  try {
    const cfg = JSON.parse(localStorage.getItem('glass_dropdown_config') || '{}')
    const cats = cfg.categories?.length ? cfg.categories : ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror']
    return cats.map(c => ({ value: c }))
  } catch {
    return ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror'].map(c => ({ value: c }))
  }
}

// Inline HS code editor: saves on Enter or blur when the value changed
const HsCodeCell = ({ row, onSave, saving }) => {
  const [value, setValue] = useState(row.hs_code)
  const dirty = value.trim() !== row.hs_code
  const valid = HS_CODE_RE.test(value.trim())
  const save = () => { if (dirty && valid) onSave(row, value.trim()) }
  return (
    <Input
      size="small"
      value={value}
      disabled={!row.is_active || saving}
      status={dirty && !valid ? 'error' : undefined}
      onChange={e => setValue(e.target.value)}
      onPressEnter={save}
      onBlur={() => (valid ? save() : setValue(row.hs_code))}
      style={{ width: 120, fontFamily: 'monospace' }}
    />
  )
}

const emptyDraft = { company_id: null, glass_type: '', glass_category: '', hs_code: '' }

const HsnMappingSettings = () => {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [showInactive, setShowInactive] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)

  const { data, isLoading } = useQuery({
    queryKey: ['hsn_mappings', showInactive],
    queryFn: () => hsnMappingApi.list(showInactive).then(r => r.data),
  })
  const { data: companiesData } = useQuery({
    queryKey: ['companies-dd'],
    queryFn: () => companyApi.list({ page_size: 100 }).then(r => r.data?.items || r.data || []),
  })
  const companyOptions = useMemo(() => [
    { value: null, label: 'All companies' },
    ...(Array.isArray(companiesData) ? companiesData : []).map(c => ({ value: c.id, label: c.name })),
  ], [companiesData])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['hsn_mappings'] })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }) => hsnMappingApi.update(id, patch),
    onSuccess: (_, { patch }) => {
      message.success(patch.is_active === false ? 'Mapping deactivated' : patch.is_active ? 'Mapping reactivated' : 'HS code updated')
      refresh()
    },
    onError: (err) => message.error(apiError(err, 'Failed to update mapping')),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => hsnMappingApi.create(payload),
    onSuccess: () => { message.success('Mapping added'); setDraft(emptyDraft); refresh() },
    onError: (err) => message.error(apiError(err, 'Failed to add mapping')),
  })

  const canAdd = draft.glass_type.trim() && HS_CODE_RE.test(draft.hs_code.trim())

  const columns = [
    {
      title: 'Company', dataIndex: 'company_name', width: 170,
      render: (v, r) => r.company_id ? v : <Tag color="blue">All companies</Tag>,
    },
    { title: 'Glass type', dataIndex: 'glass_type', width: 150 },
    {
      title: 'Category', dataIndex: 'glass_category', width: 150,
      render: v => v || <Text type="secondary">All categories</Text>,
    },
    {
      title: 'HS code', dataIndex: 'hs_code', width: 150,
      render: (_, r) => (
        <HsCodeCell key={`${r.id}-${r.hs_code}`} row={r} saving={updateMutation.isPending}
          onSave={(row, hs_code) => updateMutation.mutate({ id: row.id, patch: { hs_code } })} />
      ),
    },
    {
      title: 'Status', dataIndex: 'is_active', width: 100,
      render: v => v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>,
    },
    {
      title: '', key: 'actions', width: 120,
      render: (_, r) => r.is_active ? (
        <Popconfirm title="Deactivate this mapping?" okText="Deactivate" cancelText="Cancel"
          onConfirm={() => updateMutation.mutate({ id: r.id, patch: { is_active: false } })}>
          <Button size="small" danger>Deactivate</Button>
        </Popconfirm>
      ) : (
        <Button size="small" onClick={() => updateMutation.mutate({ id: r.id, patch: { is_active: true } })}>Reactivate</Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 4 }}>HSN Mapping</Title>
      <Text type="secondary">
        HS code by glass type and category. Matching ignores case and extra spaces. A product's own HSN code
        always wins; otherwise a company row beats an all-companies row, and a category row beats an
        all-categories row. When nothing matches: <Text code>{data?.default_hs_code || '70051090'}</Text>.
      </Text>

      <Card size="small" style={{ marginTop: 16 }} title="Add mapping">
        <Space wrap>
          <Select style={{ width: 180 }} options={companyOptions} value={draft.company_id}
            onChange={v => setDraft(d => ({ ...d, company_id: v }))} />
          <AutoComplete style={{ width: 170 }} placeholder="Glass type" options={glassTypeOptions()}
            value={draft.glass_type} onChange={v => setDraft(d => ({ ...d, glass_type: v }))}
            filterOption={(input, opt) => opt.value.toLowerCase().includes(input.trim().toLowerCase())} />
          <AutoComplete style={{ width: 170 }} placeholder="Category (blank = all)" options={categoryOptions()}
            value={draft.glass_category} onChange={v => setDraft(d => ({ ...d, glass_category: v }))}
            filterOption={(input, opt) => opt.value.toLowerCase().includes(input.trim().toLowerCase())} />
          <Input style={{ width: 130, fontFamily: 'monospace' }} placeholder="HS code" value={draft.hs_code}
            status={draft.hs_code && !HS_CODE_RE.test(draft.hs_code.trim()) ? 'error' : undefined}
            onChange={e => setDraft(d => ({ ...d, hs_code: e.target.value }))} />
          <Button type="primary" icon={<PlusOutlined />} disabled={!canAdd} loading={createMutation.isPending}
            onClick={() => createMutation.mutate({
              company_id: draft.company_id,
              glass_type: draft.glass_type.trim(),
              glass_category: draft.glass_category.trim() || null,
              hs_code: draft.hs_code.trim(),
            })}>
            Add
          </Button>
        </Space>
      </Card>

      <Card size="small" style={{ marginTop: 16 }}
        extra={<Space><Text type="secondary">Show inactive</Text><Switch size="small" checked={showInactive} onChange={setShowInactive} /></Space>}>
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="Edit an HS code in the table and press Enter (or click away) to save. HS codes are 4 to 8 digits." />
        <Table rowKey="id" size="small" loading={isLoading} columns={columns}
          dataSource={data?.items || []} pagination={false} />
      </Card>
    </div>
  )
}

export default HsnMappingSettings
