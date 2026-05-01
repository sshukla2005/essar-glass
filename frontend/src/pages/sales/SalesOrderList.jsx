import React from 'react'
import { Tag } from 'antd'
import MasterList from '../../components/common/MasterList'
import { salesOrderApi, customerApi } from '../../api'
import { useQuery } from '@tanstack/react-query'
import { generateSOPDF } from '../../utils/pdfGenerator'
import { Button, Tooltip } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'

const STATUS_COLORS = {
  draft: 'default',
  confirmed: 'blue',
  in_production: 'orange',
  ready: 'purple',
  delivered: 'green',
  cancelled: 'red',
}

const SalesOrderList = () => {
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  
  const columns = [
    { title: 'SO Number', dataIndex: 'so_number', width: 120 },
    { title: 'Customer', dataIndex: 'customer_id', render: v => customers.find(c => c.value === v)?.label || v },
    { title: 'Quotation Ref', dataIndex: 'quotation_id', render: v => v ? `QT${String(v).padStart(4,'0')}` : '—' },
    { title: 'Order Date', dataIndex: 'order_date' },
    { title: 'Delivery Date', dataIndex: 'delivery_date' },
    { title: 'Total Amount', dataIndex: 'total_amount', render: v => <span style={{ color: '#16a34a', fontWeight: 600 }}>₹ {Number(v||0).toLocaleString('en-IN')}</span> },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{String(v).toUpperCase()}</Tag> },
  ]

  return (
    <MasterList
      title="Sales Orders"
      queryKey="sales_orders"
      api={salesOrderApi}
      columns={columns}
      createPath="/sales-orders/new"
      editPath={(r) => `/sales-orders/${r.id}/edit`}
      searchPlaceholder="Search SO Number..."
      nameField="so_number"
      extraActions={(r) => (
        <Tooltip title="Download PDF">
          <Button type="text" size="small" icon={<DownloadOutlined />} style={{ color: '#10b981' }} onClick={() => generateSOPDF(r)} />
        </Tooltip>
      )}
    />
  )
}

export default SalesOrderList
