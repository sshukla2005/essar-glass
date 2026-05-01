import React from 'react'
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
}

const InvoiceList = () => {
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  
  const columns = [
    { title: 'Invoice No', dataIndex: 'invoice_number', width: 120 },
    { title: 'Customer', dataIndex: 'customer_id', render: v => customers.find(c => c.value === v)?.label || v },
    { title: 'SO Ref', dataIndex: 'so_id', render: v => v ? `SO${String(v).padStart(4,'0')}` : '—' },
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
