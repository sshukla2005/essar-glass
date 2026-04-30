// ─── CustomerList.jsx ────────────────────────────────────────────────────────
import React from 'react'
import { Tag, Typography, Badge } from 'antd'
import MasterList from '../../../components/common/MasterList'
import { customerApi } from '../../../api'

const { Text } = Typography

const CustomerList = () => (
  <MasterList
    title="Customers"
    queryKey="customers"
    api={customerApi}
    columns={[
      { title: 'Name',          dataIndex: 'name',          key: 'name',          width: 200 },
      { title: 'Customer Code', dataIndex: 'customer_code', key: 'customer_code', width: 130, render: v => v ? <Tag>{v}</Tag> : '—' },
      { title: 'Type',          dataIndex: 'customer_type', key: 'customer_type', width: 110, render: v => <Tag color={v === 'company' ? 'blue' : 'green'}>{v}</Tag> },
      { title: 'GSTIN',         dataIndex: 'gstin',         key: 'gstin',         width: 170, render: v => v ? <Text code>{v}</Text> : '—' },
      { title: 'City',          dataIndex: 'city',          key: 'city',          width: 120 },
      { title: 'State',         dataIndex: 'state',         key: 'state',         width: 140 },
      { title: 'Phone',         dataIndex: 'phone',         key: 'phone',         width: 130 },
      { title: 'Email',         dataIndex: 'email',         key: 'email',         width: 200 },
    ]}
    createPath="/masters/customers/new"
    editPath={(r) => `/masters/customers/${r.id}/edit`}
    searchPlaceholder="Search by name, code, GSTIN, email..."
  />
)

export default CustomerList
