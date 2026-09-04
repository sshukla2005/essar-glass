import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  quotationApi, salesOrderApi, invoiceApi,
  customerApi, deliveryChallanApi, workshopOrderApi,
  companyApi
} from '../api'
import { Row, Col, Card, Typography, Space, Radio, Table, Tag, Button, DatePicker, Progress, Tooltip as AntTooltip } from 'antd'
import {
  ArrowUpOutlined, ArrowDownOutlined,
  RiseOutlined, FallOutlined, FireFilled,
  SettingOutlined, ClockCircleOutlined, UserOutlined, CarOutlined,
  PlusOutlined, FileTextOutlined, ShoppingCartOutlined, InfoCircleOutlined
} from '@ant-design/icons'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useAuth } from '../hooks/useAuth'

const { Title, Text } = Typography

const StatCard = ({ title, value, percentage, isUp, textUp, textDown, onClick, tooltip }) => {
  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onClick(e)
    }
  }

  const titleNode = (
    <Text type="secondary" style={{ fontSize: 14, fontWeight: 500, color: '#8c8c8c' }}>
      {title}
      {tooltip && (
        <AntTooltip title={tooltip}>
          <InfoCircleOutlined style={{ marginLeft: 6, color: '#8c8c8c', cursor: 'pointer' }} />
        </AntTooltip>
      )}
    </Text>
  )

  return (
    <Card
      style={{
        borderRadius: 24,
        boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
        border: '1px solid #dbeafe',
        backgroundColor: '#f0f7ff',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: onClick ? 'pointer' : 'default'
      }}
      hoverable
      bodyStyle={{ padding: '28px' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        {titleNode}
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
}

const ProductionTile = ({ title, data, color, bgColor }) => {
  return (
    <Card
      style={{
        borderRadius: 16,
        border: `1px solid ${color}30`,
        backgroundColor: bgColor,
        padding: '12px 16px',
        height: '100%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
      }}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ fontWeight: 600, color: '#334155', fontSize: 13, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{title}</span>
        <Tag color={color} style={{ margin: 0, fontSize: 11, borderRadius: 4, fontWeight: 700 }}>
          {Number(data?.total_sqft || 0).toFixed(1)} Sq Ft
        </Tag>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#64748b' }}>Thin (&lt;8mm):</span>
          <span style={{ fontWeight: 600, color: '#1e293b' }}>{Number(data?.thin_sqft || 0).toFixed(1)} sqft</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#64748b' }}>Thick (&ge;8mm):</span>
          <span style={{ fontWeight: 600, color: '#1e293b' }}>{Number(data?.thick_sqft || 0).toFixed(1)} sqft</span>
        </div>
        {data?.unclassified_sqft > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#64748b' }}>Unclassified:</span>
            <span style={{ fontWeight: 600, color: '#f97316' }}>{Number(data?.unclassified_sqft || 0).toFixed(1)} sqft</span>
          </div>
        )}
      </div>
    </Card>
  )
}

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState('yearly')
  const [cuttingPreset, setCuttingPreset] = useState('today')
  const [cuttingDate, setCuttingDate] = useState(dayjs())
  const [viewMode, setViewMode] = useState('active')
  const { activeCompanyId, user } = useAuth()
  const isSales = user?.role === 'sales'
  const navigate = useNavigate()

  const { data: companyListRes } = useQuery({
    queryKey: ['header-companies'],
    queryFn: () => companyApi.dropdown().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const companies = useMemo(() => {
    const list = Array.isArray(companyListRes) ? companyListRes : (companyListRes?.items || [])
    if (list.length === 0) {
      try {
        return JSON.parse(localStorage.getItem('companies_master') || '[]')
      } catch { return [] }
    }
    return list
  }, [companyListRes])

  const activeCompanyName = useMemo(() => {
    const active = companies.find(c => c.id === activeCompanyId)
    return active ? active.name : 'All Companies'
  }, [companies, activeCompanyId])

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
  const { data: cuttingRegisterData } = useQuery({
    queryKey: ['dashboard-cutting-register', cuttingPreset, cuttingDate?.format('YYYY-MM-DD')],
    queryFn: () => workshopOrderApi.cuttingRegister({
      preset: cuttingPreset,
      date: cuttingDate ? cuttingDate.format('YYYY-MM-DD') : undefined
    }).then(r => r.data),
    staleTime: 30000,
    enabled: !isSales,
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

    const committedSOStatuses = ['confirmed', 'in_production', 'ready', 'delivered']
    const totalRevenue = salesOrders
      .filter(s => committedSOStatuses.includes(s.status))
      .reduce((sum, s) => sum + (s.total_amount || 0), 0)
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
          id: i.id,
          status: i.status || 'draft',
          customer: cust?.name || 'Customer',
          amount: i.total_amount || 0,
        }
      })

    // ── Server-aggregated Cutting Register ────────────────
    const cuttingRows = cuttingRegisterData?.items || []
    const totalThinSqft = cuttingRegisterData?.total_thin_sqft || 0
    const totalThickSqft = cuttingRegisterData?.total_thick_sqft || 0
    const totalUnclassifiedSqft = cuttingRegisterData?.total_unclassified_sqft || 0
    const totalAllSqft = cuttingRegisterData?.total_all_sqft || 0
    const cut_today = cuttingRegisterData?.cut_today
    const in_progress = cuttingRegisterData?.in_progress
    const pending = cuttingRegisterData?.pending
    const completed = cuttingRegisterData?.completed

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
      cuttingRows, totalThinSqft, totalThickSqft, totalUnclassifiedSqft, totalAllSqft,
      cut_today, in_progress, pending, completed,
    }
  }, [quotationsData, salesOrdersData, invoicesData, customersData, deliveriesData, cuttingRegisterData])

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

  const filteredCuttingRows = useMemo(() => {
    const rows = stats.cuttingRows || []
    if (viewMode === 'active') {
      return rows.filter(r => r.status !== 'completed' && (r.progress_pct || 0) < 100)
    }
    if (viewMode === 'completed') {
      return rows.filter(r => r.status === 'completed' || (r.progress_pct || 0) === 100)
    }
    return rows
  }, [stats.cuttingRows, viewMode])

  return (
    <div style={{ padding: '24px 32px', backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: "'Inter', sans-serif", width: '100%' }}>

      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            Admin Dashboard
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Welcome back! Here's what's happening with {activeCompanyName} today.
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
            onClick={() => navigate('/quotations')}
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
            onClick={() => navigate('/sales-orders')}
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
            onClick={() => navigate('/sales-orders?status=ready')}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Total Revenue"
            value={formatINR(stats.totalRevenue)}
            percentage={stats.totalRevenue > 0 ? '+Active' : 'No SOs'}
            isUp={stats.totalRevenue > 0}
            textUp={stats.totalRevenue > 0 ? "From confirmed sales orders" : "No committed orders"}
            textDown="Invoicing maintained in Tally"
            tooltip="Based on confirmed sales orders. Invoicing is maintained in Tally."
            onClick={() => navigate('/sales-orders')}
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
              onRow={(record) => {
                if (record.id) {
                  return {
                    style: { cursor: 'pointer' },
                    onClick: () => navigate(`/invoices/${record.id}/edit`)
                  }
                }
                return {}
              }}
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

      {/* ── Cutting Register ─────────────────────────────────── */}
      {!isSales && (
        <>
          <Card
            bordered={false}
            style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden', marginTop: 24 }}
            bodyStyle={{ padding: 0 }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              background: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  background: '#fef3c7', padding: 8, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ fontSize: 20 }}>🔪</span>
                </div>
                <div>
                  <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Cutting Register</Title>
                  <Text type="secondary" style={{ fontSize: 13 }}>Workshop orders — glass cutting status</Text>
                </div>
              </div>
              <Space wrap>
                <Radio.Group
                  value={cuttingPreset}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCuttingPreset(val);
                    if (val === 'today') setCuttingDate(dayjs());
                    if (val === 'yesterday') setCuttingDate(dayjs().subtract(1, 'day'));
                  }}
                  size="small"
                >
                  <Radio.Button value="today">Today</Radio.Button>
                  <Radio.Button value="yesterday">Yesterday</Radio.Button>
                  <Radio.Button value="this_week">This Week</Radio.Button>
                </Radio.Group>
                <DatePicker
                  size="small"
                  value={cuttingDate}
                  onChange={(val) => {
                    if (val) {
                      setCuttingDate(val);
                      setCuttingPreset('custom');
                    }
                  }}
                  style={{ width: 120 }}
                />
                <Button size="small" onClick={() => navigate('/workshop/orders')}>View All WOs</Button>
              </Space>
            </div>

            {/* 4 Productivity Tiles */}
            <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                  <ProductionTile
                    title={cuttingPreset === 'this_week' ? "Cut This Week" : "Cut Selected Day"}
                    data={stats.cut_today}
                    color="green"
                    bgColor="#f0fdf4"
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <ProductionTile
                    title="In Progress"
                    data={stats.in_progress}
                    color="orange"
                    bgColor="#fffbeb"
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <ProductionTile
                    title="Pending"
                    data={stats.pending}
                    color="blue"
                    bgColor="#eff6ff"
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <ProductionTile
                    title="Completed (Cumulative)"
                    data={stats.completed}
                    color="purple"
                    bgColor="#faf5ff"
                  />
                </Col>
              </Row>
            </div>

            {/* View Mode Switcher */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-start', background: '#fff' }}>
              <Radio.Group
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                size="small"
              >
                <Radio.Button value="active">Active Production</Radio.Button>
                <Radio.Button value="completed">Completed Orders</Radio.Button>
                <Radio.Button value="all">All Orders</Radio.Button>
              </Radio.Group>
            </div>

            {/* Table */}
            <Table
              dataSource={filteredCuttingRows}
              pagination={{ pageSize: 15, size: 'small' }}
              size="small"
              locale={{ emptyText: 'No workshop orders in this view' }}
              onRow={(record) => ({
                style: { cursor: 'pointer' },
                onClick: () => navigate(`/workshop/orders/${record.id}/edit`)
              })}
              columns={[
                {
                  title: 'Date', dataIndex: 'date', width: 90,
                  render: v => {
                    if (!v || v === '—') return '—'
                    try {
                      const d = new Date(v)
                      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                    } catch { return v }
                  }
                },
                {
                  title: 'Order No', dataIndex: 'wo_number', width: 100,
                  render: v => <Text strong style={{ color: '#6366f1' }}>{v}</Text>
                },
                {
                  title: 'Customer Name', dataIndex: 'customer_name', width: 180,
                  render: v => <Text strong>{v}</Text>
                },
                {
                  title: 'THICKNESS', dataIndex: 'description', width: 200,
                  render: v => (
                    <Text style={{ fontSize: 12, color: '#475569' }}>
                      {v?.length > 40 ? v.substring(0, 40) + '...' : v}
                    </Text>
                  )
                },
                {
                  title: 'THIN', dataIndex: 'thin_sqft', width: 80, align: 'right',
                  render: v => v ? (
                    <Text strong style={{ color: '#16a34a' }}>
                      {Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </Text>
                  ) : null
                },
                {
                  title: 'THICK', dataIndex: 'thick_sqft', width: 80, align: 'right',
                  render: v => v ? (
                    <Text strong style={{ color: '#1d4ed8' }}>
                      {Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </Text>
                  ) : null
                },
                {
                  title: 'UNCLASS', dataIndex: 'unclassified_sqft', width: 80, align: 'right',
                  render: v => v ? (
                    <Text strong style={{ color: '#ea580c' }}>
                      {Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </Text>
                  ) : null
                },
                {
                  title: 'Cut / Total', key: 'cut_total', width: 90, align: 'center',
                  render: (_, record) => (
                    <Text style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      {record.cut_pieces} / {record.total_pieces}
                    </Text>
                  )
                },
                {
                  title: 'Progress', dataIndex: 'progress_pct', width: 120,
                  render: (pct) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Progress
                        percent={pct}
                        size="small"
                        strokeColor={{
                          '0%': '#10b981',
                          '100%': '#059669',
                        }}
                        style={{ flex: 1, margin: 0 }}
                      />
                    </div>
                  )
                },
                {
                  title: 'STATUS', dataIndex: 'status_label', width: 110,
                  render: (v) => {
                    const colorMap = {
                      'PENDING': { bg: '#fef3c7', color: '#b45309', border: '#fde047' },
                      'UNDR CTNG': { bg: '#fecaca', color: '#dc2626', border: '#fca5a5' },
                      'UNDR TOUGH': { bg: '#fecaca', color: '#dc2626', border: '#fca5a5' },
                      'RDY': { bg: '#bbf7d0', color: '#15803d', border: '#86efac' },
                      'RDY RPDA': { bg: '#bbf7d0', color: '#15803d', border: '#86efac' },
                      'CANCELLED': { bg: '#e2e8f0', color: '#64748b', border: '#cbd5e1' },
                    }
                    const style = colorMap[v] || colorMap['PENDING']
                    return (
                      <span style={{
                        background: style.bg,
                        color: style.color,
                        border: `1px solid ${style.border}`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                      }}>
                        {v}
                      </span>
                    )
                  }
                },
              ]}
            />
          </Card>
        </>
      )}

      <style>{`
        .operational-tracking-row:hover > td { background-color: #fafafa !important; }
        .ant-table-thead > tr > th { background-color: #fafafa; color: #595959; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; padding: 16px 24px !important; }
        .ant-table-tbody > tr > td { padding: 16px 24px !important; border-bottom: 1px solid #f0f0f0; }
      `}</style>
    </div>
  )
}

export default Dashboard
