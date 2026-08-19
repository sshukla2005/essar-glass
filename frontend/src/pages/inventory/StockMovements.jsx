import React, { useState } from 'react'
import { Tag, Button } from 'antd'
import { FilePdfOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import MasterList from '../../components/common/MasterList'
import { stockMovementApi, productApi, warehouseApi } from '../../api'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import CreateDeliveryNoteModal from './CreateDeliveryNoteModal'

const StockMovements = () => {
  const [searchParams] = useSearchParams()
  const filterProductId = searchParams.get('product_id')
  const [isDeliveryNoteModalOpen, setIsDeliveryNoteModalOpen] = useState(false)
  const [selectedMovementsForNote, setSelectedMovementsForNote] = useState([])

  const { data: products = [] } = useQuery({
    queryKey: ['products-dd'],
    queryFn: () => productApi.dropdown().then(r => r.data)
  })
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-dd'],
    queryFn: () => warehouseApi.dropdown().then(r => r.data)
  })

  const columns = [
    { title: 'Move #', dataIndex: 'move_number', width: 120 },
    {
      title: 'Date',
      dataIndex: 'date',
      render: v => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—'),
      width: 150
    },
    {
      title: 'Product',
      dataIndex: 'product_id',
      render: v => products.find(p => p.id === v || String(p.id) === String(v))?.name || (v ? `#${v}` : '—'),
      width: 250
    },
    {
      title: 'Type',
      dataIndex: 'movement_type',
      render: v => {
        if (v === 'in') return <Tag color="green">IN 🟢</Tag>
        if (v === 'out') return <Tag color="red">OUT 🔴</Tag>
        if (v === 'adjustment') return <Tag color="orange">ADJUST 🟡</Tag>
        return <Tag>{v || '—'}</Tag>
      },
      width: 110
    },
    {
      title: 'QTY (sheets)',
      dataIndex: 'quantity_sheets',
      width: 120,
      align: 'right',
      render: (v, r) => {
        const val = (v !== null && v !== undefined) ? v : (r.quantity ?? '—')
        const col = r.movement_type === 'in' ? '#10b981' : r.movement_type === 'out' ? '#dc2626' : '#f59e0b'
        return <strong style={{ color: col }}>{val}</strong>
      }
    },
    {
      title: 'Balance (sqm)',
      dataIndex: 'quantity_sqm',
      width: 130,
      align: 'right',
      render: (v, r) => {
        const val = (v !== null && v !== undefined) ? v : (r.quantity ?? '—')
        const col = r.movement_type === 'in' ? '#10b981' : r.movement_type === 'out' ? '#dc2626' : '#f59e0b'
        return <strong style={{ color: col }}>{val}</strong>
      }
    },
    {
      title: 'Company Warehouse',
      dataIndex: 'warehouse_id',
      render: v => warehouses.find(w => w.id === v || String(w.id) === String(v))?.name || '—',
      width: 180
    },
    { title: 'Reference', dataIndex: 'reference', width: 150 },
    { title: 'Remarks', dataIndex: 'remarks', width: 200 },
  ]

  const apiFilters = filterProductId ? { product_id: filterProductId } : undefined

  return (
    <>
      <MasterList
        title="Stock Movements"
        queryKey="stock_movements"
        api={stockMovementApi}
        columns={columns}
        createPath=""
        hideCreate={true}
        hideStatus={true}
        hideActions={false}
        searchPlaceholder="Search reference..."
        apiFilters={apiFilters}
        extraHeaderActions={
          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 'bold' }}
            onClick={() => {
              setSelectedMovementsForNote([])
              setIsDeliveryNoteModalOpen(true)
            }}
          >
            Create Delivery Note
          </Button>
        }
        extraActions={(record) => {
          if (record.movement_type === 'out') {
            return (
              <Button
                type="link"
                size="small"
                icon={<FilePdfOutlined />}
                style={{ color: '#10b981', padding: 0 }}
                onClick={() => {
                  setSelectedMovementsForNote([record])
                  setIsDeliveryNoteModalOpen(true)
                }}
              >
                Delivery Note
              </Button>
            )
          }
          return null
        }}
      />

      <CreateDeliveryNoteModal
        open={isDeliveryNoteModalOpen}
        onClose={() => setIsDeliveryNoteModalOpen(false)}
        selectedMovements={selectedMovementsForNote}
      />
    </>
  )
}

export default StockMovements
