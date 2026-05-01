import React, { useMemo } from 'react'
import { Card, Row, Col, Typography, Table, Tag, Button, Space } from 'antd'
import { DollarOutlined, ShoppingCartOutlined, TeamOutlined, WarningOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const Dashboard = () => {
  const navigate = useNavigate()

  // Read data synchronously from localStorage for fast dashboard render
  const readAll = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } }

  const invoices = readAll('invoices')
  const salesOrders = readAll('sales_orders')
  const leads = readAll('crm_leads')
  const products = readAll('products')
  const quotations = readAll('quotations')
  const customers = readAll('customers')

  const stats = useMemo(() => {
    // Total Revenue (Paid Invoices)
    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount_paid || i.total_amount || 0), 0)
    // Pending Orders (SO not delivered/cancelled)
    const pendingOrders = salesOrders.filter(s => ['draft', 'confirmed', 'in_production', 'ready'].includes(s.status)).length
    // Active Leads
    const activeLeads = leads.filter(l => !['won', 'lost'].includes(l.status)).length
    // Low Stock Alert Count
    const lowStockCount = products.filter(p => (p.on_hand_qty || 0) < (p.min_qty || 0)).length

    return { totalRevenue, pendingOrders, activeLeads, lowStockCount }
  }, [invoices, salesOrders, leads, products])

  const recentQuotations = useMemo(() => {
    return [...quotations].reverse().slice(0, 5)
  }, [quotations])

  const recentSOs = useMemo(() => {
    return [...salesOrders].reverse().slice(0, 5)
  }, [salesOrders])

  const lowStockProducts = useMemo(() => {
    return products.filter(p => (p.on_hand_qty || 0) < (p.min_qty || 0)).slice(0, 4)
  }, [products])

  const cardStyle = { borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }

  const formatCurrency = (val) => `₹ ${Number(val||0).toLocaleString('en-IN')}`

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>🏠 Executive Dashboard</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/crm/leads/new')} style={{ background: '#8b5cf6' }}>New Lead</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/quotations/new')} style={{ background: '#3b82f6' }}>New Quotation</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/sales-orders/new')} style={{ background: '#10b981' }}>New Sale Order</Button>
        </Space>
      </div>

      {/* Row 1 — KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ ...cardStyle, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }} bodyStyle={{ padding: 24 }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 600, textTransform: 'uppercase' }}>Total Revenue</div>
            <div style={{ color: 'white', fontSize: 32, fontWeight: 800, marginTop: 8 }}><DollarOutlined /> {formatCurrency(stats.totalRevenue)}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ ...cardStyle, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }} bodyStyle={{ padding: 24 }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 600, textTransform: 'uppercase' }}>Pending Orders</div>
            <div style={{ color: 'white', fontSize: 32, fontWeight: 800, marginTop: 8 }}><ShoppingCartOutlined /> {stats.pendingOrders}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ ...cardStyle, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }} bodyStyle={{ padding: 24 }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 600, textTransform: 'uppercase' }}>Active Leads</div>
            <div style={{ color: 'white', fontSize: 32, fontWeight: 800, marginTop: 8 }}><TeamOutlined /> {stats.activeLeads}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ ...cardStyle, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }} bodyStyle={{ padding: 24 }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 600, textTransform: 'uppercase' }}>Low Stock Alerts</div>
            <div style={{ color: 'white', fontSize: 32, fontWeight: 800, marginTop: 8 }}><WarningOutlined /> {stats.lowStockCount}</div>
          </Card>
        </Col>
      </Row>

      {/* Row 2 — Tables */}
      <Row gutter={[24, 24]}>
        <Col span={12}>
          <Card title="Recent Quotations" style={cardStyle} bodyStyle={{ padding: 0 }} headStyle={{ borderBottom: '1px solid #f1f5f9' }}>
            <Table dataSource={recentQuotations} rowKey="id" pagination={false} size="small" columns={[
              { title: 'Quote #', dataIndex: 'quote_number', render: v => <a onClick={() => navigate(`/quotations/${recentQuotations.find(q=>q.quote_number===v)?.id}/edit`)}>{v}</a> },
              { title: 'Customer', dataIndex: 'customer_id', render: v => customers.find(c => c.id === v)?.name || v },
              { title: 'Date', dataIndex: 'quote_date' },
              { title: 'Total', dataIndex: 'total_amount', render: v => <b>{formatCurrency(v)}</b> },
              { title: 'Status', dataIndex: 'status', render: v => <Tag color={v==='confirmed'?'blue':v==='converted'?'purple':'default'}>{v}</Tag> }
            ]} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Recent Sales Orders" style={cardStyle} bodyStyle={{ padding: 0 }} headStyle={{ borderBottom: '1px solid #f1f5f9' }}>
            <Table dataSource={recentSOs} rowKey="id" pagination={false} size="small" columns={[
              { title: 'SO #', dataIndex: 'so_number', render: v => <a onClick={() => navigate(`/sales-orders/${recentSOs.find(s=>s.so_number===v)?.id}/edit`)}>{v}</a> },
              { title: 'Customer', dataIndex: 'customer_id', render: v => customers.find(c => c.id === v)?.name || v },
              { title: 'Date', dataIndex: 'order_date' },
              { title: 'Total', dataIndex: 'total_amount', render: v => <b>{formatCurrency(v)}</b> },
              { title: 'Status', dataIndex: 'status', render: v => <Tag color={v==='delivered'?'green':'blue'}>{v}</Tag> }
            ]} />
          </Card>
        </Col>
      </Row>

      {/* Row 3 — Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Title level={5} style={{ color: '#dc2626' }}><WarningOutlined /> Low Stock Warnings</Title>
          <Row gutter={[16, 16]}>
            {lowStockProducts.map(p => (
              <Col span={6} key={p.id}>
                <Card style={{ ...cardStyle, borderLeft: '4px solid #ef4444' }} bodyStyle={{ padding: 16 }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{p.internal_ref}</div>
                  <Row justify="space-between">
                    <Col>On Hand: <strong style={{ color: '#dc2626' }}>{p.on_hand_qty || 0}</strong></Col>
                    <Col>Min: {p.min_qty}</Col>
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </div>
  )
}

export default Dashboard
