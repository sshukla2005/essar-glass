import React from 'react'
import { Tag } from 'antd'
import MasterList from '../../components/common/MasterList'
import { stockMovementApi, productApi, warehouseApi } from '../../api'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'

const StockMovements = () => {
  const { data: products = [] } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses-dd'], queryFn: () => warehouseApi.dropdown().then(r => r.data) })

  const columns = [
    { title: 'Move #', dataIndex: 'move_number', width: 120 },
    { title: 'Date', dataIndex: 'date', render: v => dayjs(v).format('DD/MM/YYYY HH:mm'), width: 150 },
    { title: 'Product', dataIndex: 'product_id', render: v => products.find(p => p.value === v)?.label || v, width: 250 },
    { title: 'Type', dataIndex: 'movement_type', render: v => {
      if (v === 'in') return <Tag color="green">IN 🟢</Tag>
      if (v === 'out') return <Tag color="red">OUT 🔴</Tag>
      if (v === 'adjustment') return <Tag color="orange">ADJUST 🟡</Tag>
      return <Tag>{v}</Tag>
    }, width: 100 },
    { title: 'Qty', dataIndex: 'quantity', width: 80, render: (v, r) => <strong style={{ color: r.movement_type === 'in' ? '#10b981' : r.movement_type === 'out' ? '#dc2626' : '#f59e0b' }}>{v}</strong> },
    { title: 'Warehouse', dataIndex: 'warehouse_id', render: v => warehouses.find(w => w.value === v)?.label || v, width: 150 },
    { title: 'Reference', dataIndex: 'reference', width: 150 },
    { title: 'Remarks', dataIndex: 'remarks', width: 200 },
  ]

  // We hide actions column entirely since we shouldn't edit movements
  const columnsWithoutActions = columns

  return (
    <MasterList
      title="Stock Movements"
      queryKey="stock_movements"
      api={stockMovementApi}
      columns={columnsWithoutActions}
      createPath=""
      editPath={() => '#'} // Disabled
      searchPlaceholder="Search reference..."
    />
  )
}

export default StockMovements
