import React from 'react'
import { Link } from 'react-router-dom'
import { Tag } from 'antd'
import MasterList from '../../components/common/MasterList'
import { invoiceApi, customerApi } from '../../api'
import { useQuery } from '@tanstack/react-query'

const STATUS_COLORS = {
  draft: 'default',
  sent: 'blue',
  paid: 'green',
  overdue: 'red',
  cancelled: 'default',
  partially_paid: 'orange',
  unpaid: 'volcano',
}

const InvoiceList = () => {
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  
  const columns = [
    { title: 'Invoice No', dataIndex: 'invoice_number', width: 120 },
    { title: 'Customer', dataIndex: 'customer_name', render: (v, r) => v || r.customer_id || '—' },
    // The linked Sales Order's own number (from the API), opening that order
    { title: 'SO Ref', dataIndex: 'so_ref_number', render: (v, r) => r.so_id
      ? <Link to={`/sales-orders/${r.so_id}/edit`} onClick={e => e.stopPropagation()}>{v || `Sales Order #${r.so_id}`}</Link>
      : '—' },
    { title: 'Invoice Date', dataIndex: 'invoice_date' },
    { title: 'Total', dataIndex: 'total_amount', render: v => <span style={{ color: '#0f172a', fontWeight: 600 }}>₹ {Number(v||0).toLocaleString('en-IN')}</span> },
    { title: 'Paid', dataIndex: 'amount_paid', render: v => <span style={{ color: '#16a34a' }}>₹ {Number(v||0).toLocaleString('en-IN')}</span> },
    { title: 'Balance', dataIndex: 'balance_due', render: v => <span style={{ color: v > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>₹ {Number(v||0).toLocaleString('en-IN')}</span> },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{String(v).toUpperCase()}</Tag> },
  ]

  return (
    <MasterList
      title="Invoices"
      queryKey="invoices"
      api={invoiceApi}
      columns={columns}
      createPath="/invoices/new"
      editPath={(r) => `/invoices/${r.id}/edit`}
      searchPlaceholder="Search Invoice No..."
      nameField="invoice_number"
    />
  )
}

export default InvoiceList
