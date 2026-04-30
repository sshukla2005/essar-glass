// ─── TaxList.jsx ─────────────────────────────────────────────────────────────
import React from 'react'
import { Tag } from 'antd'
import MasterList from '../../../components/common/MasterList'
import { taxApi, taxGroupApi } from '../../../api'

const TAX_TYPE_COLORS = { CGST: 'blue', SGST: 'green', IGST: 'purple', CESS: 'orange', TDS: 'red', TCS: 'volcano' }

export const TaxList = () => (
  <MasterList
    title="Taxes"
    queryKey="taxes"
    api={taxApi}
    columns={[
      { title: 'Name',      dataIndex: 'name',      key: 'name',      width: 200 },
      { title: 'Type',      dataIndex: 'tax_type',  key: 'tax_type',  width: 90,
        render: v => <Tag color={TAX_TYPE_COLORS[v] || 'default'}>{v}</Tag> },
      { title: 'Rate %',    dataIndex: 'rate',      key: 'rate',      width: 90,  render: v => `${v}%` },
      { title: 'Computation', dataIndex: 'computation_type', key: 'comp', width: 130 },
      { title: 'Tax Group', dataIndex: 'tax_group', key: 'tax_group', width: 160, render: v => v?.name || '—' },
      { title: 'Withholding', dataIndex: 'is_withholding', key: 'withholding', width: 110,
        render: v => v ? <Tag color="red">TDS/TCS</Tag> : '—' },
    ]}
    createPath="/masters/taxes/new"
    editPath={(r) => `/masters/taxes/${r.id}/edit`}
    searchPlaceholder="Search taxes..."
  />
)

export const TaxGroupList = () => (
  <MasterList
    title="Tax Groups"
    queryKey="tax-groups"
    api={taxGroupApi}
    columns={[
      { title: 'Name',     dataIndex: 'name',        key: 'name',     width: 200 },
      { title: 'GST Rate', dataIndex: 'gst_rate',    key: 'gst_rate', width: 100, render: v => v ? `${v}%` : '—' },
      { title: 'Description', dataIndex: 'description', key: 'desc',  render: v => v || '—' },
    ]}
    createPath="/settings/tax-groups/new"
    editPath={(r) => `/settings/tax-groups/${r.id}/edit`}
    searchPlaceholder="Search tax groups..."
  />
)
