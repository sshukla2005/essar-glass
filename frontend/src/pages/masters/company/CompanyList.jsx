import React from 'react'
import { Tag, Typography } from 'antd'
import MasterList from '../../../components/common/MasterList'
import { companyApi } from '../../../api'

const { Text } = Typography

const columns = [
  { title: 'Code',         dataIndex: 'code',       key: 'code',       width: 100, render: (v) => <Tag>{v}</Tag> },
  { title: 'Name',         dataIndex: 'name',       key: 'name',       width: 220 },
  { title: 'Legal Name',   dataIndex: 'legal_name', key: 'legal_name', width: 200, render: (v) => v || '—' },
  { title: 'GSTIN',        dataIndex: 'gstin',      key: 'gstin',      width: 170, render: (v) => v ? <Text code>{v}</Text> : '—' },
  { title: 'PAN',          dataIndex: 'pan',        key: 'pan',        width: 120, render: (v) => v ? <Text code>{v}</Text> : '—' },
  { title: 'City',         dataIndex: 'city',       key: 'city',       width: 120, render: (v) => v || '—' },
  { title: 'State',        dataIndex: 'state',      key: 'state',      width: 150, render: (v) => v || '—' },
  { title: 'Currency',     dataIndex: 'currency',   key: 'currency',   width: 100, render: (v) => v ? <Tag color="blue">{v.code}</Tag> : '—' },
  { title: 'Phone',        dataIndex: 'phone',      key: 'phone',      width: 130, render: (v) => v || '—' },
  { title: 'Email',        dataIndex: 'email',      key: 'email',      width: 200, render: (v) => v || '—' },
]

const CompanyList = () => (
  <MasterList
    title="Companies"
    queryKey="companies"
    api={companyApi}
    columns={columns}
    createPath="/masters/companies/new"
    editPath={(r) => `/masters/companies/${r.id}/edit`}
    searchPlaceholder="Search by name, code, GSTIN, PAN..."
  />
)

export default CompanyList
