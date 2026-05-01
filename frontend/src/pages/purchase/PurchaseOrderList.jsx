import React from 'react'
import { Tag } from 'antd'
import MasterList from '../../components/common/MasterList'
import { purchaseOrderApi, vendorApi } from '../../api'
import { useQuery } from '@tanstack/react-query'
import { generatePOPDF } from '../../utils/pdfGenerator'
import { Button, Tooltip } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'

const STATUS_COLORS = {
  draft: 'default',
  sent: 'blue',
  confirmed: 'orange',
  received: 'green',
  cancelled: 'red',
}

const PurchaseOrderList = () => {
  const { data: vendors = [] } = useQuery({ queryKey: ['vendors-dd'], queryFn: () => vendorApi.dropdown().then(r => r.data) })
  
  const columns = [
    { title: 'PO Number', dataIndex: 'po_number', width: 120 },
    { title: 'Vendor', dataIndex: 'vendor_id', render: v => vendors.find(c => c.value === v)?.label || v },
    { title: 'SO Reference', dataIndex: 'vendor_reference' },
    { title: 'Order Date', dataIndex: 'po_date' },
    { title: 'Expected Delivery', dataIndex: 'expected_delivery' },
    { title: 'Total Amount', dataIndex: 'total_amount', render: v => <span style={{ color: '#16a34a', fontWeight: 600 }}>₹ {Number(v||0).toLocaleString('en-IN')}</span> },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{String(v).toUpperCase()}</Tag> },
  ]

  return (
    <MasterList
      title="Purchase Orders"
      queryKey="purchase_orders"
      api={purchaseOrderApi}
      columns={columns}
      createPath="/purchase-orders/new"
      editPath={(r) => `/purchase-orders/${r.id}/edit`}
      searchPlaceholder="Search PO Number..."
      nameField="po_number"
      extraActions={(r) => (
        <Tooltip title="Download PDF">
          <Button type="text" size="small" icon={<DownloadOutlined />} style={{ color: '#10b981' }} onClick={() => generatePOPDF(r)} />
        </Tooltip>
      )}
    />
  )
}

export default PurchaseOrderList
