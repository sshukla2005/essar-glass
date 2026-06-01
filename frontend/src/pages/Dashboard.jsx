import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  quotationApi, salesOrderApi, invoiceApi,
  customerApi, deliveryChallanApi
} from '../api'
import { Row, Col, Card, Typography, Space, Radio, Table, Tag, Button } from 'antd'
import {
  ArrowUpOutlined, ArrowDownOutlined,
  RiseOutlined, FallOutlined, FireFilled,
  SettingOutlined, ClockCircleOutlined, UserOutlined, CarOutlined,
  PlusOutlined, FileTextOutlined, ShoppingCartOutlined
} from '@ant-design/icons'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography



const StatCard = ({ title, value, percentage, isUp, textUp, textDown }) => (
  <Card
    style={{
      borderRadius: 24,
      boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
      border: '1px solid #dbeafe',
      backgroundColor: '#f0f7ff',
      transition: 'transform 0.2s, box-shadow 0.2s'
    }}
    hoverable
    bodyStyle={{ padding: '28px' }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
      <Text type="secondary" style={{ fontSize: 14, fontWeight: 500, color: '#8c8c8c' }}>{title}</Text>
      <Tag style={{ borderRadius: 10, padding: '2px 10px', border: '1px solid #f0f0f0', backgroundColor: '#fff', color: '#595959', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
        {isUp ? <RiseOutlined style={{ fontSize: 12 }} /> : <FallOutlined style={{ fontSize: 12 }} />} {percentage}
      </Tag>
    </div>
    <div style={{ marginBottom: 20 }}>
      <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f', fontSize: 32 }}>{value}</Title>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <Text style={{ fontWeight: 600, fontSize: 14, color: '#262626' }}>{textUp}</Text>
      {isUp ? <RiseOutlined style={{ color: '#262626', fontSize: 14 }}/> : <FallOutlined style={{ color: '#262626', fontSize: 14 }} />}
    </div>
    <div>
      <Text type="secondary" style={{ fontSize: 13, color: '#8c8c8c' }}>{textDown}</Text>
    </div>
  </Card>
)

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState('yearly')
  const navigate = useNavigate()

  // ── Fetch real data from backend ──────────────────────────────
  const { data: quotationsData } = useQuery({
    queryKey: ['dashboard-quotations'],
    queryFn: () => quotationApi.list({ page: 1, page_size: 500 }).then(r => r.data),
    staleTime: 30000,
  })
  const { data: salesOrdersData } = useQuery({
    queryKey: ['dashboard-sales-orders'],
    queryFn: () => salesOrderApi.list({ page: 1, page_size: 500 }).then(r => r.data),
    staleTime: 30000,
  })
  const { data: invoicesData } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: () => invoiceApi.list({ page: 1, page_size: 500 }).then(r => r.data),
    staleTime: 30000,
  })
  const { data: customersData } = useQuery({
    queryKey: ['dashboard-customers'],
    queryFn: () => customerApi.list({ page: 1, page_size: 500 }).then(r => r.data),
    staleTime: 60000,
  })
  const { data: deliveriesData } = useQuery({
    queryKey: ['dashboard-deliveries'],
    queryFn: () => deliveryChallanApi.list({ page: 1, page_size: 500 }).then(r => r.data),
    staleTime: 30000,
  })

  const stats = useMemo(() => {
    const quotations  = quotationsData?.items  || []
    const salesOrders = salesOrdersData?.items || []
    const invoices    = invoicesData?.items    || []
    const customers   = customersData?.items   || []
    const deliveries  = deliveriesData?.items  || []

    const totalQuotes   = quotationsData?.total || quotations.length
    const pendingQuotes = quotations.filter(q => q.status === 'draft').length

    const activeSOs = salesOrders.filter(s =>
      ['confirmed', 'in_production'].includes(s.status)
    ).length
    const readySOs = salesOrders.filter(s => s.status === 'ready').length

    const dispatchReady    = salesOrders.filter(s => s.status === 'ready').length
    const awaitingDispatch = deliveries.filter(d => d.status === 'draft').length

    const totalRevenue = invoices
      .filter(i => ['paid', 'sent'].includes(i.status))
      .reduce((sum, i) => sum + (i.total_amount || 0), 0)
    const pendingRevenue = invoices
      .filter(i => i.status === 'draft')
      .reduce((sum, i) => sum + (i.total_amount || 0), 0)

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const chartData = months.map((name, idx) => {
      const monthQuotes = quotations.filter(q => {
        const d = new Date(q.created_at || q.quote_date)
        return !isNaN(d) && d.getMonth() === idx
      })
      return { name, quotations: monthQuotes.reduce((s, q) => s + (q.total_amount || 0), 0) }
    })

    const recentSOs = [...salesOrders]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(s => {
        const cust = customers.find(c => c.id === s.customer_id)
        return {
          key: s.id,
          order: `${s.so_number || 'SO-'} / ${cust?.name || s.customer_name || 'Customer'}`,
          process: s.status === 'in_production' ? 'Processing' :
                   s.status === 'confirmed'     ? 'Confirmed'  :
                   s.status === 'ready'         ? 'Ready'      :
                   s.status === 'delivered'     ? 'Delivered'  : 'Draft',
          qty: `${s.lines?.length || 0} Lines`,
          dispatch: s.delivery_date || 'TBD',
          assigned: s.salesperson || 'Not Assigned',
          status: s.status,
        }
      })

    const recentInvoices = [...invoices]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6)
      .map(i => {
        const cust = customers.find(c => c.id === i.customer_id)
        return {
          key: i.id,
          status: i.status || 'draft',
          customer: cust?.name || 'Customer',
          amount: i.total_amount || 0,
        }
      })

    return {
      totalQuotes, pendingQuotes,
      activeSOs, readySOs,
      dispatchReady, awaitingDispatch,
      totalRevenue, pendingRevenue,
      chartData,
      recentSOs,
      recentInvoices,
      totalCustomers: customersData?.total || customers.length,
      lowStockCount: 0,
    }
  }, [quotationsData, salesOrdersData, invoicesData, customersData, deliveriesData])

  const getChartData = () => {
    if (timeRange === '7days')  return stats.chartData.slice(-3)
    if (timeRange === '30days') return stats.chartData.slice(-4)
    return stats.chartData
  }

  // Format currency
  const formatINR = (val) => {
    if (val >= 100000) return `₹ ${(val/100000).toFixed(1)}L`
    if (val >= 1000)   return `₹ ${(val/1000).toFixed(1)}K`
    return `₹ ${val.toLocaleString('en-IN')}`
  }

  const trackingColumns = [
    { title: 'Order', dataIndex: 'order', key: 'order', render: (text) => <Text strong style={{ color: '#1f1f1f' }}>{text}</Text> },
    { title: 'Process', dataIndex: 'process', key: 'process', render: (p) => {
      const color = p === 'Processing' ? 'warning' : p === 'Ready' ? 'success' : p === 'Delivered' ? 'success' : p === 'Confirmed' ? 'processing' : 'default'
      return <Tag color={color} style={{ borderRadius: 6, padding: '2px 8px', fontWeight: 500 }}><SettingOutlined style={{marginRight: 4}}/>{p}</Tag>
    }},
    { title: 'Lines', dataIndex: 'qty', key: 'qty' },
    { title: 'Delivery Date', dataIndex: 'dispatch', key: 'dispatch', render: (text) => <Space><CarOutlined style={{color: '#8c8c8c'}}/><Text>{text}</Text></Space> },
    { title: 'Salesperson', dataIndex: 'assigned', key: 'assigned', render: (text) => <Space><UserOutlined style={{color: '#8c8c8c'}}/><Text>{text}</Text></Space> },
  ]

  return (
    <div style={{ padding: '24px 32px', backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: "'Inter', sans-serif", width: '100%' }}>

      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            Admin Dashboard
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Welcome back! Here's what's happening with Essar Glass today.
          </Text>
        </div>
        {/* Quick Action Buttons */}
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/quotations/new')}>New Quotation</Button>
          <Button icon={<FileTextOutlined />} onClick={() => navigate('/sales-orders/new')}>New Sales Order</Button>
          <Button icon={<ShoppingCartOutlined />} onClick={() => navigate('/purchase-orders/new')}>New PO</Button>
        </Space>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Quotations Created"
            value={stats.totalQuotes}
            percentage={stats.pendingQuotes > 0 ? `${stats.pendingQuotes} pending` : 'All sent'}
            isUp={stats.totalQuotes > 0}
            textUp={stats.totalQuotes > 0 ? "Active quotations" : "No quotations yet"}
            textDown={`${stats.pendingQuotes} awaiting confirmation`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Active Sales Orders"
            value={stats.activeSOs}
            percentage={stats.readySOs > 0 ? `${stats.readySOs} ready` : 'In progress'}
            isUp={stats.activeSOs > 0}
            textUp={stats.activeSOs > 0 ? "Orders in production" : "No active orders"}
            textDown={`${stats.readySOs} orders ready to dispatch`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Dispatch Ready Orders"
            value={stats.dispatchReady}
            percentage={stats.awaitingDispatch > 0 ? `${stats.awaitingDispatch} pending DC` : 'All dispatched'}
            isUp={stats.dispatchReady > 0}
            textUp={stats.dispatchReady > 0 ? "Ready for delivery" : "No orders ready"}
            textDown={`${stats.awaitingDispatch} delivery challans pending`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Total Revenue"
            value={formatINR(stats.totalRevenue)}
            percentage={stats.totalRevenue > 0 ? '+Active' : 'No invoices'}
            isUp={stats.totalRevenue > 0}
            textUp={stats.totalRevenue > 0 ? "From paid invoices" : "No revenue yet"}
            textDown={`${formatINR(stats.pendingRevenue)} pending collection`}
          />
        </Col>
      </Row>

      {/* ── Chart & Payments ──────────────────────────────────────── */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} lg={12}>
          <Card
            bordered={false}
            style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', height: '100%' }}
            bodyStyle={{ padding: '24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Quotations Trend</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>Monthly revenue from quotations</Text>
              </div>
              <Radio.Group value={timeRange} onChange={(e) => setTimeRange(e.target.value)} size="small">
                <Radio.Button value="yearly">Yearly</Radio.Button>
                <Radio.Button value="30days">Month</Radio.Button>
              </Radio.Group>
            </div>
            <div style={{ height: 320, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getChartData()}>
                  <defs>
                    <linearGradient id="colorQ" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => v > 0 ? `₹${(v/1000).toFixed(0)}k` : '₹0'} />
                  <Tooltip formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']} />
                  <Area type="monotone" dataKey="quotations" stroke="#10b981" strokeWidth={2} fill="url(#colorQ)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {stats.totalQuotes === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 8 }}>
                <Text type="secondary">Create quotations to see trend data</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            bordered={false}
            style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', height: '100%' }}
            bodyStyle={{ padding: '24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Payments</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>Recent invoice payments</Text>
              </div>
              <Button size="small" onClick={() => navigate('/invoices')}>View All</Button>
            </div>
            <Table
              pagination={false}
              size="small"
              dataSource={stats.recentInvoices}
              locale={{ emptyText: 'No invoices yet — create your first invoice!' }}
              columns={[
                { title: 'Status', dataIndex: 'status', render: s => <Tag color={s==='paid'?'green':s==='sent'?'blue':s==='cancelled'?'red':'default'} style={{borderRadius: 6}}>{s?.toUpperCase()}</Tag> },
                { title: 'Customer', dataIndex: 'customer', render: c => <Text strong style={{fontSize: 13}}>{c}</Text> },
                { title: 'Amount', dataIndex: 'amount', align: 'right', render: a => <Text strong>₹{Number(a).toLocaleString('en-IN')}</Text> },
                { title: '', key: 'action', align: 'right', render: () => <Text type="secondary" style={{cursor: 'pointer'}}>•••</Text> }
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Live Operational Tracking ─────────────────────────────── */}
      <Card
        bordered={false}
        style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: '24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ backgroundColor: '#fff2e8', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FireFilled style={{ fontSize: 20, color: '#fa541c' }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f' }}>Live Operational Tracking</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>Recent sales orders status</Text>
            </div>
          </div>
          <Button size="small" onClick={() => navigate('/sales-orders')}>View All Orders</Button>
        </div>
        <Table
          columns={trackingColumns}
          dataSource={stats.recentSOs}
          pagination={false}
          style={{ width: '100%' }}
          locale={{ emptyText: 'No sales orders yet — create your first sales order!' }}
          rowClassName={() => 'operational-tracking-row'}
        />
      </Card>

      <style>{`
        .operational-tracking-row:hover > td { background-color: #fafafa !important; }
        .ant-table-thead > tr > th { background-color: #fafafa; color: #595959; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; padding: 16px 24px !important; }
        .ant-table-tbody > tr > td { padding: 16px 24px !important; border-bottom: 1px solid #f0f0f0; }
      `}</style>
    </div>
  )
}

export default Dashboard
