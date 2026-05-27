import React, { useState, useMemo } from 'react'
import { 
  Card, Row, Col, Typography, Table, Tag, Button, 
  Input, Modal, Form, InputNumber, Select, App,
  Statistic, Alert, Space, Badge
} from 'antd'
import { 
  AppstoreOutlined, WarningOutlined, DollarOutlined, 
  SearchOutlined, ToolOutlined, PlusOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productApi, stockMovementApi, warehouseApi } from '../../api'

const { Title, Text } = Typography

const StockOverview = () => {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [adjModalOpen, setAdjModalOpen] = useState(false)
  const [adjForm] = Form.useForm()

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productApi.list({ page_size: 1000 }).then(r => r.data)
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-dd'],
    queryFn: () => warehouseApi.dropdown().then(r => r.data)
  })

  const products = productsData?.items || []

  const stats = useMemo(() => {
    let lowCount = 0, outCount = 0, totalValue = 0
    products.forEach(p => {
      const qty = p.on_hand_qty || 0
      const min = p.min_qty || 0
      if (p.product_type === 'storable') {
        if (qty === 0) outCount++
        else if (qty < min) lowCount++
        totalValue += qty * (p.cost_price || 0)
      }
    })
    return {
      totalProducts: products.filter(p => p.product_type === 'storable').length,
      lowCount, outCount, totalValue
    }
  }, [products])

  const filteredProducts = useMemo(() => {
    const storables = products.filter(p => p.product_type === 'storable')
    if (!search) return storables
    const s = search.toLowerCase()
    return storables.filter(p =>
      (p.name || '').toLowerCase().includes(s) ||
      (p.internal_ref || '').toLowerCase().includes(s) ||
      (p.glass_type || '').toLowerCase().includes(s)
    )
  }, [products, search])

  const adjustMutation = useMutation({
    mutationFn: async (values) => {
      const prod = products.find(p => p.id === values.product_id)
      const currentQty = prod?.on_hand_qty || 0
      const newQty = Math.max(0, currentQty + values.qty_change)

      await productApi.update(values.product_id, { 
        ...prod, 
        on_hand_qty: newQty 
      })

      await stockMovementApi.create({
        product_id: values.product_id,
        quantity: Math.abs(values.qty_change),
        movement_type: 'adjustment',
        warehouse_id: values.warehouse_id || 1,
        reference: `ADJ-${Date.now()}`,
        remarks: values.remarks || 'Manual adjustment',
        date: new Date().toISOString(),
      })

      return newQty
    },
    onSuccess: () => {
      message.success('Stock adjusted successfully!')
      queryClient.invalidateQueries({ queryKey: ['products-all'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      adjForm.resetFields()
      setAdjModalOpen(false)
    },
    onError: () => message.error('Adjustment failed')
  })

  const getStockStatus = (p) => {
    const qty = p.on_hand_qty || 0
    const min = p.min_qty || 0
    if (qty === 0) return { color: 'red',    text: 'Out of Stock', icon: <CloseCircleOutlined /> }
    if (qty < min) return { color: 'orange', text: 'Low Stock',    icon: <ExclamationCircleOutlined /> }
    return       { color: 'green',  text: 'In Stock',    icon: <CheckCircleOutlined /> }
  }

  const columns = [
    { 
      title: 'Product', dataIndex: 'name', key: 'name', width: 250,
      render: (v, r) => (
        <div>
          <Text strong style={{ color: '#1e293b' }}>{v}</Text>
          <br/>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.internal_ref}</Text>
        </div>
      )
    },
    { 
      title: 'Glass Type', dataIndex: 'glass_type', key: 'glass_type', width: 150,
      render: v => v ? <Tag color="blue">{v}</Tag> : '—'
    },
    { 
      title: 'Thickness', dataIndex: 'thickness_mm', key: 'thickness_mm', width: 100,
      render: v => v ? `${v} mm` : '—'
    },
    { 
      title: 'On Hand', dataIndex: 'on_hand_qty', key: 'on_hand_qty', width: 100,
      render: (v, r) => {
        const status = getStockStatus(r)
        return <Text strong style={{ color: status.color === 'green' ? '#16a34a' : status.color === 'orange' ? '#ea580c' : '#dc2626', fontSize: 16 }}>{v || 0}</Text>
      }
    },
    { title: 'Min Qty',  dataIndex: 'min_qty',     key: 'min_qty',  width: 90, render: v => v || 0 },
    { title: 'Max Qty',  dataIndex: 'max_qty',     key: 'max_qty',  width: 90, render: v => v || '—' },
    { title: 'UoM',      dataIndex: 'uom_id',      key: 'uom_id',   width: 80, render: () => 'sqft' },
    { 
      title: 'Stock Value', key: 'value', width: 120,
      render: (_, r) => <Text>₹{((r.on_hand_qty || 0) * (r.cost_price || 0)).toLocaleString('en-IN')}</Text>
    },
    { 
      title: 'Status', key: 'status', width: 130,
      render: (_, r) => {
        const s = getStockStatus(r)
        return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>
      }
    },
    {
      title: 'Action', key: 'action', width: 130, fixed: 'right',
      render: (_, r) => (
        <Button 
          size="small" 
          icon={<ToolOutlined />}
          onClick={() => {
            adjForm.setFieldsValue({ product_id: r.id, qty_change: 0 })
            setAdjModalOpen(true)
          }}
        >
          Adjust
        </Button>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', borderRadius: 12, padding: '20px 24px', marginBottom: 24, color: '#fff' }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>Stock Overview</Title>
        <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{stats.totalProducts} storable products tracked</Text>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #d1fae5', background: '#f0fdf4' }}>
            <Statistic title="Total Products" value={stats.totalProducts} prefix={<AppstoreOutlined style={{ color: '#16a34a' }} />} valueStyle={{ color: '#16a34a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #fed7aa', background: '#fff7ed' }}>
            <Statistic title="Low Stock" value={stats.lowCount} prefix={<WarningOutlined style={{ color: '#ea580c' }} />} valueStyle={{ color: '#ea580c' }} />
            {stats.lowCount > 0 && <Text type="secondary" style={{ fontSize: 11 }}>Needs reorder</Text>}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #fecaca', background: '#fff1f2' }}>
            <Statistic title="Out of Stock" value={stats.outCount} prefix={<CloseCircleOutlined style={{ color: '#dc2626' }} />} valueStyle={{ color: '#dc2626' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #bfdbfe', background: '#eff6ff' }}>
            <Statistic title="Total Stock Value" value={stats.totalValue} prefix="₹" valueStyle={{ color: '#1d4ed8', fontSize: 20 }} formatter={v => Number(v).toLocaleString('en-IN')} />
          </Card>
        </Col>
      </Row>

      {/* Low stock alert */}
      {stats.lowCount > 0 && (
        <Alert
          message={`⚠️ ${stats.lowCount} product(s) are below minimum stock level — consider placing a Purchase Order`}
          type="warning" showIcon closable style={{ marginBottom: 16, borderRadius: 8 }}
          action={<Button size="small" onClick={() => window.location.href = '/purchase-orders/new'}>Create PO</Button>}
        />
      )}

      {/* Search + Table */}
      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 12 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Input
            placeholder="Search by product name, code, glass type..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 360 }}
            allowClear
          />
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => { adjForm.resetFields(); setAdjModalOpen(true) }}
          >
            Adjust Stock
          </Button>
        </div>
        <Table
          rowKey="id"
          dataSource={filteredProducts}
          columns={columns}
          loading={isLoading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          rowClassName={r => {
            const qty = r.on_hand_qty || 0
            if (qty === 0) return 'row-out-of-stock'
            if (qty < (r.min_qty || 0)) return 'row-low-stock'
            return ''
          }}
        />
      </Card>

      {/* Adjust Stock Modal */}
      <Modal
        title="📦 Adjust Stock"
        open={adjModalOpen}
        onCancel={() => setAdjModalOpen(false)}
        footer={null}
        width={480}
      >
        <Form form={adjForm} layout="vertical" onFinish={v => adjustMutation.mutate(v)}>
          <Form.Item name="product_id" label="Product" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Select product"
              options={products.filter(p => p.product_type === 'storable').map(p => ({
                value: p.id,
                label: `${p.name} (Stock: ${p.on_hand_qty || 0})`
              }))}
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="qty_change" label="Quantity Change" tooltip="Use positive to add stock, negative to reduce" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} placeholder="+10 to add, -5 to reduce" />
          </Form.Item>
          <Form.Item name="warehouse_id" label="Warehouse">
            <Select
              options={warehouses.map(w => ({ value: w.id, label: w.name }))}
              defaultValue={1}
            />
          </Form.Item>
          <Form.Item name="remarks" label="Reason / Remarks">
            <Input.TextArea rows={2} placeholder="e.g., Physical count, damaged goods, etc." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setAdjModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={adjustMutation.isPending}>Adjust Stock</Button>
          </div>
        </Form>
      </Modal>

      <style>{`
        .row-out-of-stock td { background: #fff1f2 !important; }
        .row-low-stock td { background: #fff7ed !important; }
      `}</style>
    </div>
  )
}

export default StockOverview
