import React from 'react'
import { Link } from 'react-router-dom'
import { Tag } from 'antd'
import MasterList from '../../components/common/MasterList'
import { deliveryChallanApi, customerApi } from '../../api'
import { useQuery } from '@tanstack/react-query'

const STATUS_COLORS = {
  draft: 'default',
  dispatched: 'blue',
  delivered: 'green',
  returned: 'red',
}

// Pieces on the challan: dispatched qty of every line (glass and hardware)
const totalQty = (lines) => (Array.isArray(lines) ? lines : []).reduce((s, l) => {
  const q = Number(l?.qty_dispatched ?? l?.dispatch_qty ?? l?.quantity ?? 0)
  return s + (Number.isFinite(q) ? q : 0)
}, 0)

const DeliveryChallanList = () => {
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  
  const columns = [
    { title: 'DC Number', dataIndex: 'dc_number', width: 120 },
    { title: 'Customer', dataIndex: 'customer_name', render: (v, r) => v || r.customer_id || '—' },
    // The linked Sales Order's own number (from the API), opening that order
    { title: 'SO Ref', dataIndex: 'so_ref_number', render: (v, r) => r.so_id
      ? <Link to={`/sales-orders/${r.so_id}/edit`} onClick={e => e.stopPropagation()}>{v || `Sales Order #${r.so_id}`}</Link>
      : '—' },
    { title: 'Date', dataIndex: 'dc_date' },
    { title: 'Total Qty', key: 'total_qty', align: 'right', width: 100, render: (_, r) => totalQty(r.lines).toLocaleString('en-IN') },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{(v === 'draft' ? 'Ready to Deliver' : String(v)).toUpperCase()}</Tag> },
  ]

  return (
    <MasterList
      title="Delivery Challans"
      queryKey="delivery_challans"
      api={deliveryChallanApi}
      columns={columns}
      createPath="/delivery-challans/new"
      editPath={(r) => `/delivery-challans/${r.id}/edit`}
      searchPlaceholder="Search DC Number..."
      nameField="dc_number"
    />
  )
}

export default DeliveryChallanList
