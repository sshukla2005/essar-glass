import React from 'react'
import { Tag, Button, Tooltip, message, Select, Col } from 'antd'
import MasterList from '../../components/common/MasterList'
import { salesOrderApi, customerApi } from '../../api'
import { useQuery } from '@tanstack/react-query'
import { generateSOPDF } from '../../utils/pdfGenerator'
import { DownloadOutlined, FilterOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedStatus = searchParams.get('status') || undefined
  
  const customerList = Array.isArray(customers) ? customers : (customers?.items || [])

  const handleStatusChange = (value) => {
    if (value) {
      setSearchParams({ status: value })
    } else {
      const params = new URLSearchParams(searchParams)
      params.delete('status')
      setSearchParams(params)
    }
  }
  
  const columns = [
    { title: 'SO Number', dataIndex: 'so_number', width: 120 },
    { title: 'Customer', dataIndex: 'customer_id', render: v => customerList.find(c => c.value === v || c.id === v)?.label || customerList.find(c => c.id === v)?.name || v },
    { title: 'Quotation Ref', dataIndex: 'quotation_id', render: v => v ? `QT${String(v).padStart(4,'0')}` : '—' },
    { title: 'Order Date', dataIndex: 'order_date' },
    { title: 'Delivery Date', dataIndex: 'delivery_date' },
    { title: 'Total Amount', dataIndex: 'total_amount', render: v => <span style={{ color: '#16a34a', fontWeight: 600 }}>₹ {Number(v||0).toLocaleString('en-IN')}</span> },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{String(v).toUpperCase()}</Tag> },
  ]

  const extraFilters = (
    <Col>
      <Select
        placeholder={<><FilterOutlined /> Status</>}
        allowClear
        style={{ width: 160 }}
        value={selectedStatus}
        onChange={handleStatusChange}
        options={[
          { value: 'draft', label: 'Draft' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'in_production', label: 'In Production' },
          { value: 'ready', label: 'Ready' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'cancelled', label: 'Cancelled' },
        ]}
      />
    </Col>
  )

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
      apiFilters={selectedStatus ? { status: selectedStatus } : undefined}
      extraFilters={extraFilters}
      extraActions={(r) => (
        <Tooltip title="Download PDF">
          <Button type="text" size="small" icon={<DownloadOutlined />} style={{ color: '#10b981' }} onClick={async () => {
            const hide = message.loading('Generating Proforma Invoice PDF...', 0)
            try {
              await generateSOPDF(r)
            } catch (err) {
              message.error('Failed to generate PDF')
            } finally {
              hide()
            }
          }} />
        </Tooltip>
      )}
    />
  )
}

export default SalesOrderList
