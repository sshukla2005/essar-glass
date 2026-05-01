import React from 'react'
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

const DeliveryChallanList = () => {
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  
  const columns = [
    { title: 'DC Number', dataIndex: 'dc_number', width: 120 },
    { title: 'Customer', dataIndex: 'customer_id', render: v => customers.find(c => c.value === v)?.label || v },
    { title: 'SO Ref', dataIndex: 'so_id', render: v => v ? `SO${String(v).padStart(4,'0')}` : '—' },
    { title: 'Date', dataIndex: 'dc_date' },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{String(v).toUpperCase()}</Tag> },
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
