import React, { useState, useMemo } from 'react'
import { Card, Row, Col, Typography, Table, Tag, Button, Input, Modal, Form, InputNumber, Select, App } from 'antd'
import { AppstoreOutlined, WarningOutlined, DollarOutlined, RetweetOutlined, SearchOutlined, ToolOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productApi, stockMovementApi, warehouseApi } from '../../api'

const { Title, Text } = Typography

const StockOverview = () => {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [adjModalOpen, setAdjModalOpen] = useState(false)
  const [adjForm] = Form.useForm()

  const { data: productsData, isLoading } = useQuery({ queryKey: ['products-all'], queryFn: () => productApi.list({ page_size: 1000 }).then(r => r.data) })
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses-dd'], queryFn: () => warehouseApi.dropdown().then(r => r.data) })

  const products = productsData?.items || []

  const stats = useMemo(() => {
    let lowCount = 0; let outCount = 0; let totalValue = 0
    products.forEach(p => {
      const qty = p.on_hand_qty || 0
      const min = p.min_qty || 0
      if (qty === 0) outCount++
      else if (qty < min) lowCount++
      totalValue += qty * (p.cost_price || 0)
    })
    return { totalProducts: products.length, lowCount, outCount, totalValue }
  }, [products])

  const filteredProducts = useMemo(() => {
    if (!search) return products
    const s = search.toLowerCase()
    return products.filter(p => (p.name || '').toLowerCase().includes(s) || (p.internal_ref || '').toLowerCase().includes(s) || (p.glass_type || '').toLowerCase().includes(s))
  }, [products, search])

  const adjustMutation = useMutation({
    mutationFn: async (values) => {
      const prod = products.find(p => p.id === values.product_id)
      const currentQty = prod?.on_hand_qty || 0
      const newQty = currentQty + values.qty_change
      
      // Update product
      await productApi.update(values.product_id, { on_hand_qty: newQty })
      
      // Create movement
      await stockMovementApi.create({
        product_id: values.product_id, quantity: Math.abs(values.qty_change),
        movement_type: 'adjustment', warehouse_id: values.warehouse_id,
        remarks: values.remarks, date: new Date().toISOString()
      })
    },
    onSuccess: () => {
      message.success('Stock adjusted successfully')
      setAdjModalOpen(false)
      adjForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['products-all'] })
    }
  })

  const columns = [
    { title: 'Internal Ref', dataIndex: 'internal_ref', width: 120 },
    { title: 'Product Name', dataIndex: 'name', width: 250 },
    { title: 'Glass Type', dataIndex: 'glass_type', width: 120 },
    { title: 'Thickness', dataIndex: 'thickness_mm', render: v => v ? `${v}mm` : '—', width: 100 },
    { title: 'On Hand', dataIndex: 'on_hand_qty', render: (v, r) => (
      <span style={{ fontSize: 16, fontWeight: 700, color: v === 0 ? '#dc2626' : v < (r.min_qty||0) ? '#f59e0b' : '#10b981' }}>{v || 0}</span>
    ), width: 100 },
    { title: 'Min Qty', dataIndex: 'min_qty', width: 100 },
    { title: 'Status', render: (_, r) => {
      const qty = r.on_hand_qty || 0; const min = r.min_qty || 0
      if (qty === 0) return <Tag color="red">OUT OF STOCK</Tag>
      if (qty < min) return <Tag color="orange">LOW STOCK</Tag>
      return <Tag color="green">IN STOCK</Tag>
    }, width: 120 },
    { title: 'Actions', render: (_, r) => <Button size="small" type="primary" ghost icon={<ToolOutlined />} onClick={() => { adjForm.setFieldsValue({ product_id: r.id, qty_change: 0, warehouse_id: warehouses[0]?.value }); setAdjModalOpen(true) }}>Adjust</Button>, width: 100 },
  ]

  const cardStyle = { borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>📦 Stock Overview</Title>
        <Space>
          <Button type="primary" icon={<ToolOutlined />} onClick={() => setAdjModalOpen(true)} style={{ background: '#6366f1' }}>Adjust Stock</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ ...cardStyle, background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }} bodyStyle={{ padding: 20 }}>
            <div style={{ color: 'white', opacity: 0.8, fontSize: 14, fontWeight: 500, textTransform: 'uppercase' }}>Total Products</div>
            <div style={{ color: 'white', fontSize: 32, fontWeight: 800, marginTop: 8 }}><AppstoreOutlined /> {stats.totalProducts}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ ...cardStyle, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }} bodyStyle={{ padding: 20 }}>
            <div style={{ color: 'white', opacity: 0.8, fontSize: 14, fontWeight: 500, textTransform: 'uppercase' }}>Low Stock Items</div>
            <div style={{ color: 'white', fontSize: 32, fontWeight: 800, marginTop: 8 }}><WarningOutlined /> {stats.lowCount}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ ...cardStyle, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }} bodyStyle={{ padding: 20 }}>
            <div style={{ color: 'white', opacity: 0.8, fontSize: 14, fontWeight: 500, textTransform: 'uppercase' }}>Out of Stock</div>
            <div style={{ color: 'white', fontSize: 32, fontWeight: 800, marginTop: 8 }}><WarningOutlined /> {stats.outCount}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ ...cardStyle, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }} bodyStyle={{ padding: 20 }}>
            <div style={{ color: 'white', opacity: 0.8, fontSize: 14, fontWeight: 500, textTransform: 'uppercase' }}>Total Stock Value</div>
            <div style={{ color: 'white', fontSize: 32, fontWeight: 800, marginTop: 8 }}><DollarOutlined /> ₹ {stats.totalValue.toLocaleString('en-IN')}</div>
          </Card>
        </Col>
      </Row>

      <Card title="Current Inventory" extra={<Input prefix={<SearchOutlined />} placeholder="Search products..." onChange={e => setSearch(e.target.value)} style={{ width: 300 }} />} style={cardStyle} bodyStyle={{ padding: 0 }}>
        <Table dataSource={filteredProducts} columns={columns} rowKey="id" loading={isLoading} pagination={{ pageSize: 20 }} scroll={{ x: 1000 }} />
      </Card>

      <Modal title="Adjust Stock Quantity" open={adjModalOpen} onCancel={() => setAdjModalOpen(false)} onOk={() => adjForm.submit()} confirmLoading={adjustMutation.isPending}>
        <Form form={adjForm} layout="vertical" onFinish={adjustMutation.mutate}>
          <Form.Item name="product_id" label="Product" rules={[{ required: true }]}><Select showSearch options={products.map(p => ({ value: p.id, label: p.name }))} filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())} /></Form.Item>
          <Form.Item name="warehouse_id" label="Warehouse" rules={[{ required: true }]}><Select options={warehouses} /></Form.Item>
          <Form.Item name="qty_change" label="Quantity Change (+ to add, - to deduct)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="remarks" label="Reason / Remarks" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default StockOverview
