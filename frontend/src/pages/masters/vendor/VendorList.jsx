// ─── VendorList.jsx ──────────────────────────────────────────────────────────
import React from 'react'
import { Tag, Typography } from 'antd'
import MasterList from '../../../components/common/MasterList'
import { vendorApi } from '../../../api'

const { Text } = Typography

const VendorList = () => (
  <MasterList
    title="Vendors"
    queryKey="vendors"
    api={vendorApi}
    columns={[
      { title: 'Name',        dataIndex: 'name',        key: 'name',        width: 200 },
      { title: 'Vendor Code', dataIndex: 'vendor_code', key: 'vendor_code', width: 130, render: v => v ? <Tag>{v}</Tag> : '—' },
      { title: 'Type',        dataIndex: 'vendor_type', key: 'vendor_type', width: 110, render: v => <Tag color={v === 'company' ? 'blue' : 'green'}>{v}</Tag> },
      { title: 'GSTIN',       dataIndex: 'gstin',       key: 'gstin',       width: 170, render: v => v ? <Text code>{v}</Text> : '—' },
      { title: 'City',        dataIndex: 'city',        key: 'city',        width: 120 },
      { title: 'State',       dataIndex: 'state',       key: 'state',       width: 140 },
      { title: 'Phone',       dataIndex: 'phone',       key: 'phone',       width: 130 },
      { title: 'Email',       dataIndex: 'email',       key: 'email',       width: 200 },
    ]}
    createPath="/masters/vendors/new"
    editPath={(r) => `/masters/vendors/${r.id}/edit`}
    searchPlaceholder="Search by name, code, GSTIN, email..."
  />
)

export default VendorList
